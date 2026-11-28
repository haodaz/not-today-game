// The screen's own collapse (author 2026-10-21, script/notes/视觉参考.md: 「用聊天记录自己的字拼成鱼…很淡地
// 游过」, 「文字就是血肉」; 2026-11-28: 「18天屏幕上的崩坏不能是这种的…屏幕上文字动画飘过的触须，游动的怪物」,
// 「和3d世界崩坏不太一样」). The room collapses in flesh; the screen collapses in its own text: the
// characters that are on the screen leave their lines and swim as a fish, open as an eye, drift
// across as tendrils, and at the end cross the window as one large thing. The window itself stays
// as it is: nothing is faded, nothing is blurred, every line can still be read.
//
// Pure: what lives on the screen on a day, and where each character of a creature is at a time.
// The DOM side (a canvas over the monitor) is layer.ts.
import { isCalmDaytime, ringOf } from "@state/stages";

/** One character of a creature: where its centre is (stage px of the 1440 × 900 monitor), how it is turned, how big, how strong. */
export interface Glyph {
  readonly x: number;
  readonly y: number;
  /** Radians; 0 is upright. */
  readonly rot: number;
  /** Font px. */
  readonly size: number;
  /** 0..1, before the day's own strength. */
  readonly a: number;
  /** Which character of the screen's text it is (the layer takes it modulo what it has). */
  readonly k: number;
}

export interface LifePlan {
  /** Fish at a time (0: none). */
  readonly fish: number;
  /** The eye opens now and then. */
  readonly eye: boolean;
  /** Tendrils from the window's edges. */
  readonly tendrils: number;
  /** The large thing that crosses the window (the last two days). */
  readonly swimmer: boolean;
  /** 0..1: how dark the creatures are drawn. */
  readonly strength: number;
  /** The ink: the screen's grey early, wine-dark at the end. */
  readonly ink: string;
}

export const NO_LIFE: LifePlan = Object.freeze({ fish: 0, eye: false, tendrils: 0, swimmer: false, strength: 0, ink: "#1f2329" });
const GREY = "#1f2329";
const WINE = "#4a0d18";

/**
 * What lives on the screen on `day` (script/notes/视觉参考.md: 「第 1–9 天几乎看不出；第 10–15 天鱼和眼；
 * 最后几天」 the tendrils and the thing). By ring, never by a hardcoded day: wall = a fish, rarely;
 * room = fish and the eye; door = tendrils, more each day, and on its last two days the swimmer.
 * A calm daytime day has none.
 */
export function lifePlan(day: number): LifePlan {
  if (isCalmDaytime(day)) return NO_LIFE;
  const ring = ringOf(day);
  if (ring === "wall") return { fish: 1, eye: false, tendrils: 0, swimmer: false, strength: 0.34, ink: GREY };
  if (ring === "room") return { fish: 2, eye: true, tendrils: 0, swimmer: false, strength: 0.44, ink: GREY };
  if (ring !== "door") return NO_LIFE;
  // the door ring's first, second and third day
  let nth = 0;
  for (let d = day - 1; d >= 1 && ringOf(d) === "door"; d--) nth++;
  return { fish: 1, eye: true, tendrils: [3, 5, 7][Math.min(2, nth)]!, swimmer: nth >= 1, strength: [0.55, 0.64, 0.74][Math.min(2, nth)]!, ink: WINE };
}

export const SCREEN_W = 1440;
export const SCREEN_H = 900;
/** The top bar and the dock are left alone: creatures live between them. */
const TOP = 40;
const BOTTOM = 820;

/** A stable 0..1 from two integers. */
export function rnd(a: number, b: number): number {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
}
const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ——— the fish ———
/** A fish is this many character columns long; each column is `FISH_CW` px wide. */
const FISH_LEN = 16;
const FISH_CW = 11;
const FISH_CH = 13;
/** Seconds one fish takes to cross the screen, and the quiet between two crossings of the same fish. */
export const FISH_CROSS_S = 16;
export const FISH_EVERY_S = 46;

