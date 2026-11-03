// Puts a program's frame on its canvas: whole pixels, never smoothed (the old things), or the smooth
// new-world screen for an upgraded object. The dictionary's cells are drawn here: ASCII by the 5 × 7
// glyphs, CJK by rasterising the system font at 12 px to 1 bit (no font files, nothing shipped).
import { Bits, drawDot, finer, cellWidth, type Frame } from "./frame";

/** The ink and the backlight of each old screen (colour depth: one bit). */
export const INK: Readonly<Record<string, string>> = { chick: "20,32,22", pager: "26,34,30", calculator: "28,30,34", dictionary: "34,44,36" };
const DEFAULT_INK = "20,24,22";
export const BACKLIGHT = "rgba(196,236,170,.55)";
/** The dictionary's half-width cell. */
const CW = 6;
const CH = 12;

type Raster = (ch: string) => Uint8Array | null;

/** 12 × 12 one-bit raster of a CJK character from the system font, or null without a canvas. */
export function systemRaster(doc: Document): Raster {
  const cache = new Map<string, Uint8Array | null>();
  return (ch) => {
    if (cache.has(ch)) return cache.get(ch)!;
    let out: Uint8Array | null = null;
    try {
      const c = doc.createElement("canvas");
      c.width = CH;
      c.height = CH;
      const g = c.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
      if (g) {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, CH, CH);
        g.fillStyle = "#000";
        g.font = `${CH}px "PingFang SC","Hiragino Sans GB","Noto Sans CJK SC","Microsoft YaHei",sans-serif`;
        g.textBaseline = "top";
        g.fillText(ch, 0, 0);
        const d = g.getImageData(0, 0, CH, CH).data;
        out = new Uint8Array(CH * CH);
        for (let i = 0; i < out.length; i++) out[i] = d[i * 4]! < 128 ? 1 : 0;
      }
    } catch {
      out = null;
    }
    cache.set(ch, out);
    return out;
  };
}

/** The dictionary's two rows as one-bit pixels (base size 16 cells × 6, 2 rows × 12, a 1 px gap), at its dream level. */
export function cellsToBits(rows: readonly string[], cols: number, level: number, raster: Raster): { w: number; h: number; bits: Uint8Array } {
  const b = new Bits(cols * CW, rows.length * CH + (rows.length - 1));
  rows.forEach((row, r) => {
    let x = 0;
    const y = r * (CH + 1);
    for (const ch of row) {
      const wide = cellWidth(ch) === 2;
      if (x + (wide ? 2 : 1) > cols) break;
      if (wide) {
        const bits = raster(ch);
        if (bits) for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) if (bits[j * CH + i]) b.set(x * CW + i, y + j);
      } else drawDot(b, x * CW, y + 2, ch);
      x += wide ? 2 : 1;
    }
  });
  return finer(b, level);
}

export interface PaintTarget {
  readonly width: number;
  readonly height: number;
  getContext(kind: "2d"): CanvasRenderingContext2D | null;
}

/** A ghost underlay for the drawn device's normal screen: the unlit pixels at 7.5 % ink, with the gap. */
export interface PaintOptions {
  readonly ghost?: { readonly w: number; readonly h: number; readonly bits: Uint8Array };
}

