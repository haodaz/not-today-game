// shell (2026-11-04): one shell for every task page, light, after the Claude desktop app. The
// conversation with Kuro is the page (the outer frame); the explorer (left) and the app panes
// (right) are inset cards that open and close around it. Only what is inside the panes changes from
// day to day (table / IDE / meeting / a task's own surface). No new board interaction: picking,
// placing, Kuro's fill, the lock, print and send are the board's own actions. Card state is session
// only, per task (`session.shell`); the board itself rebuilds from the log.
import type { GameEvent } from "@state/events";
import { boardState, canFetch, canPrint, foundCardIds, modFound, pathFound, pathOnMenu, taskForId, tuneCarried, tuneOfferPending, tuneOffers, tuneStepsLeft, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript, selectedSlot, type IdeLine } from "@state/days/ide";
import { API_FIELD, SLOT_FIELD, type Task, type TaskBoard, type TuneMod, type TunePath } from "@state/days/tasks";
import { deliverablePage } from "@state/files";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { ActionContext, ActionHandler } from "../controller";
import { fileBody, fileById } from "../files/view";
import { FRAMES, frameUrl } from "../kuro/body";
import { kuroText } from "../kuro/voice";
import { sentFiles, sentReplies, transcript } from "../messages/transcript";
import { taskPageId, type AppContext, type PaneId, type Session, type ShellState } from "../model";
import { boardActions, cardText, finishLabel, lockRow, renderBoardRead, table } from "./board";
import { meetingWindow } from "./meeting";
import { ICONS } from "../icons";
import { moveApp, otherSide } from "../placement";
import { messageActions } from "../messages/actions";
import { renderObjectBar } from "./objbar";
import { comparePane } from "./compare";
import { doneWorkItems, modeChips, openWork, plainSurface, questionText, surfaceOf as workSurfaceOf, workItems, workSendChip } from "./work";

type Fill = (s: string) => string;

/** The panes in toggle order (R1: 文件 · 预览 · 代码 · 表格 · 会议; a task without a board: its surface). */
const PANE_ORDER: readonly PaneId[] = ["compare", "files", "preview", "code", "table", "meeting", "work"];
/** At most two panes at once (R1): opening a third closes the earliest. */
export const MAX_PANES = 2;

/** The key of a task page's shell state (also the IDE typing key). */
export const shellKey = (day: number, taskId: string): string => `${day}:${taskId}`;

/** The task page's surface, by what the task is and whether it is the work under way. */
function surfaceOf(task: Task, live: boolean): "ide" | "table" | "meeting" | "work" {
  if (!task.board) return "work";
  // ide v2 (2026-11-08): a sent IDE task reads back as its frozen page and code (the snapshot line,
  // the import on snapshot.js), not as a table.
  if (!live) return task.board.view === "ide" ? "ide" : "table";
  return task.board.view === "ide" ? "ide" : task.board.view === "meeting" && task.board.meeting ? "meeting" : "table";
}

/** compare (author 2026-11-11): the board's decisions run in their own pane, not in the explorer. */
const isCompare = (task: Task): boolean => !!task.board?.compare;

/** The panes this task has (R3): only these toggles appear. */
export function panesOf(task: Task, live: boolean): PaneId[] {
  const surface = surfaceOf(task, live);
  // R11: a task without a board has its surface (document, ledger, code) as its one pane; none without one.
  if (surface === "work") return workSurfaceOf(task) ? ["work"] : [];
  // tune (2026-11-08): the 代码 pane of a tuning board is its bars and switches.
  // compare (author 2026-11-11): 老王的话 first, then the preview (and the code when the pages have files); no 文件.
  if (isCompare(task)) return PANE_ORDER.filter((p) => p === "compare" || p === "preview" || (p === "code" && !!task.board!.ide?.files));
  const own: PaneId[] = surface === "ide" ? (task.board!.ide?.files || task.board!.tune ? ["preview", "code"] : ["preview"]) : [surface];
  return PANE_ORDER.filter((p) => p === "files" || own.includes(p));
}

/** The defaults on first open (R3): IDE 预览 above 代码; table / meeting / a surface its own pane; 文件 closed. */
export function shellDefaults(task: Task, live: boolean): ShellState {
  let panes = panesOf(task, live).filter((p) => p !== "files");
  // tune: the bars are the work, so 参数 sits above 预览.
  if (task.board?.tune) panes = [...panes].sort((a, b) => (a === "code" ? -1 : b === "code" ? 1 : 0));
  // compare: 老王的话 and the preview open; nothing else.
  if (isCompare(task)) panes = panes.filter((p) => p === "compare" || p === "preview");
  // A tuning board has no pages and no sources to list: no explorer. A compare board neither.
  return { explorer: !!task.board && !task.board.tune && !isCompare(task) && live, panes, max: null, slot: null, slotAt: 0, source: null };
}

/** The key of a page's cards: a task read back (handed in, an earlier day) has its own panes. */
const stateKey = (day: number, taskId: string, live: boolean): string => `${shellKey(day, taskId)}${live ? "" : ":read"}`;

/** The shell state of a task page now: the session's, or the defaults. */
export function shellOf(session: Pick<Session, "shell">, day: number, task: Task, live: boolean): ShellState {
  return session.shell[stateKey(day, task.id, live)] ?? shellDefaults(task, live);
}