/** Half-height of the fish in rows at column i (0 = nose): a deep body, a narrow waist, a forked tail. */
function fishHalf(i: number): number {
  if (i < 10) return Math.max(0.6, 4.2 * Math.sin((Math.PI * (i + 0.6)) / 10.6));
  if (i < 12) return 0.6;
  return 1 + (i - 11) * 1.15;
}

/**
 * Fish `n` at `t` seconds: nothing while it waits; else its characters. It swims in a straight
 * line with a body wave that grows toward the tail; every other crossing goes the other way.
 */
export function fishGlyphs(n: number, t: number, seed: number): Glyph[] {
  const period = FISH_EVERY_S + n * 9;
  const turn = Math.floor((t + n * 17) / period);
  const u = ((t + n * 17) % period) / FISH_CROSS_S;
  if (u < 0 || u > 1) return [];
  const dir = rnd(seed + n, turn) < 0.5 ? 1 : -1;
  const y0 = TOP + 80 + rnd(seed + n * 3, turn + 7) * (BOTTOM - TOP - 160);
  const span = SCREEN_W + FISH_LEN * FISH_CW * 2;
  const nose = dir === 1 ? -FISH_LEN * FISH_CW + u * span : SCREEN_W + FISH_LEN * FISH_CW - u * span;
  const out: Glyph[] = [];
  for (let i = 0; i < FISH_LEN; i++) {
    const half = fishHalf(i);
    const wave = Math.sin(i * 0.42 - t * 5.2) * (0.6 + i * 0.42);
    const x = nose - dir * i * FISH_CW;
    for (let j = -Math.floor(half); j <= Math.floor(half); j++) {
      if (i === 2 && j === -1) continue; // the eye: a hole in the text
      if (i >= 13 && Math.abs(j) < (i - 12) * 0.9) continue; // the fork of the tail
      const edge = Math.abs(j) / (half + 0.01);
      out.push({ x, y: y0 + j * FISH_CH + wave, rot: 0, size: 12, a: 0.55 + 0.45 * (1 - edge), k: i * 31 + (j + 9) * 7 + n * 101 });
    }
  }
  return out;
}

// ——— the eye ———
export const EYE_EVERY_S = 52;
/** Opening, held open, closing (seconds). */
export const EYE_OPEN_S = 0.7;
export const EYE_HOLD_S = 2.6;

/** The eye at `t`: closed (nothing) most of the time; else two lids of characters, an iris ring and a pupil. */
export function eyeGlyphs(t: number, seed: number): Glyph[] {
  const turn = Math.floor(t / EYE_EVERY_S);
  const s = (t % EYE_EVERY_S) - 20; // it waits 20 s into each period
  const total = EYE_OPEN_S * 2 + EYE_HOLD_S;
  if (s < 0 || s > total) return [];
  const open = s < EYE_OPEN_S ? smooth(s / EYE_OPEN_S) : s > EYE_OPEN_S + EYE_HOLD_S ? smooth((total - s) / EYE_OPEN_S) : 1;
  const cx = 260 + rnd(seed, turn + 31) * (SCREEN_W - 520);
  const cy = TOP + 150 + rnd(seed + 5, turn + 57) * (BOTTOM - TOP - 300);
  const W = 118, H = 52 * open;
  const out: Glyph[] = [];
  // the lids: characters along two arcs that part
  for (let i = 0; i <= 26; i++) {
    const u = i / 26, x = cx - W + u * 2 * W, arch = Math.sin(Math.PI * u);
    for (const side of [-1, 1]) {
      const y = cy + side * arch * H;
      out.push({ x, y, rot: side * (0.5 - u) * 1.1 * open, size: 13, a: 0.95, k: i * 13 + (side + 1) * 53 });
      if (arch > 0.5) out.push({ x, y: y + side * 11, rot: side * (0.5 - u) * 1.1 * open, size: 10, a: 0.4, k: i * 17 + (side + 1) * 29 }); // lashes of smaller text
    }
  }
  if (open > 0.35) {
    // the iris looks slowly from side to side; the pupil is a dense knot of characters
    const look = Math.sin(t * 0.9) * 26, r = Math.min(H * 0.82, 34);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; out.push({ x: cx + look + Math.cos(a) * r, y: cy + Math.sin(a) * r, rot: a + Math.PI / 2, size: 11, a: 0.8 * open, k: i * 7 + 400 }); }
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, rr = i % 3 === 0 ? 0 : r * 0.36; out.push({ x: cx + look + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, rot: 0, size: 14, a: open, k: i * 3 + 700 }); }
  }
  return out;
}

