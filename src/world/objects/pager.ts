// The pager (objects-in-hand FR3.3): one line of 12 seven-segment digits and two icons (envelope,
// battery). Keys read, up, down, fn, light. Idle dark; a new message lights it with the envelope
// blinking. The child's strings are content's (kid.json) and are shown exactly as written; from
// dream level 2 the same string is drawn in dot matrix. Upgraded: content's meaning, scrolling.
import { Bits, drawDot, drawSegLine, finer, SEG_PITCH, type Frame } from "./frame";
import { step, type ObjectEnv, type Program } from "./program";

export const PAGER_CELLS = 12;
/** Icons column (envelope over battery), then the digits. */
export const PAGER_DIGITS_X = 12;
export const PAGER_W = PAGER_DIGITS_X + PAGER_CELLS * SEG_PITCH; // 96
export const PAGER_H = 12;
export const PAGER_HISTORY = 10;
export const PAGER_BLINK_MS = 500;
/** One bar fewer a day from day 4; empty on day 9 (it still buzzes). */
export const BATTERY_FROM_DAY = 4;
export const BATTERY_BARS = 5;
/** From this dream level the digits are dot matrix. */
export const PAGER_DOTS_LEVEL = 2;
/** Upgraded: one line every this many ms. */
export const PAGER_SCROLL_MS = 1_500;

export function batteryBars(day: number): number {
  return Math.max(0, Math.min(BATTERY_BARS, BATTERY_BARS - (day - BATTERY_FROM_DAY)));
}

export interface PagerState {
  /** dark: idle; msg: a message from history (0 = newest); time: the clock and battery. */
  readonly view: "dark" | "msg" | "time";
  readonly index: number;
  readonly backlight: boolean;
  /** Today's message was read with `read` this session. */
  readonly read: boolean;
}

/** The ten kept, newest first (the oldest are pushed out). */
export const pagerHistory = (env: ObjectEnv) => [...env.pager].reverse().slice(0, PAGER_HISTORY);
/** Today's message, if it has arrived. */
export const todaysMessage = (env: ObjectEnv) => env.pager.find((m) => m.day === env.day) ?? null;

/** What the digits say now. */
export function pagerText(s: PagerState, env: ObjectEnv): string | null {
  if (s.view === "time") return env.time;
  if (s.view === "msg") return pagerHistory(env)[s.index]?.text ?? "";
  return null;
}

function envelope(b: Bits): void {
  b.rect(0, 0, 9, 1);
  b.rect(0, 5, 9, 1);
  b.rect(0, 0, 1, 6);
  b.rect(8, 0, 1, 6);
  for (let i = 1; i < 4; i++) (b.set(i, i), b.set(8 - i, i));
  b.set(4, 4);
}
function battery(b: Bits, bars: number): void {
  b.rect(0, 7, 8, 1);
  b.rect(0, 11, 8, 1);
  b.rect(0, 7, 1, 5);
  b.rect(7, 7, 1, 5);
  b.rect(8, 8, 1, 3);
  for (let i = 0; i < bars; i++) b.rect(1 + i + Math.floor(i / 5), 8, 1, 3);
}

export function drawPager(s: PagerState, env: ObjectEnv): Frame {
  const text = pagerText(s, env);
  const unread = todaysMessage(env) !== null && !s.read;
  if (env.upgraded) {
    // The new world reads it for you, unasked: every message's meaning, scrolling.
    const lines = pagerHistory(env).map((m) => m.meaning);
    return { kind: "hi", lines, scroll: lines.length ? Math.floor(env.t / PAGER_SCROLL_MS) % lines.length : 0 };
  }
  const b = new Bits(PAGER_W, PAGER_H);
  const on = text !== null || unread;
  if (on) {
    if (unread && Math.floor(env.t / PAGER_BLINK_MS) % 2 === 0) envelope(b);
    if (s.view === "time") battery(b, batteryBars(env.day));
    if (text !== null) {
      if (env.level >= PAGER_DOTS_LEVEL) {
        const cs = [...text].slice(-PAGER_CELLS);
        const pad = PAGER_CELLS - cs.length;
        cs.forEach((c, i) => drawDot(b, PAGER_DIGITS_X + (pad + i) * SEG_PITCH, 2, c));
      } else drawSegLine(b, PAGER_DIGITS_X, 1, text, PAGER_CELLS);
    }
  }
  const f = finer(b, env.level);
  return { kind: "pixels", w: f.w, h: f.h, bits: f.bits, lit: on && s.backlight };
}

export const pager: Program<PagerState> = {
  id: "pager",
  channel: { w: PAGER_W, h: PAGER_H },
  keySound: { id: "key-press", rate: 1.5 },
  init: () => ({ view: "dark", index: 0, backlight: false, read: false }),
  key(s, key, env) {
    const n = pagerHistory(env).length;
    switch (key) {
      case "read":
        return step({ ...s, view: "msg", index: 0, read: s.read || todaysMessage(env) !== null });
      case "up":
        return step({ ...s, view: "msg", index: Math.min(Math.max(0, n - 1), s.view === "msg" ? s.index + 1 : 0) });
      case "down":
        return step({ ...s, view: "msg", index: Math.max(0, s.view === "msg" ? s.index - 1 : 0) });
      case "fn":
        return step({ ...s, view: s.view === "time" ? "dark" : "time" });
      case "light":
        return step({ ...s, backlight: !s.backlight });
      default:
        return step(s);
    }
  },
  draw: drawPager,
};
