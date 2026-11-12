// Link-link (author 2026-11-13: 「连连看」 for 投资人材料 1/3「意识」, day 4): once the form is filled,
// 老王's page is a board of his own sayings and their evidence, each tile twice. Tap two of the
// same that a line can join with at most two bends through empty cells (the classic rule), and both
// vanish. Clear the whole page — one page is one board — and the board is approved (the chain's
// `approve` step). No losing: when no pair can be joined the tiles reshuffle. The one surprise: the
// first pair you get wrong slowly turns back on its own — the tiles have noticed you (once a board).
// Pure engine + view; the actions keep the board in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "link" }>;

/** A point on the padded board: x in -1..cols, y in -1..rows (the ring outside is always empty). */
export interface Pt { readonly x: number; readonly y: number }

export interface LinkGrid {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly kinds: number;
  /** Tile kind per cell, -1 once cleared. */
  readonly cells: readonly number[];
  readonly pick: number | null;
  readonly left: number;
  readonly done: boolean;
  readonly shuffles: number;
  /** The last joined pair's line (corner points on the padded board) and when it was drawn. */
  readonly path: readonly Pt[] | null;
  readonly pathAt: number;
  /** The pair that turned back on its own (the surprise, once a board), or null. */
  readonly aware: readonly [number, number] | null;
  readonly awareUsed: boolean;
  readonly approvedAt?: number;
}

const at = (g: Pick<LinkGrid, "cols" | "rows" | "cells">, x: number, y: number): number =>
  x < 0 || y < 0 || x >= g.cols || y >= g.rows ? -1 : g.cells[y * g.cols + x]!;
const empty = (g: Pick<LinkGrid, "cols" | "rows" | "cells">, x: number, y: number): boolean => at(g, x, y) < 0;

/** Every cell strictly between two points on one row or column is empty (the points themselves are not checked). */
function clear(g: Pick<LinkGrid, "cols" | "rows" | "cells">, a: Pt, b: Pt): boolean {
  if (a.x === b.x) { for (let y = Math.min(a.y, b.y) + 1; y < Math.max(a.y, b.y); y++) if (!empty(g, a.x, y)) return false; return true; }
  if (a.y === b.y) { for (let x = Math.min(a.x, b.x) + 1; x < Math.max(a.x, b.x); x++) if (!empty(g, x, a.y)) return false; return true; }
  return false;
}

/** The line joining two tiles with at most two bends, as its corner points, or null. */
export function linkPath(g: Pick<LinkGrid, "cols" | "rows" | "cells">, i: number, j: number): readonly Pt[] | null {
  const a: Pt = { x: i % g.cols, y: Math.floor(i / g.cols) }, b: Pt = { x: j % g.cols, y: Math.floor(j / g.cols) };
  if ((a.x === b.x || a.y === b.y) && clear(g, a, b)) return [a, b];
  for (const c of [{ x: a.x, y: b.y }, { x: b.x, y: a.y }]) if (empty(g, c.x, c.y) && clear(g, a, c) && clear(g, c, b)) return [a, c, b];
  for (let x = -1; x <= g.cols; x++) {
    const c1: Pt = { x, y: a.y }, c2: Pt = { x, y: b.y };
    if (x === a.x || x === b.x) continue;
    if (!empty(g, c1.x, c1.y) || !empty(g, c2.x, c2.y)) continue;
    if (clear(g, a, c1) && clear(g, c1, c2) && clear(g, c2, b)) return [a, c1, c2, b];
  }
  for (let y = -1; y <= g.rows; y++) {
    const c1: Pt = { x: a.x, y }, c2: Pt = { x: b.x, y };
    if (y === a.y || y === b.y) continue;
    if (!empty(g, c1.x, c1.y) || !empty(g, c2.x, c2.y)) continue;
    if (clear(g, a, c1) && clear(g, c1, c2) && clear(g, c2, b)) return [a, c1, c2, b];
  }
  return null;
}

/** Some pair of the same kind can still be joined. */
export function hasMove(g: Pick<LinkGrid, "cols" | "rows" | "cells">): boolean {
  const n = g.cells.length;
  for (let i = 0; i < n; i++) {
    if (g.cells[i]! < 0) continue;
    for (let j = i + 1; j < n; j++) if (g.cells[j] === g.cells[i] && linkPath(g, i, j)) return true;
  }
  return false;
}

/** The live tiles dealt again (their kinds shuffled among the cells still holding a tile), until a move exists. */
export function linkShuffle(g: LinkGrid, roll: () => number): LinkGrid {
  const live = g.cells.map((k, i) => (k >= 0 ? i : -1)).filter((i) => i >= 0);
  let cells = [...g.cells];
  for (let guard = 0; guard < 50; guard++) {
    const kinds = live.map((i) => g.cells[i]!);
    for (let k = kinds.length - 1; k > 0; k--) { const r = Math.floor(roll() * (k + 1)); [kinds[k], kinds[r]] = [kinds[r]!, kinds[k]!]; }
    cells = [...g.cells];
    live.forEach((i, n) => { cells[i] = kinds[n]!; });
    if (hasMove({ cols: g.cols, rows: g.rows, cells })) break;
  }
  return { ...g, cells, pick: null, shuffles: g.shuffles + 1, path: null, aware: null };
}

/** A fresh board: every kind in pairs, dealt at random, with a move on it. */
export function linkStart(key: string, game: Game, roll: () => number): LinkGrid {
  const n = game.cols * game.rows;
  const kinds: number[] = [];
  for (let p = 0; p < n / 2; p++) { kinds.push(p % game.kinds, p % game.kinds); }
  const base: LinkGrid = { key, cols: game.cols, rows: game.rows, kinds: game.kinds, cells: kinds, pick: null, left: n / 2, done: false, shuffles: -1, path: null, pathAt: 0, aware: null, awareUsed: false };
  return linkShuffle(base, roll);
}

