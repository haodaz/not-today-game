// Text tentacles in the browser (late-days FR5): shapes made of the page's own characters, drifting
// in from the edges, across, and out again. Pure parameters, sampler and curve; the drawing is
// browser/tentacles-dom.ts. Only the browser (the outside world), from ring wall on.

export interface TentacleParams {
  readonly ring: string;
  readonly opacity: number;
  readonly tentacles: number;
  /** Glyphs sampled from the page (a few thousand). */
  readonly glyphs: number;
  /** One pass across the page takes this long, per tentacle (seeded). */
  readonly passMs: readonly [number, number];
}

/** Opacity and how many by ring (FR5: wall .08, room .18, door .3). */
const BY_RING: Readonly<Record<string, { opacity: number; tentacles: number }>> = {
  wall: { opacity: 0.08, tentacles: 2 },
  room: { opacity: 0.18, tentacles: 3 },
  door: { opacity: 0.3, tentacles: 5 },
};

export const GLYPHS = 2400;
export const PASS_MS: readonly [number, number] = [8000, 20000];

/** The overlay's parameters for a ring, or null where it has none. */
export function tentacleParams(ring: string | null): TentacleParams | null {
  const r = ring ? BY_RING[ring] : undefined;
  return r && ring ? { ring, opacity: r.opacity, tentacles: r.tentacles, glyphs: GLYPHS, passMs: PASS_MS } : null;
}

/** The page's characters in reading order, whitespace dropped, cycled to `n` (none if there is no text). */
export function sampleGlyphs(text: string, n: number = GLYPHS): string[] {
  const chars = [...text].filter((ch) => !/\s/.test(ch));
  if (!chars.length) return [];
  return Array.from({ length: n }, (_, i) => chars[i % chars.length]!);
}

/** A small seeded random in [0, 1). */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** How long tentacle `i`'s pass takes (8–20 s, seeded). */
export function passMsOf(i: number, range: readonly [number, number] = PASS_MS): number {
  return Math.round(range[0] + rand(i + 1) * (range[1] - range[0]));
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Tentacle `i`'s curve: a cubic from off one edge, across the page, off the opposite edge. */
export function tentacleCurve(i: number, w: number, h: number): readonly [Point, Point, Point, Point] {
  const fromLeft = i % 2 === 0;
  const y0 = h * (0.2 + 0.6 * rand(i * 3 + 1));
  const y3 = h * (0.2 + 0.6 * rand(i * 3 + 2));
  const bend = h * (0.35 * (rand(i * 3 + 3) - 0.5));
  const x0 = fromLeft ? -0.1 * w : 1.1 * w;
  const x3 = fromLeft ? 1.1 * w : -0.1 * w;
  return [
    { x: x0, y: y0 },
    { x: x0 + (x3 - x0) / 3, y: y0 + bend },
    { x: x0 + (2 * (x3 - x0)) / 3, y: y3 - bend },
    { x: x3, y: y3 },
  ];
}

/** The point at u ∈ [0, 1] along a cubic. */
export function bezier(c: readonly [Point, Point, Point, Point], u: number): Point {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const d = 3 * v * u * u;
  const e = u * u * u;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

/**
 * Which stretch of the curve shows at `phase` ∈ [0, 1) of a pass: a body `length` long slides in
 * from the start and out past the end, so it enters, crosses and leaves.
 */
export function visibleSpan(phase: number, length = 0.6): readonly [number, number] {
  const head = phase * (1 + length);
  return [Math.max(0, head - length), Math.min(1, head)];
}

export interface Rect {
  readonly l: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
}

/** A glyph inside the headline's rectangle is not drawn: the headline is never covered. */
export const coversHeadline = (p: Point, headline: Rect | null): boolean =>
  headline !== null && p.x >= headline.l && p.x <= headline.l + headline.w && p.y >= headline.t && p.y <= headline.t + headline.h;
