// The camera as pure math (room-scene navigation 2026-11-01): a Pose projects a world point to the
// 1600×900 stage and unprojects a stage pixel to a ray, with the same conventions as scene.ts
// (three's lookAt with up (0, −1, 0), fov vertical in degrees, aspect 16:9). No three, no DOM: this
// is what the hotspots, the picking and their tests stand on.
import type { Rect } from "../shots";
import { type Pose, type Vec3 } from "./pose";

export const STAGE_W = 1600;
export const STAGE_H = 900;
export const DEFAULT_FOV = 50;
/** In front of the camera at least this far, or a point is not projected (three's near plane is 0.05). */
export const NEAR = 0.05;

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const norm = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));

export interface Basis {
  /** Where the camera faces. */
  readonly f: Vec3;
  /** Screen right. */
  readonly r: Vec3;
  /** Screen up (world −y). */
  readonly u: Vec3;
  /** tan(fov / 2). */
  readonly tan: number;
}

/** three's lookAt with up (0, −1, 0): x = f × up, y = (−f) × x. */
export function basisOf(p: Pose): Basis {
  const cp = Math.cos(p.pitch);
  const f: Vec3 = { x: cp * Math.sin(p.yaw), y: Math.sin(p.pitch), z: cp * Math.cos(p.yaw) };
  const r = norm({ x: f.z, y: 0, z: -f.x });
  // u = (−f) × r
  const u = norm({ x: -(f.y * r.z - f.z * r.y), y: -(f.z * r.x - f.x * r.z), z: -(f.x * r.y - f.y * r.x) });
  return { f, r, u, tan: Math.tan(((p.fov ?? DEFAULT_FOV) * Math.PI) / 360) };
}

export interface Projected {
  readonly x: number;
  readonly y: number;
  /** Distance along the view direction. */
  readonly depth: number;
}

/** A world point on the stage, or null if it is behind the camera. */
export function project(p: Pose, world: Vec3, b: Basis = basisOf(p)): Projected | null {
  const d = sub(world, p.pos);
  const depth = dot(d, b.f);
  if (depth <= NEAR) return null;
  const ndcX = dot(d, b.r) / (depth * b.tan * (STAGE_W / STAGE_H));
  const ndcY = dot(d, b.u) / (depth * b.tan);
  return { x: ((ndcX + 1) / 2) * STAGE_W, y: ((1 - ndcY) / 2) * STAGE_H, depth };
}

export interface Ray {
  readonly o: Vec3;
  readonly d: Vec3;
}

/** The ray through a stage pixel. */
export function rayThrough(p: Pose, px: number, py: number, b: Basis = basisOf(p)): Ray {
  const sx = (2 * px) / STAGE_W - 1;
  const sy = 1 - (2 * py) / STAGE_H;
  const d = norm(add(add(b.f, mul(b.r, sx * b.tan * (STAGE_W / STAGE_H))), mul(b.u, sy * b.tan)));
  return { o: p.pos, d };
}

/** A box in world coordinates: centre, full size, turned about the up axis by `yaw` (radians; 0 faces +z). */
export interface Box {
  readonly c: readonly [number, number, number];
  /** Full width (screen-right at yaw 0 is +x), height (world y), depth (along the facing). */
  readonly size: readonly [number, number, number];
  readonly yaw: number;
}

const axes = (yaw: number) => ({
  ex: { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) } as Vec3,
  ey: { x: 0, y: 1, z: 0 } as Vec3,
  ez: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) } as Vec3,
});

export function boxCorners(box: Box): Vec3[] {
  const { ex, ey, ez } = axes(box.yaw);
  const c: Vec3 = { x: box.c[0], y: box.c[1], z: box.c[2] };
  const out: Vec3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(add(add(add(c, mul(ex, (sx * box.size[0]) / 2)), mul(ey, (sy * box.size[1]) / 2)), mul(ez, (sz * box.size[2]) / 2)));
  return out;
}

/** The box on the stage: the bounding rectangle of its corners (null if any is behind the camera). Not clipped. */
export function boxRect(p: Pose, box: Box): Rect | null {
  const b = basisOf(p);
  const pts = boxCorners(box).map((w) => project(p, w, b));
  if (pts.some((q) => q === null)) return null;
  const xs = pts.map((q) => q!.x);
  const ys = pts.map((q) => q!.y);
  const l = Math.min(...xs);
  const t = Math.min(...ys);
  return { l, t, w: Math.max(...xs) - l, h: Math.max(...ys) - t };
}

/** Where a ray first meets the box (distance along the ray), or null. */
export function rayBox(ray: Ray, box: Box): number | null {
  const { ex, ey, ez } = axes(box.yaw);
  const rel = sub(ray.o, { x: box.c[0], y: box.c[1], z: box.c[2] });
  const o = [dot(rel, ex), dot(rel, ey), dot(rel, ez)] as const;
  const d = [dot(ray.d, ex), dot(ray.d, ey), dot(ray.d, ez)] as const;
  let tMin = 0;
  let tMax = Infinity;
  for (let i = 0; i < 3; i++) {
    const half = box.size[i]! / 2;
    if (Math.abs(d[i]!) < 1e-12) {
      if (o[i]! < -half || o[i]! > half) return null;
      continue;
    }
    let t0 = (-half - o[i]!) / d[i]!;
    let t1 = (half - o[i]!) / d[i]!;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    if (tMin > tMax) return null;
  }
  return tMin;
}

/** The box that fills a stage rectangle seen from `pose` at `depth`, a slab `thickness` thick facing the camera horizontally. */
export function boxFromRect(pose: Pose, rect: Rect, depth: number, thickness = 0.1): Box {
  const b = basisOf(pose);
  const cx = rect.l + rect.w / 2;
  const cy = rect.t + rect.h / 2;
  const ray = rayThrough(pose, cx, cy, b);
  // `depth` is along the view direction, not along the ray.
  const t = depth / dot(ray.d, b.f);
  const c = add(ray.o, mul(ray.d, t));
  const perPx = (2 * b.tan * depth) / STAGE_H;
  return { c: [c.x, c.y, c.z], size: [rect.w * perPx, rect.h * perPx, thickness], yaw: pose.yaw };
}
