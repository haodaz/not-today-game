// The credits are Kuro's log (san-and-endings FR3, design E4): one line per stored evidence entry,
// in day order — the day, what the player did (the entry's note), and which way it moved Kuro.
// Built only from `judgement.evidence`; never generated at credits time.
import { endingFlavour, type Ending } from "@state/endings";
import type { JudgementDelta } from "@state/judgement";
import { RIGHT_DELTA } from "@state/recognise";
import type { State } from "@state/types.gen";
import { upgradeTable } from "@state/upgrades";
import { t } from "@world/i18n";

export const DIMENSIONS = ["truth", "values", "bond"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** One line per 1.6 s (FR3). */
export const CREDIT_LINE_MS = 1_600;

export interface CreditLine {
  readonly day: number;
  readonly eventId: string;
  readonly note: string;
  /** Which way it moved each dimension: +1 up, −1 down (zero dimensions left out). */
  readonly moved: readonly { readonly dim: Dimension; readonly dir: 1 | -1 }[];
}

/**
 * Where an entry came from, by its event id, gives the move: the same content that wrote it.
 * An id from a source this does not know yet moves nothing visible.
 */
export function deltaOf(eventId: string): JudgementDelta {
  if (eventId.startsWith("upgrade:")) return upgradeTable.judgement.accept;
  if (eventId.startsWith("declineUpgrade:")) return upgradeTable.judgement.decline;
  if (eventId.startsWith("recognise:")) return RIGHT_DELTA;
  return {};
}

/** A chat judgement's entry carries the day's scores (kuro-chat FR4); older entries do not. */
const dimsOf = (e: unknown): JudgementDelta | null => {
  const d = (e as { dims?: unknown }).dims;
  return d && typeof d === "object" ? (d as JudgementDelta) : null;
};

/** The offline scorer's notes are string keys (`judge.offline.*`); the model's are text. */
const noteOf = (note: string): string => (/^judge\.[\w.]+$/.test(note) ? t(note) : note);

export function creditLines(state: State): CreditLine[] {
  return state.judgement.evidence
    .map((e, i) => ({ e, i }))
    // Day order; entries of the same day keep the order they were made.
    .sort((a, b) => Number(a.e.day) - Number(b.e.day) || a.i - b.i)
    .map(({ e }) => {
      const d = dimsOf(e) ?? deltaOf(String(e.eventId));
      const moved = DIMENSIONS.flatMap((dim) => {
        const v = d[dim] ?? 0;
        return v === 0 ? [] : [{ dim, dir: (v > 0 ? 1 : -1) as 1 | -1 }];
      });
      return { day: Number(e.day), eventId: String(e.eventId), note: noteOf(String(e.note)), moved };
    });
}

/** The ending's last line (content: `credits.last.<flavour>`: survive by its warm / cold flavour); good's is the plain red/blue line. */
export const lastLineKey = (ending: Ending, state: State): string => `credits.last.${endingFlavour(ending, state)}`;

/**
 * How many lines show at `nowMs` (the evidence lines, then the last one). A click jumps to the end
 * (`skippedAt`); it never skips the roll entirely.
 */
export function creditsShown(total: number, startMs: number, nowMs: number, skipped: boolean): number {
  if (skipped) return total;
  return Math.min(total, Math.max(0, Math.floor((nowMs - startMs) / CREDIT_LINE_MS) + 1));
}