/** Who a task is handed to, by name (a person's deliverable); null for the workbench / the hand. */
function forWhom(task: Task): SafeHtml | null {
  const to = task.deliverable?.to;
  const key = to === "boss" || to === "partner" || to === "group" ? `msgs.${to}` : null;
  return key && hasString(key) && hasString("wb.task.for") ? tr("wb.task.for", { who: t(key) }) : null;
}

/** The slots a board had on `day`: as printed, else as the log left them. */
function boardSlotsOn(task: Task, day: number, events: readonly GameEvent[]): Readonly<Record<string, string>> {
  const printed = events.find((e) => e.kind === "task" && e.day === day && e.flag === task.done && e.slots !== undefined);
  if (printed?.kind === "task" && printed.slots) return printed.slots;
  return boardState(task.board!, day, task.id, events).slots;
}

/** A pane's name and its icon (a glyph drawn in the toggle's colour). */
const PANE_KEY: Readonly<Record<PaneId, string>> = { files: "pane.files", preview: "pane.preview", code: "pane.code", table: "pane.table", meeting: "pane.meeting", work: "pane.code", compare: "pane.compare" };
/** Line icons (R9): globe 预览, brackets 代码, grid 表格, play-in-rectangle 会议, folder 文件, a document for a task's own surface. */
const PANE_ICON: Readonly<Record<PaneId, SafeHtml>> = { files: ICONS.folder, preview: ICONS.globe, code: ICONS.code, table: ICONS.grid, meeting: ICONS.play, work: ICONS.doc, compare: ICONS.contacts };
const WORK_KEY: Readonly<Record<string, string>> = { docs: "wb.nav.docs", ledger: "wb.nav.ledger", code: "wb.nav.code" };
const paneName = (pane: PaneId, task: Task): string => {
  const key = pane === "work" ? (WORK_KEY[task.app] ?? "pane.code") : pane === "code" && task.board?.tune && hasString("pane.tune") ? "pane.tune" : PANE_KEY[pane];
  return hasString(key) ? t(key) : pane;
};

/** One inset card (R1): a 40 px header (icon · title · ⤢ · ×) and its body. */
function card(id: PaneId | "explorer", icon: SafeHtml, title: string, body: SafeHtml, st: ShellState, extra: string | false = false): SafeHtml {
  const max = st.max === id;
  const maxLabel = hasString("pane.maximize") ? t("pane.maximize") : "⤢";
  const closeLabel = hasString("pane.close") ? t("pane.close") : "×";
  const close = id === "explorer" ? html`data-action="shell-explorer"` : html`data-action="shell-close" data-pane="${id}"`;
  return html`<section class="${cls("sh-card", `sh-${id}`, max && "max", extra)}" data-card="${id}"><header class="sh-card-h"><span class="sh-ic" aria-hidden="true">${icon}</span><span class="sh-card-t">${title}</span><span class="sp"></span><button type="button" class="sh-hb" data-action="shell-max" data-pane="${id}" aria-pressed="${max ? "true" : "false"}" aria-label="${maxLabel}" title="${maxLabel}">${ICONS.maximize}</button><button type="button" class="sh-hb" ${close} aria-label="${closeLabel}" title="${closeLabel}">${ICONS.close}</button></header><div class="sh-card-b">${body}</div></section>`;
}

// ——— the explorer (R2) ———

/** A card has a source the 文件 pane can show (a file or a conversation). */
const hasViewableSource = (board: TaskBoard, cardId: string): boolean => {
  const from = board.cards.find((c) => c.id === cardId)?.from;
  return !!from && ("file" in from || "conv" in from);
};

function explorer(ctx: AppContext, task: Task, board: TaskBoard, s: BoardState, st: ShellState, selected: string): SafeHtml {
  const { state, events, session } = ctx;
  const ide = board.view === "ide";
  const seats = board.view === "meeting" ? board.meeting?.seats : undefined;
  // A missing folder name shows as missing (the strings convention), never as its key.
  const folder = (key: string, rows: SafeHtml[]) => html`<div class="sh-folder"><div class="sh-frow"><span class="sh-tw">${ICONS.down}</span>${tr(key)}</div>${rows}</div>`;
  const slotRows = board.slots.map((slot) => {
    const name = ide ? (board.ide?.files?.[slot.id]?.name ?? slot.label) : slot.label;
    // ide v2: a page that still differs from v16 keeps its dot too.
    const filled = slot.id in s.slots && !(board.ide?.diff?.[slot.id] && !(slot.id in s.merged));
    const seat = seats?.[slot.id];
    const seatTag = seat && hasString(`meeting.${seat}`) ? html`<span class="sh-seat">${tr(`meeting.${seat}`)}</span>` : null;
    // An unfilled slot's dot (like an unsaved file): drawn by CSS, no text glyph (R9).
    const dot = filled ? null : html`<span class="sh-dot" aria-hidden="true"></span>`;
    // R12.1: one line with an ellipsis; the full name in the row's title.
    return html`<button type="button" class="${cls("sh-file", selected === slot.id && "on", session.boardPick && "target")}" data-action="shell-slot" data-slot="${slot.id}" title="${name}"><span class="sh-fn">${name}</span>${seatTag}${dot}</button>`;
  });
  const found = foundCardIds(board, state.day, events, task.id);
  const placed = new Set(Object.values(s.slots));
  const cardRows = board.cards
    .filter((c) => !placed.has(c.id))
    .map((c) => {
      if (!found.has(c.id)) {
        const hint = c.hint ?? (hasString("board.notFound") ? t("board.notFound") : "");
        return html`<div class="sh-file card notfound" aria-disabled="true" title="${hint}"><span class="sh-fn">${hint}</span></div>`;
      }
      const open = hasViewableSource(board, c.id) ? html`<button type="button" class="sh-src" data-action="shell-source" data-card="${c.id}" aria-label="${paneName("files", task)}" title="${paneName("files", task)}">${ICONS.external}</button>` : null;
      // R12.1: long card text is one line with an ellipsis; the full text in the row's title.
      const text = cardText(board, c.id);
      return html`<div class="${cls("sh-file", "card", session.boardPick === c.id && "picked")}" title="${text}"><button type="button" class="sh-pick" data-action="board-card" data-card="${c.id}">${text}</button>${open}</div>`;
    });
  const lock = lockRow(board, s, state, events, session);
  // ide v2 day 3: the memo (老王's directions, the given rows) above the pages; no sources folder when
  // every card is a page's direction.
  const directions = board.cards.some((c) => c.slot !== undefined);
  const memo = ide && directions ? folder("board.ide.memo", Object.values(board.given.rows).map((text) => html`<div class="sh-file memo" title="${text}"><span class="sh-fn">${text}</span></div>`)) : null;
  const sources = board.cards.some((c) => c.slot === undefined) ? folder("board.ide.sources", cardRows) : null;
  const body = html`${lock ? html`<div class="sh-lock">${lock}</div>` : null}${memo}${folder(ide ? "board.ide.pages" : "board.slots", slotRows)}${sources}`;
  return card("explorer", ICONS.files, hasString("pane.explorer") ? t("pane.explorer") : "", body, st, "sh-explorer-card");
}

