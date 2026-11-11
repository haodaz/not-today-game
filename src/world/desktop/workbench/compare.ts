// compare (author 2026-11-11): 猜老板的言外之意. The day's work as the author redesigned it after the
// playtest: the workbench stays the real-looking stage (the preview pane renders the page), and the
// decision runs in its own pane — 老王's portrait with three riddles for the page (the key words bold
// and coloured), the two versions of the page side by side as buttons, 克总你定, the row of his faces
// (one per page: pleased / not pleased / not yet), and at the end the settlement: the satisfaction
// and either 发给老王 or 让克总重新改一稿. Pure views; the actions are the board's (board.ts).
import { comparePending, compareRight, compareScore, type BoardState } from "@state/days/board";
import type { ComparePage, Task, TaskBoard } from "@state/days/tasks";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t, tr } from "@world/i18n";
import { cardText } from "./board";

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
