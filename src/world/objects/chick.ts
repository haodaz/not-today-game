// The chick (objects-in-hand FR3.1). Keys A (select), B (confirm), C (cancel); the reset hole on the
// back. Every frame is content's (frames.ts); this program only picks which one shows and lays the
// icon strip over it (the selected icon inverted). It never dies: it is only taken away.
import { hash, jitter, unit } from "@state/seed";
import { Bits, finer, type Frame } from "./frame";
import { CHICK_H, CHICK_ICONS, CHICK_W, chickFrames, ICON_SIZE, type ChickFrameId, type ChickFrames, type ChickIcon } from "./frames";
import { SEMITONE, step, type ObjectEnv, type Out, type Program } from "./program";
import { CARES_PER_DAY, isCareIcon, STAT_ORDER, type ChickStat } from "@state/chick";
import { hasString, t } from "@world/i18n";
import { NO_PRESS, pressed, upgradedHi, type KuroPress } from "./taken";

export const CHICK_IDLE_MS = 2_000;
export const CHICK_TURN_MIN_MS = 15_000;
export const CHICK_TURN_MAX_MS = 40_000;
/** How long a turn lasts once it comes. */
export const CHICK_TURN_MS = 800;
export const CHICK_EAT_STEP_MS = 300;
export const CHICK_EAT_MS = 1_200;
export const CHICK_NOD_MS = 400;
export const CHICK_FLASH_MS = 120;
/** The success beep follows the key's own. */
export const CHICK_SUCCESS_DELAY_MS = 120;
/** From day 3 it chirps on its own on the desk, every 4–9 minutes. */
export const CHIRP_FROM_DAY = 3;
export const CHIRP_MIN_MS = 4 * 60_000;
export const CHIRP_MAX_MS = 9 * 60_000;

export type ChickAct = "eat" | "dark" | "check" | "nod";
export interface ChickState {
  /** The icon selected with A, or null (no strip). */
  readonly menu: number | null;
  readonly act: { readonly kind: ChickAct; readonly at: number } | null;
  /** The reset hole was pressed then: one flash. */
  readonly flashAt: number | null;
  /** When this session first looked at it (session ms): its seeded turns count from here. */
  readonly born: number;
  /** Kuro's press tracker (object-upgrade 2026-11-03): its own counter and last-press time. */
  readonly press: KuroPress;
  /** chick-raising R3: the player's 「今天只能做这么多了。」 has played today (the state is per day). */
  readonly fullSaid?: boolean;
}

/**
 * chick-face v3 (author 2026-11-24 #24): the eight icons sit on the LCD, a row of four above the pet
 * and a row of four below (the shell printed them outside the glass; she wanted them on the screen).
 * The screen channel is the pet's 48 × 32 plus the two rows; the selected icon is shown inverted.
 */
export const ICON_ROW_H = 10;
export const CHICK_SCREEN_H = CHICK_H + 2 * ICON_ROW_H;
/** The icons' x in a row of four (9 wide, 3 apart, 1 in from the edge). */
export const ICON_XS: readonly number[] = [1, 13, 25, 37];
/** The pet's picture starts under the top row. */
export const PET_Y = ICON_ROW_H;

/** chick-raising R2: the status screen's rows (8 px each), the bar's start and its longest length. */
export const STAT_ROW_H = 8;
export const STAT_BAR_X = 15;
/** chick-face v3: the bar is capped at 20 so the number fits after it (two digits, 3 × 5 each, right-aligned at 47). */
export const STAT_BAR_MAX = 20;
export const STAT_NUM_X = 41;
/** A 3 × 5 digit face for the status screen's numbers. */
const DIGITS: readonly (readonly string[])[] = [
  ["###", "#.#", "#.#", "#.#", "###"],
  [".#.", "##.", ".#.", ".#.", "###"],
  ["###", "..#", "###", "#..", "###"],
  ["###", "..#", "###", "..#", "###"],
  ["#.#", "#.#", "###", "..#", "..#"],
  ["###", "#..", "###", "..#", "###"],
  ["###", "#..", "###", "#.#", "###"],
  ["###", "..#", ".#.", ".#.", ".#."],
  ["###", "#.#", "###", "#.#", "###"],
  ["###", "#.#", "###", "..#", "###"],
];
/** `n` (0–99) in the 3 × 5 face, right-aligned so its last digit ends at `right`. */
export function drawNumber(b: Bits, n: number, right: number, y: number): void {
  const text = String(Math.max(0, Math.min(99, Math.floor(n))));
  let x = right - 2;
  for (let i = text.length - 1; i >= 0; i--, x -= 4) b.blit(DIGITS[Number(text[i])]!, x, y);
}
/** chick-face v2: each bar's inside starts this far down its row, and is this tall. */
export const STAT_BAR_Y = 3;
export const STAT_BAR_H = 4;
const FULL_KEY = "obj.chick.full";

/** What B does with each icon: meal eats, light goes dark, check-up shows the line; the rest nod. */
export const ICON_ACT: Readonly<Record<ChickIcon, ChickAct>> = {
  meal: "eat",
  light: "dark",
  play: "nod",
  medicine: "nod",
  toilet: "nod",
  checkup: "check",
  training: "nod",
  attention: "nod",
};

/** The seeded moments the chick turns: each 15–40 s after the last. */
export function turnTimes(seed: string, until: number): number[] {
  const out: number[] = [];
  for (let at = 0, i = 0; ; i++) {
    at += jitter(`${seed}:turn:${i}`, CHICK_TURN_MIN_MS, CHICK_TURN_MAX_MS);
    if (at > until) return out;
    out.push(at);
  }
}
/** The seeded gaps between chirps on the desk (4–9 min each). */
export function chirpGap(seed: string, n: number): number {
  return CHIRP_MIN_MS + Math.floor(unit(hash(`${seed}:chirp:${n}`)) * (CHIRP_MAX_MS - CHIRP_MIN_MS + 1));
}