// ——— the panes (R3) ———

/** 预览: browser chrome (the tab, the address line) and the iframe of `ideSrc`. */
function previewPane(task: Task, board: TaskBoard, s: BoardState, ops: ReturnType<typeof ideOps>, selected: string, carried: Readonly<Record<string, string>>, today: number | null, held: string | null): SafeHtml {
  // tune: a handed-in page opened again on a later day carries today's number (the page misplays from day 4);
  // while Kuro executes a choice the previous page is held (then it changes, then Kuro speaks).
  const src = held ?? ideSrc(board, s, ops, selected, carried, today);
  const page = board.ide?.pages[selected] ?? 0;
  const file = (board.ide?.src ?? "").split("/").pop() ?? "";
  const title = task.deliverable?.label ?? board.title;
  return html`<div class="sh-browser"><div class="sh-tabs"><span class="sh-tab on">${title}</span></div><div class="sh-addr">…/${file}#${page}</div><iframe class="ide-frame" data-keep="ide" src="${src}" title="${title}" sandbox="allow-scripts"></iframe></div>`;
}

/**
 * tune (2026-11-08, author): one parameter at a time. The 参数 pane is a card carousel — one module
 * per card (‹ › and dots to move), its line of the config file as the title (`cadence: "nightly"
 * // 微调节奏`), its paths as cards (label, sub-actions, deltas; the chosen one filled) and a fourth
 * card, 克总帮我处理一下. While Kuro "executes" a choice (the busy gap, the typing of its sentence)
 * the cards are disabled; afterwards the carousel moves to the next item still unset. A module
 * whose source is not found yet shows its hint; a path with a source of its own shows its hint
 * until found; a path that waits for the end of the work is absent. Read back (not live): every
 * module on one list, no buttons.
 */
