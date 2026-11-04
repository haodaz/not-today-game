// After an upgrade, Kuro moves in (object-upgrade addition 2026-11-03). Upgrading is a loan: the
// object's screen is Kuro's hi screen at once, and three days later it is only Kuro. An object that
// was never upgraded is never taken (its old screen is too coarse to hold Kuro); the drawer always
// shows the original. Pure: the log and session time in, the two states and the Kuro pose out. Only
// Kuro gets randomness, and it is seeded, so a replay renders the same frames.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { hash, unit } from "@state/seed";
import type { HiFrame } from "./frame";
import type { KuroPose } from "./kurogotchi";
import type { ObjectEnv } from "./program";

/** Three days after the upgrade it belongs to Kuro (the upgrade day and the two after are the loan). */
export const TAKEN_AFTER_DAYS = 3;
/** Not yet taken: a glimpse of Kuro after a key press, this often, for this long. */
export const GLIMPSE_CHANCE = 1 / 6;
export const GLIMPSE_MS = 180;
/** Taken: the idle loop. */
export const BLINK_EVERY_MS = 4_000;
export const BLINK_MS = 300;
export const TALK_MS = 600;
export const RED_MS = 1_500;
export const RED_CHANCE = 1 / 12;

/** The day of `id`'s `upgrade` event, or null (never upgraded). */
export function upgradedOn(id: string, events: readonly GameEvent[]): number | null {
  for (const e of events) if (e.kind === "upgrade" && e.object === id) return e.day;
  return null;
}

/**
 * `id` has been taken by Kuro: it was upgraded, and three days or more have passed since (the
 * upgrade day and the two after are the loan, still the object's own ability). An object never
 * upgraded is never taken. Pure.
 */
export function takenByKuro(id: string, state: Pick<State, "day">, events: readonly GameEvent[]): boolean {
  const on = upgradedOn(id, events);
  return on !== null && state.day - on >= TAKEN_AFTER_DAYS;
}

/** The press this object has seen (its own counter and when the last one was, in session ms). */
export interface KuroPress {
  readonly n: number;
  readonly at: number;
}

/** A seeded roll in [0, 1) for this object's nth press (only Kuro gets randomness). */
const roll = (env: ObjectEnv, tag: string): number => unit(hash(`${env.seed}:${tag}`));

/**
 * The pose Kuro shows in the hi screen now, or null to leave the object's own screen as it is.
 *   taken: always a pose — talk for 600 ms after a press, else a 1/12 red flash on returning to
 *     idle, else base with a 300 ms blink every ~4 s.
 *   upgraded but not taken: null, except a 180 ms glimpse (base / blink) after a press that a 1/6
 *     seeded roll on that press number chose.
 * Pure: `env.t` is session ms, `press` the object's own counter; the roll is seeded by `env.seed`.
 */
export function kuroPoseAt(env: ObjectEnv, press: KuroPress): KuroPose | null {
  const since = env.t - press.at;
  if (env.taken) {
    if (press.at >= 0 && since >= 0 && since < TALK_MS) return "talk";
    // Which ~4 s idle window we are in, and how far into it.
    const win = Math.floor(env.t / BLINK_EVERY_MS);
    const into = env.t - win * BLINK_EVERY_MS;
    if (roll(env, `red:${win}`) < RED_CHANCE && into < RED_MS) return "red";
    return into < BLINK_MS ? "blink" : "base";
  }
  // Not yet taken: only a brief glimpse after a chosen press.
  if (press.at >= 0 && since >= 0 && since < GLIMPSE_MS && roll(env, `glimpse:${press.n}`) < GLIMPSE_CHANCE) {
    // base or blink, by the same seeded press number (a second roll).
    return roll(env, `glimpseFace:${press.n}`) < 0.5 ? "base" : "blink";
  }
  return null;
}

/** A per-object press counter and when the last press was (session ms); programs keep one. */
export const NO_PRESS: KuroPress = { n: 0, at: -Infinity };
/** Bump the press tracker on a key (its draw reads `n` for the seed and `at` for the windows). */
export const pressed = (p: KuroPress, t: number): KuroPress => ({ n: p.n + 1, at: t });

/**
 * The hi screen for an upgraded object (object-upgrade 2026-11-03). Taken: only Kuro (its own
 * screen is empty). Not yet taken: the object's own hi frame `own`, with a Kuro glimpse laid over
 * it when the seed says so. The device's own `draw` passes what it would show while upgraded.
 */
export function upgradedHi(env: ObjectEnv, press: KuroPress, own: Omit<HiFrame, "kind" | "kuro">): HiFrame {
  const pose = kuroPoseAt(env, press);
  if (env.taken) return { kind: "hi", lines: [], kuro: pose ?? "base" };
  return { kind: "hi", ...own, ...(pose ? { kuro: pose } : {}) };
}
