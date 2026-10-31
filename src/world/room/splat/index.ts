// The game's splat wiring (room-scene design S7): the layer exists only when the gate says so,
// and reaches three only by this dynamic import, after the first render. The title page never
// calls this.
import { hasWebGL, prefersReducedMotion, splatEnabled } from "./gate";
import { createSplatLayer, type LoadScene } from "./layer";

export const loadSplatScene: LoadScene = (doc) => import("./scene").then((m) => m.createSplatScene(doc));

/** The controller's `splat` dep for this window, or undefined when off (`?splat=0`, no WebGL, reduced motion). */
export function splatForGame(win: Window, load: LoadScene = loadSplatScene, dev: boolean = import.meta.env?.DEV ?? false) {
  const search = win.location.search;
  const on = splatEnabled({ search, webgl: hasWebGL(win.document), reducedMotion: prefersReducedMotion(win) });
  return on ? createSplatLayer({ load, calibrate: calibrating(search, dev) }) : undefined;
}

/** `?splatcal=1`, in a dev build only (never in production). */
export function calibrating(search: string, dev: boolean): boolean {
  return dev && new URLSearchParams(search).get("splatcal") === "1";
}
