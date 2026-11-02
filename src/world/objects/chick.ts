// The chick (objects-in-hand FR3.1). Keys A (select), B (confirm), C (cancel); the reset hole on the
// back. Every frame is content's (frames.ts); this program only picks which one shows and lays the
// icon strip over it (the selected icon inverted). It never dies: it is only taken away.
import { hash, jitter, unit } from "@state/seed";
import { Bits, finer, type Frame } from "./frame";
import { CHICK_H, CHICK_ICONS, CHICK_W, chickFrames, ICON_SIZE, type ChickFrameId, type ChickFrames, type ChickIcon } from "./frames";
import { SEMITONE, step, type ObjectEnv, type Program } from "./program";

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
}

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
  if (env.heldUp) return "grave";
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
  const b = new Bits(CHICK_W, CHICK_H);
  const id = chickFrameAt(s, env);
  b.blit(table.frames.get(id) ?? []);
  // The new world: the same picture, smooth and in colour; it is always smiling.
  if (env.upgraded) return { kind: "hi", lines: [], picture: { w: b.w, h: b.h, bits: b.bits } };
  if (s.menu !== null && id !== "grave") {
    CHICK_ICONS.forEach((icon, i) => {
      const x = i * ICON_SIZE;
      b.rect(x, 0, ICON_SIZE, ICON_SIZE, 0);
      b.blit(table.icons.get(icon) ?? [], x, 0);
      if (i === s.menu) b.invert(x, 0, ICON_SIZE, ICON_SIZE);
    });
  }
  if (s.flashAt !== null && env.t - s.flashAt >= 0 && env.t - s.flashAt < CHICK_FLASH_MS) b.invert(0, 0, b.w, b.h);
  const f = finer(b, env.level);
  return { kind: "pixels", w: f.w, h: f.h, bits: f.bits };
}

const BEEP = "chick-beep";

export const chick: Program<ChickState> = {
  id: "chick",
  channel: { w: CHICK_W, h: CHICK_H },
  keySound: { id: BEEP },
  init: (env) => ({ menu: null, act: null, flashAt: null, born: env.t }),
  key(s, key, env) {
    // The new world feeds it; nothing you press changes anything.
    if (env.upgraded && key !== "reset") return step(s);
    switch (key) {
      case "A":
        return step({ ...s, menu: s.menu === null ? 0 : (s.menu + 1) % CHICK_ICONS.length, act: null });
      case "B": {
        if (s.menu === null) return step(s);
        const kind = ICON_ACT[CHICK_ICONS[s.menu]!];
        return step({ ...s, act: { kind, at: env.t } }, { sound: BEEP, rate: SEMITONE, delay: CHICK_SUCCESS_DELAY_MS });
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
