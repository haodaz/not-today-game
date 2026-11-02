// Delivery waiting (FR3 / design L5): after an order, the meal arrives once at least `minMinutes`
// of play have passed and either the next work item is done or `waitMinutes` have passed.

export interface WaitInput {
  readonly elapsedMs: number;
  readonly minMinutes: number;
  readonly waitMinutes: number;
  /** A work item was done after the order was placed. */
  readonly workDoneSinceOrder: boolean;
  /** How long a delivery "minute" is (ms): a real minute, or a second with the debug `?fast=1`. */
  readonly unitMs?: number;
}

export const MINUTE = 60_000;
/** `?fast=1`: delivery minutes count as seconds. */
export const FAST_MINUTE = 1_000;
const unit = (w: { readonly unitMs?: number }) => w.unitMs ?? MINUTE;

export function arrivalDue(w: WaitInput): boolean {
  if (w.elapsedMs < w.minMinutes * unit(w)) return false;
  return w.workDoneSinceOrder || w.elapsedMs >= w.waitMinutes * unit(w);
}

/** How long until arrival is due if nothing else happens (ms), for the runtime's timer. */
export function msUntilDue(w: Omit<WaitInput, "workDoneSinceOrder">): number {
  return Math.max(0, w.waitMinutes * unit(w) - w.elapsedMs);
}

/** How long until the minimum has passed (ms). */
export function msUntilMinimum(w: Omit<WaitInput, "workDoneSinceOrder">): number {
  return Math.max(0, w.minMinutes * unit(w) - w.elapsedMs);
}

/** The debug speed (like `?day=`, dev builds only): `?fast=1` makes a delivery minute one second. Nothing else changes. */
export function deliveryUnitMs(search: string, dev: boolean): number {
  return dev && new URLSearchParams(search).get("fast") === "1" ? FAST_MINUTE : MINUTE;
}
