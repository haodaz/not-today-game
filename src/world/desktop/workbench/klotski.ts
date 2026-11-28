// Klotski (game-swaps 2026-11-16; klotski-door, author 2026-11-27): day 17's 回电话 as 华容道. The
// room is a 4 × 5 board full of everyone who moved in, each block a role; the small one is you. The
// door is under the bottom row's middle two cells and only you go through it: pushed down there, you
// stay where you stand, the door opens, and the tentacles come in along the way you cleared. Your card
// takes the form's `slot` and the form is approved. 退一步 takes a push back, 重排 starts over (a
// fail). Pure engine + view; the actions keep the board in the session.
import { KLOTSKI_COLS, KLOTSKI_ROWS, type BoardGame, type Task, type TaskBoard } from "@state/days/tasks";
import type { BoardState, BoardVerdict } from "@state/days/board";
import { cls, html, raw, type SafeHtml } from "@world/html";
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
  /** klotski-door R2: the one block the door takes (the player). */
  readonly exit: string;
  /** klotski-door R3: every cell the exit block stood on, in order, from the start. */
  readonly trail: readonly (readonly [number, number])[];
  /** klotski-door R5: another block was pushed down over the door (the sub-line says so) until the next move. */
  readonly blocked: boolean;
}

/** klotski-door R3: the door opens under the block; the tentacles come after this. */
export const KLOTSKI_SLIDE_MS = 700;
/** The door moment holds the stage this long before the form returns (klotski-door R3: 6000). */
export const KLOTSKI_DONE_MS = 6000;
/** The tentacles' growth: from KLOTSKI_SLIDE_MS, over this long, cell by cell. */
export const KLOTSKI_GROW_MS = 3200;
/** The three lines' delays from the door opening (door1, door2, door3). */
export const KLOTSKI_LINE_MS = [0, 2200, 4400] as const;
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
  const blocks = parseKlotski(game.level);
  const e = blocks.find((b) => b.id === game.exit);
  return { key, blocks, pick: null, moves: 0, history: [], out: null, outAt: null, nameless: false, done: false, exit: game.exit, trail: e ? [[e.x, e.y]] : [], blocked: false };
}

/** A click on a block: it is picked (again: unpicked). The big block is nameless (the sub-line says so). */
export function klotskiPick(g: KlotskiGame, id: string): KlotskiGame {
  if (g.done || !g.blocks.some((b) => b.id === id)) return g;
  return { ...g, pick: g.pick === id ? null : id, nameless: g.nameless || id === "N" };
}

const overlaps = (a: KBlock, b: KBlock): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** klotski-door R2: a block on the bottom row with all its cells over the door columns. */
const atDoor = (b: KBlock): boolean => b.y + b.h === KLOTSKI_ROWS && b.x >= DOOR_X && b.x + b.w <= DOOR_X + 2;

/**
 * A push of the picked block one cell. Into a wall or another block: no move (the same game).
 * klotski-door R2: only the exit block, over the door and pushed down, goes through: the game is
 * done and the block stays where it stands (the door opens under it). Another block over the door
 * pushed down does not move; `blocked` is set for the sub-line (no move counted).
 */
export function klotskiPush(g: KlotskiGame, dir: KlotskiDir, nowMs: number, id: string | null = g.pick): KlotskiGame {
  if (g.done || id === null) return g;
  const b = g.blocks.find((x) => x.id === id);
  if (!b) return g;
  const history = [g.blocks, ...g.history].slice(0, HISTORY);
  if (dir === "down" && b.y + b.h === KLOTSKI_ROWS) {
    if (!atDoor(b)) return g;
    if (id !== g.exit) return g.blocked && g.pick === id ? g : { ...g, pick: id, blocked: true };
    return { ...g, pick: id, moves: g.moves + 1, history, out: id, outAt: nowMs, done: true, blocked: false };
  }
  const nb: KBlock = { ...b, x: b.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0), y: b.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0) };
  if (nb.x < 0 || nb.y < 0 || nb.x + nb.w > KLOTSKI_COLS || nb.y + nb.h > KLOTSKI_ROWS) return g;
  if (g.blocks.some((x) => x.id !== id && overlaps(x, nb))) return g;
  const trail = id === g.exit ? [...g.trail, [nb.x, nb.y] as const] : g.trail;
  return { ...g, pick: id, blocks: g.blocks.map((x) => (x.id === id ? nb : x)), moves: g.moves + 1, history, trail, blocked: false };
}

