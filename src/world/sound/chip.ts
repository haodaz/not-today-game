// battle-sfx (2026-11-16): the battles' 8-bit sounds, made on the game's own AudioContext at the
// moment they are needed — square and triangle waves and noise bursts, the way a Game Boy did it. No
// audio files. The recipes are data (testable without audio); `playChip` schedules one on the audio
// clock and lets every node end by itself. Built on the same slice of Web Audio as the babble.
import type { ANode } from "./player";
import type { BabbleBuffer, BabbleContext } from "./babble-player";

export type ChipId = "cursor" | "text" | "hit" | "shake" | "flame" | "flash" | "throw" | "flip" | "heal" | "down" | "win" | "lose" | "stage2" | "join";

export const CHIP_IDS: readonly ChipId[] = ["cursor", "text", "hit", "shake", "flame", "flash", "throw", "flip", "heal", "down", "win", "lose", "stage2", "join"];

/** The master scale for every chip, so they sit under the music. */
export const CHIP_GAIN = 0.25;

/**
 * One voice of a chip, all times in ms from the chip's start. `osc`: a `wave` from `from` Hz (gliding
 * to `to` over `ms` when set). `noise`: white noise (`from` unused, 0), optionally through `filter`
 * sweeping its cutoff `from` → `to`. `gain` is relative (default 1); `env` is the gain's shape as
 * points spread evenly over the step (default: held, then a hard stop). `tremolo` swings the gain
 * between full and `1 − depth` at `hz` (a square LFO).
 */
export interface ChipStep {
  readonly at: number;
  readonly kind: "osc" | "noise";
  readonly wave?: "square" | "triangle";
  readonly from: number;
  readonly to?: number;
  readonly ms: number;
  readonly gain?: number;
  readonly env?: readonly number[];
  readonly filter?: { readonly type: "lowpass" | "bandpass"; readonly from: number; readonly to?: number };
  readonly tremolo?: { readonly hz: number; readonly depth: number };
}

const sq = (at: number, hz: number, ms: number, more: Partial<ChipStep> = {}): ChipStep => ({ at, kind: "osc", wave: "square", from: hz, ms, ...more });
const shift = (steps: readonly ChipStep[], by: number): ChipStep[] => steps.map((s) => ({ ...s, at: s.at + by }));

const HIT: readonly ChipStep[] = [{ at: 0, kind: "noise", from: 0, ms: 90, env: [1, 0] }, sq(0, 220, 120, { to: 60 })];
const HEAL: readonly ChipStep[] = [sq(0, 523, 60), sq(60, 659, 60), sq(120, 784, 60)];
const SHAKE_TONE = (at: number, ms: number): ChipStep => sq(at, 80, ms, { tremolo: { hz: 8, depth: 0.7 } });

export const CHIP_RECIPES: Readonly<Record<ChipId, readonly ChipStep[]>> = {
  cursor: [sq(0, 880, 40)],
  text: [sq(0, 1200, 25)],
  hit: HIT,
  shake: [SHAKE_TONE(0, 350), { at: 350, kind: "noise", from: 0, ms: 100, env: [1, 0] }],
  flame: [{ at: 0, kind: "noise", from: 0, ms: 500, gain: 0.8, env: [1, 0], filter: { type: "lowpass", from: 4000, to: 400 } }],
  flash: [{ at: 0, kind: "osc", wave: "triangle", from: 2400, ms: 60 }, { at: 60, kind: "osc", wave: "triangle", from: 1600, ms: 60 }],
  throw: [{ at: 0, kind: "noise", from: 0, ms: 250, filter: { type: "bandpass", from: 300, to: 2000 } }, ...shift(HIT, 250)],
  flip: [{ at: 0, kind: "noise", from: 0, ms: 200, gain: 1.2, env: [1, 0] }, sq(0, 110, 150, { gain: 1.2 })],
  heal: HEAL,
  down: [sq(0, 440, 125), sq(125, 330, 125), sq(250, 220, 125), sq(375, 110, 125)],
  win: [sq(0, 659, 90), sq(90, 784, 90), sq(180, 1047, 90), sq(270, 1319, 300)],
  lose: [sq(0, 196, 250), sq(250, 147, 250)],
  stage2: [{ at: 0, kind: "noise", from: 0, ms: 1200, env: [0, 0.9, 0] }, sq(0, 55, 1200, { gain: 0.6 })],
  join: [...HEAL, SHAKE_TONE(180, 150)],
};

