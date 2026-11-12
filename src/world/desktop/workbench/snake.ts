// Snake (author 2026-11-13: 「贪吃蛇」 for 投资人材料 3/3「本体」, day 6): once the form is filled, the
// page is a Nokia screen; the snake's head is the chick; the five sentences of the page sit on the
// grid as 1–5 and must be eaten in order — the 本体 takes shape sentence by sentence. Eating one out
// of order breaks the body: a stretch of the tail falls off. Running into yourself ends it (the
// edges wrap, as the old phone's did). All five in order = the form approved (the chain's `approve`
// step). The one surprise: the longer the body, the less it looks like a snake — eyes open along
// it, then the segments fork — the thing the page is about is what you are becoming. Pure engine +
// view; the actions keep the game in the session and run the clock.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "snake" }>;
export type SnakeDir = "up" | "down" | "left" | "right";

export interface SnakeFood { readonly cell: number; readonly n: number; readonly eaten: boolean }
export interface SnakeGrid {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  /** Cells, the head first. */
  readonly body: readonly number[];
  readonly dir: SnakeDir;
  /** The turn taken at the next step (never straight back). */
  readonly next: SnakeDir;
  readonly foods: readonly SnakeFood[];
  /** The number to eat next, 1-based; past the last = done. */
  readonly want: number;
  /** Steps the tail is held (growing). */
  readonly grow: number;
  readonly broke: number;
  readonly steps: number;
  readonly done: boolean;
  readonly over: boolean;
  /** The clock's generation: a stale loop sees a different one and stops. */
  readonly gen: number;
  readonly running: boolean;
  readonly approvedAt?: number;
}

const START_LEN = 3;
const GROW = 2;
export const SNAKE_TICK_MS = 170;
export const SNAKE_DONE_MS = 1800;

const opposite: Record<SnakeDir, SnakeDir> = { up: "down", down: "up", left: "right", right: "left" };

/** The cell one step from `cell` in `dir`, wrapping at the edges. */
export function ahead(g: Pick<SnakeGrid, "cols" | "rows">, cell: number, dir: SnakeDir): number {
  const x = cell % g.cols, y = Math.floor(cell / g.cols);
  const nx = dir === "left" ? (x + g.cols - 1) % g.cols : dir === "right" ? (x + 1) % g.cols : x;
  const ny = dir === "up" ? (y + g.rows - 1) % g.rows : dir === "down" ? (y + 1) % g.rows : y;
  return ny * g.cols + nx;
}

/** A fresh game: the snake mid-screen heading right, the five sentences dealt onto free cells. */
export function snakeStart(key: string, game: Game, count: number, roll: () => number, gen: number): SnakeGrid {
  const { cols, rows } = game;
  const hy = Math.floor(rows / 2), hx = Math.floor(cols / 2);
  const body = Array.from({ length: START_LEN }, (_, i) => hy * cols + hx - i);
  const taken = new Set<number>(body);
  // keep the head's row clear to its right so the first seconds are safe
  for (let x = hx; x < cols; x++) taken.add(hy * cols + x);
  const foods: SnakeFood[] = [];
  for (let n = 1; n <= count; n++) {
    let cell: number;
    let guard = 0;
    do cell = Math.floor(roll() * cols * rows);
    while (taken.has(cell) && guard++ < 500);
    taken.add(cell);
    foods.push({ cell, n, eaten: false });
  }
  return { key, cols, rows, body, dir: "right", next: "right", foods, want: 1, grow: 0, broke: 0, steps: 0, done: false, over: false, gen, running: false };
}

/** A turn: taken at the next step; straight back is ignored. */
export function snakeTurn(g: SnakeGrid, dir: SnakeDir): SnakeGrid {
  if (g.done || g.over || dir === opposite[g.dir] || dir === g.dir) return g;
  return { ...g, next: dir };
}

/** One tick of the clock. */
export function snakeStep(g: SnakeGrid): SnakeGrid {
  if (g.done || g.over) return g;
  const dir = g.next;
  const head = ahead(g, g.body[0]!, dir);
  // the tail moves away this tick unless the body is growing, so the cell it leaves is free
  const growing = g.grow > 0;
  const occupied = growing ? g.body : g.body.slice(0, -1);
  if (occupied.includes(head)) return { ...g, dir, over: true, running: false };
  let body = [head, ...(growing ? g.body : g.body.slice(0, -1))];
  let grow = Math.max(0, g.grow - 1);
  let foods = g.foods;
  let want = g.want;
  let broke = g.broke;
  const food = g.foods.find((f) => !f.eaten && f.cell === head);
  if (food) {
    if (food.n === want) {
      foods = g.foods.map((f) => (f === food ? { ...f, eaten: true } : f));
      want++;
      grow += GROW;
    } else {
      // out of order: a stretch of the tail falls off; the sentence stays where it is
      const keep = Math.max(START_LEN, body.length - Math.max(1, Math.floor(body.length / 3)));
      body = body.slice(0, keep);
      grow = 0;
      broke++;
    }
  }
  const done = want > g.foods.length;
  return { ...g, body, dir, next: dir, foods, want, grow, broke, steps: g.steps + 1, done, running: !done };
}

