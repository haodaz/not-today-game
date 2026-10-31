// What the splat looks like on a day and beat (room-scene design S8, S9). Pure.
import { ringOf } from "@state/stages";
import type { Beat } from "@world/desktop/beat";
import { ringIndex } from "@world/desktop/rings";

/** room_clean → room_collapsed, by ring (author 2026-11-01): room 40 %, door 100 %. */
export const COLLAPSE_MIX: Readonly<Record<string, number>> = { room: 0.4, door: 1 };

export function collapseMix(day: number): number {
  return COLLAPSE_MIX[ringOf(day)] ?? 0;
}

export interface SplatLook {
  readonly night: boolean;
  /** The light in the gap between the monitors at night: white, pink from ring `wall`. */
  readonly gap: "none" | "white" | "pink";
  /** Opacity of the collapsed splat over the clean one. */
  readonly mix: number;
}

export function splatLook(day: number, beat: Beat): SplatLook {
  const night = beat === "night";
  const gap = !night ? "none" : ringIndex(ringOf(day)) >= ringIndex("wall") ? "pink" : "white";
  return { night, gap, mix: collapseMix(day) };
}
