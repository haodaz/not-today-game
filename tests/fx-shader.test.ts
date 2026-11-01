// @vitest-environment happy-dom
// Room-scene addition 2026-11-02: the collapse breathes. The shader is not tested as pixels (there is
// no headless WebGL2 here: happy-dom has none and no GL package is installed). What is tested: the FX
// table's bounds, the seeded burst schedule, the particle counts, the generated GLSL against the
// uniforms the JS sets, the renderer against a recording fake context (the program is built, a
// day-13 frame binds the clean photo, the other photo and the noise and draws), the DOM layer's
// fallback and 30 fps / hidden-tab behaviour, and the static sound.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKDROPS } from "@world/fit";
import { fxPlan, renderFx, STAGES, type FxView } from "@world/room/fx";
import { createFxLayer, fxGlEnabled, STATIC_SFX } from "@world/room/fx/layer";
import {
  blocksFor,
  burstAt,
  burstSchedule,
  createFxRenderer,
  FRAGMENT,
  frameState,
  FX,
  KIND,
  leadOf,
  MAIN_UNIFORMS,
  MAX_BLOCKS,
  PARTICLE_FRAGMENT,
  PARTICLE_UNIFORMS,
  PARTICLE_VERTEX,
  particleCount,
  particleSeeds,
  VERTEX,
  type FxRenderer,
} from "@world/room/fx/shader";

const sfx = vi.hoisted(() => ({ calls: [] as [string, boolean][] }));
vi.mock("@world/loop/sfx", () => ({ playSfx: (id: string, muted: boolean) => void sfx.calls.push([id, muted]) }));

const plan = (day: number, view: FxView = "room") => fxPlan(day, view)!;

// ---------------------------------------------------------------------------------------------
describe("the FX table", () => {
  it("is within bounds", () => {
    expect(FX.fps).toBe(30);
    expect(FX.size).toEqual({ w: 1600, h: 900 });
    for (const stage of STAGES) {
      expect(FX.dissolve.scale[stage]).toBeGreaterThan(0);
      expect(FX.breath[stage].a).toBeGreaterThanOrEqual(0);
      expect(FX.breath[stage].a).toBeLessThan(0.02);
      expect(FX.breath[stage].period).toBeGreaterThan(0);
      expect(FX.grain[stage]).toBeGreaterThanOrEqual(0);
      expect(FX.grain[stage]).toBeLessThanOrEqual(FX.grain.burst);
      const [, weight] = FX.dissolve.octave2[stage];
      expect(weight >= 0 && weight <= 1).toBe(true);
    }
    for (const v of [FX.dissolve.softness, FX.dissolve.centreBias, FX.dissolve.topBias, FX.bursts.tearShare, FX.glitch.scanline.dark]) expect(v >= 0 && v <= 1).toBe(true);
    expect(FX.dissolve.contrast).toBeGreaterThan(0);
    for (const k of ["other", "glitch"] as const) {
      const { gapMs, lengthMs } = FX.bursts[k];
      expect(gapMs[0]).toBeGreaterThan(0);
      expect(gapMs[0]).toBeLessThan(gapMs[1]);
      expect(lengthMs[0]).toBeGreaterThan(0);
      expect(lengthMs[0]).toBeLessThan(lengthMs[1]);
    }
    expect(FX.glitch.blocks[1]).toBeLessThanOrEqual(MAX_BLOCKS);
    expect(FX.glitch.split.rest).toBeLessThan(FX.glitch.split.burst);
  });

  it("carries the spec's numbers", () => {
    expect(FX.dissolve.scale).toMatchObject({ wall: 3, other: 2, white: 1.5 });
    expect(FX.dissolve.softness).toBe(0.08);
    expect(FX.breath).toEqual({ wall: { a: 0.003, period: 7 }, other: { a: 0.008, period: 5 }, glitch: { a: 0, period: 1 }, white: { a: 0.004, period: 9 } });
    expect([FX.grain.wall, FX.grain.other, FX.grain.white, FX.grain.burst]).toEqual([0.02, 0.05, 0.04, 0.15]);
    expect(FX.bursts.other).toMatchObject({ gapMs: [4000, 15000], lengthMs: [150, 500] });
    expect(FX.bursts.glitch).toMatchObject({ gapMs: [1000, 4000], lengthMs: [150, 500] });
    expect(FX.bursts.tearPx).toBe(12);
    expect(FX.glitch).toMatchObject({ grid: [24, 14], blocks: [5, 12], jumpPx: 40, split: { rest: 2, burst: 8 }, scanline: { every: 3, dark: 0.1 } });
    expect(FX.particles.other).toMatchObject({ count: 60, size: [1, 3], alpha: 0.3 });
    expect(FX.particles.white).toMatchObject({ count: 40, size: [2, 4] });
  });
});

