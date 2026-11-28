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
  /** the call (author 2026-11-27): the level has a phone; at the door it is in hand (`phone`), and `call` is the card of the one entry called back. */
  readonly dial: boolean;
  readonly phone: boolean;
  readonly call: string | null;
}

/** klotski-door R3: the door opens under the block; the tentacles come after this. */
export const KLOTSKI_SLIDE_MS = 700;
/** The door moment holds the stage this long before the form returns (klotski-door R3: 6000). */
export const KLOTSKI_DONE_MS = 8800;
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
  return { key, blocks, pick: null, moves: 0, history: [], out: null, outAt: null, nameless: false, done: false, exit: game.exit, trail: e ? [[e.x, e.y]] : [], blocked: false, dial: !!game.phone, phone: false, call: null };
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
  // the phone is in hand: nothing moves until one entry is called back
  if (g.done || id === null || g.phone) return g;
  const b = g.blocks.find((x) => x.id === id);
  if (!b) return g;
  const history = [g.blocks, ...g.history].slice(0, HISTORY);
  if (dir === "down" && b.y + b.h === KLOTSKI_ROWS) {
    if (!atDoor(b)) return g;
    if (id !== g.exit) return g.blocked && g.pick === id ? g : { ...g, pick: id, blocked: true };
    // at the door there is one bar of signal: the phone comes up; the door waits for the call
    if (g.dial) return { ...g, pick: id, moves: g.moves + 1, history, phone: true, blocked: false };
    return { ...g, pick: id, moves: g.moves + 1, history, out: id, outAt: nowMs, done: true, blocked: false };
  }
  const nb: KBlock = { ...b, x: b.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0), y: b.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0) };
  if (nb.x < 0 || nb.y < 0 || nb.x + nb.w > KLOTSKI_COLS || nb.y + nb.h > KLOTSKI_ROWS) return g;
  if (g.blocks.some((x) => x.id !== id && overlaps(x, nb))) return g;
  const trail = id === g.exit ? [...g.trail, [nb.x, nb.y] as const] : g.trail;
  return { ...g, pick: id, blocks: g.blocks.map((x) => (x.id === id ? nb : x)), moves: g.moves + 1, history, trail, blocked: false };
}

/**
 * The call (author 2026-11-27: 「在有信号的地方拿起手机，里面有很多个联系人电话，也有自己的号码」): with the
 * phone in hand, the one entry called back. Only one: the door opens whoever it was, and the entry's
 * card is what the form takes.
 */
export function klotskiCall(g: KlotskiGame, game: Game, card: string, nowMs: number): KlotskiGame {
  if (g.done || !g.phone || !game.phone?.calls.some((c) => c.card === card)) return g;
  return { ...g, call: card, phone: false, out: g.exit, outAt: nowMs, done: true };
}