// ——— a tendril ———
/** How many characters a full tendril is, and seconds to grow, stay and go. */
const TENDRIL_LEN = 62;
export const TENDRIL_GROW_S = 5;
export const TENDRIL_STAY_S = 14;
export const TENDRIL_EVERY_S = 30;

/** The centre line of a tendril from `base` going `dir` (radians), `n` characters, at time `t`: it sways more toward the tip. */
function tendrilLine(bx: number, by: number, dir: number, n: number, t: number, ph: number, step: number): { x: number; y: number; rot: number }[] {
  const out: { x: number; y: number; rot: number }[] = [];
  let x = bx, y = by, a = dir;
  for (let i = 0; i < n; i++) {
    const k = i / TENDRIL_LEN;
    a = dir + (Math.sin(i * 0.19 - t * 1.25 + ph) * 0.95 + Math.sin(i * 0.071 + t * 0.45 + ph * 1.7) * 0.6) * (0.25 + k * 1.25);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    out.push({ x, y, rot: a });
  }
  return out;
}

/**
 * Tendril `n` at `t`: it comes in from an edge of the screen (a different place each time), grows
 * along a line of the window, sways, and draws back. Its characters lie along it, turned with it,
 * smaller toward the tip; every third has a small one beside it (a sucker made of text).
 */
export function tendrilGlyphs(n: number, t: number, seed: number): Glyph[] {
  const period = TENDRIL_EVERY_S + (n % 3) * 7;
  const tt = t + n * 11.3;
  const turn = Math.floor(tt / period);
  const s = tt % period;
  const life = TENDRIL_GROW_S * 2 + TENDRIL_STAY_S;
  if (s > life) return [];
  const grown = s < TENDRIL_GROW_S ? smooth(s / TENDRIL_GROW_S) : s > TENDRIL_GROW_S + TENDRIL_STAY_S ? smooth((life - s) / TENDRIL_GROW_S) : 1;
  const edge = Math.floor(rnd(seed + n * 7, turn) * 4); // 0 left, 1 right, 2 bottom, 3 top
  const along = 0.12 + rnd(seed + n * 13, turn + 3) * 0.76;
  const [bx, by, dir] =
    edge === 0 ? [-8, TOP + along * (BOTTOM - TOP), 0] : edge === 1 ? [SCREEN_W + 8, TOP + along * (BOTTOM - TOP), Math.PI] : edge === 2 ? [along * SCREEN_W, BOTTOM + 30, -Math.PI / 2] : [along * SCREEN_W, TOP - 12, Math.PI / 2];
  const count = Math.round(TENDRIL_LEN * grown);
  const line = tendrilLine(bx!, by!, dir!, count, t, n * 1.93 + turn, 12.5);
  const out: Glyph[] = [];
  line.forEach((p, i) => {
    const k = i / TENDRIL_LEN, size = 19 - k * 10;
    // a limb, not a thread: three characters across at the root, two along the middle, one at the tip
    const across = k < 0.3 ? 3 : k < 0.68 ? 2 : 1;
    const nx = Math.cos(p.rot + Math.PI / 2), ny = Math.sin(p.rot + Math.PI / 2);
    for (let w = 0; w < across; w++) {
      const off = (w - (across - 1) / 2) * size * 0.78;
      out.push({ x: p.x + nx * off, y: p.y + ny * off, rot: p.rot, size, a: (0.9 - k * 0.35) * (w === Math.floor(across / 2) || across === 2 ? 1 : 0.8), k: i * 5 + w * 53 + n * 211 + turn * 37 });
    }
    // a sucker made of text: a small character just outside the limb, on alternate sides
    if (i % 3 === 1 && i < count - 4) {
      const side = (i / 3) % 2 < 1 ? 1 : -1, out2 = (across * 0.39 + 0.42) * size * side;
      out.push({ x: p.x + nx * out2, y: p.y + ny * out2, rot: p.rot, size: size * 0.5, a: 0.5, k: i * 9 + n * 77 });
    }
  });
  return out;
}

