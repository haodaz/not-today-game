// The splat layer (room-scene design S4–S10, S12–S14): during a 房间 ↔ 桌子 move it renders the room
// splat from the departing pose to the arriving one, behind the (transparent) arriving stage, then
// fades the arriving photo in over the last 200 ms. No three here: the scene comes from an injected
// `load`, which the game wires to a dynamic import of ./scene, after the first render.
// If the scene isn't ready when a move starts, nothing is inserted and the CSS push plays.
// The layer is exactly the stage rectangle (fit.ts) and clips everything the library puts in it.
import type { ActionContext } from "@world/desktop/controller";
import { BACKDROPS, fitStage, type Fit } from "@world/fit";
import { viewMoveMs } from "@world/motion/timing";
import { centre, DESK_SHOT, ROOM_SHOT, type Rect } from "@world/room/shots";
import { deskLayout } from "@world/room/desk";
import { framingOf, formatCalibration, nudge } from "./calibrate";
import type { Framing } from "./calibration";
import { splatMoveFor } from "./moves";
import { easeInOutCubic, POSES, poseAt, type CameraMove, type Pose, type PoseId } from "./pose";
import { LOOK, NO_TURN, turnEased, turnForDrag, turned, type Turn } from "./head";
import { splatLook, type SplatLook } from "./look";
import { pullMove, pullOutAt } from "./pullout";
import type { Session } from "@world/desktop/model";

/** The arriving photo fades in over the move's last 200 ms. */
export const SPLAT_FADE_MS = 200;
/** In calibration, the photo sits at 50 % over the splat. */
export const CAL_PHOTO_OPACITY = 0.5;
/** If the motion layer never gives the photo back, the layer leaves anyway this long after the move. */
const SAFETY_MS = 500;
/** The stage the layer covers (the room stage). */
export const SPLAT_STAGE = { w: 1600, h: 900 } as const;

/** What ./scene provides (and tests fake). */
export interface SplatScene {
  /**
   * The element the viewers live in (their `rootElement`): it holds both canvases, and anything
   * else the library adds stays inside the clipped layer.
   */
  readonly host: HTMLElement;
  /** [clean, collapsed]: inside `host`; the collapsed one draws nothing until loaded. */
  readonly canvases: readonly [HTMLCanvasElement, HTMLCanvasElement];
  /** Loads room_collapsed.splat (once); resolves when it can be drawn. */
  ensureCollapsed(): Promise<void>;
  setSize(cssW: number, cssH: number, pixelRatio: number): void;
  /** One frame of both scenes at this pose (and its fov); the collapsed one only if loaded and mix > 0. */
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
  /** `?splatcal=1` in dev: still poses with the photo at 50 % and the calibration keys. */
  readonly calibrate?: boolean;
  /** Which view changes it renders (default `splatMoveFor`; tests drive the machinery with others). */
  readonly moves?: (from: string, to: string) => CameraMove | null;
  /** Where the calibration table is printed (console in the game). */
  readonly print?: (text: string) => void;
}

export interface SplatHooks {
  after(): void;
  destroy(): void;
  /**
   * Turn the head by a drag of (dx, dy) stage px from the framing (navigation 2026-11-01): the layer
   * goes live over the photo. False if it cannot (not loaded, a move under way, the view has no pose).
   */
  look(dx: number, dy: number): boolean;
  /** Let go: the head eases back over 600 ms and the photo returns. */
  release(): void;
  /** The camera as drawn now (the framing turned), or null while the layer is not drawing: the photo's pose then. */
  pose(): Pose | null;
  /** For tests and the later pull-out: "idle" | "loading" | "ready" | "off". */
  status(): string;
  /** Calibration: the poses as currently tuned (dev only). */
  calibration(): Readonly<Record<PoseId, Framing>>;
}

/** The gap rect at night, per framing (bed has none yet). */
const GAP: Readonly<Record<string, Rect>> = { room: ROOM_SHOT.gap, desk: DESK_SHOT.gap };
/** Provisional: the desk lamp's corner, top right of the desk, per framing (S8). */
const LAMP: Readonly<Record<string, { x: number; y: number }>> = { room: { x: 960, y: 300 }, desk: centre(deskLayout.lamp) };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function lerpRect(a: Rect | undefined, b: Rect | undefined, t: number): Rect | null {
  if (!a || !b) return a ?? b ?? null;
  return { l: lerp(a.l, b.l, t), t: lerp(a.t, b.t, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) };
}