function tunePane(board: TaskBoard, s: BoardState, day: number, events: readonly GameEvent[], live: boolean, session: Session, key: string, busy: boolean): SafeHtml {
  const tune = board.tune!;
  const steps = hasString("board.tune.steps") ? html`<span class="sh-tune-steps">${tr("board.tune.steps", { on: String(Object.keys(s.mods).length), max: String(tune.steps) })}</span>` : null;
  const sign = (x: number) => (x > 0 ? `+${x}` : `−${-x}`);
  const deltasOf = (p: TunePath) => tune.dims.filter((d) => p.delta[d.id] !== undefined).map((d) => html`<span class="${cls("sh-mod-d", p.delta[d.id]! > 0 ? "plus" : "minus")}">${d.label} ${sign(p.delta[d.id]!)}</span>`);
  const groupLabel = (m: TuneMod) => tune.groups?.find((g) => g.id === m.group)?.label ?? "";
  if (!live) {
    // read back: the config as it was handed in
    const rows = tune.mods.map((m) => {
      const p = m.paths.find((x) => x.id === s.mods[m.id]);
      return html`<div class="${cls("sh-mod", p && "on")}"><span class="sh-mod-l"><code>${m.id}: ${p ? `"${p.id}"` : "null"},</code> ${m.label}${p ? html` · ${p.label}` : null}</span></div>`;
    });
    return html`<div class="sh-editor sh-tune"><div class="sh-tabs"><span class="sh-tab on">evolve.config.js</span>${steps}</div><div class="sh-mods read">${rows}</div></div>`;
  }
  const n = tune.mods.length;
  const idx = Math.min(Math.max(session.tuneIndex[key] ?? tune.mods.findIndex((m) => !(m.id in s.mods) && modFound(m, day, events)), 0), n - 1);
  const m = tune.mods[idx]!;
  const chosen = s.mods[m.id];
  const found = modFound(m, day, events);
  const blocked = busy || (chosen === undefined && tuneStepsLeft(board, s) === 0);
  const cards = !found
    ? [html`<div class="sh-path notfound" aria-disabled="true"><span class="sh-path-l">${m.hint ?? (hasString("board.notFound") ? t("board.notFound") : "")}</span></div>`]
    : m.paths.filter((p) => pathOnMenu(p, s)).map((p) => {
        const on = chosen === p.id;
        if (!pathFound(m, p, day, events)) {
          const hint = p.hint ?? (hasString("board.notFound") ? t("board.notFound") : "");
          return html`<div class="sh-path notfound" aria-disabled="true" title="${hint}"><span class="sh-path-l">${hint}</span></div>`;
        }
        const body = html`<span class="sh-path-l">${p.label}</span><ul class="sh-path-b">${p.bullets.map((b) => html`<li>${b}</li>`)}</ul><span class="sh-mod-ds">${deltasOf(p)}</span>`;
        return html`<button type="button" class="${cls("sh-path", on && "on")}" data-action="board-mod" data-mod="${m.id}" data-path="${p.id}" data-chosen="${chosen ?? ""}" aria-pressed="${on ? "true" : "false"}"${blocked ? html` disabled` : null}>${body}</button>`;
      });
  const kuroCard = found && hasString("board.tune.letKuro") ? html`<button type="button" class="sh-path kuro" data-action="board-assist-mod" data-mod="${m.id}"${blocked ? html` disabled` : null}><span class="sh-path-l">${tr("board.tune.letKuro")}</span></button>` : null;
  const prev = hasString("board.tune.prev") ? t("board.tune.prev") : "‹";
  const next = hasString("board.tune.next") ? t("board.tune.next") : "›";
  const dots = tune.mods.map((x, i) => html`<button type="button" class="${cls("sh-dot", i === idx && "on", x.id in s.mods && "set")}" data-action="shell-tune-go" data-index="${i}" aria-label="${x.label}" title="${x.label}"></button>`);
  const of = hasString("board.tune.of") ? tr("board.tune.of", { i: String(idx + 1), n: String(n) }) : html`${idx + 1} / ${n}`;
  const nav = html`<div class="sh-tune-nav"><button type="button" class="sh-tune-arrow" data-action="shell-tune-go" data-index="${idx - 1}"${idx === 0 ? html` disabled` : null} aria-label="${prev}" title="${prev}">‹</button><span class="sh-dots">${dots}</span><span class="sh-tune-of">${of}</span><button type="button" class="sh-tune-arrow" data-action="shell-tune-go" data-index="${idx + 1}"${idx === n - 1 ? html` disabled` : null} aria-label="${next}" title="${next}">›</button></div>`;
  const title = html`<div class="sh-mod-g"><span class="sh-mod-gl">// ${groupLabel(m)}</span></div><div class="sh-mod-title"><code>${m.id}: ${chosen !== undefined ? `"${chosen}"` : "null"},</code> <span class="sh-mod-name">${m.label}</span></div>`;
  return html`<div class="sh-editor sh-tune"><div class="sh-tabs"><span class="sh-tab on">evolve.config.js</span>${steps}</div>${nav}<div class="sh-card-body">${title}<div class="sh-paths">${cards}${kuroCard}</div></div></div>`;
}

/** 代码: the selected page's file, line numbers, and its slot line drawn as the inline field. */
function codePane(board: TaskBoard, s: BoardState, session: Session, selected: string, printed = false, live = true): SafeHtml {
  const file = board.ide?.files?.[selected];
  if (!file) return html`<div class="sh-editor"></div>`;
  const cardId = s.slots[selected];
  // ide v2 (2026-11-08): the page's changed line shows as − v16 / + v17 until one is kept; the data
  // import reads the API until the snapshot is printed.
  const hunk = board.ide?.diff?.[selected];
  const kept = s.merged[selected];
  const api = board.ide?.api;
  const lines = file.code.flatMap((raw, i) => {
    let line = api ? raw.split(API_FIELD).join(printed ? api.fixed : api.live) : raw;
    if (hunk && i === hunk.line - 1) {
      if (!kept) {
        return [
          html`<div class="sh-ln del"><span class="sh-gut">${i + 1}</span><span class="sh-mk">−</span><code>${hunk.v16}</code></div>`,
          html`<div class="sh-ln add"><span class="sh-gut">${i + 1}</span><span class="sh-mk">+</span><code>${hunk.v17}</code></div>`,
        ];
      }
      line = kept === "v16" ? hunk.v16 : hunk.v17;
    }
    const at = line.indexOf(SLOT_FIELD);
    if (at < 0) return [html`<div class="sh-ln"><span class="sh-gut">${i + 1}</span><span class="sh-mk"></span><code>${line}</code></div>`];
    const before = line.slice(0, at);
    const after = line.slice(at + SLOT_FIELD.length);
    // A read-back page (the task sent) has no actions: the field is plain text.
    const field = !live
      ? html`<span class="sh-field filled">"${cardId ? cardText(board, cardId) : ""}"</span>`
      : cardId
      ? html`<button type="button" class="sh-field filled" data-action="board-slot" data-slot="${selected}">"${cardText(board, cardId)}"</button>`
      : html`<button type="button" class="${cls("sh-field", "empty", session.boardPick && "target")}" data-action="board-slot" data-slot="${selected}" aria-label="${board.slots.find((x) => x.id === selected)?.label ?? selected}"></button>`;
    return [html`<div class="${cls("sh-ln", "slot", cardId && "added")}"><span class="sh-gut">${i + 1}</span><span class="sh-mk">${cardId ? "+" : ""}</span><code>${before}${field}${after}</code></div>`];
  });
  // The merge bar (a page that differs, nothing kept yet) and the API control (pull once; then the time).
  const mergeBar = live && hunk && !kept
    ? html`<div class="sh-merge"><span class="sh-merge-l">${tr("board.ide.diff")}</span><button type="button" class="sh-chip primary" data-action="board-merge" data-slot="${selected}" data-keep="v17">${tr("board.ide.merge.v17")}</button><button type="button" class="sh-chip" data-action="board-merge" data-slot="${selected}" data-keep="v16">${tr("board.ide.merge.v16")}</button></div>`
    : null;
  const fetch = !live
    ? null
    : api
    ? s.fetched
      ? html`<span class="sh-fetched">${tr("board.ide.fetched", { at: api.at })}</span>`
      : html`<button type="button" class="sh-chip sh-fetch" data-action="board-fetch"${canFetch(board, s) ? null : html` disabled`}>${tr("board.ide.fetch")}</button>`
    : null;
  // ide v2 day 3: the page's directions under its code; the chosen one is primary; choosing again replaces.
  const options = live ? board.cards.filter((c) => c.slot === selected) : [];
  const chips = options.length
    ? html`<div class="sh-options">${options.map((o) => html`<button type="button" class="${cls("sh-chip", cardId === o.id && "primary")}" data-action="board-option" data-slot="${selected}" data-card="${o.id}">${cardText(board, o.id)}</button>`)}</div>`
    : null;
  return html`<div class="sh-editor"><div class="sh-tabs"><span class="sh-tab on">${file.name}</span>${fetch}</div>${mergeBar}<div class="sh-code">${lines}</div>${chips}</div>`;
}

