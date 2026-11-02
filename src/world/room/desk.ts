// 桌子 is the tabletop, seen from the chair (day-loop correction 2026-11-01). content/desk.json
// (Claude's) places everything that has state on desk_top.jpg, in stage px (1600 × 900). Read
// strictly: an unknown or missing key, a rect off the stage, or a wrong slot count fails at import.
import deskFile from "@content/desk.json";
import type { Rect } from "./shots";

export const STAGE = { w: 1600, h: 900 } as const;
/** One slot per object that can arrive (stages.json objectsFoundOnDay has six). */
export const OBJECT_SLOTS = 6;

export interface DeskLayout {
  readonly backdrop: string;
  /** Each monitor's visible lower half (clicking it goes to 屏幕 on that side). */
  readonly monitors: { readonly left: Rect; readonly right: Rect };
  readonly cup: Rect;
  readonly phone: Rect;
  readonly meal: Rect;
  readonly slip: Rect;
  /** The six object slots: one row, one x each, in arrival order. */
  readonly objects: { readonly row: { readonly t: number; readonly h: number; readonly w: number }; readonly slots: readonly number[] };
  readonly keyboard: Rect;
  readonly lamp: Rect;
  /** The walkman, after any ending only (sound addition 2026-11-02). */
  readonly walkman: Rect;
}

const TOP_KEYS = ["_note", "backdrop", "monitors", "cup", "phone", "meal", "slip", "objects", "keyboard", "lamp", "walkman"] as const;
const RECT_KEYS = ["cup", "phone", "meal", "slip", "keyboard", "lamp", "walkman"] as const;
/**
 * Keys still accepted but no longer read: `box` (the box opens where it is, in 房间, since
 * 2026-11-02; Claude deletes the key from content afterwards).
 */
const RETIRED_KEYS = ["box"] as const;

function fail(where: string, problem: string): never {
  throw new Error(`content/desk.json ${where}: ${problem}`);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function onlyKeys(v: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}

function num(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(where, "must be a number");
  return v;
}

function rect(v: unknown, where: string): Rect {
  if (!isObj(v)) fail(where, "must be a rect {l, t, w, h}");
  onlyKeys(v, ["l", "t", "w", "h", "_note"], where);
  const r = { l: num(v.l, `${where}.l`), t: num(v.t, `${where}.t`), w: num(v.w, `${where}.w`), h: num(v.h, `${where}.h`) };
  if (r.w <= 0 || r.h <= 0) fail(where, "must have a positive size");
  if (r.l < 0 || r.t < 0 || r.l + r.w > STAGE.w || r.t + r.h > STAGE.h) fail(where, `is off the ${STAGE.w}×${STAGE.h} stage`);
  return r;
}

/** Strict: every key required, nothing else allowed. Exported for tests. */
export function parseDesk(raw: unknown): DeskLayout {
  if (!isObj(raw)) fail("", "must be an object");
  onlyKeys(raw, [...TOP_KEYS, ...RETIRED_KEYS], "");
  for (const k of TOP_KEYS) if (k !== "_note" && !(k in raw)) fail("", `missing "${k}"`);
  if (typeof raw.backdrop !== "string" || !raw.backdrop.startsWith("/")) fail("backdrop", "must be a site path");
  const m = raw.monitors;
  if (!isObj(m)) fail("monitors", "must be {left, right}");
  onlyKeys(m, ["left", "right"], "monitors");
  const rects = Object.fromEntries(RECT_KEYS.map((k) => [k, rect(raw[k], k)])) as Record<(typeof RECT_KEYS)[number], Rect>;
  const o = raw.objects;
  if (!isObj(o)) fail("objects", "must be {row, slots}");
  onlyKeys(o, ["row", "slots", "_note"], "objects");
  if (!isObj(o.row)) fail("objects.row", "must be {t, h, w}");
  onlyKeys(o.row, ["t", "h", "w"], "objects.row");
  const row = { t: num(o.row.t, "objects.row.t"), h: num(o.row.h, "objects.row.h"), w: num(o.row.w, "objects.row.w") };
  if (!Array.isArray(o.slots) || o.slots.length !== OBJECT_SLOTS) fail("objects.slots", `must list ${OBJECT_SLOTS} x positions`);
  const slots = o.slots.map((x, i) => num(x, `objects.slots[${i}]`));
  // Each slot is a whole rect on the stage.
  slots.forEach((x, i) => rect({ l: x, t: row.t, w: row.w, h: row.h }, `objects.slots[${i}]`));
  return {
    backdrop: raw.backdrop,
    monitors: { left: rect(m.left, "monitors.left"), right: rect(m.right, "monitors.right") },
    ...rects,
    objects: { row, slots },
  };
}

export const deskLayout: DeskLayout = Object.freeze(parseDesk(deskFile));

/** Object slot i (arrival order) as a rect. */
export function objectSlot(layout: DeskLayout, i: number): Rect | null {
  const x = layout.objects.slots[i];
  return x === undefined ? null : { l: x, t: layout.objects.row.t, w: layout.objects.row.w, h: layout.objects.row.h };
}

/** The gap between the two monitors' visible halves (where the hand comes from at night). */
export function deskGap(layout: DeskLayout): Rect {
  const { left, right } = layout.monitors;
  const l = left.l + left.w;
  return { l, t: Math.min(left.t, right.t), w: Math.max(1, right.l - l), h: Math.max(left.h, right.h) };
}

/**
 * A monitor's whole screen for the camera into 屏幕: only its lower half is in the frame; the full
 * screen has the desktop stage's aspect and the same bottom edge, so it runs above the frame.
 */
export function fullMonitor(visible: Rect, aspect: number): Rect {
  const h = visible.w / aspect;
  return { l: visible.l, t: visible.t + visible.h - h, w: visible.w, h };
}
