// When the splat layer exists at all (room-scene design S7). Off means the controller gets no
// `splat` dep: no element, no class, no import.

export interface GateInput {
  /** `location.search`. */
  readonly search: string;
  readonly webgl: boolean;
  readonly reducedMotion: boolean;
}

/** On unless `?splat=0`, no WebGL, or reduced motion. Pure. */
export function splatEnabled(g: GateInput): boolean {
  const flag = new URLSearchParams(g.search).get("splat");
  return flag !== "0" && g.webgl && !g.reducedMotion;
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
