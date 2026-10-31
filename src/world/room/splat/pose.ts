// Camera poses in the room splat (room-scene design S1–S3). Pure: no three, no DOM.
// World coordinates as in public/room/README.md; up is (0,−1,0) for every pose.

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A camera: where it is, and where it faces (yaw about the up axis, pitch above/below level), radians. */
export interface Pose {
  readonly pos: Vec3;
  readonly yaw: number;
  readonly pitch: number;
}

export const UP: Vec3 = { x: 0, y: -1, z: 0 };

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** yaw = atan2(dx, dz), pitch = asin(dy / |d|) of the look direction. */
export function poseFromLook(pos: Vec3, look: Vec3): Pose {
  const dx = look.x - pos.x;
  const dy = look.y - pos.y;
  const dz = look.z - pos.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { pos, yaw: Math.atan2(dx, dz), pitch: Math.asin(dy / len) };
}

/** A point `dist` ahead of the camera (what three's `lookAt` wants). */
export function lookOf(p: Pose, dist = 24): Vec3 {
  const c = Math.cos(p.pitch);
  return v(p.pos.x + dist * c * Math.sin(p.yaw), p.pos.y + dist * Math.sin(p.pitch), p.pos.z + dist * c * Math.cos(p.yaw));
}

/** The README's frames (S1). 桌子 is f43 as the spec names it; see DESK_CLOSE_ALT. */
export const POSES = {
  room: poseFromLook(v(-3.127, -0.071, -0.872), v(0.615, -0.118, 22.497)),
  desk: poseFromLook(v(0.023, 0.053, 0.324), v(-2.706, -0.439, 24.833)),
  bed: poseFromLook(v(-6.312, 0.068, 4.09), v(9.106, 0.167, 12.6)),
} as const;
export type PoseId = keyof typeof POSES;

/** The README's 凑近桌面 pose, if f43 (listed under the door wall) frames wrongly in room_clean. */
export const DESK_CLOSE_ALT: Pose = poseFromLook(v(-1.0, 0, 6.0), v(0.6, -0.1, 22.5));

/** Smallest signed angle from a to b, in (−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** From a (t = 0) to b (t = 1): position linear, yaw and pitch along the short arc. */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    pos: v(lerp(a.pos.x, b.pos.x, t), lerp(a.pos.y, b.pos.y, t), lerp(a.pos.z, b.pos.z, t)),
    yaw: a.yaw + angleDelta(a.yaw, b.yaw) * t,
    pitch: a.pitch + angleDelta(a.pitch, b.pitch) * t,
  };
}

/** Ease in and out; 0 → 0, 1 → 1, monotone. Inputs outside [0, 1] are clamped. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** The window side is negative yaw; the window wall is toward +x. */
export interface ClampBounds {
  readonly yawMin: number;
  readonly xMax: number;
}

/** From the allowed poses themselves, so interpolating between them never leaves the bounds (S3). */
export const WINDOW_CLAMP: ClampBounds = {
  yawMin: Math.min(...Object.values(POSES).map((p) => p.yaw)),
  xMax: Math.max(...Object.values(POSES).map((p) => p.pos.x)),
};

/** Never turned toward the window, never moved toward it. Idempotent. */
export function clampPose(p: Pose, b: ClampBounds = WINDOW_CLAMP): Pose {
  const yaw = Math.max(p.yaw, b.yawMin);
  const x = Math.min(p.pos.x, b.xMax);
  return yaw === p.yaw && x === p.pos.x ? p : { pos: v(x, p.pos.y, p.pos.z), yaw, pitch: p.pitch };
}

export type Clamp = (p: Pose) => Pose;
export type CameraPath = (t: number) => Pose;

/**
 * One camera move. Players' moves use the default path and clamp; a scripted move (the day-18
 * pull-out) brings its own `path` and may pass `clamp: null` to leave the room.
 */
export interface CameraMove {
  readonly from: Pose;
  readonly to: Pose;
  /** Path over eased t in [0, 1]; default: `lerpPose(from, to, t)`. */
  readonly path?: CameraPath;
  /** Default `clampPose` with WINDOW_CLAMP; `null` bypasses it. */
  readonly clamp?: Clamp | null;
  /** Easing of raw t; default `easeInOutCubic`. */
  readonly ease?: (t: number) => number;
}

/** The camera at raw progress t ∈ [0, 1] of a move. */
export function poseAt(m: CameraMove, t: number): Pose {
  const e = (m.ease ?? easeInOutCubic)(Math.min(1, Math.max(0, t)));
  const p = m.path ? m.path(e) : lerpPose(m.from, m.to, e);
  const clamp = m.clamp === undefined ? clampPose : m.clamp;
  return clamp ? clamp(p) : p;
}

/** A move between two named poses (the players' kind). */
export function moveBetween(from: PoseId, to: PoseId): CameraMove {
  return { from: POSES[from], to: POSES[to] };
}
