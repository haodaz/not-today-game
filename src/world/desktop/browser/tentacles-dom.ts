// The text tentacles' drawing (late-days FR5). One rAF loop for the browser window's canvas: it
// draws the page's own characters along each tentacle's curve, skips the headline, and stops when
// the canvas is not on screen (the browser is not shown) or the document is hidden; it resumes on
// the next render or when the document is visible again. Its clock lives here, so a re-render
// continues the drift. No 2D context (tests, happy-dom): nothing is drawn.
import { bezier, coversHeadline, passMsOf, sampleGlyphs, tentacleCurve, visibleSpan, type Rect } from "./tentacles";

const GLYPH_PX = 11;
/** Rows across a tentacle at its thickest; it tapers to one at the tip. */
const ROWS = 3;

export interface TentacleDriver {
  after(root: ParentNode): void;
  destroy(): void;
}

export function createTentacleDriver(win: Window): TentacleDriver {
  const doc = win.document;
  const start = win.performance.now();
  let frame = 0;
  let canvas: HTMLCanvasElement | null = null;
  let glyphs: string[] = [];

  const tick = (now: number) => {
    frame = 0;
    if (!canvas || !canvas.isConnected || doc.hidden) return;
    draw(canvas, now - start);
    loop();
  };
  const loop = () => {
    if (!frame) frame = win.requestAnimationFrame(tick);
  };
  const onVisible = () => {
    if (!doc.hidden) loop();
  };
  doc.addEventListener("visibilitychange", onVisible);

  function headlineOf(c: HTMLCanvasElement): Rect | null {
    const h = c.parentElement?.querySelector<HTMLElement>(".lead h2");
    if (!h) return null;
    const a = c.getBoundingClientRect();
    const b = h.getBoundingClientRect();
    const k = a.width ? c.clientWidth / a.width : 1;
    return { l: (b.left - a.left) * k, t: (b.top - a.top) * k, w: b.width * k, h: b.height * k };
  }

  function draw(c: HTMLCanvasElement, elapsed: number): void {
    const g = c.getContext("2d");
    if (!g || !glyphs.length) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== w) c.width = w;
    if (c.height !== h) c.height = h;
    const opacity = Number(c.dataset.opacity) || 0;
    const count = Number(c.dataset.tentacles) || 0;
    const headline = headlineOf(c);
    g.clearRect(0, 0, w, h);
    g.font = `${GLYPH_PX}px Menlo, monospace`;
    g.fillStyle = `rgba(29,33,41,${opacity})`;
    for (let i = 0; i < count; i++) {
      const pass = passMsOf(i);
      const phase = ((elapsed / pass) + i * 0.37) % 1;
      const [u0, u1] = visibleSpan(phase);
      if (u1 <= u0) continue;
      const curve = tentacleCurve(i, w, h);
      const chord = Math.hypot(curve[3].x - curve[0].x, curve[3].y - curve[0].y);
      const n = Math.floor(((u1 - u0) * chord * 1.15) / GLYPH_PX);
      for (let k = 0; k < n; k++) {
        const u = u0 + ((u1 - u0) * k) / Math.max(1, n);
        const p = bezier(curve, u);
        const q = bezier(curve, Math.min(1, u + 0.002));
        const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        // The normal, for the tentacle's thickness; it tapers towards the leading tip.
        const nx = -(q.y - p.y) / len;
        const ny = (q.x - p.x) / len;
        const rows = Math.max(1, Math.round(ROWS * (1 - (u - u0) / (u1 - u0))));
        for (let r = 0; r < rows; r++) {
          const off = (r - (rows - 1) / 2) * GLYPH_PX;
          const at = { x: p.x + nx * off, y: p.y + ny * off };
          if (coversHeadline(at, headline)) continue;
          g.fillText(glyphs[(i * 613 + k * ROWS + r) % glyphs.length]!, at.x, at.y);
        }
      }
    }
  }

  return {
    after(root) {
      const c = root.querySelector<HTMLCanvasElement>("canvas.br-tentacles");
      canvas = c;
      if (!c) return;
      // The page's own text, in reading order (the canvas itself and an open page aside).
      const site = c.parentElement?.querySelector<HTMLElement>(".site");
      const text = site ? [...site.childNodes].filter((n) => !(n instanceof HTMLElement && n.classList.contains("br-page"))).map((n) => n.textContent ?? "").join("") : "";
      glyphs = sampleGlyphs(text, Number(c.dataset.glyphs) || undefined);
      loop();
    },
    destroy() {
      if (frame) win.cancelAnimationFrame(frame);
      frame = 0;
      canvas = null;
      doc.removeEventListener("visibilitychange", onVisible);
    },
  };
}
