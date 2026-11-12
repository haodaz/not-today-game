// The approval chain as 2048 (author 2026-11-12: 「某个任务的游戏模式是 2048…审批流，不断向上汇报…72 柱神
// 层级很多的世界，得起码从 2 merge 到 2048，每个状态是一个不同的魔神头像」). Day 13's 借阅审批单: once the
// form is filled, it goes up the chain — a 4×4 board of approvers; two of the same rank merge into the
// rank above; the form is approved when the top rank appears. The grid lives in the session (the
// moves are not game state); reaching the target records one `approve` step on the board, which the
// hand-in needs. The ranks (name + head) come from the board's `stack`.
import type { BoardStack, Task, TaskBoard } from "@state/days/tasks";
import type { Session } from "../model";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");

export interface StackGrid {
  readonly key: string;
  readonly cells: readonly number[]; // 16, 0 = empty, else 2, 4, 8…
  readonly score: number;
  readonly moves: number;
  readonly over: boolean;
  /**
   * work-stages-polish 3: where each cell's tile was before the last move (its cell index; -1 = it
   * was not on the board: spawned, or the start), and which cells merged in it. Absent = no move yet.
   */
  readonly from?: readonly number[];
  readonly merged?: readonly boolean[];
  /** Session ms of the last change (the move's slide plays only just after it). */
  readonly at?: number;
  /** Session ms the top rank appeared (the approval moment). */
  readonly approvedAt?: number;
}

/** A swipe shorter than this (px, along its main axis) is no move. */
export const SWIPE_MIN_PX = 24;
/** The slide between cells (as 2048 does). */
export const SLIDE_MS = 120;
/** How long after a move its slide may still be drawn (a later repaint shows the tiles still). */
export const SLIDE_WINDOW_MS = 400;
/** The approval moment: the top tile pulses twice and 批下来了 shows, then the board comes back. */
export const APPROVE_MS = 1_600;

/** A swipe's direction from its travel (dx right, dy down); null under the threshold. */
export function swipeDir(dx: number, dy: number, min: number = SWIPE_MIN_PX): StackDir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < min || ax === ay) return null;
  return ax > ay ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/** The approval moment is still on (the stack screen stays up, approved). */
export function approving(g: Pick<StackGrid, "approvedAt"> | null, nowMs: number): boolean {
  return g?.approvedAt !== undefined && nowMs - g.approvedAt < APPROVE_MS;
}

const N = 4;

/** A fresh grid with two starting approvers (the clerk, twice). */
export function stackStart(key: string, rnd: () => number = Math.random): StackGrid {
  let g: StackGrid = { key, cells: Array(N * N).fill(0), score: 0, moves: 0, over: false };
  g = spawn(spawn(g, rnd), rnd);
  return g;
}

function spawn(g: StackGrid, rnd: () => number): StackGrid {
  const empty = g.cells.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  if (!empty.length) return g;
  const at = empty[Math.floor(rnd() * empty.length)]!;
  const cells = [...g.cells];
  cells[at] = rnd() < 0.9 ? 2 : 4;
  return { ...g, cells };
}

/**
 * One line slid toward its start, merging equal neighbours once; returns the line, the score gained,
 * and for each place the cell its tile came from (`idx[k]` of the first source; -1 empty) and merged.
 */
function slide(row: readonly number[], idx: readonly number[]): { row: number[]; gained: number; src: number[]; merged: boolean[] } {
  const xs = row.map((v, k) => ({ v, at: idx[k]! })).filter((x) => x.v !== 0);
  const out: number[] = [];
  const src: number[] = [];
  const merged: boolean[] = [];
  let gained = 0;
  for (let i = 0; i < xs.length; i++) {
    if (i + 1 < xs.length && xs[i]!.v === xs[i + 1]!.v) {
      out.push(xs[i]!.v * 2);
      gained += xs[i]!.v * 2;
      src.push(xs[i]!.at);
      merged.push(true);
      i++;
    } else {
      out.push(xs[i]!.v);
      src.push(xs[i]!.at);
      merged.push(false);
    }
  }
  while (out.length < N) {
    out.push(0);
    src.push(-1);
    merged.push(false);
  }
  return { row: out, gained, src, merged };
}

