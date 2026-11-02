// Turning the head (room-scene navigation 2026-11-01): at any framing a press-and-drag turns the
// camera a little, at most ±15° of yaw and ±8° of pitch from the framing's pose; on release it eases
// back over 600 ms. No walking: the position never changes. Pure; the layer draws it, nav.ts drives it.
import type { Pose } from "./pose";

export const LOOK = {
  /** The most the head turns, radians. */
  yaw: (15 * Math.PI) / 180,
  pitch: (8 * Math.PI) / 180,
  /** A drag of this many stage px reaches the limit (yaw uses dx, pitch dy). */
  yawPx: 400,
  pitchPx: 240,
  /** Easing back to the framing. */
  easeMs: 600,
} as const;

export interface Turn {
  readonly yaw: number;
  readonly pitch: number;
}
export const NO_TURN: Turn = { yaw: 0, pitch: 0 };

const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));

/**
 * The turn for a drag of (dx, dy) stage px. Looking where the mouse goes: right turns right, up looks
 * up (pitch is positive downward in this world, so a drag down is positive).
 */
export function turnForDrag(dx: number, dy: number): Turn {
  return { yaw: clamp((dx / LOOK.yawPx) * LOOK.yaw, LOOK.yaw), pitch: clamp((dy / LOOK.pitchPx) * LOOK.pitch, LOOK.pitch) };
}

/** easeInOutCubic-free on purpose: a smoothstep from the released turn to none, p in [0, 1]. */
export function turnEased(from: Turn, p: number): Turn {
  const x = Math.min(1, Math.max(0, p));
  const k = 1 - x * x * (3 - 2 * x);
  return { yaw: from.yaw * k, pitch: from.pitch * k };
}

/** The framing's pose with the head turned. The position and the fov are the framing's. */
export function turned(base: Pose, turn: Turn): Pose {
  return turn.yaw === 0 && turn.pitch === 0 ? base : { ...base, yaw: base.yaw + clamp(turn.yaw, LOOK.yaw), pitch: base.pitch + clamp(turn.pitch, LOOK.pitch) };
}
