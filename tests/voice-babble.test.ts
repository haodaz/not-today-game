// voice-babble (2026-11-05): content/voice.json (R1), the babble plan (R2), the player on the
// game's own context (R3), and the voice bubble as its own play / stop button (R4). No audio files.
import { describe, expect, it } from "vitest";
import voiceRaw from "@content/voice.json";
import { recipientsOn } from "@state/replies/resolve";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { messageActions } from "@world/desktop/messages/actions";
import { renderWorkMessages } from "@world/desktop/messages/view";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { babblePlan, type BabblePlan } from "@world/sound/babble";
import { playBabble, type BabbleContext } from "@world/sound/babble-player";
import { parseVoice, voiceTable } from "@world/sound/voice-table";

const raw = () => structuredClone(voiceRaw) as any;

describe("R1 · content/voice.json", () => {
  it("loads: 18 days, the speakers' pitch, five vowels and five tones", () => {
    expect(voiceTable.days.size).toBe(18);
    expect(voiceTable.pitch.laozhou).toBe(0.82);
    expect(voiceTable.vowels).toHaveLength(5);
    expect(voiceTable.tones.zh).toHaveLength(5);
  });
  it("rejects an unknown key, a missing day, a hiss over 1, a number that is not > 0", () => {
    expect(() => parseVoice({ ...raw(), extra: 1 })).toThrow(/top level: unknown key "extra"/);
    const day = raw();
    day.days["3"].pan = 1;
    expect(() => parseVoice(day)).toThrow(/days\.3: unknown key "pan"/);
    const missing = raw();
    delete missing.days["7"];
    expect(() => parseVoice(missing)).toThrow(/days\.7: missing/);
    const loud = raw();
    loud.days["2"].hiss = 1.5;
    expect(() => parseVoice(loud)).toThrow(/days\.2\.hiss/);
    const zero = raw();
    zero.days["2"].baseHz = 0;
    expect(() => parseVoice(zero)).toThrow(/days\.2\.baseHz/);
  });
});

describe("R2 · the plan", () => {
  const TEXT = "v17 过一遍，今天下班前给我。";
  const plain = [...TEXT].filter((c) => !"，。、！？,.!? \n".includes(c)).length;
  const hzOf = (p: BabblePlan) => p.syllables.map((s) => (s.hzStart + s.hzEnd) / 2);

  it("the same inputs give the same plan; one syllable per character that is not a pause", () => {
    const a = babblePlan(TEXT, 41, "boss", 3, voiceTable, "zh");
    expect(babblePlan(TEXT, 41, "boss", 3, voiceTable, "zh")).toEqual(a);
    expect(a.syllables).toHaveLength(plain);
    // A pause is gap × 4 of silence, not a syllable: the syllable after the comma starts later.
    const row = voiceTable.days.get(3)!;
    const comma = [...TEXT].slice(0, [...TEXT].indexOf("，")).filter((c) => c !== " ").length;
    expect(a.syllables[comma]!.at - a.syllables[comma - 1]!.at).toBeCloseTo(row.syllable + row.gap + row.gap * 4, 9);
    // Another speaker or day sounds different.
    expect(babblePlan(TEXT, 41, "partner", 3, voiceTable, "zh")).not.toEqual(a);
  });

  it("without text, round(sec × 4) syllables; the length is never more than the note", () => {
    expect(babblePlan(null, 3, "boss", 1, voiceTable, "zh").syllables).toHaveLength(12);
    for (const [text, sec] of [[TEXT, 2], [null, 41], [TEXT, 41], [null, 0]] as const) {
      const p = babblePlan(text, sec, "boss", 13, voiceTable, "zh");
      expect(p.length).toBeLessThanOrEqual(sec);
      expect(p.syllables.every((s) => s.at + s.dur <= sec + 1e-9)).toBe(true);
    }
    // A 2″ note cuts a long text short.
    expect(babblePlan(TEXT, 2, "boss", 13, voiceTable, "zh").syllables.length).toBeLessThan(plain);
  });

  it("day 3 sits around 300 Hz × pitch, day 13 around 120; 老周 is lower than the boss; day 18 only hiss", () => {
    for (const [day, base] of [[3, 300], [13, 120]] as const) {
      for (const hz of hzOf(babblePlan(TEXT, 41, "boss", day, voiceTable, "en"))) {
        expect(hz).toBeGreaterThanOrEqual(base * 0.88 - 1e-9);
        expect(hz).toBeLessThanOrEqual(base * 1.12 * 1.08 + 1e-9);
      }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(hzOf(babblePlan(TEXT, 41, "laozhou", 5, voiceTable, "zh")))).toBeLessThan(mean(hzOf(babblePlan(TEXT, 41, "boss", 5, voiceTable, "zh"))));
    expect(babblePlan(TEXT, 41, "boss", 18, voiceTable, "zh")).toEqual({ syllables: [], hiss: 1, length: 6 });
    expect(babblePlan(TEXT, 4, "boss", 18, voiceTable, "zh").length).toBe(4);
    expect(babblePlan(TEXT, 41, "boss", 16, voiceTable, "zh").hiss).toBe(0.6);
  });

  it("zh glides along the tone contours; en is flat, every third syllable × 1.08", () => {
    const zh = babblePlan(TEXT, 41, "boss", 3, voiceTable, "zh").syllables;
    const contours = voiceTable.tones.zh.map(([s, e]) => e / s);
    for (const s of zh) expect(contours.some((r) => Math.abs(s.hzEnd / s.hzStart - r) < 1e-9)).toBe(true);
    expect(zh.some((s) => s.hzStart !== s.hzEnd)).toBe(true);
    const en = babblePlan(TEXT, 41, "boss", 3, voiceTable, "en").syllables;
    expect(en.every((s) => s.hzStart === s.hzEnd)).toBe(true);
    // The stress: the same wobble draw, × 1.08 on every third (the pitch draws do not depend on locale).
    en.forEach((s, i) => {
      const base = zh[i]!.hzStart / voiceTable.tones.zh.find(([a, b]) => Math.abs(zh[i]!.hzEnd / zh[i]!.hzStart - b / a) < 1e-9)![0];
      expect(s.hzStart).toBeCloseTo(i % 3 === 2 ? base * 1.08 : base, 6);
    });
  });
});

