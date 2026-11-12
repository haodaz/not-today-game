// Pac-Man (author 2026-11-13: 「吃豆人」 for 晨会纪要, day 7): once the minutes' form is filled, the meeting
// room is a maze; the dots are 老周's words, five of them the template's five lines — eat those five
// and the minutes are done (the form approved, the chain's `approve` step). 老周's digressions are
// the ghosts: touched, they carry you off (重开 / 让克总帮忙). The two power pellets turn the ghosts
// into the colleagues' faces — 小张, Vivi, 老王 — and for a while you can eat them back. Time-based,
// tile-by-tile movement with a queued turn, seeded ghost choices; the actions keep the maze in the
// session and run the clock.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";
import { dice } from "./battle";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "pacman" }>;
export type Dir = "up" | "down" | "left" | "right";

export interface Mover { readonly x: number; readonly y: number; readonly dir: Dir; readonly next: Dir | null }
export interface Ghost extends Mover { readonly id: number; readonly home: number; readonly eaten: boolean }
export interface PacGame {
  readonly key: string;
  readonly cols: number;
  readonly rows: number;
  readonly walls: readonly boolean[];
  /** Plain dots still on the floor, by cell. */
  readonly dots: readonly boolean[];
  /** The five lines' cells (-1 once eaten), in template order. */
  readonly lines: readonly number[];
  readonly powers: readonly number[];
  readonly you: Mover;
  readonly ghosts: readonly Ghost[];
  /** Until when the ghosts wear the colleagues' faces (ms on the sheet's clock), or 0. */
  readonly fearUntil: number;
  readonly eatenGhosts: number;
  readonly score: number;
  readonly startAt: number;
  readonly pausedAt: number | null;
  readonly clockAt: number;
  readonly steps: number;
  readonly done: boolean;
  readonly over: boolean;
  readonly gen: number;
  readonly running: boolean;
  readonly seed: string;
  readonly approvedAt?: number;
}

export const PAC_TICK_MS = 80;
export const PAC_DONE_MS = 2000;
export const FEAR_MS = 6500;
const YOU_SPEED = 4.6;
const GHOST_SPEED = 3.8;
const FEAR_SPEED = 2.2;
const CATCH_R = 0.62;

const DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 };
const DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 };
const BACK: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

/** The maze from its rows: # wall, . dot, o power pellet, 1–5 the lines, P you, G a ghost's home, space floor. */
export function parseMaze(rows: readonly string[]): { cols: number; rows: number; walls: boolean[]; dots: boolean[]; lines: number[]; powers: number[]; you: number; homes: number[] } {
  const cols = Math.max(...rows.map((r) => r.length));
  const walls: boolean[] = [], dots: boolean[] = [], powers: number[] = [], homes: number[] = [];
  const lines: number[] = [-1, -1, -1, -1, -1];
  let you = -1;
  rows.forEach((r, y) => {
    for (let x = 0; x < cols; x++) {
      const ch = r[x] ?? "#";
      const i = y * cols + x;
      walls.push(ch === "#");
      dots.push(ch === ".");
      if (ch === "o") powers.push(i);
      if (ch >= "1" && ch <= "5") lines[Number(ch) - 1] = i;
      if (ch === "P") you = i;
      if (ch === "G") homes.push(i);
    }
  });
  return { cols, rows: rows.length, walls, dots, lines: lines.filter((c) => c >= 0), powers, you, homes };
}

export function pacStart(key: string, game: Game, seed: string, gen: number, nowMs: number): PacGame {
  const m = parseMaze(game.maze);
  const at = (i: number) => ({ x: i % m.cols, y: Math.floor(i / m.cols) });
  const ghosts: Ghost[] = m.homes.map((h, k) => ({ id: k, home: h, ...at(h), dir: (["up", "left", "right", "down"] as const)[k % 4]!, next: null, eaten: false }));
  return { key, cols: m.cols, rows: m.rows, walls: m.walls, dots: m.dots, lines: m.lines, powers: m.powers, you: { ...at(m.you), dir: "left", next: null }, ghosts, fearUntil: 0, eatenGhosts: 0, score: 0, startAt: nowMs, pausedAt: null, clockAt: nowMs, steps: 0, done: false, over: false, gen, running: false, seed };
}

