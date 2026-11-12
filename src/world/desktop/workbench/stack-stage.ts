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

/** One row slid toward its start, merging equal neighbours once; returns the row and the score gained. */
function slide(row: readonly number[]): { row: number[]; gained: number } {
  const xs = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < xs.length; i++) {
    if (i + 1 < xs.length && xs[i] === xs[i + 1]) {
      out.push(xs[i]! * 2);
      gained += xs[i]! * 2;
      i++;
    } else out.push(xs[i]!);
  }
  while (out.length < N) out.push(0);
  return { row: out, gained };
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
  for (const idx of lines) {
    const { row, gained: gn } = slide(idx.map((i) => cells[i]!));
    idx.forEach((i, k) => (cells[i] = row[k]!));
    gained += gn;
  }
  const changed = cells.some((v, i) => v !== g.cells[i]);
  if (!changed) return g;
  let next: StackGrid = { ...g, cells, score: g.score + gained, moves: g.moves + 1 };
  next = spawn(next, rnd);
  const stuck = (["up", "down", "left", "right"] as const).every((d) => !canMove(next, d));
  return stuck ? { ...next, over: true } : next;
}

function canMove(g: StackGrid, dir: StackDir): boolean {
  const probe = stackMove({ ...g, over: false }, dir, () => 0);
  return probe !== g && probe.cells.some((v, i) => v !== g.cells[i]);
}

export const stackBest = (g: StackGrid): number => Math.max(0, ...g.cells);
export const rankOf = (v: number): number => (v <= 0 ? -1 : Math.round(Math.log2(v)) - 1);

/** The approval screen's body (inside the work stage's frame). */
export function stackStage(task: Task, board: TaskBoard, session: Pick<Session, "chain">, approved: boolean): SafeHtml {
  const st = board.stack!;
  const key = `${task.id}`;
  const g = session.chain?.key === key ? session.chain : null;
  const best = g ? stackBest(g) : 0;
  const bestRank = Math.min(st.ranks.length - 1, Math.max(0, rankOf(best)));
  const top = html`<header class="sk-top"><div class="cs-title"><span class="cs-kick">${S("stack.stage.kick")}</span><h2>${S("stack.stage.title")}</h2><span class="sk-sub">${S("stack.stage.sub", { target: st.ranks[st.ranks.length - 1]?.name ?? "" })}</span></div><div class="sk-score"><span>${S("stack.stage.moves", { n: String(g?.moves ?? 0) })}</span><b>${S("stack.stage.best")} ${st.ranks[bestRank]?.name ?? ""}</b></div></header>`;
  const ladder = html`<aside class="sk-ladder">${st.ranks.map((r, i) => html`<div class="${cls("sk-rank", i <= bestRank && best > 0 && "seen", i === st.ranks.length - 1 && "top")}"><img src="${r.img}" alt=""><span class="sk-rn">${r.name}</span><small>${2 ** (i + 1)}</small></div>`)}</aside>`;
  const tiles = (g?.cells ?? Array(N * N).fill(0)).map((v) => {
    if (v === 0) return html`<div class="sk-cell"></div>`;
    const r = st.ranks[Math.min(st.ranks.length - 1, rankOf(v))]!;
    return html`<div class="${cls("sk-cell", "on", `r-${Math.min(st.ranks.length - 1, rankOf(v))}`)}"><img src="${r.img}" alt="">${v >= 2 ** st.ranks.length ? null : html`<span class="sk-v">${v}</span>`}<span class="sk-n">${r.name}</span></div>`;
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
  const grid = html`<div class="sk-board"><div class="sk-grid">${tiles}</div>${state}</div>`;
  return html`<div class="sk">${top}<div class="sk-main">${ladder}${grid}</div></div>`;
}

export type { BoardStack };
