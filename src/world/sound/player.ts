// The Web Audio side of the sound layer (sound spec FR3). One AudioContext, made on the first user
// gesture and never at load. It plays whatever the latest `SoundPlan` says and nothing else:
//
//   bed    source → lowpass → gain → bus ─┐
//   hum    50 Hz sine → gain ─────────────┴→ master → destination
//   music  source → gain ────────────────────────────↗
//
// The bus carries the room tone and the hum, so the seeded dropouts (the only randomness) cut
// those and not the music; `master` carries mute and the hidden tab. A file that is missing or
// will not decode is silence, never an error, and nothing here throws.
import { playSfx as defaultPlaySfx } from "@world/loop/sfx";
import { DUCK_MS, type SoundPlan } from "./plan";
import { musicFiles, sfxFileUrl, soundTable, type Degrade, type SoundTable } from "./table";
import type { BabblePlan } from "./babble";
import { babbleContext, playBabble } from "./babble-player";

/** The small slice of the Web Audio API used here; the real classes fit, and tests fake it. */
export interface AParam {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  setValueCurveAtTime(values: Float32Array, time: number, duration: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface ANode {
  connect(to: ANode): unknown;
  disconnect(): void;
}
export interface AGain extends ANode {
  readonly gain: AParam;
}
export interface AFilter extends ANode {
  type: string;
  readonly frequency: AParam;
}
export interface ASource extends ANode {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface AOsc extends ANode {
  type: string;
  readonly frequency: { value: number };
  start(when?: number): void;
}
export interface AContext {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: ANode;
  createGain(): AGain;
  createBiquadFilter(): AFilter;
  createBufferSource(): ASource;
  createOscillator(): AOsc;
  decodeAudioData(bytes: ArrayBuffer): Promise<unknown>;
  resume(): Promise<void>;
}

/** What `armGestures` listens on (the window). */
export interface GestureTarget {
  addEventListener(type: string, fn: () => void, opts?: { capture?: boolean }): void;
  removeEventListener(type: string, fn: () => void, opts?: { capture?: boolean }): void;
}
interface VisibilityDoc {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", fn: () => void): void;
  removeEventListener(type: "visibilitychange", fn: () => void): void;
}
type Store = Pick<Storage, "getItem" | "setItem">;

export interface PlayerDeps {
  readonly table?: SoundTable;
  /** Makes the context (default: the browser's); null = no Web Audio here. */
  readonly createContext?: () => AContext | null;
  /** The bytes of a file, or null if it is missing (default: fetch). */
  readonly fetchBytes?: (url: string) => Promise<ArrayBuffer | null>;
  /** One-shots (stingers) go through the existing sfx path. */
  readonly playSfx?: (id: string, muted: boolean) => void;
  /** Where `muted` lives (default: localStorage). */
  readonly storage?: Store | null;
  readonly doc?: VisibilityDoc | null;
  readonly timers?: { set(fn: () => void, ms: number): unknown; clear(id: unknown): void };
}

export interface SoundPlayer {
  readonly muted: boolean;
  /** Master gain to 0 now (not a suspend: unmuting is instant). Persisted. */
  setMuted(muted: boolean): void;
  /** Plays this plan. The same plan again is a no-op; before the first gesture it only waits. */
  apply(plan: SoundPlan): void;
  /** Makes the context (first call) or wakes it. Called from a user gesture. */
  unlock(): void;
  /** Called with a music id when a tune that does not loop plays to its end (the walkman lets go). */
  onTuneEnd(fn: ((id: string) => void) | null): void;
  /** Calls `unlock` on the first click, key or touch on `target`. */
  armGestures(target: GestureTarget): void;
  /** Resolves when every file asked for so far has been fetched (or has failed). */
  idle(): Promise<void>;
  /**
   * voice-babble R3: plays a voice note's babble live on this context, into the master, at `gain`
   * (the table's, or 0 when muted). One at a time: a new one stops the last. Returns its stop.
   */
  babble?(plan: BabblePlan, gain: number): () => void;
  destroy(): void;
}

/** The localStorage key for `muted`: its own key, so no run or ending ever clears it. */
export const MUTE_KEY = "nt_muted";
/** Bed changes crossfade over this long (equal power). */
export const CROSSFADE_S = 2;
/** Level changes inside one bed, and the hidden tab, ramp over this long. */
export const RAMP_S = 0.5;
/** A dropout comes back with this ramp. */
export const DROPOUT_RAMP_S = 0.02;
/** How far ahead dropouts are laid out, and how often the timer lays out more. */
export const DROPOUT_HORIZON_S = 300;
export const HUM_HZ = 50;

export function readMuted(storage: Store | null | undefined): boolean {
  try {
    return storage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function browserStorage(): Store | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function browserContext(): AContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: new () => unknown; webkitAudioContext?: new () => unknown };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? (new Ctor() as unknown as AContext) : null;
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  if (typeof fetch === "undefined") return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  // A dev server answers a missing file with the page itself.
  if ((res.headers.get("content-type") ?? "").includes("text/html")) return null;
  return res.arrayBuffer();
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

/** An equal-power curve from one level to another: out·cos + in·sin, so a crossfade keeps its loudness. */
export function equalPowerCurve(from: number, to: number, points = 64): Float32Array {
  const curve = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * (Math.PI / 2);
    curve[i] = from * Math.cos(x) + to * Math.sin(x);
  }
  return curve;
}

/**
 * Dropout times for a seed: Poisson-ish arrivals at `dropoutsPerMin`, each lasting a random
 * length in `dropoutMs`. Pure and deterministic; `from` is when to start counting (seconds).
 */
export function dropoutTimes(rng: () => number, d: Degrade, from: number, to: number): { at: number; len: number }[] {
  const out: { at: number; len: number }[] = [];
  const rate = d.dropoutsPerMin / 60;
  if (rate <= 0 || d.dropoutMs[1] <= 0) return out;
  let t = from;
  for (;;) {
    t += -Math.log(1 - rng()) / rate;
    if (t > to) break;
    const len = (d.dropoutMs[0] + rng() * (d.dropoutMs[1] - d.dropoutMs[0])) / 1000;
    out.push({ at: t, len });
    t += len + DROPOUT_RAMP_S;
  }
  return out;
}

interface Voice {
  readonly id: string;
  /** What makes two music plans the same tune: id, file, and whether it is degraded. */
  readonly key?: string;
  readonly source: ASource;
  readonly gain: AGain;
  readonly nodes: readonly ANode[];
  readonly fadeOutMs: number;
  level: number;
  filter?: AFilter;
  hz?: number;
}

export function createSoundPlayer(deps: PlayerDeps = {}): SoundPlayer {
  const table = deps.table ?? soundTable;
  const storage = deps.storage === undefined ? browserStorage() : deps.storage;
  const doc = deps.doc === undefined ? (typeof document === "undefined" ? null : (document as unknown as VisibilityDoc)) : deps.doc;
  const makeContext = deps.createContext ?? browserContext;
  const getBytes = deps.fetchBytes ?? fetchBytes;
  const sfx = deps.playSfx ?? defaultPlaySfx;
  const timers = deps.timers ?? { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>) };

  let muted = readMuted(storage);
  let hidden = doc?.hidden ?? false;
  let ctx: AContext | null = null;
  let master: AGain | null = null;
  let bus: AGain | null = null;
  let humGain: AGain | null = null;
  /** Between the bus and the master: the room goes quiet on the screen (stingers do not pass here). */
  let duck: AGain | null = null;
  let duckValue = 1;
  let masterValue = 1;
  let humValue = 0;
  let bed: Voice | null = null;
  /** The rain under the room bed on rain days (weather by day). */
  let rain: Voice | null = null;
  let music: Voice | null = null;
  let endedKey: string | null = null;
  let onTuneEnd: ((id: string) => void) | null = null;
  let wanted: SoundPlan | null = null;
  let wantedKey = "";
  let drop: { rng: () => number; t: number; degrade: Degrade; timer: unknown } | null = null;
  const loads = new Map<string, Promise<unknown | null>>();
  const pending = new Set<Promise<unknown>>();
  const armed: { target: GestureTarget; fn: () => void }[] = [];
  /** The babble playing now (voice-babble R3), as its stop. */
  let babbling: (() => void) | null = null;
  const stopBabble = (): void => {
    const s = babbling;
    babbling = null;
    try {
      s?.();
    } catch {
      /* already gone */
    }
  };

  /** The player never throws: whatever goes wrong is silence. */
  const safe =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A): void => {
      try {
        fn(...args);
      } catch {
        /* silence is fine */
      }
    };

  const now = (): number => ctx!.currentTime;

  /** value → value over `sec`, along an equal-power curve or a straight ramp. */
  function fade(p: AParam, from: number, to: number, sec: number, curve: boolean): void {
    const t = now();
    p.cancelScheduledValues(t);
    if (sec <= 0) {
      p.setValueAtTime(to, t);
      return;
    }
    if (curve) {
      try {
        p.setValueCurveAtTime(equalPowerCurve(from, to), t, sec);
        return;
      } catch {
        // A curve cannot start inside another one; a straight ramp can.
        p.cancelScheduledValues(t);
      }
    }
    p.setValueAtTime(from, t);
    p.linearRampToValueAtTime(to, t + sec);
  }

  function setMaster(rampSec: number): void {
    if (!ctx || !master) return;
    const target = muted || hidden ? 0 : 1;
    fade(master.gain, masterValue, target, rampSec, false);
    masterValue = target;
  }

  function load(file: string): Promise<unknown | null> {
    const url = sfxFileUrl(file);
    let p = loads.get(url);
    if (!p) {
      const c = ctx!;
      p = getBytes(url)
        .then((bytes) => (bytes ? c.decodeAudioData(bytes) : null))
        .catch(() => null);
      loads.set(url, p);
      pending.add(p);
      void p.finally(() => pending.delete(p!));
    }
    return p;
  }

  function release(v: Voice): void {
    v.source.onended = () => {
      for (const n of v.nodes) {
        try {
          n.disconnect();
        } catch {
          /* already gone */
        }
      }
    };
  }

  function fadeOut(v: Voice, sec: number, curve: boolean): void {
    fade(v.gain.gain, v.level, 0, sec, curve);
    v.level = 0;
    v.source.stop(now() + sec);
    release(v);
  }

  // The room tone.
  function bedTarget(plan: SoundPlan, id: string): number {
    return plan.degrade.gain * table.beds[id]!.gain * plan.bedLevel;
  }

  function trimBed(v: Voice, plan: SoundPlan): void {
    const to = bedTarget(plan, v.id);
    if (v.filter && v.hz !== plan.degrade.lowpassHz) {
      const f = v.filter.frequency;
      const t = now();
      f.cancelScheduledValues(t);
      f.setValueAtTime(v.hz ?? plan.degrade.lowpassHz, t);
      f.linearRampToValueAtTime(plan.degrade.lowpassHz, t + RAMP_S);
      v.hz = plan.degrade.lowpassHz;
    }
    if (v.level !== to) {
      fade(v.gain.gain, v.level, to, RAMP_S, false);
      v.level = to;
    }
  }

  function startBed(id: string, buffer: unknown, plan: SoundPlan): void {
    const c = ctx!;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = plan.degrade.lowpassHz;
    const gain = c.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus!);
    source.start();
    const to = bedTarget(plan, id);
    fade(gain.gain, 0, to, CROSSFADE_S, true);
    bed = { id, source, gain, nodes: [source, filter, gain], fadeOutMs: CROSSFADE_S * 1000, level: to, filter, hz: plan.degrade.lowpassHz };
  }

