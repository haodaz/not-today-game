// When the splat layer exists at all (room-scene design S7). Off means the controller gets no
// `splat` dep: no element, no class, no import.

export interface GateInput {
  /** `location.search`. */
  readonly search: string;
  readonly webgl: boolean;
  readonly reducedMotion: boolean;
  /** A dev build (production never loads the splat). */
  readonly dev: boolean;
}
/**
 * The splat goes dark until it is good (room-scene decision 2026-11-02): on only with `?splat=1`, in
 * a dev build, with WebGL and without reduced motion. Production never loads it. Pure.
 */
export function splatEnabled(g: GateInput): boolean {
  const flag = new URLSearchParams(g.search).get("splat");
  return flag === "1" && g.dev && g.webgl && !g.reducedMotion;
}
/** Whether a WebGL context can be made (a throwaway canvas; nothing is attached). */
export function hasWebGL(doc: Document): boolean {
  try {
    const c = doc.createElement("canvas");
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as { getExtension?: unknown } | null;
    return !!gl && typeof gl.getExtension === "function";
  } catch {
    return false;
  }
}

export function prefersReducedMotion(win: Window): boolean {
  try {
    return !!win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
