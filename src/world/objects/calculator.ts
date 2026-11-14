// The solar calculator (objects-in-hand FR3.7): 8 seven-segment digits. It works only in the light
// (the lit level comes from the hand: the pointer in the stage's top zone, which shrinks as the room
// darkens); away from it the digits fade over 3 s and keys stop. Ordinary arithmetic. Turned upside
// down, the digits read as content's letters. From day 17 it sometimes shows a number nobody pressed.
// No key sound. Upgraded: an app with a history, always lit.
import { calculatorTable, readUpsideDown, type CalculatorTable } from "@state/hands";
import { hash, unit } from "@state/seed";
import { ringOf } from "@state/stages";
import { ringIndex, RINGS } from "@world/desktop/rings";
import { Bits, drawSegLine, finer, SEG_PITCH, type Frame } from "./frame";
import { step, type ObjectEnv, type Program } from "./program";
import { BULLS_DIGITS, guessBulls, newBulls, type BullsState } from "./games/bulls";
import { NO_PRESS, pressed, upgradedHi, type KuroPress } from "./taken";

export const CALC_CELLS = 8;
export const CALC_W = CALC_CELLS * SEG_PITCH + 2; // 58
export const CALC_H = 11;
/** Away from the light the digits fade over this long. */
export const CALC_FADE_MS = 3_000;
/** Keys respond only above this much light. */
export const CALC_MIN_LIGHT = 0.5;
/** The share of the stage's height (from the top) that is light: a third in the first ring, a sixth in the door ring. */
export const LIGHT_ZONE_MAX = 1 / 3;
export const LIGHT_ZONE_MIN = 1 / 6;
/** Past this turn (degrees) it is upside down. */
export const UPSIDE_DOWN_DEG = 150;
/** How often (1 in n, seeded) `=` or C shows an unasked number from `unaskedFromDay`. */
export const UNASKED_ONE_IN = 4;
const HISTORY = 6;
/** The app's history writes the signs, not the key ids. */
const OP_SIGN: Readonly<Record<string, string>> = { "+": "+", "-": "−", x: "×", div: "÷" };

export function lightZone(day: number): number {
  const i = Math.max(0, ringIndex(ringOf(day)));
  const last = Math.max(1, RINGS.length - 1);
  return LIGHT_ZONE_MAX - (LIGHT_ZONE_MAX - LIGHT_ZONE_MIN) * Math.min(1, i / last);
}
/** The light level: 1 in the light; fading over 3 s since the pointer left it. */
export function lightLevel(inLight: boolean, leftAt: number | null, t: number): number {
  if (inLight) return 1;
  if (leftAt === null) return 0;
  return Math.max(0, 1 - (t - leftAt) / CALC_FADE_MS);
}

export interface CalculatorState {
  readonly on: boolean;
  readonly display: string;
  readonly acc: number | null;
  readonly op: string | null;
  /** The next digit starts a new number. */
  readonly fresh: boolean;
  readonly presses: number;
  /** The upgraded app's history. */
  readonly history: readonly string[];
  /** Kuro's press tracker (object-upgrade 2026-11-03). */
  readonly press: KuroPress;
  /** device-games 1: 猜数字 under way (the `game` key enters it; C twice on an empty display leaves). Absent = the calculator. */
  readonly game?: CalcGame | null;
}

/** device-games 1: 猜数字 on the display. */
export interface CalcGame {
  readonly bulls: BullsState;
  /** The digits typed for the next guess. */
  readonly input: string;
  /** The last guess's `nAmB`, until the next key. */
  readonly feedback: string | null;
  /** The display blinks `blinks` times from `blinkAt` (a rejected guess once, a win three times). */
  readonly blinkAt: number | null;
  readonly blinks: number;
  /** The last key was C on an empty display (a second one leaves the mode). */
  readonly lastC: boolean;
  /** Games started this time (each a new seeded secret). */
  readonly n: number;
}
/** One blink: off this long, then on this long. */
export const CALC_BLINK_MS = 160;