/** A tap: the first picks; the second joins (same kind, a line between) or, the first time it fails, wakes the pair. */
export function linkTap(g: LinkGrid, i: number, nowMs: number, roll: () => number): LinkGrid {
  if (g.done || i < 0 || i >= g.cells.length || g.cells[i]! < 0) return g;
  if (g.pick === null || g.pick === i) return { ...g, pick: g.pick === i ? null : i, aware: null };
  const path = g.cells[g.pick] === g.cells[i] ? linkPath(g, g.pick, i) : null;
  if (!path) {
    if (!g.awareUsed) return { ...g, pick: null, aware: [g.pick, i], awareUsed: true };
    return { ...g, pick: i, aware: null };
  }
  const cells = [...g.cells];
  cells[g.pick] = -1; cells[i] = -1;
  const left = g.left - 1;
  let next: LinkGrid = { ...g, cells, pick: null, left, done: left === 0, path, pathAt: nowMs, aware: null };
  if (!next.done && !hasMove(next)) next = { ...linkShuffle(next, roll), path, pathAt: nowMs };
  return next;
}

/** The solved board (dev / Kuro): everything joined. */
export const linkSolve = (g: LinkGrid): LinkGrid => ({ ...g, cells: g.cells.map(() => -1), pick: null, left: 0, done: true, path: null, aware: null });

export const LINK_DONE_MS = 1800;
export const LINK_PATH_MS = 650;
export const linkApproving = (g: Pick<LinkGrid, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < LINK_DONE_MS;
export const linkRoll = (runId: string, key: string, attempt: number): (() => number) => dice(`${runId}:${key}:link:${attempt}`);

// ——— the screen ———

/** His sayings as glyphs, one per kind: drawn in code, the same glyph on both tiles of a pair. */
const GLYPHS: readonly SafeHtml[] = [
  html`<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18.5,22 12,17.5 5.5,22 7.5,14.5 2,9.5 9,9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="13,2 4,14 11,14 9,22 20,9 13,9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><path d="M12 21 4 13a4.5 4.5 0 0 1 6.4-6.4L12 8.2l1.6-1.6A4.5 4.5 0 0 1 20 13z"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="12,2 22,12 12,22 2,12"/></svg>`,
  html`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>`,
  html`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="12,3 21,20 3,20"/></svg>`,
  html`<svg viewBox="0 0 24 24"><polygon points="12,2 20.7,7 20.7,17 12,22 3.3,17 3.3,7"/></svg>`,
  html`<svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 1 5 5c0 3-5 8-5 8s-5-5-5-8a5 5 0 0 1 5-5zm-6 17h12v3H6z"/></svg>`,
  html`<svg viewBox="0 0 24 24"><path d="M4 4h16v4H4zm0 6h16v4H4zm0 6h16v4H4z"/></svg>`,
  html`<svg viewBox="0 0 24 24"><path d="M12 2 2 12l10 10 10-10zm0 6 4 4-4 4-4-4z"/></svg>`,
  html`<svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="4"/><circle cx="17" cy="7" r="4"/><circle cx="7" cy="17" r="4"/><circle cx="17" cy="17" r="4"/></svg>`,
];

/** The cell's centre on the padded board, in cell units (the ring outside is one cell wide). */
const centre = (p: Pt): string => `${String(p.x + 1.5)},${String(p.y + 1.5)}`;

export function linkStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly link: LinkGrid | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: LinkGrid | null = session.link?.key === task.id ? session.link : null;
  const done = approved && (!g || linkApproving(g, nowMs) || g.done);
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const aware = new Set(g?.aware ?? []);
  const cells = Array.from({ length: game.cols * game.rows }, (_, i) => {
    const k = g?.cells[i] ?? -1;
    const live = g !== null && !g.done && k >= 0;
    const inner = k >= 0 ? html`<span class="${cls("lk-glyph", `k${k}`)}">${GLYPHS[k % GLYPHS.length]}</span>` : null;
    return live
      ? html`<button type="button" class="${cls("lk-cell", g.pick === i && "sel", aware.has(i) && "aware")}" data-action="link-tap" data-i="${String(i)}">${inner}</button>`
      : html`<div class="${cls("lk-cell", "gone", !g && "blank")}">${inner}</div>`;
  });
  const line = g?.path && nowMs - g.pathAt < LINK_PATH_MS
    ? html`<svg class="lk-line" viewBox="0 0 ${String(game.cols + 2)} ${String(game.rows + 2)}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${g.path.map(centre).join(" ")}"/></svg>`
    : null;
  const grid = html`<div class="lk-board" style="--cols:${String(game.cols)};--rows:${String(game.rows)}"><div class="lk-grid">${cells}</div>${line}</div>`;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("link.stage.won")}</span><p class="pp-flowline">${S("link.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="link-start">${S("link.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl"><span class="mn-left">${S("link.stage.count", { n: String(g.left) })}</span>${g.aware ? html`<span class="lk-aware">${S("link.stage.aware")}</span>` : null}<button type="button" class="mn-mode" data-action="link-shuffle">${S("link.stage.shuffle")}</button></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="link-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn lk", done && "done")}" data-screen="link">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("link.stage.kick")}</span><h2>${S("link.stage.title")}</h2><span class="mn-sub">${S("link.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("link.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month lk-main">${grid}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
