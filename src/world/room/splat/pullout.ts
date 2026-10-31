// The day-18 pull-out (room-scene addition 2026-11-01; design S15–S18). Pure: elapsed time in, the
// camera, the island's size and the dark layer's alpha out. Both the splat and the photo fallback
// read this one timeline, so they agree frame for frame.
//   0 … 6 s   the camera pulls out along the room's axis to ≈ (67, −29, −1), looking at the room,
//             ease-in, the window clamp bypassed (a scripted move);
//   3 … 6 s   the dark fades in around the island;
//   cut       good at 2 s (the door opens instead), bad and survive at 6 s; then the ending card.
import { easeInOutCubic, lookOf, POSES, poseFromLook, type CameraMove, type Pose, type PoseId, type Vec3 } from "./pose";

export const PULL_MS = 6_000;
/** The dark fades in over the last 3 s. */
export const DARK_MS = 3_000;
/** Where each ending stops the pull-out. */
export const PULL_CUT_MS: Readonly<Record<"bad" | "survive" | "good", number>> = { bad: PULL_MS, survive: PULL_MS, good: 2_000 };

/** The far end (the author's "about (67, −29, −1)"). */
export const PULL_END: Vec3 = { x: 67, y: -29, z: -1 };
/** What the camera keeps looking at: the middle of the reconstructed room (mean of the three framings' positions). */
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

/** The pull-out from a framing: position to PULL_END, gaze turning onto the room's centre. */
export function pullPath(from: PoseId): (e: number) => Pose {
  const start = POSES[from];
  const look0 = lookOf(start);
  return (e) => {
    const pos = lerpV(start.pos, PULL_END, e);
    const target = lerpV(look0, ROOM_CENTRE, easeInOutCubic(Math.min(1, e * 4)));
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
