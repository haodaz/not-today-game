// Battle mode (author 2026-11-13): 「战斗机制完全 neta pokemon 就行」. Inside a work game the chick can be
// sent in once per task: a Game Boy battle screen — the chick seen from behind on our side, the task
// itself as a pixel monster on theirs (「对面就是工作这个东西的像素」), HP bars, the text box, FIGHT /
// CHICK / ITEM / RUN. Our moves: 冲撞 (the screen shakes), 啄, 喷火 (flames), 叫; the work's: 加需求,
// 催, 开会, 改口. Seeded dice: the same battle plays the same way for the same run, task and turn.
//
// chick-fights (author 2026-11-27): 「我想小鸡每次都能战斗，战斗如何胜利完成度上升一格，每个任务 boss 能力会
// 提升，所以要记得喂鸡」. The fight is on every task, once; a win lifts the task one step (the board's
// `lifted`: a failed settlement passes, the night's judgement is one grade better); a loss changes
// nothing. The work's monster grows with the day; the chick grows with the days it was fed.
import type { Task } from "@state/days/tasks";
import { cls, html, type SafeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import type { ChipId } from "@world/sound/chip";

const S = (key: string, args?: Record<string, string>): string => (hasString(key) ? t(key, args) : key);

export const CHICK_BACK = "/battle/chick-back.gb.png";
/**
 * The task's monster. texture-pass R4: days 4–18 each have their own (public/battle/mons/mon_dNN.gb.png,
 * the day's work drawn as a Game Boy creature); earlier days and no day keep the two generic ones:
 * the form-and-stamp one for an approval day, the paper one for everything else.
 */
export const foeImage = (task: Task, day?: number): string =>
  day !== undefined && day >= 4 && day <= 18 ? `/battle/mons/mon_d${String(day).padStart(2, "0")}.gb.png` : task.board?.stack ? "/battle/mon-stamp.gb.png" : "/battle/mon-brief.gb.png";

export type FxKind = "shake" | "hit" | "flame" | "down" | "heal" | "none";
export interface Fighter { readonly hp: number; readonly max: number; readonly atk: number }
export interface BattleLine { readonly t: string; readonly fx: FxKind; readonly side: "ours" | "theirs" | "none" }
export type BattlePhase = "text" | "menu" | "moves" | "won" | "lost" | "ran";
export interface BattleState {
  readonly key: string;
  readonly foe: string;
  readonly img: string;
  /** The chick's level (the days it was fed, + Kuro's loan) and the monster's (the day). */
  readonly level: number;
  readonly foeLevel: number;
  /** What each side's damage is multiplied by (chick-fights R3). */
  readonly oursMul: number;
  readonly foeMul: number;
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

// ——— chick-fights R3: how strong each side is ———

/** A level of the chick is worth this much HP and this much damage; so is a day of the monster. */
export const HP_PER_LEVEL = 8;
export const DMG_PER_LEVEL = 0.04;
/** Fed today: this much more HP; not fed today: this much less (never under OURS_HP_MIN). */
export const FED_HP = 16;
export const OURS_HP_MIN = 40;
/** The three days Kuro has it (chick-fights R5): it fights this many levels up. */
export const KURO_LEVELS = 6;

export interface Strength { readonly level: number; readonly hp: number; readonly mul: number }

/** The chick: its level is the days it was fed (+ Kuro's loan while it lasts); fed today or not moves its HP. */
export function chickStrength(fedDays: number, fedToday: boolean, kuro = false): Strength {
  const level = Math.max(0, fedDays) + (kuro ? KURO_LEVELS : 0);
  return { level, hp: Math.max(OURS_HP_MIN, OURS_HP + HP_PER_LEVEL * level + (fedToday ? FED_HP : -FED_HP)), mul: 1 + DMG_PER_LEVEL * level };
}

/** The work's monster: a little stronger every day. */
export function foeStrength(day: number): Strength {
  const level = Math.max(0, day - 1);
  return { level: Math.max(1, day), hp: FOE_HP + HP_PER_LEVEL * level, mul: 1 + DMG_PER_LEVEL * level };
}

const PLAIN: Strength = { level: 1, hp: OURS_HP, mul: 1 };
const PLAIN_FOE: Strength = { level: 1, hp: FOE_HP, mul: 1 };

export function startBattle(key: string, foe: string, img: string, at: number, ours: Strength = PLAIN, theirs: Strength = PLAIN_FOE): BattleState {
  return {
    key, foe, img, level: ours.level, foeLevel: theirs.level, oursMul: ours.mul, foeMul: theirs.mul,
    ours: { hp: ours.hp, max: ours.hp, atk: 0 }, theirs: { hp: theirs.hp, max: theirs.hp, atk: 0 },
    phase: "text", queue: [{ t: S("battle.appear", { foe }), fx: "none", side: "none" }, { t: S("battle.goChick"), fx: "none", side: "none" }], after: "menu", turn: 0, at,
  };
}

const stageMul = (stage: number): number => Math.pow(1.5, Math.max(-2, Math.min(2, stage)));

/** One move from `from` on `to`: the lines it writes and the fighters after it. */
function useMove(move: Move, who: "ours" | "theirs", s: { ours: Fighter; theirs: Fighter }, roll: () => number, foe: string, mul = 1): { lines: BattleLine[]; ours: Fighter; theirs: Fighter } {
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
      const dmg = Math.max(1, Math.round(move.power * mul * stageMul(me.atk) * (0.85 + roll() * 0.15) * (crit ? 1.5 : 1)));
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
  const a = useMove(move, "ours", s, roll, s.foe, s.oursMul);
  const lines = [...a.lines];
  let { ours, theirs } = a;
  let after: BattlePhase = "menu";
  if (theirs.hp <= 0) {
    lines.push({ t: S("battle.won", { foe: s.foe }), fx: "down", side: "theirs" }, { t: S("battle.win.banner"), fx: "none", side: "none" }, { t: S("battle.win.grade"), fx: "none", side: "none" });
    after = "won";
  } else {
    const foeMove = FOE_MOVES[Math.floor(roll() * FOE_MOVES.length)]!;
    const b = useMove(foeMove, "theirs", { ours, theirs }, roll, s.foe, s.foeMul);
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

const LINE_CHIP: Readonly<Record<FxKind, ChipId>> = { hit: "hit", shake: "shake", flame: "flame", down: "down", heal: "heal", none: "text" };

/**
 * battle-sfx: the sound of a change, or null. The end of the fight is its own (won → win, lost →
 * lose, ran → text); otherwise a new line up (its `at` or its queue changed, in the text phase) sounds
 * by its fx. Nothing changed, or a menu turned (FIGHT ↔ the moves), is silent here — the press's
 * cursor is the action's.
 */
export function battleChip(prev: BattleState | null, next: BattleState): ChipId | null {
  if (prev === next) return null;
  if (next.phase !== prev?.phase) {
    if (next.phase === "won") return "win";
    if (next.phase === "lost") return "lose";
    if (next.phase === "ran") return "text";
  }
  if (next.phase !== "text") return null;
  if (prev && prev.phase === "text" && next.at === prev.at && next.queue === prev.queue) return null;
  const line = next.queue[0];
  return line ? LINE_CHIP[line.fx] : null;
}

// ——— when it is offered, and what a win does ———

import type { GameEvent } from "@state/events";
import { chickFedDays, chickFedOn } from "@state/chick";
import type { State } from "@state/types.gen";
import { TAKEN_AFTER_DAYS, takenByKuro, upgradedOn } from "@world/objects/taken";

/** The log's mark that this task's battle was fought (win or lose), once per task. */
export const battleTarget = (taskId: string): string => `battle:${taskId}`;
export const battleUsed = (events: readonly GameEvent[], day: number, taskId: string): boolean =>
  events.some((e) => e.kind === "open" && e.target === battleTarget(taskId) && e.day === day);

/**
 * 让小鸡上 is on every task's work screen (chick-fights R2) when the chick is held, it can still
 * fight (not taken by Kuro, R5) and this task's fight is unfought. Once per task, win or lose.
 */
export function battleOffered(found: readonly string[], events: readonly GameEvent[], day: number, taskId: string, taken = false): boolean {
  return found.includes("chick") && !taken && !battleUsed(events, day, taskId);
}

/**
 * The chick as it stands today (chick-fights R1, R3, R5), from the state and the log: taken by Kuro
 * (no more fights), in Kuro's three days (stronger), fed today or not, and its strength in a fight.
 */
export function chickToday(state: Pick<State, "day" | "upgraded">, events: readonly GameEvent[]): { readonly taken: boolean; readonly kuro: boolean; readonly kuroDaysLeft: number; readonly fedDays: number; readonly fedToday: boolean; readonly strength: Strength } {
  const on = upgradedOn("chick", events);
  const upgraded = state.upgraded.chick === true && on !== null;
  const taken = upgraded && takenByKuro("chick", state, events);
  const kuro = upgraded && !taken;
  const fedDays = chickFedDays(events, state.day);
  // while Kuro has it, Kuro feeds it (its offer: 「按时喂，你以后一个键都不用按」): never hungry in those three days
  const fedToday = kuro || chickFedOn(events, state.day);
  return { taken, kuro, kuroDaysLeft: kuro ? Math.max(0, on! + TAKEN_AFTER_DAYS - state.day) : 0, fedDays, fedToday, strength: chickStrength(fedDays, fedToday, kuro) };
}

/**
 * The control in the work screen's head (chick-fights R2, R5): 让小鸡上, with a small 饿着 when it was
 * not fed today; a dead chip once Kuro has taken it; nothing when the chick is not held, a fight is
 * on, or this task's fight is fought.
 */
export function fightControl(state: Pick<State, "day" | "upgraded" | "found">, events: readonly GameEvent[], taskId: string, fighting: boolean): SafeHtml | null {
  const found = state.found as readonly string[];
  if (fighting || !found.includes("chick")) return null;
  const chick = chickToday(state, events);
  if (chick.taken) return html`<span class="wl-battle taken" aria-disabled="true">${S("battle.taken")}</span>`;
  if (!battleOffered(found, events, state.day, taskId)) return null;
  return html`<button type="button" class="${cls("wl-battle", !chick.fedToday && "hungry")}" data-action="battle-start">${S("battle.go")}${chick.fedToday ? null : html`<small class="wl-hungry">${S("battle.hungry")}</small>`}</button>`;
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
    // the win's banner (author 2026-11-27: 「winner winner, chicken dinner，我们也可以反过来」): 大鸡大利，工作顺意
    const banner = s.phase === "won" ? html`<p class="bt-line bt-banner">${S("battle.win.banner")}</p>` : null;
    box = html`<div class="${cls("bt-box", s.phase === "won" && "bt-won")}">${banner}<p class="bt-line">${S(s.phase === "won" ? "battle.win.grade" : s.phase === "lost" ? "battle.lost" : "battle.ran")}</p><button type="button" class="bt-done" data-action="battle-done">${S("battle.done")}</button></div>`;
  } else {
    box = html`<button type="button" class="bt-box bt-textbtn" data-action="battle-act" data-cmd="next"><p class="bt-line">${line?.t ?? ""}</p><span class="bt-more">▼</span></button>`;
  }
  // the screen keeps the Game Boy's 10:9 (author 2026-11-13: 「只有在固定的比例尺才能感觉熟悉」), centred on the dark stage
  return html`<div class="${cls("bt", fresh === "shake" && "shake")}" data-phase="${s.phase}"><div class="bt-screen">
    <div class="bt-foe-box"><b class="bt-name">${s.foe}</b><span class="bt-lv">:L${String(s.foeLevel)}</span>${hpBar(s.theirs)}</div>
    <div class="${cls("bt-foe", fresh === "hit" && line?.side === "theirs" && "hit", foeDown && "down", fresh === "heal" && line?.side === "theirs" && "heal")}"><img src="${s.img}" alt="">${flame ? html`<span class="bt-flame"><i></i><i></i><i></i><i></i></span>` : null}</div>
    <div class="${cls("bt-ours", fresh === "hit" && line?.side === "ours" && "hit", oursDown && "down")}"><img src="${CHICK_BACK}" alt=""></div>
    <div class="bt-ours-box"><b class="bt-name">${S("battle.ours")}</b><span class="bt-lv">:L${String(s.level + 1)}</span>${hpBar(s.ours)}<small class="bt-num">${String(s.ours.hp)}/ ${String(s.ours.max)}</small></div>
    ${box}
  </div></div>`;
}
