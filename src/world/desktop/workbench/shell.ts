// shell (2026-11-04): one shell for every task page, light, after the Claude desktop app. The
// conversation with Kuro is the page (the outer frame); the explorer (left) and the app panes
// (right) are inset cards that open and close around it. Only what is inside the panes changes from
// day to day (table / IDE / meeting / a task's own surface). No new board interaction: picking,
// placing, Kuro's fill, the lock, print and send are the board's own actions. Card state is session
// only, per task (`session.shell`); the board itself rebuilds from the log.
import type { GameEvent } from "@state/events";
import { boardState, canPrint, foundCardIds, taskForId, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, ideTranscript, selectedSlot, type IdeLine } from "@state/days/ide";
import { SLOT_FIELD, type Task, type TaskBoard } from "@state/days/tasks";
import { deliverablePage } from "@state/files";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { fillPlaceholders } from "@world/replies/placeholders";
import type { ActionContext, ActionHandler } from "../controller";
import { fileBody, fileById } from "../files/view";
import { FRAMES, frameUrl } from "../kuro/body";
import { sentFiles, sentReplies, transcript } from "../messages/transcript";
import { taskPageId, type AppContext, type PaneId, type Session, type ShellState } from "../model";
import { boardActions, cardText, finishLabel, lockRow, renderBoardRead, table } from "./board";
import { meetingWindow } from "./meeting";
import { renderObjectBar } from "./objbar";
import { openWork, renderDoneWork, renderWork } from "./work";

type Fill = (s: string) => string;

/** The panes in toggle order (R1: 文件 · 预览 · 代码 · 表格 · 会议; a task without a board: its surface). */
const PANE_ORDER: readonly PaneId[] = ["files", "preview", "code", "table", "meeting", "work"];
/** At most two panes at once (R1): opening a third closes the earliest. */
export const MAX_PANES = 2;

/** The key of a task page's shell state (also the IDE typing key). */
export const shellKey = (day: number, taskId: string): string => `${day}:${taskId}`;

/** The task page's surface, by what the task is and whether it is the work under way. */
function surfaceOf(task: Task, live: boolean): "ide" | "table" | "meeting" | "work" {
  if (!task.board) return "work";
  if (!live) return "table";
  return task.board.view === "ide" ? "ide" : task.board.view === "meeting" && task.board.meeting ? "meeting" : "table";
}

/** The panes this task has (R3): only these toggles appear. */
export function panesOf(task: Task, live: boolean): PaneId[] {
  const surface = surfaceOf(task, live);
  if (surface === "work") return ["work"];
  const own: PaneId[] = surface === "ide" ? (task.board!.ide?.files ? ["preview", "code"] : ["preview"]) : [surface];
  return PANE_ORDER.filter((p) => p === "files" || own.includes(p));
}

