// The end-of-beat judgement (kuro-chat FR4): the JSON schema the model must follow (structured
// outputs), and the validation every result passes — the model's and the offline scorer's alike:
// integers clamped to −2..2, evidence kept only when its eventId is in the log, notes trimmed,
// the summary clipped. Pure.
import { clipSummary } from "./turns.ts";
import type { Judgement } from "./types.ts";

const SCORE = { type: "integer", enum: [-2, -1, 0, 1, 2] } as const;

/** `output_config.format.schema` for the judge call. */
export const JUDGEMENT_SCHEMA = {
  type: "object",
  properties: {
    truth: SCORE,
    values: SCORE,
    bond: SCORE,
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: { eventId: { type: "string" }, note: { type: "string" } },
        required: ["eventId", "note"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["truth", "values", "bond", "evidence", "summary"],
  additionalProperties: false,
} as const;

export const SCORE_RANGE = [-2, 2] as const;
export const NOTE_MAX = 200;

const score = (v: unknown): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(SCORE_RANGE[1], Math.max(SCORE_RANGE[0], n));
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * A judgement as the game accepts it, or null when it is not one at all. Evidence citing an id
 * that is not in `ids` is dropped (uncited claims never count); the same (id, note) is kept once.
 */
export function validateJudgement(raw: unknown, ids: ReadonlySet<string>): Judgement | null {
  if (!isRecord(raw)) return null;
  const evidence: { eventId: string; note: string }[] = [];
  const seen = new Set<string>();
  for (const e of Array.isArray(raw.evidence) ? raw.evidence : []) {
    if (!isRecord(e) || typeof e.eventId !== "string" || typeof e.note !== "string") continue;
    const note = [...e.note.trim()].slice(0, NOTE_MAX).join("");
    const key = `${e.eventId}\u0000${note}`;
    if (!ids.has(e.eventId) || !note || seen.has(key)) continue;
    seen.add(key);
    evidence.push({ eventId: e.eventId, note });
  }
  const summary = typeof raw.summary === "string" ? clipSummary(raw.summary) : undefined;
  return { truth: score(raw.truth), values: score(raw.values), bond: score(raw.bond), evidence, ...(summary !== undefined ? { summary } : {}) };
}

/** The same shape, both paths: what the property tests compare. */
export const JUDGEMENT_KEYS = ["truth", "values", "bond", "evidence"] as const;
