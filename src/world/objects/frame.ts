// What an object's screen shows, as data (objects-in-hand FR2). A program's `draw` returns one of:
//   pixels — a 1-bit buffer at the object's channel resolution (× 2ⁿ at dream level n);
//   cells  — the dictionary's 2 × 16 dot-matrix text cells (a CJK character takes two);
//   hi     — the new world's smooth screen (an upgraded object): text lines, maybe a colour picture;
//   none   — no screen at all (the card, the tape, the phone, the camera).
// Seven-segment and dot-matrix glyphs are drawn here by code (no font files). Pure.

export interface PixelFrame {
  readonly kind: "pixels";
  readonly w: number;
  readonly h: number;
  /** Row-major, 1 = ink. */
  readonly bits: Uint8Array;
  /** Backlight on (the pager's light key). */
  readonly lit?: boolean;
  /** 0..1: how visible the ink is (the calculator in and out of the light). */
  readonly ink?: number;
}
export interface CellFrame {
  readonly kind: "cells";
  readonly cols: number;
  readonly rows: readonly string[];
  /** Dream level: the cells are drawn finer, at the same size. */
  readonly level: number;
}
export interface HiFrame {
  readonly kind: "hi";
  readonly lines: readonly string[];
  /** A picture under the lines (the upgraded chick): the low frame, drawn smooth and in colour. */
  readonly picture?: { readonly w: number; readonly h: number; readonly bits: Uint8Array } | null;
  /** How far the lines have scrolled (auto-scroll), in lines. */
  readonly scroll?: number;
  /**
   * Kuro has moved in (object-upgrade addition 2026-11-03): a Kurogotchi pose drawn into the hi
   * screen, pixelated. A taken object sets it always (its own content is empty); an upgraded but
   * not-yet-taken object sets it only for a brief glimpse over its own lines. The pose id is a
   * `public/objects/kurogotchi/<pose>.png` file; paint.ts draws it. Null = the object's own screen.
   */
  readonly kuro?: string | null;
}
export interface NoFrame {
  readonly kind: "none";
}
export type Frame = PixelFrame | CellFrame | HiFrame | NoFrame;
export const NO_FRAME: NoFrame = { kind: "none" };

/** A mutable 1-bit buffer, for building a frame. */
export class Bits {
  readonly bits: Uint8Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.bits = new Uint8Array(w * h);
  }
  set(x: number, y: number, on = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.bits[y * this.w + x] = on ? 1 : 0;
  }
  get(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.bits[y * this.w + x]!;
  }
  rect(x: number, y: number, w: number, h: number, on = 1): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, on);
  }
  invert(x: number, y: number, w: number, h: number): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, this.get(x + i, y + j) ? 0 : 1);
  }
  /** Copies a picture (rows of '#'/'.' or 1/0) at (x, y). */
  blit(rows: readonly string[], x = 0, y = 0): void {
    rows.forEach((row, j) => [...row].forEach((c, i) => (c === "#" || c === "1" ? this.set(x + i, y + j) : undefined)));
  }
}

/**
 * Dream level n (objects-in-hand FR2): the channel × 2ⁿ, the drawn size unchanged, so the ink looks
 * thinner ("你会觉得它瘦了"). Each lit source pixel becomes a filled square of side
 * max(1, 2ⁿ − 2ⁿ⁻¹), anchored top-left in its 2ⁿ cell. To keep whole shapes whole (defect 2026-11-03:
 * a bare square per cell scatters a solid region into separate blocks), a thin 1 px bridge joins a
 * square to a lit right or bottom neighbour, so adjacent source pixels stay 4-connected and no lit
 * pixel is ever isolated; the strokes still thin as the level rises.
 */
export function finer(src: { w: number; h: number; bits: Uint8Array }, level: number): { w: number; h: number; bits: Uint8Array } {
  if (level <= 0) return src;
  const s = 2 ** level;
  const ink = Math.max(1, s - (s >> 1)); // 2ⁿ − 2ⁿ⁻¹
  const out = new Bits(src.w * s, src.h * s);
  const lit = (x: number, y: number) => x >= 0 && y >= 0 && x < src.w && y < src.h && src.bits[y * src.w + x] === 1;
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      if (!lit(x, y)) continue;
      out.rect(x * s, y * s, ink, ink);
      // A thin 1 px bridge to a lit right/bottom neighbour keeps the thinned squares 4-connected.
      if (ink < s) {
        if (lit(x + 1, y)) out.rect(x * s + ink, y * s, s - ink, 1);
        if (lit(x, y + 1)) out.rect(x * s, y * s + ink, 1, s - ink);
      }
    }
  return out;
}

/** For snapshots: '#' ink, '.' none, one line per row. */
export function ascii(f: { w: number; h: number; bits: Uint8Array }): string {
  const rows: string[] = [];
  for (let y = 0; y < f.h; y++) rows.push([...f.bits.subarray(y * f.w, (y + 1) * f.w)].map((b) => (b ? "#" : ".")).join(""));
  return rows.join("\n");
}

