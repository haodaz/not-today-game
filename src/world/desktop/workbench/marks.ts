// Marking is the operation that decides the player's numbers (work spec 2026-11-02). Pure helpers
// shared by the view and the actions: which spots a surface lists, whether a click or a drag hits a
// listed spot, the pen economy, and the worth a hit is credited. No DOM, no session mutation here.
import type { TaskMark } from "@state/days/tasks";

/** 看克总的 (look) gives three red pens; 自己做 (self) gives unlimited. */
export const LOOK_PENS = 3;

/** One mark the player made: a clause (and maybe a span inside it), and whether it hit a listed spot. */
export interface Mark {
  readonly clause: number;
  readonly span?: readonly [number, number];
  readonly hit: boolean;
  /** The worth credited (full on a click hit, half rounded down — min 1 — on a span hit). */
  readonly worth: number;
}

/** Two character ranges overlap (share at least one character). */
const overlaps = (a: readonly [number, number], b: readonly [number, number]): boolean => a[0] < b[1] && b[0] < a[1];

/**
 * The listed spot a mark hits, if any. A click on a clause ("this line") hits any spot on that
 * clause. A drag across a span ("something in here") hits a spot on that clause whose own span it
 * overlaps (or any spot on the clause when the spot has no span).
 */
export function spotHit(marks: readonly TaskMark[] | undefined, clause: number, span?: readonly [number, number]): TaskMark | null {
  if (!marks) return null;
  for (const m of marks) {
    if (m.clause !== clause) continue;
    if (span === undefined) return m; // "this line": the clause itself
    if (m.span === undefined || overlaps(span, m.span)) return m; // "something in here"
  }
  return null;
}

/** The worth a hit is credited: full on a click, half (rounded down, min 1) on a span (work FR5). */
export function hitWorth(spot: TaskMark, span?: readonly [number, number]): number {
  return span === undefined ? spot.worth : Math.max(1, Math.floor(spot.worth / 2));
}

/** How many pens the mode starts with: three for look, unlimited (Infinity) for self. */
export const pensFor = (mode: "self" | "look"): number => (mode === "look" ? LOOK_PENS : Infinity);

/** Pens left after `made` marks in `mode`: self never runs out; look loses one per mark (hit or miss). */
export function pensLeft(mode: "self" | "look", made: number): number {
  return mode === "look" ? Math.max(0, LOOK_PENS - made) : Infinity;
}

/** May the player still mark? Self always; look while pens remain. */
export const canMark = (mode: "self" | "look", made: number): boolean => pensLeft(mode, made) > 0;

/** A `kuro` spot hidden from the diff (work FR6, day 7+): not highlighted in 看一眼's diff. */
export const isHidden = (spot: TaskMark): boolean => spot.kind === "kuro" && spot.hidden === true;

/** The marks as the task event records them: `{ clause, hit }` per mark, in order. */
export const eventMarks = (made: readonly Mark[]): { clause: number; hit: boolean }[] => made.map((m) => ({ clause: m.clause, hit: m.hit }));