/** What a chip needs of the context: the babble's slice (the real AudioContext has all of it). */
export type ChipContext = BabbleContext;

const NEEDED = ["createGain", "createOscillator", "createBiquadFilter", "createBufferSource", "createBuffer"] as const;
const usable = (ctx: Partial<ChipContext> | null | undefined): ctx is ChipContext =>
  !!ctx && NEEDED.every((m) => typeof ctx[m] === "function") && typeof ctx.currentTime === "number" && typeof ctx.sampleRate === "number";

/** One second of white noise per context, made once (the noise steps loop it). */
const noiseFor = new WeakMap<object, BabbleBuffer>();
function noiseBuffer(ctx: ChipContext): BabbleBuffer {
  let b = noiseFor.get(ctx);
  if (!b) {
    const len = Math.max(1, Math.round(ctx.sampleRate));
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = b.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseFor.set(ctx, b);
  }
  return b;
}

/**
 * Schedules chip `id` into `out` (the player's master) at `gain` × each step's own. Every source is
 * started and stopped up front; nothing needs to be cancelled. A context missing a method it needs
 * is silence, never an error.
 */
export function playChip(ctx: ChipContext, out: ANode, id: ChipId, gain = CHIP_GAIN): void {
  const steps = CHIP_RECIPES[id];
  if (!steps || !usable(ctx)) return;
  try {
    const t0 = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    master.gain.value = gain;
    master.connect(out);
    for (const s of steps) {
      const start = t0 + s.at / 1000;
      const end = start + s.ms / 1000;
      const g = s.gain ?? 1;
      const env = ctx.createGain();
      const pts = s.env && s.env.length > 0 ? s.env : [1];
      const base = s.tremolo ? 1 - s.tremolo.depth / 2 : 1;
      env.gain.value = g * pts[0]! * base;
      env.gain.setValueAtTime(g * pts[0]! * base, start);
      for (let i = 1; i < pts.length; i++) env.gain.linearRampToValueAtTime(g * pts[i]! * base, start + (i / (pts.length - 1)) * (end - start));
      env.connect(master);
      const sources: { start(when?: number): void; stop(when?: number): void }[] = [];
      let head: ANode;
      if (s.kind === "osc") {
        const osc = ctx.createOscillator();
        osc.type = s.wave ?? "square";
        osc.frequency.value = s.from;
        osc.frequency.setValueAtTime(s.from, start);
        if (s.to !== undefined) osc.frequency.linearRampToValueAtTime(s.to, end);
        head = osc;
        sources.push(osc);
      } else {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer(ctx);
        noise.loop = true;
        head = noise;
        sources.push(noise);
      }
      if (s.filter) {
        const f = ctx.createBiquadFilter();
        f.type = s.filter.type;
        f.frequency.value = s.filter.from;
        f.frequency.setValueAtTime(s.filter.from, start);
        if (s.filter.to !== undefined) f.frequency.linearRampToValueAtTime(s.filter.to, end);
        f.Q.value = s.filter.type === "bandpass" ? 1.5 : 0.7;
        head.connect(f);
        head = f;
      }
      head.connect(env);
      if (s.tremolo) {
        // the gain swings ±depth/2 around 1 − depth/2: between full and 1 − depth
        const lfo = ctx.createOscillator();
        lfo.type = "square";
        lfo.frequency.value = s.tremolo.hz;
        const depth = ctx.createGain();
        depth.gain.value = (g * s.tremolo.depth) / 2;
        lfo.connect(depth);
        depth.connect(env.gain as unknown as ANode);
        sources.push(lfo);
      }
      for (const src of sources) {
        src.start(start);
        src.stop(end);
      }
    }
  } catch {
    /* a context that cannot make a node: silence */
  }
}