/** The layer's box in the window: the stage rectangle (S12). Pure. */
export function splatBox(winW: number, winH: number): Fit & { readonly width: number; readonly height: number } {
  const fit = fitStage(winW, winH, SPLAT_STAGE.w, SPLAT_STAGE.h);
  return { ...fit, width: SPLAT_STAGE.w * fit.scale, height: SPLAT_STAGE.h * fit.scale };
}

interface Running {
  readonly from: string;
  readonly to: string;
  readonly move: CameraMove;
  readonly look: SplatLook;
  readonly start: number;
  readonly dur: number;
  /** A scripted move (the day-18 pull-out): its own timeline; ends when the session drops it. */
  readonly pull?: { readonly ref: object; readonly pose: (elapsed: number) => Pose };
}

const isPosed = (view: string): view is PoseId => view in POSES;

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
    const print = deps.print ?? ((text: string) => console.info(text));

    let status: "idle" | "loading" | "ready" | "off" = "idle";
    let scene: SplatScene | null = null;
    let collapsed: "no" | "loading" | "yes" = "no";
    let lastView: string | null = null;
    let running: Running | null = null;
    let frame = 0;
    let el: HTMLElement | null = null;
    let destroyed = false;
    // Calibration (dev only): the poses being tuned, and the readout.
    const cal: Record<PoseId, Pose> = { ...POSES };
    let readout: HTMLElement | null = null;
    // The head turn, and 床 held at rest (the splat is its picture).
    let liveView: PoseId | null = null;
    let hold = false;
    let turn: Turn = NO_TURN;
    let dragging = false;
    let easeFrom: Turn | null = null;
    let easeStart = 0;
    let liveStart = 0;
    let outStart: number | null = null;

    const load = () => {
      if (status !== "idle" || destroyed) return;
      status = "loading";
      deps
        .load(doc)
        .then((s) => {
          if (destroyed) return s.dispose();
          scene = s;
          status = "ready";
          ctx.session.splatReady = true;
          preloadCollapsed();
          if (deps.calibrate) startCalibration();
        })
        .catch(() => {
          status = "off";
          ctx.session.splatReady = false;
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

    /** The persistent element: the library's host (canvases), night layers, vignette, the arriving photo. */
    function build(s: SplatScene): HTMLElement {
      const box = doc.createElement("div");
      box.className = "splat-layer";
      box.setAttribute("aria-hidden", "true");
      s.host.classList.add("splat-host");
      s.canvases[0].classList.add("splat-clean");
      s.canvases[1].classList.add("splat-collapsed");
      box.appendChild(s.host);
      for (const cls of ["splat-night", "splat-lamp", "splat-gap", "splat-vignette", "splat-photo"]) {
        const d = doc.createElement("div");
        d.className = cls;
        box.appendChild(d);
      }
      return box;
    }

    const liveStage = (): HTMLElement | null => root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)");

    /** The stage rectangle from fit.ts; the box clips to it, so nothing is drawn in the letterbox. */
    function place(stage: HTMLElement): void {
      if (!el) return;
      const b = splatBox(root.clientWidth, root.clientHeight);
      Object.assign(el.style, {
        left: `${b.left}px`,
        top: `${b.top}px`,
        width: `${SPLAT_STAGE.w}px`,
        height: `${SPLAT_STAGE.h}px`,
        transform: `scale(${b.scale})`,
      });
      // The library may have moved its canvases: keep them in the host, in the box.
      if (scene && scene.host.parentElement !== el) el.insertBefore(scene.host, el.firstChild);
      if (el.nextElementSibling !== stage) root.insertBefore(el, stage);
    }

    const part = (sel: string) => el!.querySelector<HTMLElement>(sel)!;

    function paintLayers(from: string, to: string, look: SplatLook, e: number): void {
      const gap = look.gap === "none" ? null : lerpRect(GAP[from], GAP[to], e);
      const g = part(".splat-gap");
      g.hidden = !gap;
      if (gap) Object.assign(g.style, { left: `${gap.l}px`, top: `${gap.t}px`, width: `${gap.w}px`, height: `${gap.h}px` });
      const la = LAMP[from];
      const lb = LAMP[to];
      const lamp = part(".splat-lamp");
      lamp.hidden = !look.night || !la || !lb;
      if (la && lb) Object.assign(lamp.style, { left: `${lerp(la.x, lb.x, e)}px`, top: `${lerp(la.y, lb.y, e)}px` });
    }

    function paint(r: Running, t: number): void {
      if (!scene || !el) return;
      const elapsed = t - r.start;
      const p = Math.min(1, elapsed / r.dur);
      scene.render(r.pull ? r.pull.pose(elapsed) : poseAt(r.move, p), r.look.mix);
      part(".splat-collapsed").style.opacity = String(collapsed === "yes" ? r.look.mix : 0);
      // The pull-out has no photo to arrive at: the ending card follows.
      // 床 has no photo to arrive at: the splat is its picture.
      part(".splat-photo").style.opacity = r.pull || r.to === "bed" ? "0" : String(Math.min(1, Math.max(0, (elapsed - (r.dur - SPLAT_FADE_MS)) / SPLAT_FADE_MS)));
      // The gap and lamp layers are framed for the stills; the pull-out leaves them behind.
      if (r.pull) {
        part(".splat-gap").hidden = true;
        part(".splat-lamp").hidden = true;
      } else paintLayers(r.from, r.to, r.look, easeInOutCubic(p));
    }

    function tick(): void {
      frame = 0;
      if (destroyed) return;
      if (deps.calibrate && !running) return calTick();
      const r = running;
      if (!r) return liveTick();
      const t = now();
      const stage = liveStage();
      if (stage) place(stage);
      paint(r, t);
      if (r.pull) {
        // Until the flow drops the pull-out (its cut), when the ending card replaces the page.
        if (ctx.session.pullOut !== r.pull.ref || t - r.start >= r.dur + SAFETY_MS) return finish();
        frame = raf(tick);
        return;
      }
      // Stay until the stage has its own photo back (no gap), or the safety time.
      const done = t - r.start >= r.dur && (!stage || !stage.classList.contains("m-nobg"));
      if (done || t - r.start >= r.dur + SAFETY_MS) return finish();
      frame = raf(tick);
    }

    function finish(): void {
      if (running?.pull) root.classList.remove("splat-pull");
      running = null;
      if (frame) cancelRaf(frame);
      frame = 0;
      if (deps.calibrate) {
        frame = raf(tick);
        return;
      }
      // 床: the move ends in the framing and the splat stays as its picture.
      if (ctx.session.view === "bed" && scene) return enterLive("bed", true, liveStage());
      el?.remove();
    }

    // ——— the head turn, and 床 held at rest ———

    const LIVE_IN_MS = 150;

    /** Only where a pose exists, nothing is moving, and the collapsed splat is there when the ring wants it. */
    function canLive(view: string): view is PoseId {
      return status === "ready" && !!scene && !running && !ctx.session.pullOut && isPosed(view) && !(lookNow().mix > 0 && collapsed !== "yes");
    }

    function enterLive(view: PoseId, holdIt: boolean, stage: HTMLElement | null): void {
      if (!scene) return;
      el ??= build(scene);
      const look = lookNow();
      el.classList.toggle("night", look.night);
      el.classList.toggle("pink", look.gap === "pink");
      // The gap and the lamp are framed for the stills.
      part(".splat-gap").hidden = true;
      part(".splat-lamp").hidden = true;
      part(".splat-photo").style.backgroundImage = holdIt ? "none" : `url(${BACKDROPS[view as keyof typeof BACKDROPS] ?? BACKDROPS.room})`;
      sizeTo();
      liveView = view;
      hold = holdIt;
      liveStart = now();
      outStart = null;
      if (stage) {
        place(stage);
        stage.classList.add("m-nobg");
      }
      if (!frame) frame = raf(tick);
    }

    function liveTick(): void {
      if (!liveView || !scene || !el) return;
      const t = now();
      const stage = liveStage();
      if (stage) {
        place(stage);
        stage.classList.add("m-nobg");
      }
      if (easeFrom) {
        const p = (t - easeStart) / LOOK.easeMs;
        if (p >= 1) {
          turn = NO_TURN;
          easeFrom = null;
          if (!hold) outStart = t;
        } else turn = turnEased(easeFrom, p);
      }
      const look = lookNow();
      scene.render(turned(POSES[liveView], turn), look.mix);
      part(".splat-collapsed").style.opacity = String(collapsed === "yes" ? look.mix : 0);
      // The photo gives way as the head starts to turn and comes back as it settles.
      let photo = 0;
      if (!hold) photo = outStart !== null ? Math.min(1, (t - outStart) / SPLAT_FADE_MS) : 1 - Math.min(1, (t - liveStart) / LIVE_IN_MS);
      part(".splat-photo").style.opacity = String(photo);
      if (outStart !== null && t - outStart >= SPLAT_FADE_MS) return endLive(true);
      frame = raf(tick);
    }

    /** `restore`: give the stage its own photo back (not when the stage is the arriving one of a move). */
    function endLive(restore: boolean): void {
      if (restore) liveStage()?.classList.remove("m-nobg");
      liveView = null;
      hold = false;
      turn = NO_TURN;
      easeFrom = null;
      dragging = false;
      outStart = null;
      if (frame) cancelRaf(frame);
      frame = 0;
      if (!deps.calibrate) el?.remove();
    }

    function sizeTo(): void {
      const b = splatBox(root.clientWidth, root.clientHeight);
      scene?.setSize(SPLAT_STAGE.w, SPLAT_STAGE.h, b.scale * pixelRatio());
    }

    function start(from: string, to: string, move: CameraMove, stage: HTMLElement): void {
      if (!scene) return;
      el ??= build(scene);
      const look = lookNow();
      el.classList.toggle("night", look.night);
      el.classList.toggle("pink", look.gap === "pink");
      part(".splat-photo").style.backgroundImage = to === "bed" ? "none" : `url(${BACKDROPS[to as keyof typeof BACKDROPS] ?? BACKDROPS.room})`;
      sizeTo();
      running = { from, to, move, look, start: now(), dur: viewMoveMs(from, to, true) };
      place(stage);
      paint(running, running.start);
      if (frame) cancelRaf(frame);
      frame = raf(tick);
    }

    /**
     * The pull-out over the splat. It joins only if it can from the first frame; a pull-out
     * already under way (the splat became ready mid-way) stays with the photo fallback.
     */
    function startPull(pull: NonNullable<Session["pullOut"]>, stage: HTMLElement): void {
      if (!scene || now() - toLayerClock(pull.startMs) > 100) return;
      el ??= build(scene);
      // Night 18: the night wash stays over the splat; the gap and lamp are framed for the stills.
      const look = { ...lookNow(), night: true };
      el.classList.toggle("night", true);
      el.classList.toggle("pink", false);
      sizeTo();
      const move = pullMove(pull.from);
      running = { from: pull.from, to: pull.from, move, look, start: toLayerClock(pull.startMs), dur: pull.cutMs, pull: { ref: pull, pose: (ms) => pullOutAt(ms, pull.from).camera } };
      root.classList.add("splat-pull");
      place(stage);
      paint(running, now());
      if (frame) cancelRaf(frame);
      frame = raf(tick);
    }

    /** The flow stamps the pull-out with the game's wall clock; the layer runs on its own (performance.now). */
    const toLayerClock = (wallMs: number): number => now() - ((ctx.now?.() ?? Date.now()) - wallMs);

    // ——— calibration (dev only, `?splatcal=1`) ———

    function startCalibration(): void {
      if (!scene) return;
      el ??= build(scene);
      root.classList.add("splat-cal");
      readout = doc.createElement("pre");
      readout.className = "splat-cal-readout";
      sizeTo();
      win?.addEventListener("keydown", onCalKey, true);
      if (!frame) frame = raf(tick);
    }

    function calTick(): void {
      const view = ctx.session.view;
      const stage = liveStage();
      if (stage && isPosed(view) && el) {
        place(stage);
        const look = lookNow();
        el.classList.toggle("night", look.night);
        el.classList.toggle("pink", look.gap === "pink");
        part(".splat-photo").style.backgroundImage = `url(${BACKDROPS[view as keyof typeof BACKDROPS] ?? BACKDROPS.room})`;
        part(".splat-photo").style.opacity = String(CAL_PHOTO_OPACITY);
        part(".splat-collapsed").style.opacity = "0";
        scene?.render(cal[view], 0);
        paintLayers(view, view, look, 1);
        if (readout) {
          readout.textContent = `${view}\n${formatCalibration({ [view]: framingOf(cal[view]) })}`;
          if (readout.parentElement !== root) root.appendChild(readout);
        }
      } else {
        el?.remove();
      }
      frame = raf(tick);
    }

    function onCalKey(e: KeyboardEvent): void {
      const view = ctx.session.view;
      if (!isPosed(view) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") {
        print(formatCalibration(Object.fromEntries(Object.entries(cal).map(([id, p]) => [id, framingOf(p)]))));
      } else {
        const next = nudge(cal[view], e.key, e.shiftKey);
        if (!next) return;
        cal[view] = next;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    return {
      status: () => status,
      calibration: () => Object.fromEntries(Object.entries(cal).map(([id, p]) => [id, framingOf(p)])) as Record<PoseId, Framing>,
      after() {
        if (destroyed) return;
        const view = ctx.session.view;
        const prev = lastView;
        lastView = view;
        if (prev === null) return idle(load);
        const stage = liveStage();
        // The day-18 pull-out: a scripted move, clamp bypassed (room-scene addition 2026-11-01).
        const pull = ctx.session.pullOut;
        if (running?.pull) {
          if (stage) place(stage);
          if (pull === running.pull.ref) return;
          finish();
        }
        if (pull) {
          if (status === "ready" && stage && !(lookNow().mix > 0 && collapsed !== "yes")) startPull(pull, stage);
          return;
        }
        if (liveView) {
          // Still the same framing: the new stage goes over the layer again. Otherwise the view
          // changed under it (a move from 床 follows; a day change just ends it).
          if (view === liveView) {
            if (stage) {
              place(stage);
              stage.classList.add("m-nobg");
            }
            return;
          }
          endLive(false);
        }
        if (running) {
          // A re-render mid-move replaced the markup: put the layer back before the new stage.
          if (stage) place(stage);
          if (view === running.to) return;
          finish();
        }
        if (deps.calibrate && stage) place(stage);
        preloadCollapsed();
        if (view === prev || status !== "ready" || !stage) return;
        const move = (deps.moves ?? splatMoveFor)(prev, view);
        // Only while the motion layer holds the arriving photo back (m-nobg): that's the CSS push
        // this replaces, and its backdrop copy stays underneath as the fallback.
        if (!move || !stage.classList.contains("m-nobg")) return;
        if (lookNow().mix > 0 && collapsed !== "yes") return;
        start(prev, view, deps.calibrate ? { from: cal[prev as PoseId], to: cal[view as PoseId] } : move, stage);
      },
      look(dx, dy) {
        if (!liveView) {
          const view = ctx.session.view;
          const stage = liveStage();
          if (!stage || !canLive(view)) return false;
          enterLive(view, view === "bed", stage);
        }
        // Back from the way out: the photo stays away.
        if (outStart !== null) {
          liveStart = now() - LIVE_IN_MS;
          outStart = null;
        }
        dragging = true;
        easeFrom = null;
        turn = turnForDrag(dx, dy);
        if (!frame) frame = raf(tick);
        return true;
      },
      release() {
        if (!liveView || !dragging) return;
        dragging = false;
        if (turn.yaw === 0 && turn.pitch === 0) {
          if (!hold) outStart = now();
        } else {
          easeFrom = turn;
          easeStart = now();
        }
        if (!frame) frame = raf(tick);
      },
      pose: () => (liveView ? turned(POSES[liveView], turn) : null),
      destroy() {
        ctx.session.splatReady = false;
        destroyed = true;
        running = null;
        if (frame) cancelRaf(frame);
        frame = 0;
        el?.remove();
        readout?.remove();
        root.classList.remove("splat-cal");
        win?.removeEventListener("keydown", onCalKey, true);
        scene?.dispose();
        scene = null;
      },
    };
  };
}