// ---------------------------------------------------------------------------------------------
describe("the seeded burst schedule", () => {
  it("is deterministic and seeded by (day, stage)", () => {
    expect(burstSchedule(13, "other")).toEqual(burstSchedule(13, "other"));
    expect(burstSchedule(13, "other")).not.toEqual(burstSchedule(14, "other"));
    expect(burstSchedule(16, "glitch")).not.toEqual(burstSchedule(16, "other"));
  });

  it("only other and glitch have bursts", () => {
    expect(burstSchedule(11, "wall")).toEqual([]);
    expect(burstSchedule(18, "white")).toEqual([]);
    expect(burstAt(11, "wall", 5000)).toBeNull();
  });

  it.each([["other"], ["glitch"]] as const)("%s: the gap from one burst's end to the next start, and each length, are within the stated ranges", (stage) => {
    const list = burstSchedule(16, stage);
    const { gapMs, lengthMs } = FX.bursts[stage];
    expect(list.length).toBeGreaterThan(10);
    expect(list[0]!.startMs).toBeGreaterThanOrEqual(gapMs[0]);
    expect(list[0]!.startMs).toBeLessThanOrEqual(gapMs[1]);
    list.forEach((b, i) => {
      expect(b.index).toBe(i);
      expect(b.lengthMs).toBeGreaterThanOrEqual(lengthMs[0]);
      expect(b.lengthMs).toBeLessThanOrEqual(lengthMs[1]);
      expect(b.startMs + b.lengthMs).toBeLessThan(FX.bursts.loopMs + lengthMs[1]);
      if (i > 0) {
        const gap = b.startMs - (list[i - 1]!.startMs + list[i - 1]!.lengthMs);
        expect(gap).toBeGreaterThanOrEqual(gapMs[0] - 1e-6);
        expect(gap).toBeLessThanOrEqual(gapMs[1] + 1e-6);
      }
    });
  });

  it("property: any day gives a valid, repeatable schedule", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), fc.constantFrom<"other" | "glitch">("other", "glitch"), (day, stage) => {
        const a = burstSchedule(day, stage);
        expect(burstSchedule(day, stage)).toEqual(a);
        const { gapMs } = FX.bursts[stage];
        a.forEach((b, i) => {
          if (i > 0) expect(b.startMs - (a[i - 1]!.startMs + a[i - 1]!.lengthMs)).toBeGreaterThanOrEqual(gapMs[0] - 1e-6);
        });
      }),
    );
  });

  it("burstAt: 0 outside, a rise and fall inside, and an id that differs by loop", () => {
    const b = burstSchedule(13, "other")[0]!;
    expect(burstAt(13, "other", b.startMs - 1)).toBeNull();
    expect(burstAt(13, "other", b.startMs + b.lengthMs + 1)).toBeNull();
    const mid = burstAt(13, "other", b.startMs + b.lengthMs / 2)!;
    expect(mid.env).toBeCloseTo(1, 6);
    expect(burstAt(13, "other", b.startMs + b.lengthMs * 0.1)!.env).toBeLessThan(0.5);
    expect(burstAt(13, "other", b.startMs + FX.bursts.loopMs + b.lengthMs / 2)!.id).not.toBe(mid.id);
  });

  it("block jumps: 5–12 blocks of the 24×14 grid, each up to 40 px, a channel swap; same burst, same blocks", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), fc.integer({ min: 0, max: 300 }), (day, id) => {
        const { blocks, swap } = blocksFor(day, id);
        expect(blocksFor(day, id)).toEqual({ blocks, swap });
        expect(blocks.length >= 5 && blocks.length <= 12).toBe(true);
        expect(swap >= 0 && swap < FX.glitch.swaps && Number.isInteger(swap)).toBe(true);
        for (const b of blocks) {
          expect(b.col >= 0 && b.col < 24 && b.row >= 0 && b.row < 14).toBe(true);
          expect(Math.abs(b.dx)).toBeLessThanOrEqual(40);
          expect(Math.abs(b.dy)).toBeLessThanOrEqual(40);
        }
      }),
    );
    expect(blocksFor(16, 1)).not.toEqual(blocksFor(16, 2));
  });
});

