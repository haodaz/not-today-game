// What can be pointed at, and where it is on the stage (room-scene navigation 2026-11-01). Pure: the
// boxes are in calibration.ts, the camera math in geometry.ts. A pick is a ray through the current
// camera against the boxes of the current framing, the nearest hit wins. With the splat off the
// camera is the framing's fixed pose, which gives back today's rectangles.
import type { Rect } from "../shots";
import { HOTSPOTS } from "./calibration";
import { basisOf, boxRect, rayBox, rayThrough, STAGE_H, STAGE_W } from "./geometry";
import { POSES, type Pose } from "./pose";

export const HOT_IDS = ["desk", "monitorL", "monitorR", "tower", "door", "bed", "box", "lamp"] as const;
export type HotId = (typeof HOT_IDS)[number];
/** The framings that have things to point at. */
export type HotView = keyof typeof HOTSPOTS;

/** The framing a session view shows (the desktop and 门 have none). */
export function hotViewOf(view: string): HotView | null {
  return view === "room" || view === "desk" || view === "bed" ? view : null;
}

/** Tab order, and the order the keyboard proxies are laid out in. */
export const HOT_ORDER: Readonly<Record<HotView, readonly HotId[]>> = {
  room: ["tower", "monitorL", "monitorR", "lamp", "desk", "box", "bed", "door"],
  desk: ["monitorL", "monitorR", "lamp"],
  bed: ["door"],
};

const boxOf = (view: HotView, id: HotId) => (HOTSPOTS[view] as Partial<Record<HotId, (typeof HOTSPOTS)["room"]["desk"]>>)[id] ?? null;

/** The ids that exist in a framing. */
export const hotIdsIn = (view: HotView): readonly HotId[] => HOT_ORDER[view].filter((id) => boxOf(view, id) !== null);

const clip = (r: Rect): Rect | null => {
  const l = Math.max(0, r.l);
  const t = Math.max(0, r.t);
  const right = Math.min(STAGE_W, r.l + r.w);
  const bottom = Math.min(STAGE_H, r.t + r.h);
  return right - l > 0.5 && bottom - t > 0.5 ? { l, t, w: right - l, h: bottom - t } : null;
};

/** Where a thing is on the stage through this camera, clipped to the stage; null off-screen or behind. */
export function hotRect(pose: Pose, view: HotView, id: HotId): Rect | null {
  const box = boxOf(view, id);
  if (!box) return null;
  const r = boxRect(pose, box);
  return r ? clip(r) : null;
}

/** Every thing of the framing that is on the stage through this camera. */
export function hotRects(pose: Pose, view: HotView): Partial<Record<HotId, Rect>> {
  const out: Partial<Record<HotId, Rect>> = {};
  for (const id of hotIdsIn(view)) {
    const r = hotRect(pose, view, id);
    if (r) out[id] = r;
  }
  return out;
}

/** The rectangles the framing's fixed pose gives: today's click areas. */
export const fixedRects = (view: HotView): Partial<Record<HotId, Rect>> => hotRects(POSES[view], view);

/**
 * The thing under a stage pixel: a ray through the camera against the framing's boxes, nearest
 * first. `allowed` filters (the tower only while the computer is off, say).
 */
export function pickHot(pose: Pose, view: HotView, px: number, py: number, allowed?: (id: HotId) => boolean): HotId | null {
  const ray = rayThrough(pose, px, py, basisOf(pose));
  let best: { id: HotId; t: number } | null = null;
  for (const id of hotIdsIn(view)) {
    if (allowed && !allowed(id)) continue;
    const t = rayBox(ray, boxOf(view, id)!);
    if (t !== null && (best === null || t < best.t)) best = { id, t };
  }
  return best?.id ?? null;
}
