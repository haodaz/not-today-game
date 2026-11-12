// Minesweeper (author 2026-11-13: 「扫雷」 for the team-building schedule, day 8): once the form is
// filled, the schedule itself is a month on the desk — a calendar grid; the mines are the days the
// leaders are away; the numbers count them around a day; a flag marks a day as taken. Every safe
// day opened = the month is scheduled, and the board is approved (the same `approve` step the chain
// uses). Stepping on a mine: that day becomes 全员加班 and the month is lost — only Kuro can rescue
// it. Classic rules, first click always safe. Pure engine + view; the actions keep the grid in the
// session, the outcome is a board step.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

export interface MinesGrid {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly n: number;
  /** null until the first open (the first click is never a mine). */
  readonly mines: readonly boolean[] | null;
  readonly open: readonly boolean[];
  readonly flags: readonly boolean[];
  readonly over: boolean;
  readonly won: boolean;
  /** Clicks mark instead of opening. */
  readonly flagMode: boolean;
  readonly opened: number;
  /** Session ms the month was scheduled (the view holds the done state a beat). */
  readonly approvedAt?: number;
}

export const minesStart = (key: string, game: BoardGame): MinesGrid => ({
  key, cols: game.cols, rows: game.rows, n: game.mines, mines: null,
  open: Array<boolean>(game.cols * game.rows).fill(false), flags: Array<boolean>(game.cols * game.rows).fill(false),
  over: false, won: false, flagMode: false, opened: 0,
});

const around = (g: Pick<MinesGrid, "cols" | "rows">, i: number): number[] => {
  const x = i % g.cols, y = Math.floor(i / g.cols), out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < g.cols && ny >= 0 && ny < g.rows) out.push(ny * g.cols + nx);
  }
  return out;
};

/** The mines placed, never on the first cell or next to it. */
export function minesPlace(g: MinesGrid, first: number, roll: () => number): MinesGrid {
  const total = g.cols * g.rows;
  const safe = new Set([first, ...around(g, first)]);
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !safe.has(i));
  const mines = Array<boolean>(total).fill(false);
  for (let k = 0; k < Math.min(g.n, pool.length); k++) {
    const j = Math.floor(roll() * pool.length);
    mines[pool[j]!] = true; pool.splice(j, 1);
  }
  return { ...g, mines };
}

export const minesCount = (g: MinesGrid, i: number): number => (g.mines ? around(g, i).filter((j) => g.mines![j]).length : 0);

/** Open a day: a mine loses the month; a zero floods its neighbours; the last safe day wins. */
export function minesOpen(g0: MinesGrid, i: number, roll: () => number): MinesGrid {
  if (g0.over || g0.won || i < 0 || i >= g0.cols * g0.rows || g0.open[i] || g0.flags[i]) return g0;
  const g = g0.mines ? g0 : minesPlace(g0, i, roll);
  const mines = g.mines!;
  if (mines[i]) {
    // the month lost: every mine shows
    const open = g.open.map((o, j) => o || mines[j]!);
    return { ...g, open, over: true };
  }
  const open = [...g.open];
  const stack = [i];
  while (stack.length) {
    const j = stack.pop()!;
    if (open[j] || g.flags[j]) continue;
    open[j] = true;
    if (minesCount(g, j) === 0) for (const k of around(g, j)) if (!open[k] && !mines[k]) stack.push(k);
  }
  const opened = open.filter(Boolean).length;
  const won = opened === g.cols * g.rows - g.n;
  return { ...g, open, opened, won };
}

export const minesFlag = (g: MinesGrid, i: number): MinesGrid =>
  g.over || g.won || g.open[i] ? g : { ...g, flags: g.flags.map((f, j) => (j === i ? !f : f)) };

export const minesLeft = (g: MinesGrid): number => g.n - g.flags.filter(Boolean).length;

/** The month scheduled: held a beat on screen before the board returns. */
export const MINES_DONE_MS = 1600;
export const minesApproving = (g: Pick<MinesGrid, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < MINES_DONE_MS;

/** The seeded roll for a grid's placement: the run, the task, the attempt. */
export const minesRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:mines:${attempt}`);

// ——— the screen ———

const WEEK = (): string[] => S("mines.stage.days").split(",");

export function minesStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly mines: MinesGrid | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game!;
  const g: MinesGrid | null = session.mines?.key === task.id ? session.mines : null;
  const done = approved && (!g || minesApproving(g, nowMs) || g.won);
  // the people and when they can, from the form, as the month's notes on the left
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const week = html`<div class="mn-week">${WEEK().map((d) => html`<span>${d}</span>`)}</div>`;
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const open = g?.open[i] ?? false;
    const flag = g?.flags[i] ?? false;
    const mine = open && g?.mines?.[i] === true;
    const count = open && !mine && g ? minesCount(g, i) : 0;
    const live = g !== null && !g.over && !g.won && !open;
    const inner = mine ? html`<span class="mn-mine">${S("mines.stage.mine")}</span>` : flag ? html`<span class="mn-flag">⚑</span>` : open ? (count ? html`<span class="${cls("mn-n", `c${count}`)}">${String(count)}</span>` : null) : html`<span class="mn-day">${String(i + 1)}</span>`;
    return live
      ? html`<button type="button" class="${cls("mn-cell", flag && "flagged")}" data-action="mines-open" data-i="${String(i)}" aria-label="${String(i + 1)}">${inner}</button>`
      : html`<div class="${cls("mn-cell", open && "open", mine && "mine", flag && "flagged")}">${inner}</div>`;
  });
  const grid = html`<div class="mn-grid" style="--cols:${String(game.cols)}">${cells}</div>`;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("mines.stage.won")}</span></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="mines-start">${S("mines.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("mines.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="mines-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="mines-start">${S("mines.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl"><span class="mn-left">${S("mines.stage.left", { n: String(minesLeft(g)) })}</span><button type="button" class="${cls("mn-mode", g.flagMode && "on")}" data-action="mines-mode" aria-pressed="${g.flagMode ? "true" : "false"}">${S(g.flagMode ? "mines.stage.dig" : "mines.stage.flag")}</button></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="mines-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn", done && "done", g?.over && "lost")}" data-screen="mines">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("mines.stage.kick")}</span><h2>${S("mines.stage.title")}</h2><span class="mn-sub">${S("mines.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("mines.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month"><div class="mn-month-h">${S("mines.stage.month")}</div>${week}${grid}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
