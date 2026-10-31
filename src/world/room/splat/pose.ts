// Camera poses in the room splat (room-scene design S1–S3). Pure: no three, no DOM.
// World coordinates as in public/room/README.md; up is (0,−1,0) for every pose.
import { CALIBRATION, type Framing } from "./calibration";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * A camera: where it is, and where it faces (yaw about the up axis, pitch above/below level),
 * radians; `fov` is the vertical field of view in degrees (interpolated along a move when set).
 */
export interface Pose {
  readonly pos: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly fov?: number;
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

/** A calibrated framing as a pose. */
export function poseOf(f: Framing): Pose {
  return { ...poseFromLook(v(...f.pos), v(...f.look)), fov: f.fov };
}

/** The framings (calibration.ts): 房间 f080, 桌子 the close-desk pose, 床 f159. */
export const POSES = {
  room: poseOf(CALIBRATION.room),
  desk: poseOf(CALIBRATION.desk),
  bed: poseOf(CALIBRATION.bed),
} as const;
export type PoseId = keyof typeof POSES;

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
  const fov = a.fov !== undefined && b.fov !== undefined ? lerp(a.fov, b.fov, t) : (a.fov ?? b.fov);
  return {
    pos: v(lerp(a.pos.x, b.pos.x, t), lerp(a.pos.y, b.pos.y, t), lerp(a.pos.z, b.pos.z, t)),
    yaw: a.yaw + angleDelta(a.yaw, b.yaw) * t,
    pitch: a.pitch + angleDelta(a.pitch, b.pitch) * t,
    ...(fov !== undefined ? { fov } : {}),
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
  return yaw === p.yaw && x === p.pos.x ? p : { ...p, pos: v(x, p.pos.y, p.pos.z), yaw };
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
