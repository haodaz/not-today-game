// The tape and walkman (objects-in-hand FR3.5): play, stop, ff, rew, vol+, vol-. No screen: the
// reels turn at the true ratio (one pack grows as the other shrinks, at constant tape speed), and
// what is on the tape plays in the dialogue box as content's recordings (stop takes it back).
// The recording marked `after: 15` only plays after that dream night, from a rewind to the start.
import { handOf, type Recording } from "@state/hands";
import { dreamNights } from "@state/stages";
import { NO_FRAME, type Frame } from "./frame";
import { step, type ObjectEnv, type Out, type Program } from "./program";
import { NO_PRESS, pressed, upgradedHi, type KuroPress } from "./taken";

/** One side of the tape, at play speed (ms). */
export const TAPE_SIDE_MS = 10 * 60_000;
/** Fast forward / rewind run this many times faster. */
export const TAPE_FAST = 12;
/** A pack's radius, as multiples of the hub's radius from content: empty, full. */
export const PACK_EMPTY = 1.2;
export const PACK_FULL = 2.6;
export const VOLUME_MAX = 10;
export const VOLUME_START = 6;
const HISS = "tape-hiss";

/** `rec` (tape-record R1): recording at the bedside; the reels turn slowly until the day ends. */
export type TapeMode = "stop" | "play" | "ff" | "rew" | "rec";
/** Recording runs this much slower than play (the reels turn slowly). */
export const TAPE_REC_RATE = 0.25;
export interface TapeState {
  readonly mode: TapeMode;
  /** When the current mode began (session ms) and where the tape was then (0 = start, 1 = end). */
  readonly since: number;
  readonly pos0: number;
  readonly volume: number;
  /** The next recording to play (in this play list). */
  readonly index: number;
  /** Rewound to the very start since the last play. */
  readonly rewound: boolean;
  /** Kuro's press tracker (object-upgrade 2026-11-03). */
  readonly press: KuroPress;
}

const speed = (mode: TapeMode): number => (mode === "play" ? 1 : mode === "rec" ? TAPE_REC_RATE : mode === "ff" ? TAPE_FAST : mode === "rew" ? -TAPE_FAST : 0) / TAPE_SIDE_MS;
/** Where the tape is at time t. */
export const tapePos = (s: TapeState, t: number): number => Math.max(0, Math.min(1, s.pos0 + speed(s.mode) * Math.max(0, t - s.since)));

/** Radii (as multiples of the hub) at position p: the area of tape is conserved, so r² is linear in p. */
export function packRadii(p: number): { left: number; right: number } {
  const e2 = PACK_EMPTY ** 2;
  const f2 = PACK_FULL ** 2;
  return { left: Math.sqrt(e2 + (f2 - e2) * (1 - p)), right: Math.sqrt(e2 + (f2 - e2) * p) };
}
/**
 * Each reel's turn (radians) at position p: the tape runs at constant speed v, so a reel's angle is
 * ∫ v / r. With r² = a ∓ b·p this is closed: θ = (2 / b)(√a − √(a − b·p)) per unit of tape length.
 * `length` is the tape's length in hub radii, so the angles are true to the radii.
 */
export function reelAngles(p: number, length = 400): { left: number; right: number } {
  const e2 = PACK_EMPTY ** 2;
  const k = PACK_FULL ** 2 - e2; // r² changes by k over the whole tape
  const left = ((2 * length) / k) * (PACK_FULL - Math.sqrt(PACK_FULL ** 2 - k * p));
  const right = ((2 * length) / k) * (Math.sqrt(e2 + k * p) - PACK_EMPTY);
  return { left, right };
}

/** The recordings this play list holds: the ordinary ones, and from dream night 15 (after a rewind) the one marked for it. */
export function playList(env: Pick<ObjectEnv, "day" | "sleeptalk">, rewound: boolean, all: readonly Recording[] = handOf("tape").recordings): Recording[] {
  // tape-record R2: what it caught on earlier nights is on the tape after the ordinary recordings.
  return [...all, ...(env.sleeptalk ?? [])].filter((r) => r.after === null || (rewound && dreamNights.includes(r.after) && env.day > r.after));
}

