// An object's screen program (objects-in-hand FR2): a pure reducer over key presses and a draw at
// the object's channel. What a screen shows is derived from (day, dream level, upgraded, key
// presses this session); nothing here writes world events. Outputs are a sound, a sequence for the
// dialogue box (the tape's recordings), taking the tape's sequence back, or a chick care (which
// index.ts, not the program, turns into a `pressKey` event; chick-raising R1).
import { dreamNights } from "@state/stages";
import type { CareIcon, ChickStats } from "@state/chick";
import type { PagerMessage, Recording } from "@state/hands";
import type { SayLine } from "@state/days/table";
import type { Frame } from "./frame";

export interface ObjectEnv {
  readonly day: number;
  /** 0..3: one more after each dream night (5, 11, 15), one more while held up to the hand tonight. */
  readonly level: number;
  readonly upgraded: boolean;
  /** Kuro has taken this object (object-upgrade addition 2026-11-03): upgraded and ≥ 3 days on. */
  readonly taken: boolean;
  /** The game clock, HH:MM (the pager's fn shows it). */
  readonly time: string;
  /** Session ms (cosmetic time: idle frames, fades, reels). */
  readonly t: number;
  /** The run's seed for this object (turns, chirps, unasked numbers). */
  readonly seed: string;
  /** 0..1: how much light the object is in (the calculator, the card). */
  readonly lit: number;
  /** The pager's messages so far, oldest first; `unread` is today's, not yet read this session. */
  readonly pager: readonly PagerMessage[];
  /** How many times the card has been used (the pinch marks). */
  readonly uses: number;
  /** camera R8: sheets left in the pack (10 − the run's room photos); absent = none. */
  readonly sheets?: number;
  /** camera R8: the camera is pointed at the screen now (屏幕: unlimited, uncounted). */
  readonly onScreen?: boolean;
  /** tape-record R2: what the walkman caught on earlier nights, as recordings on the tape. */
  readonly sleeptalk?: readonly Recording[];
  /** chick-raising R1: cares counted today (absent = 0). */
  readonly careToday?: number;
  /** chick-raising R2: the chick's stats now, for the status screen (absent = all 0). */
  readonly stats?: ChickStats;
}

export type Out =
  | { readonly sound: string; readonly rate?: number; readonly volume?: number; readonly delay?: number }
  /** chick-raising R1: one care; index.ts appends it as `pressKey` with key `chick:<icon>`. */
  | { readonly care: CareIcon }
  | { readonly say: { readonly key: string; readonly lines: readonly SayLine[] } }
  | { readonly stopSay: string };

export interface Step<S> {
  readonly state: S;
  readonly out: readonly Out[];
}

export interface Program<S> {
  readonly id: string;
  /** The screen's base resolution (before the dream level), or null: no screen. */
  readonly channel: { readonly w: number; readonly h: number } | null;
  /** The sound every key press makes (none: the calculator, the card). */
  readonly keySound: { readonly id: string; readonly rate?: number } | null;
  init(env: ObjectEnv): S;
  key(state: S, key: string, env: ObjectEnv): Step<S>;
  draw(state: S, env: ObjectEnv): Frame;
}

export const MAX_LEVEL = 3;
/** Dream level on a day: the dream nights already slept through (night d is over from day d + 1). */
export function dreamLevel(day: number): number {
  return Math.min(MAX_LEVEL, dreamNights.filter((n) => n < day).length);
}

/** A half-tone up (the chick's success beep). */
export const SEMITONE = 2 ** (1 / 12);

export const step = <S>(state: S, ...out: Out[]): Step<S> => ({ state, out });
