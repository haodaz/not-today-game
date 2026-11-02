// Moving is pointing (room-scene navigation 2026-11-01). The DOM side of the camera controls, run
// after every render like the splat layer:
//   - Hover: a ray through the current camera against the framing's boxes (splat/hotspots.ts); what
//     it hits is marked `data-hover` (4 % brighter) and the cursor says so.
//   - Click: the same ray; what it hits has its keyboard proxy pressed, so a mouse, Enter on a
//     focused proxy and a test all take the same action. The proxies are `.shot-hit[data-hot]`.
//   - Back: right-click (= Esc), the bottom 6 % of the stage, or the wheel turned back pulls the
//     camera out one level; never past 房间. Esc is the controller's.
//   - Look: press-and-drag turns the head ±15° / ±8° while the splat is live, and eases back on
//     release over 600 ms. With the splat off a drag does nothing.
// The camera is the splat layer's live pose while it draws, else the framing's fixed pose, which
// gives back today's rectangles. Nothing here is an event or state.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { hotRects, hotViewOf, pickHot, type HotId, type HotView } from "./splat/hotspots";
import { POSES, type Pose } from "./splat/pose";
import { STAGE_H, STAGE_W } from "./splat/geometry";

/** Anything the HUD or a placed thing answers to itself: the nav layer leaves a click on these alone. */
export const INTERACTIVE = "button, a, input, textarea, select, label, [data-action], .dlg, .dlg-layer, .list, .items-panel, .settings-layer, .book-reader, .held, .hud-host, .hud-br";
/** The bottom share of the stage that means "back". */
export const BACK_STRIP = 0.06;
/** A press that moves less than this (stage px) is a click, not a drag. */
export const DRAG_SLOP = 4;
/** Wheel-back is not repeated within this long. */
export const WHEEL_GAP_MS = 600;

/** The slice of the splat layer the controls use. */
export interface LookApi {
  look?(dx: number, dy: number): boolean;
  release?(): void;
  pose?(): Pose | null;
}

export interface NavDeps {
  /** Client pixel → stage pixel (default: the live stage's bounding box). */
  readonly toStage?: (root: HTMLElement, clientX: number, clientY: number) => { x: number; y: number } | null;
  readonly raf?: (fn: () => void) => number;
  readonly caf?: (id: number) => void;
  readonly now?: () => number;
}

type Hook = { after(): void; destroy(): void };

/** The stage's pixel under a client point; null if there is no stage or it has no size. */
export function stagePoint(root: HTMLElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const stage = root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");
  if (!stage) return null;
  const r = stage.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { x: ((clientX - r.left) / r.width) * (stage.classList.contains("room") ? STAGE_W : r.width), y: ((clientY - r.top) / r.height) * (stage.classList.contains("room") ? STAGE_H : r.height) };
}

/** Whether a stage point is in the bottom strip. The stage's height is 900 in 房间 and the desktop's own otherwise. */
export const inBackStrip = (y: number, height: number): boolean => y >= height * (1 - BACK_STRIP);