  function setBed(plan: SoundPlan): void {
    const id = plan.bed !== null && Object.prototype.hasOwnProperty.call(table.beds, plan.bed) ? plan.bed : null;
    if (bed && bed.id === id) return trimBed(bed, plan);
    if (id === null) {
      if (bed) fadeOut(bed, CROSSFADE_S, true);
      bed = null;
      return;
    }
    // A different bed: the old one goes out as the new one comes in, once the new file is here.
    // If it never comes, the old one goes out anyway; the room does not keep a stale tone.
    const p = load(table.beds[id]!.src).then(
      safe((buffer) => {
        const latest = wanted;
        if (!ctx || !latest || latest.bed !== id || bed?.id === id) return;
        if (bed) fadeOut(bed, CROSSFADE_S, true);
        bed = null;
        if (buffer) startBed(id, buffer, latest);
      }),
    );
    pending.add(p);
    void p.finally(() => pending.delete(p));
  }

  /** The rain loop under the room bed: in on rain days, out on the others (a crossfade either way). */
  function setRain(plan: SoundPlan): void {
    const has = Object.prototype.hasOwnProperty.call(table.beds, "rain");
    const to = has && (plan.rain ?? 0) > 0 ? table.beds.rain!.gain * plan.rain : 0;
    if (rain) {
      if (to === 0) {
        fadeOut(rain, CROSSFADE_S, true);
        rain = null;
      } else if (rain.level !== to) {
        fade(rain.gain.gain, rain.level, to, RAMP_S, false);
        rain.level = to;
      }
      return;
    }
    if (to === 0) return;
    const p = load(table.beds.rain!.src).then(
      safe((buffer) => {
        const latest = wanted;
        if (!ctx || !latest || !((latest.rain ?? 0) > 0) || rain || !buffer) return;
        const c = ctx;
        const source = c.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = c.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(bus!);
        source.start();
        const level = table.beds.rain!.gain * latest.rain;
        fade(gain.gain, 0, level, CROSSFADE_S, true);
        rain = { id: "rain", source, gain, nodes: [source, gain], fadeOutMs: CROSSFADE_S * 1000, level };
      }),
    );
    pending.add(p);
    void p.finally(() => pending.delete(p));
  }

