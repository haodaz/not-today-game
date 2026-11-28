// Klotski (game-swaps, author 2026-11-16: 「17换，最后让出来的地方，要通过一根触手」): day 17's 回电话 as
// 华容道. The four callers are blocks on a 4 × 5 board with the nameless big block and four small
// ones; the door is under the bottom row's middle two cells. The block pushed out through it is the
// one you call back: its card takes the form's `slot`, and the form is approved. Then the door stays
// open and a tentacle comes in through it and lies across the board. 退一步 takes a push back, 重排
// starts over (a fail). Pure engine + view; the actions keep the board in the session.
import { KLOTSKI_COLS, KLOTSKI_ROWS, type BoardGame, type Task, type TaskBoard } from "@state/days/tasks";
import type { BoardState, BoardVerdict } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { byCount, capAssisted, type GameTally } from "./tally";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "klotski" }>;
export type KlotskiDir = "up" | "down" | "left" | "right";

/** One block: its letter, its top-left cell, its size in cells. */
export interface KBlock {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface KlotskiGame {
  readonly key: string;
  readonly blocks: readonly KBlock[];
  /** The block picked to push (a letter), or null. */
  readonly pick: string | null;
  readonly moves: number;
  /** Earlier positions, for 退一步 (the last first). */
  readonly history: readonly (readonly KBlock[])[];
  /** The block that went out through the door, and when. */
  readonly out: string | null;
  readonly outAt: number | null;
  /** The nameless big block was clicked at least once. */
  readonly nameless: boolean;
  readonly done: boolean;
  readonly approvedAt?: number;
}

/** The block's slide out through the door, then the tentacle comes in. */
export const KLOTSKI_SLIDE_MS = 900;
/** The approval moment holds the stage this long before the form returns. */
export const KLOTSKI_DONE_MS = 4200;
/** The door: under the bottom row, these two columns (0-based). */
export const DOOR_X = 1;
const HISTORY = 300;

/** The blocks of a level, in reading order of their top-left cells. */
export function parseKlotski(level: readonly string[]): KBlock[] {
  const at = new Map<string, { x0: number; y0: number; x1: number; y1: number }>();
  level.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === ".") return;
    const b = at.get(ch);
    at.set(ch, b ? { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) } : { x0: x, y0: y, x1: x, y1: y });
  }));
  return [...at.entries()].map(([id, b]) => ({ id, x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })).sort((a, b) => a.y - b.y || a.x - b.x);
}

export function klotskiStart(key: string, game: Game): KlotskiGame {
  return { key, blocks: parseKlotski(game.level), pick: null, moves: 0, history: [], out: null, outAt: null, nameless: false, done: false };
}

/** A click on a block: it is picked (again: unpicked). The big block is nameless (the sub-line says so). */
export function klotskiPick(g: KlotskiGame, id: string): KlotskiGame {
  if (g.done || !g.blocks.some((b) => b.id === id)) return g;
  return { ...g, pick: g.pick === id ? null : id, nameless: g.nameless || id === "N" };
}

const overlaps = (a: KBlock, b: KBlock): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** A 2-wide block standing on the bottom row over the door. */
const atDoor = (b: KBlock): boolean => b.w === 2 && b.x === DOOR_X && b.y + b.h === KLOTSKI_ROWS;

/**
 * A push of the picked block one cell. Into a wall or another block: no move (the same game). A
 * 2-wide block over the door pushed down goes out: the game is done, `out` names it.
 */
export function klotskiPush(g: KlotskiGame, dir: KlotskiDir, nowMs: number, id: string | null = g.pick): KlotskiGame {
  if (g.done || id === null) return g;
  const b = g.blocks.find((x) => x.id === id);
  if (!b) return g;
  const history = [g.blocks, ...g.history].slice(0, HISTORY);
  if (dir === "down" && atDoor(b)) {
    return { ...g, pick: id, blocks: g.blocks.filter((x) => x.id !== id), moves: g.moves + 1, history, out: id, outAt: nowMs, done: true };
  }
  const nb: KBlock = { ...b, x: b.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0), y: b.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0) };
  if (nb.x < 0 || nb.y < 0 || nb.x + nb.w > KLOTSKI_COLS || nb.y + nb.h > KLOTSKI_ROWS) return g;
  if (g.blocks.some((x) => x.id !== id && overlaps(x, nb))) return g;
  return { ...g, pick: id, blocks: g.blocks.map((x) => (x.id === id ? nb : x)), moves: g.moves + 1, history };
}