export const tapeSayKey = (day: number, id: string) => `d${day}:tape:${id}`;
export const TAPE_SAY_PREFIX = (day: number) => `d${day}:tape:`;

/** Upgraded: the transcript scrolls where the window of the deck is; otherwise there is no screen. */
export const TRANSCRIPT_SCROLL_MS = 1_500;
export function drawTape(s: TapeState, env: ObjectEnv): Frame {
  if (!env.upgraded) return NO_FRAME;
  // Upgraded: the transcript scrolls in the deck's window — until Kuro, moved in, fills it (a
  // glimpse on loan, only Kuro once taken; object-upgrade 2026-11-03).
  const lines = transcript(env);
  return upgradedHi(env, s.press, { lines, scroll: lines.length ? Math.floor(env.t / TRANSCRIPT_SCROLL_MS) % lines.length : 0 });
}

export const tape: Program<TapeState> = {
  id: "tape",
  channel: null,
  keySound: { id: "tape-click" },
  init: (env) => ({ mode: "stop", since: env.t, pos0: 0, volume: VOLUME_START, index: 0, rewound: false, press: NO_PRESS }),
  key(s0, key, env) {
    const t = env.t;
    const s = { ...s0, press: pressed(s0.press, env.t) };
    // Taken: the deck is gone; Kuro answers only with talk (no reels, no recordings).
    if (env.taken) return step(s);
    const at = { since: t, pos0: tapePos(s, t) };
    const vol = s.volume / VOLUME_MAX;
    const stopSay: Out = { stopSay: TAPE_SAY_PREFIX(env.day) };
    switch (key) {
      case "play": {
        if (s.mode === "play") return step(s);
        const list = playList(env, s.rewound);
        const rec = list[s.index];
        const out: Out[] = [{ sound: HISS, volume: vol }];
        // The new world transcribes it (the lines scroll on the walkman); the reels do not turn.
        if (rec && !env.upgraded) out.push({ say: { key: tapeSayKey(env.day, rec.id), lines: rec.say } });
        return step({ ...s, ...at, mode: env.upgraded ? "stop" : "play", index: rec ? s.index + 1 : s.index }, ...out);
      }
      case "stop":
        return step({ ...s, ...at, mode: "stop" }, stopSay);
      case "ff":
        // A squeal and fast reels; the box shows nothing. The next recording is skipped.
        return step({ ...s, ...at, mode: "ff", index: s.index + 1, rewound: false }, stopSay, { sound: HISS, rate: 2.5, volume: vol });
      case "rew":
        // Back to the start: the play list begins again (and may now hold one more).
        return step({ ...s, ...at, mode: "rew", index: 0, rewound: true }, stopSay, { sound: HISS, rate: 2.5, volume: vol });
      case "vol+": {
        const volume = Math.min(VOLUME_MAX, s.volume + 1);
        // At the top it squeals.
        return step({ ...s, volume }, ...(volume === VOLUME_MAX ? [{ sound: HISS, rate: 3, volume: 1 } as Out] : []));
      }
      case "vol-":
        return step({ ...s, volume: Math.max(0, s.volume - 1) });
      case "rec":
        // tape-record R1: the action admits it only where and when it records; upgraded, never.
        if (env.upgraded || s.mode === "rec") return step(s);
        return step({ ...s, ...at, mode: "rec" }, stopSay);
      default:
        return step(s);
    }
  },
  draw: drawTape,
};

/** The upgraded walkman's transcript: every recording's lines, in order. */
export function transcript(env: Pick<ObjectEnv, "day" | "sleeptalk">): string[] {
  return playList(env, false).flatMap((r) => r.say.map((l) => l.t));
}
