// Match-3 (author 2026-11-13: 「三消」 for 投资人材料 2/3「分身」, day 5): once the form is filled, Vivi's
// page itself is a board of her claims, each multiplied — her 分身. Swap two neighbours; three of the
// same in a row or column vanish, the rest fall, new ones come down. Clear enough of them within the
// moves and the real page is what is left: the board is approved (the chain's `approve` step). Out
// of moves: lost — 重来, or 让克总帮忙. Classic rules (Zoo Keeper / Bejeweled), seeded by run and task.
// Pure engine + view; the actions keep the board in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "match3" }>;

export interface Match3Grid {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly kinds: number;
  readonly cells: readonly number[];
  readonly pick: number | null;
  readonly moves: number;
  readonly cleared: number;
  readonly goal: number;
  readonly won: boolean;
  readonly over: boolean;
  /** Cells just filled from above (the view pops them). */
  readonly fresh: readonly number[];
  readonly approvedAt?: number;
}

const at = (g: Pick<Match3Grid, "cols" | "cells">, x: number, y: number): number => g.cells[y * g.cols + x]!;

/** Every cell that is part of a run of three or more, in a row or a column. */
export function matches(g: Pick<Match3Grid, "cols" | "rows" | "cells">): Set<number> {
  const out = new Set<number>();
  for (let y = 0; y < g.rows; y++) {
    let run = 1;
    for (let x = 1; x <= g.cols; x++) {
      if (x < g.cols && at(g, x, y) >= 0 && at(g, x, y) === at(g, x - 1, y)) run++;
      else { if (run >= 3) for (let k = x - run; k < x; k++) out.add(y * g.cols + k); run = 1; }
    }
  }
  for (let x = 0; x < g.cols; x++) {
    let run = 1;
    for (let y = 1; y <= g.rows; y++) {
      if (y < g.rows && at(g, x, y) >= 0 && at(g, x, y) === at(g, x, y - 1)) run++;
      else { if (run >= 3) for (let k = y - run; k < y; k++) out.add(k * g.cols + x); run = 1; }
    }
  }
  return out;
}

/** A fresh board with no match on it. */
export function match3Start(key: string, game: Game, roll: () => number): Match3Grid {
  const cells: number[] = [];
  for (let y = 0; y < game.rows; y++) for (let x = 0; x < game.cols; x++) {
    let k: number;
    do k = Math.floor(roll() * game.kinds);
    while ((x >= 2 && cells[y * game.cols + x - 1] === k && cells[y * game.cols + x - 2] === k) || (y >= 2 && cells[(y - 1) * game.cols + x] === k && cells[(y - 2) * game.cols + x] === k));
    cells.push(k);
  }
  return { key, cols: game.cols, rows: game.rows, kinds: game.kinds, cells, pick: null, moves: game.moves, cleared: 0, goal: game.goal, won: false, over: false, fresh: [] };
}

/** Clear the matches, let the rest fall, fill from the top; repeat while it matches. */
export function settle(g: Match3Grid, roll: () => number): Match3Grid {
  const cells = [...g.cells];
  let cleared = g.cleared;
  const fresh = new Set<number>();
  for (let guard = 0; guard < 20; guard++) {
    const m = matches({ cols: g.cols, rows: g.rows, cells });
    if (m.size === 0) break;
    cleared += m.size;
    for (const i of m) cells[i] = -1;
    for (let x = 0; x < g.cols; x++) {
      let write = g.rows - 1;
      for (let y = g.rows - 1; y >= 0; y--) {
        const v = cells[y * g.cols + x]!;
        if (v >= 0) { cells[write * g.cols + x] = v; if (write !== y) fresh.add(write * g.cols + x); write--; }
      }
      for (let y = write; y >= 0; y--) { cells[y * g.cols + x] = Math.floor(roll() * g.kinds); fresh.add(y * g.cols + x); }
    }
  }
  const won = cleared >= g.goal;
  return { ...g, cells, cleared, won, over: !won && g.moves <= 0, fresh: [...fresh] };
}

const adjacent = (g: Pick<Match3Grid, "cols">, a: number, b: number): boolean => {
  const ax = a % g.cols, ay = Math.floor(a / g.cols), bx = b % g.cols, by = Math.floor(b / g.cols);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
};

/** A tap: the first picks, the second swaps with it if next to it (a swap that matches nothing swaps back and costs nothing). */
export function match3Tap(g: Match3Grid, i: number, roll: () => number): Match3Grid {
  if (g.won || g.over || i < 0 || i >= g.cells.length) return g;
  if (g.pick === null || g.pick === i) return { ...g, pick: g.pick === i ? null : i, fresh: [] };
  if (!adjacent(g, g.pick, i)) return { ...g, pick: i, fresh: [] };
  const cells = [...g.cells];
  [cells[g.pick], cells[i]] = [cells[i]!, cells[g.pick]!];
  const swapped = { ...g, cells, pick: null, fresh: [] };
  if (matches(swapped).size === 0) return { ...g, pick: null, fresh: [] };
  return settle({ ...swapped, moves: g.moves - 1 }, roll);
}

export const MATCH3_DONE_MS = 1800;
export const match3Approving = (g: Pick<Match3Grid, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < MATCH3_DONE_MS;
export const match3Roll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:match3:${attempt}`);

// ——— the screen ———

/** Her claims as glyphs: the shapes are drawn in code, one per kind. */
const GLYPHS: readonly SafeHtml[] = [
  html`<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18.5,22 12,17.5 5.5,22 7.5,14.5 2,9.5 9,9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="13,2 4,14 11,14 9,22 20,9 13,9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><path d="M12 21 4 13a4.5 4.5 0 0 1 6.4-6.4L12 8.2l1.6-1.6A4.5 4.5 0 0 1 20 13z"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12"/></svg>`,
  html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`,
];

export function match3Stage(task: Task, board: TaskBoard, s: BoardState, session: { readonly match3: Match3Grid | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: Match3Grid | null = session.match3?.key === task.id ? session.match3 : null;
  const done = approved && (!g || match3Approving(g, nowMs) || g.won);
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const fresh = new Set(g?.fresh ?? []);
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const k = g?.cells[i] ?? -1;
    const live = g !== null && !g.won && !g.over;
    const inner = k >= 0 ? html`<span class="${cls("m3-glyph", `k${k}`)}">${GLYPHS[k % GLYPHS.length]}</span>` : null;
    return live
      ? html`<button type="button" class="${cls("m3-cell", g.pick === i && "sel", fresh.has(i) && "new")}" data-action="match3-tap" data-i="${String(i)}">${inner}</button>`
      : html`<div class="${cls("m3-cell", !g && "blank")}">${inner}</div>`;
  });
  const grid = html`<div class="m3-grid" style="--cols:${String(game.cols)}">${cells}</div>`;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("match3.stage.won")}</span><p class="pp-flowline">${S("match3.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="match3-start">${S("match3.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("match3.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="match3-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="match3-start">${S("match3.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl"><span class="mn-left">${S("match3.stage.count", { n: String(g.cleared), goal: String(g.goal) })}</span><span class="mn-left">${S("match3.stage.moves", { n: String(g.moves) })}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="match3-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn m3", done && "done", g?.over && "lost")}" data-screen="match3">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("match3.stage.kick")}</span><h2>${S("match3.stage.title")}</h2><span class="mn-sub">${S("match3.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("match3.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month m3-main">${grid}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
