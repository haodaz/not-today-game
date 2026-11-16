// battle-sfx (2026-11-16): the battles' 8-bit sounds — the recipes as data, playChip on a fake
// context, the two pure mappers (battleChip / bossChip), the actions' wiring and the player's chip().
import "./specimen";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { battleChip, battleCmd, battleTurn, startBattle, type BattleLine, type BattleState } from "@world/desktop/workbench/battle";
import { bossChip, bossStart, type BossBattle, type Fx, type Move } from "@world/endings/boss";
import { bossActions, DOWN_AFTER_MS } from "@world/endings/flow";
import { CHIP_GAIN, CHIP_IDS, CHIP_RECIPES, playChip, type ChipContext, type ChipId } from "@world/sound/chip";
import { createSoundPlayer } from "@world/sound/player";
import { setLocale } from "@world/i18n";

setLocale("zh");

// ——— a fake context (the babble tests' shape, with starts recorded on every source) ———
class Param {
  value = 0;
  readonly events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) { this.events.push(["set", v, t]); }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(["ramp", v, t]); }
  setValueCurveAtTime() {}
  cancelScheduledValues() {}
}
class Node {
  readonly to: unknown[] = [];
  connect(n: unknown) { this.to.push(n); }
  disconnect() {}
}
class Src extends Node {
  starts: number[] = [];
  stops: number[] = [];
  start(t = 0) { this.starts.push(t); }
  stop(t = 0) { this.stops.push(t); }
}
class Osc extends Src { type = ""; readonly frequency = new Param(); }
class Filter extends Node { type = ""; readonly frequency = new Param(); readonly Q = new Param(); }
class Gain extends Node { readonly gain = new Param(); }
class Source extends Src { buffer: unknown = null; loop = false; onended: (() => void) | null = null; }
class Ctx {
  currentTime = 10;
  sampleRate = 8000;
  state = "running";
  readonly destination = new Node();
  oscs: Osc[] = [];
  filters: Filter[] = [];
  gains: Gain[] = [];
  sources: Source[] = [];
  buffers = 0;
  createGain() { const g = new Gain(); this.gains.push(g); return g as never; }
  createOscillator() { const o = new Osc(); this.oscs.push(o); return o as never; }
  createBiquadFilter() { const f = new Filter(); this.filters.push(f); return f as never; }
  createBufferSource() { const s = new Source(); this.sources.push(s); return s as never; }
  createBuffer(_c: number, len: number) { this.buffers++; const data = new Float32Array(len); return { getChannelData: () => data }; }
  decodeAudioData() { return Promise.resolve(null); }
  resume() { return Promise.resolve(); }
}
const asChip = (c: Ctx) => c as unknown as ChipContext;