/** 表格: the board's table as today (the given rows and the slots); live, or read back. */
function tablePane(ctx: AppContext, task: Task, board: TaskBoard, s: BoardState, live: boolean, day: number): SafeHtml {
  if (!live) return renderBoardRead(board, boardSlotsOn(task, day, ctx.events));
  return html`<div class="surface board"><div class="btitle">${board.title}</div>${table(board, s, ctx.state, ctx.session)}</div>`;
}

/** 文件: the content of a 素材 card's source (the file's text, or the conversation lines), read only. */
function filesPane(ctx: AppContext, board: TaskBoard, st: ShellState, fill: Fill): SafeHtml {
  const from = st.source ? board.cards.find((c) => c.id === st.source)?.from : undefined;
  if (!from) return html`<div class="sh-source empty"></div>`;
  if ("file" in from) {
    const f = fileById(from.file);
    if (f) return html`<div class="sh-source file"><div class="sh-src-h">${fill(f.name)}</div>${fileBody(f, fill)}</div>`;
    const page = deliverablePage(from.file);
    return page ? html`<div class="sh-source file"><iframe class="f-frame" src="${page}" title="${from.file}" sandbox></iframe></div>` : html`<div class="sh-source empty"></div>`;
  }
  if ("conv" in from) {
    const { state, events, session, startDay } = ctx;
    const bubbles = transcript({ conversation: from.conv, state, replies: sentReplies(startDay, events), clock: session.clock, progress: session.progress, files: sentFiles(events) });
    const rows = bubbles.flatMap((b) => {
      if (b.kind !== "msg") return [];
      const body = b.body;
      const text = body.type === "text" ? body.text : "raw" in body ? body.raw : "";
      return [html`<div class="${cls("sh-cl", b.side)}"><span class="sh-ct">${b.t}</span> ${fill(text)}</div>`];
    });
    return html`<div class="sh-source conv">${rows}</div>`;
  }
  return html`<div class="sh-source empty"></div>`;
}

// ——— the conversation (R1, R5) ———

/** The optional Kuro lines of a board without beats, per op (strings; none exist yet → none shown). */
const OP_LINE_KEY: Readonly<Record<string, string>> = { assistFill: "board.kuro.assist", assistUnlock: "board.kuro.lock", print: "board.kuro.print" };

/** The conversation's lines (R5): the beats (as the IDE's transcript) or the board title and the ops' Kuro lines. */
export function conversationLines(task: Task, day: number, events: readonly GameEvent[], fill: Fill): IdeLine[] {
  const board = task.board;
  if (!board) return [{ on: "open", who: "kuro", text: fill(task.title) }];
  const ops = ideOps(task, day, events);
  if (board.view === "ide" || board.beats) return ideTranscript(board, ops, tuneCarried(board, events));
  const out: IdeLine[] = [{ on: "open", who: "kuro", text: board.title }];
  for (const op of ops) {
    const key = OP_LINE_KEY[op.t];
    if (key && hasString(key)) out.push({ on: op.t, who: "kuro", text: t(key) });
  }
  return out;
}

const shellAv = () => html`<img class="sh-av" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true">`;

