// SAN and the exits (san-and-endings spec; the ending matrix of 2026-11-13, author's second pass).
// SAN is never shown; it only changes through content effects and is clamped by its range in
// variables.json. An ending is one event that sets `ending` once; after it the run takes nothing
// more. Pure, clock-free.
//
// The five endings, her names (script/notes/day-18-endings-2026-11-13.md):
//   collapse  温柔的世界   SAN 0 on any day; the run never reaches day 18
//   bad       以我之名     assimilation full at the last lie-down (the run reaches day 18 and fights)
//   survive   回到未来     the last lie-down, not good; two flavours by affinity (warm / cold)
//   good      导盲犬小克   survive's conditions + the hand, every object recognised, affinity,
//                          assimilation low, and no object upgraded
import type { State } from "./types.gen";
import { constants, membersOf, rangeOf } from "./variables";

export const ENDINGS = ["bad", "survive", "good", "collapse"] as const;
export type Ending = (typeof ENDINGS)[number];

/** survive's two faces: Kuro's attitude and lines differ (author 2026-11-13: 存活1 / 存活2). */
export type SurviveFlavour = "warm" | "cold";

/** The ending as the pages and the title name it: survive splits by its flavour. */
export type EndingFlavour = "collapse" | "bad" | "survive.warm" | "survive.cold" | "good";

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

/** Assimilation at its max is 以我之名 (bad), decided at the last lie-down. */
const assimilationMax = (): number => constants.assimilationMax as number;

/** Affinity at or over the threshold: Q-Kuro joins the fight, survive is warm. */
export const affinityHigh = (state: State): boolean => state.affinity >= (constants.affinityThreshold as number);

/** No object upgraded: the whole party kept its original shape (the good ending's new gate). */
export const noneUpgraded = (state: State): boolean => Object.values(state.upgraded).every((v) => v !== true);

export interface GoodConditions {
  readonly shookHand: boolean;
  readonly recognisedAll: boolean;
  readonly affinity: boolean;
  /** Assimilation stayed low enough (three-meters: ≤ assimilationGoodMax, in place of `unchecked`). */
  readonly assimilationOk: boolean;
  /** Not one object upgraded (ending matrix 2026-11-13). */
  readonly noneUpgraded: boolean;
}

/**
 * The five conditions of the good ending (three-meters: blockedAll dropped, unchecked → assimilation;
 * ending matrix: no object upgraded). `recognisedAll` is over the whole `recognised` set of
 * variables.json: all eight objects (2026-11-06).
 */
export function goodConditions(state: State): GoodConditions {
  const all = membersOf("recognised") ?? [];
  return {
    shookHand: state.flags.includes("shook_hand"),
    recognisedAll: all.every((o) => (state.recognised as string[]).includes(o)),
    affinity: affinityHigh(state),
    assimilationOk: state.assimilation <= (constants.assimilationGoodMax as number),
    noneUpgraded: noneUpgraded(state),
  };
}

export const isGood = (state: State): boolean => Object.values(goodConditions(state)).every(Boolean);

/** survive's flavour from the run: warm when affinity is high (Q-Kuro fought beside you), else cold. */
export const surviveFlavour = (state: State): SurviveFlavour => (affinityHigh(state) ? "warm" : "cold");

/** The flavoured name of an ending, for its pages, its lines and the title (`ending.name.<flavour>`). */
export function endingFlavour(ending: Ending, state: State): EndingFlavour {
  return ending === "survive" ? `survive.${surviveFlavour(state)}` : ending;
}

/**
 * At the shutdown beat: only collapse, when SAN has reached 0. Assimilation at its max no longer
 * ends a run early (ending matrix 2026-11-13): 以我之名 is decided at the last lie-down, after the
 * fight. Never mid-beat (the run is still "none").
 */
export function dueAtShutdown(state: State): Ending | null {
  if (state.ending !== "none") return null;
  if (state.san <= SAN_MIN) return "collapse";
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
  // collapse is due at a shutdown beat or at any 躺下; bad / good / survive at the last 躺下 only.
  const due = kind === "collapse" ? (dueAtShutdown(state) ?? dueAtLieDown(state)) : dueAtLieDown(state);
  if (due !== kind) throw new Error(`ending: "${kind}" is not due now`);
  // The dialogue a choice left behind does not matter any more; nothing else changes.
  return { ...state, ending: kind };
}