/** 退一步: the last push back (it counts as a move, as sokoban's does). Not after the exit. */
export function klotskiUndo(g: KlotskiGame): KlotskiGame {
  const last = g.history[0];
  if (!last || g.done) return g;
  // the exit block stepped back: its last cell leaves the trail
  const e = last.find((b) => b.id === g.exit);
  const tip = g.trail[g.trail.length - 1];
  const trail = e && tip && (tip[0] !== e.x || tip[1] !== e.y) ? g.trail.slice(0, -1) : g.trail;
  return { ...g, blocks: last, history: g.history.slice(1), moves: g.moves + 1, trail, blocked: false };
}

/**
 * Dev / tests: the exit block through the door at once (any other id: the same game). It is set on
 * a free door cell of the bottom row when there is one, else it stays where it is.
 */
export function klotskiSolve(g: KlotskiGame, id: string, nowMs: number): KlotskiGame {
  if (id !== g.exit || g.done) return g;
  const b = g.blocks.find((x) => x.id === id);
  if (!b) return g;
  const y = KLOTSKI_ROWS - 1;
  const spot = [DOOR_X, DOOR_X + 1].map((x) => ({ ...b, x, y })).find((nb) => (nb.x === b.x && nb.y === b.y) || !g.blocks.some((o) => o.id !== id && overlaps(o, nb)));
  const nb = spot ?? b;
  const tip = g.trail[g.trail.length - 1];
  const trail = tip && tip[0] === nb.x && tip[1] === nb.y ? g.trail : [...g.trail, [nb.x, nb.y] as const];
  return { ...g, pick: id, blocks: g.blocks.map((x) => (x.id === id ? nb : x)), trail, out: id, outAt: nowMs, done: true, blocked: false };
}

