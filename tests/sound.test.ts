// Sound spec FR6: the strict loader, soundPlan (snapshots and properties), and the Web Audio
// player against a fake AudioContext. No real audio anywhere; no sound files are needed.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import soundFile from "@content/sound.json";
import stagesFile from "@content/stages.json";
import { f } from "@state/fday";
import { dreamNights, weatherOf, WEATHERS } from "@state/stages";
import type { State } from "@state/types.gen";
import { BEATS, type Beat } from "@world/desktop/beat";
import { RINGS } from "@world/desktop/rings";
import { DUCK_MS, ENDING_WHEN, FOG_BED, FOG_THIN, RAIN_UNDER, SCREEN_DUCK, soundPlan, titlePlan, type SoundPlan } from "@world/sound/plan";
import {
  createSoundPlayer,
  equalPowerCurve,
  dropoutTimes,
  MUTE_KEY,
  readMuted,
  rngOf,
  type AContext,
  type AFilter,
  type AGain,
  type AOsc,
  type AParam,
  type ASource,
  type PlayerDeps,
} from "@world/sound/player";
import { parseSound, soundTable, WHEN_IDS } from "@world/sound/table";

const LAST_DAY = 18;
const stateOn = (day: number, ending: State["ending"] = "none"): State => ({ ...f(day), ending });
const at = (beat: Beat) => ({ clock: { beat, time: "10:00" } });
const planOn = (day: number, beat: Beat, ending: State["ending"] = "none"): SoundPlan => soundPlan(stateOn(day, ending), at(beat), soundTable, "zh");
/** The plan with the rain under the room left out (the player tests below are about the bed and the tracks; the rain has its own). */
const dry = (p: SoundPlan): SoundPlan => ({ ...p, rain: 0 });
const planOnWet = planOn;

