// Balance (author 2026-11-13: 「天平 / 叠叠乐」 for 成本表 · 称平, day 11): once the form is filled, the cost
// table is a balance scale. The prices hang from a crane that swings left and right; tap and the
// block drops onto whichever pan is under it — Tower Bloxx with two towers. Oil and wine are welded
// to the pans, one each side, and cannot be moved (老王 said). Every block placed and the beam level
// = 称平: the form approved (the chain's `approve` step). A block that lands off the pan's centre is
// 歪; three of those and the stacks fall; the beam still tilted at the end is 没称平 (重来 / 让克总帮忙).
// The one surprise: level, the pointer keeps moving — something is still being weighed. Time-based
// crane; the actions keep the scale in the session and run the clock for the pause.
import type { BoardGame, Task, TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { cardText } from "./board";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : "");
type Game = Extract<BoardGame, { kind: "balance" }>;
export type Side = "l" | "r";

export interface Block { readonly label: string; readonly w: number }
export interface Placed extends Block { readonly side: Side; readonly off: number; readonly bad: boolean }
export interface BalanceGame {
  readonly key: string;
  readonly blocks: readonly Block[];
  readonly placed: readonly Placed[];
  /** The welded weight on each pan (oil left, wine right): equal, immovable. */
  readonly fixed: number;
  readonly startAt: number;
  readonly pausedAt: number | null;
  readonly done: boolean;
  readonly over: boolean;
  readonly fell: boolean;
  readonly gen: number;
  readonly running: boolean;
  readonly approvedAt?: number;
}

export const BALANCE_PERIOD_MS = 2400;
export const BALANCE_TICK_MS = 250;
export const BALANCE_DONE_MS = 2000;
/** The pans' centres on the crane's axis (-1 .. 1) and how far off still lands square. */
export const PAN_X = 0.62;
export const PAN_OK = 0.3;
export const WOBBLES_TO_FALL = 3;
/** Level enough: the pans' weights differ by at most this. */
export const BALANCE_TOLERANCE = 1;

/** The prices to weigh, from the strings: "label:weight,…". */
export const balanceBlocks = (): readonly Block[] =>
  (S("balance.blocks") || "麦子:3,大麦:1,盐:2,柴:2,布:4,鱼:1,米:3,肉:4").split(",").map((p) => p.trim()).filter(Boolean).map((p) => { const [label, w] = p.split(":"); return { label: (label ?? "").trim(), w: Math.max(1, Number(w) || 1) }; });

export function balanceStart(key: string, game: Game, blocks: readonly Block[], gen: number, nowMs: number): BalanceGame {
  return { key, blocks, placed: [], fixed: game.fixed, startAt: nowMs, pausedAt: null, done: false, over: false, fell: false, gen, running: false };
}

export const elapsed = (g: BalanceGame, nowMs: number): number => (g.pausedAt ?? nowMs) - g.startAt;
/** Where the crane's block is now: -1 (far left) .. 1 (far right). */
export const craneX = (g: BalanceGame, nowMs: number): number => Math.sin((2 * Math.PI * elapsed(g, nowMs)) / BALANCE_PERIOD_MS);
export const weight = (g: BalanceGame, side: Side): number => g.fixed + g.placed.filter((p) => p.side === side).reduce((a, p) => a + p.w, 0);
/** The beam's tilt, degrees, right side down when positive. */
export const tilt = (g: BalanceGame): number => Math.max(-28, Math.min(28, (weight(g, "r") - weight(g, "l")) * 6));
export const nextBlock = (g: BalanceGame): Block | null => g.blocks[g.placed.length] ?? null;

/** The tap: the hanging block drops onto the pan under it; off the pan's centre it is 歪. The last block judges the scale. */
export function balanceDrop(g: BalanceGame, nowMs: number): BalanceGame {
  if (g.done || g.over || g.pausedAt !== null) return g;
  const block = nextBlock(g);
  if (!block) return g;
  const x = craneX(g, nowMs);
  const side: Side = x < 0 ? "l" : "r";
  const off = Math.abs(Math.abs(x) - PAN_X);
  const bad = off > PAN_OK;
  const placed = [...g.placed, { ...block, side, off, bad }];
  const next = { ...g, placed };
  if (placed.filter((p) => p.bad).length >= WOBBLES_TO_FALL) return { ...next, over: true, fell: true, running: false };
  if (placed.length === g.blocks.length) {
    const level = Math.abs(weight(next, "l") - weight(next, "r")) <= BALANCE_TOLERANCE;
    return { ...next, done: level, over: !level, running: false };
  }
  return next;
}

export const balancePause = (g: BalanceGame, nowMs: number): BalanceGame => (g.pausedAt !== null || g.done || g.over ? g : { ...g, pausedAt: nowMs, running: false });
export const balanceResume = (g: BalanceGame, nowMs: number, gen: number): BalanceGame => (g.pausedAt === null ? { ...g, gen } : { ...g, startAt: g.startAt + (nowMs - g.pausedAt), pausedAt: null, gen });