/** The conversation's bubbles (R5): the player at the right; Kuro at the left, its portrait on the first line of a run. */
function bubbles(day: number, lines: readonly { readonly who: "me" | "kuro"; readonly on: string; readonly body: SafeHtml | string }[]): SafeHtml[] {
  return lines.map((l, i) => {
    if (l.who === "me") {
      // tune: a pick is worded here (the transcript carries the path's label): 我选了：… / 这项交给克总。它选了：…
      const pick = l.on.startsWith("pick:") && typeof l.body === "string";
      const body = pick ? (l.on.endsWith(":kuro") && hasString("board.tune.kuroChose") ? tr("board.tune.kuroChose", { path: l.body as string }) : hasString("board.tune.chose") ? tr("board.tune.chose", { path: l.body as string }) : l.body) : l.body;
      return html`<div class="sh-me" data-on="${l.on}"><div class="sh-bub">${body}</div></div>`;
    }
    const first = i === 0 || lines[i - 1]!.who !== "kuro";
    // kuro-zh-answers R4: a plain-text Kuro line gets its face (markup from work.ts already has it).
    const body = typeof l.body === "string" ? kuroText(day, l.body) : l.body;
    return html`<div class="${cls("sh-kuro", first && "first")}" data-on="${l.on}">${first ? shellAv() : html`<span class="sh-av-gap"></span>`}<div class="sh-kt">${body}</div></div>`;
  });
}

/**
 * A task without a board (R11): its thread is the conversation (the player's line, Kuro's question,
 * the chosen mode, Kuro's answer), its chips and 通过 sit in the composer (the input too, while
 * the sentence is unsent), and its surface goes to the pane. A handed-in page reads its thread back.
 */
function workConversation(ctx: AppContext, task: Task, day: number, live: boolean): SafeHtml {
  const items = live ? workItems(ctx) : doneWorkItems(ctx, day, task);
  const lines: { who: "me" | "kuro"; on: string; body: SafeHtml | string }[] = [];
  const chips: SafeHtml[] = [];
  let working = false;
  for (const it of items) {
    if (it.k === "me") lines.push({ who: "me", on: "work", body: it.text });
    else if (it.k === "kuro") {
      if (it.text) lines.push({ who: "kuro", on: "work", body: it.text });
      if (it.chips) chips.push(it.chips);
    } else if (it.k === "question") {
      lines.push({ who: "kuro", on: "question", body: questionText(it.day) });
      if (it.chips) chips.push(html`<div class="wchips">${modeChips("sh-chip")}</div>`);
    } else if (it.k === "working") working = true;
    else if (it.k === "pass") chips.push(it.html);
  }
  // guidance R7: while Kuro works its bubble says so (wb.busy), not an empty bubble.
  const dots = working ? html`<div class="sh-kuro typing" aria-live="polite">${shellAv()}<div class="sh-kt">${hasString("wb.busy") ? tr("wb.busy") : null}</div></div>` : null;
  // guidance R7: no text box on a task page: the sentence is one chip until it is sent.
  const input = live ? workSendChip(ctx) : null;
  return html`<div class="sh-conv"><div class="sh-thread">${bubbles(day, lines)}${dots}</div><div class="sh-composer">${chips}${input}</div></div>`;
}

/** The pane of a task without a board (R11): its surface as worked on now, or as it reads (default open). */
function workPane(ctx: AppContext, task: Task, live: boolean, fill: Fill): SafeHtml {
  const surfaces = live ? workItems(ctx).flatMap((it) => (it.k === "surface" ? [it.html] : [])) : [];
  if (surfaces.length) return html`<div class="sh-work">${surfaces}</div>`;
  // Kuro is working on it: the pane says so too (guidance R7: wb.busy, not a blank pane).
  if (live && workItems(ctx).some((it) => it.k === "working")) return html`<div class="sh-work busy">${hasString("wb.busy") ? html`<p class="sh-busy">${tr("wb.busy")}</p>` : null}</div>`;
  return html`<div class="sh-work">${plainSurface(task, fill)}</div>`;
}

function conversation(ctx: AppContext, task: Task, day: number, live: boolean, fill: Fill, board: TaskBoard | undefined, s: BoardState | null): SafeHtml {
  if (!board) return workConversation(ctx, task, day, live);
  const { events, session, nowMs } = ctx;
  const lines = conversationLines(task, day, events, fill);
  const typing = session.ideTyping?.key === shellKey(day, task.id) ? session.ideTyping.times : [];
  const visible = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const av = shellAv();
  // ide talk: a choice / execution line is worded here (board.ide.fill / filled / keep / kept / fetch / fetched).
  const rows = bubbles(day, visible.map((l) => ({ who: l.who, on: l.on, body: l.args ? tr(`board.ide.${l.on.split(":")[1]}`, l.args) : l.text })));
  // tune: while Kuro executes a choice the bubble says so (board.tune.busy), not just dots
  const busyText = board?.tune && hasString("board.tune.busy") ? tr("board.tune.busy") : html`…`;
  const dots = visible.length < lines.length ? html`<div class="sh-kuro typing" aria-hidden="true">${av}<div class="sh-kt">${busyText}</div></div>` : null;
  let chips: SafeHtml | null = null;
  if (live && board && s) {
    const assist = hasString("board.assist") ? html`<button type="button" class="sh-chip" data-action="board-assist">${tr("board.assist")}</button>` : null;
    if (board.tune) {
      // tune: no finish button (the work goes by itself when the budget is spent) and no 让它补全 (Kuro is
      // asked per item on the card); Kuro's end-of-work offer, when it is on the table, is a story
      // choice here: take the path, or 不接 — after the lines (nothing pops: the words first, then the choice).
      const typed = visible.length === lines.length;
      const offer = typed && tuneOfferPending(board, s)
        ? tuneOffers(board).map(({ mod, path }) => html`<button type="button" class="sh-chip primary" data-action="board-mod" data-mod="${mod.id}" data-path="${path.id}">${path.label}</button>`)
        : [];
      const keep = offer.length && hasString("board.tune.keep") ? html`<button type="button" class="sh-chip" data-action="board-keep">${tr("board.tune.keep")}</button>` : null;
      chips = html`${offer}${keep}`;
    } else if (board.compare) {
      // compare: no 让它补全 (Kuro's rewrite is offered in the pane, at the settlement); the hand-in alone.
      const finish = html`<button type="button" class="sh-chip primary" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${finishLabel(task)}</button>`;
      chips = html`${finish}`;
    } else {
      const label = board.view === "ide" && hasString("board.ide.snapshot") ? tr("board.ide.snapshot") : finishLabel(task);
      const finish = html`<button type="button" class="sh-chip primary" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${label}</button>`;
      chips = html`${assist}${finish}`;
    }
  }
  return html`<div class="sh-conv"><div class="sh-thread">${rows}${dots}</div><div class="sh-composer">${chips}</div></div>`;
}