/** The solved game (dev / Kuro): everything eaten. */
export const snakeSolve = (g: SnakeGrid): SnakeGrid => ({ ...g, foods: g.foods.map((f) => ({ ...f, eaten: true })), want: g.foods.length + 1, done: true, over: false, running: false });

export const snakeApproving = (g: Pick<SnakeGrid, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < SNAKE_DONE_MS;
export const snakeRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:snake:${attempt}`);

// ——— the screen ———

/** How far the body has stopped being a snake: 0 plain, 1 eyes open along it, 2 the segments fork. */
export const snakeTier = (len: number): 0 | 1 | 2 => (len >= 13 ? 2 : len >= 8 ? 1 : 0);

export function snakeStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly snake: SnakeGrid | null }, approved: boolean, nowMs: number): SnakeHtml {
  const game = board.game as Game;
  const g: SnakeGrid | null = session.snake?.key === task.id ? session.snake : null;
  const done = approved && (!g || snakeApproving(g, nowMs) || g.done);
  const tier = g ? snakeTier(g.body.length) : 0;
  const bodyAt = new Map<number, number>();
  g?.body.forEach((c, i) => bodyAt.set(c, i));
  const foodAt = new Map<number, SnakeFood>();
  g?.foods.forEach((f) => { if (!f.eaten) foodAt.set(f.cell, f); });
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const b = bodyAt.get(i);
    const f = foodAt.get(i);
    if (b === 0) return html`<i class="${cls("sn-px", "head", g!.dir)}"></i>`;
    if (b !== undefined) return html`<i class="${cls("sn-px", "body", tier >= 1 && b % 3 === 1 && "eye", tier >= 2 && b % 2 === 0 && "fork")}"></i>`;
    if (f) return html`<i class="${cls("sn-px", "food", g && f.n === g.want && "want")}">${String(f.n)}</i>`;
    return html`<i class="sn-px"></i>`;
  });
  const lcd = html`<div class="${cls("sn-lcd", !g && "off", g?.over && "over")}" style="--cols:${String(game.cols)};--rows:${String(game.rows)}">${cells}</div>`;
  // the five sentences under the screen: the one to eat next lit
  const menu = board.slots.map((slot, i) => {
    const n = i + 1;
    const eaten = g?.foods[i]?.eaten ?? false;
    return html`<li class="${cls("sn-item", eaten && "eaten", g && !eaten && g.want === n && "want")}"><b>${String(n)}</b><span>${slot.label}</span><em>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</em></li>`;
  });
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="snake-turn" data-dir="${d}" aria-label="${d}">${d === "up" ? "2" : d === "left" ? "4" : d === "down" ? "8" : "6"}</button>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("snake.stage.won")}</span><p class="pp-flowline">${S("snake.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="snake-start">${S("snake.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("snake.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="snake-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="snake-start">${S("snake.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("snake.stage.count", { n: String(g.want - 1), total: String(g.foods.length) })}${g.broke ? html`<span class="sn-broke"> · ${S("snake.stage.broke", { n: String(g.broke) })}</span>` : null}</span>${g.running ? html`<div class="sk-pad sn-pad">${pad}</div>` : html`<button type="button" class="mn-mode" data-action="snake-resume">${S("snake.stage.resume")}</button>`}<span class="sn-hint">${S("snake.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="snake-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn sn", done && "done", g?.over && "lost")}" data-screen="snake">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("snake.stage.kick")}</span><h2>${S("snake.stage.title")}</h2><span class="mn-sub">${S("snake.stage.sub")}</span></div></header>
    <aside class="mn-notes sn-notes"><span class="mn-notes-h">${S("snake.stage.notes")}</span><ul class="sn-menu">${menu}</ul></aside>
    <div class="mn-month sn-main"><div class="sn-phone">${lcd}</div>${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
type SnakeHtml = SafeHtml;
