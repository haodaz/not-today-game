// The day-18 pull-out page (room-scene addition 2026-11-01; design S15–S18). The lit room is the
// island, shrinking toward the centre over black; around it the dark fades in: dark_tile.png tiled,
// eyes and tentacles as sprites, dense at the edges and thinning toward the room, held off the
// island by a mask that follows its size, so it never covers the room.
// With the splat, the room is drawn by the splat layer underneath and the photo island is hidden
// (`#app.splat-pull`); without it, the photo island scales by the same timeline. Pure markup:
// `--island` and `--dark` are written from `pullOutAt` here and every frame by the driver.
import { BACKDROPS } from "@world/fit";
import { html, type SafeHtml } from "@world/html";
import type { PoseId } from "@world/room/splat/pose";
import { darkKindOf, GIANT, giantAt, pullOutAt, type DarkKind } from "@world/room/splat/pullout";
import type { EndingModel } from "./view";

export const DARK_ASSETS = {
  tile: "/room/dark/dark_tile.png",
  eyes: ["/room/dark/eye_1.png", "/room/dark/eye_2.png", "/room/dark/eye_3.png"],
  tentacles: "/room/dark/tentacles.png",
} as const;

export interface DarkSprite {
  readonly kind: "eye" | "tentacle";
  readonly src: string;
  /** Centre, in stage px (1600 × 900). */
  readonly x: number;
  readonly y: number;
  /** Width in stage px. */
  readonly w: number;
  /** Distance from the centre in the stage's own ellipse units (0 centre … 1 edge, a little beyond). */
  readonly r: number;
  /** Animation period and phase (ms): out of sync. */
  readonly period: number;
  readonly phase: number;
}

/** A small deterministic PRNG (mulberry32): the same dark every time. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const EYE_COUNT = 22;
export const TENTACLE_COUNT = 8;
/** Nothing nearer the centre than this (the island's size at the end is well inside it). */
export const DARK_INNER = 0.42;

/**
 * Where the sprites are. Radius r ∈ [DARK_INNER, 1.1], drawn as DARK_INNER + (1.1 − DARK_INNER)·√u,
 * so more of them sit near the edges; bigger toward the edges too. Pure and seeded.
 */
export function darkSprites(seed = 18): DarkSprite[] {
  const rand = rng(seed);
  const out: DarkSprite[] = [];
  const place = (kind: DarkSprite["kind"], i: number, n: number, src: string) => {
    const theta = ((i + rand() * 0.8) / n) * Math.PI * 2;
    const r = DARK_INNER + (1.1 - DARK_INNER) * Math.sqrt(rand());
    const base = kind === "eye" ? 46 : 210;
    out.push({
      kind,
      src,
      x: Math.round(800 + Math.cos(theta) * 800 * r),
      y: Math.round(450 + Math.sin(theta) * 450 * r),
      w: Math.round(base * (0.6 + 0.8 * r) * (0.8 + 0.4 * rand())),
      r,
      period: Math.round(kind === "eye" ? 2600 + rand() * 2600 : 9000 + rand() * 5000),
      phase: Math.round(rand() * 5000),
    });
  };
  for (let i = 0; i < EYE_COUNT; i++) place("eye", i, EYE_COUNT, DARK_ASSETS.eyes[i % DARK_ASSETS.eyes.length]!);
  for (let i = 0; i < TENTACLE_COUNT; i++) place("tentacle", i, TENTACLE_COUNT, DARK_ASSETS.tentacles);
  return out;
}

const SPRITES = darkSprites();

/** The giant (correction 2026-11-01): one image, the room inside its ring of arms. */
export const GIANT_ASSETS = { body: "/room/dark/giant/body.png" } as const;

/** What the dark layer is for an ending: the field (bad, survive) or the giant (good). */
export type DarkLayer =
  | { readonly kind: "field"; readonly tile: string; readonly sprites: readonly DarkSprite[] }
  | { readonly kind: "giant"; readonly src: string };

export function darkLayerFor(ending: "bad" | "survive" | "good"): DarkLayer {
  return darkKindOf(ending) === "giant" ? { kind: "giant", src: GIANT_ASSETS.body } : { kind: "field", tile: DARK_ASSETS.tile, sprites: SPRITES };
}

/**
 * The style vars for one frame; the render writes them once and the driver every frame.
 * Field: `--island`, `--dark`. Giant: `--island`, `--giant-scale`, `--giant-body`, `--giant-heads`.
 */
export function pullFrameVars(elapsed: number, from: PoseId, kind: DarkKind): Record<string, string> {
  const f = pullOutAt(elapsed, from);
  if (kind === "field") return { "--island": f.island.toFixed(4), "--dark": f.dark.toFixed(4) };
  const g = giantAt(elapsed, from);
  return { "--island": f.island.toFixed(4), "--giant-scale": g.scale.toFixed(4), "--giant-body": g.body.toFixed(4), "--giant-heads": g.heads.toFixed(4) };
}

const styleOf = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

function darkHtml(layer: DarkLayer): SafeHtml {
  if (layer.kind === "field") {
    const sprites = layer.sprites.map(
      (s) =>
        html`<img class="${s.kind}" src="${s.src}" alt="" draggable="false" style="left:${s.x}px;top:${s.y}px;width:${s.w}px;--period:${s.period}ms;--phase:-${s.phase}ms">`,
    );
    return html`<div class="pull-dark field" style="background-image:url(${layer.tile})">${sprites}</div>`;
  }
  // The same image twice: the body and arms below the heads, then the heads (they come last).
  // The box is the image's own size, placed so the ring's hole sits on the stage's centre; it
  // scales (and breathes) about that hole.
  const box = `left:${800 - GIANT.holeX}px;top:${450 - GIANT.holeY}px;width:${GIANT.size}px;height:${GIANT.size}px;transform-origin:${GIANT.holeX}px ${GIANT.holeY}px;--split:${(GIANT.headsSplit * 100).toFixed(1)}%`;
  return html`<div class="pull-dark giant"><div class="giant-box" style="${box}"><img class="giant-body" src="${layer.src}" alt="" draggable="false"><img class="giant-heads" src="${layer.src}" alt="" draggable="false"></div></div>`;
}

export function renderPullOut(m: EndingModel): SafeHtml {
  const p = m.session.pullOut!;
  const layer = darkLayerFor(p.ending);
  const vars = pullFrameVars(m.nowMs - p.startMs, p.from, layer.kind);
  return html`<div class="stage ending-page pullout-page" data-ending="${p.ending}" data-from="${p.from}" data-dark="${layer.kind}" aria-hidden="true" style="${styleOf(vars)}"><div class="pull-island" style="background-image:url(${BACKDROPS[p.from as keyof typeof BACKDROPS] ?? BACKDROPS.room})"></div>${darkHtml(layer)}</div>`;
}