const newGame = (env: ObjectEnv, n: number): CalcGame => ({ bulls: newBulls(`${env.seed}:${n}`), input: "", feedback: null, blinkAt: null, blinks: 0, lastC: false, n });

/** What the display shows in 猜数字: the input, the feedback, the secret at the end, or ---- at the start. */
export function gameDisplay(g: CalcGame): string {
  if (g.bulls.over) return g.bulls.secret;
  if (g.input) return g.input;
  if (g.feedback) return g.feedback;
  return "-".repeat(BULLS_DIGITS);
}
/** Whether the display is off (a blink's dark half) at `t`. */
export function gameBlinkOff(g: CalcGame, t: number): boolean {
  if (g.blinkAt === null) return false;
  const dt = t - g.blinkAt;
  if (dt < 0 || dt >= g.blinks * 2 * CALC_BLINK_MS) return false;
  return Math.floor(dt / CALC_BLINK_MS) % 2 === 0;
}

/** A key in 猜数字. */
function gameKey(s: CalculatorState, g: CalcGame, key: string, env: ObjectEnv): CalculatorState {
  const at = (x: Partial<CalcGame>): CalculatorState => ({ ...s, game: { ...g, ...x } });
  if (key === "off") return { ...s, on: false, game: null };
  if (key === "C") {
    if (g.bulls.over) return at({ ...newGame(env, g.n + 1) });
    if (g.input) return at({ input: "", lastC: false });
    // the display empty: a second C leaves the mode (the calculator as it was)
    if (g.lastC) return { ...fresh(s), game: null };
    return at({ feedback: null, lastC: true });
  }
  if (g.bulls.over) return s;
  if (/^[0-9]$/.test(key)) {
    const input = g.feedback ? key : g.input.length >= BULLS_DIGITS ? g.input : g.input + key;
    return at({ input, feedback: null, lastC: false });
  }
  if (key === "=") {
    const r = guessBulls(g.bulls, g.input);
    if (r.rejected) return at({ blinkAt: env.t, blinks: 1, lastC: false });
    return at({ bulls: r.state, input: "", feedback: `${String(r.a)}A${String(r.b)}b`, lastC: false, ...(r.won ? { blinkAt: env.t, blinks: 3 } : {}) });
  }
  return at({ lastC: false });
}

/** A number as at most 8 digits (and a point), or E when it does not fit. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "E";
  if (Math.abs(n) >= 10 ** CALC_CELLS) return "E";
  const neg = n < 0;
  const room = CALC_CELLS - (neg ? 1 : 0);
  const whole = Math.max(1, Math.floor(Math.abs(n)).toString().length);
  if (whole > room) return "E";
  let s = Math.abs(n).toFixed(Math.max(0, room - whole));
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return (neg && s !== "0" ? "-" : "") + s;
}
const digitsIn = (d: string) => d.replace(/[^0-9]/g, "").length;
const value = (d: string) => (d === "E" ? NaN : Number(d));
function apply(a: number, op: string, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "x":
      return a * b;
    case "div":
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

/** What it shows upside down: content's table, the digits in reverse order. */
export const upsideDownOf = (display: string, table: CalculatorTable = calculatorTable): string => readUpsideDown(display, table.upsideDown);

/** Seeded: does this press show an unasked number, and which. */
export function unaskedAt(env: ObjectEnv, presses: number, table: CalculatorTable = calculatorTable): string | null {
  if (env.day < table.unaskedFromDay) return null;
  const r = unit(hash(`${env.seed}:unasked:${presses}`));
  if (Math.floor(r * UNASKED_ONE_IN) !== 0) return null;
  return table.unasked[Math.floor(unit(hash(`${env.seed}:unasked-which:${presses}`)) * table.unasked.length)]!;
}