  function setHum(plan: SoundPlan): void {
    if (!humGain) return;
    const to = plan.bed !== null ? plan.degrade.humGain : 0;
    if (to !== humValue) {
      fade(humGain.gain, humValue, to, RAMP_S, false);
      humValue = to;
    }
  }

  // Dropouts: laid out ahead on the bus with the plan's seed, and extended by a timer.
  function layDropouts(to: number): void {
    if (!bus || !drop) return;
    const g = bus.gain;
    for (const { at, len } of dropoutTimes(drop.rng, drop.degrade, drop.t, to)) {
      g.setValueAtTime(0, at);
      g.setValueAtTime(0, at + len);
      g.linearRampToValueAtTime(1, at + len + DROPOUT_RAMP_S);
    }
    drop.t = to;
  }

  function scheduleDropouts(plan: SoundPlan): void {
    if (drop) timers.clear(drop.timer);
    drop = null;
    if (!bus) return;
    const t = now();
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(1, t);
    if (plan.bed === null && !(plan.music !== null && plan.musicDegrade && plan.musicGain > 0)) return;
    drop = { rng: rngOf(plan.seed), t, degrade: plan.degrade, timer: null };
    const extend = safe(() => {
      if (!ctx || !drop) return;
      layDropouts(drop.t + DROPOUT_HORIZON_S);
      drop.timer = timers.set(extend, (DROPOUT_HORIZON_S - 60) * 1000);
    });
    layDropouts(t + DROPOUT_HORIZON_S);
    drop.timer = timers.set(extend, (DROPOUT_HORIZON_S - 60) * 1000);
  }