/** The defaults on first open (R3): IDE 预览 above 代码; table / meeting / a surface its own pane; 文件 closed. */
export function shellDefaults(task: Task, live: boolean): ShellState {
  const panes = panesOf(task, live).filter((p) => p !== "files");
  return { explorer: !!task.board && live, panes, max: null, slot: null, source: null };
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
const PANE_KEY: Readonly<Record<PaneId, string>> = { files: "pane.files", preview: "pane.preview", code: "pane.code", table: "pane.table", meeting: "pane.meeting", work: "pane.code" };
const PANE_ICON: Readonly<Record<PaneId, string>> = { files: "▤", preview: "◍", code: "</>", table: "▦", meeting: "▶", work: "▤" };
const WORK_KEY: Readonly<Record<string, string>> = { docs: "wb.nav.docs", ledger: "wb.nav.ledger", code: "wb.nav.code" };
const paneName = (pane: PaneId, task: Task): string => {
  const key = pane === "work" ? (WORK_KEY[task.app] ?? "pane.code") : PANE_KEY[pane];
  return hasString(key) ? t(key) : pane;
};

/** One inset card (R1): a 40 px header (icon · title · ⤢ · ×) and its body. */
function card(id: PaneId | "explorer", icon: string, title: string, body: SafeHtml, st: ShellState, extra: string | false = false): SafeHtml {
  const max = st.max === id;
  const maxLabel = hasString("pane.maximize") ? t("pane.maximize") : "⤢";
  const closeLabel = hasString("pane.close") ? t("pane.close") : "×";
  const close = id === "explorer" ? html`data-action="shell-explorer"` : html`data-action="shell-close" data-pane="${id}"`;
  return html`<section class="${cls("sh-card", `sh-${id}`, max && "max", extra)}" data-card="${id}"><header class="sh-card-h"><span class="sh-ic" aria-hidden="true">${icon}</span><span class="sh-card-t">${title}</span><span class="sp"></span><button type="button" class="sh-hb" data-action="shell-max" data-pane="${id}" aria-pressed="${max ? "true" : "false"}" aria-label="${maxLabel}" title="${maxLabel}">⤢</button><button type="button" class="sh-hb" ${close} aria-label="${closeLabel}" title="${closeLabel}">×</button></header><div class="sh-card-b">${body}</div></section>`;
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
  const folder = (key: string, rows: SafeHtml[]) => html`<div class="sh-folder"><div class="sh-frow"><span class="sh-tw" aria-hidden="true">▾</span>${tr(key)}</div>${rows}</div>`;
  const slotRows = board.slots.map((slot) => {
    const name = ide ? (board.ide?.files?.[slot.id]?.name ?? slot.label) : slot.label;
    const filled = slot.id in s.slots;
    const seat = seats?.[slot.id];
    const seatTag = seat && hasString(`meeting.${seat}`) ? html`<span class="sh-seat">${tr(`meeting.${seat}`)}</span>` : null;
    const dot = filled ? null : html`<span class="sh-dot" aria-hidden="true">●</span>`;
    return html`<button type="button" class="${cls("sh-file", selected === slot.id && "on", session.boardPick && "target")}" data-action="shell-slot" data-slot="${slot.id}"><span class="sh-fn">${name}</span>${seatTag}${dot}</button>`;
  });
  const found = foundCardIds(board, state.day, events, task.id);
  const placed = new Set(Object.values(s.slots));
  const cardRows = board.cards
    .filter((c) => !placed.has(c.id))
    .map((c) => {
      if (!found.has(c.id)) {
        const hint = c.hint ?? (hasString("board.notFound") ? t("board.notFound") : "");
        return html`<div class="sh-file card notfound" aria-disabled="true"><span class="sh-fn">${hint}</span></div>`;
      }
      const open = hasViewableSource(board, c.id) ? html`<button type="button" class="sh-src" data-action="shell-source" data-card="${c.id}" aria-label="${paneName("files", task)}" title="${paneName("files", task)}">↗</button>` : null;
      return html`<div class="${cls("sh-file", "card", session.boardPick === c.id && "picked")}"><button type="button" class="sh-pick" data-action="board-card" data-card="${c.id}">${cardText(board, c.id)}</button>${open}</div>`;
    });
  const lock = lockRow(board, s, state, events, session);
  const body = html`${lock ? html`<div class="sh-lock">${lock}</div>` : null}${folder(ide ? "board.ide.pages" : "board.slots", slotRows)}${folder("board.ide.sources", cardRows)}`;
  return card("explorer", "▤", hasString("pane.explorer") ? t("pane.explorer") : "", body, st, "sh-explorer-card");
}

// ——— the panes (R3) ———

/** 预览: browser chrome (the tab, the address line) and the iframe of `ideSrc`. */
function previewPane(task: Task, board: TaskBoard, s: BoardState, ops: ReturnType<typeof ideOps>, selected: string): SafeHtml {
  const src = ideSrc(board, s, ops, selected);
  const page = board.ide?.pages[selected] ?? 0;
  const file = (board.ide?.src ?? "").split("/").pop() ?? "";
  const title = task.deliverable?.label ?? board.title;
  return html`<div class="sh-browser"><div class="sh-tabs"><span class="sh-tab on">${title}</span></div><div class="sh-addr">…/${file}#${page}</div><iframe class="ide-frame" data-keep="ide" src="${src}" title="${title}" sandbox="allow-scripts"></iframe></div>`;
}

/** 代码: the selected page's file, line numbers, and its slot line drawn as the inline field. */
function codePane(board: TaskBoard, s: BoardState, session: Session, selected: string): SafeHtml {
  const file = board.ide?.files?.[selected];
  if (!file) return html`<div class="sh-editor"></div>`;
  const cardId = s.slots[selected];
  const lines = file.code.map((line, i) => {
    const at = line.indexOf(SLOT_FIELD);
    if (at < 0) return html`<div class="sh-ln"><span class="sh-gut">${i + 1}</span><span class="sh-mk"></span><code>${line}</code></div>`;
    const before = line.slice(0, at);
    const after = line.slice(at + SLOT_FIELD.length);
    const field = cardId
      ? html`<button type="button" class="sh-field filled" data-action="board-slot" data-slot="${selected}">"${cardText(board, cardId)}"</button>`
      : html`<button type="button" class="${cls("sh-field", "empty", session.boardPick && "target")}" data-action="board-slot" data-slot="${selected}" aria-label="${board.slots.find((x) => x.id === selected)?.label ?? selected}"></button>`;
    return html`<div class="${cls("sh-ln", "slot", cardId && "added")}"><span class="sh-gut">${i + 1}</span><span class="sh-mk">${cardId ? "+" : ""}</span><code>${before}${field}${after}</code></div>`;
  });
  return html`<div class="sh-editor"><div class="sh-tabs"><span class="sh-tab on">${file.name}</span></div><div class="sh-code">${lines}</div></div>`;
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
  if (board.view === "ide" || board.beats) return ideTranscript(board, ops);
  const out: IdeLine[] = [{ on: "open", who: "kuro", text: board.title }];
  for (const op of ops) {
    const key = OP_LINE_KEY[op.t];
    if (key && hasString(key)) out.push({ on: op.t, who: "kuro", text: t(key) });
  }
  return out;
}

function conversation(ctx: AppContext, task: Task, day: number, live: boolean, fill: Fill, board: TaskBoard | undefined, s: BoardState | null): SafeHtml {
  const { events, session, nowMs } = ctx;
  const lines = conversationLines(task, day, events, fill);
  const typing = session.ideTyping?.key === shellKey(day, task.id) ? session.ideTyping.times : [];
  const visible = lines.filter((_, i) => (typing[i] ?? 0) <= nowMs);
  const av = html`<img class="sh-av" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true">`;
  const rows = visible.map((l, i) => {
    if (l.who === "me") return html`<div class="sh-me" data-on="${l.on}"><div class="sh-bub">${l.text}</div></div>`;
    // Kuro's portrait at the left of the first line in a run.
    const first = i === 0 || visible[i - 1]!.who !== "kuro";
    return html`<div class="${cls("sh-kuro", first && "first")}" data-on="${l.on}">${first ? av : html`<span class="sh-av-gap"></span>`}<div class="sh-kt">${l.text}</div></div>`;
  });
  const dots = visible.length < lines.length ? html`<div class="sh-kuro typing" aria-hidden="true">${av}<div class="sh-kt">…</div></div>` : null;
  let chips: SafeHtml | null = null;
  if (live && board && s) {
    const assist = hasString("board.assist") ? html`<button type="button" class="sh-chip" data-action="board-assist">${tr("board.assist")}</button>` : null;
    const label = board.view === "ide" && hasString("board.ide.snapshot") ? tr("board.ide.snapshot") : finishLabel(task);
    const finish = html`<button type="button" class="sh-chip primary" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${label}</button>`;
    chips = html`${assist}${finish}`;
  }
  return html`<div class="sh-conv"><div class="sh-thread">${rows}${dots}</div><div class="sh-composer">${chips}</div></div>`;
}

// ——— the task page ———

/**
 * A task page in the shell (R1): the header (⊟, title, 交给 X, the status chip; the pane toggles),
 * then the frame: the explorer card, the conversation, the pane cards. Pure.
 */
export function renderShell(ctx: AppContext, task: Task, day: number, fill: Fill): SafeHtml {
  const { state, events, session } = ctx;
  const done = state.flags.includes(task.done);
  const live = day === state.day && !done && openWork(state, events)?.tree?.id === task.id;
  const st = shellOf(session, day, task, live);
  const board = task.board;
  const s = board ? boardState(board, day, task.id, events) : null;
  const ops = board ? ideOps(task, day, events) : [];
  const selected = board ? selectedSlot(board, ops, st.slot) : "";
  const panes = panesOf(task, live);
  const open = st.panes.filter((p) => panes.includes(p));
  // The header (R1).
  const toggleLabel = hasString("pane.explorer.toggle") ? t("pane.explorer.toggle") : "";
  const explorerToggle = board && live ? html`<button type="button" class="${cls("sh-tg", "explorer", st.explorer && "on")}" data-action="shell-explorer" aria-pressed="${st.explorer ? "true" : "false"}" aria-label="${toggleLabel}" title="${toggleLabel}">⊟</button>` : null;
  const status = html`<span class="${cls("st", done ? "done" : "doing")}">${tr(done ? "wb.task.done" : "wb.task.doing")}</span>`;
  const who = forWhom(task);
  const toggles = panes.map((p) => {
    const on = open.includes(p);
    const name = paneName(p, task);
    return html`<button type="button" class="${cls("sh-tg", on && "on")}" data-action="shell-pane" data-pane="${p}" aria-pressed="${on ? "true" : "false"}" aria-label="${name}" title="${name}"><span aria-hidden="true">${PANE_ICON[p]}</span></button>`;
  });
  const app = !board && live && WORK_KEY[task.app] ? html`<button type="button" class="btn" data-action="wb-nav" data-page="${task.app}">${tr(WORK_KEY[task.app]!)}</button>` : null;
  const head = html`<div class="wb-task-h sh-head">${explorerToggle}<div class="tt"><b>${fill(task.title)}</b><small>${who ? html`${who} · ` : null}${status}</small></div><span class="sp"></span>${app}${renderObjectBar(ctx)}<div class="sh-toggles">${toggles}</div></div>`;
  // The frame (R1): the explorer card, the conversation, the pane cards.
  const ex = board && live && st.explorer ? explorer(ctx, task, board, s!, st, selected) : null;
  const paneCards = open.map((p) => {
    let body: SafeHtml;
    if (p === "preview") body = previewPane(task, board!, s!, ops, selected);
    else if (p === "code") body = codePane(board!, s!, session, selected);
    else if (p === "table") body = tablePane(ctx, task, board!, s!, live, day);
    else if (p === "meeting") body = meetingWindow(ctx, task, board!);
    else if (p === "files") body = board ? filesPane(ctx, board, st, fill) : html``;
    else body = live ? renderWork(ctx, false) : renderDoneWork(ctx, day, task);
    return card(p, PANE_ICON[p], paneName(p, task), body, st, open.length === 2 && (p === open[0] ? "first" : "second"));
  });
  const paneArea = paneCards.length ? html`<div class="sh-panes">${paneCards}</div>` : null;
  const frame = cls("wb-task-body", "sh-frame", paneCards.length > 0 && "has-panes", st.max !== null && "maxed");
  return html`<div class="${cls("main", "task", "shell", `view-${surfaceOf(task, live)}`)}" data-task="${task.id}">${head}<div class="${frame}">${ex}${conversation(ctx, task, day, live, fill, board, s)}${paneArea}</div></div>`;
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
    if (p.task.board.view === "ide" && panesOf(p.task, p.live).includes("code")) openPane(st, "code");
    ctx.rerender();
  },
  // ↗ on a found 素材 card: the 文件 pane opens on its source.
  "shell-source"(ctx, data) {
    const p = pageOf(ctx);
    const card = data.card;
    const board = p?.task.board;
    if (!p || !board || !card || !hasViewableSource(board, card)) return;
    const st = stateFor(ctx, p);
    st.source = card;
    openPane(st, "files");
    ctx.rerender();
  },
};