// ——— the large thing ———
export const SWIMMER_CROSS_S = 44;
export const SWIMMER_EVERY_S = 70;

/** The thing that crosses the window on the last days: a dense head of characters and a trail of arms behind it. */
export function swimmerGlyphs(t: number, seed: number): Glyph[] {
  const turn = Math.floor(t / SWIMMER_EVERY_S);
  const u = ((t % SWIMMER_EVERY_S) - 8) / SWIMMER_CROSS_S;
  if (u < 0 || u > 1) return [];
  const dir = rnd(seed + 3, turn) < 0.5 ? 1 : -1;
  const y0 = TOP + 180 + rnd(seed + 9, turn + 2) * (BOTTOM - TOP - 360);
  const span = SCREEN_W + 900;
  const hx = dir === 1 ? -450 + u * span : SCREEN_W + 450 - u * span;
  const hy = y0 + Math.sin(t * 0.5) * 34;
  const beat = 1 + Math.sin(t * 1.7) * 0.07; // it pulses as it goes
  const out: Glyph[] = [];
  // the head: rings of characters, denser toward the middle, two holes for eyes
  for (let ring = 0; ring < 6; ring++) {
    const r = (10 + ring * 12.5) * beat, count = 5 + ring * 6;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring * 0.5 + t * 0.06 * (ring % 2 ? 1 : -1);
      const x = hx + Math.cos(a) * r * 1.25, y = hy + Math.sin(a) * r;
      if (Math.hypot(x - (hx + dir * 26), y - (hy - 12)) < 11 || Math.hypot(x - (hx + dir * 50), y - (hy + 14)) < 9) continue;
      out.push({ x, y, rot: a + Math.PI / 2, size: 15 - ring * 0.7, a: 0.95 - ring * 0.06, k: ring * 97 + i * 5 });
    }
  }
  // the arms: seven, trailing behind the head
  for (let arm = 0; arm < 7; arm++) {
    const spread = (arm - 3) * 0.2;
    const line = tendrilLine(hx - dir * 60, hy + (arm - 3) * 17, (dir === 1 ? Math.PI : 0) + spread, 40, t * 1.3, arm * 2.1 + turn, 11.5);
    line.forEach((p, i) => {
      const k = i / 40, size = 15 - k * 8;
      out.push({ x: p.x, y: p.y, rot: p.rot, size, a: 0.85 - k * 0.45, k: arm * 131 + i * 3 });
    });
  }
  return out;
}

/** Everything that is on the screen on `day` at `t` seconds: the characters to draw. */
export function lifeGlyphs(plan: LifePlan, t: number, seed: number): Glyph[] {
  const out: Glyph[] = [];
  for (let n = 0; n < plan.fish; n++) out.push(...fishGlyphs(n, t, seed));
  if (plan.eye) out.push(...eyeGlyphs(t, seed));
  for (let n = 0; n < plan.tendrils; n++) out.push(...tendrilGlyphs(n, t, seed));
  if (plan.swimmer) out.push(...swimmerGlyphs(t, seed));
  return out;
}

/** The characters the creatures are made of: what is written on the screen, without its spaces; a few of our own when the screen is empty. */
export function glyphsFrom(text: string): string[] {
  const out = [...text.replace(/\s+/g, "")].filter((ch) => ch.trim() !== "");
  return out.length >= 24 ? out.slice(0, 1200) : [..."今天不可以收到好的在忙吃了还没发和其光同其尘"];
}