/** 退一步: the last push back (it counts as a move, as sokoban's does). Not after the exit. */
export function klotskiUndo(g: KlotskiGame): KlotskiGame {
  const last = g.history[0];
  if (!last || g.done) return g;
  return { ...g, blocks: last, history: g.history.slice(1), moves: g.moves + 1 };
}

/** Dev / tests: the block `id` out at once. */
export function klotskiSolve(g: KlotskiGame, id: string, nowMs: number): KlotskiGame {
  return { ...g, pick: id, blocks: g.blocks.filter((x) => x.id !== id), out: id, outAt: nowMs, done: true };
}

export const klotskiApproving = (g: Pick<KlotskiGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < KLOTSKI_DONE_MS;

/** The card of the block that went out (a named block), or null. */
export const klotskiCard = (game: Game, g: Pick<KlotskiGame, "out">): string | null => (g.out !== null ? (game.blocks[g.out]?.card ?? null) : null);

/**
 * The fewest pushes that take block `id` out (a breadth-first search over block positions; the board
 * is small). Tests use it on the fixture; the game never needs it. Null when it cannot get out.
 */
export interface KlotskiStep { readonly id: string; readonly dir: KlotskiDir }
export function klotskiPath(game: Game, id: string, limit = 200_000): KlotskiStep[] | null {
  const g0 = klotskiStart("path", game);
  // blocks of the same shape and no name are interchangeable for the search's state
  const keyOf = (bs: readonly KBlock[]) => bs.map((b) => `${/^[a-z]$/.test(b.id) ? `${b.w}${b.h}` : b.id}@${b.x},${b.y}`).sort().join("|");
  const seen = new Set<string>([keyOf(g0.blocks)]);
  let layer: { g: KlotskiGame; path: KlotskiStep[] }[] = [{ g: g0, path: [] }];
  while (layer.length && seen.size < limit) {
    const next: typeof layer = [];
    for (const { g, path } of layer) {
      for (const b of g.blocks) {
        for (const dir of ["up", "down", "left", "right"] as const) {
          const n = klotskiPush(g, dir, 0, b.id);
          if (n === g) continue;
          if (n.done) {
            if (n.out === id) return [...path, { id: b.id, dir }];
            continue;
          }
          const k = keyOf(n.blocks);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ g: { ...n, history: [] }, path: [...path, { id: b.id, dir }] });
        }
      }
    }
    layer = next;
  }
  return null;
}

// ——— the screen ———

/**
 * A block's look (author 2026-11-27, #166: 「17 天那个华容道的设计非常简单」; the toy keeps its look, wood
 * and carved pieces, and day 17 is in it): a caller is a piece with its name in a red seal and a line
 * still ringing; the nameless big one has an eye carved shut that opens while it is held; the tall
 * ones are faceless figures; the small ones a single pupil each.
 */
function blockHtml(game: Game, b: KBlock, g: KlotskiGame | null, leaving: boolean): SafeHtml {
  const named = game.blocks[b.id];
  const style = `--x:${String(b.x)};--y:${String(b.y)};--w:${String(b.w)};--h:${String(b.h)}`;
  const kind = b.id === "N" ? "big" : named ? "named" : b.h > 1 || b.w > 1 ? "tall" : "small";
  const face = named
    ? html`<span class="kl-seal"><span class="kl-name">${named.label}</span></span><i class="kl-ring" aria-hidden="true"></i>`
    : kind === "big" ? html`<i class="kl-eye" aria-hidden="true"><b></b></i>`
    : kind === "tall" ? html`<i class="kl-fig" aria-hidden="true"></i>`
    : html`<i class="kl-pupil" aria-hidden="true"></i>`;
  return html`<button type="button" class="${cls("kl-block", kind, g?.pick === b.id && "picked", leaving && "leaving")}" data-action="klotski-pick" data-block="${b.id}" style="${style}"${g && !g.done ? null : html` disabled`}>${face}</button>`;
}

