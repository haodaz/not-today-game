// Delivery waiting (FR3 / design L5): after an order, the meal arrives once at least `minMinutes`
// of play have passed and either the next work item is done or `waitMinutes` have passed.

export interface WaitInput {
  readonly elapsedMs: number;
  readonly minMinutes: number;
  readonly waitMinutes: number;
  /** A work item was done after the order was placed. */
  readonly workDoneSinceOrder: boolean;
}

const MINUTE = 60_000;

export function arrivalDue(w: WaitInput): boolean {
  if (w.elapsedMs < w.minMinutes * MINUTE) return false;
  return w.workDoneSinceOrder || w.elapsedMs >= w.waitMinutes * MINUTE;
}

/** How long until arrival is due if nothing else happens (ms), for the runtime's timer. */
export function msUntilDue(w: Omit<WaitInput, "workDoneSinceOrder">): number {
  return Math.max(0, w.waitMinutes * MINUTE - w.elapsedMs);
}

/** How long until the minimum has passed (ms). */
export function msUntilMinimum(w: Omit<WaitInput, "workDoneSinceOrder">): number {
  return Math.max(0, w.minMinutes * MINUTE - w.elapsedMs);
}