// ---------------------------------------------------------------------------------------------
describe("particles", () => {
  it("counts per stage: 60 dust motes on other, 40 flakes on white, none on wall or glitch", () => {
    expect(STAGES.map(particleCount)).toEqual([0, 60, 0, 40]);
  });

  it("seeds: (x, y, random) per particle in [0, 1), the same every time", () => {
    for (const stage of ["other", "white"] as const) {
      const s = particleSeeds(stage);
      expect(s).toHaveLength(particleCount(stage) * 3);
      expect([...s].every((v) => v >= 0 && v < 1)).toBe(true);
      expect(particleSeeds(stage)).toEqual(s);
    }
    expect(particleSeeds("wall")).toHaveLength(0);
    expect(particleSeeds("other")).not.toEqual(particleSeeds("white"));
  });
});

// ---------------------------------------------------------------------------------------------
describe("frameState: what the uniforms are", () => {
  it("day 13: other at 0.5, breathing 0.008 / 5 s, grain 0.05, no glitch", () => {
    const s = frameState(plan(13), 1, false);
    expect(s).toMatchObject({ kindA: KIND.other, kindB: 0, amtA: 0.5, amtB: 0, breath: 0.008, period: 5, grain: 0.05, glitch: 0, split: 0, move: 1 });
  });

  it("day 17: white leads (0.85 over 0.4), so it breathes 0.004 / 9 s", () => {
    const p = plan(17);
    expect(leadOf(p.layers)!.stage).toBe("white");
    expect(frameState(p, 0, false)).toMatchObject({ kindA: KIND.other, kindB: KIND.white, amtA: 0.4, amtB: 0.85, breath: 0.004, period: 9 });
  });

  it("day 16: glitch on, the RGB split rests at 2 px and widens to 8 in a burst; blocks jump only in a burst", () => {
    const p = plan(16);
    const b = burstSchedule(16, "glitch")[0]!;
    const calm = frameState(p, (b.startMs - 100) / 1000, false);
    expect(calm).toMatchObject({ glitch: 1, split: 2, burst: 0, blocks: [] });
    const mid = frameState(p, (b.startMs + b.lengthMs / 2) / 1000, false);
    expect(mid.split).toBeCloseTo(8, 6);
    expect(mid.grain).toBeCloseTo(0.15, 6);
    expect(mid.blocks.length).toBeGreaterThanOrEqual(5);
    expect(mid.burstStage).toBe("glitch");
  });

  it("reduced motion: the dissolve at the day's amount, no breathing, no bursts, no grain, nothing moves", () => {
    for (const day of [11, 13, 16, 17, 18]) {
      const p = plan(day);
      for (const t of [0, 7, 123.4]) {
        const s = frameState(p, t, true);
        expect(s).toMatchObject({ breath: 0, grain: 0, burst: 0, burstStage: null, blocks: [], move: 0 });
        expect(s.amtA).toBe(p.layers[0]!.opacity);
      }
    }
  });

  it("a burst has torn rows and more grain; outside one there is none", () => {
    const b = burstSchedule(13, "other")[0]!;
    const inside = frameState(plan(13), (b.startMs + b.lengthMs / 2) / 1000, false);
    expect(inside.burst).toBeGreaterThan(0.9);
    expect(inside.grain).toBeGreaterThan(0.14);
    expect(inside.burstStage).toBe("other");
    expect(frameState(plan(13), 0.5, false)).toMatchObject({ burst: 0, burstStage: null });
  });

  it("property: every value is finite and in its range", () => {
    fc.assert(
      fc.property(fc.integer({ min: 11, max: 19 }), fc.double({ min: 0, max: 5000, noNaN: true }), fc.boolean(), fc.constantFrom<FxView>("room", "desk", "door"), (day, t, reduced, view) => {
        const s = frameState(plan(day, view), t, reduced);
        for (const v of [s.amtA, s.amtB, s.burst, s.grain]) expect(v >= 0 && v <= 1).toBe(true);
        expect(Number.isFinite(s.breath) && Number.isFinite(s.period) && s.period > 0).toBe(true);
        expect(s.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS);
        expect(s.split >= 0 && s.split <= FX.glitch.split.burst).toBe(true);
      }),
    );
  });
});

