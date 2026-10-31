// The chat's memory and Kuro's judgement, as reducers (kuro-chat FR2, FR4). Deterministic: the
// same log replays to the same memory, affinity and evidence, whether a turn was answered by the
// model or offline, and whether the judgement came from the model or the rule scorer.
import { isTenderDay } from "./stages";
import { JUDGEMENT_RANGE } from "./judgement";
import type { State } from "./types.gen";
import { constants } from "./variables";

const c = constants as Record<string, unknown>;
const num = (key: string, fallback: number): number => (typeof c[key] === "number" ? (c[key] as number) : fallback);

/** Turns kept verbatim (kuro-chat FR2: N from constants, default 12); a turn is two entries. */
export const MEMORY_TURNS = num("chatMemoryTurns", 12);
/** Affinity per point of (truth + values + bond) (kuro-chat FR4: k from constants, default 5). */
export const AFFINITY_PER_POINT = num("affinityPerPoint", 5);
export const SUMMARY_MAX = 600;
/** One day's scores are −2..2 each (the rubric). */
export const DAY_SCORE: readonly [number, number] = [-2, 2];

/** A turn's words go into memory: what the player said and what Kuro answered (raw). */
export function rememberTurn(state: State, day: number, said: string | undefined, answer: string | undefined, offline: boolean | undefined): State {
  if (said === undefined && answer === undefined) return state;
  const added: State["chatMemory"]["recent"] = [];
  if (said !== undefined) added.push({ day, who: "player", text: said });
  if (answer !== undefined) added.push(offline ? { day, who: "kuro", text: answer, offline: true } as never : { day, who: "kuro", text: answer });
  return { ...state, chatMemory: { ...state.chatMemory, recent: [...state.chatMemory.recent, ...added].slice(-2 * MEMORY_TURNS) } };
}

export interface JudgedFields {
  readonly truth: number;
  readonly values: number;
  readonly bond: number;
  readonly evidence: readonly { readonly eventId: string; readonly note: string }[];
  readonly summary?: string;
  readonly source: "model" | "offline";
}

/** An evidence id is an `ev<index>` of the run's log (checked against the log before appending). */
export const EVENT_ID = /^ev\d+$/;

const isScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= DAY_SCORE[0] && (v as number) <= DAY_SCORE[1];

/** The affinity change for one day's scores: Σ × k, × the tender day's multiplier. */
export function affinityDelta(day: number, s: Pick<JudgedFields, "truth" | "values" | "bond">): number {
  const base = (s.truth + s.values + s.bond) * AFFINITY_PER_POINT;
  return isTenderDay(day) ? base * num("tenderDayAffinityMultiplier", 1) : base;
}

/** The day already has its judgement (one per day): read from the log, not from state. */
export const judgedOn = (events: readonly { readonly kind: string; readonly day: number }[], day: number): boolean =>
  events.some((e) => e.kind === "judged" && e.day === day);

/**
 * The end of a chat beat (kuro-chat FR4): fold the day's assessment. One per day: the caller
 * checks the log (`judgedOn`) before it appends one; a reducer never sees the log.
 * affinity = clamp(0..100, affinity + Σ×k [×multiplier on the tender day]); the judgement's totals
 * move by the scores (clamped to the table's range); each evidence item is logged with the day's
 * delta and scores (the credits read them); the summary replaces the memory's.
 */
export function applyJudged(state: State, day: number, j: JudgedFields): State {
  for (const k of ["truth", "values", "bond"] as const) if (!isScore(j[k])) throw new Error(`judged: ${k} must be an integer −2..2, got ${JSON.stringify(j[k])}`);
  if (j.source !== "model" && j.source !== "offline") throw new Error(`judged: source must be model or offline`);
  if (!Array.isArray(j.evidence)) throw new Error("judged: evidence must be a list");
  for (const e of j.evidence) {
    if (typeof e?.eventId !== "string" || !EVENT_ID.test(e.eventId)) throw new Error(`judged: evidence must cite an event id like ev12, got ${JSON.stringify(e?.eventId)}`);
    if (typeof e.note !== "string" || !e.note.trim()) throw new Error("judged: every evidence item needs a note");
  }
  const delta = affinityDelta(day, j);
  const [lo, hi] = JUDGEMENT_RANGE;
  const clamp = (n: number) => Math.min(hi, Math.max(lo, n));
  const dims = { truth: j.truth, values: j.values, bond: j.bond };
  const evidence = j.evidence.map((e) => ({ day, eventId: e.eventId, note: e.note, delta, dims }));
  return {
    ...state,
    affinity: Math.min(100, Math.max(0, state.affinity + delta)),
    judgement: {
      truth: clamp(state.judgement.truth + j.truth),
      values: clamp(state.judgement.values + j.values),
      bond: clamp(state.judgement.bond + j.bond),
      evidence: [...state.judgement.evidence, ...evidence],
    },
    chatMemory: j.summary !== undefined ? { ...state.chatMemory, summary: [...j.summary].slice(0, SUMMARY_MAX).join("") } : state.chatMemory,
  };
}
