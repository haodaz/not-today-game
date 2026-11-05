// voice-babble R3 (2026-11-05): a babble plan played live on the game's own AudioContext (the sound
// player's; no audio files). Per syllable a sawtooth with a 6 Hz ±4 % vibrato, through two bandpass
// formants (f1 Q 6, f2 Q 8) summed, into a 12 ms attack / max(20 ms, 35 %) release envelope; the
// hiss is white noise through a 1200 Hz lowpass. Everything is scheduled up front on the audio
// clock from the plan; nothing runs in the audio thread. The voice's own gain is the table's
// master gain, or 0 when muted.
import type { AContext, AGain, ANode, AParam } from "./player";
import type { BabblePlan } from "./babble";

/** What the babble needs beyond the player's slice of Web Audio (the real context has all of it). */
export interface BabbleParam extends AParam {}
export interface BabbleOsc extends ANode {
  type: string;
  readonly frequency: BabbleParam;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface BabbleFilter extends ANode {
  type: string;
  readonly frequency: BabbleParam;
  readonly Q: BabbleParam;
}
export interface BabbleBuffer {
  getChannelData(channel: number): Float32Array;
}
export interface BabbleSource extends ANode {
  buffer: unknown;
  loop: boolean;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface BabbleContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  createGain(): AGain;
  createOscillator(): BabbleOsc;
  createBiquadFilter(): BabbleFilter;
  createBufferSource(): BabbleSource;
  createBuffer(channels: number, length: number, rate: number): BabbleBuffer;
}

export const VIBRATO_HZ = 6;
export const VIBRATO_DEPTH = 0.04;
export const ATTACK_S = 0.012;
export const RELEASE_MIN_S = 0.02;
export const RELEASE_SHARE = 0.35;
export const F1_Q = 6;
export const F2_Q = 8;
export const HISS_LOWPASS_HZ = 1200;

/** The context the sound player made, if it has what the babble needs. */
export function babbleContext(ctx: AContext | null): BabbleContext | null {
  const c = ctx as unknown as Partial<BabbleContext> | null;
  return c && typeof c.createBuffer === "function" && typeof c.sampleRate === "number" ? (c as BabbleContext) : null;
}

/**
 * Schedules `plan` into `out` (the player's master) at `gain`. Returns the stop: everything still
 * sounding stops now and the nodes are let go.
 */
export function playBabble(ctx: BabbleContext, out: ANode, plan: BabblePlan, gain: number): () => void {
  const t0 = ctx.currentTime + 0.02;
  const nodes: ANode[] = [];
  const sources: { stop(when?: number): void }[] = [];
  const master = ctx.createGain();
  master.gain.value = gain;
  master.connect(out);
  nodes.push(master);

  // The syllables, at 1 − hiss.
  const bus = ctx.createGain();
  bus.gain.value = 1 - plan.hiss;
  bus.connect(master);
  nodes.push(bus);
  for (const s of plan.syllables) {
    const start = t0 + s.at;
    const end = start + s.dur;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(s.hzStart, start);
    osc.frequency.linearRampToValueAtTime(s.hzEnd, end);
    // Vibrato: a 6 Hz sine of ±4 % of the pitch into the frequency.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = VIBRATO_HZ;
    const depth = ctx.createGain();
    depth.gain.value = ((s.hzStart + s.hzEnd) / 2) * VIBRATO_DEPTH;
    lfo.connect(depth);
    depth.connect(osc.frequency as unknown as ANode);
    // Two formants, summed into the envelope.
    const env = ctx.createGain();
    for (const [hz, q] of [[s.f1, F1_Q], [s.f2, F2_Q]] as const) {
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = hz;
      f.Q.value = q;
      osc.connect(f);
      f.connect(env);
      nodes.push(f);
    }
    const release = Math.max(RELEASE_MIN_S, RELEASE_SHARE * s.dur);
    env.gain.value = 0;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(1, start + ATTACK_S);
    env.gain.setValueAtTime(1, Math.max(start + ATTACK_S, end - release));
    env.gain.linearRampToValueAtTime(0, end);
    env.connect(bus);
    osc.start(start);
    osc.stop(end + 0.01);
    lfo.start(start);
    lfo.stop(end + 0.01);
    nodes.push(osc, lfo, depth, env);
    sources.push(osc, lfo);
  }

  // The hiss: white noise through a lowpass, at `hiss`.
  if (plan.hiss > 0 && plan.length > 0) {
    const len = Math.max(1, Math.ceil(plan.length * ctx.sampleRate));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Plain noise; it need not be seeded (it carries nothing).
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = false;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = HISS_LOWPASS_HZ;
    const hg = ctx.createGain();
    hg.gain.value = plan.hiss;
    noise.connect(lp);
    lp.connect(hg);
    hg.connect(master);
    noise.start(t0);
    noise.stop(t0 + plan.length);
    nodes.push(noise, lp, hg);
    sources.push(noise);
  }

  return () => {
    for (const s of sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
  };
}