// ——— R3 · the player, on a fake context ———

class Param {
  value = 0;
  readonly events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(["set", v, t]);
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(["ramp", v, t]);
  }
  setValueCurveAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  readonly to: unknown[] = [];
  connect(n: unknown) {
    this.to.push(n);
  }
  disconnect() {}
}
class Osc extends Node {
  type = "";
  readonly frequency = new Param();
  starts: number[] = [];
  stops: (number | undefined)[] = [];
  start(t = 0) {
    this.starts.push(t);
  }
  stop(t?: number) {
    this.stops.push(t);
  }
}
class Filter extends Node {
  type = "";
  readonly frequency = new Param();
  readonly Q = new Param();
}
class Gain extends Node {
  readonly gain = new Param();
}
class Source extends Node {
  buffer: unknown = null;
  loop = true;
  stops: (number | undefined)[] = [];
  start() {}
  stop(t?: number) {
    this.stops.push(t);
  }
}
class Ctx implements BabbleContext {
  currentTime = 10;
  sampleRate = 8000;
  oscs: Osc[] = [];
  filters: Filter[] = [];
  gains: Gain[] = [];
  sources: Source[] = [];
  createGain() {
    const g = new Gain();
    this.gains.push(g);
    return g as never;
  }
  createOscillator() {
    const o = new Osc();
    this.oscs.push(o);
    return o;
  }
  createBiquadFilter() {
    const f = new Filter();
    this.filters.push(f);
    return f;
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  createBuffer(_c: number, len: number) {
    const data = new Float32Array(len);
    return { getChannelData: () => data };
  }
}

describe("R3 · the player", () => {
  it("per syllable: a sawtooth gliding hzStart → hzEnd, a 6 Hz vibrato, two bandpass formants (Q 6, Q 8), an envelope; into the master at the gain", () => {
    const ctx = new Ctx();
    const out = new Node();
    const plan = babblePlan("你好", 4, "boss", 3, voiceTable, "zh");
    const stop = playBabble(ctx, out as never, plan, 0.5);
    expect(ctx.gains[0]!.gain.value).toBe(0.5);
    expect(ctx.gains[0]!.to).toEqual([out]);
    const saws = ctx.oscs.filter((o) => o.type === "sawtooth");
    const lfos = ctx.oscs.filter((o) => o.type === "sine");
    expect(saws).toHaveLength(2);
    expect(lfos.every((l) => l.frequency.value === 6)).toBe(true);
    const s0 = plan.syllables[0]!;
    expect(saws[0]!.frequency.events).toEqual([["set", s0.hzStart, 10.02 + s0.at], ["ramp", s0.hzEnd, 10.02 + s0.at + s0.dur]]);
    const bands = ctx.filters.filter((f) => f.type === "bandpass");
    expect(bands.map((f) => [f.frequency.value, f.Q.value]).slice(0, 2)).toEqual([[s0.f1, 6], [s0.f2, 8]]);
    // No hiss on day 3.
    expect(ctx.sources).toHaveLength(0);
    stop();
    expect(saws.every((o) => o.stops.length === 2)).toBe(true);
  });

  it("the hiss: noise through a 1200 Hz lowpass at `hiss`, the syllables at 1 − hiss; muted plays at gain 0", () => {
    const ctx = new Ctx();
    const plan = babblePlan("你好", 4, "boss", 16, voiceTable, "zh");
    playBabble(ctx, new Node() as never, plan, 0);
    expect(ctx.gains[0]!.gain.value).toBe(0);
    expect(ctx.gains[1]!.gain.value).toBeCloseTo(1 - 0.6, 9);
    const lp = ctx.filters.find((f) => f.type === "lowpass")!;
    expect(lp.frequency.value).toBe(1200);
    expect(ctx.gains.at(-1)!.gain.value).toBe(0.6);
    expect(ctx.sources).toHaveLength(1);
  });
});

// ——— R4 · the bubble ———

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function rig(day = 1) {
  const store = storeAt(day);
  const session: Session = initialSession({ beat: "work", time: "12:00" });
  session.conversation = "boss";
  let now = 0;
  const timers: { at: number; fn: () => void }[] = [];
  const calls: { plan: BabblePlan; gain: number; stopped: boolean }[] = [];
  const ctx: ActionContext = {
    store,
    session,
    rerender: () => {},
    later: (ms, fn) => void timers.push({ at: now + ms, fn }),
    now: () => now,
    babble: (plan, gain) => {
      const c = { plan, gain, stopped: false };
      calls.push(c);
      return () => void (c.stopped = true);
    },
  };
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: now });
  const out = () => renderWorkMessages(app()).pane.value;
  const voices = () => [...out().matchAll(/<button type="button" class="(voice[^"]*)" data-action="voice-play" data-voice="([^"]+)"/g)].map((m) => ({ cls: m[1]!, key: m[2]! }));
  const click = (key: string) => {
    const el = /data-voice="([^"]+)" data-sec="(\d+)" data-who="([^"]*)"(?: data-text="([^"]*)")?/.exec(out().slice(out().indexOf(`data-voice="${key}"`)))!;
    messageActions["voice-play"]!(ctx, { voice: el[1], sec: el[2], who: el[3], ...(el[4] !== undefined ? { text: el[4] } : {}) } as DOMStringMap, null as never);
  };
  const wait = (ms: number) => {
    now += ms;
    for (const t of timers.splice(0)) {
      if (t.at <= now) t.fn();
      else timers.push(t);
    }
  };
  return { store, session, ctx, out, voices, click, calls, wait };
}

