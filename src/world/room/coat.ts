// 换一件 (author 2026-11-16, built 2026-11-28): which garment hangs on the hook by the door — 0 the
// grey jacket, 1–3 the plaid shirts. An easter egg, so it is kept in the browser (`nt_coat`), never in
// the run's event log: a new run still finds the shirt that was left on the hook.
export type Coat = 0 | 1 | 2 | 3;
export const COAT_KEY = "nt_coat";

const asCoat = (v: unknown): Coat => (v === 1 || v === 2 || v === 3 ? v : 0);

/** The garment the browser remembers; the jacket when it remembers nothing (or storage is closed). */
export function readCoat(storage: Pick<Storage, "getItem"> | null | undefined): Coat {
  try {
    return asCoat(Number(storage?.getItem(COAT_KEY)));
  } catch {
    return 0;
  }
}

/** Remembers the garment; a browser without storage just forgets it. */
export function writeCoat(coat: Coat, storage: Pick<Storage, "setItem"> | null | undefined = typeof localStorage === "undefined" ? undefined : localStorage): void {
  try {
    storage?.setItem(COAT_KEY, String(coat));
  } catch {
    /* forgetting is fine */
  }
}