export const klotskiApproving = (g: Pick<KlotskiGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < KLOTSKI_DONE_MS;

/** klotski-door R2: the exit block's card once it is through the door, else null. */
export const klotskiCard = (game: Game, g: Pick<KlotskiGame, "out">): string | null => (g.out !== null && g.out === game.exit ? (game.blocks[game.exit]?.card ?? null) : null);

/**
 * The fewest pushes that take block `id` out (a breadth-first search over block positions; the board
 * is small). Tests use it on the fixture; the game never needs it. Null when it cannot get out.
 */
export interface KlotskiStep { readonly id: string; readonly dir: KlotskiDir }
export function klotskiPath(game: Game, id: string, limit = 200_000): KlotskiStep[] | null {
  const g0 = klotskiStart("path", game);
  // klotski-door R2: blocks of the same size and role (the gods; the persons) are interchangeable for the search's state
  const keyOf = (bs: readonly KBlock[]) => bs.map((b) => { const r = game.blocks[b.id]?.role; return `${r === "god" || r === "person" ? `${r}${b.w}${b.h}` : b.id}@${b.x},${b.y}`; }).sort().join("|");
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

/** klotski-door R4: a god's mark, chosen by its letter (single colour, the seal red; no image files). */
const GOD_MARK: Readonly<Record<string, string>> = {
  // a torn crown
  H: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 14 L3 4 L8 9 L12 2 L14 7 L13 9 L16 6 L21 4 L22 14 Z" fill="currentColor"/></svg>',
  // a pair of scales
  F: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M11 1h2v12h4v2H7v-2h4z M4 4h16v1.5H4z M1 10 L4 5 L7 10 Z M17 10 L20 5 L23 10 Z" fill="currentColor"/></svg>',
  // a closed eye
  P: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M2 7 Q12 15 22 7" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M6 11 l-2 3 M12 13 v3 M18 11 l2 3" stroke="currentColor" stroke-width="2"/></svg>',
  // a horn
  S: '<svg viewBox="0 0 24 16" aria-hidden="true"><path d="M5 15 C4 8 9 2 19 1 C13 4 10 9 10 15 Z" fill="currentColor"/></svg>',
};

/**
 * A block's look (author 2026-11-27, #166: the toy keeps its look, wood and carved pieces), by role
 * (klotski-door R4): the nameless big one an eye carved shut that opens while held; the gate a
 * keyhole under an arch with its name; a god the faceless tall figure with its own mark; a person
 * their face, round and grey, with the name; you a light tile with a thin amber ring.
 */
function blockHtml(game: Game, b: KBlock, g: KlotskiGame | null, look: string | null = null): SafeHtml {
  const info = game.blocks[b.id];
  const role = info?.role ?? "nameless";
  const label = info?.label ?? "";
  const style = `--x:${String(b.x)};--y:${String(b.y)};--w:${String(b.w)};--h:${String(b.h)}`;
  const kind = role === "nameless" ? "big" : role === "god" ? "tall god" : role;
  const name = label ? html`<span class="kl-label">${label}</span>` : null;
  const face =
    role === "nameless" ? html`<i class="kl-eye" aria-hidden="true"><b></b></i>`
    : role === "gate" ? html`<i class="kl-arch" aria-hidden="true"></i><i class="kl-key" aria-hidden="true"></i>${name}`
    : role === "god" ? html`<i class="kl-fig" aria-hidden="true"></i><i class="${cls("kl-mark", `m-${b.id}`)}">${raw(GOD_MARK[b.id] ?? "")}</i>`
    : role === "person" ? html`${info?.face ? html`<img class="kl-face" src="${info.face}" alt="">` : null}${name}`
    // author 2026-11-27: 「你，可以用上玩家选的 look，积木看起来颜色要像个活人，唯一的活人」
    : html`${look ? html`<img class="kl-face kl-me" src="${look}" alt="">` : null}${name}<i class="kl-you-ring" aria-hidden="true"></i>`;
  const aria = label ? html` aria-label="${label}"` : null;
  return html`<button type="button" class="${cls("kl-block", kind, g?.pick === b.id && "picked")}" data-action="klotski-pick" data-block="${b.id}" data-role="${role}" style="${style}"${aria}${g && !g.done ? null : html` disabled`}>${face}</button>`;
}

/** #166: how far the thing at the door has come, 0..1, by the pushes made (drawn only). */
export const KLOTSKI_ROT_MOVES = 40;
export const klotskiRot = (moves: number): number => Math.min(1, Math.max(0, moves / KLOTSKI_ROT_MOVES));

/**
 * klotski-door R3: the order the tentacles cover the board in. From the door cells, first through
 * the cells empty at the door moment and every cell the exit block passed over (nearest the door
 * first), then the rest of the board from the bottom up, the exit block's own cell last.
 */
export function klotskiCover(g: Pick<KlotskiGame, "blocks" | "exit" | "trail">): (readonly [number, number])[] {
  const k = (x: number, y: number) => `${String(x)},${String(y)}`;
  const taken = new Set<string>();
  for (const b of g.blocks) for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) taken.add(k(b.x + dx, b.y + dy));
  const e = g.blocks.find((b) => b.id === g.exit);
  const last = e ? k(e.x, e.y) : "";
  const way = new Set<string>();
  for (let y = 0; y < KLOTSKI_ROWS; y++) for (let x = 0; x < KLOTSKI_COLS; x++) if (!taken.has(k(x, y))) way.add(k(x, y));
  for (const [x, y] of g.trail) way.add(k(x, y));
  way.delete(last);
  const order: (readonly [number, number])[] = [];
  const done = new Set<string>([last]);
  // breadth-first from the door through the way
  let front: [number, number][] = [DOOR_X, DOOR_X + 1].map((x) => [x, KLOTSKI_ROWS - 1] as [number, number]).filter(([x, y]) => way.has(k(x, y)));
  if (!front.length && e) front = ([[e.x - 1, e.y], [e.x + 1, e.y], [e.x, e.y - 1]] as [number, number][]).filter(([x, y]) => way.has(k(x, y)));
  for (const [x, y] of front) done.add(k(x, y));
  while (front.length) {
    order.push(...front);
    const next: [number, number][] = [];
    for (const [x, y] of front) for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]] as [number, number][]) {
      const c = k(nx, ny);
      if (way.has(c) && !done.has(c)) { done.add(c); next.push([nx, ny]); }
    }
    front = next;
  }
  // the rest of the board, bottom row first
  for (let y = KLOTSKI_ROWS - 1; y >= 0; y--) for (let x = 0; x < KLOTSKI_COLS; x++) if (!done.has(k(x, y))) { done.add(k(x, y)); order.push([x, y]); }
  if (e) order.push([e.x, e.y]);
  return order;
}

