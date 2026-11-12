// Tetris (author 2026-11-13: 「俄罗斯方块」 for 本周值班表, day 12): once the form is filled, the week is a
// well seven columns wide — Monday to Sunday — and the shifts come down as pieces, in the Game Boy's
// four greens. A full row is a day staffed through the night, and it clears. Clear a week of rows
// (`goal`) and the rota is done: the form is approved (the chain's `approve` step). The stack
// reaching the top ends it (重来 / 让克总帮忙). Every seventh piece is the ΥΠΝΟΣ one — the shape no
// shift is, a Y of five blocks, drawn in the wrong colour — and it still has to go somewhere.
// Pure engine + view; the actions keep the game in the session and run the clock.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "tetris" }>;
export type TetrisKey = "left" | "right" | "rotate" | "down" | "drop";

/** The pieces: four rotations each, as [x, y] cells around an origin. The last is ΥΠΝΟΣ (the Y pentomino). */
export const PIECES: readonly { readonly name: string; readonly rots: readonly (readonly (readonly [number, number])[])[] }[] = [
  { name: "I", rots: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]], [[0, 2], [1, 2], [2, 2], [3, 2]], [[1, 0], [1, 1], [1, 2], [1, 3]]] },
  { name: "O", rots: [[[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [2, 1]]] },
  { name: "T", rots: [[[1, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [1, 2]], [[1, 0], [0, 1], [1, 1], [1, 2]]] },
  { name: "S", rots: [[[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [1, 1], [2, 1], [2, 2]], [[1, 1], [2, 1], [0, 2], [1, 2]], [[0, 0], [0, 1], [1, 1], [1, 2]]] },
  { name: "Z", rots: [[[0, 0], [1, 0], [1, 1], [2, 1]], [[2, 0], [1, 1], [2, 1], [1, 2]], [[0, 1], [1, 1], [1, 2], [2, 2]], [[1, 0], [0, 1], [1, 1], [0, 2]]] },
  { name: "J", rots: [[[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [1, 1], [1, 2]], [[0, 1], [1, 1], [2, 1], [2, 2]], [[1, 0], [1, 1], [0, 2], [1, 2]]] },
  { name: "L", rots: [[[2, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2], [2, 2]], [[0, 1], [1, 1], [2, 1], [0, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]]] },
  { name: "Y", rots: [[[0, 1], [1, 1], [2, 1], [3, 1], [1, 0]], [[1, 0], [1, 1], [1, 2], [1, 3], [0, 2]], [[0, 1], [1, 1], [2, 1], [3, 1], [2, 2]], [[1, 0], [1, 1], [1, 2], [1, 3], [2, 1]]] },
];
export const YPNOS = PIECES.length - 1;
/** Every nth piece is ΥΠΝΟΣ. */
export const YPNOS_EVERY = 7;

export interface Falling { readonly kind: number; readonly rot: number; readonly x: number; readonly y: number }
export interface TetrisGame {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  /** Locked blocks: 0 empty, else the piece kind + 1. */
  readonly cells: readonly number[];
  readonly piece: Falling | null;
  readonly nextKind: number;
  readonly spawned: number;
  readonly lines: number;
  readonly goal: number;
  /** Rows cleared by the last lock (the view flashes them), and when. */
  readonly flash: readonly number[];
  readonly flashAt: number;
  readonly done: boolean;
  readonly over: boolean;
  readonly gen: number;
  readonly running: boolean;
  readonly approvedAt?: number;
}

export const TETRIS_DONE_MS = 1800;
export const TETRIS_FLASH_MS = 420;
/** Gravity: ms per row, by lines cleared. */
export const tetrisDropMs = (lines: number): number => Math.max(220, 640 - lines * 50);

const blocks = (p: Falling): readonly (readonly [number, number])[] => PIECES[p.kind]!.rots[p.rot % 4]!.map(([x, y]) => [x + p.x, y + p.y] as const);

/** The piece sits on free cells inside the well (above the top is allowed while it enters). */
export function fits(g: Pick<TetrisGame, "cols" | "rows" | "cells">, p: Falling): boolean {
  return blocks(p).every(([x, y]) => x >= 0 && x < g.cols && y < g.rows && (y < 0 || g.cells[y * g.cols + x] === 0));
}

const spawn = (g: Pick<TetrisGame, "cols">, kind: number): Falling => ({ kind, rot: 0, x: Math.floor((g.cols - 4) / 2), y: -1 });

/** The kind of the nth piece spawned (1-based): ΥΠΝΟΣ every `YPNOS_EVERY`th, else a tetromino by the dice. */
export const kindFor = (n: number, roll: () => number): number => (n % YPNOS_EVERY === 0 ? YPNOS : Math.floor(roll() * YPNOS));

export function tetrisStart(key: string, game: Game, roll: () => number, gen: number): TetrisGame {
  const g0 = { cols: game.cols, rows: game.rows, cells: Array.from({ length: game.cols * game.rows }, () => 0) };
  return { key, ...g0, piece: spawn(g0, kindFor(1, roll)), nextKind: kindFor(2, roll), spawned: 1, lines: 0, goal: game.goal, flash: [], flashAt: 0, done: false, over: false, gen, running: false };
}

/** The piece locked into the well; full rows cleared; the next piece in, or over if it cannot enter. */
function lock(g: TetrisGame, roll: () => number, nowMs: number): TetrisGame {
  const p = g.piece!;
  const cells = [...g.cells];
  for (const [x, y] of blocks(p)) if (y >= 0) cells[y * g.cols + x] = p.kind + 1;
  const full: number[] = [];
  for (let y = 0; y < g.rows; y++) if (Array.from({ length: g.cols }, (_, x) => cells[y * g.cols + x]!).every((v) => v > 0)) full.push(y);
  let out = cells;
  if (full.length) {
    const kept: number[][] = [];
    for (let y = 0; y < g.rows; y++) if (!full.includes(y)) kept.push(cells.slice(y * g.cols, (y + 1) * g.cols));
    while (kept.length < g.rows) kept.unshift(Array.from({ length: g.cols }, () => 0));
    out = kept.flat();
  }
  const lines = g.lines + full.length;
  const done = lines >= g.goal;
  const spawned = g.spawned + 1;
  const next = spawn(g, g.nextKind);
  const over = !done && !fits({ cols: g.cols, rows: g.rows, cells: out }, next);
  return { ...g, cells: out, piece: done || over ? null : next, nextKind: kindFor(spawned + 1, roll), spawned, lines, flash: full, flashAt: full.length ? nowMs : g.flashAt, done, over, running: !done && !over };
}

/** One tick of gravity: the piece falls a row, or locks. */
export function tetrisTick(g: TetrisGame, roll: () => number, nowMs: number): TetrisGame {
  if (g.done || g.over || !g.piece) return g;
  const down = { ...g.piece, y: g.piece.y + 1 };
  return fits(g, down) ? { ...g, piece: down } : lock(g, roll, nowMs);
}

/** A key: left / right a column, rotate (with a kick), down a row, drop to the floor and lock. */
export function tetrisKey(g: TetrisGame, key: TetrisKey, roll: () => number, nowMs: number): TetrisGame {
  if (g.done || g.over || !g.piece) return g;
  const p = g.piece;
  if (key === "left" || key === "right") {
    const moved = { ...p, x: p.x + (key === "left" ? -1 : 1) };
    return fits(g, moved) ? { ...g, piece: moved } : g;
  }
  if (key === "rotate") {
    const rot = (p.rot + 1) % 4;
    for (const dx of [0, -1, 1, -2, 2]) { const turned = { ...p, rot, x: p.x + dx }; if (fits(g, turned)) return { ...g, piece: turned }; }
    return g;
  }
  if (key === "down") return tetrisTick(g, roll, nowMs);
  let fall = p;
  while (fits(g, { ...fall, y: fall.y + 1 })) fall = { ...fall, y: fall.y + 1 };
  return lock({ ...g, piece: fall }, roll, nowMs);
}

/** The solved game (dev / Kuro): the week staffed. */
export const tetrisSolve = (g: TetrisGame): TetrisGame => ({ ...g, piece: null, lines: g.goal, done: true, over: false, running: false });

export const tetrisApproving = (g: Pick<TetrisGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < TETRIS_DONE_MS;
export const tetrisRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:tetris:${attempt}`);

// ——— the screen ———

/** The shift a piece kind stands for: the three night shifts take turns; ΥΠΝΟΣ is its own. */
export const shiftOf = (kind: number): number => (kind === YPNOS ? 3 : kind % 3);

export function tetrisStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly tetris: TetrisGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: TetrisGame | null = session.tetris?.key === task.id ? session.tetris : null;
  const done = approved && (!g || tetrisApproving(g, nowMs) || g.done);
  const live = new Map<number, number>();
  if (g?.piece) for (const [x, y] of blocks(g.piece)) if (y >= 0) live.set(y * g.cols + x, g.piece.kind + 1);
  const flashing = g && nowMs - g.flashAt < TETRIS_FLASH_MS ? new Set(g.flash) : new Set<number>();
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const v = g ? (g.cells[i] || live.get(i) || 0) : 0;
    const y = Math.floor(i / game.cols);
    return html`<i class="${cls("tt-px", v > 0 && "on", v > 0 && `s${shiftOf(v - 1)}`, v === YPNOS + 1 && "y", live.has(i) && "live", flashing.has(y) && "clear")}"></i>`;
  });
  const days = (S("tetris.stage.days") || "一,二,三,四,五,六,日").split(",").slice(0, game.cols).map((d) => html`<b>${d}</b>`);
  const next = g && !g.done && !g.over ? PIECES[g.nextKind]!.rots[0]!.map(([x, y]) => html`<i class="${cls("tt-px", "on", `s${shiftOf(g.nextKind)}`, g.nextKind === YPNOS && "y")}" style="grid-column:${String(x + 1)};grid-row:${String(y + 1)}"></i>`) : null;
  const side = html`<aside class="tt-side"><span class="tt-h">${S("tetris.stage.next")}</span><div class="tt-next">${next}</div><span class="tt-h">${S("tetris.stage.lines")}</span><span class="tt-n">${String(g?.lines ?? 0)}<small>/${String(game.goal)}</small></span></aside>`;
  const well = html`<div class="tt-gb"><div class="tt-well" style="--cols:${String(game.cols)};--rows:${String(game.rows)}"><div class="tt-days">${days}</div><div class="tt-grid">${cells}</div></div>${side}</div>`;
  // the shifts the pieces stand for, as the form filled them: the pattern of each shift beside its row
  const legend = board.slots.map((slot, i) => html`<li class="${cls("tt-item", i === 3 && "y")}"><i class="${cls("tt-px", "on", `s${String(Math.min(i, 3))}`, i === 3 && "y")}"></i><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const pad = (["left", "rotate", "right", "down", "drop"] as const).map((k) => html`<button type="button" class="${cls("tt-key", k)}" data-action="tetris-key" data-k="${k}" aria-label="${k}">${k === "left" ? "◀" : k === "right" ? "▶" : k === "rotate" ? "↻" : k === "down" ? "▼" : "⤓"}</button>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("tetris.stage.won")}</span><p class="pp-flowline">${S("tetris.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="tetris-start">${S("tetris.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("tetris.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="tetris-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="tetris-start">${S("tetris.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl tt-ctl">${g.running ? html`<div class="tt-pad">${pad}</div>` : html`<button type="button" class="mn-mode" data-action="tetris-resume">${S("tetris.stage.resume")}</button>`}<span class="sn-hint">${S("tetris.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="tetris-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn tt", done && "done", g?.over && "lost")}" data-screen="tetris">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("tetris.stage.kick")}</span><h2>${S("tetris.stage.title")}</h2><span class="mn-sub">${S("tetris.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("tetris.stage.notes")}</span><ul class="tt-legend">${legend}</ul></aside>
    <div class="mn-month tt-main">${well}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