/** Which content frame shows now. */
export function chickFrameAt(s: ChickState, env: ObjectEnv): ChickFrameId {
  const t = env.t;
  if (env.upgraded) return Math.floor(t / CHICK_IDLE_MS) % 2 ? "smile-2" : "smile-1";
  const act = s.act;
  if (act?.kind === "eat" && t - act.at < CHICK_EAT_MS) return Math.floor((t - act.at) / CHICK_EAT_STEP_MS) % 2 ? "eat-2" : "eat-1";
  if (act?.kind === "nod" && t - act.at < CHICK_NOD_MS) return "nod";
  if (act?.kind === "dark") return "dark";
  if (act?.kind === "check") return "check";
  const age = t - s.born;
  if (age >= 0 && turnTimes(env.seed, age).some((at) => age >= at && age < at + CHICK_TURN_MS)) return "turn";
  return Math.floor(t / CHICK_IDLE_MS) % 2 ? "idle-2" : "idle-1";
}

export function drawChick(s: ChickState, env: ObjectEnv, table: ChickFrames = chickFrames): Frame {
  const b = new Bits(CHICK_W, CHICK_SCREEN_H);
  const id = chickFrameAt(s, env);
  b.blit(table.frames.get(id) ?? [], 0, PET_Y);
  // The new world: the same picture, smooth and in colour; it is always smiling. Once Kuro has moved
  // in, Kuro's pose fills it instead (a glimpse while on loan, only Kuro once taken; object-upgrade).
  // The new world has no menu: the rows stay empty.
  if (env.upgraded) return upgradedHi(env, s.press, { lines: [], picture: { w: b.w, h: b.h, bits: b.bits } });
  // chick-face v3 (#24): the eight icons on the LCD, four above the pet and four below; the one A
  // selected is shown inverted (a dark cell around it).
  CHICK_ICONS.forEach((icon, i) => {
    const x = ICON_XS[i % 4]!;
    const y = i < 4 ? 0 : PET_Y + CHICK_H + 1;
    b.blit(table.icons.get(icon) ?? [], x, y);
    if (s.menu === i) b.invert(x - 1, i < 4 ? 0 : y - 1, ICON_SIZE + 2, ICON_SIZE + 1);
  });
  if (id === "check") {
    // chick-raising R2 / chick-face v3: the content's status template (the four marks 攻 防 血 敏 at the
    // left) with, from x = 15, each bar filled to the stat (≤ 20) and the stat's number after it. The
    // template's own bar frames and sample fill are cleared first: they are not numbers.
    STAT_ORDER.forEach((stat, i) => {
      const y0 = PET_Y + i * STAT_ROW_H;
      const n = env.stats?.[stat] ?? 0;
      b.rect(STAT_BAR_X, y0, CHICK_W - STAT_BAR_X, STAT_ROW_H, 0);
      b.rect(STAT_BAR_X, y0 + STAT_BAR_Y, Math.min(n, STAT_BAR_MAX), STAT_BAR_H, 1);
      drawNumber(b, n, CHICK_W - 1, y0 + 2);
    });
  }
  if (s.flashAt !== null && env.t - s.flashAt >= 0 && env.t - s.flashAt < CHICK_FLASH_MS) b.invert(0, 0, b.w, b.h);
  const f = finer(b, env.level);
  return { kind: "pixels", w: f.w, h: f.h, bits: f.bits };
}

const BEEP = "chick-beep";

export const chick: Program<ChickState> = {
  id: "chick",
  channel: { w: CHICK_W, h: CHICK_SCREEN_H },
  keySound: { id: BEEP },
  init: (env) => ({ menu: null, act: null, flashAt: null, born: env.t, press: NO_PRESS }),
  key(s, key, env) {
    // Every key bumps Kuro's press tracker (the glimpse / talk read it); it changes nothing else.
    s = { ...s, press: pressed(s.press, env.t) };
    // The new world feeds it; nothing you press changes anything (and Kuro answers only with talk).
    if (env.upgraded && key !== "reset") return step(s);
    switch (key) {
      case "A":
        return step({ ...s, menu: s.menu === null ? 0 : (s.menu + 1) % CHICK_ICONS.length, act: null });
      case "B": {
        if (s.menu === null) return step(s);
        const icon = CHICK_ICONS[s.menu]!;
        const acted = { ...s, act: { kind: ICON_ACT[icon], at: env.t } };
        const beep: Out = { sound: BEEP, rate: SEMITONE, delay: CHICK_SUCCESS_DELAY_MS };
        if (!isCareIcon(icon)) return step(acted, beep);
        // chick-raising R1 / R2: under today's cap a stat icon is a care (index.ts logs it) and
        // beeps; past it the animation still plays, with the key sound only, and the player's own
        // line comes once that day (R3).
        if ((env.careToday ?? 0) < CARES_PER_DAY) return step(acted, { care: icon }, beep);
        if (s.fullSaid || !hasString(FULL_KEY)) return step(acted);
        return step({ ...acted, fullSaid: true }, { say: { key: `d${env.day}:${FULL_KEY}`, lines: [{ k: "inner", t: t(FULL_KEY) }] } });
      }
      case "C":
        return step({ ...s, menu: null, act: null });
      case "reset":
        // The hole on the back: the screen flashes once and nothing else happens.
        return step({ ...s, flashAt: env.t });
      default:
        return step(s);
    }
  },
  draw: (s, env) => drawChick(s, env),
};
