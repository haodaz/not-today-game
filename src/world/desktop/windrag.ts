// tingtalk (2026-11-04) R1b: the two drags macOS has for moving a window to another display, and
// nothing else. (1) A window's title bar dragged until the pointer reaches the monitor's inner edge
// (the left monitor's right edge, the right monitor's left edge): on release the window moves to
// the other monitor (`win-move`). (2) In 调度中心, a window dragged onto a screen's thumbnail: on
// release over it, the window moves there (`win-move`); a press without a drag stays a click
// (`mc-focus`). The window follows the pointer while dragged; the moves themselves are the actions.

/** How far the pointer must travel before a press is a drag (px). */
export const DRAG_SLOP = 4;
/** How close to the inner edge counts as across it (px; the monitor fills the stage). */
export const EDGE_PX = 2;

type Run = (name: string, data: Record<string, string>, el: HTMLElement) => void;

/** Whether a release at `x` is across a monitor's inner edge (pure; for the title-bar drag). */
export function acrossInnerEdge(side: "left" | "right", x: number, rect: { left: number; right: number }): boolean {
  return side === "left" ? x >= rect.right - EDGE_PX : x <= rect.left + EDGE_PX;
}

export function createWindowDrag(root: HTMLElement, run: Run): { destroy(): void } {
  let drag: { kind: "bar" | "mc"; app: string; side: string; x: number; y: number; moved: boolean; el: HTMLElement } | null = null;
  let swallowClick = false;

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest) return;
    const bar = target.closest<HTMLElement>("[data-drag-win]");
    // The traffic lights and their menu are buttons, not the handle.
    if (bar && !target.closest("button, .tl-g")) {
      const win = bar.closest<HTMLElement>(".win") ?? bar;
      drag = { kind: "bar", app: bar.dataset.dragWin ?? "", side: bar.dataset.side ?? "", x: e.clientX, y: e.clientY, moved: false, el: win };
      return;
    }
    const mcWin = target.closest<HTMLElement>("[data-mc-drag]");
    if (mcWin) drag = { kind: "mc", app: mcWin.dataset.mcDrag ?? "", side: mcWin.dataset.side ?? "", x: e.clientX, y: e.clientY, moved: false, el: mcWin };
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    drag.moved = true;
    drag.el.style.transform = `translate(${dx}px, ${dy}px)`;
    drag.el.classList.add("dragging");
  };
  const up = (e: PointerEvent) => {
    const d = drag;
    drag = null;
    if (!d) return;
    d.el.style.transform = "";
    d.el.classList.remove("dragging");
    if (!d.moved) return;
    if (d.kind === "bar") {
      const mon = d.el.closest<HTMLElement>(".monitor");
      if (!mon || (d.side !== "left" && d.side !== "right")) return;
      if (acrossInnerEdge(d.side, e.clientX, mon.getBoundingClientRect())) run("win-move", { app: d.app, side: d.side === "left" ? "right" : "left" }, d.el);
      return;
    }
    // In 调度中心: the release is a drop (not a click), on a screen or nowhere.
    swallowClick = true;
    const doc = root.ownerDocument;
    const over = doc.elementFromPoint?.(e.clientX, e.clientY) as HTMLElement | null;
    const screen = over?.closest?.<HTMLElement>("[data-mc-drop]");
    if (screen?.dataset.mcDrop) run("win-move", { app: d.app, side: screen.dataset.mcDrop }, d.el);
  };
  // The click that follows a drop is not a click on the window.
  const click = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", up);
  root.addEventListener("click", click, true);
  return {
    destroy() {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("click", click, true);
    },
  };
}
