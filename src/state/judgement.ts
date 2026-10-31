// Kuro's judgement of the player (state `judgement`): the deterministic writes events make to it.
// Every entry cites an event id, so the credits log can be built from evidence alone.
import variables from "@content/variables.json";
import type { State } from "./types.gen";

export interface JudgementDelta {
  readonly truth?: number;
  readonly values?: number;
  readonly bond?: number;
}

/** The judgement fields' range from the variable table ("int -10..10"). */
export const JUDGEMENT_RANGE: readonly [number, number] = (() => {
  const m = /(-?\d+)\.\.(-?\d+)/.exec(variables.judgement.fields.truth);
  return m ? [Number(m[1]), Number(m[2])] : [-Infinity, Infinity];
})();
const clamp = (n: number) => Math.min(JUDGEMENT_RANGE[1], Math.max(JUDGEMENT_RANGE[0], n));

/** Moves the judgement by `d` (clamped) and records why. */
export function judge(state: State, d: JudgementDelta, day: number, eventId: string, note: string): State {
  const j = state.judgement;
  return {
    ...state,
    judgement: {
      truth: clamp(j.truth + (d.truth ?? 0)),
      values: clamp(j.values + (d.values ?? 0)),
      bond: clamp(j.bond + (d.bond ?? 0)),
      evidence: [...j.evidence, { day, eventId, note }],
    },
  };
}

/** Whether an entry citing `eventId` is already there. */
export const hasEvidence = (state: State, eventId: string): boolean => state.judgement.evidence.some((e) => e.eventId === eventId);