export type StackDir = "up" | "down" | "left" | "right";

/** A move: every line slides toward `dir`; a changed grid spawns one more approver. Unchanged: the same grid. */
export function stackMove(g: StackGrid, dir: StackDir, rnd: () => number = Math.random): StackGrid {
  if (g.over) return g;
  const cells = [...g.cells];
  let gained = 0;
  const lines: number[][] = [];
  for (let a = 0; a < N; a++) {
    const idx: number[] = [];
    for (let b = 0; b < N; b++) {
      const r = dir === "up" ? b : dir === "down" ? N - 1 - b : a;
      const c = dir === "left" ? b : dir === "right" ? N - 1 - b : a;
      idx.push(r * N + c);
    }
    lines.push(idx);
  }
  const from: number[] = Array(N * N).fill(-1);
  const merged: boolean[] = Array(N * N).fill(false);
  for (const idx of lines) {
    const { row, gained: gn, src, merged: m } = slide(idx.map((i) => cells[i]!), idx);
    idx.forEach((i, k) => {
      cells[i] = row[k]!;
      from[i] = src[k]!;
      merged[i] = m[k]!;
    });
    gained += gn;
  }
  const changed = cells.some((v, i) => v !== g.cells[i]);
  if (!changed) return g;
  // the spawned tile has no source (-1): it pops in after the slide
  let next: StackGrid = { ...g, cells, score: g.score + gained, moves: g.moves + 1, from, merged };
  next = spawn(next, rnd);
  const stuck = (["up", "down", "left", "right"] as const).every((d) => !canMove(next, d));
  return stuck ? { ...next, over: true } : next;
}

function canMove(g: StackGrid, dir: StackDir): boolean {
  const probe = stackMove({ ...g, over: false }, dir, () => 0);
  return probe !== g && probe.cells.some((v, i) => v !== g.cells[i]);
}

export const stackBest = (g: StackGrid): number => Math.max(0, ...g.cells);
/** The value that approves the form: the board's target, else the top rank. */
export const stackTarget = (st: BoardStack): number => st.target ?? 2 ** st.ranks.length;
export const rankOf = (v: number): number => (v <= 0 ? -1 : Math.round(Math.log2(v)) - 1);

