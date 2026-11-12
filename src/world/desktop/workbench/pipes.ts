// Pipes (author 2026-11-13: 「管道工」 for the new-hire onboarding, day 14): once the form is filled,
// the process itself is a board of pipe pieces — straights, bends, tees, crosses — each turned the
// wrong way; a click turns a piece a quarter; the flow starts at 入口 on the left and must reach
// 入职 on the right. Connected = the process runs (a thousand new hires flow through the pipes), and
// the board is approved (the chain's `approve` step). A seeded, always solvable layout: a path is
// carved first and its pieces laid, the rest filled at random, then every piece scrambled. There is
// no losing here — only turning. Pure engine + view; the actions keep the grid in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

/** Openings of a piece as bits: up 1, right 2, down 4, left 8 — at rotation 0. */
export const SHAPES = { straight: 10, bend: 3, tee: 11, cross: 15, end: 2 } as const;
export type Shape = keyof typeof SHAPES;
export interface Piece { readonly shape: Shape; readonly rot: 0 | 1 | 2 | 3 }
export interface PipesGrid {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly Piece[];
  /** The source and the sink: row indexes on the left and right edges. */
  readonly from: number;
  readonly to: number;
  readonly turns: number;
  readonly done: boolean;
  /** The carved path's rotation per cell (null off the path): the answer the solver and the cheat use. */
  readonly solution: readonly (0 | 1 | 2 | 3 | null)[];
  readonly approvedAt?: number;
}

/** The openings of a piece after its rotation (a quarter turn clockwise shifts up→right→down→left). */
export function openings(p: Piece): number {
  let b: number = SHAPES[p.shape];
  for (let i = 0; i < p.rot; i++) b = ((b << 1) & 15) | (b >> 3);
  return b;
}
const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const opposite = (d: number): number => (d === UP ? DOWN : d === DOWN ? UP : d === LEFT ? RIGHT : LEFT);

/** The cells the flow reaches from the source through connected openings. */
export function flow(g: PipesGrid): ReadonlySet<number> {
  const seen = new Set<number>();
  const start = g.from * g.cols;
  if (!(openings(g.cells[start]!) & LEFT)) return seen;
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    seen.add(i);
    const o = openings(g.cells[i]!);
    const x = i % g.cols, y = Math.floor(i / g.cols);
    const step = (d: number, nx: number, ny: number) => {
      if (!(o & d) || nx < 0 || nx >= g.cols || ny < 0 || ny >= g.rows) return;
      const j = ny * g.cols + nx;
      if (openings(g.cells[j]!) & opposite(d)) stack.push(j);
    };
    step(UP, x, y - 1); step(RIGHT, x + 1, y); step(DOWN, x, y + 1); step(LEFT, x - 1, y);
  }
  return seen;
}

/** Connected: the flow reaches the sink cell and that cell opens to the right. */
export const connected = (g: PipesGrid): boolean => {
  const sink = g.to * g.cols + g.cols - 1;
  return flow(g).has(sink) && (openings(g.cells[sink]!) & RIGHT) !== 0;
};

/** A piece whose openings are exactly `bits`, as a shape and rotation (null if none). */
export function pieceFor(bits: number): Piece | null {
  for (const shape of Object.keys(SHAPES) as Shape[]) for (const rot of [0, 1, 2, 3] as const) if (openings({ shape, rot }) === bits) return { shape, rot };
  return null;
}

/** A fresh, scrambled, solvable board: a random path from the left edge to the right edge, then noise. */
export function pipesStart(key: string, game: Extract<BoardGame, { kind: "pipes" }>, roll: () => number): PipesGrid {
  const { cols, rows } = game;
  const from = Math.floor(roll() * rows), to = Math.floor(roll() * rows);
  // carve: walk right, wandering up and down, never revisiting
  const need = new Map<number, number>(); // cell → openings bits
  let x = 0, y = from;
  const add = (i: number, d: number) => need.set(i, (need.get(i) ?? 0) | d);
  add(y * cols + x, LEFT);
  const visited = new Set<number>([y * cols + x]);
  while (x < cols - 1) {
    const here = y * cols + x;
    const options: number[] = [RIGHT];
    if (y > 0 && !visited.has((y - 1) * cols + x)) options.push(UP);
    if (y < rows - 1 && !visited.has((y + 1) * cols + x)) options.push(DOWN);
    // lean right so the path crosses the board, but wander a third of the time
    const d = roll() < 0.62 ? RIGHT : options[Math.floor(roll() * options.length)]!;
    const nx = d === RIGHT ? x + 1 : x, ny = d === UP ? y - 1 : d === DOWN ? y + 1 : y;
    add(here, d); add(ny * cols + nx, opposite(d));
    visited.add(ny * cols + nx);
    x = nx; y = ny;
  }
  const last = y * cols + x;
  add(last, RIGHT);
  const toRow = y;
  const cells: Piece[] = [];
  const solution: (0 | 1 | 2 | 3 | null)[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const bits = need.get(i);
    const solved = bits !== undefined ? pieceFor(bits) : null;
    const shape: Shape = solved ? solved.shape : (["straight", "bend", "bend", "tee", "straight"] as Shape[])[Math.floor(roll() * 5)]!;
    cells.push({ shape, rot: Math.floor(roll() * 4) as 0 | 1 | 2 | 3 });
    solution.push(solved ? solved.rot : null);
  }
  let g: PipesGrid = { key, cols, rows, cells, from, to: toRow, turns: 0, done: false, solution };
  // never handed over already connected
  if (connected(g)) { const i = from * cols; g = { ...g, cells: g.cells.map((p, j) => (j === i ? { ...p, rot: ((p.rot + 1) % 4) as 0 | 1 | 2 | 3 } : p)) }; }
  return g;
}