// ---------------------------------------------------------------------------------------------
describe("content/sound.json: strict loader", () => {
  const good = () => JSON.parse(JSON.stringify(soundFile)) as Record<string, any>;

  it("reads the file as it is", () => {
    expect(parseSound(soundFile)).toEqual(soundTable);
    expect(Object.keys(soundTable.byRing)).toEqual(expect.arrayContaining([...RINGS]));
    expect(WHEN_IDS).toEqual(["title", "dream:5", "dream:11", "dream:15", "tender-day", "ending:good", "ending:bad", "ending:leave", "credits", "walkman"]);
  });

  it.each<[string, (f: Record<string, any>) => void, RegExp]>([
    ["an unknown top-level key", (x) => void (x.volume = 1), /unknown key "volume"/],
    ["an unknown key in a bed", (x) => void (x.beds.rain.pan = 0), /unknown key "pan"/],
    ["a bed with a path in its file name", (x) => void (x.beds.rain.src = "../rain.mp3"), /plain file name/],
    ["a gain above 1", (x) => void (x.beds.rain.gain = 2), /0\.\.1/],
    ["an unknown ring", (x) => void (x.byRing.attic = x.byRing.door), /unknown ring "attic"/],
    ["a missing ring", (x) => void delete x.byRing.door, /no entry for ring "door"/],
    ["a ring using a bed that is not in beds", (x) => void (x.byRing.desk.day = "room-void"), /unknown bed "room-void"/],
    ["an unknown key in degrade", (x) => void (x.byRing.desk.degrade.reverb = 1), /unknown key "reverb"/],
    ["a missing degrade key", (x) => void delete x.byRing.desk.degrade.humGain, /missing "humGain"/],
    ["dropoutMs the wrong way round", (x) => void (x.byRing.desk.degrade.dropoutMs = [500, 100]), /above/],
    ["a calm ring that does not exist", (x) => void (x.calm = "attic"), /unknown ring/],
    ["an unknown beat in silence", (x) => void (x.silence.beats = ["dusk"]), /unknown beat "dusk"/],
    ["silence from day 0", (x) => void (x.silence.fromDay = 0), /integer >= 1/],
    ["music that is not loop true/false", (x) => void (x.music.theme.loop = "yes"), /true or false/],
    ["an unknown key in a music entry", (x) => void (x.music.theme.pan = 0), /unknown key "pan"/],
    ["an unknown placeholder in a music src", (x) => void (x.music.theme.src = "theme_{mood}.mp3"), /unknown placeholder "\{mood\}"/],
    ["a path in a music src", (x) => void (x.music.theme.src = "../theme_{voice}_{lang}.mp3"), /plain file name/],
    ["a ring track that is not in music", (x) => void (x.byRing.desk.music.day = "waltz"), /unknown music "waltz"/],
    ["an unknown key in a ring's music", (x) => void (x.byRing.desk.music.pan = 1), /unknown key "pan"/],
    ["a ring's music without a gain", (x) => void delete x.byRing.desk.music.gain, /missing "gain"/],
    ["a ring music gain above 1", (x) => void (x.byRing.desk.music.gain = 1.5), /0\.\.1/],
    ["an unknown key in a musicAt entry", (x) => void (x.musicAt[0].volume = 1), /unknown key "volume"/],
    ["a musicAt.when outside the allowed set", (x) => void (x.musicAt[0].when = "dream:7"), /not one of/],
    ["the same musicAt.when twice", (x) => void (x.musicAt[1].when = "title"), /appears twice/],
    ["a musicAt id that is not in music", (x) => void (x.musicAt[0].id = "waltz"), /unknown music "waltz"/],
    ["a negative fade", (x) => void (x.musicAt[0].fadeIn = -1), /integer >= 0/],
    ["a stinger for an unknown night-beat type", (x) => void (x.stingers.weather = "sting-soft"), /unknown night-beat type "weather"/],
    ["a stinger that is not a string", (x) => void (x.stingers.light = 3), /non-empty string/],
  ])("rejects %s", (_name, mutate, message) => {
    const x = good();
    mutate(x);
    expect(() => parseSound(x)).toThrow(message);
  });

  it("accepts the theme's {voice} and {lang}, the new `when` ids, and a `_note` in music and musicAt", () => {
    const x = good();
    expect(x.music.theme.src).toBe("theme_{voice}_{lang}.mp3");
    expect(x.musicAt.map((m: any) => m.when)).toEqual(expect.arrayContaining(["credits", "walkman"]));
    expect(parseSound(x).music.theme!.src).toBe("theme_{voice}_{lang}.mp3");
  });

  it("a ring may have no music of its own", () => {
    const x = good();
    delete x.byRing.desk.music;
    expect(parseSound(x).byRing.desk!.music).toBeNull();
    expect(soundTable.byRing.desk!.music).toEqual({ day: "day", night: "night", gain: 0.8 });
  });

  it("a stinger may be missing: not every night-beat type needs one", () => {
    const x = good();
    delete x.stingers.hand;
    expect(parseSound(x).stingers.hand).toBeUndefined();
  });

  it("rejects what is not an object", () => {
    expect(() => parseSound([])).toThrow(/not an object/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("soundPlan", () => {
  it("snapshots: days 1, 4, 7, 10 (calm day vs its night), 11 (dream), 13 (silence), 14 (tender), 16, 18", () => {
    const out: Record<string, SoundPlan> = {};
    for (const day of [1, 4, 7, 10, 11, 13, 14, 16, 18]) {
      out[`day ${day} boot`] = planOn(day, "boot");
      out[`day ${day} night`] = planOn(day, "night");
    }
    expect(out).toMatchSnapshot();
  });

  it("snapshots: the title and each ending", () => {
    expect({
      title: titlePlan(0.12, { lang: "zh" }),
      "title, rain lapsed": titlePlan(null, { lang: "zh" }),
      "title, f voice in English": titlePlan(0.12, { voice: "f", lang: "en" }),
      "credits, good": soundPlan(stateOn(18, "good"), { ...at("night"), endingPage: { phase: "credits" } }, soundTable, "zh"),
      "credits, bad": soundPlan(stateOn(9, "bad"), { ...at("work"), endingPage: { phase: "credits" } }, soundTable, "zh"),
      "credits, survive": soundPlan(stateOn(18, "survive"), { ...at("night"), endingPage: { phase: "credits" } }, soundTable, "zh"),
      "walkman off, day 3": soundPlan(stateOn(3), { ...at("work"), walkman: false }, soundTable, "zh"),
      "walkman on, day 3": soundPlan(stateOn(3), { ...at("work"), walkman: true }, soundTable, "zh"),
      "walkman on, day 13": soundPlan(stateOn(13), { ...at("work"), walkman: true }, soundTable, "zh"),
      good: planOn(18, "night", "good"),
      bad: planOn(9, "work", "bad"),
      survive: planOn(18, "night", "survive"),
    }).toMatchSnapshot();
  });

  it("the daytime bed is the ring's day bed; the night bed is its night bed", () => {
    expect(planOn(1, "work").bed).toBe(soundTable.byRing.software!.day);
    expect(planOn(1, "night").bed).toBe(soundTable.byRing.software!.night);
    expect(planOn(7, "afternoon").bed).toBe(soundTable.byRing.desk!.day);
    expect(planOn(16, "work").bed).toBe(soundTable.byRing.door!.day);
  });

  it("the desk beat is the evening (day-loop 2026-11-02): the night bed and the night music at 0.7; no dream, stinger or silence", () => {
    for (const day of [1, 4, 7, 10]) {
      const evening = planOn(day, "desk");
      const night = planOn(day, "night");
      expect(evening.bed).toBe(night.bed);
      expect(evening.music).toBe(night.music);
      expect(evening.musicGain).toBeCloseTo(night.musicGain * 0.7, 10);
      expect(evening.stinger).toBeNull();
    }
    // The dream music, the night-beat stinger and the silence belong to the night beat alone.
    for (const day of dreamNights) expect(planOn(day, "desk").music).not.toBe("dream");
    expect(planOn(13, "desk").bed).not.toBeNull();
  });
  it("day 10 is calm by day (first ring's bed and degrade) and untouched at night", () => {
    const calm = soundTable.byRing[soundTable.calm]!;
    expect(planOn(10, "work").bed).toBe(calm.day);
    expect(planOn(10, "work").degrade).toEqual(calm.degrade);
    expect(planOn(10, "night").bed).toBe(soundTable.byRing.wall!.night);
    expect(planOn(10, "night").degrade).toEqual(soundTable.byRing.wall!.degrade);
  });

  it("dream nights: the ring's night bed, halved, under the dream music; the day before and after have none", () => {
    for (const day of dreamNights) {
      const p = planOn(day, "night");
      expect(p.music).toBe("dream");
      expect(p.bedLevel).toBe(0.5);
      expect(p.fade).toEqual({ in: 4000, out: 2000 });
    }
    // The nights around them have the ring's night track, not the dream.
    expect(planOn(6, "night")).toMatchObject({ music: "night", bedLevel: 1 });
    expect(planOn(5, "work").music).toBe("day");
  });

  it("day 14: the day track at full gain under the day bed, though its ring has thinned it to nothing; its night has none", () => {
    expect(soundTable.byRing.room!.music!.gain).toBe(0);
    expect(planOn(14, "work")).toMatchObject({ music: "day", musicGain: 1, musicDegrade: true, bed: soundTable.byRing.room!.day, fade: { in: 6000, out: 3000 } });
    expect(planOn(14, "night").music).toBeNull();
    expect(planOn(13, "work").music).toBeNull();
    expect(planOn(15, "work").music).toBeNull();
  });

  it("the ring thins the day / night tracks: full, full, 0.8, 0.5, none, none", () => {
    const gains = [1, 4, 7, 10, 13, 16].map((d) => planOn(d, "night" as Beat).musicGain);
    expect(gains).toEqual([1, 1, 0.8, 0.5, 1, 1]);
    // (the last two are the plan's default for "no music"; the music id says it)
    expect([1, 4, 7, 10, 13, 16].map((d) => planOn(d, "work").music)).toEqual(["day", "day", "day", "day", null, null]);
    expect([1, 4, 7, 10, 11, 12].map((d) => planOn(d, "work").musicGain)).toEqual([1, 1, 0.8, 1, 0.5, 0.5]);
  });

  it("day 10 is calm by day (full, like ring 1) and 0.5 at night (the wall ring)", () => {
    expect(planOn(10, "work")).toMatchObject({ music: "day", musicGain: 1 });
    expect(planOn(10, "night")).toMatchObject({ music: "night", musicGain: 0.5 });
  });

  it("the day / night tracks are degraded with the ring; the dream, the endings and the theme are clean", () => {
    expect(planOn(7, "work").musicDegrade).toBe(true);
    expect(planOn(5, "night").musicDegrade).toBe(false);
    expect(planOn(18, "night", "good").musicDegrade).toBe(false);
    expect(titlePlan(0.12).musicDegrade).toBe(false);
  });

  it("the theme: voice m or f from the login pronoun (m when there is none), lang from the locale", () => {
    const named = (pronoun: "she" | "he" | null): State => ({ ...stateOn(3), names: { ...stateOn(3).names, pronoun } });
    const voiceOn = (pronoun: "she" | "he" | null) => soundPlan(named(pronoun), at("work"), soundTable, "zh").voice;
    expect([voiceOn("she"), voiceOn("he"), voiceOn(null)]).toEqual(["f", "m", "m"]);
    expect(soundPlan(stateOn(3), at("work"), soundTable, "en").lang).toBe("en");
    expect(titlePlan(0.12, { voice: "f", lang: "en" })).toMatchObject({ voice: "f", lang: "en" });
    expect(titlePlan(0.12)).toMatchObject({ voice: "m" });
  });

  it("the walkman: the theme instead of the track, the bed stays; it gives way to an ending", () => {
    const withWalkman = soundPlan(stateOn(3), { ...at("work"), walkman: true }, soundTable, "zh");
    expect(withWalkman).toMatchObject({ music: "theme", musicGain: 1, musicDegrade: false, fade: { in: 300, out: 800 }, bed: soundTable.byRing.software!.day });
    expect(soundPlan(stateOn(3), { ...at("work"), walkman: false }, soundTable, "zh").music).toBe("day");
    // From day 13 the ring has no track: the walkman is the only music there is.
    expect(soundPlan(stateOn(13), { ...at("work"), walkman: true }, soundTable, "zh").music).toBe("theme");
    expect(soundPlan(stateOn(18, "good"), { ...at("night"), walkman: true }, soundTable, "zh").music).toBe("end-stay");
  });

  it("the credits: the full song, bed off, however the run ended; the pages before them keep the ending's tune", () => {
    for (const ending of ["good", "bad", "survive"] as const) {
      const credits = soundPlan(stateOn(18, ending), { ...at("night"), endingPage: { phase: "credits" } }, soundTable, "zh");
      expect(credits).toMatchObject({ bed: null, music: "theme", fade: { in: 500, out: 0 }, musicDegrade: false, stinger: null });
      expect(soundPlan(stateOn(18, ending), { ...at("night"), endingPage: { phase: "after" } }, soundTable, "zh").music).toBe("theme");
    }
    expect(soundPlan(stateOn(18, "bad"), { ...at("night"), endingPage: { phase: "you" } }, soundTable, "zh").music).toBe("end-go");
    // endings-matrix: the song plays on through the fake day 1 and the lines; the waking keeps the ending's tune.
    for (const phase of ["tender", "lines"] as const) expect(soundPlan(stateOn(9, "collapse"), { ...at("night"), endingPage: { phase } }, soundTable, "zh").music).toBe("theme");
    expect(soundPlan(stateOn(18, "bad"), { ...at("night"), endingPage: { phase: "wake" } }, soundTable, "zh").music).toBe("end-go");
    expect(soundPlan(stateOn(18, "good"), { ...at("night"), endingPage: null }, soundTable, "zh").music).toBe("end-stay");
  });

  it("silence: from the table's day, on its beats, there is no bed", () => {
    expect(planOn(12, "night").bed).not.toBeNull();
    expect(planOn(13, "night").bed).toBeNull();
    expect(planOn(13, "work").bed).not.toBeNull();
  });

  it("stingers come from the night-beat type; a type without one has none", () => {
    expect(planOn(3, "night").stinger).toBe(soundTable.stingers.device);
    expect(planOn(3, "work").stinger).toBeNull();
    expect(planOn(1, "night").stinger).toBe(soundTable.stingers.light);
    const without = parseSound({ ...JSON.parse(JSON.stringify(soundFile)), stingers: {} });
    expect(soundPlan(stateOn(3), at("night"), without).stinger).toBeNull();
  });

  it("the endings: san-and-endings' bad / survive / good map to the table's bad / leave / good; bed off", () => {
    expect(ENDING_WHEN).toEqual({ good: "ending:good", bad: "ending:bad", survive: "ending:leave", collapse: "ending:bad" });
    for (const [ending, id] of [["good", "end-stay"], ["bad", "end-go"], ["survive", "end-go"]] as const) {
      expect(planOn(18, "night", ending)).toMatchObject({ bed: null, music: id, stinger: null });
    }
  });

  it("the title: the rain at the given volume, and the title music", () => {
    const p = titlePlan(0.12);
    expect(p.bed).toBe("rain");
    expect(p.music).toBe("theme");
    // volume = level × the bed's gain × the ring's gain
    expect(p.bedLevel * soundTable.beds.rain!.gain * p.degrade.gain).toBeCloseTo(0.12, 10);
    expect(titlePlan(null).bed).toBeNull();
    expect(titlePlan(null).music).toBe("theme");
    expect(titlePlan(0.12).fade).toEqual({ in: 2000, out: 1500 });
  });

  describe("properties", () => {
    const days = fc.integer({ min: 1, max: LAST_DAY });
    const beats = fc.constantFrom(...BEATS);

    it("from day 13 the day / night tracks are gone: the only music left is day 14's, the dream and the theme", () => {
      fc.assert(
        fc.property(fc.integer({ min: 13, max: LAST_DAY }), beats, (day, beat) => {
          const m = planOn(day, beat).music;
          if (day === 14 && beat !== "night" && beat !== "desk") expect(m).toBe("day");
          else if (dreamNights.includes(day) && beat === "night") expect(m).toBe("dream");
          else expect(m).toBeNull();
        }),
      );
    });

    it("the dream tune plays only on a dream night; no other plan names it", () => {
      fc.assert(
        fc.property(days, beats, (day, beat) => {
          expect(planOn(day, beat).music === "dream").toBe(beat === "night" && dreamNights.includes(day));
        }),
      );
    });

    it("the ring's gain thins the tracks and never raises them: monotone non-increasing from ring to ring", () => {
      const gains = RINGS.map((r) => soundTable.byRing[r]!.music!.gain);
      for (let i = 1; i < gains.length; i++) expect(gains[i]!, `${RINGS[i - 1]} → ${RINGS[i]}`).toBeLessThanOrEqual(gains[i - 1]!);
    });

    it("music is never named with a zero gain, and the walkman is the only way to the theme in the game", () => {
      fc.assert(
        fc.property(days, beats, (day, beat) => {
          const p = planOn(day, beat);
          if (p.music !== null) expect(p.musicGain).toBeGreaterThan(0);
          expect(p.music).not.toBe("theme");
        }),
      );
    });

    it("bed is null on every (day ≥ silence.fromDay, beat ∈ silence.beats), and only there", () => {
      fc.assert(
        fc.property(days, beats, (day, beat) => {
          const silent = day >= soundTable.silence.fromDay && soundTable.silence.beats.includes(beat);
          expect(planOn(day, beat).bed === null).toBe(silent);
        }),
      );
    });

    it("deterministic, and JSON-safe", () => {
      fc.assert(
        fc.property(days, beats, (day, beat) => {
          const a = planOn(day, beat);
          expect(planOn(day, beat)).toEqual(a);
          expect(JSON.parse(JSON.stringify(a))).toEqual(a);
        }),
      );
    });

    it("every bed and music a plan names is in the table", () => {
      fc.assert(
        fc.property(days, beats, fc.constantFrom<State["ending"]>("none", "none", "bad", "survive", "good"), (day, beat, ending) => {
          const p = planOn(day, beat, ending);
          if (p.bed !== null) expect(soundTable.beds).toHaveProperty(p.bed);
          if (p.music !== null) expect(soundTable.music).toHaveProperty(p.music);
        }),
      );
    });

    it("only dream nights halve the bed; fog days thin the day bed (weather by day)", () => {
      fc.assert(
        fc.property(days, beats, (day, beat) => {
          const evening = beat === "night" || beat === "desk";
          const fog = weatherOf(day) === "fog" && !evening && planOn(day, beat).bed !== null;
          expect(planOn(day, beat).bedLevel).toBeCloseTo((beat === "night" && dreamNights.includes(day) ? 0.5 : 1) * (fog ? FOG_THIN : 1), 10);
        }),
      );
    });

    it("degrade: the lowpass and the level never rise from ring to ring", () => {
      const rings = RINGS.map((r) => soundTable.byRing[r]!.degrade);
      for (let i = 1; i < rings.length; i++) {
        expect(rings[i]!.lowpassHz, `${RINGS[i - 1]} → ${RINGS[i]} lowpassHz`).toBeLessThanOrEqual(rings[i - 1]!.lowpassHz);
        expect(rings[i]!.gain, `${RINGS[i - 1]} → ${RINGS[i]} gain`).toBeLessThanOrEqual(rings[i - 1]!.gain);
      }
    });

    it("degrade: the hum never falls from ring to ring (spec FR6)", () => {
      const rings = RINGS.map((r) => soundTable.byRing[r]!.degrade);
      for (let i = 1; i < rings.length; i++) {
        expect(rings[i]!.humGain, `${RINGS[i - 1]} → ${RINGS[i]} humGain`).toBeGreaterThanOrEqual(rings[i - 1]!.humGain);
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// A fake AudioContext: a few dozen lines that record what was asked of it.
interface Ev {
  readonly type: "set" | "ramp" | "curve" | "cancel";
  readonly value?: number;
  readonly time: number;
  readonly duration?: number;
  readonly curve?: Float32Array;
}

class FakeParam implements AParam {
  value = 0;
  readonly events: Ev[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ type: "set", value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ type: "ramp", value, time });
  }
  setValueCurveAtTime(curve: Float32Array, time: number, duration: number) {
    this.events.push({ type: "curve", curve, time, duration });
  }
  cancelScheduledValues(time: number) {
    this.events.push({ type: "cancel", time });
  }
}

class FakeNode {
  readonly to: unknown[] = [];
  disconnected = false;
  connect(n: unknown) {
    this.to.push(n);
  }
  disconnect() {
    this.disconnected = true;
  }
}
class FakeGain extends FakeNode implements AGain {
  readonly gain = new FakeParam();
}
class FakeFilter extends FakeNode implements AFilter {
  type = "";
  readonly frequency = new FakeParam();
}
class FakeSource extends FakeNode implements ASource {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stops: (number | undefined)[] = [];
  start() {
    this.started = true;
  }
  stop(when?: number) {
    this.stops.push(when);
  }
}
class FakeOsc extends FakeNode implements AOsc {
  type = "";
  readonly frequency = { value: 0 };
  started = false;
  start() {
    this.started = true;
  }
}

class FakeContext implements AContext {
  currentTime = 0;
  state = "running";
  readonly destination = new FakeNode();
  /** In creation order: [master, bus, hum, …voices]. */
  readonly gains: FakeGain[] = [];
  readonly filters: FakeFilter[] = [];
  readonly sources: FakeSource[] = [];
  readonly oscs: FakeOsc[] = [];
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    const x = new FakeFilter();
    this.filters.push(x);
    return x;
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createOscillator() {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    return Promise.resolve({ decoded: bytes.byteLength });
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  get master() {
    return this.gains[0]!;
  }
  get bus() {
    return this.gains[1]!;
  }
  get hum() {
    return this.gains[2]!;
  }
  /** Between the bus and the master (sound addition 2026-11-02). */
  get duck() {
    return this.gains[3]!;
  }
}

class FakeDoc {
  hidden = false;
  private fns: (() => void)[] = [];
  addEventListener(_t: "visibilitychange", fn: () => void) {
    this.fns.push(fn);
  }
  removeEventListener(_t: "visibilitychange", fn: () => void) {
    this.fns = this.fns.filter((x) => x !== fn);
  }
  set(hidden: boolean) {
    this.hidden = hidden;
    this.fns.forEach((fn) => fn());
  }
}

class FakeStorage {
  readonly data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

/** By default only the beds exist: the day / night music then adds no sources, so bed tests count one. */
const BED_FILES = ["bed-room-day.mp3", "bed-room-night.mp3", "bed-room-deep.mp3", "rain-loop.mp3"];

function rig(over: Partial<PlayerDeps> & { files?: "all" | "none" | readonly string[] } = {}) {
  const ctx = new FakeContext();
  const doc = new FakeDoc();
  const storage = new FakeStorage();
  const fetched: string[] = [];
  const stings: [string, boolean][] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  let made = 0;
  const { files = BED_FILES, ...rest } = over;
  const player = createSoundPlayer({
    createContext: () => (made++, ctx),
    fetchBytes: async (url) => {
      fetched.push(url);
      const name = decodeURIComponent(url.replace("/sfx/", ""));
      return files === "all" || (files !== "none" && files.includes(name)) ? new ArrayBuffer(16) : null;
    },
    playSfx: (id, muted) => void stings.push([id, muted]),
    storage,
    doc,
    timers: { set: (fn, ms) => (timers.push({ fn, ms }), timers.length), clear: () => {} },
    ...rest,
  });
  return { player, ctx, doc, storage, fetched, stings, timers, made: () => made };
}

const day1 = () => dry(planOn(1, "work"));
const night1 = () => dry(planOn(1, "night"));

describe("the player (fake AudioContext)", () => {
  // Bed and track mechanics: without the rain loop (tested on its own below).
  const planOn = (day: number, beat: Beat, ending: State["ending"] = "none"): SoundPlan => dry(planOnWet(day, beat, ending));
  it("makes no context at load; before a gesture the plan only waits", async () => {
    const r = rig();
    r.player.apply(day1());
    await r.player.idle();
    expect(r.made()).toBe(0);
    expect(r.ctx.sources).toHaveLength(0);
    expect(r.fetched).toEqual([]);
  });

  it("the first gesture makes the context and plays the plan that was waiting; the graph is source → lowpass → gain → bus", async () => {
    const r = rig();
    r.player.apply(day1());
    r.player.unlock();
    await r.player.idle();
    expect(r.made()).toBe(1);
    const bed = r.ctx.sources[0]!;
    expect(r.ctx.sources).toHaveLength(1);
    expect(bed).toMatchObject({ started: true, loop: true });
    expect(r.ctx.filters).toHaveLength(1);
    expect(r.ctx.filters[0]!.type).toBe("lowpass");
    expect(r.ctx.filters[0]!.frequency.value).toBe(day1().degrade.lowpassHz);
    const voice = r.ctx.gains[4]!;
    expect(bed.to).toEqual([r.ctx.filters[0]]);
    expect(r.ctx.filters[0]!.to).toEqual([voice]);
    expect(voice.to).toEqual([r.ctx.bus]);
    expect(r.ctx.bus.to).toEqual([r.ctx.duck]);
    expect(r.ctx.duck.to).toEqual([r.ctx.master]);
    expect(r.ctx.master.to).toEqual([r.ctx.destination]);
    // The 50 Hz hum is one oscillator, through its own gain, into the bus.
    expect(r.ctx.oscs).toHaveLength(1);
    expect(r.ctx.oscs[0]).toMatchObject({ type: "sine", started: true });
    expect(r.ctx.oscs[0]!.frequency.value).toBe(50);
    expect(r.ctx.hum.to).toEqual([r.ctx.bus]);
    // The bed fades in over 2 s to degrade.gain × bed.gain.
    const fadeIn = voice.gain.events.find((e) => e.type === "curve")!;
    expect(fadeIn.duration).toBe(2);
    expect(fadeIn.curve![0]).toBeCloseTo(0, 6);
    expect(fadeIn.curve!.at(-1)).toBeCloseTo(day1().degrade.gain * soundTable.beds[day1().bed!]!.gain, 6);
  });

  it("applying the same plan twice is a no-op (also a new but equal object)", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(day1());
    await r.player.idle();
    const counts = () => [r.ctx.sources.length, r.ctx.gains.length, r.fetched.length, r.ctx.gains.map((g) => g.gain.events.length).join()];
    const before = counts();
    r.player.apply(day1());
    r.player.apply(JSON.parse(JSON.stringify(day1())));
    await r.player.idle();
    expect(counts()).toEqual(before);
  });

  it("a bed change makes exactly one new source and crossfades 2 s, equal power, old out as new in", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(day1());
    await r.player.idle();
    const [oldGain, oldSource] = [r.ctx.gains[4]!, r.ctx.sources[0]!];
    r.ctx.currentTime = 30;
    r.player.apply(night1());
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(2);
    const newGain = r.ctx.gains[5]!;
    const out = oldGain.gain.events.filter((e) => e.type === "curve").at(-1)!;
    const inn = newGain.gain.events.find((e) => e.type === "curve")!;
    expect([out.duration, inn.duration]).toEqual([2, 2]);
    expect([out.time, inn.time]).toEqual([30, 30]);
    expect(oldSource.stops).toEqual([32]);
    expect(out.curve!.at(-1)).toBeCloseTo(0, 6);
    expect(inn.curve![0]).toBeCloseTo(0, 6);
    // Equal power: with equal ends, out² + in² stays constant along the fade.
    const a = equalPowerCurve(1, 0);
    const b = equalPowerCurve(0, 1);
    for (let i = 0; i < a.length; i++) expect(a[i]! ** 2 + b[i]! ** 2).toBeCloseTo(1, 5);
    // The old source lets go of its nodes when it ends.
    oldSource.onended?.();
    expect(r.ctx.filters[0]!.disconnected).toBe(true);
  });

  it("the same bed with a new level or ring trims the one voice: no new source", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(planOn(4, "work"));
    await r.player.idle();
    r.player.apply(planOn(7, "work"));
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(1);
    expect(r.ctx.filters[0]!.frequency.events.some((e) => e.type === "ramp" && e.value === soundTable.byRing.desk!.degrade.lowpassHz)).toBe(true);
  });

  it("a bed whose file is missing is silence; and it takes the old bed out rather than leaving a stale tone", async () => {
    const r = rig({ files: ["bed-room-day.mp3"] });
    r.player.unlock();
    r.player.apply(day1());
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(1);
    r.player.apply(night1());
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(1);
    expect(r.ctx.sources[0]!.stops).toHaveLength(1);
    // Files are fetched once and cached.
    r.player.apply(day1());
    r.player.apply(night1());
    await r.player.idle();
    expect(r.fetched.filter((u) => u.includes("bed-room-night"))).toHaveLength(1);
  });

  it("with no files at all nothing plays and nothing throws; the hum is still only an oscillator at 0", async () => {
    const r = rig({ files: "none" });
    r.player.unlock();
    for (const p of [day1(), night1(), planOn(5, "night"), planOn(14, "work"), planOn(18, "night", "good")]) r.player.apply(p);
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(0);
  });

  it("never throws: no Web Audio, a context that explodes, a fetch that rejects, bytes that will not decode", async () => {
    const none = rig({ createContext: () => null });
    expect(() => {
      none.player.unlock();
      none.player.apply(day1());
      none.player.setMuted(true);
    }).not.toThrow();

    const boom = rig({ createContext: () => { throw new Error("no"); } });
    expect(() => {
      boom.player.unlock();
      boom.player.apply(day1());
    }).not.toThrow();

    const rejects = rig({ fetchBytes: () => Promise.reject(new Error("offline")) });
    rejects.player.unlock();
    rejects.player.apply(day1());
    await expect(rejects.player.idle()).resolves.toBeUndefined();
    expect(rejects.ctx.sources).toHaveLength(0);

    const bad = rig();
    bad.ctx.decodeAudioData = () => Promise.reject(new Error("EncodingError"));
    bad.player.unlock();
    bad.player.apply(day1());
    await bad.player.idle();
    expect(bad.ctx.sources).toHaveLength(0);

    const odd = rig();
    odd.ctx.createBiquadFilter = () => { throw new Error("nope"); };
    odd.player.unlock();
    odd.player.apply(day1());
    await expect(odd.player.idle()).resolves.toBeUndefined();
  });

  it("mute sets the master to 0 at once (no ramp), is remembered, and is read back on the next load", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(day1());
    await r.player.idle();
    r.ctx.currentTime = 7;
    r.player.setMuted(true);
    const last = r.ctx.master.gain.events.slice(-2);
    expect(last).toEqual([{ type: "cancel", time: 7 }, { type: "set", value: 0, time: 7 }]);
    expect(r.player.muted).toBe(true);
    expect(r.storage.data.get(MUTE_KEY)).toBe("1");
    expect(readMuted(r.storage)).toBe(true);
    // Suspend is not used: unmuting is instant.
    r.ctx.currentTime = 9;
    r.player.setMuted(false);
    expect(r.ctx.master.gain.events.at(-1)).toEqual({ type: "set", value: 1, time: 9 });
    expect(r.storage.data.get(MUTE_KEY)).toBe("0");
    expect(r.ctx.state).toBe("running");

    // A new page: the flag is already there, and the master starts at 0.
    r.player.setMuted(true);
    const next = rig({ storage: r.storage });
    expect(next.player.muted).toBe(true);
    next.player.unlock();
    expect(next.ctx.master.gain.value).toBe(0);
  });

  it("mute set before the first gesture still holds when the context comes", () => {
    const r = rig();
    r.player.setMuted(true);
    r.player.unlock();
    expect(r.ctx.master.gain.value).toBe(0);
  });

  it("a hidden tab ramps everything to 0 over 0.5 s and back when visible; muted stays 0", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(day1());
    await r.player.idle();
    r.ctx.currentTime = 20;
    r.doc.set(true);
    expect(r.ctx.master.gain.events.at(-1)).toEqual({ type: "ramp", value: 0, time: 20.5 });
    r.ctx.currentTime = 40;
    r.doc.set(false);
    expect(r.ctx.master.gain.events.at(-1)).toEqual({ type: "ramp", value: 1, time: 40.5 });
    r.player.setMuted(true);
    r.doc.set(true);
    r.doc.set(false);
    expect(r.ctx.master.gain.events.at(-1)).toMatchObject({ value: 0 });
  });

  it("dropouts come from the seed: the same (day, beat) sounds the same, another does not", async () => {
    const lay = async (plan: SoundPlan) => {
      const r = rig();
      r.player.unlock();
      r.player.apply(plan);
      await r.player.idle();
      return r.ctx.bus.gain.events;
    };
    const a = await lay(planOn(16, "work"));
    expect(a.length).toBeGreaterThan(4);
    expect(await lay(planOn(16, "work"))).toEqual(a);
    expect(await lay(planOn(16, "afternoon"))).not.toEqual(a);
    // Each one: gone for a length inside the ring's range, back with a 20 ms ramp.
    const { dropoutMs } = planOn(16, "work").degrade;
    const sets = a.filter((e) => e.type === "set" && e.value === 0);
    for (let i = 0; i < sets.length; i += 2) {
      const len = (sets[i + 1]!.time - sets[i]!.time) * 1000;
      expect(len).toBeGreaterThanOrEqual(dropoutMs[0] - 1e-6);
      expect(len).toBeLessThanOrEqual(dropoutMs[1] + 1e-6);
    }
    expect(a.filter((e) => e.type === "ramp").every((e) => e.value === 1)).toBe(true);
    // The first ring has none.
    expect((await lay(planOn(1, "work"))).filter((e) => e.type === "ramp")).toEqual([]);
  });

  it("dropoutTimes is pure and its rate is about the table's", () => {
    const d = soundTable.byRing.door!.degrade;
    const a = dropoutTimes(rngOf(1), d, 0, 6000);
    expect(dropoutTimes(rngOf(1), d, 0, 6000)).toEqual(a);
    expect(a.length / 100).toBeGreaterThan(d.dropoutsPerMin * 0.6);
    expect(a.length / 100).toBeLessThan(d.dropoutsPerMin * 1.4);
    expect(dropoutTimes(rngOf(1), soundTable.byRing.software!.degrade, 0, 6000)).toEqual([]);
  });

  it("dropouts are laid out ahead and a timer lays out more", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(planOn(16, "work"));
    await r.player.idle();
    expect(r.timers).toHaveLength(1);
    const n = r.ctx.bus.gain.events.length;
    r.timers[0]!.fn();
    expect(r.ctx.bus.gain.events.length).toBeGreaterThan(n);
  });

  it("the hum follows the ring: 0 on the first, its humGain after, 0 when the bed is gone", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(planOn(7, "work"));
    await r.player.idle();
    expect(r.ctx.hum.gain.events.at(-1)).toMatchObject({ type: "ramp", value: soundTable.byRing.desk!.degrade.humGain });
    r.player.apply(planOn(13, "night"));
    await r.player.idle();
    expect(r.ctx.hum.gain.events.at(-1)).toMatchObject({ type: "ramp", value: 0 });
  });

  it("silence fades the bed out over 2 s and leaves it off", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(planOn(13, "work"));
    await r.player.idle();
    r.ctx.currentTime = 50;
    r.player.apply(planOn(13, "night"));
    expect(r.ctx.gains[4]!.gain.events.filter((e) => e.type === "curve").at(-1)).toMatchObject({ time: 50, duration: 2 });
    expect(r.ctx.sources[0]!.stops).toEqual([52]);
    r.player.apply(planOn(13, "night"));
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(1);
  });

  it("music: fades in per its entry, one source for the three dream nights' tune, fades out when the night ends", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(planOn(5, "night"));
    await r.player.idle();
    const tune = r.ctx.sources.find((s) => s.loop && s.to[0] === r.ctx.gains.at(-1) && r.ctx.gains.at(-1)!.to[0] === r.ctx.master)!;
    expect(tune).toBeTruthy();
    const g = r.ctx.gains.at(-1)!;
    expect(g.gain.events.at(-1)).toMatchObject({ type: "ramp", value: soundTable.music.dream!.gain, time: 4 });
    const count = r.ctx.sources.length;
    r.ctx.currentTime = 100;
    r.player.apply(planOn(5, "night"));
    expect(r.ctx.sources).toHaveLength(count);
    r.player.apply(planOn(6, "boot"));
    await r.player.idle();
    expect(g.gain.events.at(-1)).toMatchObject({ type: "ramp", value: 0, time: 102 });
    expect(tune.stops.at(-1)).toBe(102);
  });

  it("an ending's tune that is not a loop is not looped; the bed goes out", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(planOn(18, "work"));
    await r.player.idle();
    r.player.apply(planOn(18, "work", "survive"));
    await r.player.idle();
    expect(r.ctx.sources.at(-1)!.loop).toBe(false);
    expect(r.ctx.sources[0]!.stops).toHaveLength(1);
    const tune = r.ctx.sources.at(-1)!;
    tune.onended?.();
    expect(tune.disconnected ?? true).toBe(true);
  });

  it("a stinger plays once when its night begins, through playSfx, with the mute flag", async () => {
    const r = rig();
    r.player.unlock();
    r.player.apply(planOn(3, "work"));
    expect(r.stings).toEqual([]);
    r.player.apply(planOn(3, "night"));
    r.player.apply(planOn(3, "night"));
    expect(r.stings).toEqual([[soundTable.stingers.device!, false]]);
    r.player.setMuted(true);
    r.player.apply(planOn(4, "night"));
    expect(r.stings.at(-1)).toEqual([soundTable.stingers.device!, true]);
    expect(r.stings).toHaveLength(2);
  });

  it("the title: rain at its volume and the theme under it, through the same player", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(titlePlan(0.12, { voice: "m", lang: "zh" }));
    await r.player.idle();
    expect(r.fetched.sort()).toEqual(["/sfx/rain-loop.mp3", "/sfx/theme_m_zh.mp3"]);
    const rain = r.ctx.gains[4]!;
    const to = (rain.gain.events.find((e) => e.type === "curve")!.curve!).at(-1)!;
    expect(to).toBeCloseTo(0.12, 6);
    // Louder once the computer turns on: the same bed, trimmed.
    r.player.apply(titlePlan(0.3, { voice: "m", lang: "zh" }));
    expect(rain.gain.events.at(-1)).toMatchObject({ type: "ramp", value: expect.closeTo(0.3, 6) });
    // The bed loops; the theme does not, and is not started again by the louder rain.
    expect(r.ctx.sources.map((s) => s.loop)).toEqual([true, false]);
    // The waiting room's pause takes the rain only; the song goes on.
    r.player.apply(titlePlan(null, { voice: "m", lang: "zh" }));
    expect(r.ctx.sources[0]!.stops).toHaveLength(1);
    expect(r.ctx.sources[1]!.stops).toHaveLength(0);
  });

  it("title → game: the rain and the song give way to the room's bed and the day track, 1.5 s out", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(titlePlan(0.3, { voice: "m", lang: "zh" }));
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(2);
    r.ctx.currentTime = 10;
    r.player.apply(planOn(1, "boot"));
    await r.player.idle();
    expect(r.ctx.sources).toHaveLength(4);
    // The song fades out over the title entry's 1.5 s and stops; the rain crossfades over 2 s.
    const songGain = r.ctx.gains[5]!;
    expect(songGain.gain.events.at(-1)).toMatchObject({ type: "ramp", value: 0, time: 11.5 });
    expect(r.ctx.sources[1]!.stops).toEqual([11.5]);
    expect(r.ctx.sources[0]!.stops).toEqual([12]);
  });

  describe("the day / night tracks and the theme", () => {
    const loops = (r: ReturnType<typeof rig>) => r.ctx.sources.map((s) => s.loop);

    it("a day track goes source → lowpass → gain → bus (so the dropouts reach it); the hum does not", async () => {
      const r = rig({ files: "all" });
      r.player.unlock();
      r.player.apply(planOn(7, "work"));
      await r.player.idle();
      expect(loops(r)).toEqual([true, true]);
      const filter = r.ctx.filters[1]!;
      const gain = r.ctx.gains[5]!;
      expect(r.ctx.sources[1]!.to).toEqual([filter]);
      expect(filter.to).toEqual([gain]);
      expect(gain.to).toEqual([r.ctx.bus]);
      expect(filter.frequency.value).toBe(soundTable.byRing.desk!.degrade.lowpassHz);
      expect(r.ctx.hum.to).toEqual([r.ctx.bus]);
      // gain = the track's own × the ring's multiplier (desk: 0.8), fading in over the default 3 s
      expect(gain.gain.events.at(-1)).toMatchObject({ type: "ramp", value: soundTable.music.day!.gain * 0.8, time: 3 });
    });

    it("the theme goes straight to the master: no lowpass, no dropouts", async () => {
      const r = rig({ files: "all" });
      r.player.unlock();
      r.player.apply(soundPlan(stateOn(16), { ...at("work"), walkman: true }, soundTable, "zh"));
      await r.player.idle();
      const song = r.ctx.sources.find((s) => !s.loop)!;
      expect(song.to).toEqual([r.ctx.gains.at(-1)]);
      expect(r.ctx.gains.at(-1)!.to).toEqual([r.ctx.master]);
      expect(song.loop).toBe(false);
    });

    it("day → night swaps the track (the old one 2 s out, the new one 3 s in); the same track at a new ring is trimmed, not restarted", async () => {
      const r = rig({ files: "all" });
      r.player.unlock();
      r.player.apply(planOn(4, "work"));
      await r.player.idle();
      expect(r.ctx.sources).toHaveLength(2);
      r.player.apply(planOn(7, "work"));
      await r.player.idle();
      expect(r.ctx.sources).toHaveLength(2);
      const g = r.ctx.gains[5]!;
      expect(g.gain.events.at(-1)).toMatchObject({ type: "ramp", value: soundTable.music.day!.gain * 0.8 });
      r.ctx.currentTime = 40;
      r.player.apply(planOn(7, "night"));
      await r.player.idle();
      expect(g.gain.events.at(-1)).toMatchObject({ type: "ramp", value: 0, time: 42 });
      expect(r.ctx.sources).toHaveLength(4);
    });

    it("from ring room there is no track: the bed alone; day 14 brings it back, then it goes again", async () => {
      const r = rig({ files: "all" });
      r.player.unlock();
      r.player.apply(planOn(13, "work"));
      await r.player.idle();
      expect(loops(r)).toEqual([true]);
      r.player.apply(planOn(14, "work"));
      await r.player.idle();
      expect(loops(r)).toEqual([true, true]);
      r.player.apply(planOn(15, "work"));
      await r.player.idle();
      expect(r.ctx.sources[1]!.stops).toHaveLength(1);
    });

    it("the track's file missing is silence; the bed goes on", async () => {
      const r = rig({ files: BED_FILES });
      r.player.unlock();
      r.player.apply(planOn(1, "work"));
      await r.player.idle();
      expect(loops(r)).toEqual([true]);
    });

    it("the theme: the file for the voice and language, else theme_m_zh, else silence", async () => {
      const walk = (voice: "m" | "f", lang: "zh" | "en") => ({ ...soundPlan(stateOn(3), { ...at("work"), walkman: true }, soundTable, lang), voice });
      const tryWith = async (files: readonly string[], voice: "m" | "f", lang: "zh" | "en") => {
        const r = rig({ files: [...BED_FILES, ...files] });
        r.player.unlock();
        r.player.apply(walk(voice, lang));
        await r.player.idle();
        return { r, songs: r.ctx.sources.filter((s) => !s.loop).length, fetched: r.fetched.filter((u) => u.includes("theme")) };
      };
      const all = ["theme_m_zh.mp3", "theme_f_zh.mp3", "theme_m_en.mp3"];
      expect((await tryWith(all, "f", "zh")).fetched).toEqual(["/sfx/theme_f_zh.mp3"]);
      expect((await tryWith(all, "m", "en")).fetched).toEqual(["/sfx/theme_m_en.mp3"]);
      // No f / en: the m / zh one, after trying the right one.
      const fallback = await tryWith(all, "f", "en");
      expect(fallback.fetched).toEqual(["/sfx/theme_f_en.mp3", "/sfx/theme_m_zh.mp3"]);
      expect(fallback.songs).toBe(1);
      // Not even that: silence, and no error.
      const none = await tryWith([], "f", "en");
      expect(none.songs).toBe(0);
    });

    it("a tune that plays to its end tells the host, and the same plan does not start it again", async () => {
      const r = rig({ files: "all" });
      const ended: string[] = [];
      r.player.onTuneEnd((id) => void ended.push(id));
      r.player.unlock();
      const walk = soundPlan(stateOn(3), { ...at("work"), walkman: true }, soundTable, "zh");
      r.player.apply(walk);
      await r.player.idle();
      const song = r.ctx.sources.find((s) => !s.loop)!;
      song.onended!();
      expect(ended).toEqual(["theme"]);
      const count = r.ctx.sources.length;
      // Anything else about the plan changing (the beat) must not bring the song back.
      r.player.apply({ ...walk, seed: walk.seed + 1 });
      await r.player.idle();
      expect(r.ctx.sources).toHaveLength(count);
      // The walkman clicked off and on again does.
      r.player.apply(planOn(3, "work"));
      await r.player.idle();
      r.player.apply(walk);
      await r.player.idle();
      expect(r.ctx.sources.filter((s) => !s.loop)).toHaveLength(2);
    });

    it("the credits: the song over a silent room; the bed fades out", async () => {
      const r = rig({ files: "all" });
      r.player.unlock();
      r.player.apply(planOn(18, "night", "good"));
      await r.player.idle();
      r.player.apply(soundPlan(stateOn(18, "good"), { ...at("night"), endingPage: { phase: "credits" } }, soundTable, "zh"));
      await r.player.idle();
      expect(r.fetched.filter((u) => u.includes("theme"))).toEqual(["/sfx/theme_m_zh.mp3"]);
      expect(r.ctx.sources.at(-1)!.loop).toBe(false);
    });
  });

  it("armGestures wakes the context on the first click or key, and destroy lets go", () => {
    const r = rig();
    const handlers = new Map<string, () => void>();
    const target = {
      addEventListener: (t: string, fn: () => void) => void handlers.set(t, fn),
      removeEventListener: (t: string) => void handlers.delete(t),
    };
    r.player.armGestures(target);
    expect([...handlers.keys()].sort()).toEqual(["keydown", "pointerdown", "touchstart"]);
    expect(r.made()).toBe(0);
    handlers.get("pointerdown")!();
    handlers.get("keydown")!();
    expect(r.made()).toBe(1);
    r.player.destroy();
    expect(handlers.size).toBe(0);
  });

  it("readMuted: only the saved '1' means muted; a broken store means not muted", () => {
    expect(readMuted(null)).toBe(false);
    expect(readMuted(undefined)).toBe(false);
    expect(readMuted({ getItem: () => "1", setItem() {} })).toBe(true);
    expect(readMuted({ getItem: () => "0", setItem() {} })).toBe(false);
    expect(readMuted({ getItem: () => { throw new Error("blocked"); }, setItem() {} })).toBe(false);
  });
});

