// The collapse breathes (room-scene addition 2026-11-02): the photo stack from `fxPlan` stays as the
// data, and this renders it with one fullscreen WebGL2 fragment shader — the clean photo, up to two
// stage photos and a tileable fbm noise texture. A stage photo does not fade in; it dissolves in
// through the noise, from the edges (the middle of the room turns last), while the whole image
// breathes, the film grain crawls and seeded static bursts tear it. Day 16's glitch cuts blocks
// and splits the channels. Dust and flakes are a second, additive pass in the same context (points),
// so there is one canvas and one context, not a 2D canvas above.
//
// Every number is in the `FX` table below. The GLSL is generated from it, so tuning is one place.
// Everything that decides what is drawn (`frameState`, `burstSchedule`, `blocksFor`, particle seeds)
// is a pure function of (day, stage, time) and is what the tests read; nothing here is story.
import { STAGES, type FxLayer, type FxPlan, type FxStage } from "./index";

/** Shader kind per stage; 0 is "no layer". */
export const KIND: Readonly<Record<FxStage, number>> = { wall: 1, other: 2, glitch: 3, white: 4 };

type PerStage<T> = Readonly<Record<FxStage, T>>;

export const FX = {
  /** The canvas is the stage: 1600 × 900 CSS px; the CSS scales it. */
  size: { w: 1600, h: 900 },
  /** Frame cap. */
  fps: 30,
  /** The noise texture (512², fbm, tileable). */
  noise: "/room/fx/noise.png",

  dissolve: {
    /** smoothstep width of a patch's edge, in noise units. */
    softness: 0.08,
    /** How much the patch field is replaced by "distance from the centre" (centre turns last). */
    centreBias: 0.55,
    /** White grows from the top: how much the patch field is replaced by "distance from the top". */
    topBias: 0.6,
    /** Stretch the fbm's mid-grey cluster so an amount of 0.5 covers about half. */
    contrast: 1.6,
    /** Patches crawl this much per second (uv units). */
    drift: [0.004, 0.0025] as const,
    scale: { wall: 3, other: 2, glitch: 2.5, white: 1.5 } as PerStage<number>,
    /** A second octave: `other` only. */
    octave2: { wall: [1, 0], other: [2.3, 0.35], glitch: [1, 0], white: [1, 0] } as PerStage<readonly [number, number]>,
  },

  /** `uv += (uv - 0.5) * a * sin(t * 2π / T)`. */
  breath: {
    wall: { a: 0.003, period: 7 },
    other: { a: 0.008, period: 5 },
    glitch: { a: 0, period: 1 },
    white: { a: 0.004, period: 9 },
  } as PerStage<{ readonly a: number; readonly period: number }>,

  /** Film grain amplitude per stage (glitch takes `other`'s), and in a burst. */
  grain: { wall: 0.02, other: 0.05, glitch: 0.05, white: 0.04, burst: 0.15 } as PerStage<number> & { readonly burst: number },

  /** Static bursts: at seeded irregular gaps (from the end of one to the start of the next). */
  bursts: {
    other: { gapMs: [4000, 15000], lengthMs: [150, 500] },
    glitch: { gapMs: [1000, 4000], lengthMs: [150, 500] },
    /** Rows torn sideways by up to this many px in a burst. */
    tearPx: 12,
    /** Height of a torn row band in px. */
    bandPx: 6,
    /** Share of bands that tear. */
    tearShare: 0.3,
    /** The schedule repeats after this long (a day's session is shorter). */
    loopMs: 600000,
  } as { readonly other: Range2; readonly glitch: Range2; readonly tearPx: number; readonly bandPx: number; readonly tearShare: number; readonly loopMs: number },

  /** Day 16. */
  glitch: {
    grid: [24, 14] as const,
    blocks: [5, 12] as const,
    jumpPx: 40,
    split: { rest: 2, burst: 8 },
    scanline: { every: 3, dark: 0.1, flickerHz: 12 },
    swaps: 6,
  },

  particles: {
    wall: null,
    glitch: null,
    other: { count: 60, size: [1, 3], alpha: 0.3, color: [0.78, 0.72, 0.66], speed: [0.004, 0.012] },
    white: { count: 40, size: [2, 4], alpha: 0.5, color: [1, 1, 1], speed: [0.01, 0.03] },
  } as PerStage<Particles | null>,
} as const;

