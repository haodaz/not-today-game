// world-prompts R1: puts a room prompt's glow and pill at its target after each render (the only DOM
// part). The layer is fixed over the viewport and takes no pointer events, so everything here is in
// viewport px. The glow is the target's rect; the pill sits 10 px above it, centred; on a turn edge
// it sits beside the edge, vertically centred. Both are kept inside the stage.
import { EDGE_SHARE } from "./hints";

/** The pill's distance from its target (spec: 10 px). */
export const PROMPT_GAP = 10;

export type Box = { readonly left: number; readonly top: number; readonly width: number; readonly height: number };

/** The live stage (never a motion copy). */
const liveStage = (root: HTMLElement) => root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");

/** The first matching element that is not inside a motion copy, a turn's wall or 调度中心. */
function findAnchor(root: HTMLElement, selector: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (el.closest(".m-ghost, .m-backdrop, .m-turn, .prompt-layer, .mc")) continue;
    return el;
  }
  return null;
}

/** The turn edge's strip of the stage. Pure. */
export function edgeBox(bounds: Box, side: "left" | "right"): Box {
  const w = bounds.width * EDGE_SHARE;
  return { left: side === "left" ? bounds.left : bounds.left + bounds.width - w, top: bounds.top, width: w, height: bounds.height };
}

/**
 * Where the pill goes (its top-left) for a target, kept inside the stage. Above it and centred; on a
 * turn edge beside the edge (inside the stage), vertically centred. Pure.
 */
export function placePill(target: Box, bounds: Box, pill: { readonly w: number; readonly h: number }, edge: "left" | "right" | null): { left: number; top: number } {
  const clampL = (l: number) => Math.min(Math.max(l, bounds.left), Math.max(bounds.left, bounds.left + bounds.width - pill.w));
  const clampT = (t: number) => Math.min(Math.max(t, bounds.top), Math.max(bounds.top, bounds.top + bounds.height - pill.h));
  if (edge) {
    const left = edge === "right" ? target.left - PROMPT_GAP - pill.w : target.left + target.width + PROMPT_GAP;
    return { left: clampL(left), top: clampT(target.top + target.height / 2 - pill.h / 2) };
  }
  return { left: clampL(target.left + target.width / 2 - pill.w / 2), top: clampT(target.top - PROMPT_GAP - pill.h) };
}

export function placePrompt(root: HTMLElement): void {
  const layer = root.querySelector<HTMLElement>(":scope > .prompt-layer");
  if (!layer) return;
  const sb = liveStage(root)?.getBoundingClientRect();
  const win = root.ownerDocument.defaultView;
  const bounds: Box = sb && sb.width > 0 ? { left: sb.left, top: sb.top, width: sb.width, height: sb.height } : { left: 0, top: 0, width: win?.innerWidth ?? 1600, height: win?.innerHeight ?? 900 };
  const edge = layer.dataset.edge === "left" || layer.dataset.edge === "right" ? layer.dataset.edge : null;
  let target: Box | null = edge ? edgeBox(bounds, edge) : null;
  if (!edge && layer.dataset.anchor) {
    const r = findAnchor(root, layer.dataset.anchor)?.getBoundingClientRect();
    if (r) target = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  // The target left the page (a move in progress): nothing to show until the next render.
  layer.classList.toggle("lost", target === null);
  if (!target) return;
  const glow = layer.querySelector<HTMLElement>(".prompt-glow");
  if (glow) Object.assign(glow.style, { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px` });
  const pill = layer.querySelector<HTMLElement>(".prompt-pill");
  if (!pill) return;
  const p = placePill(target, bounds, { w: pill.offsetWidth || 0, h: pill.offsetHeight || 0 }, edge);
  Object.assign(pill.style, { left: `${p.left}px`, top: `${p.top}px` });
}