describe("the stages table the plan reads", () => {
  it("every night-beat type that has a stinger in the table is a type stages.json uses", () => {
    const types = new Set(Object.entries(stagesFile.nightBeat).filter(([k]) => !k.startsWith("_")).map(([, v]) => v));
    for (const type of Object.keys(soundTable.stingers)) expect(types.has(type), type).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the room goes quiet on the screen (sound addition 2026-11-02)", () => {
  const onView = (view: string, beat: Beat = "work", day = 4) => soundPlan(stateOn(day), { ...at(beat), view }, soundTable, "zh");
  it("the plan: duck 0.4 on 屏幕, 1.0 on 房间 / 桌子 / 门 / 床, the title and every ending", () => {
    expect(SCREEN_DUCK).toBe(0.4);
    expect(DUCK_MS).toBe(600);
    expect(onView("desktop").duck).toBe(0.4);
    for (const view of ["room", "desk", "door", "bed"]) expect(onView(view).duck, view).toBe(1);
    expect(soundPlan(stateOn(4), at("work"), soundTable, "zh").duck).toBe(1);
    expect(titlePlan(0.12).duck).toBe(1);
    expect(soundPlan(stateOn(18, "good"), { ...at("night"), view: "desktop" }, soundTable, "zh").duck).toBe(1);
    // Nothing else in the plan changes with the view: the bed and the music stay; only the duck.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 18 }), fc.constantFrom(...BEATS), (day, beat) => {
        const { duck: a, ...screen } = onView("desktop", beat, day);
        const { duck: b, ...room } = onView("room", beat, day);
        expect([a, b]).toEqual([0.4, 1]);
        expect(screen).toEqual(room);
      }),
    );
  });
  it("the player: the bus goes through the duck; 600 ms down on the screen and back on leaving; stingers are not ducked", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(onView("room"));
    await r.player.idle();
    expect(r.ctx.bus.to).toEqual([r.ctx.duck]);
    expect(r.ctx.duck.gain.value).toBe(1);
    r.ctx.currentTime = 10;
    r.player.apply(onView("desktop"));
    expect(r.ctx.duck.gain.events.at(-1)).toEqual({ type: "ramp", value: 0.4, time: 10.6 });
    r.ctx.currentTime = 20;
    r.player.apply(onView("desk"));
    expect(r.ctx.duck.gain.events.at(-1)).toEqual({ type: "ramp", value: 1, time: 20.6 });
    // A stinger is a one-shot of its own, not through the bus.
    r.player.apply({ ...onView("desktop"), stinger: "sting-soft", seed: 99 });
    expect(r.stings.at(-1)).toEqual(["sting-soft", false]);
  });
});