export const elapsed = (g: PacGame, nowMs: number): number => (g.pausedAt ?? nowMs) - g.startAt;
const cell = (g: Pick<PacGame, "cols">, x: number, y: number): number => Math.round(y) * g.cols + Math.round(x);
const open = (g: Pick<PacGame, "cols" | "rows" | "walls">, x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.cols && y < g.rows && !g.walls[y * g.cols + x];
const centred = (m: Mover): boolean => Math.abs(m.x - Math.round(m.x)) < 1e-6 && Math.abs(m.y - Math.round(m.y)) < 1e-6;

/** A mover advanced by `dist` tiles: turns only at a tile's centre (into an open cell), stops at walls. */
function advance(g: PacGame, m: Mover, dist: number, pick?: (m: Mover) => Dir): Mover {
  let { x, y, dir, next } = m;
  let left = dist;
  for (let guard = 0; guard < 8 && left > 1e-9; guard++) {
    const cx = Math.round(x), cy = Math.round(y);
    const atCentre = Math.abs(x - cx) < 1e-6 && Math.abs(y - cy) < 1e-6;
    if (atCentre) {
      x = cx; y = cy;
      if (pick) { dir = pick({ x, y, dir, next }); next = null; }
      else if (next && open(g, cx + DX[next], cy + DY[next])) { dir = next; next = null; }
      if (!open(g, cx + DX[dir], cy + DY[dir])) break;
      const step = Math.min(left, 1);
      x += DX[dir] * step; y += DY[dir] * step; left -= step;
    } else {
      // between centres: continue to the next centre along the axis of travel
      const tx = dir === "left" ? Math.floor(x) : dir === "right" ? Math.ceil(x) : cx;
      const ty = dir === "up" ? Math.floor(y) : dir === "down" ? Math.ceil(y) : cy;
      const toCentre = Math.abs(tx - x) + Math.abs(ty - y);
      const step = Math.min(left, toCentre);
      x += DX[dir] * step; y += DY[dir] * step; left -= step;
    }
  }
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, dir, next };
}

/** The ghost's turn at a centre: toward you (away while frightened), never straight back unless stuck, a third at random. */
function ghostPick(g: PacGame, roll: () => number, frightened: boolean): (m: Mover) => Dir {
  return (m) => {
    const options = (["up", "down", "left", "right"] as const).filter((d) => open(g, Math.round(m.x) + DX[d], Math.round(m.y) + DY[d]));
    const forward = options.filter((d) => d !== BACK[m.dir]);
    const pool = forward.length ? forward : options;
    if (!pool.length) return m.dir;
    if (roll() < 0.33) return pool[Math.floor(roll() * pool.length)]!;
    const dist = (d: Dir) => Math.abs(m.x + DX[d] - g.you.x) + Math.abs(m.y + DY[d] - g.you.y);
    return [...pool].sort((a, b) => (frightened ? dist(b) - dist(a) : dist(a) - dist(b)))[0]!;
  };
}

/** A key: the turn queued for the next centre (at a centre with that way open, taken at once; straight back at once). */
export function pacTurn(g: PacGame, dir: Dir): PacGame {
  if (g.done || g.over) return g;
  const you = g.you;
  if (dir === BACK[you.dir]) return { ...g, you: { ...you, dir, next: null } };
  if (centred(you) && open(g, Math.round(you.x) + DX[dir], Math.round(you.y) + DY[dir])) return { ...g, you: { ...you, dir, next: null } };
  return { ...g, you: { ...you, next: dir } };
}

/** The clock: everyone moves by the time passed; dots, lines, pellets and ghosts are met on the way. */
export function pacTick(g: PacGame, nowMs: number): PacGame {
  if (g.done || g.over || g.pausedAt !== null) return g;
  const dt = Math.min(120, Math.max(0, nowMs - g.clockAt)) / 1000;
  const e = elapsed(g, nowMs);
  const frightened = g.fearUntil > e;
  const roll = dice(`${g.seed}:${String(g.steps)}`);
  let next: PacGame = { ...g, clockAt: nowMs, steps: g.steps + 1 };
  const you = advance(g, g.you, YOU_SPEED * dt);
  next = { ...next, you };
  // what is under you now
  const here = cell(g, you.x, you.y);
  if (next.dots[here]) next = { ...next, dots: next.dots.map((d, i) => (i === here ? false : d)), score: next.score + 10 };
  if (next.lines.includes(here)) next = { ...next, lines: next.lines.map((c) => (c === here ? -1 : c)), score: next.score + 100 };
  if (next.powers.includes(here)) next = { ...next, powers: next.powers.filter((c) => c !== here), fearUntil: e + FEAR_MS, score: next.score + 50 };
  const fear = next.fearUntil > e;
  const ghosts = next.ghosts.map((gh) => {
    if (gh.eaten) {
      // back home, then out again
      const home = { x: gh.home % g.cols, y: Math.floor(gh.home / g.cols) };
      return { ...gh, x: home.x, y: home.y, eaten: false, dir: "up" as const, next: null };
    }
    const moved = advance(g, gh, (fear ? FEAR_SPEED : GHOST_SPEED) * dt, ghostPick({ ...g, you }, roll, fear));
    return { ...gh, ...moved };
  });
  next = { ...next, ghosts };
  for (const gh of next.ghosts) {
    if (gh.eaten) continue;
    if (Math.abs(gh.x - you.x) + Math.abs(gh.y - you.y) < CATCH_R) {
      if (fear) next = { ...next, ghosts: next.ghosts.map((x) => (x.id === gh.id ? { ...x, eaten: true } : x)), eatenGhosts: next.eatenGhosts + 1, score: next.score + 200 };
      else return { ...next, over: true, running: false };
    }
  }
  if (next.lines.every((c) => c < 0)) return { ...next, done: true, running: false };
  return next;
}