export function drawCalculator(s: CalculatorState, env: ObjectEnv): Frame {
  // Upgraded: an app with a history, always lit — until Kuro, moved in, fills the hi screen (a
  // glimpse on loan, only Kuro once taken; object-upgrade 2026-11-03).
  if (env.upgraded) return upgradedHi(env, s.press, { lines: [...s.history.slice(-HISTORY), s.display] });
  const b = new Bits(CALC_W, CALC_H);
  // device-games 1: 猜数字 on the same digits (the input, nAmb, the secret; ---- to start)
  const g = s.game ?? null;
  if (s.on && g) {
    if (!gameBlinkOff(g, env.t)) drawSegLine(b, 1, 1, gameDisplay(g), CALC_CELLS);
  } else if (s.on) drawSegLine(b, 1, 1, s.display, CALC_CELLS);
  const f = finer(b, env.level);
  return { kind: "pixels", w: f.w, h: f.h, bits: f.bits, ink: s.on ? env.lit : 0 };
}

const fresh = (s: CalculatorState): CalculatorState => ({ ...s, on: true, display: "0", acc: null, op: null, fresh: true });

export const calculator: Program<CalculatorState> = {
  id: "calculator",
  channel: { w: CALC_W, h: CALC_H },
  keySound: null,
  init: () => ({ on: true, display: "0", acc: null, op: null, fresh: true, presses: 0, history: [], press: NO_PRESS }),
  key(s0, key, env) {
    // In the dark it does not answer (the new world is always lit).
    if (!env.upgraded && env.lit < CALC_MIN_LIGHT) return step(s0);
    const s = { ...s0, presses: s0.presses + 1, press: pressed(s0.press, env.t) };
    // Taken: the app is gone; Kuro answers only with talk (no arithmetic, no history).
    if (env.taken) return step(s);
    // device-games 1: `game` (the title's 玩一局) enters 猜数字; in it every key is the game's.
    if (key === "game") return env.upgraded ? step(s) : step({ ...s, on: true, game: newGame(env, (s.game?.n ?? -1) + 1) });
    if (s.game) return step(gameKey(s, s.game, key, env));
    if (key === "off") return step({ ...s, on: false });
    if (key === "C") {
      const u = env.upgraded ? null : unaskedAt(env, s.presses);
      return step({ ...fresh(s), ...(u ? { display: u } : {}) });
    }
    if (!s.on) return step(s);
    if (/^[0-9]$/.test(key)) {
      if (s.fresh || s.display === "0" || s.display === "E") return step({ ...s, display: key, fresh: false });
      if (digitsIn(s.display) >= CALC_CELLS) return step(s);
      return step({ ...s, display: s.display + key });
    }
    if (key === ".") {
      if (s.fresh || s.display === "E") return step({ ...s, display: "0.", fresh: false });
      return step(s.display.includes(".") ? s : { ...s, display: s.display + "." });
    }
    if (key === "sqrt") return step({ ...s, display: formatNumber(Math.sqrt(value(s.display))), fresh: true });
    if (key === "%") {
      const b = value(s.display);
      const pct = s.acc !== null && (s.op === "+" || s.op === "-") ? (s.acc * b) / 100 : b / 100;
      return step({ ...s, display: formatNumber(pct), fresh: true });
    }
    if (["+", "-", "x", "div"].includes(key)) {
      const acc = s.acc !== null && s.op && !s.fresh ? apply(s.acc, s.op, value(s.display)) : value(s.display);
      return step({ ...s, acc, op: key, display: formatNumber(acc), fresh: true });
    }
    if (key === "=") {
      if (s.acc === null || !s.op) return step(s);
      const display = formatNumber(apply(s.acc, s.op, value(s.display)));
      const line = `${formatNumber(s.acc)} ${OP_SIGN[s.op] ?? s.op} ${s.display} = ${display}`;
      const u = env.upgraded ? null : unaskedAt(env, s.presses);
      return step({ ...s, display: u ?? display, acc: null, op: null, fresh: true, history: env.upgraded ? [...s.history, line].slice(-HISTORY) : s.history });
    }
    return step(s);
  },
  draw: drawCalculator,
};