export function klotskiStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly klotski: KlotskiGame | null }, approved: boolean, nowMs: number, look: string | null = null): SafeHtml {
  const game = board.game as Game;
  const g: KlotskiGame | null = session.klotski?.key === task.id ? session.klotski : null;
  const lv = g ?? klotskiStart(task.id, game);
  const out = !!g?.out;
  const blocks = lv.blocks.map((b) => blockHtml(game, b, g, look));
  // the more pushes, the more of it shows at the door and the redder the tray's grain (drawn only); at the door, all of it
  const rot = (out ? 1 : klotskiRot(g?.moves ?? 0)).toFixed(2);
  // klotski-door R3: the door opens under the exit block; several tentacles come in, cell by cell
  let tentacles: SafeHtml | SafeHtml[] = html`<i class="kl-peek" aria-hidden="true"></i>`;
  if (g && out) {
    const cover = klotskiCover(g);
    const step = KLOTSKI_GROW_MS / Math.max(1, cover.length);
    tentacles = cover.map(([x, y], i) => html`<i class="${cls("kl-tent", i === cover.length - 1 && "last")}" aria-hidden="true" style="--x:${String(x)};--y:${String(y)};--d:${String(Math.round(KLOTSKI_SLIDE_MS + i * step))}ms"></i>`);
  }
  const field = html`<div class="${cls("kl-board", !g && "blank", out && "open")}" style="--cols:${String(KLOTSKI_COLS)};--rows:${String(KLOTSKI_ROWS)};--rot:${rot}"><i class="kl-veins" aria-hidden="true"></i>${blocks}<i class="kl-door" aria-hidden="true"></i>${tentacles}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="klotski-push" data-dir="${d}" aria-label="${d}">${d === "up" ? "▲" : d === "left" ? "◀" : d === "down" ? "▼" : "▶"}</button>`);
  const nameless = g?.nameless ? html`<p class="kl-nameless">${S("klotski.stage.nameless")}</p>` : null;
  // the sub-line: the three door lines one after another; a block that cannot go out; else the room
  const sub = out
    ? html`<span class="mn-sub kl-doorlines">${(["door1", "door2", "door3"] as const).map((k, i) => html`<span class="${cls("kl-doorline", `l${String(i + 1)}`)}" style="--d:${String(KLOTSKI_LINE_MS[i])}ms">${S(`klotski.stage.${k}`)}</span>`)}</span>`
    : g?.blocked ? html`<span class="mn-sub kl-blocked">${S("klotski.stage.blocked")}</span>`
    : html`<span class="mn-sub">${S("klotski.stage.sub")}</span>`;
  let foot: SafeHtml;
  if (out) foot = html`<div class="mn-state won">${nameless}</div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="klotski-start">${S("klotski.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("klotski.stage.moves", { n: String(g.moves) })}</span><div class="sk-pad sn-pad">${pad}</div><button type="button" class="mn-mode" data-action="klotski-undo"${g.history.length ? null : html` disabled`}>${S("klotski.stage.undo")}</button><button type="button" class="mn-mode" data-action="klotski-start">${S("klotski.stage.reset")}</button><span class="sn-hint">${S("klotski.stage.keys")}</span>${nameless}</div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="klotski-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn kl", out && "done", out && "haunted")}" data-screen="klotski">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("klotski.stage.kick")}</span><h2>${S("klotski.stage.title")}</h2>${sub}</div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("klotski.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month kl-main">${field}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}

/**
 * klotski-door R6: the only block that can go out is the exit block, whose card is the slot's answer
 * (the loader checks it). Nothing out yet → wrong; out → by the pushes (≤ 45 perfect, ≤ 90 flawed,
 * more wrong; the shortest way is 28), at best flawed with help.
 */
export function grade(g: Pick<KlotskiGame, "out" | "moves">, game: Game, answer: string | undefined, t: GameTally | null = null): BoardVerdict {
  const card = klotskiCard(game, g);
  if (card === null || card !== answer) return "wrong";
  return capAssisted(byCount(g.moves, 45, 90), t);
}
