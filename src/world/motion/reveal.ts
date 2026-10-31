// The dialogue line's per-character reveal (polish FR3). Pure: a start time and a clock give how
// many characters show. The session holds one Reveal for the line on screen (design P4).
import type { SayLine } from "@state/days/table";
import { MOTION } from "./timing";

export interface Reveal {
  /** `queue[0].key:line` — which line this is. */
  readonly key: string;
  readonly startMs: number;
  /** Characters to reveal. */
  readonly total: number;
  readonly perChar: number;
  /** A line with a sound id: the sound first, the text this much later. */
  readonly leadMs: number;
  /** Set when a click completes the line early. */
  completedAt: number | null;
  /** The night's last line before lying down: it holds, then the day ends by itself. */
  readonly hold: boolean;
}

/** Characters as the reader sees them (code points, so a surrogate pair is one). */
export const charCount = (text: string): number => [...text].length;

export function startReveal(key: string, line: Pick<SayLine, "k" | "sfx">, total: number, nowMs: number, hold = false): Reveal {
  return {
    key,
    startMs: nowMs,
    total,
    perChar: line.k === "inner" ? MOTION.perChar * MOTION.innerSlow : MOTION.perChar,
    leadMs: line.sfx ? MOTION.soundLead : 0,
    completedAt: null,
    hold,
  };
}

/** When the last character shows (or the click that completed it). */
export function revealDoneAt(r: Reveal): number {
  const natural = r.startMs + r.leadMs + r.total * r.perChar;
  return r.completedAt === null ? natural : Math.min(natural, r.completedAt);
}

/** How many characters show at `nowMs` (0..total). */
export function revealShown(r: Reveal, nowMs: number): number {
  if (nowMs >= revealDoneAt(r)) return r.total;
  const t = nowMs - r.startMs - r.leadMs;
  if (t <= 0) return 0;
  return Math.min(r.total, Math.floor(t / r.perChar) + 1);
}

/** Until when clicks are not "next": the reveal, then the hold if any. */
export function holdUntil(r: Reveal): number {
  return revealDoneAt(r) + (r.hold ? MOTION.lastLineHold : 0);
}

/** Still revealing at `nowMs`. */
export const revealBusy = (r: Reveal, nowMs: number): boolean => nowMs < revealDoneAt(r);

/** Which line is on screen: the reveal's key. */
export function lineKey(d: { readonly queue: readonly { readonly key: string }[]; readonly line: number }): string | null {
  const q = d.queue[0];
  return q ? `${q.key}:${d.line}` : null;
}

/**
 * A click on the dialogue (polish FR3): if the line is still appearing, complete it; during the
 * night's last-line hold, do nothing. Returns true when the click was used up here.
 */
export function gateAdvance(session: { reveal: Reveal | null; readonly dialogue: Parameters<typeof lineKey>[0] }, nowMs: number): boolean {
  const r = session.reveal;
  if (!r || r.key !== lineKey(session.dialogue)) return false;
  if (revealBusy(r, nowMs)) {
    r.completedAt = nowMs;
    return true;
  }
  return nowMs < holdUntil(r);
}
