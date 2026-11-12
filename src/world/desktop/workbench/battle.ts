// Battle mode (author 2026-11-13): 「战斗机制完全 neta pokemon 就行」. Inside a work game the chick can be
// sent in once per task: a Game Boy battle screen — the chick seen from behind on our side, the task
// itself as a pixel monster on theirs (「对面就是工作这个东西的像素」), HP bars, the text box, FIGHT /
// CHICK / ITEM / RUN. Our moves: 冲撞 (the screen shakes), 啄, 喷火 (flames), 叫; the work's: 加需求,
// 催, 开会, 改口. A win never passes the task: it 「move on 一个状态」 — one empty cell of the board fills
// itself (the actions do that; this file is the pure engine and the view). Seeded dice: the same
// battle plays the same way for the same run, task and turn.
import type { Task } from "@state/days/tasks";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : key);

export const CHICK_BACK = "/battle/chick-back.gb.png";
/** The task's monster: the form-and-stamp one for an approval day, the paper one for everything else. */
export const foeImage = (task: Task): string => (task.board?.stack ? "/battle/mon-stamp.gb.png" : "/battle/mon-brief.gb.png");

export type FxKind = "shake" | "hit" | "flame" | "down" | "heal" | "none";
export interface Fighter { readonly hp: number; readonly max: number; readonly atk: number }
export interface BattleLine { readonly t: string; readonly fx: FxKind; readonly side: "ours" | "theirs" | "none" }
export type BattlePhase = "text" | "menu" | "moves" | "won" | "lost" | "ran";
export interface BattleState {
  readonly key: string;
  readonly foe: string;
  readonly img: string;
  readonly level: number;
  readonly ours: Fighter;
  readonly theirs: Fighter;
  readonly phase: BattlePhase;
  /** The lines still to read; `after` is the phase that follows the last one. */
  readonly queue: readonly BattleLine[];
  readonly after: BattlePhase;
  readonly turn: number;
  /** Session ms the current line came up (the view animates its fx from then). */
  readonly at: number;
}

interface Move { readonly id: string; readonly power: number; readonly acc: number; readonly crit: number; readonly fx: FxKind; readonly effect?: "growl" | "push" | "heal" }
// the chick means pushing (author 2026-11-13: 「鸡本身代表 push 一个人前进 … 鸡娃」): its moves in that register
export const OUR_MOVES: readonly Move[] = [
  { id: "hype", power: 28, acc: 100, crit: 1 / 8, fx: "shake" },
  { id: "grind", power: 20, acc: 100, crit: 1 / 4, fx: "hit" },
  { id: "involute", power: 42, acc: 85, crit: 1 / 8, fx: "flame" },
  { id: "push", power: 0, acc: 100, crit: 0, fx: "none", effect: "push" },
];
const FOE_MOVES: readonly Move[] = [
  { id: "req", power: 24, acc: 100, crit: 1 / 8, fx: "shake" },
  { id: "hurry", power: 18, acc: 100, crit: 1 / 3, fx: "hit" },
  { id: "meeting", power: 0, acc: 100, crit: 0, fx: "none", effect: "growl" },
  { id: "flip", power: 0, acc: 100, crit: 0, fx: "heal", effect: "heal" },
];
export const OURS_HP = 80;
export const FOE_HP = 70;

