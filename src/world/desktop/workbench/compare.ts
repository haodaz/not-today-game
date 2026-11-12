// compare (author 2026-11-11): 猜老板的言外之意. The day's work as the author redesigned it after the
// playtest: the workbench stays the real-looking stage (the preview pane renders the page), and the
// decision runs in its own pane — 老王's portrait with three riddles for the page (the key words bold
// and coloured), the two versions of the page side by side as buttons, 克总你定, the row of his faces
// (one per page: pleased / not pleased / not yet), and at the end the settlement: the satisfaction
// and either 发给老王 or 让克总重新改一稿. Pure views; the actions are the board's (board.ts).
import { boardState, canPrint, comparePending, compareRight, compareScore, taskForId, tuneCarried, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, selectedSlot } from "@state/days/ide";
import type { GameEvent } from "@state/events";
import { API_FIELD, SLOT_FIELD, type ComparePage, type Task, type TaskBoard } from "@state/days/tasks";
import type { State } from "@state/types.gen";
import { npcPortrait, speakerLabel } from "@world/npc";
import { fillPlaceholders } from "@world/replies/placeholders";
import { FRAMES, frameUrl } from "../kuro/body";
import type { Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { cardText, finishLabel } from "./board";
import { openWork } from "./work";

/**
 * launch (author 2026-11-11/12): the task's opening page over the whole stage, a game's level card,
 * not a web page: the desktop dimmed behind; a day tag; a wide paper card with the counterpart's bust
 * and name tag on the left, the task's title, note and call line in the middle, 开始工作 under them,
 * and Kuro peeking over the card's bottom-right corner (never over the portrait). Up while
 * `session.launchShow` names today's task page (entered through 工作台's row) and the screen is shown.
 */
export function launchLayer(state: State, session: Pick<Session, "launchShow" | "launched" | "view">): SafeHtml | null {
  if (session.view !== "desktop" || session.launchShow === null) return null;
  const [dayText, taskId] = session.launchShow.split(":");
  const day = Number(dayText);
  if (day !== state.day || !taskId || session.launched.has(session.launchShow)) return null;
  const task = taskForId(day, taskId);
  const l = task?.launch;
  if (!task || !l) return null;
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const who = npcPortrait(l.who);
  // the name tag under the bust: 老王, Vivi, 老周 (launch.name.<id>), else the speaker's label
  const name = hasString(`launch.name.${l.who}`) ? t(`launch.name.${l.who}`) : speakerLabel(l.who, fill);
  const tag = hasString("task.launch.tag") ? html`<div class="tl-tag">${tr("task.launch.tag", { day: String(day) })}</div>` : null;
  return html`<div class="launch-layer">${tag}<section class="task-launch" role="dialog" aria-modal="true" aria-labelledby="tl-title"><div class="tl-figure">${who ? html`<img class="tl-who" src="${who}" alt="">` : null}<span class="tl-name">${name}</span></div><div class="tl-body"><h2 class="tl-title" id="tl-title">${fill(task.title)}</h2>${l.note.map((n) => html`<p class="tl-note">${fill(n)}</p>`)}<p class="tl-call">${fill(l.call)}</p><button type="button" class="tl-cta" data-action="task-launch" data-task="${task.id}">${fill(l.cta)}</button></div><img class="tl-kuro" src="${frameUrl(FRAMES.idle[0])}" alt="" aria-hidden="true"></section></div>`;
}

/**
 * work (author 2026-11-11/12): the day's work over the whole stage, one screen at a time (「preview
 * 和选择并不放在一起」):
 *   choose  — 老王's three riddles for the page (each a few dozen words, the key words marked), and
 *             the page itself twice: v15's and v16's, each the real deck page rendered with that
 *             version's line, each with 用这版; the row of his faces so far. No 克总你定.
 *   result  — Kuro renders the chosen page (the preview holds for RENDER_MS with 克总在渲染…), then
 *             the page large with 老王's face and a line (笑了 / 撇嘴); 下一页, or 看结算 after the last.
 *   settle  — the satisfaction, the faces, 发给老板 at the bar or 让克总按他的意思重新改一稿 under it.
 * Up while `session.workShow` names today's live board task; gone once the task is done.
 */
export function workLayer(ctx: { readonly state: State; readonly events: readonly GameEvent[]; readonly session: Session; readonly nowMs: number }): SafeHtml | null {
  const { state, events, session, nowMs } = ctx;
  if (session.view !== "desktop" || session.workShow === null) return null;
  const [dayText, taskId] = session.workShow.split(":");
  if (Number(dayText) !== state.day || !taskId) return null;
  const open = openWork(state, events);
  const task = open?.tree?.id === taskId ? open.tree : undefined;
  const board = task?.board;
  const cmp = board?.compare;
  if (!task || !board || !cmp || state.flags.includes(task.done)) return null;
  const s = boardState(board, state.day, taskId, events);
  const ops = ideOps(task, state.day, events);
  const key = `${state.day}:${taskId}`;
  const holding = !!session.ideHold && session.ideHold.key === key && session.ideHold.until > nowMs;
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const back = hasString("work.back") ? html`<button type="button" class="wl-back" data-action="work-hide">${tr("work.back")}</button>` : null;
  const head = html`<header class="wl-head"><span class="wl-title">${fill(task.title)}</span><span class="sp"></span>${back}</header>`;
  const phase = session.workPhase?.key === key ? session.workPhase : null;
  const pending = comparePending(board, s);
  const srcFor = (slot: string, card: string) => ideSrc(board, { ...s, slots: { ...s.slots, [slot]: card } }, ops, slot, tuneCarried(board, events));
  let body: SafeHtml;
  let screen: string;
  if (phase?.phase === "result") {
    // the page just chosen, rendered; 老王's face
    screen = "result";
    const page = cmp.pages.find((p) => p.slot === phase.slot)!;
    const n = cmp.pages.indexOf(page) + 1;
    const card = s.slots[page.slot]!;
    const right = compareRight(board, s.slots, page.slot);
    const face = html`<div class="${cls("wl-face", right ? "happy" : "pout")}"><img src="${right ? BOSS_FACES.happy : BOSS_FACES.pout}" alt=""><p>${tr(right ? "compare.result.happy" : "compare.result.pout")}</p></div>`;
    const render = holding
      ? html`<div class="wl-rendering"><img class="wl-rk" src="${frameUrl(FRAMES.busy[0])}" alt=""><p>${tr("compare.rendering.big", { n: String(n) })}</p></div>`
      : html`<div class="wl-page"><iframe class="ide-frame" data-keep="ide-result" src="${srcFor(page.slot, card)}" title="${fill(task.title)}" sandbox="allow-scripts"></iframe></div>`;
    const next = holding ? null : html`<button type="button" class="wl-cta" data-action="compare-next">${tr(pending ? "compare.next" : "compare.sum.open")}</button>`;
    body = html`<div class="wl-result"><div class="wl-result-page">${render}</div><aside class="wl-result-side">${holding ? null : face}${faces(board, s, page, false)}${next}</aside></div>`;
  } else if (pending) {
    // choose: the riddles, the page twice
    screen = "choose";
    const page = pending;
    const n = cmp.pages.indexOf(page) + 1;
    const label = board.slots.find((x) => x.id === page.slot)?.label ?? page.slot;
    const bubbles = page.bubbles.map((b) => html`<div class="cmp-bub">${riddle(b)}</div>`);
    const boss = html`<div class="wl-boss"><img class="cmp-portrait" src="${BOSS_PORTRAIT}" alt="${t("msgs.boss")}"><div class="cmp-bubbles">${bubbles}</div></div>`;
    // the comparison is the content itself (author 2026-11-12: 「用 v15 和 v16 要看代码的区别，标出 diff」):
    // the page's file, its slot line opened into the two versions' lines, a diff: − v15 / + v16, each
    // with 用这版. The rendered page comes after the pick, on the result screen.
    const file = board.ide?.files?.[page.slot];
    const code = file?.code ?? [];
    const textOf = (cardId: string) => cardText(board, cardId);
    const rows = code.flatMap((raw, i) => {
      const line = raw.split(API_FIELD).join("./snapshot.js");
      const at = line.indexOf(SLOT_FIELD);
      if (at < 0) return [html`<div class="wl-ln"><span class="wl-gut">${i + 1}</span><span class="wl-mk"></span><code>${line}</code></div>`];
      const before = line.slice(0, at);
      const after = line.slice(at + SLOT_FIELD.length);
      const alt = (cardId: string, v: string, kind: "del" | "add") =>
        html`<div class="${cls("wl-ln", kind)}"><span class="wl-gut">${i + 1}</span><span class="wl-mk">${kind === "del" ? "−" : "+"}</span><code>${before}<b class="wl-field">"${textOf(cardId)}"</b>${after}</code><span class="wl-v">${v}</span><button type="button" class="wl-use" data-action="compare-pick" data-slot="${page.slot}" data-card="${cardId}">${tr("compare.use", { v })}</button></div>`;
      return [alt(page.left, cmp.versions[0], "del"), alt(page.right, cmp.versions[1], "add")];
    });
    const diff = html`<div class="wl-vs" data-slot="${page.slot}"><div class="wl-file"><span class="wl-fname">${file?.name ?? page.slot}</span><span class="wl-fnote">${tr("compare.diffNote", { a: cmp.versions[0], b: cmp.versions[1] })}</span></div><div class="wl-code">${rows}</div></div>`;
    body = html`<div class="wl-choose">${boss}<div class="wl-ask"><span class="wl-n">${tr("compare.page", { n: String(n), label })}</span><span class="wl-of">${n} / ${cmp.pages.length}</span><span class="wl-q">${tr("compare.pickTitle")}</span></div>${diff}${faces(board, s, page, false)}</div>`;
  } else {
    // settle
    screen = "settle";
    const sc = compareScore(board, s);
    const pass = sc.pct >= cmp.threshold;
    const finish = html`<button type="button" class="wl-cta" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${finishLabel(task)}</button>`;
    const redo = !pass && hasString("compare.redo") ? html`<button type="button" class="wl-cta ghost" data-action="compare-redo"${holding ? html` disabled` : null}>${tr("compare.redo")}</button><p class="cmp-note">${tr("compare.redoNote")}</p>` : null;
    body = html`<div class="wl-settle"><div class="cmp-score"><b>${sc.pct}%</b><span>${tr("compare.score", { r: String(sc.right), w: String(sc.total - sc.right) })}</span></div>${faces(board, s, cmp.pages[cmp.pages.length - 1]!, false)}<p class="${cls("cmp-verdict", pass ? "pass" : "fail")}">${tr(pass ? "compare.pass" : "compare.fail", { pct: String(cmp.threshold) })}</p><div class="wl-settle-actions">${pass ? finish : redo}</div></div>`;
  }
  return html`<div class="work-layer"><section class="work-stage" data-screen="${screen}" role="dialog" aria-modal="true" aria-label="${fill(task.title)}">${head}<div class="wl-body">${body}</div></section></div>`;
}

/** 老王's faces (SVG, drawn in code: author 2026-11-11 「画个卡通的高兴生气就行」) and his portrait. */
export const BOSS_FACES = { happy: "/npc/boss_happy.svg", pout: "/npc/boss_pout.svg" } as const;
export const BOSS_PORTRAIT = "/npc/boss.png";
/** How long Kuro "renders" a page after a pick (the preview holds the old page meanwhile). */
export const RENDER_MS = 900;

/** A riddle's 【key words】 drawn bold and coloured; the rest plain (escaped by the template). */
export function riddle(text: string): SafeHtml {
  const parts = text.split(/【([^】]*)】/);
  return html`${parts.map((p, i) => (i % 2 === 1 ? html`<b class="cmp-key">${p}</b>` : html`${p}`))}`;
}

/** The page the pane shows: the first not picked; else the page of `slot` (a face clicked); else the last. */
export function pageShown(board: TaskBoard, s: BoardState, slot: string | null): ComparePage {
  const cmp = board.compare!;
  return comparePending(board, s) ?? cmp.pages.find((p) => p.slot === slot) ?? cmp.pages[cmp.pages.length - 1]!;
}

/** One face per page: pleased / not pleased / not yet; the shown page marked. */
function faces(board: TaskBoard, s: BoardState, shown: ComparePage, live: boolean): SafeHtml {
  const cmp = board.compare!;
  const row = cmp.pages.map((p, i) => {
    const picked = p.slot in s.slots;
    const mood = !picked ? "todo" : compareRight(board, s.slots, p.slot) ? "happy" : "pout";
    const label = `${t("compare.page", { n: String(i + 1), label: board.slots.find((x) => x.id === p.slot)?.label ?? p.slot })} · ${t(`compare.face.${mood}`)}`;
    const img = mood === "todo" ? null : html`<img src="${BOSS_FACES[mood]}" alt="">`;
    const inner = html`<span class="${cls("cmp-face", mood, p.slot === shown.slot && "cur")}" title="${label}">${img}</span>`;
    return live && picked ? html`<button type="button" class="cmp-face-btn" data-action="shell-slot" data-slot="${p.slot}" aria-label="${label}">${inner}</button>` : html`<span class="cmp-face-btn" aria-label="${label}">${inner}</span>`;
  });
  return html`<div class="cmp-faces" role="list">${row}</div>`;
}

/** The settlement once every page is picked: the score, then the way on (hand in, or Kuro's rewrite). */
function settlement(board: TaskBoard, s: BoardState, live: boolean, busy: boolean): SafeHtml {
  const cmp = board.compare!;
  const sc = compareScore(board, s);
  const pass = sc.pct >= cmp.threshold;
  const score = html`<div class="cmp-score"><b>${sc.pct}%</b><span>${tr("compare.score", { r: String(sc.right), w: String(sc.total - sc.right) })}</span></div>`;
  const verdict = html`<p class="${cls("cmp-verdict", pass ? "pass" : "fail")}">${tr(pass ? "compare.pass" : "compare.fail", { pct: String(cmp.threshold) })}</p>`;
  const redo = !pass && live && hasString("compare.redo")
    ? html`<button type="button" class="sh-chip primary cmp-redo" data-action="compare-redo"${busy ? html` disabled` : null}>${tr("compare.redo")}</button><p class="cmp-note">${tr("compare.redoNote")}</p>`
    : null;
  return html`<div class="cmp-sum">${score}${verdict}${redo}</div>`;
}

/**
 * The 老王的话 pane: his portrait and the page's riddles, the page's two versions (buttons), 克总你定,
 * the faces, and — every page picked — the settlement. While Kuro renders (the preview holds) the
 * buttons wait and the pane says so. Read back (not live): the picks as they were, nothing to press.
 */
export function comparePane(task: Task, board: TaskBoard, s: BoardState, live: boolean, busy: boolean, slot: string | null): SafeHtml {
  const cmp = board.compare!;
  const page = pageShown(board, s, slot);
  const n = cmp.pages.indexOf(page) + 1;
  const label = board.slots.find((x) => x.id === page.slot)?.label ?? page.slot;
  const done = comparePending(board, s) === null;
  const bubbles = page.bubbles.map((b) => html`<div class="cmp-bub">${riddle(b)}</div>`);
  const boss = html`<div class="cmp-boss"><img class="cmp-portrait" src="${BOSS_PORTRAIT}" alt="${t("msgs.boss")}"><div class="cmp-bubbles">${bubbles}</div></div>`;
  const chosen = s.slots[page.slot];
  const card = (id: string, v: string) => {
    const on = chosen === id;
    const body = html`<i class="cmp-v">${v}</i><p>${cardText(board, id)}</p>`;
    return live
      ? html`<button type="button" class="${cls("cmp-card", on && "on")}" data-action="compare-pick" data-slot="${page.slot}" data-card="${id}" aria-pressed="${on ? "true" : "false"}"${busy ? html` disabled` : null}>${body}<span class="cmp-use">${tr("compare.use", { v })}</span></button>`
      : html`<div class="${cls("cmp-card", "read", on && "on")}">${body}</div>`;
  };
  const kuro = live && hasString("compare.kuro") ? html`<button type="button" class="sh-chip cmp-kuro" data-action="compare-kuro" data-slot="${page.slot}"${busy ? html` disabled` : null}>${tr("compare.kuro")}</button>` : null;
  const rendering = busy ? html`<div class="cmp-rendering" aria-live="polite">${tr("compare.rendering", { n: String(n) })}</div>` : null;
  const head = html`<div class="cmp-head"><span class="cmp-n">${tr("compare.page", { n: String(n), label })}</span><span class="cmp-of">${n} / ${cmp.pages.length}</span></div>`;
  // The guide rings the pair (never one side: that would name the answer).
  const vs = html`<div class="cmp-vs" data-slot="${page.slot}">${card(page.left, cmp.versions[0])}${card(page.right, cmp.versions[1])}</div>`;
  return html`<div class="${cls("cmp", done && "done", busy && "busy")}" data-task="${task.id}">${boss}${head}${vs}<div class="cmp-tools">${kuro}${rendering}</div>${faces(board, s, page, live)}${done ? settlement(board, s, live, busy) : null}</div>`;
}
