// Look is photo parallax (room-scene decision 2026-11-02: the splat goes dark until it is good).
// Press-and-drag pans the still up to ±4 % of the stage's width and ±2 % of its height, the placed
// things move 1.5× the photo, and it eases back over 600 ms on release. The stage's photo is drawn
// at exactly the stage's size, so while it is panned it grows by just enough to cover the stage
// (k = 1 + 2·|pan| / size): no edge ever shows. And the edges say where you can go: on a facing the
// left and right 8 % turn; 桌子's bottom 6 % is "back". Pure.
import type { EdgeZone } from "@world/desktop/model";
import { isFacing, TURN_EDGE } from "./facings";
import { STAGE_H, STAGE_W } from "./splat/geometry";

export const PAN_X = 0.04;
export const PAN_Y = 0.02;
/** Stage px of pan per stage px of drag. */
export const PAN_GAIN = 0.25;
/** The placed things move this many times the photo. */
export const PLACED_PARALLAX = 1.5;
export const LOOK_RETURN_MS = 600;

export interface Pan {
  readonly x: number;
  readonly y: number;
}
export const NO_PAN: Pan = { x: 0, y: 0 };
const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v)) + 0;

/** The pan for a drag of (dx, dy) stage px: the photo follows the hand, within its limits. */
export function photoPan(dx: number, dy: number): Pan {
  return { x: clamp(dx * PAN_GAIN, PAN_X * STAGE_W), y: clamp(dy * PAN_GAIN, PAN_Y * STAGE_H) };
}
/** How much the photo grows so that a pan never shows an edge. */
export function panScale(p: Pan): number {
  return 1 + 2 * Math.max(Math.abs(p.x) / STAGE_W, Math.abs(p.y) / STAGE_H);
}
/** Easing back after release (smoothstep over 600 ms), `from` at release. */
export function easePan(from: Pan, elapsed: number): Pan {
  const p = Math.max(0, Math.min(1, elapsed / LOOK_RETURN_MS));
  const k = 1 - p * p * (3 - 2 * p);
  return { x: from.x * k + 0, y: from.y * k + 0 };
}
/** Writes the pan on a stage (CSS vars read by room.css); none at rest. */
export function applyPan(stage: HTMLElement, p: Pan): void {
  const on = p.x !== 0 || p.y !== 0;
  stage.classList.toggle("looking", on);
  if (!on) {
    for (const v of ["--pan-x", "--pan-y", "--pan-k", "--pan-px", "--pan-py"]) stage.style.removeProperty(v);
    return;
  }
  stage.style.setProperty("--pan-x", `${p.x.toFixed(2)}px`);
  stage.style.setProperty("--pan-y", `${p.y.toFixed(2)}px`);
  stage.style.setProperty("--pan-k", panScale(p).toFixed(5));
  stage.style.setProperty("--pan-px", `${(p.x * PLACED_PARALLAX).toFixed(2)}px`);
  stage.style.setProperty("--pan-py", `${(p.y * PLACED_PARALLAX).toFixed(2)}px`);
}

// ——— the edges ———

/** The bottom share of 桌子 that is the way back to 房间 (nav.ts BACK_STRIP). */
export const BACK_EDGE = 0.06;
export const HINT_FADE_MS = 200;
export type { EdgeZone };
/**
 * Which hinted edge a stage point is in, if that edge leads somewhere (room-turn 2026-11-04): on
 * every facing the left and right 8 % turn that way; the bottom 6 % of 桌子 goes back to 房间. The
 * facings have no back; 屏幕 has no hints.
 */
export function edgeZone(view: string, x: number, y: number): EdgeZone | null {
  if (edgeLeads(view, "back") && y >= STAGE_H * (1 - BACK_EDGE)) return "back";
  if (edgeLeads(view, "left") && x < STAGE_W * TURN_EDGE) return "left";
  if (edgeLeads(view, "right") && x >= STAGE_W * (1 - TURN_EDGE)) return "right";
  return null;
}
/** Whether a view has that hinted edge at all. */
export function edgeLeads(view: string, zone: EdgeZone): boolean {
  return zone === "back" ? view === "desk" : isFacing(view);
}