// ——— seven segments ———
// Segments a..g as bits; the cell is 5 × 9 px, a 1 px stroke, a point (or colon) in a 6th column.
const A = 1, B = 2, C = 4, D = 8, E = 16, F = 32, G = 64;
export const SEGMENTS: Readonly<Record<string, number>> = {
  "0": A | B | C | D | E | F, "1": B | C, "2": A | B | G | E | D, "3": A | B | G | C | D, "4": F | G | B | C,
  "5": A | F | G | C | D, "6": A | F | G | E | D | C, "7": A | B | C, "8": A | B | C | D | E | F | G, "9": A | B | C | D | F | G,
  A: A | B | C | E | F | G, b: C | D | E | F | G, C: A | D | E | F, d: B | C | D | E | G, E: A | D | E | F | G, F: A | E | F | G,
  G: A | C | D | E | F, g: A | B | C | D | F | G, H: B | C | E | F | G, h: C | E | F | G, I: E | F, L: D | E | F, O: A | B | C | D | E | F,
  o: C | D | E | G, P: A | B | E | F | G, S: A | F | G | C | D, U: B | C | D | E | F, Z: A | B | G | E | D, r: E | G, "-": G, " ": 0,
};
export const SEG_W = 5;
export const SEG_H = 9;
/** One cell's pitch: the digit, its point column, a gap. */
export const SEG_PITCH = 7;

/** A display string as seven-segment cells: a point or colon belongs to the cell before it. */
export function segCells(text: string): { ch: string; dot: boolean; colon: boolean }[] {
  const out: { ch: string; dot: boolean; colon: boolean }[] = [];
  for (const c of text) {
    if ((c === "." || c === ":") && out.length) {
      out[out.length - 1] = { ...out[out.length - 1]!, dot: out[out.length - 1]!.dot || c === ".", colon: out[out.length - 1]!.colon || c === ":" };
    } else if (c === "." || c === ":") out.push({ ch: " ", dot: c === ".", colon: c === ":" });
    else out.push({ ch: c, dot: false, colon: false });
  }
  return out;
}

export function drawSeg(b: Bits, x: number, y: number, ch: string, dot = false, colon = false): void {
  const s = SEGMENTS[ch] ?? SEGMENTS[ch.toUpperCase()] ?? 0;
  if (s & A) b.rect(x + 1, y, 3, 1);
  if (s & B) b.rect(x + 4, y + 1, 1, 3);
  if (s & C) b.rect(x + 4, y + 5, 1, 3);
  if (s & D) b.rect(x + 1, y + 8, 3, 1);
  if (s & E) b.rect(x, y + 5, 1, 3);
  if (s & F) b.rect(x, y + 1, 1, 3);
  if (s & G) b.rect(x + 1, y + 4, 3, 1);
  if (dot) b.set(x + 5, y + 8);
  if (colon) (b.set(x + 5, y + 2), b.set(x + 5, y + 6));
}

/** Draws a right-aligned seven-segment line of `cells` cells starting at x. */
export function drawSegLine(b: Bits, x: number, y: number, text: string, cells: number): void {
  const cs = segCells(text).slice(-cells);
  const pad = cells - cs.length;
  cs.forEach((c, i) => drawSeg(b, x + (pad + i) * SEG_PITCH, y, c.ch, c.dot, c.colon));
}

// ——— 5 × 7 dot matrix ———
// Each glyph is seven rows of five bits (MSB left).
const DOTS: Readonly<Record<string, readonly number[]>> = {
  "0": [14, 17, 19, 21, 25, 17, 14], "1": [4, 12, 4, 4, 4, 4, 14], "2": [14, 17, 1, 2, 4, 8, 31], "3": [31, 2, 4, 2, 1, 17, 14],
  "4": [2, 6, 10, 18, 31, 2, 2], "5": [31, 16, 30, 1, 1, 17, 14], "6": [6, 8, 16, 30, 17, 17, 14], "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14], "9": [14, 17, 17, 15, 1, 2, 12],
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], ".": [0, 0, 0, 0, 0, 12, 12], ":": [0, 12, 12, 0, 12, 12, 0],
  "-": [0, 0, 0, 31, 0, 0, 0], "?": [14, 17, 1, 2, 4, 0, 4], " ": [0, 0, 0, 0, 0, 0, 0],
};
export const DOT_GLYPHS: readonly string[] = Object.keys(DOTS);
export const DOT_W = 5;
export const DOT_H = 7;
export function drawDot(b: Bits, x: number, y: number, ch: string): void {
  const rows = DOTS[ch] ?? DOTS[ch.toUpperCase()] ?? DOTS["?"]!;
  rows.forEach((row, j) => {
    for (let i = 0; i < DOT_W; i++) if (row & (1 << (DOT_W - 1 - i))) b.set(x + i, y + j);
  });
}
/** Whether a character has a dot-matrix glyph (lower case shares the capitals). */
export const hasDot = (ch: string): boolean => Object.hasOwn(DOTS, ch) || Object.hasOwn(DOTS, ch.toUpperCase());

/** Half-width units a character takes in a dot-matrix row: CJK and full-width forms take two. */
export function cellWidth(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6)) ? 2 : 1;
}
export const rowWidth = (row: string): number => [...row].reduce((n, c) => n + cellWidth(c), 0);
/** The longest head of `text` that fits `cols` half-width cells. */
export function fitRow(text: string, cols: number): string {
  let n = 0;
  let out = "";
  for (const c of text) {
    if (n + cellWidth(c) > cols) break;
    n += cellWidth(c);
    out += c;
  }
  return out;
}