export function paintFrame(canvas: PaintTarget, frame: Frame, object: string, raster: Raster, opts: PaintOptions = {}): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  if (frame.kind === "none") return;
  // The drawn device's normal screen (使用): every pixel a square with a 1 px gap; the ghost shows
  // the unlit channel at 7.5 % ink under the lit frame. Integer scale, never smoothed.
  if (opts.ghost && (frame.kind === "pixels" || frame.kind === "cells")) {
    g.imageSmoothingEnabled = false;
    const px = frame.kind === "cells" ? cellsToBits(frame.rows, frame.cols, frame.level, raster) : frame;
    const ghost = opts.ghost;
    // The backing is the channel × 16, so a level-n frame (channel × 2ⁿ) scales by 16 / 2ⁿ. The
    // frame keeps the channel's aspect, so it is centred in the backing (letterbox) with no overflow.
    const scale = Math.max(1, Math.floor(Math.min(width / px.w, height / px.h)));
    const offX = Math.round((width - scale * px.w) / 2);
    const offY = Math.round((height - scale * px.h) / 2);
    const inkRgb = INK[object] ?? DEFAULT_INK;
    const ink = frame.kind === "pixels" ? (frame.ink ?? 1) : 1;
    // Each pixel a square `scale − gap`, `gap = max(1, round(scale / 5))` (thin dots: "你会觉得它瘦了").
    const gap = Math.max(1, Math.round(scale / 5));
    const cell = Math.max(1, scale - gap);
    // The ghost first (every ghost pixel the frame does not light), then the lit frame over it.
    if (ghost.w === px.w && ghost.h === px.h) {
      g.fillStyle = `rgba(${inkRgb},0.075)`;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (ghost.bits[y * px.w + x] && !px.bits[y * px.w + x]) g.fillRect(offX + x * scale, offY + y * scale, cell, cell);
    }
    if (ink > 0) {
      g.fillStyle = `rgba(${inkRgb},${ink})`;
      for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.bits[y * px.w + x]) g.fillRect(offX + x * scale, offY + y * scale, cell, cell);
    }
    return;
  }
  if (frame.kind === "hi") {
    // The new world: smooth, colour, it does it for you.
    g.imageSmoothingEnabled = true;
    if (frame.picture) {
      const p = frame.picture;
      const off = new OffscreenCanvasLike(p.w, p.h);
      for (let i = 0; i < p.bits.length; i++) if (p.bits[i]) off.dot(i % p.w, Math.floor(i / p.w));
      off.draw(g, width, height);
    }
    const lines = frame.lines;
    if (lines.length) {
      const size = Math.max(10, Math.floor(height / 3.2));
      g.font = `${size}px "PingFang SC","Hiragino Sans GB",sans-serif`;
      g.fillStyle = "#2c3a66";
      g.textBaseline = "top";
      const first = frame.scroll ?? 0;
      for (let i = 0; i < 3 && i < lines.length; i++) g.fillText(lines[(first + i) % lines.length]!, size * 0.4, size * 0.2 + i * size * 1.05, width - size * 0.8);
    }
    return;
  }
  g.imageSmoothingEnabled = false;
  const px = frame.kind === "cells" ? cellsToBits(frame.rows, frame.cols, frame.level, raster) : frame;
  if (frame.kind === "pixels" && frame.lit) {
    g.fillStyle = BACKLIGHT;
    g.fillRect(0, 0, width, height);
  }
  const ink = frame.kind === "pixels" ? (frame.ink ?? 1) : 1;
  if (ink <= 0) return;
  g.fillStyle = `rgba(${INK[object] ?? DEFAULT_INK},${ink})`;
  // One canvas pixel per frame pixel: the canvas's backing store is the channel at its level.
  const sx = width / px.w;
  const sy = height / px.h;
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.bits[y * px.w + x]) g.fillRect(Math.round(x * sx), Math.round(y * sy), Math.max(1, Math.round(sx)), Math.max(1, Math.round(sy)));
}

/** A colour picture of a one-bit frame, drawn smooth (the upgraded chick: yellow, soft). */
class OffscreenCanvasLike {
  private readonly dots: [number, number][] = [];
  constructor(
    private readonly w: number,
    private readonly h: number,
  ) {}
  dot(x: number, y: number): void {
    this.dots.push([x, y]);
  }
  draw(g: CanvasRenderingContext2D, width: number, height: number): void {
    const sx = width / this.w;
    const sy = height / this.h;
    g.fillStyle = "#f2c94c";
    for (const [x, y] of this.dots) {
      g.beginPath();
      g.arc((x + 0.5) * sx, (y + 0.5) * sy, Math.max(sx, sy) * 0.75, 0, Math.PI * 2);
      g.fill();
    }
  }
}