export const pacPause = (g: PacGame, nowMs: number): PacGame => (g.pausedAt !== null || g.done || g.over ? g : { ...g, pausedAt: nowMs, running: false });
export const pacResume = (g: PacGame, nowMs: number, gen: number): PacGame => (g.pausedAt === null ? { ...g, gen, clockAt: nowMs } : { ...g, startAt: g.startAt + (nowMs - g.pausedAt), pausedAt: null, clockAt: nowMs, gen });
export const pacSolve = (g: PacGame): PacGame => ({ ...g, lines: g.lines.map(() => -1), done: true, over: false, running: false, pausedAt: null });
export const pacApproving = (g: Pick<PacGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < PAC_DONE_MS;
export const linesEaten = (g: PacGame): number => g.lines.filter((c) => c < 0).length;

// ——— the screen ———

const FACES = ["/npc/xiaozhang_av.png", "/npc/partner_av.png", "/npc/boss_av.png"];
const TILE = 38;

export function pacStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly pacman: PacGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: PacGame | null = session.pacman?.key === task.id ? session.pacman : null;
  const done = approved && (!g || pacApproving(g, nowMs) || g.done);
  const m = g ?? pacStart(task.id, game, "preview", 0, nowMs);
  const e = g ? elapsed(g, nowMs) : 0;
  const fear = g !== null && g.fearUntil > e;
  const labels = board.slots.map((sl) => sl.label);
  const cells = Array.from({ length: m.cols * m.rows }, (_, i) => {
    const li = m.lines.indexOf(i);
    return html`<i class="${cls("pm-cell", m.walls[i] && "wall", m.dots[i] && "dot", m.powers.includes(i) && "power", li >= 0 && "line")}">${li >= 0 ? html`<b>${labels[li] ?? ""}</b>` : null}</i>`;
  });
  const pos = (x: number, y: number) => `left:${String(Math.round(x * TILE))}px;top:${String(Math.round(y * TILE))}px`;
  const you = g ? html`<i class="${cls("pm-you", g.you.dir, g.over && "caught")}" style="${pos(g.you.x, g.you.y)}"></i>` : null;
  const ghosts = g ? g.ghosts.map((gh) => html`<i class="${cls("pm-ghost", fear && "fear", gh.eaten && "eaten")}" style="${pos(gh.x, gh.y)}"><img src="${fear ? FACES[gh.id % FACES.length]! : "/npc/laozhou_av.png"}" alt=""></i>`) : null;
  const maze = html`<div class="${cls("pm-maze", fear && "fear")}" style="--cols:${String(m.cols)};--rows:${String(m.rows)}"><div class="pm-grid">${cells}</div>${ghosts}${you}</div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const pad = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", "sn-key", d)}" data-action="pacman-turn" data-dir="${d}" aria-label="${d}">${d === "up" ? "▲" : d === "left" ? "◀" : d === "down" ? "▼" : "▶"}</button>`);
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("pacman.stage.won")}</span><p class="pp-flowline">${S(g && g.eatenGhosts > 0 ? "pacman.stage.leftFaces" : "pacman.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="pacman-start">${S("pacman.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S("pacman.stage.caught")}</p><button type="button" class="wl-cta ghost" data-action="pacman-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="pacman-start">${S("pacman.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl sn-ctl"><span class="mn-left">${S("pacman.stage.lines", { n: String(linesEaten(g)), of: String(g.lines.length) })} · ${String(g.score)}${fear ? html`<span class="pm-fearnote"> · ${S("pacman.stage.fear")}</span>` : null}</span>${g.running ? html`<div class="sk-pad sn-pad">${pad}</div>` : html`<button type="button" class="mn-mode" data-action="pacman-resume">${S("pacman.stage.resume")}</button>`}<span class="sn-hint">${S("pacman.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="pacman-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("mn pm", done && "done", g?.over && "lost")}" data-screen="pacman">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("pacman.stage.kick")}</span><h2>${S("pacman.stage.title")}</h2><span class="mn-sub">${S("pacman.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("pacman.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month pm-main">${maze}${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