/** The solved scale (dev / Kuro): every block placed square, the pans level. */
export function balanceSolve(g: BalanceGame): BalanceGame {
  const placed: Placed[] = [];
  let l = 0, r = 0;
  // the heavy ones first, each onto the lighter pan: level for any sensible set of prices
  for (const b of [...g.blocks].sort((a, c) => c.w - a.w)) { const side: Side = l <= r ? "l" : "r"; if (side === "l") l += b.w; else r += b.w; placed.push({ ...b, side, off: 0, bad: false }); }
  return { ...g, placed, done: true, over: false, fell: false, running: false, pausedAt: null };
}

export const balanceApproving = (g: Pick<BalanceGame, "approvedAt"> | null, nowMs: number): boolean => g?.approvedAt !== undefined && nowMs - g.approvedAt < BALANCE_DONE_MS;

// ——— the screen ———

const stack = (g: BalanceGame, side: Side, welded: string): SafeHtml => html`<div class="${cls("bl-stack", side)}"><i class="bl-block welded" style="--w:${String(g.fixed)}"><b>${welded}</b></i>${g.placed.filter((p) => p.side === side).map((p) => html`<i class="${cls("bl-block", p.bad && "bad")}" style="--w:${String(p.w)};--off:${String(p.off.toFixed(2))}"><b>${p.label}</b><small>${String(p.w)}</small></i>`)}</div>`;

export function balanceStage(task: Task, board: TaskBoard, s: BoardState, session: { readonly balance: BalanceGame | null }, approved: boolean, nowMs: number): SafeHtml {
  const game = board.game as Game;
  const g: BalanceGame | null = session.balance?.key === task.id ? session.balance : null;
  const done = approved && (!g || balanceApproving(g, nowMs) || g.done);
  const block = g && !g.done && !g.over ? nextBlock(g) : null;
  // the crane swings by CSS; a negative delay puts the block where the clock says, so a re-render never jumps it
  const crane = html`<div class="bl-crane"><div class="bl-rail"></div>${block ? html`<div class="bl-hang" style="animation-delay:${String(-Math.round(elapsed(g!, nowMs)))}ms;${g!.pausedAt !== null ? "animation-play-state:paused" : ""}"><i class="bl-rope"></i><i class="bl-block hung" style="--w:${String(block.w)}"><b>${block.label}</b><small>${String(block.w)}</small></i></div>` : null}</div>`;
  const angle = g ? tilt(g) : 0;
  const scale = html`<div class="${cls("bl-scale", g?.fell && "fell", done && "drift")}"><div class="bl-beam" style="--tilt:${String(angle)}deg"><div class="bl-pan l">${g ? stack(g, "l", S("balance.stage.oil")) : null}</div><div class="bl-pan r">${g ? stack(g, "r", S("balance.stage.wine")) : null}</div></div><i class="bl-pointer" style="--tilt:${String(angle)}deg"></i><div class="bl-post"></div><div class="bl-base"></div></div>`;
  const notes = board.slots.map((slot) => html`<li class="mn-note"><b>${slot.label}</b><span>${slot.id in s.slots ? cardText(board, s.slots[slot.id]!) : ""}</span></li>`);
  const bads = g?.placed.filter((p) => p.bad).length ?? 0;
  let foot: SafeHtml;
  if (done) foot = html`<div class="mn-state won"><span class="mn-stamp">${S("balance.stage.won")}</span><p class="pp-flowline">${S("balance.stage.left")}</p></div>`;
  else if (!g) foot = html`<button type="button" class="wl-cta" data-action="balance-start">${S("balance.stage.start")}</button>`;
  else if (g.over) foot = html`<div class="mn-state lost"><p>${S(g.fell ? "balance.stage.fell" : "balance.stage.lost")}</p><button type="button" class="wl-cta ghost" data-action="balance-assist">${S("settle.kuro")}</button><button type="button" class="wl-cta ghost" data-action="balance-start">${S("balance.stage.again")}</button></div>`;
  else foot = html`<div class="mn-ctl bl-ctl"><span class="mn-left">${S("balance.stage.count", { n: String(g.placed.length), of: String(g.blocks.length) })} · ${S("balance.stage.weights", { l: String(weight(g, "l")), r: String(weight(g, "r")) })}${bads ? html`<span class="sn-broke"> · ${S("balance.stage.bad", { n: String(bads), of: String(WOBBLES_TO_FALL) })}</span>` : null}</span>${g.running ? html`<button type="button" class="bl-drop" data-action="balance-drop">${S("balance.stage.drop")}</button>` : html`<button type="button" class="mn-mode" data-action="balance-resume">${S("balance.stage.resume")}</button>`}<span class="sn-hint">${S("balance.stage.keys")}</span></div>`;
  const cheat = import.meta.env.DEV && g && !approved ? html`<button type="button" class="sk-cheat" data-action="balance-cheat" aria-hidden="true" tabindex="-1"></button>` : null;
  void game;
  return html`<div class="${cls("mn bl", done && "done", g?.over && "lost")}" data-screen="balance">
    <header class="mn-top"><div class="cs-title"><span class="cs-kick">${S("balance.stage.kick")}</span><h2>${S("balance.stage.title")}</h2><span class="mn-sub">${S("balance.stage.sub")}</span></div></header>
    <aside class="mn-notes"><span class="mn-notes-h">${S("balance.stage.notes")}</span><ul>${notes}</ul></aside>
    <div class="mn-month bl-main"><div class="bl-stage">${crane}${scale}</div>${cheat}</div>
    <div class="mn-foot">${foot}</div>
  </div>`;
}
