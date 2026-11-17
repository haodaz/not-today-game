// Nonogram (game-swaps, author 2026-11-16: 「12天那个可以」): day 12's side task 对账结果看一眼 as 数织. The
// first side game on a plain task: choosing 自己做 opens this stage before the task's `self` branch
// runs. The clue numbers along the top and the left, a grid to fill; a wrong fill flashes, clears
// itself and counts a mistake. Every `#` filled: the grid lines fade, the clues go, the picture stays
// a moment; then the hand-in, which runs the `self` branch with this grade. Pure engine + view.
import type { BoardVerdict } from "@state/days/board";
import type { Task, TaskGame } from "@state/days/tasks";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { byCount } from "./tally";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<TaskGame, { kind: "nonogram" }>;

/** A wrong fill flashes this long before it clears itself. */
export const NONO_FLASH_MS = 450;
/** Solved: the picture alone this long before the foot (won, left, the hand-in). */
export const NONO_REVEAL_MS = 1200;

export interface NonogramGame {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  /** Row by row: the cells filled (only right ones stay; a wrong fill clears itself). */
  readonly filled: readonly boolean[];
  readonly mistakes: number;
  /** The last wrong fill, flashing. */
  readonly flash: { readonly i: number; readonly at: number } | null;
  /** At least one cell was filled (the hint goes). */
  readonly touched: boolean;
  readonly done: boolean;
  readonly doneAt: number | null;
}

const isInk = (game: Game, i: number, cols: number): boolean => game.picture[Math.floor(i / cols)]?.[i % cols] === "#";

export function nonogramStart(key: string, game: Game): NonogramGame {
  const rows = game.picture.length;
  const cols = game.picture[0]?.length ?? 0;
  return { key, cols, rows, filled: Array.from({ length: rows * cols }, () => false), mistakes: 0, flash: null, touched: false, done: false, doneAt: null };
}

/** Every `#` filled (and, by construction, no `.`). */
const solved = (game: Game, filled: readonly boolean[], cols: number): boolean => filled.every((f, i) => f === isInk(game, i, cols));

/**
 * A click on cell `i`: filled → cleared; a `#` → filled (the last one: done); a `.` → a mistake, the
 * cell flashes and stays empty. After the solve: the same game.
 */
export function nonogramTap(g: NonogramGame, game: Game, i: number, nowMs: number): NonogramGame {
  if (g.done || !Number.isInteger(i) || i < 0 || i >= g.filled.length) return g;
  if (g.filled[i]) return { ...g, filled: g.filled.map((f, j) => (j === i ? false : f)) };
  if (!isInk(game, i, g.cols)) return { ...g, mistakes: g.mistakes + 1, flash: { i, at: nowMs }, touched: true };
  const filled = g.filled.map((f, j) => (j === i ? true : f));
  const done = solved(game, filled, g.cols);
  return { ...g, filled, touched: true, done, doneAt: done ? nowMs : null };
}

/** Dev / tests: every `#` filled at once. */
export const nonogramSolve = (g: NonogramGame, game: Game, nowMs: number): NonogramGame => ({ ...g, filled: g.filled.map((_, i) => isInk(game, i, g.cols)), touched: true, done: true, doneAt: nowMs });

/** Solved and the picture has had its moment: the foot and the hand-in show. */
export const nonogramRevealed = (g: Pick<NonogramGame, "done" | "doneAt">, nowMs: number): boolean => g.done && g.doneAt !== null && nowMs - g.doneAt >= NONO_REVEAL_MS;

// ——— the screen ———

/** The stage body: the clues, the grid, the foot (with the hand-in once solved and shown). */
export function nonogramStage(task: Task, game: Game, session: { readonly nonogram: NonogramGame | null }, nowMs: number, handIn: SafeHtml | string): SafeHtml {
  const g: NonogramGame | null = session.nonogram?.key === task.id ? session.nonogram : null;
  const lv = g ?? nonogramStart(task.id, game);
  const top = game.cols.map((c) => html`<span class="ng-clue col">${c.map((n) => html`<b>${String(n)}</b>`)}</span>`);
  const left = game.rows.map((r) => html`<span class="ng-clue row">${r.map((n) => html`<b>${String(n)}</b>`)}</span>`);
  const cells = lv.filled.map((f, i) => {
    const flashing = !!g?.flash && g.flash.i === i && nowMs - g.flash.at < NONO_FLASH_MS;
    return html`<button type="button" class="${cls("ng-cell", f && "on", flashing && "bad")}" data-action="nonogram-tap" data-i="${String(i)}"${g && !g.done ? null : html` disabled`}></button>`;
  });
  const solvedNow = !!g?.done;
  const field = html`<div class="${cls("ng-board", !g && "blank", solvedNow && "solved")}" style="--cols:${String(lv.cols)};--rows:${String(lv.rows)}"><i class="ng-corner"></i><div class="ng-top">${top}</div><div class="ng-left">${left}</div><div class="ng-grid">${cells}</div></div>`;
  const sub = g?.touched ? S("nonogram.stage.sub") : S("nonogram.stage.hint");
  let foot: SafeHtml | null;
  if (g && nonogramRevealed(g, nowMs)) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("nonogram.stage.won")}</span><p class="pp-flowline">${S("nonogram.stage.left")}</p><button type="button" class="wl-cta" data-action="nonogram-hand">${handIn}</button></div>`;
  else if (g?.done) foot = null;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="nonogram-start">${S("nonogram.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl ng-ctl"><span class="mn-left">${S("nonogram.stage.mistakes", { n: String(g.mistakes) })}</span></div>`;
  const cheat = import.meta.env.DEV && g && !g.done ? html`<button type="button" class="sk-cheat" data-action="nonogram-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn ng", solvedNow && "done")}" data-screen="nonogram">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("nonogram.stage.kick")}</span><h2>${S("nonogram.stage.title")}</h2><span class="mn-sub">${sub}</span></div></header>
    <div class="mn-month ng-main">${field}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}

/** game-swaps §3: the mistakes (0 perfect, ≤ 3 flawed, more wrong); unfinished → wrong. */
export function grade(g: Pick<NonogramGame, "done" | "mistakes"> | null): BoardVerdict {
  if (!g?.done) return "wrong";
  return byCount(g.mistakes, 0, 3);
}
