// The splat layer (room-scene design S4–S10): during a 房间 ↔ 桌子 move it renders the room splat
// from the departing pose to the arriving one, behind the (transparent) arriving stage, then fades
// the arriving photo in over the last 200 ms. No three here: the scene comes from an injected
// `load`, which the game wires to a dynamic import of ./scene, after the first render.
// If the scene isn't ready when a move starts, nothing is inserted and the CSS push plays.
import type { ActionContext } from "@world/desktop/controller";
import { BACKDROPS } from "@world/fit";
import { MOTION } from "@world/motion/timing";
import { DESK_SHOT, ROOM_SHOT, type Rect } from "@world/room/shots";
import { splatMoveFor } from "./moves";
import { easeInOutCubic, poseAt, type CameraMove, type Pose } from "./pose";
import { splatLook, type SplatLook } from "./look";

/** The arriving photo fades in over the move's last 200 ms. */
export const SPLAT_FADE_MS = 200;
/** If the motion layer never gives the photo back, the layer leaves anyway this long after the move. */
const SAFETY_MS = 500;
/** The stage the layer covers (the room stage). */
const STAGE_W = 1600;
const STAGE_H = 900;

/** What ./scene provides (and tests fake). */
export interface SplatScene {
  /** [clean, collapsed]: the layer mounts them; the collapsed one draws nothing until loaded. */
  readonly canvases: readonly [HTMLCanvasElement, HTMLCanvasElement];
  /** Loads room_collapsed.splat (once); resolves when it can be drawn. */
  ensureCollapsed(): Promise<void>;
  setSize(cssW: number, cssH: number, pixelRatio: number): void;
  /** One frame of both scenes at this pose; the collapsed one only if loaded and mix > 0. */
  render(pose: Pose, mix: number): void;
  dispose(): void;
}
/** Resolves once room_clean is loaded and one nudged frame has been drawn (off-screen). */
export type LoadScene = (doc: Document) => Promise<SplatScene>;

export interface SplatDeps {
  readonly load: LoadScene;
  /** Clock for the move (performance.now in the game). */
  readonly now?: () => number;
  readonly raf?: (fn: () => void) => number;
  readonly cancelRaf?: (id: number) => void;
  /** When to start loading after the first render (requestIdleCallback or 1 s). */
  readonly idle?: (fn: () => void) => void;
  readonly pixelRatio?: () => number;
}

export interface SplatHooks {
  after(): void;
  destroy(): void;
  /** For tests and the later pull-out: "idle" | "loading" | "ready" | "off". */
  status(): string;
}

