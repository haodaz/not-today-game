// Moving is pointing (room-scene navigation 2026-11-01). The DOM side of the camera controls, run
// after every render like the splat layer:
//   - Hover: a ray through the current camera against the framing's boxes (splat/hotspots.ts); what
//     it hits is marked `data-hover` (4 % brighter) and the cursor says so.
//   - Click: the same ray; what it hits has its keyboard proxy pressed, so a mouse, Enter on a
//     focused proxy and a test all take the same action. The proxies are `.shot-hit[data-hot]`.
//   - Back: right-click (= Esc), the bottom 6 %, or the wheel turned back pulls the camera out one
//     level, from 屏幕 and 桌子 only; the four facings are the top level and have no back. Esc is the
//     controller's.
//   - Look: press-and-drag pans the photo (look.ts: ±4 % / ±2 %, the placed things 1.5×), easing
//     back over 600 ms on release. Never the splat (room-scene decision 2026-11-02).
//   - Edges: on every facing the left and right 8 % turn that way (room-turn 2026-11-04); the bottom
//     6 % of 桌子 is back. Resting there shows the hint (session.edge, drawn by hud.ts), clicking
//     there goes there.
//   - 床 and 窗 have fixed rectangles (shots.ts FLAT_HOTS), picked by rectangle, not by a ray.
// The camera is the splat layer's live pose while it draws, else the framing's fixed pose, which
// gives back today's rectangles. Nothing here is an event or state.
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { hotRects, hotViewOf, pickHot, type HotView } from "./splat/hotspots";
import { POSES, type Pose } from "./splat/pose";
import { STAGE_H, STAGE_W } from "./splat/geometry";
import { applyPan, easePan, edgeZone, NO_PAN, photoPan, PLACED_PARALLAX, LOOK_RETURN_MS, type EdgeZone, type Pan } from "./look";
import { hasBack, isFacing } from "./facings";
import { FLAT_HOTS, isFlatFacing } from "./shots";

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

/**
 * playtest-1105 R10: the placed prop on 桌子's tabletop under a press (its `.at` box: the cup, the
 * phone, an object, the slip…), or null. Only on the live stage, never on a ghost.
 */