describe("the recipes", () => {
  it("every ChipId has a non-empty recipe of well-formed steps", () => {
    expect(Object.keys(CHIP_RECIPES).sort()).toEqual([...CHIP_IDS].sort());
    for (const id of CHIP_IDS) {
      const steps = CHIP_RECIPES[id];
      expect(steps.length, id).toBeGreaterThan(0);
      for (const s of steps) {
        expect(s.at).toBeGreaterThanOrEqual(0);
        expect(s.ms).toBeGreaterThan(0);
        if (s.kind === "osc") expect(s.from, id).toBeGreaterThan(0);
      }
    }
  });

  it("the table's shapes: cursor, the hit, the faint, the win, flip the loudest, throw ends in the hit, join is heal then a short shake", () => {
    expect(CHIP_RECIPES.cursor).toEqual([{ at: 0, kind: "osc", wave: "square", from: 880, ms: 40 }]);
    expect(CHIP_RECIPES.text).toEqual([{ at: 0, kind: "osc", wave: "square", from: 1200, ms: 25 }]);
    expect(CHIP_RECIPES.hit.map((s) => [s.kind, s.ms, s.from, s.to])).toEqual([["noise", 90, 0, undefined], ["osc", 120, 220, 60]]);
    expect(CHIP_RECIPES.down.map((s) => [s.at, s.from, s.ms])).toEqual([[0, 440, 125], [125, 330, 125], [250, 220, 125], [375, 110, 125]]);
    expect(CHIP_RECIPES.win.map((s) => [s.from, s.ms])).toEqual([[659, 90], [784, 90], [1047, 90], [1319, 300]]);
    expect(CHIP_RECIPES.lose.map((s) => [s.from, s.ms])).toEqual([[196, 250], [147, 250]]);
    expect(CHIP_RECIPES.heal.map((s) => [s.at, s.from])).toEqual([[0, 523], [60, 659], [120, 784]]);
    expect(CHIP_RECIPES.flash.every((s) => s.wave === "triangle")).toBe(true);
    expect(CHIP_RECIPES.flame[0]!.filter).toEqual({ type: "lowpass", from: 4000, to: 400 });
    expect(CHIP_RECIPES.shake[0]!.tremolo).toEqual({ hz: 8, depth: 0.7 });
    expect(CHIP_RECIPES.throw[0]!.filter).toEqual({ type: "bandpass", from: 300, to: 2000 });
    expect(CHIP_RECIPES.throw.slice(1).map((s) => s.at)).toEqual([250, 250]);
    const loudest = (id: ChipId) => Math.max(...CHIP_RECIPES[id].map((s) => (s.gain ?? 1) * Math.max(...(s.env ?? [1]))));
    for (const id of CHIP_IDS) if (id !== "flip") expect(loudest("flip"), id).toBeGreaterThan(loudest(id));
    expect(CHIP_RECIPES.join.slice(0, 3)).toEqual(CHIP_RECIPES.heal);
    expect(CHIP_RECIPES.join[3]).toMatchObject({ from: 80, ms: 150, tremolo: { hz: 8 } });
    expect(CHIP_RECIPES.stage2[0]!.env).toEqual([0, 0.9, 0]);
  });
});