/** A click turns the piece a quarter; connected ends it. */
export function pipesTurn(g: PipesGrid, i: number): PipesGrid {
  if (g.done || i < 0 || i >= g.cells.length) return g;
  const cells = g.cells.map((p, j) => (j === i ? { ...p, rot: ((p.rot + 1) % 4) as 0 | 1 | 2 | 3 } : p));
  const next = { ...g, cells, turns: g.turns + 1 };
  return { ...next, done: connected(next) };
}

/** The solved board (dev / Kuro): every path piece to its carved rotation. */
export function pipesSolve(g: PipesGrid): PipesGrid {
  const cells = g.cells.map((p, i) => (g.solution[i] !== null && g.solution[i] !== undefined ? { ...p, rot: g.solution[i]! } : p));
  return { ...g, cells, done: true };
}

export const PIPES_DONE_MS = 2200;
export const pipesApproving = (g: Pick<PipesGrid, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < PIPES_DONE_MS;
export const pipesRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:pipes:${attempt}`);

// ——— the screen ———

const pieceSvg = (p: Piece, on: boolean): SafeHtml => {
  const o = openings(p);
  const seg = (d: number, x2: number, y2: number) => (o & d ? html`<line x1="50" y1="50" x2="${String(x2)}" y2="${String(y2)}"/>` : null);
  return html`<svg viewBox="0 0 100 100" class="${cls("pp-svg", on && "on")}" aria-hidden="true"><g class="pp-pipe">${seg(UP, 50, 0)}${seg(RIGHT, 100, 50)}${seg(DOWN, 50, 100)}${seg(LEFT, 0, 50)}<circle cx="50" cy="50" r="13"/></g></svg>`;
};

export function pipesStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly pipes: PipesGrid | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Extract<BoardGame, { kind: "pipes" }>;
  const g: PipesGrid | null = session.pipes?.key === task.id ? session.pipes : null;
  const done = approved && (!g || pipesApproving(g, nowMs) || g.done);
  const wet = g ? flow(g) : new Set<number>();
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const p = g?.cells[i] ?? { shape: "straight" as Shape, rot: 0 as const };
    const on = wet.has(i);
    return g && !g.done
      ? html`<button type="button" class="${cls("pp-cell", on && "on")}" data-action="pipes-turn" data-i="${String(i)}" aria-label="${String(i + 1)}">${pieceSvg(p, on)}</button>`
      : html`<div class="${cls("pp-cell", on && "on", !g && "blank")}">${g ? pieceSvg(p, on) : null}</div>`;
  });
  const rowsStyle = `--cols:${String(game.cols)};--rows:${String(game.rows)}`;
  const ends = g ? html`<span class="pp-end from" style="--row:${String(g.from)}">${S("pipes.stage.from")}</span><span class="pp-end to" style="--row:${String(g.to)}">${S("pipes.stage.to")}</span>` : null;
  const grid = html`<div class="pp-board" style="${rowsStyle}">${ends}<div class="pp-grid">${cells}</div></div>`;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("pipes.stage.won")}</span><p class="pp-flowline">${S("pipes.stage.flowed")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="pipes-start">${S("pipes.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl"><span class="mn-left">${S("pipes.stage.turns", { n: String(g.turns) })}</span><button type="button" class="mn-mode" data-action="pipes-start">${S("pipes.stage.again")}</button></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="pipes-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn pp", done && "done")}" data-screen="pipes">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("pipes.stage.kick")}</span><h2>${S("pipes.stage.title")}</h2><span class="mn-sub">${S("pipes.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("pipes.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month pp-main">${grid}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
