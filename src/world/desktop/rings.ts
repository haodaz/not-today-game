// Which corruption ring the desktop shows (design U6). On a calm-daytime day the day beats look
// like the first ring; the night beat is never calm.
import stagesFile from "@content/stages.json";
import { isCalmDaytime, ringOf } from "@state/stages";
import type { Beat } from "./beat";

/** Rings in the order the cycles reach them. */
export const RINGS: readonly string[] = Object.entries(stagesFile.cycles)
  .filter(([id]) => !id.startsWith("_"))
  .map(([, cycle]) => cycle as { days: number[]; ring: string })
  .sort((a, b) => Math.min(...a.days) - Math.min(...b.days))
  .map((cycle) => cycle.ring);

export function desktopRing(day: number, beat: Beat): string {
  if (beat !== "night" && isCalmDaytime(day)) return RINGS[0]!;
  return ringOf(day);
}

export function ringIndex(ring: string): number {
  return RINGS.indexOf(ring);
}