describe("playChip", () => {
  it("cursor: one square at 880 Hz from now + 10 ms for 40 ms, into a master at CHIP_GAIN on `out`", () => {
    const ctx = new Ctx();
    const out = new Node();
    playChip(asChip(ctx), out as never, "cursor");
    expect(ctx.gains[0]!.gain.value).toBe(CHIP_GAIN);
    expect(ctx.gains[0]!.to).toEqual([out]);
    expect(ctx.oscs).toHaveLength(1);
    const o = ctx.oscs[0]!;
    expect(o.type).toBe("square");
    expect(o.frequency.value).toBe(880);
    expect(o.starts[0]).toBeCloseTo(10.01, 9);
    expect(o.stops[0]).toBeCloseTo(10.05, 9);
    expect(ctx.sources).toHaveLength(0);
  });

  it("hit: a noise burst fading 1 → 0 and a square sweeping 220 → 60; the noise buffer is made once per context", () => {
    const ctx = new Ctx();
    playChip(asChip(ctx), new Node() as never, "hit", 0.5);
    expect(ctx.gains[0]!.gain.value).toBe(0.5);
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.loop).toBe(true);
    expect(ctx.oscs[0]!.frequency.events).toEqual([["set", 220, 10.01], ["ramp", 60, 10.01 + 0.12]]);
    const noiseEnv = ctx.gains[1]!;
    expect(noiseEnv.gain.events.map((e) => [e[0], e[1]])).toEqual([["set", 1], ["ramp", 0]]);
    playChip(asChip(ctx), new Node() as never, "flip");
    expect(ctx.buffers).toBe(1);
  });

  it("the nodes a recipe names: flame a lowpass sweep, throw a bandpass then the hit, shake a square LFO into the gain", () => {
    const flame = new Ctx();
    playChip(asChip(flame), new Node() as never, "flame");
    expect(flame.filters.map((f) => f.type)).toEqual(["lowpass"]);
    expect(flame.filters[0]!.frequency.events.map((e) => e[1])).toEqual([4000, 400]);
    const thr = new Ctx();
    playChip(asChip(thr), new Node() as never, "throw");
    expect(thr.filters.map((f) => f.type)).toEqual(["bandpass"]);
    expect(thr.sources).toHaveLength(2);
    expect(thr.sources[1]!.starts[0]).toBeCloseTo(10.01 + 0.25, 9);
    const sh = new Ctx();
    playChip(asChip(sh), new Node() as never, "shake");
    const lfo = sh.oscs.find((o) => o.frequency.value === 8)!;
    expect(lfo.type).toBe("square");
    expect(lfo.starts).toHaveLength(1);
  });

  it("every source is started then stopped, start before stop, in the recipe's order", () => {
    for (const id of CHIP_IDS) {
      const ctx = new Ctx();
      playChip(asChip(ctx), new Node() as never, id);
      const srcs: Src[] = [...ctx.oscs, ...ctx.sources];
      expect(srcs.length, id).toBeGreaterThan(0);
      for (const s of srcs) {
        expect(s.starts, id).toHaveLength(1);
        expect(s.stops, id).toHaveLength(1);
        expect(s.stops[0]!, id).toBeGreaterThan(s.starts[0]!);
      }
      const tones = ctx.oscs.filter((o) => o.frequency.value !== 8).map((o) => o.starts[0]!);
      expect(tones.every((t, i) => i === 0 || t >= tones[i - 1]!), id).toBe(true);
    }
    const down = new Ctx();
    playChip(asChip(down), new Node() as never, "down");
    expect(down.oscs.map((o) => o.frequency.value)).toEqual([440, 330, 220, 110]);
    expect(down.oscs.map((o) => Math.round((o.starts[0]! - 10.01) * 1000))).toEqual([0, 125, 250, 375]);
  });

  it("a context missing a method, or one that throws, is silence and never an error", () => {
    const ctx = new Ctx() as unknown as Record<string, unknown>;
    ctx.createBiquadFilter = undefined; // an own property shadows the class's method
    expect(() => playChip(ctx as never, new Node() as never, "flame")).not.toThrow();
    expect((ctx as unknown as Ctx).gains).toHaveLength(0);
    const odd = new Ctx();
    odd.createBufferSource = () => { throw new Error("nope"); };
    expect(() => playChip(asChip(odd), new Node() as never, "hit")).not.toThrow();
    expect(() => playChip(null as never, new Node() as never, "hit")).not.toThrow();
    expect(() => playChip(asChip(new Ctx()), new Node() as never, "bogus" as ChipId)).not.toThrow();
  });
});

describe("the player's chip()", () => {
  const player = (ctx: Ctx) => createSoundPlayer({ createContext: () => ctx as never, storage: { getItem: () => null, setItem: () => {} }, doc: null, fetchBytes: async () => null });
  it("unlocks on first use and plays into the master; muted, nothing", () => {
    const ctx = new Ctx();
    const p = player(ctx);
    p.chip!("cursor");
    expect(ctx.oscs.filter((o) => o.type === "square").map((o) => o.frequency.value)).toEqual([880]);
    const quiet = new Ctx();
    const q = player(quiet);
    q.setMuted(true);
    q.chip!("win");
    expect(quiet.oscs.filter((o) => o.type === "square")).toHaveLength(0);
  });
  it("no Web Audio: nothing, no throw", () => {
    const p = createSoundPlayer({ createContext: () => null, storage: null, doc: null });
    expect(() => p.chip!("hit")).not.toThrow();
  });
});

// ——— the battle (the work games' chick) ———

const line = (fx: BattleLine["fx"]): BattleLine => ({ t: "x", fx, side: "theirs" });
const atMenu = (): BattleState => ({ ...startBattle("4:task1", "foe", "/x.png", 4, 0), phase: "menu", queue: [], after: "menu", at: 5 });

