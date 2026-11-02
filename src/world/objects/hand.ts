// Holding and using (objects-in-hand FR1), as a pure state machine, and the turn of a held thing.
//   down ──lift──▶ holding ──click the object──▶ using
//   using ──click outside / Esc / right-click──▶ holding ──the same──▶ down
// Keys answer only while using. Session state only.

export type HandMode = "down" | "holding" | "using";
export interface Hand {
  readonly object: string | null;
  readonly mode: HandMode;
}
export const DOWN: Hand = { object: null, mode: "down" };

export type HandInput =
  | { readonly kind: "lift"; readonly object: string }
  /** A click on the held object itself. */
  | { readonly kind: "use" }
  /** A click anywhere else, Esc, right-click. */
  | { readonly kind: "back" };

export function handStep(h: Hand, i: HandInput): Hand {
  switch (i.kind) {
    case "lift":
      // The same thing again from the desk puts it down; another one is taken up instead.
      if (h.object === i.object) return DOWN;
      return { object: i.object, mode: "holding" };
    case "use":
      return h.mode === "holding" ? { ...h, mode: "using" } : h;
    case "back":
      if (h.mode === "using") return { ...h, mode: "holding" };
      return DOWN;
  }
}
/** Whether a key press reaches the program. */
export const keysLive = (h: Hand): boolean => h.mode === "using";

// ——— turning ———

/** Press-and-drag turns it this far; release eases back in RETURN_MS. */
export const TURN_YAW = 60;
export const TURN_PITCH = 30;
/** Stage px of drag per degree. */
export const PX_PER_DEG = 4;
export const RETURN_MS = 400;
/** A drag that reaches the yaw limit turns the thing over: its other face stays up after release. */
export const FLIP_AT = TURN_YAW - 2;
/** The calculator: a vertical drag turns it in the plane, up to upside down. */
export const ROLL_MAX = 180;
export const ROLLERS: readonly string[] = ["calculator"];
/** Using brings it this much closer. */
export const USE_SCALE = 1.15;
/** The handheld breathing: 1 px over 3 s. */
export const BREATH_PX = 1;
export const BREATH_MS = 3_000;

export interface Turn {
  readonly yaw: number;
  readonly pitch: number;
  /** In-plane turn (the calculator only). */
  readonly roll: number;
}
export const NO_TURN: Turn = { yaw: 0, pitch: 0, roll: 0 };
const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v));

/** The turn for a drag of (dx, dy) stage px. Rightward turns it right; upward tips the top away. */
export function dragTurn(object: string, dx: number, dy: number): Turn {
  const yaw = clamp(dx / PX_PER_DEG, TURN_YAW);
  if (ROLLERS.includes(object)) return { yaw, pitch: 0, roll: Math.min(ROLL_MAX, Math.max(0, -dy / PX_PER_DEG)) };
  return { yaw, pitch: clamp(-dy / PX_PER_DEG, TURN_PITCH), roll: 0 };
}
/** On release: whether the drag turned it over. */
export const flipsOver = (t: Turn): boolean => Math.abs(t.yaw) >= FLIP_AT;
/** Easing back to rest after release (smoothstep), `from` at release. */
export function easeBack(from: Turn, elapsed: number): Turn {
  const p = Math.max(0, Math.min(1, elapsed / RETURN_MS));
  const k = 1 - p * p * (3 - 2 * p);
  // (+ 0: at rest it is exactly 0, never −0.)
  return { yaw: from.yaw * k + 0, pitch: from.pitch * k + 0, roll: from.roll * k + 0 };
}
/** The breathing offset (px) at t. */
export const breath = (t: number): number => BREATH_PX * Math.sin((2 * Math.PI * t) / BREATH_MS);
