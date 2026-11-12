// work-stages-polish 2: a clipping dragged onto a slot (the evidence board, the meeting template).
// Press on a found clipping (`.cs-clip[data-action="board-card"]`), drag, release over a `.cs-slot`:
// the same two actions a click makes fire in order through the action table — `board-card` with the
// card (skipped when it is already the pick), then `board-slot` with the slot. Mouse and touch (pointer
// events). While dragging the clipping follows the pointer (a transform on it) and the slot under the
// pointer has `drop`. Escape, a pointercancel or a release elsewhere cancels: nothing fires and the
// click that follows the release is swallowed, so the pick stays as it was. A press without a drag
// stays a click. The store is never touched here.

//
// work-stages-polish 3 lives here too: a swipe on the approval chain's grid (`.sk-grid`) is one
// `stack-move` in the swipe's direction (24 px, the first direction past it; one move per gesture).
import { swipeDir } from "./stack-stage";

/** How far the pointer must travel before a press is a drag (px). */
export const CLIP_SLOP = 6;

type Run = (name: string, data: Record<string, string>, el: HTMLElement) => void;

interface ClipDrag {
  readonly card: string;
  readonly picked: boolean;
  readonly x: number;
  readonly y: number;
  readonly el: HTMLElement;
  readonly pointer: number;
  moved: boolean;
  scale: number;
  over: HTMLElement | null;
}

/** The slot under a point (the dragged clipping itself lets the pointer through). */
function slotAt(root: HTMLElement, x: number, y: number): HTMLElement | null {
  const hit = root.ownerDocument.elementFromPoint?.(x, y) as HTMLElement | null;
  const slot = hit?.closest?.<HTMLElement>(".cs-slot[data-slot]") ?? null;
  return slot && root.contains(slot) ? slot : null;
}

export function createClipDrag(root: HTMLElement, run: Run): { destroy(): void } {
  let drag: ClipDrag | null = null;
  let swallowClick = false;

  const clear = (d: ClipDrag) => {
    d.el.style.transform = "";
    d.el.style.pointerEvents = "";
    d.el.classList.remove("dragging");
    d.el.closest(".cs-tray")?.classList.remove("lifting");
    d.over?.classList.remove("drop");
  };
  const cancel = () => {
    const d = drag;
    drag = null;
    if (!d) return;
    clear(d);
    if (d.moved) swallowClick = true;
  };

  const down = (e: PointerEvent) => {
    if (e.button !== 0 || drag) return;
    // A release that was followed by no click (a touch let go elsewhere) does not eat this press's click.
    swallowClick = false;
    const clip = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('.cs-clip[data-action="board-card"]');
    if (!clip || !root.contains(clip) || (clip as HTMLButtonElement).disabled || !clip.dataset.card) return;
    drag = { card: clip.dataset.card, picked: clip.classList.contains("picked"), x: e.clientX, y: e.clientY, el: clip, pointer: e.pointerId ?? 0, moved: false, scale: 1, over: null };
  };
  const move = (e: PointerEvent) => {
    const d = drag;
    if (!d || (e.pointerId ?? 0) !== d.pointer) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < CLIP_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      // The stage may be scaled to fit the window: the pointer's px are divided back into the stage's.
      const w = d.el.offsetWidth;
      d.scale = w > 0 ? d.el.getBoundingClientRect().width / w || 1 : 1;
      d.el.classList.add("dragging");
      d.el.style.pointerEvents = "none";
      // The tray scrolls (overflow) and would clip the clipping once it leaves; it lets it out while dragged.
      d.el.closest(".cs-tray")?.classList.add("lifting");
    }
    d.el.style.transform = `translate(${dx / d.scale}px, ${dy / d.scale}px)`;
    const over = slotAt(root, e.clientX, e.clientY);
    if (over !== d.over) {
      d.over?.classList.remove("drop");
      over?.classList.add("drop");
      d.over = over;
    }
    e.preventDefault();
  };
  const up = (e: PointerEvent) => {
    const d = drag;
    if (!d || (e.pointerId ?? 0) !== d.pointer) return;
    drag = null;
    clear(d);
    if (!d.moved) return; // a click: the click handler does it
    swallowClick = true;
    const slot = slotAt(root, e.clientX, e.clientY);
    if (!slot?.dataset.slot) return;
    if (!d.picked) run("board-card", { card: d.card }, d.el);
    run("board-slot", { slot: slot.dataset.slot }, slot);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !drag) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    cancel();
  };
  // The click that follows a drag's release is not a click on the clipping.
  const click = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  // ——— the approval chain's swipe
  let swipe: { x: number; y: number; pointer: number; scale: number; done: boolean } | null = null;
  const swipeDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const grid = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".sk-grid");
    if (!grid || !root.contains(grid)) return;
    const w = grid.offsetWidth;
    swipe = { x: e.clientX, y: e.clientY, pointer: e.pointerId ?? 0, scale: w > 0 ? grid.getBoundingClientRect().width / w || 1 : 1, done: false };
  };
  const swipeMove = (e: PointerEvent) => {
    const s = swipe;
    if (!s || s.done || (e.pointerId ?? 0) !== s.pointer) return;
    const dir = swipeDir((e.clientX - s.x) / s.scale, (e.clientY - s.y) / s.scale);
    if (!dir) return;
    s.done = true;
    e.preventDefault();
    run("stack-move", { dir }, e.target as HTMLElement);
  };
  const swipeEnd = () => void (swipe = null);

  const win = root.ownerDocument.defaultView;
  root.addEventListener("pointerdown", swipeDown);
  root.addEventListener("pointermove", swipeMove);
  root.addEventListener("pointerup", swipeEnd);
  root.addEventListener("pointercancel", swipeEnd);
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", cancel);
  root.addEventListener("click", click, true);
  win?.addEventListener("keydown", key, true);
  return {
    destroy() {
      root.removeEventListener("pointerdown", swipeDown);
      root.removeEventListener("pointermove", swipeMove);
      root.removeEventListener("pointerup", swipeEnd);
      root.removeEventListener("pointercancel", swipeEnd);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", cancel);
      root.removeEventListener("click", click, true);
      win?.removeEventListener("keydown", key, true);
    },
  };
}