interface Range2 {
  readonly gapMs: readonly [number, number];
  readonly lengthMs: readonly [number, number];
}
interface Particles {
  readonly count: number;
  readonly size: readonly [number, number];
  readonly alpha: number;
  readonly color: readonly [number, number, number];
  readonly speed: readonly [number, number];
}

/** A small seeded generator (mulberry32). */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// Bursts

export interface Burst {
  readonly startMs: number;
  readonly lengthMs: number;
  readonly index: number;
}

const schedules = new Map<string, readonly Burst[]>();

/**
 * The static bursts of a stage on a day: seeded by (day, stage), deterministic, one loop long.
 * The gap from a burst's end to the next one's start is within the stage's `gapMs`.
 */
export function burstSchedule(day: number, stage: FxStage): readonly Burst[] {
  const cfg = stage === "other" || stage === "glitch" ? FX.bursts[stage] : null;
  if (!cfg) return [];
  const key = `${day}:${stage}`;
  const hit = schedules.get(key);
  if (hit) return hit;
  const rng = rngOf(day * 7919 + KIND[stage] * 104729);
  const out: Burst[] = [];
  let t = 0;
  for (let index = 0; ; index++) {
    t += cfg.gapMs[0] + rng() * (cfg.gapMs[1] - cfg.gapMs[0]);
    if (t >= FX.bursts.loopMs) break;
    const lengthMs = cfg.lengthMs[0] + rng() * (cfg.lengthMs[1] - cfg.lengthMs[0]);
    out.push({ startMs: t, lengthMs, index });
    t += lengthMs;
  }
  schedules.set(key, out);
  return out;
}

export interface BurstNow {
  /** Unique across loops: the loop count × 100000 + the index. */
  readonly id: number;
  /** 0 → 1 → 0 over the burst. */
  readonly env: number;
}

/** The burst going on at `tMs` since the view began, or null. */
export function burstAt(day: number, stage: FxStage, tMs: number): BurstNow | null {
  const loop = Math.floor(tMs / FX.bursts.loopMs);
  const t = tMs - loop * FX.bursts.loopMs;
  for (const b of burstSchedule(day, stage)) {
    if (t < b.startMs) return null;
    if (t < b.startMs + b.lengthMs) return { id: loop * 100000 + b.index, env: Math.sin((Math.PI * (t - b.startMs)) / b.lengthMs) };
  }
  return null;
}

export interface Block {
  readonly col: number;
  readonly row: number;
  readonly dx: number;
  readonly dy: number;
}

/** Day 16's block jumps for one burst: 5–12 blocks of the 24×14 grid, each up to 40 px; and the channel swap. */
export function blocksFor(day: number, burstId: number): { blocks: readonly Block[]; swap: number } {
  const rng = rngOf(day * 31 + burstId * 977 + 5);
  const [lo, hi] = FX.glitch.blocks;
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const [cols, rows] = FX.glitch.grid;
  const jump = () => Math.round((rng() * 2 - 1) * FX.glitch.jumpPx);
  const blocks = Array.from({ length: count }, (): Block => ({ col: Math.floor(rng() * cols), row: Math.floor(rng() * rows), dx: jump(), dy: jump() }));
  return { blocks, swap: Math.floor(rng() * FX.glitch.swaps) };
}

// ---------------------------------------------------------------------------------------------
// Particles

export const particleCount = (stage: FxStage): number => FX.particles[stage]?.count ?? 0;

/** Where each particle starts and its own random, (x, y, z) in [0, 1): seeded by the stage, so it never changes. */
export function particleSeeds(stage: FxStage): Float32Array {
  const n = particleCount(stage);
  const rng = rngOf(KIND[stage] * 2654435761);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < out.length; i++) out[i] = rng();
  return out;
}

// ---------------------------------------------------------------------------------------------
// The frame: what the uniforms are, as a pure function of the plan and the time

export interface FrameState {
  readonly kindA: number;
  readonly kindB: number;
  readonly amtA: number;
  readonly amtB: number;
  readonly breath: number;
  readonly period: number;
  readonly grain: number;
  readonly burst: number;
  readonly burstId: number;
  readonly tearPx: number;
  readonly split: number;
  readonly glitch: number;
  readonly blocks: readonly Block[];
  readonly swap: number;
  /** 1 = things move; 0 = reduced motion (fixed dissolve, no breathing, no bursts, grain 0). */
  readonly move: number;
  /** The stage whose burst is going on, if any (for the static sound). */
  readonly burstStage: FxStage | null;
}

