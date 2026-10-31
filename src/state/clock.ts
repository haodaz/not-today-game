// The clock is cosmetic only (e.g. a timestamp in a chat bubble). It never feeds `day`, `stage`
// or any reducer: `day` is a counter in the run save. This is the only file in src/state that may
// read the wall clock. Tests inject `fakeClock` so they stay deterministic.

export interface Clock {
  now(): Date;
}

/** The real wall clock. Cosmetic use only. */
export const realClock: Clock = {
  now: () => new Date(),
};

/** A clock frozen at `iso`. Every call to `now()` returns the same instant. */
export function fakeClock(iso: string): Clock {
  const fixed = Date.parse(iso);
  if (Number.isNaN(fixed)) throw new Error(`fakeClock: not a valid date: ${iso}`);
  return { now: () => new Date(fixed) };
}

/**
 * Parses the `?day=N` debug jump from a URL query string (e.g. `window.location.search`).
 * Returns N for a positive integer, otherwise null. It is a debug aid, not a feature: the store
 * builds `computeState(N, [])` from it and it never touches saves.
 */
export function debugStartDay(search: string): number | null {
  const value = new URLSearchParams(search).get("day");
  if (value === null || !/^[1-9]\d*$/.test(value)) return null;
  return Number(value);
}