export function propAt(target: EventTarget | null): HTMLElement | null {
  const el = (target as HTMLElement | null)?.closest?.<HTMLElement>(".desk-things > .at");
  if (!el || el.closest(".m-ghost, .m-backdrop, .m-turn")) return null;
  return el;
}
/** How long a dragged prop takes to go back to its place (the look's own return). */
export const PROP_RETURN_MS = 400;
/** The dragged prop follows the hand (stage px), alone: only its own box moves. */
export function movePropBy(el: HTMLElement, dx: number, dy: number): void {
  el.style.transition = "none";
  el.style.translate = `${Math.round(dx)}px ${Math.round(dy)}px`;
  el.classList.add("dragging");
}
/** Let go: it eases back to where content put it (nothing is saved). */
export function releaseProp(el: HTMLElement): void {
  el.style.transition = `translate ${PROP_RETURN_MS}ms ease-out`;
  el.style.translate = "";
  el.classList.remove("dragging");
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

    let hover: string | null = null;
    let pointer: { x: number; y: number } | null = null;
    let down: { cx: number; cy: number; x: number; y: number; moved: boolean } | null = null;
    /** playtest-1105 R10: the one prop being dragged at 桌子 (its `.at` box), or null. */
    let propDrag: { el: HTMLElement; cx: number; cy: number; x: number; y: number; moved: boolean } | null = null;
    let suppressClick = false;
    let lastWheel = -Infinity;
    let frame = 0;

    /** The photo's pan now, and the release it is easing back from. */
    let pan: Pan = NO_PAN;
    let easing: { from: Pan; at: number } | null = null;

    const run = (name: string, data: Record<string, string> = {}) => {
      const handler = actions[name];
      if (!handler) return;
      try {
        handler(ctx, data as DOMStringMap, null as never);
      } catch (error) {
        console.warn(error);
      }
    };

    const hotView = (): HotView | null => hotViewOf(ctx.session.view);
    const proxy = (id: string) => root.querySelector<HTMLElement>(`.shot-hit[data-hot="${id}"]`);
    const interactive = (target: EventTarget | null) => !!(target as HTMLElement | null)?.closest?.(INTERACTIVE);
    const cameraPose = (view: HotView): Pose => splat?.pose?.() ?? POSES[view];

    function pickAt(at: { x: number; y: number }): string | null {
      // While the photo is panned the placed things (and their proxies) sit 1.5× the pan away.
      const p = { x: at.x - pan.x * PLACED_PARALLAX, y: at.y - pan.y * PLACED_PARALLAX };
      // 床 and 窗 (room-turn R3): fixed rectangles, the first that holds the point (they do not overlap).
      const flat = ctx.session.view;
      if (isFlatFacing(flat)) {
        const hit = FLAT_HOTS[flat].find(({ id, rect: r }) => p.x >= r.l && p.x < r.l + r.w && p.y >= r.t && p.y < r.t + r.h && proxy(id) !== null);
        return hit?.id ?? null;
      }
      const view = hotView();
      if (!view) return null;
      // What is in the DOM is what can be pointed at now (the tower only while the computer is off;
      // nothing while the placed things wait for the camera).
      return pickHot(cameraPose(view), view, p.x, p.y, (id) => proxy(id) !== null);
    }

    function setHover(id: string | null): void {
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
        const r = rects[el.dataset.hot as keyof typeof rects];
        if (!r) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        Object.assign(el.style, { left: `${r.l}px`, top: `${r.t}px`, width: `${r.w}px`, height: `${r.h}px` });
      }
      if (pointer && !down?.moved) setHover(pickAt(pointer));
    }

    const liveStage = () => root.querySelector<HTMLElement>(":scope > .stage.room:not(.m-ghost):not(.m-backdrop)");
    /** Only the photo views pan: the four facings and 桌子 (not 屏幕). */
    const pans = () => isFacing(ctx.session.view) || ctx.session.view === "desk";
    function setPan(p: Pan): void {
      pan = p;
      const stage = liveStage();
      if (stage) applyPan(stage, p);
    }

    function loop(): void {
      frame = 0;
      syncProxies();
      if (easing) {
        const e = now() - easing.at;
        setPan(easePan(easing.from, e));
        if (e >= LOOK_RETURN_MS) easing = null;
      }
      if (splat?.pose?.() || easing) frame = raf(loop);
      else root.classList.remove("look-turned");
    }

    /** The hinted edge under the pointer changed: the HUD shows (or drops) its hint. */
    function setEdge(zone: EdgeZone | null): void {
      if ((ctx.session.edge?.zone ?? null) === zone) return;
      ctx.session.edge = zone ? { zone, since: ctx.now?.() ?? Date.now() } : null;
      ctx.rerender();
    }
    const edgeAt = (p: { x: number; y: number } | null): EdgeZone | null => (p ? edgeZone(ctx.session.view, p.x, p.y) : null);

    // ——— pointer ———

    const onDown = (e: MouseEvent) => {
      suppressClick = false;
      // playtest-1105 R10: a press on a placed prop at 桌子 drags that prop alone (it goes back on
      // release); it never starts the look pan, which moves the whole tabletop layer together.
      const prop = e.button === 0 ? propAt(e.target) : null;
      if (prop) {
        const p = toStage(root, e.clientX, e.clientY);
        propDrag = { el: prop, cx: e.clientX, cy: e.clientY, x: p?.x ?? e.clientX, y: p?.y ?? e.clientY, moved: false };
        // No native image drag (Firefox ignores -webkit-user-drag); the click still follows.
        e.preventDefault();
        return;
      }
      if (e.button !== 0 || interactive(e.target)) return;
      const p = toStage(root, e.clientX, e.clientY);
      if (!p) return;
      down = { cx: e.clientX, cy: e.clientY, x: p.x, y: p.y, moved: false };
    };

    const onMove = (e: MouseEvent) => {
      const p = toStage(root, e.clientX, e.clientY);
      pointer = p;
      if (propDrag) {
        const sx = p ? p.x - propDrag.x : e.clientX - propDrag.cx;
        const sy = p ? p.y - propDrag.y : e.clientY - propDrag.cy;
        if (!propDrag.moved && Math.hypot(sx, sy) < DRAG_SLOP) return;
        propDrag.moved = true;
        movePropBy(propDrag.el, sx, sy);
        return;
      }
      if (down) {
        const sx = p ? p.x - down.x : e.clientX - down.cx;
        const sy = p ? p.y - down.y : e.clientY - down.cy;
        if (!down.moved && Math.hypot(sx, sy) < DRAG_SLOP) return;
        down.moved = true;
        setHover(null);
        // Look: the photo pans with the hand (never the splat).
        if (pans()) {
          easing = null;
          setPan(photoPan(sx, sy));
        }
        return;
      }
      if (!p || interactive(e.target)) {
        setEdge(null);
        return setHover(null);
      }
      // An edge that leads somewhere shows its hint instead of a hover.
      const edge = edgeAt(p);
      setEdge(edge);
      setHover(edge || ctx.session.viewfinder ? null : pickAt(p));
    };

    const onUp = () => {
      if (propDrag) {
        if (propDrag.moved) {
          suppressClick = true;
          releaseProp(propDrag.el);
        }
        propDrag = null;
        return;
      }
      if (!down) return;
      const dragged = down.moved;
      down = null;
      if (dragged) {
        suppressClick = true;
        if (pan.x !== 0 || pan.y !== 0) easing = { from: pan, at: now() };
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
      // The bottom strip is back only where there is a level to go back to (桌子, 屏幕); on a
      // facing a click there is a click on what is there (the bed, the table).
      if (hasBack(ctx.session.view) && inBackStrip(p.y, height)) {
        e.preventDefault();
        return run("nav-back");
      }
      // A turn edge turns that way (room-turn R2).
      const edge = edgeAt(p);
      if (edge === "left" || edge === "right") {
        e.preventDefault();
        e.stopPropagation();
        return run("turn", { dir: edge });
      }
      // camera-viewfinder R1: through the viewfinder only the turns answer; nothing in the scene is picked.
      if (ctx.session.viewfinder) return;
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
      // The facings are the top level: the wheel does nothing there (room-turn R1).
      if (!hasBack(ctx.session.view)) return;
      lastWheel = t0;
      run("nav-back");
    };

    const onLeave = () => {
      pointer = null;
      setEdge(null);
      setHover(null);
    };
    root.addEventListener("mouseleave", onLeave);
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
        // The new stage takes the pan where it is (a re-render in the middle of a look).
        if (pan.x !== 0 || pan.y !== 0) {
          if (pans()) setPan(pan);
          else ((pan = NO_PAN), (easing = null));
        }
        syncProxies();
        if (splat?.pose?.() && !frame) frame = raf(loop);
        if (pointer && !down?.moved && !splat?.pose?.()) setHover(edgeAt(pointer) ? null : pickAt(pointer));
      },
      destroy() {
        if (frame) caf(frame);
        frame = 0;
        root.removeEventListener("mouseleave", onLeave);
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