/** mulberry32 over a string seed: the same run, task and turn roll the same. */
export function dice(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h ^ (h >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function startBattle(key: string, foe: string, img: string, level: number, at: number): BattleState {
  return {
    key, foe, img, level,
    ours: { hp: OURS_HP, max: OURS_HP, atk: 0 }, theirs: { hp: FOE_HP, max: FOE_HP, atk: 0 },
    phase: "text", queue: [{ t: S("battle.appear", { foe }), fx: "none", side: "none" }, { t: S("battle.goChick"), fx: "none", side: "none" }], after: "menu", turn: 0, at,
  };
}

const stageMul = (stage: number): number => Math.pow(1.5, Math.max(-2, Math.min(2, stage)));

/** One move from `from` on `to`: the lines it writes and the fighters after it. */
function useMove(move: Move, who: "ours" | "theirs", s: { ours: Fighter; theirs: Fighter }, roll: () => number, foe: string): { lines: BattleLine[]; ours: Fighter; theirs: Fighter } {
  const name = S(who === "ours" ? `battle.move.${move.id}` : `battle.foe.${move.id}`);
  const lines: BattleLine[] = [{ t: S(who === "ours" ? "battle.used" : "battle.foeUsed", { foe, move: name }), fx: move.effect ? "none" : move.fx, side: who === "ours" ? "theirs" : "ours" }];
  let { ours, theirs } = s;
  const me = who === "ours" ? ours : theirs;
  const other = who === "ours" ? theirs : ours;
  if (move.effect === "growl") {
    const hit = { ...other, atk: Math.max(-2, other.atk - 1) };
    lines.push({ t: S("battle.atkDown", { who: who === "ours" ? foe : S("battle.ours") }), fx: "none", side: "none" });
    if (who === "ours") theirs = hit; else ours = hit;
  } else if (move.effect === "push") {
    const up = { ...me, atk: Math.min(2, me.atk + 1) };
    lines.push({ t: S("battle.atkUp", { who: who === "ours" ? S("battle.ours") : foe }), fx: "none", side: "none" });
    if (who === "ours") ours = up; else theirs = up;
  } else if (move.effect === "heal") {
    const healed = { ...me, hp: Math.min(me.max, me.hp + 18) };
    lines.push({ t: S("battle.heal", { foe }), fx: "heal", side: who });
    if (who === "ours") ours = healed; else theirs = healed;
  } else {
    if (roll() * 100 >= move.acc) {
      lines.push({ t: S("battle.miss"), fx: "none", side: "none" });
    } else {
      const crit = roll() < move.crit;
      const dmg = Math.max(1, Math.round(move.power * stageMul(me.atk) * (0.85 + roll() * 0.15) * (crit ? 1.5 : 1)));
      const hit = { ...other, hp: Math.max(0, other.hp - dmg) };
      if (crit) lines.push({ t: S("battle.crit"), fx: "none", side: "none" });
      if (who === "ours") theirs = hit; else ours = hit;
    }
  }
  return { lines, ours, theirs };
}

/** The player's turn and the work's answer, resolved into the lines to read. */
export function battleTurn(s: BattleState, moveId: string, at: number): BattleState {
  if (s.phase !== "moves" && s.phase !== "menu") return s;
  const move = OUR_MOVES.find((m) => m.id === moveId);
  if (!move) return s;
  const roll = dice(`${s.key}:${s.turn}`);
  const a = useMove(move, "ours", s, roll, s.foe);
  const lines = [...a.lines];
  let { ours, theirs } = a;
  let after: BattlePhase = "menu";
  if (theirs.hp <= 0) {
    lines.push({ t: S("battle.won", { foe: s.foe }), fx: "down", side: "theirs" }, { t: S("battle.wonEffect"), fx: "none", side: "none" });
    after = "won";
  } else {
    const foeMove = FOE_MOVES[Math.floor(roll() * FOE_MOVES.length)]!;
    const b = useMove(foeMove, "theirs", { ours, theirs }, roll, s.foe);
    lines.push(...b.lines); ours = b.ours; theirs = b.theirs;
    if (ours.hp <= 0) { lines.push({ t: S("battle.lost"), fx: "down", side: "ours" }); after = "lost"; }
  }
  return { ...s, ours, theirs, phase: "text", queue: lines, after, turn: s.turn + 1, at };
}

/** The menu's commands and the text box's tap. */
export function battleCmd(s: BattleState, cmd: string, at: number): BattleState {
  if (cmd === "next" && s.phase === "text") {
    if (s.queue.length > 1) return { ...s, queue: s.queue.slice(1), at };
    return { ...s, queue: [], phase: s.after, at };
  }
  if (cmd === "fight" && s.phase === "menu") return { ...s, phase: "moves", at };
  if (cmd === "back" && s.phase === "moves") return { ...s, phase: "menu", at };
  if (cmd === "run" && (s.phase === "menu" || s.phase === "moves")) return { ...s, phase: "text", queue: [{ t: S("battle.ran"), fx: "none", side: "none" }], after: "ran", at };
  return s;
}

export const battleOver = (s: BattleState): boolean => s.phase === "won" || s.phase === "lost" || s.phase === "ran";

// ——— when it is offered, and what a win does ———

import type { TaskBoard } from "@state/days/tasks";
import type { BoardState } from "@state/days/board";
import type { GameEvent } from "@state/events";

/** The log's mark that this task's battle was fought (win or lose), once per task. */
export const battleTarget = (taskId: string): string => `battle:${taskId}`;
export const battleUsed = (events: readonly GameEvent[], day: number, taskId: string): boolean =>
  events.some((e) => e.kind === "open" && e.target === battleTarget(taskId) && e.day === day);

/**
 * 让小鸡上 is on the work screen when the chick is held, the board is one a cell can be pushed on (not
 * a tuning board, not the chain), a cell is still wrong or empty, and this task's battle is unfought.
 */
export function battleOffered(board: TaskBoard, s: BoardState, found: readonly string[], events: readonly GameEvent[], day: number, taskId: string): boolean {
  // a game board (mines, link …) still has the form before its game: the chick may push a cell there
  if (!found.includes("chick") || board.tune || board.stack) return false;
  if (!board.slots.some((slot) => s.slots[slot.id] !== slot.answer)) return false;
  return !battleUsed(events, day, taskId);
}

/** A win moves the work on one state: the first empty cell takes its answer, else the first wrong one. */
export function battleReward(board: TaskBoard, s: BoardState): { readonly slot: string; readonly card: string } | null {
  const empty = board.slots.find((slot) => !(slot.id in s.slots));
  const wrong = board.slots.find((slot) => s.slots[slot.id] !== slot.answer);
  const target = empty ?? wrong;
  return target ? { slot: target.id, card: target.answer } : null;
}

// ——— the screen ———

const hpBar = (f: Fighter): SafeHtml => {
  const pct = Math.round((f.hp / f.max) * 100);
  return html`<div class="${cls("bt-hp", pct <= 20 ? "low" : pct <= 50 ? "mid" : null)}"><span class="bt-hpl">HP:</span><div class="bt-track"><i style="width:${pct}%"></i></div></div>`;
};

/** The battle screen: the Game Boy frame, both fighters, the text box or the menus. */
export function battleScene(s: BattleState, nowMs: number): SafeHtml {
  const line = s.phase === "text" ? s.queue[0] : null;
  const fresh = line && nowMs - s.at < 700 ? line.fx : "none";
  const flame = fresh === "flame" && line?.side === "theirs";
  const foeDown = s.phase === "won" || (line?.fx === "down" && line.side === "theirs");
  const oursDown = s.phase === "lost" || (line?.fx === "down" && line.side === "ours");
  const over = battleOver(s);
  let box: SafeHtml;
  if (s.phase === "menu") {
    box = html`<div class="bt-box bt-menu"><p class="bt-ask">${S("battle.ask", { ours: S("battle.ours") })}</p><div class="bt-cmds"><button type="button" class="bt-cmd on" data-action="battle-act" data-cmd="fight">${S("battle.fight")}</button><button type="button" class="bt-cmd" disabled>${S("battle.pkmn")}</button><button type="button" class="bt-cmd" disabled>${S("battle.item")}</button><button type="button" class="bt-cmd" data-action="battle-act" data-cmd="run">${S("battle.run")}</button></div></div>`;
  } else if (s.phase === "moves") {
    box = html`<div class="bt-box bt-moves"><div class="bt-cmds">${OUR_MOVES.map((m) => html`<button type="button" class="bt-cmd" data-action="battle-act" data-cmd="move" data-move="${m.id}">${S(`battle.move.${m.id}`)}</button>`)}</div><button type="button" class="bt-back" data-action="battle-act" data-cmd="back">${S("battle.back")}</button></div>`;
  } else if (over) {
    box = html`<div class="bt-box"><p class="bt-line">${S(s.phase === "won" ? "battle.wonEffect" : s.phase === "lost" ? "battle.lost" : "battle.ran")}</p><button type="button" class="bt-done" data-action="battle-done">${S("battle.done")}</button></div>`;
  } else {
    box = html`<button type="button" class="bt-box bt-textbtn" data-action="battle-act" data-cmd="next"><p class="bt-line">${line?.t ?? ""}</p><span class="bt-more">▼</span></button>`;
  }
  // the screen keeps the Game Boy's 10:9 (author 2026-11-13: 「只有在固定的比例尺才能感觉熟悉」), centred on the dark stage
  return html`<div class="${cls("bt", fresh === "shake" && "shake")}" data-phase="${s.phase}"><div class="bt-screen">
    <div class="bt-foe-box"><b class="bt-name">${s.foe}</b><span class="bt-lv">:L${String(s.level)}</span>${hpBar(s.theirs)}</div>
    <div class="${cls("bt-foe", fresh === "hit" && line?.side === "theirs" && "hit", foeDown && "down", fresh === "heal" && line?.side === "theirs" && "heal")}"><img src="${s.img}" alt="">${flame ? html`<span class="bt-flame"><i></i><i></i><i></i><i></i></span>` : null}</div>
    <div class="${cls("bt-ours", fresh === "hit" && line?.side === "ours" && "hit", oursDown && "down")}"><img src="${CHICK_BACK}" alt=""></div>
    <div class="bt-ours-box"><b class="bt-name">${S("battle.ours")}</b><span class="bt-lv">:L${String(s.level)}</span>${hpBar(s.ours)}<small class="bt-num">${String(s.ours.hp)}/ ${String(s.ours.max)}</small></div>
    ${box}
  </div></div>`;
}
