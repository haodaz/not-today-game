// The game's splat wiring (room-scene design S7): the layer exists only when the gate says so,
// and reaches three only by this dynamic import, after the first render. The title page never
// calls this.
import { hasWebGL, prefersReducedMotion, splatEnabled } from "./gate";
import { createSplatLayer, type LoadScene } from "./layer";

export const loadSplatScene: LoadScene = (doc) => import("./scene").then((m) => m.createSplatScene(doc));

/** The controller's `splat` dep for this window, or undefined when off (`?splat=0`, no WebGL, reduced motion). */
export function splatForGame(win: Window, load: LoadScene = loadSplatScene) {
  const on = splatEnabled({ search: win.location.search, webgl: hasWebGL(win.document), reducedMotion: prefersReducedMotion(win) });
  return on ? createSplatLayer({ load }) : undefined;
}
