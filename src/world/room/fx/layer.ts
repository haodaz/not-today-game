// The DOM side of the breathing collapse (room-scene addition 2026-11-02). `renderFx` still writes
// the opacity stack into every still (the fallback, and what shows while the textures load). This
// layer, run after each render like the splat layer, finds that `.fx` element and puts one
// persistent WebGL2 canvas in it; once the first frame is drawn the CSS stack steps aside (`fx-gl`).
// No WebGL2, a failed compile or a lost context: the canvas goes and the stack stays.
// 30 fps, paused while the tab is hidden; reduced motion draws one still frame and nothing moves.
import type { ActionContext } from "@world/desktop/controller";
import { BACKDROPS } from "@world/fit";
import { playSfx } from "@world/loop/sfx";
import { prefersReducedMotion } from "../splat/gate";
import { fxPlan, type FxView } from "./index";
import { createFxRenderer, defaultLoadImage, FX, type FxRenderer, type LoadImage } from "./shader";

/** The sound a static burst makes (public/sfx/static.mp3; silence if the file is missing). */
export const STATIC_SFX = "static";

export interface FxLayerDeps {
  /** Makes the renderer for a canvas, or null when there is no WebGL2 (default: the browser's). */
  readonly makeRenderer?: (canvas: HTMLCanvasElement, hooks: { onReady: () => void; reduced: boolean }) => FxRenderer | null;
  readonly loadImage?: LoadImage;
  readonly reducedMotion?: () => boolean;
  readonly raf?: (fn: (ms: number) => void) => number;
  readonly caf?: (id: number) => void;
  readonly nowMs?: () => number;
  readonly hidden?: () => boolean;
}

/** The layer is off with `?fx=0` (a dev switch, like `?splat=0`). */
export function fxGlEnabled(search: string): boolean {
  return new URLSearchParams(search).get("fx") !== "0";
}

export function browserRenderer(loadImage: LoadImage = defaultLoadImage) {
  return (canvas: HTMLCanvasElement, hooks: { onReady: () => void; reduced: boolean }): FxRenderer | null => {
    try {
      const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
      if (!gl) return null;
      return createFxRenderer(gl, { loadImage, reduced: hooks.reduced, onReady: hooks.onReady });
    } catch {
      return null;
    }
  };
}

type Hook = { after(): void; destroy(): void };

/** The controller's `fx` dep: `(root, ctx) => { after, destroy }`. */
export function createFxLayer(deps: FxLayerDeps = {}): (root: HTMLElement, ctx: ActionContext) => Hook {
  return (root, ctx) => {
    const doc = root.ownerDocument;
    const win = doc.defaultView!;
    const makeRenderer = deps.makeRenderer ?? browserRenderer(deps.loadImage);
    const reducedNow = deps.reducedMotion ?? (() => prefersReducedMotion(win));
    const raf = deps.raf ?? ((fn) => win.requestAnimationFrame(fn));
    const caf = deps.caf ?? ((id) => win.cancelAnimationFrame(id));
    const nowMs = deps.nowMs ?? (() => win.performance.now());
    const isHidden = deps.hidden ?? (() => doc.hidden);

    let canvas: HTMLCanvasElement | null = null;
    let renderer: FxRenderer | null = null;
    let failed = false;
    let key = "";
    let host: HTMLElement | null = null;
    let reduced = false;
    let frameNo = 0;
    let clock = 0;
    let last = 0;
    let lastBurst = -1;
    let raf_id = 0;
    let drawn = false;

    const minGap = 1000 / FX.fps - 1;

    function giveUp(): void {
      failed = true;
      stop();
      renderer?.destroy();
      renderer = null;
      canvas?.remove();
      canvas = null;
      host?.classList.remove("fx-gl");
    }

    function draw(): void {
      if (!renderer || !renderer.ready()) return;
      const state = renderer.frame(clock, frameNo++);
      if (!state) return;
      if (!drawn) {
        drawn = true;
        host?.classList.add("fx-gl");
      }
      // A static burst is heard once, as it begins.
      if (state.burstStage && state.burstId !== lastBurst) {
        lastBurst = state.burstId;
        playSfx(STATIC_SFX, ctx.session.muted);
      } else if (!state.burstStage) {
        lastBurst = -1;
      }
    }

    function tick(ms: number): void {
      raf_id = raf(tick);
      if (isHidden()) {
        last = 0;
        return;
      }
      if (last && ms - last < minGap) return;
      const dt = last ? Math.min(100, ms - last) : 0;
      last = ms;
      clock += dt / 1000;
      draw();
    }

    function start(): void {
      if (raf_id || reduced) return;
      last = 0;
      raf_id = raf(tick);
    }

    function stop(): void {
      if (raf_id) caf(raf_id);
      raf_id = 0;
    }

    const onVisible = () => {
      last = 0;
    };
    doc.addEventListener("visibilitychange", onVisible);

    function after(): void {
      host = root.querySelector<HTMLElement>(".fx");
      const view = host?.dataset.view as FxView | undefined;
      if (!host || !view || view === "desktop" || failed || !fxGlEnabled(win.location.search)) {
        stop();
        if (canvas && canvas.parentElement && !host) canvas.remove();
        return;
      }
      const state = ctx.store.getState();
      const plan = fxPlan(state.day, view);
      if (!plan || plan.layers.length === 0) {
        stop();
        return;
      }
      reduced = reducedNow();
      if (!canvas) {
        canvas = doc.createElement("canvas");
        canvas.width = FX.size.w;
        canvas.height = FX.size.h;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          giveUp();
        });
        renderer = makeRenderer(canvas, { reduced, onReady: () => draw() });
        if (!renderer) {
          failed = true;
          canvas = null;
          return;
        }
      }
      if (canvas.parentElement !== host) host.appendChild(canvas);
      // A new day or a new still starts the clock again; a re-render of the same one does not.
      const next = `${state.day}:${view}:${reduced ? "r" : "m"}`;
      if (next !== key) {
        key = next;
        clock = 0;
        frameNo = 0;
        lastBurst = -1;
        drawn = false;
        renderer!.setScene(plan, BACKDROPS[view]);
      } else if (drawn) {
        host.classList.add("fx-gl");
      }
      if (reduced) {
        stop();
        if (drawn) draw();
      } else {
        start();
      }
    }

    return {
      after,
      destroy() {
        stop();
        doc.removeEventListener("visibilitychange", onVisible);
        renderer?.destroy();
        renderer = null;
        canvas?.remove();
        canvas = null;
      },
    };
  };
}

/** The controller's `fx` dep for this window. */
export function fxForGame(win: Window) {
  return fxGlEnabled(win.location.search) ? createFxLayer() : undefined;
}
