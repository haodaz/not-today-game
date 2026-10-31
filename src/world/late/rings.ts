// The late-days gates (late-days spec), read from the cycle table (stages.json `cycles[].ring`),
// never from a day number: nothing here appears before its ring.
import { ringOf } from "@state/stages";
import type { Beat } from "@world/desktop/beat";
import { desktopRing, ringIndex } from "@world/desktop/rings";

/** The ring of the last cycle (days 16–18): red eyes, the maw, Kuro closing pages (FR2–FR4). */
export const LATE_RING = "door";
/** From this ring on the browser grows text tentacles (FR5). */
export const OVERLAY_RING = "wall";

/** Red eyes, the maw and the closer: ring ≥ door. */
export function lateRing(day: number): boolean {
  return ringIndex(ringOf(day)) >= ringIndex(LATE_RING);
}

/** The tentacles: the ring as the desktop presents it (a calm daytime looks like the first). */
export function overlayRing(day: number, beat: Beat): string | null {
  const ring = desktopRing(day, beat);
  return ringIndex(ring) >= ringIndex(OVERLAY_RING) ? ring : null;
}
