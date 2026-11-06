// first-use-hints: puts a hint's ring and card at its anchor after each render (the only DOM part).
// The layer is fixed over the viewport, so everything is in viewport px. The card is 300 px wide,
// 14 px from the thing with its 10 px arrow, above it when there is room, else below, kept inside
// the stage (onboarding-steps' coach mark sizes).
import { COACH } from "@world/desktop/shell";
import { EDGE_SHARE } from "./hints";

/** Space kept between the ring and the thing it surrounds. */
const RING_PAD = 4;

type Box = { left: number; top: number; width: number; height: number };

/** The live stage (never a motion copy). */
const liveStage = (root: HTMLElement) => root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");

/** The first matching element that is not inside a motion copy or a turn's wall. */
function findAnchor(root: HTMLElement, selector: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>(selector)) {
    if (el.closest(".m-ghost, .m-backdrop, .m-turn, .hint-layer, .mc")) continue;
    return el;
  }
  return null;
}

/** Where the card goes for a target box inside a bounding box: above when there is room. Pure. */
export function placeCard(target: Box, bounds: Box, cardH: number): { left: number; top: number; below: boolean; arrowX: number } {
  const cx = target.left + target.width / 2;
  const gap = COACH.above;
  const aboveTop = target.top - gap - cardH;
  const below = aboveTop < bounds.top + COACH.margin;
  const top = below ? target.top + target.height + gap : aboveTop;
  const minL = bounds.left + COACH.margin;
  const maxL = bounds.left + bounds.width - COACH.cardW - COACH.margin;
  const left = Math.min(Math.max(cx - COACH.cardW / 2, minL), Math.max(minL, maxL));
  const arrowX = Math.min(Math.max(cx - left, COACH.arrow + 6), COACH.cardW - COACH.arrow - 6);
  return { left, top, below, arrowX };
}

export function placeHint(root: HTMLElement): void {
  const layer = root.querySelector<HTMLElement>(":scope > .hint-layer");
  if (!layer) return;
  const stage = liveStage(root);
  const sb = stage?.getBoundingClientRect();
  const win = root.ownerDocument.defaultView;
  const bounds: Box = sb && sb.width > 0 ? { left: sb.left, top: sb.top, width: sb.width, height: sb.height } : { left: 0, top: 0, width: win?.innerWidth ?? 1600, height: win?.innerHeight ?? 900 };
  let target: Box | null = null;
  const edge = layer.dataset.edge;
  if (edge === "left" || edge === "right") {
    const w = bounds.width * EDGE_SHARE;
    target = { left: edge === "left" ? bounds.left : bounds.left + bounds.width - w, top: bounds.top, width: w, height: bounds.height };
  } else if (layer.dataset.anchor) {
    const r = findAnchor(root, layer.dataset.anchor)?.getBoundingClientRect();
    if (r) target = { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  // No anchor found (it left the page): the card waits in the middle, no ring.
  const t = target ?? { left: bounds.left + bounds.width / 2, top: bounds.top + bounds.height / 2, width: 0, height: 0 };
  const ring = layer.querySelector<HTMLElement>(".hint-ring");
  if (ring) {
    Object.assign(ring.style, { left: `${t.left - RING_PAD}px`, top: `${t.top - RING_PAD}px`, width: `${t.width + 2 * RING_PAD}px`, height: `${t.height + 2 * RING_PAD}px` });
    ring.classList.toggle("none", target === null);
  }
  const card = layer.querySelector<HTMLElement>(".hint-card");
  if (!card) return;
  const ringBox = target ? { left: t.left - RING_PAD, top: t.top - RING_PAD, width: t.width + 2 * RING_PAD, height: t.height + 2 * RING_PAD } : t;
  const p = placeCard(ringBox, bounds, card.offsetHeight || 0);
  Object.assign(card.style, { left: `${p.left}px`, top: `${p.top}px` });
  card.style.setProperty("--arrow-x", `${p.arrowX}px`);
  card.classList.toggle("below", p.below);
}
