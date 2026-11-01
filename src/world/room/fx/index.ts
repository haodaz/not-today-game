// The collapse is in the photos, not on the lens (room-scene correction 2026-11-02). A still's
// backdrop is a stack: the clean photo at the bottom (the stage's own background), then edited
// photos of the same framing (public/room/fx/{room,desk,door}_{wall,other,glitch,white}.jpg), each
// at an opacity from the day. Nothing is an overlay on the camera. Transitions are at the day
// boundary only; inside day 16 the glitch photo flickers, seeded by the day. `fxPlan` is pure and
// is what the tests read; `renderFx` turns it to markup. Nothing here is story.
import { cycleOf, isCalmDaytime } from "@state/stages";
import { RINGS } from "@world/desktop/rings";
import { cls, html, raw, type SafeHtml } from "@world/html";

export type FxView = "room" | "desk" | "door" | "desktop";
/** The stages in the order the world goes through them; the stack never goes back. */
export const STAGES = ["wall", "other", "glitch", "white"] as const;
export type FxStage = (typeof STAGES)[number];

export interface FxLayer {
  readonly stage: FxStage;
  /** 0..1 (CSS `--fx`). */
  readonly opacity: number;
  /** The glitch photo flickers around its opacity (never with reduced motion). */
  readonly flicker: boolean;
}

export interface FxPlan {
  readonly day: number;
  readonly view: FxView;
  /** Bottom to top, over the clean photo. Empty for the desktop (it has no photo). */
  readonly layers: readonly FxLayer[];
  /** The desktop's left monitor takes the pore tile on its `.os` from ring room; the level, or null. */
  readonly pores: number | null;
  /** Days 17 and 18: the desktop's text is at 60 %. */
  readonly dimText: boolean;
}

/** The stack by day (spec): `[stage, opacity]` bottom to top. Days not listed are clean. */
export const STACK_BY_DAY: Readonly<Record<number, readonly (readonly [FxStage, number])[]>> = {
  11: [["wall", 0.6]],
  12: [["wall", 1]],
  13: [["other", 0.5]],
  14: [["other", 0.8]],
  15: [["other", 1]],
  16: [["other", 1], ["glitch", 0.7]],
  17: [["other", 0.4], ["white", 0.85]],
  18: [["white", 1]],
};
export const LAST_STACK_DAY = 18;

/** The pores on the left monitor: first, second, third day of a ring; 0.3 on the white days. */
export const PORES_BY_DAY_IN_RING: readonly number[] = [0.5, 0.75, 1];
export const PORES_WHITE = 0.3;
const FIRST_PORES_RING = "room";
const WHITE_DAYS = [17, 18];

/** The glitch flicker: opacity ± this around the layer's own, at intervals in this range (ms). */
export const FLICKER_SWING = 0.3;
export const FLICKER_MS: readonly [number, number] = [300, 2000];
export const FLICKER_STEPS = 40;

/** The day a still shows, clamped so the good ending's day 19 keeps day 18's photos. */
const stackDay = (day: number): number => Math.min(day, LAST_STACK_DAY);

function dayInRing(day: number): number {
  const days = [...cycleOf(day).days].sort((a, b) => a - b);
  return Math.max(0, days.indexOf(day));
}

/** Clean before day 11 and on day 10; the desktop has no stack, only the monitor's pores and dimmed text. */
export function fxPlan(day: number, view: FxView): FxPlan | null {
  if (isCalmDaytime(day)) return null;
  const stack = STACK_BY_DAY[stackDay(day)];
  const ring = cycleOf(day).ring;
  const poresOn = RINGS.indexOf(ring) >= RINGS.indexOf(FIRST_PORES_RING);
  if (!stack && !poresOn) return null;
  const white = WHITE_DAYS.includes(stackDay(day));
  const pores = view !== "desktop" || !poresOn ? null : white ? PORES_WHITE : PORES_BY_DAY_IN_RING[Math.min(dayInRing(day), PORES_BY_DAY_IN_RING.length - 1)]!;
  const layers = view === "desktop" ? [] : (stack ?? []).map(([stage, opacity]): FxLayer => ({ stage, opacity, flicker: stage === "glitch" }));
  const dimText = view === "desktop" && white;
  return layers.length === 0 && pores === null && !dimText ? null : { day, view, layers, pores, dimText };
}

/** A small seeded generator (mulberry32). */
function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Flicker {
  readonly durationMs: number;
  /** Keyframes: `at` in [0, 1) from the loop's start, the opacity held until the next. */
  readonly steps: readonly { readonly at: number; readonly opacity: number }[];
}

/**
 * The glitch photo's flicker for a day: opacity `base` ± 0.3 at irregular intervals of 0.3–2 s.
 * Seeded by the day, so the same day always flickers the same way.
 */
export function glitchFlicker(day: number, base = 0.7): Flicker {
  const rng = rngOf(day * 7919 + 17);
  const [lo, hi] = FLICKER_MS;
  const gaps = Array.from({ length: FLICKER_STEPS }, () => lo + rng() * (hi - lo));
  const durationMs = gaps.reduce((a, b) => a + b, 0);
  let t = 0;
  const steps = gaps.map((gap, i) => {
    const step = { at: t / durationMs, opacity: i === 0 ? base : Math.round(Math.min(1, Math.max(0, base + (rng() * 2 - 1) * FLICKER_SWING)) * 100) / 100 };
    t += gap;
    return step;
  });
  return { durationMs, steps };
}

const num = (n: number): string => String(Math.round(n * 1000) / 1000);
const pct = (f: number): string => `${Math.round(f * 100000) / 1000}%`;

/** The `@keyframes` for a day's flicker (the loop returns to its first value). */
export function flickerCss(day: number, base = 0.7): string {
  const { steps } = glitchFlicker(day, base);
  return `@keyframes fx-flicker-${day}{${steps.map((s) => `${pct(s.at)}{opacity:${s.opacity}}`).join("")}100%{opacity:${steps[0]!.opacity}}}`;
}

/** The photo stack (`.fx`), or null when the still is clean. It is the first child of the stage: under everything. */
export function renderFx(plan: FxPlan | null): SafeHtml | null {
  if (!plan || plan.layers.length === 0) return null;
  const photos = plan.layers.map((l) => {
    const flicker = l.flicker ? `;--flicker:fx-flicker-${plan.day} ${num(glitchFlicker(plan.day, l.opacity).durationMs / 1000)}s steps(1,end) infinite` : "";
    return html`<div class="${cls("fx-photo")}" data-stage="${l.stage}" style="--fx:${num(l.opacity)};background-image:url(/room/fx/${plan.view}_${l.stage}.jpg)${flicker}"></div>`;
  });
  const css = plan.layers.find((l) => l.flicker);
  return html`<div class="fx" data-view="${plan.view}" aria-hidden="true">${photos}${css ? html`<style>${raw(flickerCss(plan.day, css.opacity))}</style>` : null}</div>`;
}

/** Attributes for the desktop's stage: the pore tile and the dimmed text are CSS on the monitor itself. */
export function fxStageAttrs(plan: FxPlan | null): SafeHtml | null {
  if (!plan) return null;
  const flags = [plan.pores !== null ? "pores" : null, plan.dimText ? "dim" : null].filter((x): x is string => x !== null);
  if (!flags.length) return null;
  return html` data-fx="${flags.join(" ")}"${plan.pores !== null ? html` style="--fx-pores:${num(plan.pores)}"` : null}`;
}
