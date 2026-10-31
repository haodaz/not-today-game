// The day-18 pull-out (room-scene addition 2026-11-01; design S15–S18). Pure: elapsed time in, the
// camera, the island's size and the dark layer's alpha out. Both the splat and the photo fallback
// read this one timeline, so they agree frame for frame.
//   0 … 6 s   the camera pulls out along the room's axis to ≈ (67, −29, −1), looking at the room,
//             ease-in, the window clamp bypassed (a scripted move);
//   3 … 6 s   the dark fades in around the island;
//   cut       good at 2 s (the door opens instead), bad and survive at 6 s; then the ending card.
import { CALIBRATION } from "./calibration";
import { easeInOutCubic, lookOf, POSES, poseFromLook, type CameraMove, type Pose, type PoseId, type Vec3 } from "./pose";

export const PULL_MS = 6_000;
/** The dark fades in over the last 3 s. */
export const DARK_MS = 3_000;
/** Where each ending stops the pull-out: every ending does the full 6 s (correction 2026-11-01: good too). */
export const PULL_CUT_MS: Readonly<Record<"bad" | "survive" | "good", number>> = { bad: PULL_MS, survive: PULL_MS, good: PULL_MS };

/** The far end (the author's "about (67, −29, −1)"). */
export const PULL_END: Vec3 = { x: 67, y: -29, z: -1 };
/** What the camera keeps looking at (author 2026-11-01): the desk pose's look target, from the calibration. */
export const PULL_LOOK_AT: Vec3 = { x: CALIBRATION.desk.look[0], y: CALIBRATION.desk.look[1], z: CALIBRATION.desk.look[2] };
/**
 * Where the room is, for its apparent size (the island): the mean of the three framings'
 * positions. Not where the camera looks: the look target lies ~24 units beyond the desk.
 */
export const ROOM_CENTRE: Vec3 = (() => {
  const ps = Object.values(POSES).map((p) => p.pos);
  const n = ps.length;
  return { x: ps.reduce((s, p) => s + p.x, 0) / n, y: ps.reduce((s, p) => s + p.y, 0) / n, z: ps.reduce((s, p) => s + p.z, 0) / n };
})();

/** Ease-in (cubic): slow away from the room, then fast. CSS twin: cubic-bezier(0.32, 0, 0.67, 0). */
export const easeInCubic = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x;
};

const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The pull-out from a framing: position to PULL_END, gaze turning onto the desk pose's look target. */
export function pullPath(from: PoseId): (e: number) => Pose {
  const start = POSES[from];
  const look0 = lookOf(start);
  return (e) => {
    const pos = lerpV(start.pos, PULL_END, e);
    const target = lerpV(look0, PULL_LOOK_AT, easeInOutCubic(Math.min(1, e * 4)));
    return { ...poseFromLook(pos, target), fov: start.fov };
  };
}

/** As a CameraMove: the scripted kind, clamp bypassed. */
export function pullMove(from: PoseId): CameraMove {
  return { from: POSES[from], to: { ...POSES[from], pos: PULL_END }, path: pullPath(from), clamp: null, ease: easeInCubic };
}

export interface PullFrame {
  /** Raw progress over the full 6 s (0 … 1). */
  readonly p: number;
  readonly camera: Pose;
  /** The lit room's size relative to the stage: 1 at the start, ≈ start distance / distance now. */
  readonly island: number;
  /** The dark layer's opacity: 0 until 3 s, 1 at 6 s. */
  readonly dark: number;
}

/** The frame at `elapsed` ms. Island = perspective: how much nearer the room was at the start. */
export function pullOutAt(elapsed: number, from: PoseId): PullFrame {
  const p = Math.min(1, Math.max(0, elapsed / PULL_MS));
  const camera = pullPath(from)(easeInCubic(p));
  const d0 = dist(POSES[from].pos, ROOM_CENTRE) || 1;
  const island = Math.min(1, d0 / Math.max(d0, dist(camera.pos, ROOM_CENTRE)));
  const dark = Math.min(1, Math.max(0, (elapsed - (PULL_MS - DARK_MS)) / DARK_MS));
  return { p, camera, island, dark };
}

/** The framing the pull-out starts from: the view if it has a pose, else 房间 (门, 屏幕). */
export function pullFrom(view: string): PoseId {
  return view === "desk" || view === "room" ? view : view === "desktop" ? "desk" : "room";
}

// ——— what appears in the black (correction 2026-11-01: the good ending sees Kuro itself) ———

/** Bad and survive: the field of eyes and tentacles; good: the giant (public/room/dark/giant/body.png). */
export type DarkKind = "field" | "giant";
export const darkKindOf = (ending: "bad" | "survive" | "good"): DarkKind => (ending === "good" ? "giant" : "field");

/**
 * body.png (1280 × 1280), measured by eye on the image: the empty centre of the ring of arms and
 * its radius, and where the heads end (the top part fades in last). Image px.
 */
export const GIANT = { size: 1280, holeX: 640, holeY: 790, holeR: 175, headsSplit: 0.42 } as const;
/** The ring's hole is the island at 6 s plus this margin (and more than the breathing, so it never closes on the room). */
export const GIANT_MARGIN = 0.25;
/** The slow breathing: ±2 % over 8 s. */
export const BREATH = { amp: 0.02, periodMs: 8_000 } as const;
/** The heads come last: they fade in over the final 1.5 s. */
export const HEADS_FROM_MS = PULL_MS - 1_500;

export interface GiantFrame {
  /** Scale before breathing: the hole's radius = the island's half diagonal at 6 s × (1 + margin). */
  readonly base: number;
  /** The breathing factor, within 1 ± BREATH.amp. */
  readonly breath: number;
  /** base × breath. */
  readonly scale: number;
  /** Arms and body (the part below the heads): the last 3 s. */
  readonly body: number;
  /** The heads: the last 1.5 s. */
  readonly heads: number;
}

/** The island's half diagonal at 6 s, in stage px (the stage is 1600 × 900). */
export const islandHalfDiagonalAtEnd = (from: PoseId): number => pullOutAt(PULL_MS, from).island * Math.hypot(800, 450);

/** The giant at `elapsed` ms of the pull-out. Pure. */
export function giantAt(elapsed: number, from: PoseId): GiantFrame {
  const base = (islandHalfDiagonalAtEnd(from) * (1 + GIANT_MARGIN)) / GIANT.holeR;
  const breath = 1 + BREATH.amp * Math.sin((2 * Math.PI * Math.max(0, elapsed)) / BREATH.periodMs);
  const body = Math.min(1, Math.max(0, (elapsed - (PULL_MS - DARK_MS)) / DARK_MS));
  const heads = Math.min(1, Math.max(0, (elapsed - HEADS_FROM_MS) / (PULL_MS - HEADS_FROM_MS)));
  return { base, breath, scale: base * breath, body, heads };
}
