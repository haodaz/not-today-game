// Sokoban (author 2026-11-13: 「推箱子」 for 明天的会：座位表, day 9): once the seating form is filled,
// the meeting room is a warehouse floor — 仓库番 — and the chairs have to be pushed onto the seat
// marks: four circles and one triangle. A chair against a wall or another chair is stuck; 退一步
// takes a push back, 重排 starts over. Every chair on a mark = the form approved (the chain's
// `approve` step). There is no losing, only getting stuck. The one surprise: when the fourth chair
// reaches its mark, someone is already sitting on it — a shadow, the guest whose name is not said.
// Pure engine + view; the actions keep the floor in the session.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "sokoban" }>;
export type Dir = "up" | "down" | "left" | "right";

export interface SokobanGame {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly walls: readonly boolean[];
  /** The seat marks, in the level's reading order; the last one is the triangle. */
  readonly targets: readonly number[];
  readonly boxes: readonly number[];
  readonly player: number;
  readonly moves: number;
  readonly pushes: number;
  /** Earlier positions, for 退一步 (the last first). */
  readonly history: readonly { readonly boxes: readonly number[]; readonly player: number }[];
  /** The chair the shadow sits on (the fourth to reach a mark), or null. */
  readonly shadow: number | null;
  readonly done: boolean;
  readonly approvedAt?: number;
}

export const SOKOBAN_DONE_MS = 2200;
export const SHADOW_AT = 4;
const HISTORY = 300;

/** The level from its rows: # wall, . mark, $ chair, @ you, * chair on a mark, + you on a mark. */
export function parseLevel(rows: readonly string[]): { cols: number; rows: number; walls: boolean[]; targets: number[]; boxes: number[]; player: number } {
  const cols = Math.max(...rows.map((r) => r.length));
  const walls: boolean[] = [];
  const targets: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  rows.forEach((r, y) => {
    for (let x = 0; x < cols; x++) {
      const ch = r[x] ?? "#";
      const i = y * cols + x;
      walls.push(ch === "#");
      if (ch === "." || ch === "*" || ch === "+") targets.push(i);
      if (ch === "$" || ch === "*") boxes.push(i);
      if (ch === "@" || ch === "+") player = i;
    }
  });
  return { cols, rows: rows.length, walls, targets, boxes, player };
}

export function sokobanStart(key: string, game: Game): SokobanGame {
  const lv = parseLevel(game.level);
  return { key, ...lv, moves: 0, pushes: 0, history: [], shadow: null, done: false };
}

const step = (g: Pick<SokobanGame, "cols" | "rows">, i: number, dir: Dir): number | null => {
  const x = i % g.cols, y = Math.floor(i / g.cols);
  const nx = dir === "left" ? x - 1 : dir === "right" ? x + 1 : x;
  const ny = dir === "up" ? y - 1 : dir === "down" ? y + 1 : y;
  return nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows ? null : ny * g.cols + nx;
};

export const onMarks = (g: Pick<SokobanGame, "targets" | "boxes">): number => g.boxes.filter((b) => g.targets.includes(b)).length;

/** A step: into a free cell, or a push when a chair is there and the cell past it is free. Stuck does nothing. */
export function sokobanMove(g: SokobanGame, dir: Dir): SokobanGame {
  if (g.done) return g;
  const to = step(g, g.player, dir);
  if (to === null || g.walls[to]) return g;
  const bi = g.boxes.indexOf(to);
  let boxes = g.boxes;
  let pushes = g.pushes;
  if (bi >= 0) {
    const past = step(g, to, dir);
    if (past === null || g.walls[past] || g.boxes.includes(past)) return g;
    boxes = g.boxes.map((b, k) => (k === bi ? past : b));
    pushes++;
  }
  const history = [{ boxes: g.boxes, player: g.player }, ...g.history].slice(0, HISTORY);
  const next: SokobanGame = { ...g, boxes, player: to, moves: g.moves + 1, pushes, history };
  // the fourth chair to reach a mark: someone is already on it
  const before = onMarks(g), after = onMarks(next);
  const shadow = next.shadow === null && bi >= 0 && before < SHADOW_AT && after >= SHADOW_AT ? boxes[bi]! : next.shadow;
  const done = after === g.targets.length;
  return { ...next, shadow, done };
}