export function createNav(deps: NavDeps = {}) {
  return (root: HTMLElement, ctx: ActionContext, actions: Record<string, ActionHandler>, splat: LookApi | null): Hook => {
    const doc = root.ownerDocument;
    const win = doc.defaultView!;
    const toStage = deps.toStage ?? stagePoint;
    const raf = deps.raf ?? ((fn) => win.requestAnimationFrame(fn));
    const caf = deps.caf ?? ((id) => win.cancelAnimationFrame(id));
    const now = deps.now ?? (() => win.performance.now());

    let hover: HotId | null = null;
    let pointer: { x: number; y: number } | null = null;
    let down: { cx: number; cy: number; x: number; y: number; moved: boolean } | null = null;
    let suppressClick = false;
    let lastWheel = -Infinity;
    let frame = 0;

    const run = (name: string) => {
      const handler = actions[name];
      if (!handler) return;
      try {
        handler(ctx, {} as DOMStringMap, null as never);
      } catch (error) {
        console.warn(error);
      }
    };

    const hotView = (): HotView | null => hotViewOf(ctx.session.view);
    const proxy = (id: HotId) => root.querySelector<HTMLElement>(`.shot-hit[data-hot="${id}"]`);
    const interactive = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.(INTERACTIVE);
    const cameraPose = (view: HotView): Pose => splat?.pose?.() ?? POSES[view];

    function pickAt(p: { x: number; y: number }): HotId | null {
      const view = hotView();
      if (!view) return null;
      // What is in the DOM is what can be pointed at now (the tower only while the computer is off;
      // nothing while the placed things wait for the camera).
      return pickHot(cameraPose(view), view, p.x, p.y, (id) => proxy(id) !== null);
    }

    function setHover(id: HotId | null): void {
      if (id === hover && (id === null || proxy(id)?.hasAttribute("data-hover"))) return;
      if (hover) proxy(hover)?.removeAttribute("data-hover");
      hover = id;
      if (id) proxy(id)?.setAttribute("data-hover", "");
      root.style.cursor = id ? "pointer" : "";
    }

    /** While the camera is turned the proxies follow it; at rest their markup is already today's rectangles. */
    function syncProxies(): void {
      const view = hotView();
      const live = splat?.pose?.() ?? null;
      if (!view || !live) return;
      // The flat cutouts on the stage step aside while the camera is off its framing (nav.css).
      root.classList.add("look-turned");
      const rects = hotRects(live, view);
      for (const el of root.querySelectorAll<HTMLElement>(".shot-hit[data-hot]")) {
        const r = rects[el.dataset.hot as HotId];
        if (!r) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        Object.assign(el.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${r.w}px`, height: `${r.h}px` });
      }
      if (pointer && !down?.moved) setHover(pickAt(pointer));
    }

    function loop(): void {
      frame = 0;
      syncProxies();
      if (splat?.pose?.()) frame = raf(loop);
      else root.classList.remove("look-turned");
    }

    // ——— pointer ———

    const onDown = (e: MouseEvent) => {
      suppressClick = false;
      if (e.button !== 0 || interactive(e.target)) return;
      const p = toStage(root, e.clientX, e.clientY);
      if (!p) return;
      down = { cx: e.clientX, cy: e.clientY, x: p.x, y: p.y, moved: false };
    };

    const onMove = (e: MouseEvent) => {
      const p = toStage(root, e.clientX, e.clientY);
      pointer = p;
      if (down) {
        const sx = p ? p.x - down.x : e.clientX - down.cx;
        const sy = p ? p.y - down.y : e.clientY - down.cy;
        if (!down.moved && Math.hypot(sx, sy) < DRAG_SLOP) return;
        down.moved = true;
        setHover(null);
        // With the splat off (or not ready) a drag does nothing.
        if (splat?.look?.(sx, sy)) {
          syncProxies();
          if (!frame) frame = raf(loop);
        }
        return;
      }
      if (!p || interactive(e.target)) return setHover(null);
      setHover(pickAt(p));
    };

    const onUp = () => {
      if (!down) return;
      const dragged = down.moved;
      down = null;
      if (dragged) {
        suppressClick = true;
        splat?.release?.();
        if (!frame) frame = raf(loop);
      }
    };

    const onClick = (e: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (interactive(e.target)) return;
      const p = toStage(root, e.clientX, e.clientY);
      if (!p) return;
      const stage = root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");
      const height = stage?.classList.contains("room") ? STAGE_H : (stage?.getBoundingClientRect().height ?? STAGE_H);
      if (inBackStrip(p.y, height)) {
        e.preventDefault();
        return run("nav-back");
      }
      const id = pickAt(p);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      proxy(id)?.click();
    };

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      run("nav-esc");
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY <= 0) return;
      // Inside a window the wheel scrolls it; on 屏幕 only the desktop around the windows pulls out.
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".win, .dlg-hist, .items-panel, .settings-layer, textarea, .book-reader")) return;
      const t0 = now();
      if (t0 - lastWheel < WHEEL_GAP_MS) return;
      if (ctx.session.view === "room") return;
      lastWheel = t0;
      run("nav-back");
    };

    root.addEventListener("mousedown", onDown);
    root.addEventListener("mousemove", onMove);
    win.addEventListener("mouseup", onUp);
    root.addEventListener("click", onClick, true);
    root.addEventListener("contextmenu", onContext);
    root.addEventListener("wheel", onWheel, { passive: true });

    return {
      after() {
        // A new render: the markup is today's rectangles again; put the camera's back, and the hover.
        hover = null;
        if (!splat?.pose?.()) root.classList.remove("look-turned");
        syncProxies();
        if (splat?.pose?.() && !frame) frame = raf(loop);
        if (pointer && !down?.moved && !splat?.pose?.()) {
          const view = hotView();
          setHover(view ? pickAt(pointer) : null);
        }
      },
      destroy() {
        if (frame) caf(frame);
        frame = 0;
        root.removeEventListener("mousedown", onDown);
        root.removeEventListener("mousemove", onMove);
        win.removeEventListener("mouseup", onUp);
        root.removeEventListener("click", onClick, true);
        root.removeEventListener("contextmenu", onContext);
        root.removeEventListener("wheel", onWheel);
        root.style.cursor = "";
        root.classList.remove("look-turned");
      },
    };
  };
}
