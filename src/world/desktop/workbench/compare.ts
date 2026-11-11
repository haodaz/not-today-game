// compare (author 2026-11-11): 猜老板的言外之意. The day's work as the author redesigned it after the
// playtest: the workbench stays the real-looking stage (the preview pane renders the page), and the
// decision runs in its own pane — 老王's portrait with three riddles for the page (the key words bold
// and coloured), the two versions of the page side by side as buttons, 克总你定, the row of his faces
// (one per page: pleased / not pleased / not yet), and at the end the settlement: the satisfaction
// and either 发给老王 or 让克总重新改一稿. Pure views; the actions are the board's (board.ts).
import { boardState, canPrint, comparePending, compareRight, compareScore, taskForId, tuneCarried, type BoardState } from "@state/days/board";
import { ideOps, ideSrc, selectedSlot } from "@state/days/ide";
import type { GameEvent } from "@state/events";
import type { ComparePage, Task, TaskBoard } from "@state/days/tasks";
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
 * launch (author 2026-11-11): the task's opening page over the whole stage, not inside the monitor
 * (「是最大区域，别再套在一个显示器里面了」): the workbench dimmed behind, a paper card like the title page's —
 * Kuro's figure and the counterpart's, the task's note, the call line, 开始工作. Up while
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
  const fill = (s: string) => fillPlaceholders(s, state.names);
  const who = npcPortrait(l.who);
  return html`<div class="launch-layer"><section class="task-launch" role="dialog" aria-modal="true" aria-labelledby="tl-title"><div class="tl-figures"><img class="tl-kuro" src="${frameUrl(FRAMES.idle[0])}" alt="">${who ? html`<img class="tl-who" src="${who}" alt="${speakerLabel(l.who, fill)}">` : null}</div><div class="tl-body"><h2 class="tl-title" id="tl-title">${fill(task.title)}</h2>${l.note.map((n) => html`<p class="tl-note">${fill(n)}</p>`)}<p class="tl-call">${fill(l.call)}</p><button type="button" class="tl-cta" data-action="task-launch" data-task="${task.id}">${fill(l.cta)}</button></div></section></div>`;
}

/**
 * work (author 2026-11-11 night): the day's work page over the whole stage (「这个游戏占了多大，工作交互区域
 * 就多大」): the decisions on the left (the compare pane), the rendered page on the right (the deck, held
 * while Kuro renders), the hand-in button, and 回到工作台 to look at the real workbench underneath. Up
 * while `session.workShow` names today's live board task (set by 开始工作); gone once the task is done.
 */
export function workLayer(ctx: { readonly state: State; readonly events: readonly GameEvent[]; readonly session: Session; readonly nowMs: number }): SafeHtml | null {
  const { state, events, session, nowMs } = ctx;
  if (session.view !== "desktop" || session.workShow === null) return null;
  const [dayText, taskId] = session.workShow.split(":");
  if (Number(dayText) !== state.day || !taskId) return null;
  const open = openWork(state, events);
  const task = open?.tree?.id === taskId ? open.tree : undefined;
  const board = task?.board;
  if (!task || !board?.compare || state.flags.includes(task.done)) return null;
  const s = boardState(board, state.day, taskId, events);
  const ops = ideOps(task, state.day, events);
  const key = `${state.day}:${taskId}`;
  const hold = session.ideHold && session.ideHold.key === key && session.ideHold.until > nowMs ? session.ideHold.src : null;
  const st = session.shell[key];
  const src = hold ?? ideSrc(board, s, ops, selectedSlot(board, ops, st?.slot ?? null, st?.slotAt ?? 0), tuneCarried(board, events));
  const fill = (x: string) => fillPlaceholders(x, state.names);
  const finish = html`<button type="button" class="wl-cta" data-action="board-print"${canPrint(board, s) ? null : html` disabled`}>${finishLabel(task)}</button>`;
  const back = hasString("work.back") ? html`<button type="button" class="wl-back" data-action="work-hide">${tr("work.back")}</button>` : null;
  return html`<div class="work-layer"><section class="work-stage" role="dialog" aria-modal="true" aria-label="${fill(task.title)}"><header class="wl-head"><span class="wl-title">${fill(task.title)}</span><span class="sp"></span>${back}</header><div class="wl-body"><div class="wl-left">${comparePane(task, board, s, true, hold !== null, st?.slot ?? null)}</div><div class="wl-right"><div class="wl-preview"><iframe class="ide-frame" data-keep="ide" src="${src}" title="${fill(task.title)}" sandbox="allow-scripts"></iframe></div></div></div><footer class="wl-foot">${finish}</footer></section></div>`;
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