export const sokobanUndo = (g: SokobanGame): SokobanGame => {
  const last = g.history[0];
  if (!last || g.done) return g;
  return { ...g, boxes: last.boxes, player: last.player, history: g.history.slice(1), moves: g.moves + 1 };
};

/** The solved floor (dev / Kuro): every chair on a mark. */
export const sokobanSolve = (g: SokobanGame): SokobanGame => ({ ...g, boxes: [...g.targets], done: true, shadow: g.shadow ?? g.targets[SHADOW_AT - 1] ?? null });

export const sokobanApproving = (g: Pick<SokobanGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < SOKOBAN_DONE_MS;

/**
 * Whether the level can be solved at all (a breadth-first search over player-and-chairs states; the
 * levels are small). Tests use it on the content; the game never needs it.
 */
export function solvable(g: SokobanGame, limit = 400_000): boolean {
  const key = (s: SokobanGame): string => `${String(s.player)}|${[...s.boxes].sort((a, b) => a - b).join(",")}`;
  const seen = new Set<string>([key(g)]);
  const queue: SokobanGame[] = [{ ...g, history: [] }];
  while (queue.length && seen.size < limit) {
    const cur = queue.shift()!;
    for (const dir of ["up", "down", "left", "right"] as const) {
      const next = sokobanMove(cur, dir);
      if (next === cur) continue;
      if (next.done) return true;
      const k = key(next);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ ...next, history: [] });
    }
  }
  return false;
}

// ——— the screen ———

export function sokobanStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly sokoban: SokobanGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: SokobanGame | null = session.sokoban?.key === task.id ? session.sokoban : null;
  const done = approved && (!g || sokobanApproving(g, nowMs) || g.done);
  const lv = g ?? sokobanStart(task.id, game);
  const triangle = lv.targets[lv.targets.length - 1];
  const cells = Array.from({ length: lv.cols * lv.rows }, (_, i) => {
    const wall = lv.walls[i];
    const mark = lv.targets.includes(i);
    const box = lv.boxes.includes(i);
    const you = lv.player === i;
    return html`<i class="${cls("sk2-cell", wall && "wall", mark && (i === triangle ? "tri" : "mark"), box && "chair", box && mark && "seated", you && "you", g?.shadow === i && "shadow")}">${box ? html`<b class="sk2-chair"></b>` : null}${g?.shadow === i ? html`<img class="sk2-sil" src="/npc/sil_1.png" alt="">` : null}${you ? html`<b class="sk2-you">${S("sokoban.stage.you")}</b>` : null}</i>`;
  });
  const floor = html`<div class="${cls("sk2-floor", !g && "blank")}" style="--cols:${String(lv.cols)};--rows:${String(lv.rows)}">${cells}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="sokoban-move" data-dir="${d}" aria-label="${d}">${d === "up" ? "▲" : d === "left" ? "◀" : d === "down" ? "▼" : "▶"}</button>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("sokoban.stage.won")}</span><p class="pp-flowline">${S("sokoban.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="sokoban-start">${S("sokoban.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("sokoban.stage.count", { n: String(onMarks(g)), of: String(g.targets.length) })} · ${S("sokoban.stage.moves", { n: String(g.moves) })}</span><div class="sk-pad sn-pad">${pad}</div><button type="button" class="mn-mode" data-action="sokoban-undo"${g.history.length ? null : html` disabled`}>${S("sokoban.stage.undo")}</button><button type="button" class="mn-mode" data-action="sokoban-start">${S("sokoban.stage.again")}</button><span class="sn-hint">${S("sokoban.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="sokoban-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn sk2", done && "done", g?.shadow !== null && g?.shadow !== undefined && "haunted")}" data-screen="sokoban">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("sokoban.stage.kick")}</span><h2>${S("sokoban.stage.title")}</h2><span class="mn-sub">${S("sokoban.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("sokoban.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month sk2-main">${floor}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