// ---------------------------------------------------------------------------------------------
describe("the rain under the room (weather by day, 2026-11-02)", () => {
  it("a rain day starts the rain loop through the bus at its gain × 0.5; a clear day lets it go", async () => {
    const r = rig({ files: "all" });
    r.player.unlock();
    r.player.apply(planOnWet(1, "work"));
    await r.player.idle();
    // The rain's own voice: a looping source straight into a gain on the bus (no lowpass, unlike the bed).
    const rain = r.ctx.sources.find((s) => s.loop && s.started && (s.to[0] as unknown as { to?: unknown[] } | undefined)?.to?.[0] === r.ctx.bus);
    expect(rain, "a looping source straight into a gain on the bus").toBeDefined();
    expect(r.fetched.some((u) => u.endsWith("rain-loop.mp3"))).toBe(true);
    const gain = rain!.to[0] as unknown as { gain: { events: { type: string }[] } };
    expect(gain.gain.events.find((e) => e.type === "curve")).toBeDefined();
    expect(soundTable.beds.rain!.gain * RAIN_UNDER).toBe(0.25);
    r.ctx.currentTime = 30;
    r.player.apply(planOnWet(10, "work"));
    await r.player.idle();
    expect(rain!.stops.length).toBe(1);
    // White and fog days have no rain either.
    for (const day of [7, 17]) expect(planOnWet(day, "work").rain).toBe(0);
    expect(WEATHERS).toContain(weatherOf(17));
  });
});
