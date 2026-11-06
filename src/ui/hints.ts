// first-use-hints R2: the hints' switch and the hints seen in earlier runs. The switch is its own
// localStorage key (like the language and mute: no run or 清除全部记录 clears it); the seen list is
// the profile's (src/ui is the only reader of the profile; the room shows it as presentation).
import type { KeyValueStorage } from "@state/slot";
import { readProfile } from "@state/profile-read";

export const HINTS_KEY = "nt_hints";

/** Hints are on unless the switch was turned off. Storage may be absent or throw: on. */
export function readHintsOn(storage: Pick<KeyValueStorage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(HINTS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeHintsOn(storage: Pick<KeyValueStorage, "setItem"> | null | undefined, on: boolean): void {
  try {
    storage?.setItem(HINTS_KEY, on ? "on" : "off");
  } catch {
    // Not remembered; the switch lasts the page.
  }
}

/** The hint ids seen in earlier runs (the profile's `hints`), once each. */
export function readHintsSeen(storage: KeyValueStorage): string[] {
  const p = readProfile(storage);
  const list = p && Array.isArray(p.hints) ? (p.hints as unknown[]) : [];
  return [...new Set(list.filter((v): v is string => typeof v === "string"))];
}
