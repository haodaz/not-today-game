// The collapse on the stills (room-scene addition 2026-11-02). A `.fx` layer over the backdrop and
// under the HUD in 房间 / 桌子 / 门, and over the desktop's monitor frame. Each child is one effect,
// on or off by ring (stages.json), its strength a CSS variable `--fx` in [0, 1] set from the day
// within the ring. `fxPlan` is pure and is what the tests read; `renderFx` only turns it to markup.
// Nothing here is story: it is DOM and CSS over the existing photos.
import { cycleOf, isCalmDaytime, isTenderDay } from "@state/stages";
import type { Beat } from "@world/desktop/beat";
import { RINGS } from "@world/desktop/rings";
import { cls, html, type SafeHtml } from "@world/html";
import { deskLayout } from "./desk";
import { rectStyle, type Rect } from "./shots";

export type FxView = "room" | "desk" | "door" | "desktop";
export type FxId = "veins" | "lamp" | "grade" | "pores" | "vignette" | "dark";
export type Grade = "cool" | "warm" | "white";

export interface FxChild {
  readonly id: FxId;
  /** The effect's strength, 0..1 (CSS `--fx`). */
  readonly level: number;
  /** `grade` only: which filter. */
  readonly grade?: Grade;
  /** `lamp` only: where the light sits, in stage px. */
  readonly rect?: Rect;
}

export interface FxPlan {
  readonly ring: string;
  readonly view: FxView;
  readonly children: readonly FxChild[];
  /** Desktop only: the left monitor's `.os` takes the pore tile (level), and the text dims at day 17 on. */
  readonly pores: number | null;
  readonly dimText: boolean;
}

/** The first ring the stills collapse in. */
export const FIRST_RING = "wall";
/** The strength by day within the ring: first, second, third. */
export const BY_DAY_IN_RING: readonly number[] = [0.5, 0.75, 1];
/** Veins stay at this from `room` on; pores and veins fade to FADED on days 17 and 18 (白). */
export const VEINS_AFTER_WALL = 0.5;
export const FADED = 0.3;
/** The white vignette's edge opacity on day 17 and day 18. */
export const VIGNETTE_BY_DAY: Readonly<Record<number, number>> = { 17: 0.45, 18: 0.6 };
/** The 门 view is darkened this much on day 16. */
export const DOOR_DARKEN = 0.25;
/** The glow is drawn this far outside the lamp's own rect. */
export const GLOW_PAD = 60;
/**
 * The lamp in 房间, measured on public/room/shots/room.jpg (2048×1152; image 1090–1290 × 420–600,
 * the shade, the bulb and the glow around them) × 0.78125 into stage px.
 */
export const ROOM_LAMP: Rect = { l: 852, t: 328, w: 156, h: 141 };

const day17On = (day: number) => day in VIGNETTE_BY_DAY;
const inflate = (r: Rect, by: number): Rect => ({ l: Math.max(0, r.l - by), t: Math.max(0, r.t - by), w: r.w + 2 * by, h: r.h + 2 * by });

/** Where in its ring a day is: 0, 1 or 2. */
export function dayInRing(day: number): number {
  const days = [...cycleOf(day).days].sort((a, b) => a - b);
  return Math.max(0, days.indexOf(day));
}

/** Nothing before ring wall, and nothing on a calm day (day 10 is the first day of wall, and calm). */
export function fxPlan(day: number, beat: Beat, view: FxView): FxPlan | null {
  const ring = cycleOf(day).ring;
  if (RINGS.indexOf(ring) < RINGS.indexOf(FIRST_RING) || isCalmDaytime(day)) return null;
  const night = beat === "night";
  const strength = BY_DAY_IN_RING[Math.min(dayInRing(day), BY_DAY_IN_RING.length - 1)]!;
  const wall = ring === FIRST_RING;
  const children: FxChild[] = [];

  // Veins on the wall: in 房间 and over the upper third of 桌子. They stay from `wall`, at 0.5.
  if (view === "room" || view === "desk") {
    children.push({ id: "veins", level: wall ? strength : day17On(day) ? FADED : VEINS_AFTER_WALL });
  }
  // The lamp's light goes pink in `wall` only.
  if (wall && (view === "room" || view === "desk")) {
    children.push({ id: "lamp", level: strength, rect: inflate(view === "room" ? ROOM_LAMP : deskLayout.lamp, GLOW_PAD) });
  }
  // The grade belongs to the day: the night's dark does that work there.
  if (!wall && !night) {
    const grade: Grade = day17On(day) ? "white" : isTenderDay(day) ? "warm" : "cool";
    children.push({ id: "grade", level: 1, grade });
  }
  // The pores: a full-screen tile on the stills; on the desktop the left monitor's own background.
  const poresLevel = !wall ? (day17On(day) ? FADED : strength) : null;
  if (poresLevel !== null && view !== "desktop") children.push({ id: "pores", level: poresLevel });
  if (view === "door" && day === 16) children.push({ id: "dark", level: DOOR_DARKEN });
  if (day17On(day)) children.push({ id: "vignette", level: VIGNETTE_BY_DAY[day]! });

  return { ring, view, children, pores: view === "desktop" ? poresLevel : null, dimText: view === "desktop" && day17On(day) };
}

const num = (n: number): string => String(Math.round(n * 1000) / 1000);

/** The `.fx` layer, or null when the plan has nothing for the view. */
export function renderFx(plan: FxPlan | null): SafeHtml | null {
  if (!plan || plan.children.length === 0) return null;
  const kids = plan.children.map((c) => {
    const pos = c.rect ? `;${rectStyle(c.rect)}` : "";
    return html`<div class="${cls(`fx-${c.id}`)}"${c.grade ? html` data-grade="${c.grade}"` : null} style="--fx:${num(c.level)}${pos}"></div>`;
  });
  return html`<div class="fx" data-ring="${plan.ring}" aria-hidden="true">${kids}</div>`;
}

/** Attributes for the desktop's stage: the pore tile and the dimmed text are CSS on the monitor itself. */
export function fxStageAttrs(plan: FxPlan | null): SafeHtml | null {
  if (!plan) return null;
  const flags = [plan.pores !== null ? "pores" : null, plan.dimText ? "dim" : null].filter((x): x is string => x !== null);
  if (!flags.length) return null;
  return html` data-fx="${flags.join(" ")}"${plan.pores !== null ? html` style="--fx-pores:${num(plan.pores)}"` : null}`;
}