  // The music. A day / night track goes through the ring's lowpass and, by the bus, its dropouts;
  // the theme, the dream and the endings' tunes go to the master clean. The hum never touches it.
  const musicKeyOf = (plan: SoundPlan, id: string): string => `${id}|${musicFiles(table.music[id]!.src, plan.voice, plan.lang)[0]}|${plan.musicDegrade ? 1 : 0}`;
  const musicTarget = (plan: SoundPlan, id: string): number => table.music[id]!.gain * plan.musicGain;

  function trimMusic(v: Voice, plan: SoundPlan): void {
    const to = musicTarget(plan, v.id);
    if (v.filter && v.hz !== plan.degrade.lowpassHz) {
      const f = v.filter.frequency;
      const t = now();
      f.cancelScheduledValues(t);
      f.setValueAtTime(v.hz ?? plan.degrade.lowpassHz, t);
      f.linearRampToValueAtTime(plan.degrade.lowpassHz, t + RAMP_S);
      v.hz = plan.degrade.lowpassHz;
    }
    if (v.level !== to) {
      fade(v.gain.gain, v.level, to, RAMP_S, false);
      v.level = to;
    }
  }

  function startMusic(key: string, id: string, buffer: unknown, plan: SoundPlan): void {
    const c = ctx!;
    const def = table.music[id]!;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.loop = def.loop;
    const gain = c.createGain();
    gain.gain.value = 0;
    const nodes: ANode[] = [source, gain];
    let filter: AFilter | undefined;
    if (plan.musicDegrade) {
      filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = plan.degrade.lowpassHz;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus!);
      nodes.push(filter);
    } else {
      source.connect(gain);
      gain.connect(master!);
    }
    source.start();
    const to = musicTarget(plan, id);
    fade(gain.gain, 0, to, plan.fade.in / 1000, false);
    const voice: Voice = { id, key, source, gain, nodes, fadeOutMs: plan.fade.out, level: to, filter, hz: filter ? plan.degrade.lowpassHz : undefined };
    // A tune that is not a loop ends by itself, and is not started again by the same plan.
    source.onended = () => {
      for (const n of voice.nodes) n.disconnect();
      if (music !== voice) return;
      music = null;
      endedKey = key;
      onTuneEnd?.(id);
    };
    music = voice;
  }

  /** The first file that loads: the one for this voice and language, then the m / zh one. */
  async function loadFirst(files: readonly string[]): Promise<unknown | null> {
    for (const file of files) {
      const buffer = await load(file);
      if (buffer) return buffer;
    }
    return null;
  }

  function setMusic(plan: SoundPlan): void {
    const id = plan.music !== null && Object.prototype.hasOwnProperty.call(table.music, plan.music) && plan.musicGain > 0 ? plan.music : null;
    const key = id === null ? null : musicKeyOf(plan, id);
    if (endedKey !== null && endedKey !== key) endedKey = null;
    if (music && key !== null && music.key === key) return trimMusic(music, plan);
    if (key === null) {
      if (music) fadeOut(music, music.fadeOutMs / 1000, false);
      music = null;
      return;
    }
    if (endedKey === key) return;
    const p = loadFirst(musicFiles(table.music[id!]!.src, plan.voice, plan.lang)).then(
      safe((buffer) => {
        const latest = wanted;
        if (!ctx || !latest || latest.music === null || latest.music !== id || musicKeyOf(latest, id!) !== key || music?.key === key) return;
        if (music) fadeOut(music, music.fadeOutMs / 1000, false);
        music = null;
        if (buffer) startMusic(key, id!, buffer, latest);
      }),
    );
    pending.add(p);
    void p.finally(() => pending.delete(p));
  }

  const run = safe((plan: SoundPlan, prev: SoundPlan | null): void => {
    if (!ctx) return;
    setDuck(plan);
    setHum(plan);
    setBed(plan);
    setMusic(plan);
    // Last, so its nodes come after the bed's and the music's.
    setRain(plan);
    const live = (p: SoundPlan) => p.bed !== null || (p.music !== null && p.musicDegrade && p.musicGain > 0);
    const dropsChanged = !prev || prev.seed !== plan.seed || live(prev) !== live(plan) || JSON.stringify(prev.degrade) !== JSON.stringify(plan.degrade);
    if (dropsChanged) scheduleDropouts(plan);
    if (plan.stinger !== null && (!prev || prev.stinger !== plan.stinger || prev.seed !== plan.seed)) sfx(plan.stinger, muted);
  });

  /** The bed and the day / night music duck on the screen and come back, over DUCK_MS. */
  function setDuck(plan: SoundPlan): void {
    const to = plan.duck ?? 1;
    if (!duck || to === duckValue) return;
    fade(duck.gain, duckValue, to, DUCK_MS / 1000, false);
    duckValue = to;
  }

  const onVisibility = safe(() => {
    hidden = doc?.hidden ?? false;
    setMaster(RAMP_S);
  });
  doc?.addEventListener("visibilitychange", onVisibility);

  const player: SoundPlayer = {
    get muted() {
      return muted;
    },
    setMuted: safe((next: boolean) => {
      if (next === muted) return;
      muted = next;
      try {
        storage?.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* a full or blocked store only costs the memory */
      }
      setMaster(0);
    }),
    apply(plan) {
      const key = JSON.stringify(plan);
      if (key === wantedKey) return;
      const prev = wanted;
      wanted = plan;
      wantedKey = key;
      if (ctx) run(plan, prev);
    },
    unlock: safe(() => {
      if (ctx) {
        if (ctx.state === "suspended") void ctx.resume().catch(() => {});
        return;
      }
      const made = makeContext();
      if (!made) return;
      ctx = made;
      master = ctx.createGain();
      master.gain.value = muted || hidden ? 0 : 1;
      masterValue = muted || hidden ? 0 : 1;
      master.connect(ctx.destination);
      bus = ctx.createGain();
      bus.gain.value = 1;
      humGain = ctx.createGain();
      humGain.gain.value = 0;
      humGain.connect(bus);
      duck = ctx.createGain();
      duckValue = wanted?.duck ?? 1;
      duck.gain.value = duckValue;
      duck.connect(master);
      bus.connect(duck);
      const hum = ctx.createOscillator();
      hum.type = "sine";
      hum.frequency.value = HUM_HZ;
      hum.connect(humGain);
      hum.start();
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      // Whatever was asked for before the gesture plays now.
      if (wanted) run(wanted, null);
    }),
    onTuneEnd(fn) {
      onTuneEnd = fn;
    },
    armGestures(target) {
      const fn = () => player.unlock();
      for (const type of ["pointerdown", "keydown", "touchstart"]) target.addEventListener(type, fn, { capture: true });
      armed.push({ target, fn });
    },
    async idle() {
      while (pending.size) await Promise.all([...pending]);
    },
    babble(plan, gain) {
      stopBabble();
      // A click is a gesture: the context may be made here.
      if (!ctx) player.unlock();
      const b = babbleContext(ctx);
      if (!b || !master) return () => {};
      try {
        const stop = playBabble(b, master, plan, gain);
        babbling = stop;
        return () => {
          if (babbling === stop) babbling = null;
          stop();
        };
      } catch {
        return () => {};
      }
    },
    destroy() {
      stopBabble();
      doc?.removeEventListener("visibilitychange", onVisibility);
      if (drop) timers.clear(drop.timer);
      for (const { target, fn } of armed) for (const type of ["pointerdown", "keydown", "touchstart"]) target.removeEventListener(type, fn, { capture: true });
      armed.length = 0;
      try {
        bed?.source.stop();
        music?.source.stop();
        rain?.source.stop();
      } catch {
        /* already stopped */
      }
      bed = music = null;
    },
  };
  return player;
}
