// SAN and the three exits (san-and-endings spec). SAN is never shown; it only changes through
// content effects and is clamped by its range in variables.json. An ending is one event that sets
// `ending` once; after it the run takes nothing more. Pure, clock-free.
import type { State } from "./types.gen";
import { blockedEveryRaid } from "./nights";
import { constants, membersOf, rangeOf } from "./variables";

export const ENDINGS = ["bad", "survive", "good"] as const;
export type Ending = (typeof ENDINGS)[number];

const SAN_RANGE = (rangeOf("san") ?? [0, 100]) as [number, number];
export const SAN_MIN = SAN_RANGE[0] ?? 0;
export const SAN_MAX = SAN_RANGE[1] ?? 100;

/** How many of `constants.sanThresholds` SAN is below: 0 (fine) .. thresholds.length. Presentation only. */
export function sanBand(san: number): number {
  return (constants.sanThresholds as number[]).filter((t) => san < t).length;
}

/** The heart-rate chip: `bpmAtFullSan` at full SAN, rising linearly to `bpmAtZeroSan` at 0. */
export function bpm(san: number): number {
  const full = constants.bpmAtFullSan as number;
  const zero = constants.bpmAtZeroSan as number;
  const s = Math.min(SAN_MAX, Math.max(SAN_MIN, san));
  return Math.round(full + (zero - full) * (1 - (s - SAN_MIN) / (SAN_MAX - SAN_MIN)));
}

export interface GoodConditions {
  readonly shookHand: boolean;
  readonly recognisedAll: boolean;
  readonly blockedAll: boolean;
  readonly affinity: boolean;
  readonly unchecked: boolean;
}

/** The five conditions of the good ending (FR2). */
export function goodConditions(state: State): GoodConditions {
  const six = membersOf("recognised") ?? [];
  return {
    shookHand: state.flags.includes("shook_hand"),
    recognisedAll: six.every((o) => (state.recognised as string[]).includes(o)),
    blockedAll: blockedEveryRaid(state),
    affinity: state.affinity >= (constants.affinityThreshold as number),
    unchecked: state.letItDoUnchecked <= (constants.goodMaxUnchecked as number),
  };
}

export const isGood = (state: State): boolean => Object.values(goodConditions(state)).every(Boolean);

/** At the shutdown beat: SAN has reached 0, and the run has not ended (FR1: never mid-beat). */
export function dueAtShutdown(state: State): Ending | null {
  return state.ending === "none" && state.san <= SAN_MIN ? "bad" : null;
}

/**
 * When the last night ends (lying down on `constants.lastDay`): good if all five hold, else
 * survive (slip filled, neither flag, or holding the hand without the rest).
 */
export function dueAtLieDown(state: State): Ending | null {
  if (state.ending !== "none" || state.day !== (constants.lastDay as number)) return null;
  // SAN reached 0 after the last shutdown beat: there is no next one, so it ends here (design E7).
  if (state.san <= SAN_MIN) return "bad";
  return isGood(state) ? "good" : "survive";
}

/** The `ending` reducer: once per run, and only when it is due. */
export function applyEnding(state: State, event: { readonly kind: string; readonly ending: string }): State {
  const kind = event.ending as Ending;
  if (!(ENDINGS as readonly string[]).includes(kind)) throw new Error(`ending: unknown ending "${event.ending}"`);
  if (state.ending !== "none") throw new Error("ending: the run has already ended");
  const due = kind === "bad" ? dueAtShutdown(state) : dueAtLieDown(state);
  if (due !== kind) throw new Error(`ending: "${kind}" is not due now`);
  // The dialogue a choice left behind does not matter any more; nothing else changes.
  return { ...state, ending: kind };
}
