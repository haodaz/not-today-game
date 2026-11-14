// The budget fill (day11-budget-fill, author 2026-11-13; replaces day 11's balance): the cost sheet
// as a grid whose 要求 cells must be covered. A budget buys shapes from the tray (picked, turned,
// placed by their anchor; lifting refunds) and the sheet grows every round — four rounds. From
// round 3 the 自己人 come: one free cell per colleague, greyed once used, 你 only when everyone else
// is; round 4 cannot be passed on the budget alone. Stuck, 让克总帮忙: Kuro covers the rest with
// every person left (you last), then free cells with no name, and the round passes — a game won by
// Kuro is graded `wrong`. Never said: the budget runs out before the appetite does.
// Pure engine + solver + view; the actions keep the game in the session and log how it ended.
import { FILL_SHAPES, type BoardGame, type FillPerson, type FillRound, type FillShape, type Task, type TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
export type FillBoard = Extract<BoardGame, { kind: "fill" }>;

/** Each shape's cells, [row, col], in its first orientation (anchor = its first cell). */
export const SHAPE_CELLS: Readonly<Record<FillShape, readonly (readonly [number, number])[]>> = {
  "1": [[0, 0]],
  I2: [[0, 0], [0, 1]],
  I3: [[0, 0], [0, 1], [0, 2]],
  L3: [[0, 0], [1, 0], [1, 1]],
  I4: [[0, 0], [0, 1], [0, 2], [0, 3]],
  O4: [[0, 0], [0, 1], [1, 0], [1, 1]],
  T4: [[0, 0], [0, 1], [0, 2], [1, 1]],
  L4: [[0, 0], [1, 0], [2, 0], [2, 1]],
  S4: [[0, 1], [0, 2], [1, 0], [1, 1]],
};

/** The shape turned `rot` quarter-turns clockwise, moved so its top-left is (0, 0), sorted. */
export function turned(shape: FillShape, rot: number): [number, number][] {
  let cells = SHAPE_CELLS[shape].map(([r, c]) => [r, c] as [number, number]);
  for (let k = 0; k < ((rot % 4) + 4) % 4; k++) cells = cells.map(([r, c]) => [c, -r]);
  const r0 = Math.min(...cells.map((x) => x[0])), c0 = Math.min(...cells.map((x) => x[1]));
  return cells.map(([r, c]) => [r - r0, c - c0] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** The distinct orientations of a shape (an O has one, an I two). */
export function orientations(shape: FillShape): [number, number][][] {
  const seen = new Set<string>();
  const out: [number, number][][] = [];
  for (let r = 0; r < 4; r++) {
    const cells = turned(shape, r);
    const k = JSON.stringify(cells);
    if (!seen.has(k)) (seen.add(k), out.push(cells));
  }
  return out;
}

/** A piece on the grid: from the tray (`tray` index, its price) or a 自己人 (a person, free); Kuro's free cells have neither. */
export interface FillPiece {
  readonly id: number;
  readonly cells: readonly number[];
  readonly price: number;
  readonly tray?: number;
  readonly shape?: FillShape;
  readonly person?: FillPerson;
  readonly kuro?: boolean;
}
export type FillPick = { readonly kind: "piece"; readonly tray: number } | { readonly kind: "person"; readonly person: FillPerson };

export interface FillGame {
  readonly key: string;
  /** 0-based. */
  readonly round: number;
  readonly placed: readonly FillPiece[];
  /** People spent in earlier rounds (this round's are in `placed` until it ends). */
  readonly used: readonly FillPerson[];
  readonly pick: FillPick | null;
  readonly rot: number;
  /** The last round's pieces and its size, drawn faint under the grown grid for a beat. */
  readonly prev: { readonly size: number; readonly placed: readonly FillPiece[] } | null;
  /** Spent in the rounds that ended. */
  readonly spentBefore: number;
  /** Kuro filled a round (the game is graded wrong). */
  readonly kuro: boolean;
  readonly done: boolean;
  readonly roundAt?: number;
  readonly approvedAt?: number;
  readonly nextId: number;
}

export const FILL_GROW_MS = 600;
export const FILL_DONE_MS = 2000;

export function fillStart(key: string, nowMs = 0): FillGame {
  return { key, round: 0, placed: [], used: [], pick: null, rot: 0, prev: null, spentBefore: 0, kuro: false, done: false, roundAt: nowMs, nextId: 1 };
}

export const roundOf = (b: FillBoard, g: Pick<FillGame, "round">): FillRound => b.rounds[Math.min(g.round, b.rounds.length - 1)]!;
export const spentNow = (g: Pick<FillGame, "placed">): number => g.placed.reduce((n, p) => n + p.price, 0);
export const leftOf = (b: FillBoard, g: FillGame, tray: number): number => (roundOf(b, g).pieces[tray]?.n ?? 0) - g.placed.filter((p) => p.tray === tray).length;
const covered = (g: Pick<FillGame, "placed">): Set<number> => new Set(g.placed.flatMap((p) => p.cells));
export const roundComplete = (b: FillBoard, g: FillGame): boolean => {
  const on = covered(g);
  return roundOf(b, g).cells.every((c) => on.has(c));
};

/** The people the tray offers now (greyed ones included, with whether each can still be used). 你 only once all others are used. */
export function peopleShown(b: FillBoard, g: FillGame): { person: FillPerson; free: boolean }[] {
  if (!roundOf(b, g).people) return [];
  const spent = new Set<FillPerson>([...g.used, ...g.placed.flatMap((p) => (p.person ? [p.person] : []))]);
  const others = b.people.filter((p) => p !== "me");
  const meShown = b.people.includes("me") && others.every((p) => spent.has(p));
  return b.people.filter((p) => p !== "me" || meShown).map((person) => ({ person, free: !spent.has(person) }));
}

/** The cells a pick covers when anchored (its top-left) at `cell`, or null when it leaves the grid. */
export function cellsAt(size: number, shape: FillShape, rot: number, cell: number): number[] | null {
  const r0 = Math.floor(cell / size), c0 = cell % size;
  const out: number[] = [];
  for (const [r, c] of turned(shape, rot)) {
    if (r0 + r >= size || c0 + c >= size) return null;
    out.push((r0 + r) * size + c0 + c);
  }
  return out;
}

export function fillPick(b: FillBoard, g: FillGame, pick: FillPick): FillGame {
  if (g.done) return g;
  if (pick.kind === "piece" && leftOf(b, g, pick.tray) <= 0) return g;
  if (pick.kind === "person" && !peopleShown(b, g).some((p) => p.person === pick.person && p.free)) return g;
  const same = g.pick && JSON.stringify(g.pick) === JSON.stringify(pick);
  return { ...g, pick: same ? null : pick };
}
export const fillRotate = (g: FillGame): FillGame => (g.done ? g : { ...g, rot: (g.rot + 1) % 4 });
export const fillDrop = (g: FillGame): FillGame => (g.pick ? { ...g, pick: null } : g);

/** Places the pick at `cell`: inside the grid, on no other piece, within the budget. Anything else changes nothing. */
export function fillPlace(b: FillBoard, g: FillGame, cell: number): FillGame {
  const pick = g.pick;
  if (g.done || !pick) return g;
  const round = roundOf(b, g);
  let piece: FillPiece;
  if (pick.kind === "person") {
    if (!peopleShown(b, g).some((p) => p.person === pick.person && p.free)) return g;
    piece = { id: g.nextId, cells: [cell], price: 0, person: pick.person };
  } else {
    const def = round.pieces[pick.tray];
    if (!def || leftOf(b, g, pick.tray) <= 0 || spentNow(g) + def.price > round.budget) return g;
    const cells = cellsAt(round.size, def.shape, g.rot, cell);
    if (!cells) return g;
    piece = { id: g.nextId, cells, price: def.price, tray: pick.tray, shape: def.shape };
  }
  if (cell < 0 || cell >= round.size * round.size) return g;
  const on = covered(g);
  if (piece.cells.some((c) => on.has(c))) return g;
  const placed = [...g.placed, piece];
  const next = { ...g, placed, nextId: g.nextId + 1 };
  // a used-up pick is dropped; a piece with more left stays in hand
  const keep = pick.kind === "piece" ? leftOf(b, next, pick.tray) > 0 : false;
  return { ...next, pick: keep ? pick : null };
}

/** Lifts a placed piece back to the tray (its price refunded, a person back) until the round ends. */
export function fillLift(g: FillGame, id: number): FillGame {
  if (g.done) return g;
  const p = g.placed.find((x) => x.id === id);
  if (!p || p.kuro) return g;
  return { ...g, placed: g.placed.filter((x) => x.id !== id) };
}

/** Nothing more can be done: 要求 cells left, no free person, no piece left that the budget can still buy. */
export function fillStuck(b: FillBoard, g: FillGame): boolean {
  if (g.done || roundComplete(b, g)) return false;
  if (peopleShown(b, g).some((p) => p.free)) return false;
  const round = roundOf(b, g);
  const left = round.budget - spentNow(g);
  return !round.pieces.some((d, i) => leftOf(b, g, i) > 0 && d.price <= left);
}

/** The round is covered: the next one starts (the old pieces faint for a beat), or after the last the game is done. */
export function fillNext(b: FillBoard, g: FillGame, nowMs = 0): FillGame {
  if (g.done || !roundComplete(b, g)) return g;
  const used = [...g.used, ...g.placed.flatMap((p) => (p.person ? [p.person] : []))];
  const spentBefore = g.spentBefore + spentNow(g);
  if (g.round >= b.rounds.length - 1) return { ...g, used, spentBefore, placed: g.placed, pick: null, done: true };
  return { ...g, round: g.round + 1, used, spentBefore, prev: { size: roundOf(b, g).size, placed: g.placed }, placed: [], pick: null, rot: 0, roundAt: nowMs };
}

/**
 * 让克总帮忙: Kuro covers the rest of this round in reading order with every person left, in order
 * (you last), then the cells still left with free pieces of no name; the round passes.
 */
export function fillKuro(b: FillBoard, g: FillGame, nowMs = 0): FillGame {
  if (g.done) return g;
  const round = roundOf(b, g);
  const on = covered(g);
  const gaps = [...round.cells].sort((x, y) => x - y).filter((c) => !on.has(c));
  const spent = new Set<FillPerson>([...g.used, ...g.placed.flatMap((p) => (p.person ? [p.person] : []))]);
  const people = b.people.filter((p) => !spent.has(p));
  let id = g.nextId;
  const added: FillPiece[] = [];
  const free = [...Array(round.size * round.size).keys()].filter((c) => !on.has(c) && !gaps.includes(c));
  people.forEach((person, i) => {
    const cell = i < gaps.length ? gaps[i] : free.shift();
    // every one of them is spent; one who finds no cell is still spent (the round has no room left)
    added.push({ id: id++, cells: cell === undefined ? [] : [cell], price: 0, person, kuro: true });
  });
  for (const cell of gaps.slice(people.length)) added.push({ id: id++, cells: [cell], price: 0, kuro: true });
  return fillNext(b, { ...g, placed: [...g.placed, ...added], nextId: id, pick: null, kuro: true }, nowMs);
}

// ——— the solver (tests, and the dev cheat) ———

export interface FillMove {
  readonly pick: FillPick;
  readonly rot: number;
  readonly cell: number;
}

/**
 * A way to cover a round's 要求 cells with its budget and at most `people` 自己人 (any of them), or
 * null. Depth-first on the first uncovered cell, pruned by the cheapest price per cell left.
 */
export function fillSolve(round: FillRound, people: number): FillMove[] | null {
  const n = round.size;
  const req = [...round.cells].sort((a, b) => a - b);
  const left = round.pieces.map((p) => p.n);
  const options = round.pieces.map((p) => orientations(p.shape).map((cells) => ({ cells, rot: [0, 1, 2, 3].find((r) => JSON.stringify(turned(p.shape, r)) === JSON.stringify(cells))! })));
  const on = new Set<number>();
  const moves: FillMove[] = [];
  const perCell = (i: number) => round.pieces[i]!.price / SHAPE_CELLS[round.pieces[i]!.shape].length;
  const go = (budget: number, persons: number): boolean => {
    const first = req.find((c) => !on.has(c));
    if (first === undefined) return true;
    const gap = req.filter((c) => !on.has(c)).length;
    const cheapest = Math.min(Infinity, ...round.pieces.map((_, i) => (left[i]! > 0 ? perCell(i) : Infinity)));
    if (gap - persons > 0 && (gap - persons) * cheapest > budget + 1e-9) return false;
    if (persons > 0) {
      on.add(first);
      moves.push({ pick: { kind: "person", person: "me" }, rot: 0, cell: first });
      if (go(budget, persons - 1)) return true;
      moves.pop();
      on.delete(first);
    }
    const fr = Math.floor(first / n), fc = first % n;
    for (let i = 0; i < round.pieces.length; i++) {
      const def = round.pieces[i]!;
      if (left[i]! <= 0 || def.price > budget) continue;
      for (const o of options[i]!) {
        for (const [dr, dc] of o.cells) {
          const ar = fr - dr, ac = fc - dc;
          if (ar < 0 || ac < 0) continue;
          const cells = o.cells.map(([r, c]) => [ar + r, ac + c] as const);
          if (cells.some(([r, c]) => r >= n || c >= n)) continue;
          const ids = cells.map(([r, c]) => r * n + c);
          if (ids.some((c) => on.has(c))) continue;
          ids.forEach((c) => on.add(c));
          left[i]!--;
          moves.push({ pick: { kind: "piece", tray: i }, rot: o.rot, cell: ar * n + ac });
          if (go(budget - def.price, persons)) return true;
          moves.pop();
          left[i]!++;
          ids.forEach((c) => on.delete(c));
        }
      }
    }
    return false;
  };
  return go(round.budget, people) ? moves : null;
}

/** The fewest 自己人 a round needs (0 … max), or null when even `max` is not enough. */
export function fillPeopleNeeded(round: FillRound, max: number): number | null {
  for (let p = 0; p <= max; p++) if (fillSolve(round, p)) return p;
  return null;
}

/** The current round solved through the engine (the dev cheat): the solver's moves, the people by name; else Kuro's fill. */
export function fillSolveRound(b: FillBoard, g: FillGame, nowMs = 0): FillGame {
  const round = roundOf(b, g);
  const cleared: FillGame = { ...g, placed: [], pick: null };
  // everyone not spent in an earlier round can be used this round (你 shows once the others are placed)
  const avail = round.people ? b.people.filter((p) => !g.used.includes(p)).length : 0;
  const need = fillPeopleNeeded(round, avail);
  const moves = need === null ? null : fillSolve(round, need);
  if (!moves) return fillKuro(b, cleared, nowMs);
  let cur = cleared;
  for (const m of moves) {
    const pick: FillPick = m.pick.kind === "person" ? { kind: "person", person: peopleShown(b, cur).find((p) => p.free)?.person ?? "me" } : m.pick;
    cur = fillPlace(b, { ...fillPick(b, { ...cur, pick: null }, pick), rot: m.rot }, m.cell);
  }
  return roundComplete(b, cur) ? fillNext(b, cur, nowMs) : fillKuro(b, cleared, nowMs);
}

export const fillApproving = (g: Pick<FillGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < FILL_DONE_MS;

// ——— how it ended, in the log ———

/** The `open` target that records the game's end: what was spent, whether Kuro filled, the people spent. */
export const fillTarget = (taskId: string, g: Pick<FillGame, "spentBefore" | "kuro" | "used">): string => `fill:${taskId}:${String(g.spentBefore)}:${g.kuro ? "kuro" : "self"}:${g.used.join("+") || "-"}`;

export interface FillRecord {
  readonly spent: number;
  readonly kuro: boolean;
  readonly people: readonly FillPerson[];
}
/** The record of today's fill on a task, from the log (null: not finished). */
export function fillRecord(events: readonly GameEvent[], day: number, taskId: string): FillRecord | null {
  for (const e of [...events].reverse()) {
    if (e.kind !== "open" || e.day !== day) continue;
    const m = /^fill:(.+):(\d+):(kuro|self):(.+)$/.exec(e.target);
    if (!m || m[1] !== taskId) continue;
    return { spent: Number(m[2]), kuro: m[3] === "kuro", people: m[4] === "-" ? [] : (m[4]!.split("+") as FillPerson[]) };
  }
  return null;
}

// ——— the screen: the cost sheet's paper ———

/** A person's name tag: the NPC's own name, you by your login. */
export function personName(p: FillPerson, names: Pick<State["names"], "login">): string {
  if (p === "me") return names.login.trim() || S("who.me");
  return S(`msgs.${p}`) || p;
}

const shapeMini = (shape: FillShape): SafeHtml => {
  const cells = SHAPE_CELLS[shape];
  const h = Math.max(...cells.map((c) => c[0])) + 1, w = Math.max(...cells.map((c) => c[1])) + 1;
  const on = new Set(cells.map(([r, c]) => r * w + c));
  return html`<span class="fl-mini" style="--w:${String(w)};--h:${String(h)}">${[...Array(w * h).keys()].map((i) => html`<i class="${cls(on.has(i) && "on")}"></i>`)}</span>`;
};

export function fillStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly fill: FillGame | null }, approved: boolean, nowMs: number, names: Pick<State["names"], "login">): SafeHtml {
  void s;
  const b = board.game as FillBoard;
  const g: FillGame | null = session.fill?.key === task.id ? session.fill : null;
  const done = approved || g?.done === true;
  const round = g ? roundOf(b, g) : b.rounds[0]!;
  const n = round.size;
  const total = b.rounds.length;
  const req = new Set(round.cells);
  const owner = new Map<number, FillPiece>();
  for (const p of g?.placed ?? []) for (const c of p.cells) owner.set(c, p);
  const grow = g?.roundAt !== undefined && g.round > 0 && nowMs - g.roundAt >= 0 && nowMs - g.roundAt < FILL_GROW_MS;
  const pos = (i: number) => `${String(Math.floor(i / n) + 1)},${String((i % n) + 1)}`;
  const cells = [...Array(n * n).keys()].map((i) => {
    const p = owner.get(i);
    const tag = p?.person ? html`<b class="fl-tag">${personName(p.person, names)}</b>` : null;
    const inner = html`${tag}`;
    if (p && !done) return html`<button type="button" class="${cls("fl-cell", req.has(i) && "req", "on", p.person && "person", p.kuro && "kuro", p.shape && `s-${p.shape}`)}" data-action="fill-lift" data-piece="${String(p.id)}" aria-label="${pos(i)}">${inner}</button>`;
    if (p) return html`<i class="${cls("fl-cell", req.has(i) && "req", "on", p.person && "person", p.kuro && "kuro", p.shape && `s-${p.shape}`)}">${inner}</i>`;
    return g && !done && g.pick
      ? html`<button type="button" class="${cls("fl-cell", req.has(i) && "req")}" data-action="fill-place" data-cell="${String(i)}" aria-label="${pos(i)}"></button>`
      : html`<i class="${cls("fl-cell", req.has(i) && "req")}"></i>`;
  });
  const ghost = grow && g?.prev ? html`<div class="fl-prev" style="--n:${String(g.prev.size)};--of:${String(n)}" aria-hidden="true">${[...Array(g.prev.size * g.prev.size).keys()].map((i) => html`<i class="${cls(g.prev!.placed.some((p) => p.cells.includes(i)) && "on")}"></i>`)}</div>` : null;
  const grid = html`<div class="${cls("fl-grid", grow && "grow")}" style="--n:${String(n)}">${cells}${ghost}</div>`;
  const spent = g ? spentNow(g) : 0;
  const top = html`<header class="fl-top"><div class="cs-title"><h2>${S("fill.round", { n: String((g?.round ?? 0) + 1), total: String(total) })}</h2></div><div class="fl-total"><span>${S("fill.budget", { n: String(round.budget) })}</span><b>${S("fill.spent", { n: String(spent) })}</b></div></header>`;
  // the tray: price tags; the 自己人 as name tags
  const left = round.budget - spent;
  const tags = round.pieces.map((d, i) => {
    const count = g ? leftOf(b, g, i) : d.n;
    const on = g?.pick?.kind === "piece" && g.pick.tray === i;
    const off = !g || done || count <= 0 || d.price > left;
    return html`<button type="button" class="${cls("fl-price", on && "picked")}" data-action="fill-pick" data-tray="${String(i)}"${off && !on ? html` disabled` : null}>${shapeMini(d.shape)}<span class="fl-yen">¥${String(d.price)}</span><span class="fl-n">×${String(count)}</span></button>`;
  });
  const people = g ? peopleShown(b, g) : [];
  const ppl = people.length
    ? html`<div class="fl-people"><span class="fl-people-h">${S("fill.people")}</span>${people.map(({ person, free }) => html`<button type="button" class="${cls("fl-name", !free && "used", g?.pick?.kind === "person" && g.pick.person === person && "picked")}" data-action="fill-pick" data-person="${person}"${free && !done ? null : html` disabled`}>${personName(person, names)}</button>`)}</div>`
    : null;
  const tray = html`<aside class="fl-tray">${tags}${ppl}</aside>`;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("stack.stage.approved")}</span></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="fill-start">${S("fill.start")}</button>`;
  else {
    const complete = roundComplete(b, g);
    const stuck = fillStuck(b, g);
    foot = html`<div class="fl-ctl"><button type="button" class="mn-mode" data-action="fill-rotate">⟳ ${S("fill.rotate")}</button>${complete ? html`<button type="button" class="wl-cta" data-action="fill-next">${S("fill.next")}</button>` : null}${stuck && hasString("settle.kuro") ? html`<button type="button" class="wl-cta ghost" data-action="fill-assist">${S("settle.kuro")}</button>` : null}</div>`;
  }
  const cheat = import.meta.env.DEV && g && !done ? html`<button type="button" class="sk-cheat" data-action="fill-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  return html`<div class="${cls("fl", done && "done")}" data-screen="fill" data-round="${String((g?.round ?? 0) + 1)}">${top}<div class="fl-main"><div class="fl-sheet">${grid}</div>${tray}</div><div class="fl-foot">${foot}${cheat}</div></div>`;
}

/** The settlement's real sheet: the 人 rows, the ones spent struck through, and the sum line. */
export function fillSheet(b: FillBoard, rec: FillRecord | null, names: Pick<State["names"], "login">): SafeHtml {
  const spent = new Set(rec?.people ?? []);
  const rows = b.people.map((p) => html`<li class="${cls("fl-row", spent.has(p) && "struck")}">${S(`settle.fill.row.${p}`, { name: personName(p, names) })}</li>`);
  const budget = b.rounds.reduce((n, r) => n + r.budget, 0);
  const sum = rec && hasString("settle.fill.sum") ? html`<p class="fl-sum">${t("settle.fill.sum", { budget: String(budget), spent: String(rec.spent), n: String(rec.people.length) })}</p>` : null;
  return html`<article class="st-sheet fl-real"><header class="st-head"><div class="st-titles"><h2 class="st-title">${S("settle.fill.title")}</h2></div></header><ol class="fl-rows">${rows}</ol>${sum}</article>`;
}

export { FILL_SHAPES };
