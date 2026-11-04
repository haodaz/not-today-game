// shell R11.2 (2026-11-04): the dock over full-screen 工作台, the macOS way. While 工作台 is the
// front window on the left monitor the dock is hidden; it slides up when the pointer reaches the
// bottom DOCK_EDGE_PX of that monitor, stays while the pointer is on it, and hides again
// DOCK_HIDE_MS after the pointer has left both. Other apps keep the dock as before. The peek is
// session only (`session.dockPeek`, set by the `dock-peek` action); this layer only watches the pointer.

/** The bottom strip of the monitor that brings the dock up (px). */
export const DOCK_EDGE_PX = 6;
/** How long the dock stays after the pointer leaves it and the edge (ms). */
export const DOCK_HIDE_MS = 600;

/** The pointer is in the monitor's bottom strip (pure). */
export function atDockEdge(x: number, y: number, rect: { left: number; right: number; bottom: number }): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.bottom - DOCK_EDGE_PX && y <= rect.bottom;
}

/**
 * The peek's timing, apart from the DOM (pure; `later` / `cancel` are the clock): `move(near)` with
 * near = the pointer is at the edge or on the dock. Near shows it at once and drops a pending hide;
 * away from it, a shown dock hides DOCK_HIDE_MS later.
 */
export function dockPeeker(io: { readonly shown: () => boolean; readonly set: (on: boolean) => void; readonly later: (ms: number, fn: () => void) => unknown; readonly cancel: (handle: unknown) => void }) {
  let pending: unknown = null;
  const drop = () => {
    if (pending !== null) io.cancel(pending);
    pending = null;
  };
  return {
    move(near: boolean): void {
      if (near) {
        drop();
        if (!io.shown()) io.set(true);
        return;
      }
      if (!io.shown() || pending !== null) return;
      pending = io.later(DOCK_HIDE_MS, () => {
        pending = null;
        io.set(false);
      });
    },
    destroy: drop,
  };
}

type Run = (name: string, data: Record<string, string>) => void;

/** The DOM side: pointer moves over the stage drive the peek through the `dock-peek` action. */
export function createDockPeek(root: HTMLElement, run: Run, shown: () => boolean): { destroy(): void } {
  const peek = dockPeeker({
    shown,
    set: (on) => run("dock-peek", { on: on ? "1" : "0" }),
    later: (ms, fn) => setTimeout(fn, ms),
    cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  const move = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    // Only over a monitor whose dock hides (工作台 in front on the left monitor).
    const dock = root.querySelector<HTMLElement>(".monitor .dock.auto");
    const mon = dock?.closest<HTMLElement>(".monitor");
    if (!dock || !mon) return;
    // On the dock, or on Kuro's pill that peeks with it (R12.2), counts as near.
    const onDock = !!target?.closest?.(".dock.auto, .dock.auto ~ .kpill");
    peek.move(onDock || atDockEdge(e.clientX, e.clientY, mon.getBoundingClientRect()));
  };
  const leave = () => peek.move(false);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerleave", leave);
  return {
    destroy() {
      peek.destroy();
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
    },
  };
}