/** The strongest layer leads: ties go to the upper one. */
export function leadOf(layers: readonly FxLayer[]): FxLayer | null {
  return layers.reduce<FxLayer | null>((best, l) => (best === null || l.opacity >= best.opacity ? l : best), null);
}

export function frameState(plan: FxPlan, tSec: number, reduced: boolean): FrameState {
  const [a, b] = plan.layers;
  const lead = leadOf(plan.layers);
  const t = reduced ? 0 : tSec;
  // The burst track belongs to the top-most layer that has bursts.
  const burstStage = reduced ? null : ([...plan.layers].reverse().find((l) => l.stage === "other" || l.stage === "glitch")?.stage ?? null);
  const now = burstStage ? burstAt(plan.day, burstStage, t * 1000) : null;
  const env = now?.env ?? 0;
  const glitch = plan.layers.some((l) => l.stage === "glitch");
  const jumps = glitch && now && burstStage === "glitch" ? blocksFor(plan.day, now.id) : { blocks: [], swap: 0 };
  const grain = reduced || !lead ? 0 : FX.grain[lead.stage] + (FX.grain.burst - FX.grain[lead.stage]) * env;
  return {
    kindA: a ? KIND[a.stage] : 0,
    kindB: b ? KIND[b.stage] : 0,
    amtA: a?.opacity ?? 0,
    amtB: b?.opacity ?? 0,
    breath: reduced || !lead ? 0 : FX.breath[lead.stage].a,
    period: lead ? FX.breath[lead.stage].period : 1,
    grain,
    burst: env,
    burstId: now?.id ?? 0,
    tearPx: FX.bursts.tearPx,
    split: glitch ? FX.glitch.split.rest + (FX.glitch.split.burst - FX.glitch.split.rest) * (burstStage === "glitch" ? env : 0) : 0,
    glitch: glitch ? 1 : 0,
    blocks: jumps.blocks,
    swap: jumps.swap,
    move: reduced ? 0 : 1,
    burstStage: now ? burstStage : null,
  };
}

// ---------------------------------------------------------------------------------------------
// GLSL (ES 3.00), generated from FX

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n));
/** A constant array indexed by kind (0 = none, then the stages in KIND order). */
const byKind = (name: string, pick: (s: FxStage) => number, none = 0): string => `const float ${name}[5] = float[5](${[none, ...STAGES.map(pick)].map(f).join(", ")});`;

export const VERTEX = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const MAX_BLOCKS = FX.glitch.blocks[1];

export const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uClean;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
uniform float uKindA;
uniform float uKindB;
uniform float uAmtA;
uniform float uAmtB;
uniform float uBreath;
uniform float uPeriod;
uniform float uGrain;
uniform float uBurst;
uniform float uBurstId;
uniform float uTearPx;
uniform float uSplit;
uniform float uGlitch;
uniform float uBlockCount;
uniform vec4 uBlocks[${MAX_BLOCKS}];
uniform float uSwap;
uniform float uMove;

${byKind("SCALE", (s) => FX.dissolve.scale[s], 1)}
${byKind("OCT2S", (s) => FX.dissolve.octave2[s][0], 1)}
${byKind("OCT2W", (s) => FX.dissolve.octave2[s][1])}
const vec2 DRIFT = vec2(${f(FX.dissolve.drift[0])}, ${f(FX.dissolve.drift[1])});
const float SOFT = ${f(FX.dissolve.softness)};
const float CENTRE_BIAS = ${f(FX.dissolve.centreBias)};
const float TOP_BIAS = ${f(FX.dissolve.topBias)};
const float CONTRAST = ${f(FX.dissolve.contrast)};
const float BAND_PX = ${f(FX.bursts.bandPx)};
const float TEAR_SHARE = ${f(FX.bursts.tearShare)};
const vec2 GRID = vec2(${f(FX.glitch.grid[0])}, ${f(FX.glitch.grid[1])});
const float SCAN_EVERY = ${f(FX.glitch.scanline.every)};
const float SCAN_DARK = ${f(FX.glitch.scanline.dark)};
const float SCAN_HZ = ${f(FX.glitch.scanline.flickerHz)};

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float field(int k, vec2 uv) {
  vec2 p = uv * SCALE[k] + DRIFT * uTime * uMove;
  float n = texture(uNoise, p).r;
  if (OCT2W[k] > 0.0) {
    n = mix(n, texture(uNoise, p * OCT2S[k] + vec2(0.37, 0.11)).r, OCT2W[k]);
  }
  return clamp((n - 0.5) * CONTRAST + 0.5, 0.0, 1.0);
}