describe("battleChip", () => {
  it("a new line sounds by its fx; the end has its own; nothing changed is null", () => {
    const menu = atMenu();
    const table: [BattleLine["fx"], ChipId][] = [["hit", "hit"], ["shake", "shake"], ["flame", "flame"], ["down", "down"], ["heal", "heal"], ["none", "text"]];
    for (const [fx, id] of table) expect(battleChip(menu, { ...menu, phase: "text", queue: [line(fx)], at: 6 }), fx).toBe(id);
    const reading: BattleState = { ...menu, phase: "text", queue: [line("hit"), line("none")], after: "won", at: 6 };
    expect(battleChip(reading, battleCmd(reading, "next", 7))).toBe("text");
    expect(battleChip(reading, battleCmd(reading, "next", 6))).toBe("text"); // same ms, the queue moved on
    const last: BattleState = { ...reading, queue: [line("none")] };
    expect(battleChip(last, battleCmd(last, "next", 8))).toBe("win");
    expect(battleChip({ ...last, after: "lost" }, battleCmd({ ...last, after: "lost" }, "next", 8))).toBe("lose");
    expect(battleChip({ ...last, after: "ran" }, battleCmd({ ...last, after: "ran" }, "next", 8))).toBe("text");
    expect(battleChip(menu, battleCmd(menu, "bogus", 9))).toBeNull();
    expect(battleChip(reading, { ...reading })).toBeNull();
    expect(battleChip(menu, battleCmd(menu, "fight", 9))).toBeNull(); // the menu turned: the press's cursor only
    expect(battleChip(null, startBattle("k", "foe", "/x.png", 1, 0))).toBe("text");
    expect(battleChip(menu, battleTurn(menu, "hype", 9))).toBe("shake");
  });
});

// ——— the boss (day 18) ———

const bossBase = (): BossBattle => {
  const state = { ...createStore({ startDay: 18 }).getState(), day: 18, found: ["chick"] } as State;
  return { ...bossStart(state, "survive", 0), phase: "run", log: "" };
};
const acted = (b: BossBattle, fx: Fx, at = 5, patch: Partial<BossBattle> = {}): BossBattle => {
  const move: Move = { id: "m", power: 1, acc: 100, fx };
  return { ...b, phase: "act", act: { who: "player", target: "boss", move, at, text: [], hits: [] }, ...patch };
};

describe("bossChip", () => {
  it("a new act by its fx; a fall adds down; stage 2, Q-Kuro, the win and the loss; the intro's click is text; nothing is []", () => {
    const b = bossBase();
    const table: [Fx, ChipId][] = [["throw", "throw"], ["flip", "flip"], ["strike", "hit"], ["shake", "shake"], ["flash", "flash"], ["heal", "heal"], ["none", "text"]];
    for (const [fx, id] of table) expect(bossChip(b, acted(b, fx)), fx).toEqual([id]);
    const one = acted(b, "strike");
    expect(bossChip(one, { ...one })).toEqual([]); // the same act still playing
    const fallen = acted(b, "strike", 5, { party: b.party.map((m) => (m.id === "chick" ? { ...m, hp: 0 } : m)) });
    expect(bossChip(b, fallen)).toEqual(["hit", "down"]);
    expect(bossChip(b, acted(b, "flip", 5, { boss: { ...b.boss, hp: 0 } }))).toEqual(["flip", "down"]);
    expect(bossChip(fallen, { ...fallen, act: { ...fallen.act!, at: 9 } })).toEqual(["hit"]); // already down: no second fall
    expect(bossChip(b, { ...b, boss: { ...b.boss, stage: 2 } })).toEqual(["stage2"]);
    expect(bossChip(b, { ...b, joined: true })).toEqual(["join"]);
    expect(bossChip(b, { ...b, boss: { ...b.boss, stage: 2 }, joined: true })).toEqual(["stage2", "join"]);
    expect(bossChip({ ...b, phase: "act" }, { ...b, phase: "won" })).toEqual(["win"]);
    expect(bossChip({ ...b, phase: "act" }, { ...b, phase: "lost" })).toEqual(["lose"]);
    const intro: BossBattle = { ...b, phase: "intro", line: 0 };
    expect(bossChip(intro, { ...intro, line: 1 })).toEqual(["text"]);
    expect(bossChip(intro, { ...intro, phase: "run" })).toEqual(["text"]);
    expect(bossChip({ ...b, phase: "won", line: 0 }, { ...b, phase: "won", line: 1 })).toEqual(["text"]);
    expect(bossChip(b, b)).toEqual([]);
    expect(bossChip(b, { ...b, boss: { ...b.boss, gauge: 0.4 }, clockAt: 100 })).toEqual([]); // a tick that only fills gauges
  });
});

