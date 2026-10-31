// Kuro crawls along edges, never floats in a straight line (late-days correction 2026-11-01).
// Pure: the path from the HUD corner onto the page window's bottom edge, along it to the right
// side, up the right edge, then along the top edge to the close control, with rounded corners.
// The body rotates so its feet face the edge it is on: under the bottom edge it hangs upside down
// (180°), on the right edge its feet point left (90°), on the top edge it stands (0°). All
// coordinates are the body's centre, relative to where it ends (0, 0 = its slot by the ×).

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** The page window's box, in the same coordinates. */
export interface Box {
  readonly l: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
}

export interface Waypoint extends Pt {
  /** Degrees; the body's rotation here. */
  readonly rot: number;
  /** 0..1: how far along the whole path (by length). */
  readonly at: number;
}

/** Constant speed (stage px per ms): a typical trip (~1 600 px) takes about 1.6 s. */
export const CRAWL_PX_PER_MS = 1;
/** The trip takes 1.2–2.2 s whatever the distance. */
export const CRAWL_MIN_MS = 1200;
export const CRAWL_MAX_MS = 2200;
/** The corner rounding radius. */
export const CORNER_R = 18;

/**
 * The path for a body of size `body` (px): its centre stays half a body outside the edge it
 * crawls on. `from` is where it starts (the HUD corner); the end is (0, 0).
 */
export function edgePath(from: Pt, box: Box, body: number, r = CORNER_R): Waypoint[] {
  const half = body / 2;
  const bottom = box.t + box.h + half;
  const right = box.l + box.w + half;
  const top = 0; // it ends standing on the top edge, at its slot
  const pts: { x: number; y: number; rot: number }[] = [
    // It leaves the corner upright and turns as it drops onto the underside of the bottom edge.
    { x: from.x, y: from.y, rot: 0 },
    // Onto the bottom edge, below the window, at the corner's x (inside the edge's span).
    { x: Math.min(Math.max(from.x, box.l), right - r), y: bottom, rot: 180 },
    // Along the bottom edge to the right side, round the corner, up the right edge.
    { x: right - r, y: bottom, rot: 180 },
    { x: right, y: bottom - r, rot: 90 },
    { x: right, y: top + r, rot: 90 },
    // Round the top-right corner onto the top edge, along it to the ×.
    { x: right - r, y: top, rot: 0 },
    { x: 0, y: 0, rot: 0 },
  ];
  // Drop repeated points (a corner already on an edge).
  const kept = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) > 0.5);
  const lens = kept.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - kept[i - 1]!.x, p.y - kept[i - 1]!.y)));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  return kept.map((p, i) => {
    run += lens[i]!;
    return { x: p.x, y: p.y, rot: p.rot, at: run / total };
  });
}

/** The path's length. */
export function pathLength(path: readonly Pt[]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return n;
}

/** How long the trip takes at constant speed, clamped to 1.2–2.2 s. */
export function crawlMs(path: readonly Pt[]): number {
  return Math.round(Math.min(CRAWL_MAX_MS, Math.max(CRAWL_MIN_MS, pathLength(path) / CRAWL_PX_PER_MS)));
}

/** Web Animations keyframes: linear in time ⇒ constant speed (offsets are by length). */
export function crawlKeyframes(path: readonly Waypoint[]): Keyframe[] {
  return path.map((p) => ({ offset: p.at, transform: `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) rotate(${p.rot}deg)` }));
}
