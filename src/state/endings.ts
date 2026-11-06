// SAN and the three exits (san-and-endings spec). SAN is never shown; it only changes through
// content effects and is clamped by its range in variables.json. An ending is one event that sets
// `ending` once; after it the run takes nothing more. Pure, clock-free.
import type { State } from "./types.gen";
import { constants, membersOf, rangeOf } from "./variables";

export const ENDINGS = ["bad", "survive", "good", "collapse"] as const;
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

/** Assimilation at its max is the 温柔的世界 (bad) ending (three-meters spec). */
const assimilationMax = (): number => constants.assimilationMax as number;

export interface GoodConditions {
  readonly shookHand: boolean;
  readonly recognisedAll: boolean;
  readonly affinity: boolean;
  /** Assimilation stayed low enough (three-meters: ≤ assimilationGoodMax, in place of `unchecked`). */
  readonly assimilationOk: boolean;
}

/**
 * The four conditions of the good ending (three-meters: blockedAll dropped, unchecked → assimilation).
 * `recognisedAll` is over the whole `recognised` set of variables.json: all eight objects (2026-11-06).
 */
export function goodConditions(state: State): GoodConditions {
  const all = membersOf("recognised") ?? [];
  return {
    shookHand: state.flags.includes("shook_hand"),
    recognisedAll: all.every((o) => (state.recognised as string[]).includes(o)),
    affinity: state.affinity >= (constants.affinityThreshold as number),
    assimilationOk: state.assimilation <= (constants.assimilationGoodMax as number),
  };
}

export const isGood = (state: State): boolean => Object.values(goodConditions(state)).every(Boolean);

/**
 * At the shutdown beat (three-meters spec): collapse when SAN has reached 0; bad only when
 * assimilation is at its max. SAN no longer leads to bad. Never mid-beat (the run is still "none").
 */
export function dueAtShutdown(state: State): Ending | null {
  if (state.ending !== "none") return null;
  if (state.san <= SAN_MIN) return "collapse";
  if (state.assimilation >= assimilationMax()) return "bad";
  return null;
}

/**
 * When a night ends (lying down). Collapse ends the run on ANY day the moment SAN has reached 0 —
 * right after the night's board judgement, with no next day (three-meters spec). On the last day
 * (`constants.lastDay`) the other exits are due: bad when assimilation is at its max, else good if
 * its conditions hold, else survive.
 */
export function dueAtLieDown(state: State): Ending | null {
  if (state.ending !== "none") return null;
  if (state.san <= SAN_MIN) return "collapse";
  if (state.day !== (constants.lastDay as number)) return null;
  if (state.assimilation >= assimilationMax()) return "bad";
  return isGood(state) ? "good" : "survive";
}

/** The `ending` reducer: once per run, and only when it is due. */
export function applyEnding(state: State, event: { readonly kind: string; readonly ending: string }): State {
  const kind = event.ending as Ending;
  if (!(ENDINGS as readonly string[]).includes(kind)) throw new Error(`ending: unknown ending "${event.ending}"`);
  if (state.ending !== "none") throw new Error("ending: the run has already ended");
  // collapse and bad are due at a shutdown beat (collapse also at the last 躺下); good / survive at 躺下.
  const due = kind === "bad" || kind === "collapse" ? (dueAtShutdown(state) ?? dueAtLieDown(state)) : dueAtLieDown(state);
  if (due !== kind) throw new Error(`ending: "${kind}" is not due now`);
  // The dialogue a choice left behind does not matter any more; nothing else changes.
  return { ...state, ending: kind };
}