// ——— the actions ———

function rig(chip: boolean) {
  const store = createStore({ startDay: 4 });
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  const played: ChipId[] = [];
  const timers: { ms: number; fn: () => void }[] = [];
  const clock = { t: 1000 };
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => { timers.push({ ms, fn }); }, now: () => clock.t, ...(chip ? { chip: (id: ChipId) => { played.push(id); } } : {}) };
  return { ctx, session, played, timers, clock };
}

describe("the actions", () => {
  it("a battle move press: cursor, then the line's sound; the next tap the next line's; battle-done a cursor", () => {
    const { ctx, session, played } = rig(true);
    session.battle = atMenu();
    boardActions["battle-act"]!(ctx, { cmd: "fight" } as DOMStringMap, null as never);
    expect(played).toEqual(["cursor"]);
    boardActions["battle-act"]!(ctx, { cmd: "move", move: "hype" } as DOMStringMap, null as never);
    expect(played).toEqual(["cursor", "cursor", "shake"]);
    played.length = 0;
    boardActions["battle-act"]!(ctx, { cmd: "next" } as DOMStringMap, null as never);
    expect(played).toHaveLength(1);
    played.length = 0;
    session.battle = { ...atMenu(), phase: "ran" };
    boardActions["battle-done"]!(ctx, {} as DOMStringMap, null as never);
    expect(played).toEqual(["cursor"]);
  });

  it("a boss move: cursor then the act's sounds; a fall comes DOWN_AFTER_MS later through ctx.later", () => {
    const { ctx, session, played, timers } = rig(true);
    const b = bossBase();
    session.boss = { ...b, phase: "choose", chooser: "player" };
    bossActions["boss-move"](ctx, { move: "throw" } as DOMStringMap);
    expect(played).toEqual(["cursor", "throw"]);
    played.length = 0;
    timers.length = 0;
    session.boss = { ...b, phase: "choose", chooser: "player", boss: { ...b.boss, hp: 1 } };
    bossActions["boss-move"](ctx, { move: "strike" } as DOMStringMap);
    expect(played).toEqual(["cursor", "hit"]);
    const down = timers.find((x) => x.ms === DOWN_AFTER_MS)!;
    expect(down).toBeDefined();
    down.fn();
    expect(played).toEqual(["cursor", "hit", "down"]);
    played.length = 0;
    session.boss = { ...b, phase: "intro", line: 0 };
    bossActions["boss-next"](ctx);
    expect(played).toEqual(["text"]);
  });

  it("the boss's clock: a tick that makes someone act sounds the act", () => {
    const { ctx, session, played, timers, clock } = rig(true);
    const b = bossBase();
    session.boss = { ...b, clockAt: 0, boss: { ...b.boss, gauge: 0.999 } };
    session.boss = { ...session.boss, phase: "intro", line: session.boss.intro.length - 1 };
    bossActions["boss-next"](ctx); // the last intro line starts the clock
    played.length = 0;
    const tick = timers.find((x) => x.ms === 100)!;
    clock.t += 100;
    tick.fn();
    expect(session.boss!.act?.who).toBe("boss");
    expect(played.length).toBeGreaterThanOrEqual(1);
    expect(["hit", "shake", "flash"]).toContain(played[0]);
  });

  it("with chip absent nothing throws", () => {
    const { ctx, session } = rig(false);
    session.battle = atMenu();
    expect(() => boardActions["battle-act"]!(ctx, { cmd: "move", move: "hype" } as DOMStringMap, null as never)).not.toThrow();
    const b = bossBase();
    session.boss = { ...b, phase: "choose", chooser: "player", boss: { ...b.boss, hp: 1 } };
    expect(() => bossActions["boss-move"](ctx, { move: "strike" } as DOMStringMap)).not.toThrow();
    session.boss = { ...b, phase: "intro" };
    expect(() => bossActions["boss-next"](ctx)).not.toThrow();
  });
});