// ——— the task page ———

/**
 * A task page in the shell (R1): the header (⊟, title, 交给 X, the status chip; the pane toggles),
 * then the frame: the explorer card, the conversation, the pane cards. Pure.
 */
export function renderShell(ctx: AppContext, task: Task, day: number, fill: Fill): { main: SafeHtml; title: SafeHtml; tools: SafeHtml } {
  const { state, events, session } = ctx;
  const done = state.flags.includes(task.done);
  const live = day === state.day && !done && openWork(state, events)?.tree?.id === task.id;
  const st = shellOf(session, day, task, live);
  const board = task.board;
  const s = board ? boardState(board, day, task.id, events) : null;
  const ops = board ? ideOps(task, day, events) : [];
  const selected = board ? selectedSlot(board, ops, st.slot, st.slotAt) : "";
  const panes = panesOf(task, live);
  const open = st.panes.filter((p) => panes.includes(p));
  // The page's share of 工作台's one top bar (R10): the title (with the session dropdown's ▾), 交给 X
  // and the status chip; at the right end the explorer and pane toggles and the 老物件 strip.
  const toggleLabel = hasString("pane.explorer.toggle") ? t("pane.explorer.toggle") : "";
  const explorerToggle = board && !board.tune && !board.compare && live ? html`<button type="button" class="${cls("sh-tg", "explorer", st.explorer && "on")}" data-action="shell-explorer" aria-pressed="${st.explorer ? "true" : "false"}" aria-label="${toggleLabel}" title="${toggleLabel}">${ICONS.files}</button>` : null;
  const status = html`<span class="${cls("st", done ? "done" : "doing")}">${tr(done ? "wb.task.done" : "wb.task.doing")}</span>`;
  const who = forWhom(task);
  const toggles = panes.map((p) => {
    const on = open.includes(p);
    const name = paneName(p, task);
    return html`<button type="button" class="${cls("sh-tg", on && "on")}" data-action="shell-pane" data-pane="${p}" aria-pressed="${on ? "true" : "false"}" aria-label="${name}" title="${name}">${PANE_ICON[p]}</button>`;
  });
  const app = !board && live && WORK_KEY[task.app] ? html`<button type="button" class="btn" data-action="wb-nav" data-page="${task.app}">${tr(WORK_KEY[task.app]!)}</button>` : null;
  const title = html`<span class="tt-name">${fill(task.title)}</span><small class="tt-sub">${who ? html`${who} · ` : null}${status}</small>`;
  const tools = html`${app}<div class="sh-toggles">${explorerToggle}${toggles}</div>${renderObjectBar(ctx)}`;
  // The frame (R1): the explorer card, the conversation, the pane cards.
  const ex = board && live && st.explorer ? explorer(ctx, task, board, s!, st, selected) : null;
  const carried = board ? tuneCarried(board, events) : {};
  const key = shellKey(day, task.id);
  const hold = session.ideHold && session.ideHold.key === key && session.ideHold.until > ctx.nowMs ? session.ideHold.src : null;
  // tune: a turn is under way while its lines are still typing (the cards wait for Kuro to speak)
  const typing = session.ideTyping?.key === key ? session.ideTyping.times : [];
  const busy = !!board?.tune && typing.some((t) => t > ctx.nowMs);
  const paneCards = open.map((p) => {
    let body: SafeHtml;
    if (p === "compare") body = comparePane(task, board!, s!, live, hold !== null, st.slot);
    else if (p === "preview") body = previewPane(task, board!, s!, ops, selected, carried, live ? null : state.day, hold);
    else if (p === "code") body = board!.tune ? tunePane(board!, s!, day, events, live, session, key, busy) : codePane(board!, s!, session, selected, ops.some((o) => o.t === "print"), live);
    else if (p === "table") body = tablePane(ctx, task, board!, s!, live, day);
    else if (p === "meeting") body = meetingWindow(ctx, task, board!);
    else if (p === "files") body = board ? filesPane(ctx, board, st, fill) : html``;
    else body = workPane(ctx, task, live, fill);
    return card(p, PANE_ICON[p], paneName(p, task), body, st, open.length === 2 && (p === open[0] ? "first" : "second"));
  });
  const paneArea = paneCards.length ? html`<div class="sh-panes">${paneCards}</div>` : null;
  const frame = cls("wb-task-body", "sh-frame", paneCards.length > 0 && "has-panes", st.max !== null && "maxed");
  // Under the one bar: the explorer, the conversation and the pane cards, full height (R10).
  const main = html`<div class="${cls("main", "task", "shell", `view-${surfaceOf(task, live)}`)}" data-task="${task.id}"><div class="${frame}">${ex}${conversation(ctx, task, day, live, fill, board, s)}${paneArea}</div></div>`;
  return { main, title, tools };
}