// Where the stage photo shows: a patch where the biased noise is under the amount, soft at its edge.
float dissolve(float kind, float amt, vec2 uv) {
  if (kind < 0.5 || amt <= 0.0) {
    return 0.0;
  }
  int k = int(kind + 0.5);
  float n = field(k, uv);
  float d = length((uv - 0.5) * vec2(1.7778, 1.0)) / 1.0198;
  float shape = (k == 4) ? uv.y : 1.0 - d;
  float bias = (k == 4) ? TOP_BIAS : CENTRE_BIAS;
  n = mix(n, shape, bias);
  float thr = amt * (1.0 + SOFT);
  return 1.0 - smoothstep(thr - SOFT, thr, n);
}

vec3 photo(sampler2D t, vec2 uv, float split) {
  float s = split / uRes.x;
  return vec3(texture(t, uv + vec2(s, 0.0)).r, texture(t, uv).g, texture(t, uv - vec2(s, 0.0)).b);
}

vec3 swapRgb(vec3 c, float s) {
  int i = int(s + 0.5);
  if (i == 1) { return c.rbg; }
  if (i == 2) { return c.grb; }
  if (i == 3) { return c.gbr; }
  if (i == 4) { return c.brg; }
  if (i == 5) { return c.bgr; }
  return c;
}

void main() {
  vec2 uv = vUv;

  // Static: rows torn sideways.
  if (uBurst > 0.0) {
    float band = floor(uv.y * uRes.y / BAND_PX);
    if (hash(vec2(band, uBurstId)) < TEAR_SHARE) {
      uv.x += (hash(vec2(band, uBurstId + 7.0)) - 0.5) * 2.0 * uTearPx * uBurst / uRes.x;
    }
  }

  // Breathing: the whole image, a slow radial pulse.
  uv += (uv - 0.5) * uBreath * sin(uTime * 6.2831853 / uPeriod) * uMove;
  vec2 muv = uv;

  // Day 16: blocks jump and swap channels in a burst.
  float swapped = 0.0;
  if (uGlitch > 0.5 && uBurst > 0.0) {
    vec2 cell = floor(muv * GRID);
    for (int i = 0; i < ${MAX_BLOCKS}; i++) {
      if (float(i) >= uBlockCount) { break; }
      if (abs(uBlocks[i].x - cell.x) < 0.5 && abs(uBlocks[i].y - cell.y) < 0.5) {
        uv += uBlocks[i].zw / uRes;
        swapped = 1.0;
      }
    }
  }

  vec3 col = photo(uClean, uv, uSplit);
  col = mix(col, photo(uA, uv, uSplit), dissolve(uKindA, uAmtA, muv));
  col = mix(col, photo(uB, uv, uSplit), dissolve(uKindB, uAmtB, muv));
  if (swapped > 0.5) { col = swapRgb(col, uSwap); }

  // Scanlines (day 16): every third row a little darker, drifting.
  if (uGlitch > 0.5) {
    float row = floor(gl_FragCoord.y) + floor(uTime * SCAN_HZ * uMove);
    if (mod(row, SCAN_EVERY) < 0.5) { col *= 1.0 - SCAN_DARK; }
  }

  // Film grain, new every frame.
  float g = hash(gl_FragCoord.xy + vec2(uFrame * 1.37, uFrame * 0.73)) - 0.5;
  col += g * uGrain;

  outColor = vec4(col, 1.0);
}
`;

export const PARTICLE_VERTEX = `#version 300 es
layout(location = 0) in vec3 aSeed;
uniform float uTime;
uniform float uKind;
uniform vec2 uSize;
uniform vec2 uSpeed;
uniform float uMove;
out float vFade;
void main() {
  float sp = mix(uSpeed.x, uSpeed.y, aSeed.z);
  float t = uTime * uMove;
  float x;
  float y;
  if (uKind < 3.0) {
    // dust: drifting slowly left and down
    x = fract(aSeed.x - t * sp);
    y = fract(aSeed.y + t * sp * 0.6 + 0.01 * sin(t * 0.3 + aSeed.z * 20.0));
    vFade = 1.0;
  } else {
    // flakes: rising, fading as they rise, easing in from the bottom
    x = fract(aSeed.x + 0.01 * sin(t * 0.5 + aSeed.z * 30.0));
    y = fract(aSeed.y - t * sp);
    vFade = y * (1.0 - smoothstep(0.9, 1.0, y));
  }
  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  gl_PointSize = mix(uSize.x, uSize.y, fract(aSeed.z * 7.0));
}
`;

export const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float vFade;
out vec4 outColor;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) { discard; }
  outColor = vec4(uColor * uAlpha * vFade, 1.0);
}
`;