/** The approval screen's body (inside the work stage's frame). */
export function stackStage(task: Task, board: TaskBoard, session: Pick<Session, "chain"> & Partial<Pick<Session, "reducedMotion">>, approved: boolean, nowMs = 0): SafeHtml {
  const st = board.stack!;
  const key = `${task.id}`;
  const g: StackGrid | null = session.chain?.key === key ? session.chain : null;
  // work-stages-polish 3: the last move slides (120 ms) just after it; merges and new tiles pop;
  // the approval moment pulses the top tile twice. Nothing moves under reduced motion.
  const still = session.reducedMotion === true;
  const fresh = !still && g?.at !== undefined && nowMs - g.at >= 0 && nowMs - g.at < SLIDE_WINDOW_MS;
  const won = approved && approving(g, nowMs);
  const best = g ? stackBest(g) : 0;
  const bestRank = Math.min(st.ranks.length - 1, Math.max(0, rankOf(best)));
  const top = html`<header class="sk-top"><div class="cs-title"><span class="cs-kick">${S("stack.stage.kick")}</span><h2>${S("stack.stage.title")}</h2><span class="sk-sub">${S("stack.stage.sub", { target: st.ranks[rankOf(stackTarget(st))]?.name ?? "" })}</span></div><div class="sk-score"><span>${S("stack.stage.moves", { n: String(g?.moves ?? 0) })}</span><b>${S("stack.stage.best")} ${st.ranks[bestRank]?.name ?? ""}</b></div></header>`;
  const target = stackTarget(st);
  const ladder = html`<aside class="sk-ladder">${st.ranks.map((r, i) => html`<div class="${cls("sk-rank", i <= bestRank && best > 0 && "seen", 2 ** (i + 1) === target && "top", 2 ** (i + 1) === target && approved && "lit", r.silhouette && "egg")}"><img src="${r.img}" alt=""><span class="sk-rn">${r.silhouette && !(i <= bestRank && best > 0) ? "?" : r.name}</span><small>${2 ** (i + 1)}</small></div>`)}</aside>`;
  const tiles = (g?.cells ?? Array(N * N).fill(0)).map((v, i) => {
    if (v === 0) return html`<div class="sk-cell"></div>`;
    const r = st.ranks[Math.min(st.ranks.length - 1, rankOf(v))]!;
    const motion = fresh ? tileMotion(g!, i) : null;
    const style = motion?.kind === "slide" || motion?.kind === "merge" ? html` style="--dx:${String(motion.dx)};--dy:${String(motion.dy)}"` : null;
    return html`<div class="${cls("sk-cell", "on", `r-${Math.min(st.ranks.length - 1, rankOf(v))}`, v >= target && "top", v >= target && won && "won", r.silhouette && "egg", motion?.kind)}"${style}><img src="${r.img}" alt=""><span class="sk-n">${r.name}</span></div>`;
  });
  const dirs: StackDir[] = ["up", "left", "down", "right"];
  const arrows = (["up", "left", "down", "right"] as const).map((d) => html`<button type="button" class="${cls("sk-arrow", d)}" data-action="stack-move" data-dir="${d}" aria-label="${d}"${!g || g.over || approved ? html` disabled` : null}>${d === "up" ? "↑" : d === "down" ? "↓" : d === "left" ? "←" : "→"}</button>`);
  void dirs;
  const state = approved
    ? html`<div class="sk-done">${S("stack.stage.approved")}</div>`
    : !g
      ? html`<button type="button" class="ts-act" data-action="stack-start">${S("stack.stage.start")}</button>`
      : g.over
        ? html`<div class="sk-over">${S("stack.stage.over")}<button type="button" class="wl-cta ghost" data-action="stack-start">${S("stack.stage.again")}</button></div>`
        : html`<div class="sk-pad">${arrows}</div>`;
  // dev only: the replay driver's way through (a real player plays)
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="stack-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  // the chain is stuck and not approved (author 2026-11-13): the one way out is Kuro — he stamps it himself
  const assist = g && g.over && !approved ? html`<div class="sk-stuck"><p>${S("settle.fail")}</p><button type="button" class="wl-cta ghost" data-action="stack-assist">${S("settle.kuro")}</button></div>` : null;
  const grid = html`<div class="sk-board"><div class="sk-grid">${tiles}</div>${state}${cheat}${assist}</div>`;
  return html`<div class="${cls("sk", still && "still", approved && "approved")}">${top}<div class="sk-main">${ladder}${grid}</div></div>`;
}

/**
 * How cell `i`'s tile arrives after the last change: slid from another cell (`dx`, `dy` in cells),
 * slid and merged (pops after the slide), new (spawned or the start: pops after the slide), or
 * stayed (null).
 */
export function tileMotion(g: Pick<StackGrid, "cells" | "from" | "merged">, i: number): { kind: "slide" | "merge"; dx: number; dy: number } | { kind: "born" } | null {
  if (!g.cells[i]) return null;
  const f = g.from?.[i] ?? -1;
  if (f < 0) return { kind: "born" };
  const dx = (f % N) - (i % N);
  const dy = Math.floor(f / N) - Math.floor(i / N);
  if (g.merged?.[i]) return { kind: "merge", dx, dy };
  return dx === 0 && dy === 0 ? null : { kind: "slide", dx, dy };
}

export type { BoardStack };