/** The gap rect at night, per framing (bed has none yet). */
const GAP: Readonly<Record<string, Rect>> = { room: ROOM_SHOT.gap, desk: DESK_SHOT.gap };
/** Provisional: the desk lamp's corner, top right of the desk, per framing (S8). */
const LAMP: Readonly<Record<string, { x: number; y: number }>> = { room: { x: 960, y: 300 }, desk: { x: 1040, y: 250 } };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpRect(a: Rect | undefined, b: Rect | undefined, t: number): Rect | null {
  if (!a || !b) return a ?? b ?? null;
  return { l: lerp(a.l, b.l, t), t: lerp(a.t, b.t, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

interface Running {
  readonly from: string;
  readonly to: string;
  readonly move: CameraMove;
  readonly look: SplatLook;
  readonly start: number;
  readonly dur: number;
}

export function createSplatLayer(deps: SplatDeps) {
  return (root: HTMLElement, ctx: ActionContext): SplatHooks => {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const now = deps.now ?? (() => win?.performance.now() ?? Date.now());
    const raf = deps.raf ?? ((fn) => win!.requestAnimationFrame(fn));
    const cancelRaf = deps.cancelRaf ?? ((id) => win!.cancelAnimationFrame(id));
    const idle = deps.idle ?? ((fn) => {
      const ric = (win as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void } | null)?.requestIdleCallback;
      if (ric) ric(fn, { timeout: 1000 });
      else win?.setTimeout(fn, 1000);
    });
    const pixelRatio = deps.pixelRatio ?? (() => Math.min(2, win?.devicePixelRatio ?? 1));

    let status: "idle" | "loading" | "ready" | "off" = "idle";
    let scene: SplatScene | null = null;
    let collapsed: "no" | "loading" | "yes" = "no";
    let lastView: string | null = null;
    let running: Running | null = null;
    let frame = 0;
    let el: HTMLElement | null = null;
    let destroyed = false;

    const load = () => {
      if (status !== "idle" || destroyed) return;
      status = "loading";
      deps
        .load(doc)
        .then((s) => {
          if (destroyed) return s.dispose();
          scene = s;
          status = "ready";
          preloadCollapsed();
        })
        .catch(() => {
          status = "off";
        });
    };

    const lookNow = (): SplatLook => splatLook(ctx.store.getState().day, ctx.session.clock.beat);

    /** From ring `room` the collapsed splat is needed; fetch it before the first move that wants it. */
    function preloadCollapsed(): void {
      if (!scene || collapsed !== "no" || lookNow().mix <= 0) return;
      collapsed = "loading";
      scene
        .ensureCollapsed()
        .then(() => void (collapsed = "yes"))
        .catch(() => void (collapsed = "no"));
    }

    /** The persistent element: canvases, night layers, vignette, the arriving photo. */
    function build(s: SplatScene): HTMLElement {
      const box = doc.createElement("div");
      box.className = "splat-layer";
      box.setAttribute("aria-hidden", "true");
      const [clean, coll] = s.canvases;
      clean.classList.add("splat-clean");
      coll.classList.add("splat-collapsed");
      box.append(clean, coll);
      for (const cls of ["splat-night", "splat-lamp", "splat-gap", "splat-vignette", "splat-photo"]) {
        const d = doc.createElement("div");
        d.className = cls;
        box.appendChild(d);
      }
      return box;
    }

    const liveStage = (): HTMLElement | null => root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");

    /** Copy the stage's fit (polish P11) so the layer covers exactly the stage. */
    function place(stage: HTMLElement): void {
      if (!el) return;
      for (const name of ["--scale", "--stage-x", "--stage-y"]) el.style.setProperty(name, stage.style.getPropertyValue(name));
      if (el.nextElementSibling !== stage) root.insertBefore(el, stage);
    }

    function paint(r: Running, t: number): void {
      if (!scene || !el) return;
      const elapsed = t - r.start;
      const p = Math.min(1, elapsed / r.dur);
      scene.render(poseAt(r.move, p), r.look.mix);
      const q = (sel: string) => el!.querySelector<HTMLElement>(sel)!;
      q(".splat-collapsed").style.opacity = String(collapsed === "yes" ? r.look.mix : 0);
      q(".splat-photo").style.opacity = String(Math.min(1, Math.max(0, (elapsed - (r.dur - SPLAT_FADE_MS)) / SPLAT_FADE_MS)));
      const e = easeInOutCubic(p);
      const gap = r.look.gap === "none" ? null : lerpRect(GAP[r.from], GAP[r.to], e);
      const g = q(".splat-gap");
      g.hidden = !gap;
      if (gap) Object.assign(g.style, { left: `${gap.l}px`, top: `${gap.t}px`, width: `${gap.w}px`, height: `${gap.h}px` });
      const la = LAMP[r.from];
      const lb = LAMP[r.to];
      const lamp = q(".splat-lamp");
      lamp.hidden = !r.look.night || !la || !lb;
      if (la && lb) Object.assign(lamp.style, { left: `${lerp(la.x, lb.x, e)}px`, top: `${lerp(la.y, lb.y, e)}px` });
    }

    function tick(): void {
      frame = 0;
      const r = running;
      if (!r || destroyed) return;
      const t = now();
      const stage = liveStage();
      if (stage) place(stage);
      paint(r, t);
      // Stay until the stage has its own photo back (no gap), or the safety time.
      const done = t - r.start >= r.dur && (!stage || !stage.classList.contains("m-nobg"));
      if (done || t - r.start >= r.dur + SAFETY_MS) return finish();
      frame = raf(tick);
    }

    function finish(): void {
      running = null;
      if (frame) cancelRaf(frame);
      frame = 0;
      el?.remove();
    }

    function start(from: string, to: string, move: CameraMove, stage: HTMLElement): void {
      if (!scene) return;
      el ??= build(scene);
      const look = lookNow();
      el.classList.toggle("night", look.night);
      el.classList.toggle("pink", look.gap === "pink");
      el.querySelector<HTMLElement>(".splat-photo")!.style.backgroundImage = `url(${BACKDROPS[to as keyof typeof BACKDROPS] ?? BACKDROPS.room})`;
      const scale = parseFloat(stage.style.getPropertyValue("--scale")) || 1;
      scene.setSize(STAGE_W, STAGE_H, scale * pixelRatio());
      running = { from, to, move, look, start: now(), dur: MOTION.view };
      place(stage);
      paint(running, running.start);
      if (!frame) frame = raf(tick);
    }

    return {
      status: () => status,
      after() {
        if (destroyed) return;
        const view = ctx.session.view;
        const prev = lastView;
        lastView = view;
        if (prev === null) return idle(load);
        const stage = liveStage();
        if (running) {
          // A re-render mid-move replaced the markup: put the layer back before the new stage.
          if (stage) place(stage);
          if (view === running.to) return;
          finish();
        }
        preloadCollapsed();
        if (view === prev || status !== "ready" || !stage) return;
        const move = splatMoveFor(prev, view);
        // Only while the motion layer holds the arriving photo back (m-nobg): that's the CSS push
        // this replaces, and its backdrop copy stays underneath as the fallback.
        if (!move || !stage.classList.contains("m-nobg")) return;
        if (lookNow().mix > 0 && collapsed !== "yes") return;
        start(prev, view, move, stage);
      },
      destroy() {
        destroyed = true;
        finish();
        scene?.dispose();
        scene = null;
      },
    };
  };
}