/** Every uniform the JS sets, by program: the tests check each is declared in the source. */
export const MAIN_UNIFORMS = ["uClean", "uA", "uB", "uNoise", "uRes", "uTime", "uFrame", "uKindA", "uKindB", "uAmtA", "uAmtB", "uBreath", "uPeriod", "uGrain", "uBurst", "uBurstId", "uTearPx", "uSplit", "uGlitch", "uBlockCount", "uBlocks", "uSwap", "uMove"] as const;
export const PARTICLE_UNIFORMS = ["uTime", "uKind", "uSize", "uSpeed", "uMove", "uColor", "uAlpha"] as const;

// ---------------------------------------------------------------------------------------------
// The renderer: WebGL2 only. It is handed a context and does nothing else with the page.

export type LoadImage = (url: string) => Promise<TexImageSource | null>;

export const defaultLoadImage: LoadImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

export interface FxRenderer {
  /** Point it at a still's stack. Textures load in the background; `ready()` says when a frame can be drawn. */
  setScene(plan: FxPlan, cleanUrl: string): void;
  ready(): boolean;
  /** Draw one frame at `tSec` since the view began. */
  frame(tSec: number, frameNo: number): FrameState | null;
  destroy(): void;
}

export interface RendererDeps {
  readonly loadImage?: LoadImage;
  readonly reduced?: boolean;
  /** Called once the textures of the current scene are all in. */
  readonly onReady?: () => void;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("fx: no shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`fx: ${gl.getShaderInfoLog(shader) ?? "shader failed"}`);
  return shader;
}

function program(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error("fx: no program");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`fx: ${gl.getProgramInfoLog(p) ?? "link failed"}`);
  return p;
}