// ---------------------------------------------------------------------------------------------
describe("the GLSL (generated from FX)", () => {
  const declared = (src: string) => new Set([...src.matchAll(/uniform\s+(?:\w+\s+)?\w+\s+(u\w+)/g)].map((m) => m[1]!));

  it("every uniform the JS sets is declared in its program, and vice versa", () => {
    expect([...declared(FRAGMENT)].sort()).toEqual([...MAIN_UNIFORMS].sort());
    const particles = new Set([...declared(PARTICLE_VERTEX), ...declared(PARTICLE_FRAGMENT)]);
    expect([...particles].sort()).toEqual([...PARTICLE_UNIFORMS].sort());
  });

  it("GLSL ES 3.00, a main, balanced braces and parentheses, no JS left in it", () => {
    for (const src of [VERTEX, FRAGMENT, PARTICLE_VERTEX, PARTICLE_FRAGMENT]) {
      expect(src.startsWith("#version 300 es\n")).toBe(true);
      expect(src).toMatch(/void main\(\)/);
      expect([...src].filter((c) => c === "{").length).toBe([...src].filter((c) => c === "}").length);
      expect([...src].filter((c) => c === "(").length).toBe([...src].filter((c) => c === ")").length);
      expect(src).not.toMatch(/undefined|NaN|\$\{|\bnull\b/);
    }
    expect(FRAGMENT).toContain("precision highp float;");
    expect(FRAGMENT).toContain("out vec4 outColor;");
  });

  it("the table's numbers are in it", () => {
    expect(FRAGMENT).toContain("const float SCALE[5] = float[5](1.0, 3.0, 2.0, 2.5, 1.5);");
    expect(FRAGMENT).toContain("const float OCT2W[5] = float[5](0.0, 0.0, 0.35, 0.0, 0.0);");
    expect(FRAGMENT).toContain("const float SOFT = 0.08;");
    expect(FRAGMENT).toContain(`uniform vec4 uBlocks[${MAX_BLOCKS}];`);
    expect(FRAGMENT).toContain("const vec2 GRID = vec2(24.0, 14.0);");
    expect(FRAGMENT).toContain("const float SCAN_EVERY = 3.0;");
  });
});

// ---------------------------------------------------------------------------------------------
// A recording fake of WebGL2: constants are numbers, methods record their calls.
function fakeGl() {
  const calls: [string, unknown[]][] = [];
  const uniforms = new Map<string, unknown[]>();
  const units = new Map<number, unknown>();
  let active = 0;
  let n = 0;
  let bound: { image?: { url: string } } | null = null;
  const consts = new Map<string, number>();
  const target = {} as Record<string, unknown>;
  const gl = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      if (/^[A-Z0-9_]+$/.test(prop)) {
        if (!consts.has(prop)) consts.set(prop, consts.size + 1);
        return consts.get(prop);
      }
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        if (prop === "getShaderParameter" || prop === "getProgramParameter") return true;
        if (prop === "getShaderInfoLog" || prop === "getProgramInfoLog") return "";
        if (prop.startsWith("create")) return { id: ++n, kind: prop };
        if (prop === "getUniformLocation") return { name: args[1] };
        if (prop === "activeTexture") active = (args[0] as number) - (consts.get("TEXTURE0") ?? 0);
        if (prop === "bindTexture") {
          bound = args[1] as typeof bound;
          units.set(active, bound);
        }
        if (prop === "texImage2D") bound!.image = args[5] as { url: string };
        if (prop.startsWith("uniform")) uniforms.set((args[0] as { name: string } | null)?.name ?? "?", args.slice(1));
        return undefined;
      };
    },
    set(_t, prop: string, v) {
      target[prop] = v;
      return true;
    },
  });
  return { gl: gl as unknown as WebGL2RenderingContext, calls, uniforms, units, consts, count: (name: string) => calls.filter(([c]) => c === name).length, named: (name: string) => calls.filter(([c]) => c === name) };
}