describe("R4 · the voice bubble", () => {
  it("is a button; click → playing on that bubble (the ″ count runs down); click again stops; nothing logged", () => {
    const r = rig(1);
    const [v] = r.voices();
    expect(v).toBeDefined();
    expect(v!.cls).toBe("voice");
    const events = r.store.getEvents().length;
    r.click(v!.key);
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0]!.gain).toBe(voiceTable.gain);
    expect(r.voices().find((x) => x.key === v!.key)!.cls).toBe("voice playing");
    const sec = Number(/data-sec="(\d+)"/.exec(r.out())![1]);
    r.wait(1000);
    expect(r.out()).toContain(`${sec - 1}″</button>`);
    r.click(v!.key);
    expect(r.calls[0]!.stopped).toBe(true);
    expect(r.session.voice).toBeNull();
    expect(r.voices().every((x) => x.cls === "voice")).toBe(true);
    expect(r.store.getEvents()).toHaveLength(events);
  });

  it("another bubble stops the first; muted plays at gain 0; it ends by itself after its length", () => {
    const r = rig(1);
    const keys = r.voices().map((v) => v.key);
    r.click(keys[0]!);
    if (keys.length > 1) {
      r.click(keys[1]!);
      expect(r.calls[0]!.stopped).toBe(true);
      expect(r.session.voice?.key).toBe(keys[1]);
    }
    r.click(r.session.voice!.key);
    r.session.muted = true;
    r.click(keys[0]!);
    expect(r.calls.at(-1)!.gain).toBe(0);
    r.wait(r.calls.at(-1)!.plan.length * 1000 + 1);
    for (let i = 0; i < 60 && r.session.voice; i++) r.wait(1000);
    expect(r.session.voice).toBeNull();
  });

  it("switching to another conversation (or 朋友圈) stops it; re-opening the same one does not", () => {
    const r = rig(1);
    const [v] = r.voices();
    r.click(v!.key);
    messageActions.conv!(r.ctx, { conv: "boss" } as DOMStringMap, null as never);
    expect(r.calls[0]!.stopped).toBe(false);
    const other = recipientsOn(1).find((id) => id !== "boss")!;
    messageActions.conv!(r.ctx, { conv: other } as DOMStringMap, null as never);
    expect(r.calls[0]!.stopped).toBe(true);
    expect(r.session.voice).toBeNull();
    messageActions.conv!(r.ctx, { conv: "boss" } as DOMStringMap, null as never);
    r.click(v!.key);
    messageActions.feed!(r.ctx, {} as DOMStringMap, null as never);
    expect(r.calls[1]!.stopped).toBe(true);
  });

  it("day 18: greyed, and it plays only hiss", () => {
    const r = rig(18);
    const v = r.voices();
    if (!v.length) return; // no voice note in 听听's open conversation that day
    expect(v[0]!.cls).toContain("hiss-only");
    r.click(v[0]!.key);
    expect(r.calls[0]!.plan.syllables).toEqual([]);
  });
});