/** #166: how far the thing at the door has come, 0..1, by the pushes made (drawn only). */
export const KLOTSKI_ROT_MOVES = 40;
export const klotskiRot = (moves: number): number => Math.min(1, Math.max(0, moves / KLOTSKI_ROT_MOVES));

export function klotskiStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly klotski: KlotskiGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: KlotskiGame | null = session.klotski?.key === task.id ? session.klotski : null;
  const lv = g ?? klotskiStart(task.id, game);
  const outBlock = g?.out ? parseKlotski(game.level).find((b) => b.id === g.out) ?? null : null;
  const sliding = !!g?.out && g.outAt !== null && nowMs - g.outAt < KLOTSKI_SLIDE_MS;
  const tentacle = !!g?.out && g.outAt !== null && nowMs - g.outAt >= KLOTSKI_SLIDE_MS;
  // the block on its way out is drawn at the door, sliding down; after it, the door stays open
  const leaving = sliding && outBlock ? blockHtml(game, { ...outBlock, x: DOOR_X, y: KLOTSKI_ROWS - outBlock.h }, g, true) : null;
  const blocks = lv.blocks.map((b) => blockHtml(game, b, g, false));
  // the more pushes, the more of it shows at the door and the redder the tray's grain (drawn only)
  const rot = klotskiRot(g?.moves ?? 0).toFixed(2);
  const field = html`<div class="${cls("kl-board", !g && "blank", g?.out && "open")}" style="--cols:${String(KLOTSKI_COLS)};--rows:${String(KLOTSKI_ROWS)};--rot:${rot}"><i class="kl-veins" aria-hidden="true"></i>${blocks}${leaving}<i class="kl-door" aria-hidden="true"></i>${tentacle ? html`<i class="kl-tentacle" aria-hidden="true"></i>` : html`<i class="kl-peek" aria-hidden="true"></i>`}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="klotski-push" data-dir="${d}" aria-label="${d}">${d === "up" ? "▲" : d === "left" ? "◀" : d === "down" ? "▼" : "▶"}</button>`);
  const name = g?.out ? (game.blocks[g.out]?.label ?? "") : "";
  const nameless = g?.nameless ? html`<p class="kl-nameless">${S("klotski.stage.nameless")}</p>` : null;
  let foot: SafeHtml;
  if (g?.out) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("klotski.stage.won", { name })}</span><p class="pp-flowline">${S("klotski.stage.left")}</p>${nameless}</div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="klotski-start">${S("klotski.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("klotski.stage.moves", { n: String(g.moves) })}</span><div class="sk-pad sn-pad">${pad}</div><button type="button" class="mn-mode" data-action="klotski-undo"${g.history.length ? null : html` disabled`}>${S("klotski.stage.undo")}</button><button type="button" class="mn-mode" data-action="klotski-start">${S("klotski.stage.reset")}</button><span class="sn-hint">${S("klotski.stage.keys")}</span>${nameless}</div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="klotski-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn kl", g?.out && "done", tentacle && "haunted")}" data-screen="klotski">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("klotski.stage.kick")}</span><h2>${S("klotski.stage.title")}</h2><span class="mn-sub">${S("klotski.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("klotski.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month kl-main">${field}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}

/**
 * game-swaps §1: the block out is the one the form wants (`answer`) → by the pushes (≤ 30 perfect,
 * ≤ 60 flawed, more wrong), at best flawed with help; another block out, or none yet → wrong.
 */
export function grade(g: Pick<KlotskiGame, "out" | "moves">, game: Game, answer: string | undefined, t: GameTally | null = null): BoardVerdict {
  const card = klotskiCard(game, g);
  if (card === null || card !== answer) return "wrong";
  return capAssisted(byCount(g.moves, 30, 60), t);
}
