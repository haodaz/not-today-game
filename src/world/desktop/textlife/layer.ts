// The screen's own collapse, drawn (plan.ts says what and where): one canvas over the monitor's
// `.os`, never taking a click. The creatures are made of the characters that are on the screen at
// that moment (the front window's own text), in the screen's own ink. The window under them is
// untouched: no fade, no blur.
//
// The controller's dep: `(root, ctx) => { after, destroy }`. The canvas is one element kept across
// renders (the game redraws its markup; `after` puts the canvas back on the new `.os`), and the
// creatures' places are functions of a clock, so a re-render never restarts them.
import { hash } from "@state/seed";
import type { ActionContext } from "@world/desktop/controller";
import { glyphsFrom, lifeGlyphs, lifePlan, NO_LIFE, SCREEN_H, SCREEN_W, type LifePlan } from "./plan";

export interface TextLifeDeps {
  readonly reducedMotion?: () => boolean;
  readonly raf?: (fn: (ms: number) => void) => number;
  readonly caf?: (id: number) => void;
  readonly hidden?: () => boolean;
}

type Hook = { after(): void; destroy(): void };
/** Frames a second: a slow thing, drawn cheaply. */
const FPS = 24;
const FONT = `-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

/** Off with `?fx=0` (the dev switch the photo effects use; the headless walk passes it). */
export function textLifeEnabled(search: string): boolean {
  return new URLSearchParams(search).get("fx") !== "0";
}

export function createTextLife(deps: TextLifeDeps = {}): (root: HTMLElement, ctx: ActionContext) => Hook {
  return (root, ctx) => {
    const doc = root.ownerDocument;
    const win = doc.defaultView!;
    const raf = deps.raf ?? ((fn) => win.requestAnimationFrame(fn));
    const caf = deps.caf ?? ((id) => win.cancelAnimationFrame(id));
    const isHidden = deps.hidden ?? (() => doc.hidden);
    const reducedNow = deps.reducedMotion ?? (() => !!win.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
    const on = textLifeEnabled(win.location.search);

    let canvas: HTMLCanvasElement | null = null;
    let g: CanvasRenderingContext2D | null = null;
    let plan: LifePlan = NO_LIFE;
    let glyphs: string[] = [];
    let seed = 0;
    let rafId = 0;
    let clock = 0;
    let last = 0;

    function draw(): void {
      if (!g || !canvas) return;
      g.clearRect(0, 0, SCREEN_W, SCREEN_H);
      if (plan.strength === 0 || glyphs.length === 0) return;
      g.fillStyle = plan.ink;
      g.textAlign = "center";
      g.textBaseline = "middle";
      let size = -1;
      for (const c of lifeGlyphs(plan, clock, seed)) {
        if (c.x < -30 || c.x > SCREEN_W + 30 || c.y < -30 || c.y > SCREEN_H + 30) continue;
        const px = Math.round(c.size);
        if (px !== size) { size = px; g.font = `600 ${String(px)}px ${FONT}`; }
        g.globalAlpha = Math.min(1, c.a * plan.strength);
        const ch = glyphs[((c.k % glyphs.length) + glyphs.length) % glyphs.length]!;
        if (c.rot === 0) g.fillText(ch, c.x, c.y);
        else { g.save(); g.translate(c.x, c.y); g.rotate(c.rot + Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
      }
      g.globalAlpha = 1;
    }

    function tick(ms: number): void {
      rafId = raf(tick);
      if (isHidden()) { last = 0; return; }
      if (last && ms - last < 1000 / FPS - 1) return;
      clock += last ? Math.min(0.1, (ms - last) / 1000) : 0;
      last = ms;
      draw();
    }
    function stop(): void {
      if (rafId) caf(rafId);
      rafId = 0;
    }

    function after(): void {
      const os = on ? root.querySelector<HTMLElement>(".monitor .os") : null;
      const state = ctx.store.getState();
      plan = os ? lifePlan(state.day) : NO_LIFE;
      if (!os || plan.strength === 0) {
        stop();
        canvas?.remove();
        return;
      }
      if (!canvas) {
        canvas = doc.createElement("canvas");
        canvas.className = "textlife";
        canvas.width = SCREEN_W;
        canvas.height = SCREEN_H;
        canvas.setAttribute("aria-hidden", "true");
        g = canvas.getContext("2d");
      }
      if (!g) return;
      if (canvas.parentElement !== os) os.appendChild(canvas);
      // its flesh is the text that is on the screen now: the front window's own words
      const front = os.querySelector<HTMLElement>(".win:last-of-type") ?? os;
      glyphs = glyphsFrom(front.textContent ?? "");
      seed = hash(`${ctx.store.getRunId?.() ?? "run"}|${String(state.day)}`) % 9973;
      if (reducedNow()) {
        // no movement: one still moment of the day's creatures
        stop();
        clock = 26;
        draw();
        return;
      }
      if (!rafId) { last = 0; rafId = raf(tick); }
    }

    return {
      after,
      destroy() {
        stop();
        canvas?.remove();
        canvas = null;
        g = null;
      },
    };
  };
}

/** The game's layer. */
export const textLifeForGame = (): ((root: HTMLElement, ctx: ActionContext) => Hook) => createTextLife();
