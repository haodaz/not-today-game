// The stage fills the window (polish, correction 2026-11-01). The stage keeps its own pixel size;
// it is scaled by min(window/stage) (capped at FIT_MAX) and centred both ways. The letterbox around
// it shows the current view's backdrop photo, covering the window, blurred and darkened (CSS:
// `#app::before`). The game controller and the title mount both call `applyFit` on every render
// and on resize. `fitStage` is pure.
import type { View } from "./desktop/model";
import { deskLayout } from "./room/desk";

/** No more than twice the stage's own size. */
export const FIT_MAX = 2;

export interface Fit {
  readonly scale: number;
  /** The stage's offset in the window, in window px. */
  readonly left: number;
  readonly top: number;
}

/** Scale and offset of a `w × h` stage in a `winW × winH` window. An empty window (tests) is scale 1 at 0,0. */
export function fitStage(winW: number, winH: number, w: number, h: number): Fit {
  const scale = Math.min(winW / w, winH / h, FIT_MAX);
  if (!Number.isFinite(scale) || scale <= 0) return { scale: 1, left: 0, top: 0 };
  return { scale, left: (winW - w * scale) / 2, top: (winH - h * scale) / 2 };
}

/** The photo behind each view; the screens sit on the desk, so 屏幕 shows the desk. */
export const BACKDROPS: Readonly<Record<View | "title", string>> = {
  title: "/room/shots/room.jpg",
  room: "/room/shots/room.jpg",
  // 桌子 is the tabletop (day-loop correction 2026-11-01); content/desk.json's backdrop.
  desk: deskLayout.backdrop,
  desktop: deskLayout.backdrop,
  door: "/room/door_wall.png",
  // The bed wall and the big window wall (room-turn 2026-11-04): stills of their own, cover-fitted like room.jpg.
  bed: "/room/shots/bed.jpg",
  window: "/room/shots/window.jpg",
  // playtest-1105 R5: the meal table up close is the same still, pushed in.
  table: "/room/shots/window.jpg",
};

/**
 * Writes the fit: `--scale`, `--stage-x`, `--stage-y` on the stage (so the motion layer's copies of
 * it keep their place) and `--letterbox` on the root (which survives re-renders).
 */
export function applyFit(root: HTMLElement, stage: HTMLElement, size: { w: number; h: number }, backdrop: string | null): Fit {
  const fit = fitStage(root.clientWidth, root.clientHeight, size.w, size.h);
  stage.style.setProperty("--scale", String(fit.scale));
  stage.style.setProperty("--stage-x", `${fit.left}px`);
  stage.style.setProperty("--stage-y", `${fit.top}px`);
  // world-prompts R2: the stage's place in the window, for the fixed layers sized by it (the choices column).
  root.style.setProperty("--stage-l", `${fit.left}px`);
  root.style.setProperty("--stage-w", `${size.w * fit.scale}px`);
  // No photo (the day-18 pull-out happens over black): the letterbox is plain black.
  root.style.setProperty("--letterbox", backdrop ? `url(${backdrop})` : "none");
  return fit;
}