/** 退一步: the last push back (it counts as a move, as sokoban's does). Not after the exit, not with the phone in hand. */
export function klotskiUndo(g: KlotskiGame): KlotskiGame {
  const last = g.history[0];
  if (!last || g.done || g.phone) return g;
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
export const klotskiCard = (game: Game, g: Pick<KlotskiGame, "out"> & { readonly call?: string | null }): string | null => (g.out !== null && g.out === game.exit ? (g.call ?? game.blocks[game.exit]?.card ?? null) : null);

/**
 * The fewest pushes that take block `id` out (a breadth-first search over block positions; the board
 * is small). Tests use it on the fixture; the game never needs it. Null when it cannot get out.
 */
export interface KlotskiStep { readonly id: string; readonly dir: KlotskiDir }
export function klotskiPath(game: Game, id: string, limit = 200_000): KlotskiStep[] | null {
  // (the push at the door ends the way, whether the door opens at once or the phone comes up first)
  const g0: KlotskiGame = { ...klotskiStart("path", game), dial: false };
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
function blockHtml(game: Game, b: KBlock, g: KlotskiGame | null, look: string | null = null, shove: { x: number; y: number; rot: number; d: number } | null = null): SafeHtml {
  const info = game.blocks[b.id];
  const role = info?.role ?? "nameless";
  const label = info?.label ?? "";
  const style = `--x:${String(b.x)};--y:${String(b.y)};--w:${String(b.w)};--h:${String(b.h)}${shove ? `;--sx:${String(shove.x)};--sy:${String(shove.y)};--sr:${String(shove.rot)}deg;--sd:${String(shove.d)}ms` : ""}`;
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
  return html`<button type="button" class="${cls("kl-block", kind, g?.pick === b.id && "picked", shove && "shoved")}" data-action="klotski-pick" data-block="${b.id}" data-role="${role}" style="${style}"${aria}${g && !g.done ? null : html` disabled`}>${face}</button>`;
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

/**
 * The surge (author 2026-11-27: 「门开之后，是汹涌的触手从让出来的通道涌过去」, then 「触手不对，用 3d 做出来
 * 的那种」「血肉触手」): the flesh tentacles of the code-built room, drawn by room3d/flesh.js over the tray.
 * This is their centre lines, in cells (y down): several strands from outside the door, up through the
 * way the exit block made (its trail, backwards) and on past where it started, off the tray; a few that
 * spill over the rest of the room afterwards; one that closes round you last.
 */
export interface KlotskiStrand { readonly p: readonly (readonly [number, number])[]; readonly r: number; readonly d: number }
export function klotskiSurge(g: Pick<KlotskiGame, "trail" | "blocks" | "exit">): KlotskiStrand[] {
  const way: [number, number][] = [];
  for (const [x, y] of [...g.trail].reverse()) { const p: [number, number] = [x + 0.5, y + 0.5]; const q = way[way.length - 1]; if (!q || q[0] !== p[0] || q[1] !== p[1]) way.push(p); }
  const door: [number, number] = [DOOR_X + 1, KLOTSKI_ROWS];
  const first = way[0] ?? [door[0], KLOTSKI_ROWS - 0.5];
  const end = way[way.length - 1] ?? first;
  const before = way[way.length - 2] ?? [end[0], end[1] + 1];
  const len = Math.hypot(end[0] - before[0], end[1] - before[1]) || 1;
  const off: [number, number] = [end[0] + ((end[0] - before[0]) / len) * 1.7, end[1] + ((end[1] - before[1]) / len) * 1.7];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pts: [number, number][] = [[door[0], KLOTSKI_ROWS + 1.9], [door[0], KLOTSKI_ROWS + 0.5], [first[0], KLOTSKI_ROWS - 0.15], ...way, off];
  const main = [0.21, 0.16, 0.14, 0.11, 0.09, 0.07].map((r, i): KlotskiStrand => {
    const side = (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.15;
    return { p: pts.map(([x, y], j) => [r2(x + side + Math.sin(j * 1.7 + i * 2.1) * 0.11), r2(y + Math.cos(j * 1.3 + i * 1.4) * 0.11)] as const), r, d: KLOTSKI_SLIDE_MS + i * 130 };
  });
  // the rest of the room, from the door outwards
  const spill = ([[0.4, 3.4], [3.6, 3.1], [0.6, 1.5], [3.4, 0.7], [2.0, -0.6]] as const).map(([tx, ty], i): KlotskiStrand => ({
    p: [[door[0] + (i % 2 ? 0.3 : -0.3), KLOTSKI_ROWS + 1.7], [door[0] + (i % 2 ? 0.25 : -0.25), KLOTSKI_ROWS + 0.2], [r2((door[0] + tx) / 2 + (i % 2 ? 0.5 : -0.5)), r2((KLOTSKI_ROWS + ty) / 2 + 0.4)], [tx, ty]],
    r: 0.1 - i * 0.008,
    d: KLOTSKI_SLIDE_MS + 1100 + i * 260,
  }));
  // you last: one closes round your cell
  const e = g.blocks.find((b) => b.id === g.exit);
  const you: KlotskiStrand[] = e
    ? [{ p: [[door[0], KLOTSKI_ROWS + 1.6], [e.x + 1.15, KLOTSKI_ROWS + 0.1], [e.x + 1.05, e.y + 0.3], [e.x + 0.5, e.y - 0.08], [e.x - 0.05, e.y + 0.4], [e.x + 0.3, e.y + 0.95], [e.x + 0.8, e.y + 0.75]], r: 0.075, d: KLOTSKI_SLIDE_MS + 2700 }]
    : [];
  return [...main, ...spill, ...you];
}
/**
 * Shoved aside (author 2026-11-27: 「感觉是盖在上面的，不是从通道过去的」): the surge does not lie on the
 * blocks, it parts them. Every block standing on the way (the exit block's trail) is pushed off it,
 * sideways to the way's direction there, as the front reaches it: `x` / `y` in cells, `rot` in degrees,
 * `d` the delay in ms. The exit block stays.
 */
export function klotskiShoves(g: Pick<KlotskiGame, "trail" | "blocks" | "exit">): Record<string, { x: number; y: number; rot: number; d: number }> {
  const way = [...g.trail].reverse();
  const out: Record<string, { x: number; y: number; rot: number; d: number }> = {};
  for (const b of g.blocks) {
    if (b.id === g.exit) continue;
    const i = way.findIndex(([x, y]) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
    if (i < 0) continue;
    const at = way[i]!, prev = way[i - 1] ?? [at[0], at[1] + 1], next = way[i + 1] ?? [at[0] + (at[0] - prev[0]), at[1] + (at[1] - prev[1])];
    const dx = next[0] - prev[0], dy = next[1] - prev[1], len = Math.hypot(dx, dy) || 1;
    const px = -dy / len, py = dx / len; // across the way
    const cx = b.x + b.w / 2 - (at[0] + 0.5), cy = b.y + b.h / 2 - (at[1] + 0.5);
    let side = Math.sign(cx * px + cy * py);
    // standing square on the way: toward the nearer wall
    if (side === 0) side = (b.x + b.w / 2 + px) * (px !== 0 ? 1 : 0) + (b.y + b.h / 2 + py) * (py !== 0 ? 1 : 0) >= (px !== 0 ? KLOTSKI_COLS / 2 : KLOTSKI_ROWS / 2) ? 1 : -1;
    const far = b.w * b.h >= 4 ? 0.2 : b.w * b.h === 2 ? 0.32 : 0.44;
    out[b.id] = { x: Math.round(px * side * far * 100) / 100, y: Math.round(py * side * far * 100) / 100, rot: side * (4 + (b.id.charCodeAt(0) % 5)), d: KLOTSKI_SLIDE_MS + Math.round((i / Math.max(1, way.length)) * 1100) };
  }
  return out;
}
/** The margins (in cells) of the flesh page round the tray: left, top, right, bottom (the door and the path are below). */
export const KLOTSKI_FLESH_MARGIN = [1, 1, 1, 2] as const;
/**
 * The room (author 2026-11-27: 「先做游戏视角的，再做一个屋子的过场动画」): after the tray, the same moment in
 * the code-built room: the door thrown open, the tentacles coming in (room3d `surge=1`, started on the door's
 * own clock). The page is put in at the door moment so it has loaded by the time it shows, this long after.
 */
export const KLOTSKI_ROOM_MS = 3600;
/** The day whose room it is (the klotski is day 17's). */
export const KLOTSKI_ROOM_DAY = 17;
export const klotskiRoomSrc = (day: number, outAt: number): string => `/room3d/index.html?embed=1&day=${String(day)}&low=1&surge=1&at=${String(Math.round(outAt + KLOTSKI_ROOM_MS))}`;

export function klotskiStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly klotski: KlotskiGame | null }, approved: boolean, nowMs: number, look: string | null = null): SafeHtml {
  const game = board.game as Game;
  const g: KlotskiGame | null = session.klotski?.key === task.id ? session.klotski : null;
  const lv = g ?? klotskiStart(task.id, game);
  const out = !!g?.out;
  const shoves = g && out ? klotskiShoves(g) : {};
  const blocks = lv.blocks.map((b) => blockHtml(game, b, g, look, shoves[b.id] ?? null));
  // the more pushes, the more of it shows at the door and the redder the tray's grain (drawn only); at the door, all of it
  const rot = (out ? 1 : klotskiRot(g?.moves ?? 0)).toFixed(2);
  // klotski-door R3: the door opens under the exit block; several tentacles come in, cell by cell
  let tentacles: SafeHtml | SafeHtml[] = html`<i class="kl-peek" aria-hidden="true"></i>`;
  if (g && out) {
    const cover = klotskiCover(g);
    const step = KLOTSKI_GROW_MS / Math.max(1, cover.length);
    tentacles = cover.map(([x, y], i) => html`<i class="${cls("kl-tent", i === cover.length - 1 && "last")}" aria-hidden="true" style="--x:${String(x)};--y:${String(y)};--d:${String(Math.round(KLOTSKI_SLIDE_MS + i * step))}ms"></i>`);
  }
  // the surge over the board at the door moment: the flesh page, kept across re-renders (its clock is the door's own)
  const surge = g && out && g.outAt !== null
    ? html`<iframe class="kl-flesh" data-keep="kl-flesh" src="/room3d/flesh.html#${encodeURIComponent(JSON.stringify({ at: g.outAt, cols: KLOTSKI_COLS, rows: KLOTSKI_ROWS, m: KLOTSKI_FLESH_MARGIN, s: klotskiSurge(g) }))}" title="" aria-hidden="true" tabindex="-1"></iframe>`
    : null;
  const field = html`<div class="${cls("kl-board", !g && "blank", out && "open")}" style="--cols:${String(KLOTSKI_COLS)};--rows:${String(KLOTSKI_ROWS)};--rot:${rot}"><i class="kl-veins" aria-hidden="true"></i>${blocks}<i class="kl-door" aria-hidden="true"><b class="kl-leaf l"></b><b class="kl-leaf r"></b><em>${S("klotski.stage.door")}</em></i><i class="kl-road" aria-hidden="true"></i>${tentacles}${surge}</div>`;
  // author 2026-11-27 (「左边的东西写的非常非常奇怪」): each note is the form's own question and what was answered
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${board.given.rows[slot.id] ?? slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  // the phone (author 2026-11-27): no service in the room; one bar at the door, the missed calls, one to call back
  const up = !!g?.phone;
  const called = g?.call ?? null;
  const phone = game.phone
    ? html`<aside class="${cls("mn-notes", "kl-phone", up && "on", called !== null && "called")}"><div class="kl-ph-top"><span class="kl-ph-sig" aria-hidden="true"><i class="${cls(up || called !== null ? "on" : null)}"></i><i></i><i></i><i></i></span><span>${S(up || called !== null ? "klotski.phone.bar" : "klotski.phone.none")}</span></div><div class="kl-ph-title">${S("klotski.phone.title")}</div><ul class="kl-ph-list">${game.phone.calls.map((c) => html`<li><button type="button" class="${cls("kl-ph-call", called === c.card && "picked")}" data-action="klotski-call" data-card="${c.card}"${up ? null : html` disabled`}><b>${c.name}</b>${called === c.card ? html`<span class="kl-ph-say">${c.say}</span>` : null}</button></li>`)}</ul><p class="kl-ph-ask">${S(called !== null ? "klotski.phone.done" : up ? "klotski.phone.ask" : "klotski.phone.far")}</p></aside>`
    : null;
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="klotski-push" data-dir="${d}" aria-label="${d}">${d === "up" ? "▲" : d === "left" ? "◀" : d === "down" ? "▼" : "▶"}</button>`);
  const nameless = g?.nameless ? html`<p class="kl-nameless">${S("klotski.stage.nameless")}</p>` : null;
  // the sub-line: the three door lines one after another; a block that cannot go out; else the room
  const sub = out
    ? html`<span class="mn-sub kl-doorlines">${(["door1", "door2", "door3"] as const).map((k, i) => html`<span class="${cls("kl-doorline", `l${String(i + 1)}`)}" style="--d:${String(KLOTSKI_LINE_MS[i])}ms">${S(`klotski.stage.${k}`)}</span>`)}</span>`
    : up ? html`<span class="mn-sub kl-blocked">${S("klotski.phone.sub")}</span>`
    : g?.blocked ? html`<span class="mn-sub kl-blocked">${S("klotski.stage.blocked")}</span>`
    : html`<span class="mn-sub">${S("klotski.stage.sub")}</span>`;
  let foot: SafeHtml;
  if (out) foot = html`<div class="mn-state won">${nameless}</div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="klotski-start">${S("klotski.stage.start")}</button>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("klotski.stage.moves", { n: String(g.moves) })}</span><div class="sk-pad sn-pad">${pad}</div><button type="button" class="mn-mode" data-action="klotski-undo"${g.history.length ? null : html` disabled`}>${S("klotski.stage.undo")}</button><button type="button" class="mn-mode" data-action="klotski-start">${S("klotski.stage.reset")}</button><span class="sn-hint">${S("klotski.stage.keys")}</span>${nameless}</div>`;
  // the room's own picture of it, over the tray for the second half of the moment (its lines stay in the header)
  const since = g && out && g.outAt !== null ? nowMs - g.outAt : -1;
  const room = g && out && g.outAt !== null
    ? html`<iframe class="${cls("kl-room", since >= KLOTSKI_ROOM_MS && "in")}" data-keep="kl-room" src="${klotskiRoomSrc(KLOTSKI_ROOM_DAY, g.outAt)}" style="--at:${String(Math.max(0, Math.round(KLOTSKI_ROOM_MS - since)))}ms" title="" aria-hidden="true" tabindex="-1"></iframe>`
    : null;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="klotski-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn kl", out && "done", out && "haunted")}" data-screen="klotski">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("klotski.stage.kick")}</span><h2>${S("klotski.stage.title")}</h2>${sub}</div></header>
    ${phone ?? html`<aside class="mn-notes"><span class="mn-notes-h">${S("klotski.stage.notes")}</span><ul>${notes}</ul></aside>`}
    <div class="mn-month kl-main">${field}${cheat}${room}</div>
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