/** Throws if the programs do not compile or link: the caller then keeps the opacity stack. */
export function createFxRenderer(gl: WebGL2RenderingContext, deps: RendererDeps = {}): FxRenderer {
  const loadImage = deps.loadImage ?? defaultLoadImage;
  const reduced = deps.reduced ?? false;
  const main = program(gl, VERTEX, FRAGMENT);
  const dots = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
  const loc = new Map<string, WebGLUniformLocation | null>();
  const at = (p: WebGLProgram, tag: string, name: string) => {
    const key = `${tag}.${name}`;
    if (!loc.has(key)) loc.set(key, gl.getUniformLocation(p, name));
    return loc.get(key) ?? null;
  };

  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const sets = new Map<FxStage, { vao: WebGLVertexArrayObject | null; buf: WebGLBuffer | null }>();
  for (const stage of STAGES) {
    if (!particleCount(stage)) continue;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, particleSeeds(stage), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    sets.set(stage, { vao, buf });
  }
  gl.bindVertexArray(null);

  const textures = new Map<string, WebGLTexture | null>();
  const loading = new Map<string, Promise<void>>();
  let scene: { plan: FxPlan; urls: string[] } | null = null;
  let token = 0;
  let isReady = false;

  function upload(url: string, image: TexImageSource | null, repeat: boolean): void {
    if (!image) {
      textures.set(url, null);
      return;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    textures.set(url, tex);
  }

  function need(url: string, repeat = false): Promise<void> {
    if (textures.has(url)) return Promise.resolve();
    let p = loading.get(url);
    if (!p) {
      p = loadImage(url)
        .then((img) => upload(url, img, repeat))
        .catch(() => void textures.set(url, null));
      loading.set(url, p);
    }
    return p;
  }

  const photoUrl = (plan: FxPlan, l: FxLayer) => `/room/fx/${plan.view}_${l.stage}.jpg`;

  const api: FxRenderer = {
    setScene(plan, cleanUrl) {
      const urls = [cleanUrl, ...plan.layers.map((l) => photoUrl(plan, l)), FX.noise];
      scene = { plan, urls };
      isReady = false;
      const mine = ++token;
      void Promise.all([need(cleanUrl), ...plan.layers.map((l) => need(photoUrl(plan, l))), need(FX.noise, true)]).then(() => {
        if (mine !== token || !scene) return;
        isReady = urls.every((u) => textures.get(u));
        if (isReady) deps.onReady?.();
      });
    },
    ready: () => isReady,
    frame(tSec, frameNo) {
      if (!scene || !isReady) return null;
      const { plan, urls } = scene;
      const state = frameState(plan, tSec, reduced);
      const t = reduced ? 0 : tSec;
      gl.viewport(0, 0, FX.size.w, FX.size.h);
      gl.disable(gl.BLEND);
      gl.useProgram(main);
      const unit = (n: number, url: string | undefined) => {
        gl.activeTexture(gl.TEXTURE0 + n);
        gl.bindTexture(gl.TEXTURE_2D, textures.get(url ?? urls[0]!) ?? null);
      };
      unit(0, urls[0]);
      unit(1, urls[1] ?? urls[0]);
      unit(2, urls[2] && plan.layers.length > 1 ? urls[2] : urls[1] ?? urls[0]);
      unit(3, FX.noise);
      const u = (name: string) => at(main, "main", name);
      gl.uniform1i(u("uClean"), 0);
      gl.uniform1i(u("uA"), 1);
      gl.uniform1i(u("uB"), 2);
      gl.uniform1i(u("uNoise"), 3);
      gl.uniform2f(u("uRes"), FX.size.w, FX.size.h);
      gl.uniform1f(u("uTime"), t);
      gl.uniform1f(u("uFrame"), reduced ? 0 : frameNo);
      gl.uniform1f(u("uKindA"), state.kindA);
      gl.uniform1f(u("uKindB"), state.kindB);
      gl.uniform1f(u("uAmtA"), state.amtA);
      gl.uniform1f(u("uAmtB"), state.amtB);
      gl.uniform1f(u("uBreath"), state.breath);
      gl.uniform1f(u("uPeriod"), state.period);
      gl.uniform1f(u("uGrain"), state.grain);
      gl.uniform1f(u("uBurst"), state.burst);
      gl.uniform1f(u("uBurstId"), state.burstId);
      gl.uniform1f(u("uTearPx"), state.tearPx);
      gl.uniform1f(u("uSplit"), state.split);
      gl.uniform1f(u("uGlitch"), state.glitch);
      gl.uniform1f(u("uBlockCount"), state.blocks.length);
      const blocks = new Float32Array(MAX_BLOCKS * 4);
      state.blocks.forEach((b, i) => blocks.set([b.col, b.row, b.dx, b.dy], i * 4));
      gl.uniform4fv(u("uBlocks"), blocks);
      gl.uniform1f(u("uSwap"), state.swap);
      gl.uniform1f(u("uMove"), state.move);
      gl.bindVertexArray(quad);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // The particles: an additive second pass in the same context. Reduced motion has none.
      if (!reduced) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(dots);
        for (const l of plan.layers) {
          const cfg = FX.particles[l.stage];
          const set = sets.get(l.stage);
          if (!cfg || !set) continue;
          const d = (name: string) => at(dots, "dots", name);
          gl.uniform1f(d("uTime"), t);
          gl.uniform1f(d("uKind"), KIND[l.stage]);
          gl.uniform2f(d("uSize"), cfg.size[0], cfg.size[1]);
          gl.uniform2f(d("uSpeed"), cfg.speed[0], cfg.speed[1]);
          gl.uniform1f(d("uMove"), state.move);
          gl.uniform3f(d("uColor"), cfg.color[0], cfg.color[1], cfg.color[2]);
          gl.uniform1f(d("uAlpha"), cfg.alpha * l.opacity);
          gl.bindVertexArray(set.vao);
          gl.drawArrays(gl.POINTS, 0, cfg.count);
        }
        gl.disable(gl.BLEND);
      }
      gl.bindVertexArray(null);
      return state;
    },
    destroy() {
      token++;
      scene = null;
      isReady = false;
      for (const tex of textures.values()) if (tex) gl.deleteTexture(tex);
      textures.clear();
      loading.clear();
      gl.deleteProgram(main);
      gl.deleteProgram(dots);
    },
  };
  return api;
}