// ——— the actions (session only; the board's own ops stay the board's) ———

/** The task page shown now, with its day and whether it is live, or null. */
function pageOf(ctx: ActionContext): { task: Task; day: number; live: boolean } | null {
  const id = taskPageId(ctx.session.workbenchPage);
  if (id === null) return null;
  const state = ctx.store.getState();
  const day = ctx.session.wbTaskDay ?? state.day;
  const task = taskForId(day, id);
  if (!task) return null;
  const live = day === state.day && !state.flags.includes(task.done) && openWork(state, ctx.store.getEvents())?.tree?.id === task.id;
  return { task, day, live };
}

/** The page's shell state, written back to the session (from the defaults on first change). */
function stateFor(ctx: ActionContext, p: { task: Task; day: number; live: boolean }): ShellState {
  const key = stateKey(p.day, p.task.id, p.live);
  const st = ctx.session.shell[key] ?? shellDefaults(p.task, p.live);
  const copy: ShellState = { ...st, panes: [...st.panes] };
  ctx.session.shell = { ...ctx.session.shell, [key]: copy };
  return copy;
}

/** Open `pane` (a third closes the earliest), or keep it if it is open. */
function openPane(st: ShellState, pane: PaneId): void {
  if (st.panes.includes(pane)) return;
  st.panes.push(pane);
  while (st.panes.length > MAX_PANES) {
    const gone = st.panes.shift()!;
    if (st.max === gone) st.max = null;
  }
}
function closePane(st: ShellState, pane: PaneId): void {
  st.panes = st.panes.filter((p) => p !== pane);
  if (st.max === pane) st.max = null;
}

const isPane = (v: string | undefined): v is PaneId => (PANE_ORDER as readonly (string | undefined)[]).includes(v);

export const taskShellActions: Record<string, ActionHandler> = {
  // tune: ‹ › and the dots move the parameter card (session only).
  "shell-tune-go"(ctx, data) {
    const p = pageOf(ctx);
    const i = Number(data.index);
    const n = p?.task.board?.tune?.mods.length ?? 0;
    if (!p || !Number.isInteger(i) || i < 0 || i >= n) return;
    ctx.session.tuneIndex = { ...ctx.session.tuneIndex, [shellKey(p.day, p.task.id)]: i };
    ctx.rerender();
  },
  // ⊟: the explorer shows / hides.
  "shell-explorer"(ctx) {
    const p = pageOf(ctx);
    if (!p || !p.task.board || !p.live) return;
    const st = stateFor(ctx, p);
    st.explorer = !st.explorer;
    if (!st.explorer && st.max === "explorer") st.max = null;
    ctx.rerender();
  },
  // A pane toggle in the header: opens (a third closes the earliest) or closes it.
  "shell-pane"(ctx, data) {
    const p = pageOf(ctx);
    const pane = data.pane;
    if (!p || !isPane(pane) || !panesOf(p.task, p.live).includes(pane)) return;
    const st = stateFor(ctx, p);
    if (st.panes.includes(pane)) closePane(st, pane);
    else openPane(st, pane);
    ctx.rerender();
  },
  // ×: the card closes.
  "shell-close"(ctx, data) {
    const p = pageOf(ctx);
    const pane = data.pane;
    if (!p || !isPane(pane)) return;
    closePane(stateFor(ctx, p), pane);
    ctx.rerender();
  },
  // ⤢: the card takes the whole frame; ⤢ again restores it.
  "shell-max"(ctx, data) {
    const p = pageOf(ctx);
    const pane = data.pane;
    if (!p || !(isPane(pane) || pane === "explorer")) return;
    const st = stateFor(ctx, p);
    st.max = st.max === pane ? null : pane;
    ctx.rerender();
  },
  // A slot row in the explorer: a picked card is placed there (the board's own op), and the slot is
  // selected; for an IDE board its file opens in 代码 and 预览 moves to its page.
  "shell-slot"(ctx, data, el) {
    const p = pageOf(ctx);
    const slot = data.slot;
    if (!p || !p.task.board || !slot || !p.task.board.slots.some((x) => x.id === slot)) return;
    if (ctx.session.boardPick && p.live) boardActions["board-slot"]!(ctx, data, el);
    const st = stateFor(ctx, p);
    st.slot = slot;
    st.slotAt = ideOps(p.task, p.day, ctx.store.getEvents()).length;
    if (p.task.board.view === "ide" && panesOf(p.task, p.live).includes("code")) openPane(st, "code");
    ctx.rerender();
  },
  // ↗ on a found 素材 card: the 文件 pane opens on its source.
  "shell-source"(ctx, data, el) {
    const p = pageOf(ctx);
    const card = data.card;
    const board = p?.task.board;
    if (!p || !board || !card || !hasViewableSource(board, card)) return;
    const st = stateFor(ctx, p);
    st.source = card;
    openPane(st, "files");
    // tingtalk R2: a conversation's card opens that thread in 听听, on the monitor that is not
    // 工作台's (the 文件 pane keeps its read-only lines); the player stays where they are.
    const from = board.cards.find((c) => c.id === card)?.from;
    if (from && "conv" in from) {
      moveApp(ctx.session, "tingtalk", otherSide(ctx.session.place.workbench));
      messageActions["conv"]!(ctx, { conv: from.conv } as DOMStringMap, el);
    }
    ctx.rerender();
  },
};