const loadImage = async (url: string) => ({ url }) as unknown as TexImageSource;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the renderer, against a recording fake context", () => {
  it("builds the two programs: four shaders compiled, two programs linked, a quad and a particle set per stage that has dots", () => {
    const g = fakeGl();
    createFxRenderer(g.gl, { loadImage });
    expect(g.count("compileShader")).toBe(4);
    expect(g.count("linkProgram")).toBe(2);
    expect(g.named("shaderSource").map(([, a]) => String(a[1]).startsWith("#version 300 es"))).toEqual([true, true, true, true]);
    // quad + other + white
    expect(g.count("createBuffer")).toBe(3);
  });

  it("throws when a shader does not compile, so the caller keeps the opacity stack", () => {
    const g = fakeGl();
    const bad = new Proxy(g.gl, { get: (t, p: string) => (p === "getShaderParameter" ? () => false : (t as never)[p]) });
    expect(() => createFxRenderer(bad, { loadImage })).toThrow(/fx:/);
  });

  it("day 13: the clean photo, the other photo and the noise are bound and one frame is drawn from them", async () => {
    const g = fakeGl();
    const ready = vi.fn();
    const r = createFxRenderer(g.gl, { loadImage, onReady: ready });
    expect(r.frame(0, 0)).toBeNull();
    r.setScene(plan(13), BACKDROPS.room);
    expect(r.ready()).toBe(false);
    await flush();
    expect(r.ready()).toBe(true);
    expect(ready).toHaveBeenCalledOnce();
    const state = r.frame(2, 1)!;
    expect(state.amtA).toBe(0.5);
    const url = (unit: number) => (g.units.get(unit) as { image?: { url: string } } | null)?.image?.url;
    expect([url(0), url(1), url(3)]).toEqual([BACKDROPS.room, "/room/fx/room_other.jpg", FX.noise]);
    // The uniforms a non-black frame needs: the other photo's kind and amount, a size, a time.
    expect(g.uniforms.get("uKindA")).toEqual([KIND.other]);
    expect(g.uniforms.get("uAmtA")).toEqual([0.5]);
    expect(g.uniforms.get("uRes")).toEqual([1600, 900]);
    expect(g.uniforms.get("uTime")).toEqual([2]);
    // One quad, then the 60 dust motes.
    const draws = g.named("drawArrays").map(([, a]) => [a[0], a[1], a[2]]);
    expect(draws).toEqual([[g.consts.get("TRIANGLE_STRIP"), 0, 4], [g.consts.get("POINTS"), 0, 60]]);
    expect(g.count("blendFunc")).toBe(1);
  });

  it("day 17: two stage photos, 60 + 40 particles; day 11 (wall): no particle pass", async () => {
    const g = fakeGl();
    const r = createFxRenderer(g.gl, { loadImage });
    r.setScene(plan(17), BACKDROPS.room);
    await flush();
    r.frame(0, 0);
    const url = (unit: number) => (g.units.get(unit) as { image?: { url: string } } | null)?.image?.url;
    expect([url(1), url(2)]).toEqual(["/room/fx/room_other.jpg", "/room/fx/room_white.jpg"]);
    expect(g.named("drawArrays").map(([, a]) => a[2])).toEqual([4, 60, 40]);
    const g2 = fakeGl();
    const r2 = createFxRenderer(g2.gl, { loadImage });
    r2.setScene(plan(11), BACKDROPS.room);
    await flush();
    r2.frame(0, 0);
    expect(g2.named("drawArrays")).toHaveLength(1);
  });

  it("reduced motion: the quad only, time 0, no particles", async () => {
    const g = fakeGl();
    const r = createFxRenderer(g.gl, { loadImage, reduced: true });
    r.setScene(plan(15), BACKDROPS.room);
    await flush();
    r.frame(9, 4);
    expect(g.named("drawArrays")).toHaveLength(1);
    expect(g.uniforms.get("uTime")).toEqual([0]);
    expect(g.uniforms.get("uMove")).toEqual([0]);
    expect(g.uniforms.get("uGrain")).toEqual([0]);
  });

  it("a photo that fails to load keeps it from ever being ready (the stack stays)", async () => {
    const g = fakeGl();
    const r = createFxRenderer(g.gl, { loadImage: async (u) => (u.includes("other") ? null : ({ url: u } as unknown as TexImageSource)) });
    r.setScene(plan(13), BACKDROPS.room);
    await flush();
    expect(r.ready()).toBe(false);
    expect(r.frame(0, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("the DOM layer", () => {
  let root: HTMLElement;
  beforeEach(() => {
    sfx.calls.length = 0;
    root = document.createElement("div");
    document.body.appendChild(root);
  });
  afterEach(() => {
    root.remove();
  });

  const ctxOf = (day: number, muted = false) => ({ store: { getState: () => ({ day }) }, session: { muted } }) as never;
  const stageHtml = (day: number, view: FxView = "room") => `<div class="stage room ${view}-view">${renderFx(fxPlan(day, view))?.value ?? ""}</div>`;

  function fakeRenderer() {
    let isReady = false;
    let onReady = () => {};
    const frames: number[] = [];
    let next: ReturnType<typeof frameState> | null = null;
    const r: FxRenderer & { frames: number[]; scenes: string[]; becomeReady(): void; script(s: typeof next): void } = {
      frames,
      scenes: [],
      setScene(p, clean) {
        this.scenes.push(`${p.day}:${p.view}:${clean}`);
        isReady = false;
      },
      ready: () => isReady,
      frame(t) {
        frames.push(t);
        return next ?? frameState(plan(13), t, false);
      },
      destroy() {},
      becomeReady() {
        isReady = true;
        onReady();
      },
      script(s) {
        next = s;
      },
    };
    return { r, hook: (h: { onReady: () => void }) => void (onReady = h.onReady) };
  }

  function harness(day: number, opts: { renderer?: boolean; reduced?: boolean; muted?: boolean; search?: string } = {}) {
    const fake = fakeRenderer();
    let ms = 0;
    const rafs: ((t: number) => void)[] = [];
    let hidden = false;
    const layer = createFxLayer({
      makeRenderer: opts.renderer === false ? () => null : (_c, h) => (fake.hook(h), fake.r),
      reducedMotion: () => opts.reduced ?? false,
      raf: (fn) => rafs.push(fn),
      caf: () => rafs.splice(0),
      hidden: () => hidden,
    })(root, ctxOf(day, opts.muted));
    const tick = (advance: number) => {
      ms += advance;
      const fn = rafs.shift();
      fn?.(ms);
    };
    return { fake, layer, tick, setHidden: (h: boolean) => (hidden = h), rafs };
  }

  it("no WebGL2: the canvas never appears and the opacity stack stays as it was", () => {
    root.innerHTML = stageHtml(13);
    const before = root.innerHTML;
    const h = harness(13, { renderer: false });
    h.layer.after();
    expect(root.innerHTML).toBe(before);
    expect(root.querySelector("canvas")).toBeNull();
    expect(root.querySelector(".fx")!.classList.contains("fx-gl")).toBe(false);
    expect(root.querySelectorAll(".fx-photo")).toHaveLength(1);
    // And it does not try again on every render.
    h.layer.after();
    expect(root.querySelector("canvas")).toBeNull();
  });

  it("a clean still gets no canvas and no loop", () => {
    root.innerHTML = stageHtml(9);
    const h = harness(9);
    h.layer.after();
    expect(root.querySelector("canvas")).toBeNull();
    expect(h.rafs).toHaveLength(0);
    expect(h.fake.r.scenes).toEqual([]);
  });

  it("a still with a stack gets the canvas in .fx; the stack steps aside after the first drawn frame", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13);
    h.layer.after();
    const canvas = root.querySelector<HTMLCanvasElement>(".fx canvas")!;
    expect(canvas).toBeTruthy();
    expect([canvas.width, canvas.height]).toEqual([1600, 900]);
    expect(h.fake.r.scenes).toEqual([`13:room:${BACKDROPS.room}`]);
    expect(root.querySelector(".fx")!.classList.contains("fx-gl")).toBe(false);
    h.fake.r.becomeReady();
    expect(root.querySelector(".fx")!.classList.contains("fx-gl")).toBe(true);
  });

  it("a re-render of the same still keeps the same canvas and does not restart the clock or reload", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13);
    h.layer.after();
    const canvas = root.querySelector("canvas");
    h.fake.r.becomeReady();
    root.innerHTML = stageHtml(13);
    h.layer.after();
    expect(root.querySelector("canvas")).toBe(canvas);
    expect(h.fake.r.scenes).toHaveLength(1);
    expect(root.querySelector(".fx")!.classList.contains("fx-gl")).toBe(true);
  });

  it("another day or another still loads its photos and starts again", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13);
    h.layer.after();
    root.innerHTML = stageHtml(13, "desk").replace("room-view", "desk-view");
    h.layer.after();
    expect(h.fake.r.scenes.map((s) => s.split(":").slice(0, 2).join(":"))).toEqual(["13:room", "13:desk"]);
  });

  it("30 fps: frames closer than a frame apart are skipped; time is the sum of the frames drawn", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13);
    h.layer.after();
    h.fake.r.becomeReady();
    h.fake.r.frames.length = 0;
    h.tick(1000); // the first tick sets the clock
    h.tick(10); // too soon
    h.tick(10); // too soon
    h.tick(34); // 54 ms since the last drawn one
    expect(h.fake.r.frames.length).toBe(2);
    expect(h.fake.r.frames[1]).toBeCloseTo(0.054, 3);
  });

  it("paused while the tab is hidden, and resumes without a jump", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13);
    h.layer.after();
    h.fake.r.becomeReady();
    h.tick(1000);
    h.fake.r.frames.length = 0;
    h.setHidden(true);
    h.tick(5000);
    h.tick(5000);
    expect(h.fake.r.frames).toEqual([]);
    h.setHidden(false);
    h.tick(40); // the first tick back only sets the clock
    h.tick(40);
    expect(h.fake.r.frames).toHaveLength(2);
    expect(h.fake.r.frames[1]! - h.fake.r.frames[0]!).toBeLessThan(0.1);
  });

  it("reduced motion: no loop at all, one still frame", () => {
    root.innerHTML = stageHtml(15);
    const h = harness(15, { reduced: true });
    h.layer.after();
    expect(h.rafs).toHaveLength(0);
    h.fake.r.becomeReady();
    expect(h.fake.r.frames).toHaveLength(1);
    expect(root.querySelector(".fx")!.classList.contains("fx-gl")).toBe(true);
  });

  it("a static burst plays the static sound once, as it begins; muted is passed on", () => {
    root.innerHTML = stageHtml(13);
    const h = harness(13, { muted: true });
    h.layer.after();
    h.fake.r.becomeReady();
    const b = burstSchedule(13, "other")[0]!;
    h.fake.r.script(frameState(plan(13), (b.startMs + b.lengthMs / 2) / 1000, false));
    h.tick(1000);
    h.tick(40);
    h.tick(40);
    expect(sfx.calls).toEqual([[STATIC_SFX, true]]);
    expect(STATIC_SFX).toBe("static");
    // Next burst: heard again.
    const b2 = burstSchedule(13, "other")[1]!;
    h.fake.r.script(frameState(plan(13), (b.startMs + b.lengthMs + 10) / 1000, false));
    h.tick(40);
    h.fake.r.script(frameState(plan(13), (b2.startMs + b2.lengthMs / 2) / 1000, false));
    h.tick(40);
    expect(sfx.calls).toHaveLength(2);
  });

  it("?fx=0 is the dev switch", () => {
    expect(fxGlEnabled("")).toBe(true);
    expect(fxGlEnabled("?day=13")).toBe(true);
    expect(fxGlEnabled("?fx=0")).toBe(false);
  });

  it("the fallback stack itself is unchanged: one div per layer, the glitch's flicker keyframes on day 16", () => {
    expect(renderFx(fxPlan(13, "room"))!.value).toContain('data-stage="other" style="--fx:0.5;background-image:url(/room/fx/room_other.jpg)"');
    expect(renderFx(fxPlan(16, "door"))!.value).toContain("@keyframes fx-flicker-16");
  });
});
