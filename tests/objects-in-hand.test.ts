// objects-in-hand FR1–FR5: the content loaders, holding and using, each object's program as a pure
// reducer with its frames, and the properties (channel, dream level, upgrade, no world events).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import objectsFile from "@content/objects.json";
import dictionaryFile from "@content/dictionary.json";
import calculatorFile from "@content/calculator.json";
import kidFile from "@content/kid.json";
import { calculatorTable, dictionaryTable, handOf, parseCalculator, parseDictionary, parseHands, parseKid, pagerSchedule, readUpsideDown, type PagerMessage } from "@state/hands";
import { parseObjects } from "@state/recognise";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { t } from "@world/i18n";
import { calculator, formatNumber, lightLevel, lightZone, unaskedAt, upsideDownOf, type CalculatorState } from "@world/objects/calculator";
import { chick, chickFrameAt, CHICK_IDLE_MS, drawChick, ICON_ACT, turnTimes, type ChickState } from "@world/objects/chick";
import { dictionary, lookup, type DictionaryState } from "@world/objects/dictionary";
import { ascii, DOT_GLYPHS, finer, rowWidth, SEGMENTS, type Frame, type PixelFrame } from "@world/objects/frame";
import { CHICK_FRAMES, CHICK_ICONS, missingChickFrames, parseChickFrames, type ChickFrames } from "@world/objects/frames";
import { DOWN, dragTurn, easeBack, flipsOver, handStep, keysLive, RETURN_MS, TURN_PITCH, TURN_YAW, type Hand } from "@world/objects/hand";
import { arrivedMessages, KEY_DOWN_MS, PROGRAMS } from "@world/objects/index";
import { batteryBars, pager, pagerHistory, PAGER_HISTORY, type PagerState } from "@world/objects/pager";
import { crackLit, iccard, phone, pinchMarks, textbook } from "@world/objects/plain";
import { dreamLevel, MAX_LEVEL, SEMITONE, type ObjectEnv } from "@world/objects/program";
import { packRadii, playList, reelAngles, tape, tapePos, TAPE_SIDE_MS, type TapeState } from "@world/objects/tape";
import { loopActions, loopKeys } from "@world/room/game";
import { CHANNELS } from "@world/room/held";
import { renderRoom } from "@world/room/hud";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, heldUp: false, time: "09:30", t: 0, seed: "run:4:x", lit: 1, pager: [], uses: 0, ...over });
const msg = (day: number, text: string): PagerMessage => ({ day, text, meaning: `m${day}`, afterReply: false });

/** Test-only frames (not content): each frame a different mark, so a snapshot shows which one is up. */
function testFrames(): ChickFrames {
  const blank = () => Array.from({ length: 16 }, () => ".".repeat(32));
  const frames: Record<string, string[]> = {};
  CHICK_FRAMES.forEach((id, i) => {
    const rows = blank();
    // A bar at row 6 + i % 8 whose length says the index; the frame's id is readable from it.
    rows[6 + (i % 8)] = "#".repeat(i + 1).padEnd(32, ".");
    frames[id] = rows;
  });
  const icons: Record<string, string[]> = {};
  CHICK_ICONS.forEach((id, i) => (icons[id] = ["#..#", i % 2 ? "####" : "....", "....", "#..#"]));
  return parseChickFrames({ frames, icons });
}

describe("loaders (FR4)", () => {
  it("read content as it is", () => {
    expect(handOf("chick").keys.map((k) => k.id)).toEqual(["A", "B", "C"]);
    expect(handOf("chick").back.reset).toBeDefined();
    expect(handOf("dictionary").keys).toHaveLength(7 * 4 + 1);
    expect(handOf("dictionary").keys.find((k) => k.id === "lookup")).toMatchObject({ label: "lookup" });
    expect(handOf("calculator").solar).not.toBeNull();
    expect(handOf("tape").recordings.map((r) => r.id)).toEqual(["news", "mother", "child", "after15"]);
    expect(handOf("tape").recordings.find((r) => r.id === "after15")!.after).toBe(15);
    expect(handOf("phone").sim).toBe(objectsFile.objects.phone.sim);
    expect(dictionaryTable.words.size).toBe(dictionaryFile.words.length);
    expect(calculatorTable.finds).toHaveLength(calculatorFile.finds.length);
    expect(pagerSchedule.map((m) => m.day)).toEqual(kidFile.schedule.map((m) => m.day));
  });
  const objects = () => clone(objectsFile) as unknown as { objects: Record<string, Record<string, unknown>> };
  it.each<[string, (o: { objects: Record<string, Record<string, unknown>> }) => void, RegExp]>([
    ["an unknown key on a key", (o) => ((o.objects.chick!.keys as Record<string, unknown>[])[0]!.x = 1), /unknown key "x"/],
    ["a key outside the box", (o) => ((o.objects.chick!.keys as Record<string, unknown>[])[0]!.l = 0.95), /inside the object's box/],
    ["a fraction above 1", (o) => ((o.objects.pager!.screen as Record<string, unknown>).w = 1.2), /fraction/],
    ["a duplicate key", (o) => ((o.objects.chick!.keys as Record<string, unknown>[])[1]!.id = "A"), /duplicate key "A"/],
    ["a grid with too few labels", (o) => (o.objects.dictionary!.keys as { grid: { labels: string[] } }).grid.labels.pop(), /exactly cols × rows/],
    ["reels on the chick", (o) => (o.objects.chick!.reels = (o.objects.tape as Record<string, unknown>).reels), /only the tape has reels/],
    ["a SIM line on the pager", (o) => (o.objects.pager!.sim = "x"), /only the phone has sim/],
    ["a recording after a night that is not a dream", (o) => ((o.objects.tape!.recordings as Record<string, unknown>[])[3]!.after = 14), /dream night/],
    ["a recording line with a place", (o) => ((o.objects.tape!.recordings as { say: Record<string, unknown>[] }[])[0]!.say[0]!.where = "room"), /unknown key "where"/],
  ])("rejects %s", (_name, mutate, error) => {
    const o = objects();
    mutate(o);
    expect(() => parseHands(o)).toThrow(error);
  });
  it("recognise still rejects keys that are neither question nor hand", () => {
    const o = objects();
    o.objects.chick!.colour = "yellow";
    expect(() => parseObjects(o)).toThrow(/unknown key "colour"/);
    expect(() => parseObjects(objectsFile)).not.toThrow();
  });
  it("the dictionary: lower-case words of at most 16 letters, no duplicates, no unknown keys", () => {
    const d = () => clone(dictionaryFile) as { extraFromDay: number; words: Record<string, unknown>[] };
    const a = d();
    a.words[0]!.w = "Today";
    expect(() => parseDictionary(a)).toThrow(/lower-case/);
    const b = d();
    b.words[1]!.w = b.words[0]!.w;
    expect(() => parseDictionary(b)).toThrow(/duplicate word/);
    const c = d();
    c.words[0]!.note = "x";
    expect(() => parseDictionary(c)).toThrow(/unknown key "note"/);
  });
  it("the calculator: every digit mapped, every find reads as it says upside down, unasked among the finds", () => {
    const c = () => clone(calculatorFile) as { upsideDown: Record<string, string>; finds: { keys: string; reads: string }[]; unasked: string[] };
    const a = c();
    delete a.upsideDown["9"];
    expect(() => parseCalculator(a)).toThrow(/upsideDown\.9/);
    const b = c();
    b.finds[0]!.reads = "HELLO";
    expect(() => parseCalculator(b)).toThrow(/reads "hELLO" upside down/);
    const u = c();
    u.unasked.push("1234");
    expect(() => parseCalculator(u)).toThrow(/not one of the finds/);
    for (const f of calculatorTable.finds) expect(readUpsideDown(f.keys, calculatorTable.upsideDown).replace(/\./g, "")).toBe(f.reads.replace(/\./g, ""));
  });
  it("the pager's schedule: one message a day at most, in order; nothing rewritten", () => {
    const k = clone(kidFile) as { schedule: { day: number }[] };
    k.schedule[1]!.day = k.schedule[0]!.day;
    expect(() => parseKid(k)).toThrow(/one message a day/);
    expect(pagerSchedule[0]!.text).toBe(kidFile.schedule[0]!.text);
  });
  it("chick frames are content: strict when present, and owed (TODO for Claude) while absent", () => {
    expect(() => parseChickFrames({ frames: { wave: [] }, icons: {} })).toThrow(/not one of/);
    expect(() => parseChickFrames({ frames: { "idle-1": ["#"] }, icons: {} })).toThrow(/16 rows/);
    expect(missingChickFrames(testFrames())).toEqual([]);
    expect(missingChickFrames({ frames: new Map(), icons: new Map() })).toHaveLength(CHICK_FRAMES.length + CHICK_ICONS.length);
  });
});

describe("holding and using (FR1)", () => {
  it("lift → hold → use → 退出 → hold → put down; keys only answer in use", () => {
    let h: Hand = DOWN;
    h = handStep(h, { kind: "lift", object: "chick" });
    expect(h).toEqual({ object: "chick", mode: "holding" });
    expect(keysLive(h)).toBe(false);
    h = handStep(h, { kind: "use" });
    expect(h.mode).toBe("using");
    expect(keysLive(h)).toBe(true);
    h = handStep(h, { kind: "back" });
    expect(h.mode).toBe("holding");
    h = handStep(h, { kind: "back" });
    expect(h).toEqual(DOWN);
    // The same thing from the desk again puts it down; another one is taken instead.
    expect(handStep({ object: "chick", mode: "using" }, { kind: "lift", object: "chick" })).toEqual(DOWN);
    expect(handStep({ object: "chick", mode: "using" }, { kind: "lift", object: "pager" })).toEqual({ object: "pager", mode: "holding" });
  });
  it("the turn: ±60° / ±30°, the calculator rolls to upside down; past the limit it turns over; it eases back in 400 ms", () => {
    expect(dragTurn("chick", 10_000, -10_000)).toEqual({ yaw: TURN_YAW, pitch: TURN_PITCH, roll: 0 });
    expect(dragTurn("chick", -10_000, 10_000)).toEqual({ yaw: -TURN_YAW, pitch: -TURN_PITCH, roll: 0 });
    expect(dragTurn("calculator", 0, -10_000).roll).toBe(180);
    expect(flipsOver(dragTurn("chick", 10_000, 0))).toBe(true);
    expect(flipsOver(dragTurn("chick", 40, 0))).toBe(false);
    const from = dragTurn("chick", 200, 80);
    expect(easeBack(from, 0)).toEqual(from);
    expect(easeBack(from, RETURN_MS)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  const atDay = (day: number, found: string[]): Store => {
    const store = createStore({ startDay: day });
    for (const id of found) store.appendEvent({ kind: "openLayer", objectId: id });
    return store;
  };
  function fakeCtx(store: Store, view: Session["view"] = "desk") {
    const sounds: { id: string; rate?: number }[] = [];
    let now = 1_000_000;
    const timers: { ms: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), play: (id, o) => void sounds.push({ id, rate: o?.rate }), now: () => now };
    return { ctx, sounds, timers, tick: (ms: number) => void (now += ms) };
  }
  const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const render = (ctx: ActionContext) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session, nowMs: 1 }).value;

  it("through the actions: keys while only holding are a click on the object; Esc and the dim step back one at a time", () => {
    const store = atDay(4, ["chick"]);
    const { ctx, sounds } = fakeCtx(store);
    act(ctx, "loop-hold", { object: "chick" });
    expect(render(ctx)).toContain('data-mode="holding"');
    expect(render(ctx)).toContain('data-action="obj-use"');
    // A key while holding: no key, no sound; it is the click that uses it.
    act(ctx, "obj-key", { object: "chick", key: "A" });
    expect(ctx.session.hand.using).toBe(true);
    expect(sounds).toEqual([]);
    expect((ctx.session.hand.programs.chick as ChickState | undefined)?.menu ?? null).toBeNull();
    expect(render(ctx)).toContain(t("objects.exit"));
    act(ctx, "obj-key", { object: "chick", key: "A" });
    expect((ctx.session.hand.programs.chick as ChickState).menu).toBe(0);
    expect(ctx.session.hand.keyDown).toMatchObject({ object: "chick", key: "A" });
    expect(ctx.session.hand.keyDown!.until - ctx.now!()).toBe(KEY_DOWN_MS);
    expect(render(ctx)).toMatch(/class="okey down" data-action="obj-key" data-object="chick" data-key="A"/);
    expect(sounds).toEqual([{ id: "chick-beep", rate: undefined }]);
    // A back key while the front is up does nothing.
    act(ctx, "obj-key", { object: "chick", key: "reset" });
    expect((ctx.session.hand.programs.chick as ChickState).flashAt).toBeNull();
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.hand.using).toBe(false);
    expect(ctx.session.holding).toBe("chick");
    loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
    expect(ctx.session.holding).toBeNull();
    // The dim: 退出 first, then 放下.
    act(ctx, "loop-hold", { object: "chick" });
    act(ctx, "obj-use");
    act(ctx, "loop-put-down");
    expect([ctx.session.holding, ctx.session.hand.using]).toEqual(["chick", false]);
    act(ctx, "loop-put-down");
    expect(ctx.session.holding).toBeNull();
  });
  it("turned over (obj-turn), the reset hole answers: one flash, nothing else; put down, the front is up again", () => {
    const store = atDay(4, ["chick"]);
    const { ctx } = fakeCtx(store);
    act(ctx, "loop-hold", { object: "chick" });
    act(ctx, "obj-use");
    act(ctx, "obj-turn", { face: "back" });
    expect(render(ctx)).toContain('data-face="back"');
    act(ctx, "obj-key", { object: "chick", key: "reset" });
    expect((ctx.session.hand.programs.chick as ChickState).flashAt).toBe(ctx.now!());
    act(ctx, "loop-put-down");
    act(ctx, "loop-put-down");
    expect(ctx.session.hand.face).toBe("front");
  });
  it("the first lift asks the recognise question, later lifts that day do not (recognise FR1)", () => {
    const store = atDay(4, ["pager"]);
    const { ctx } = fakeCtx(store);
    act(ctx, "loop-hold", { object: "pager" });
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d4:recognise:pager"]);
    store.appendEvent({ kind: "recognise", objectId: "pager", option: 0 });
    act(ctx, "loop-put-down");
    act(ctx, "loop-hold", { object: "pager" });
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d4:recognise:pager"]);
  });
  it("property: no key, use, turn or put-down writes a world event", () => {
    const objects = ["chick", "textbook", "pager", "iccard", "tape", "dictionary", "calculator", "phone"];
    const steps = fc.oneof(
      fc.record({ a: fc.constant("loop-hold"), object: fc.constantFrom(...objects) }),
      fc.record({ a: fc.constant("obj-use") }),
      fc.record({ a: fc.constant("obj-turn"), face: fc.constantFrom("front", "back") }),
      fc.record({ a: fc.constant("loop-put-down") }),
      fc.record({ a: fc.constant("obj-key"), k: fc.nat(40) }),
    );
    fc.assert(
      fc.property(fc.array(steps, { maxLength: 40 }), (plan) => {
        const store = atDay(18, objects);
        // Every object known, so no question is asked (that one is the recognise spec's).
        for (const id of objects) if (!store.getState().recognised.includes(id as never) && id !== "textbook" && id !== "phone") store.appendEvent({ kind: "recognise", objectId: id });
        const { ctx, tick } = fakeCtx(store);
        ctx.session.hand.inLight = true;
        const before = store.getEvents().length;
        for (const s of plan) {
          tick(50);
          const data: Record<string, string> = {};
          if ("object" in s) data.object = s.object;
          if ("face" in s) data.face = s.face;
          if ("k" in s && ctx.session.holding) {
            const keys = [...handOf(ctx.session.holding).keys.map((k) => k.id), "reset", "cell", "flip"];
            data.object = ctx.session.holding;
            data.key = keys[s.k % keys.length]!;
          }
          act(ctx, s.a, data);
        }
        expect(store.getEvents().length).toBe(before);
      }),
      { numRuns: 60 },
    );
  });
});

describe("programs (FR2, FR3)", () => {
  const press = <S>(p: (typeof PROGRAMS)[string], keys: string[], e: ObjectEnv): S => keys.reduce((s, k, i) => p.key(s, k, { ...e, t: e.t + i }).state, p.init(e)) as S;

  it("chick: A cycles the eight icons (the selected one inverted); B acts; C goes back to idle; a half-tone higher on success", () => {
    const table = testFrames();
    const e = env({ t: 100 });
    const frames: Record<string, string> = {};
    CHICK_ICONS.forEach((icon, i) => {
      const s = press<ChickState>(chick, [...Array(i + 1).fill("A"), "B"], e);
      expect(s.act?.kind).toBe(ICON_ACT[icon]);
      frames[icon] = ascii(drawChick(s, { ...e, t: 150 }, table) as PixelFrame);
    });
    expect(chick.key(press(chick, ["A"], e), "B", e).out).toEqual([{ sound: "chick-beep", rate: SEMITONE, delay: 120 }]);
    expect(press<ChickState>(chick, ["A", "B", "C"], e)).toMatchObject({ menu: null, act: null });
    expect(frames).toMatchSnapshot();
  });
  it("chick: idle alternates every 2 s, turns at seeded times 15–40 s apart; meal eats then idles; light and check-up hold; grave when held up; smile when upgraded", () => {
    const e = env({ t: 0 });
    const s = chick.init(e);
    expect(chickFrameAt(s, { ...e, t: 0 })).toBe("idle-1");
    expect(chickFrameAt(s, { ...e, t: CHICK_IDLE_MS })).toBe("idle-2");
    const turns = turnTimes(e.seed, 600_000);
    turns.reduce((prev, at) => (expect(at - prev).toBeGreaterThanOrEqual(15_000), expect(at - prev).toBeLessThanOrEqual(40_000), at), 0);
    expect(chickFrameAt(s, { ...e, t: turns[0]! + 10 })).toBe("turn");
    const fed = { ...s, act: { kind: "eat" as const, at: 0 } };
    expect(chickFrameAt(fed, { ...e, t: 10 })).toBe("eat-1");
    expect(chickFrameAt(fed, { ...e, t: 310 })).toBe("eat-2");
    expect(chickFrameAt({ ...s, act: { kind: "dark", at: 0 } }, { ...e, t: 99_999 })).toBe("dark");
    expect(chickFrameAt({ ...s, act: { kind: "check", at: 0 } }, { ...e, t: 99_999 })).toBe("check");
    expect(chickFrameAt(s, { ...e, heldUp: true })).toBe("grave");
    expect(chickFrameAt(s, { ...e, upgraded: true })).toMatch(/^smile-/);
    // The reset hole: one flash, and nothing else changes.
    const r = chick.key(s, "reset", { ...e, t: 500 });
    expect(r).toEqual({ state: { ...s, flashAt: 500 }, out: [] });
  });
  it("pager: read / history / time and battery, per day", () => {
    const schedule = pagerSchedule;
    const out: Record<string, string> = {};
    for (const day of [4, 6, 9, 12]) {
      const e = env({ day, t: 0, pager: schedule.filter((m) => m.day <= day), time: "21:07" });
      const read = press<PagerState>(pager, ["read"], e);
      out[`day ${day} read`] = ascii(pager.draw(read, e) as PixelFrame);
      out[`day ${day} up`] = ascii(pager.draw(press<PagerState>(pager, ["read", "up"], e), e) as PixelFrame);
      out[`day ${day} fn`] = ascii(pager.draw(press<PagerState>(pager, ["fn"], e), e) as PixelFrame);
    }
    expect([4, 5, 6, 7, 8, 9, 12].map(batteryBars)).toEqual([5, 4, 3, 2, 1, 0, 0]);
    expect(out).toMatchSnapshot();
  });
  it("pager: ten kept, the oldest pushed out; idle dark; a new message blinks its envelope until read; dot matrix from dream level 2", () => {
    const many = Array.from({ length: 12 }, (_, i) => msg(i + 1, String(100 + i)));
    const e = env({ day: 12, pager: many });
    expect(pagerHistory(e)).toHaveLength(PAGER_HISTORY);
    expect(pagerHistory(e)[0]!.text).toBe("111");
    const up = press<PagerState>(pager, ["read", ...Array(20).fill("up")], e);
    expect(up.index).toBe(PAGER_HISTORY - 1);
    const idle = pager.draw(pager.init(env({ day: 3 })), env({ day: 3 })) as PixelFrame;
    expect([...idle.bits].every((b) => b === 0)).toBe(true);
    const fresh = pager.draw(pager.init(e), { ...e, t: 0 }) as PixelFrame;
    expect([...fresh.bits].some((b) => b === 1)).toBe(true);
    const seen = press<PagerState>(pager, ["read", "fn", "fn"], e);
    expect(seen.read).toBe(true);
    expect([...(pager.draw(seen, e) as PixelFrame).bits].every((b) => b === 0)).toBe(true);
    const at2 = pager.draw(press(pager, ["read"], e), { ...e, level: 2 }) as PixelFrame;
    const at1 = pager.draw(press(pager, ["read"], e), { ...e, level: 1 }) as PixelFrame;
    expect(at2.w).toBe(at1.w * 2);
    expect(ascii(at2)).not.toBe(ascii(finer(at1, 1)));
  });
  it("pager: today's message arrives on its day, or after the first reply where content says so", () => {
    const store = createStore({ startDay: 7 });
    const before = arrivedMessages(store.getState(), store.getEvents()).map((m) => m.day);
    expect(before).toEqual([4, 6]);
    store.appendEvent({ kind: "reply", recipient: "boss", choice: "fine", t: "10:00" });
    expect(arrivedMessages(store.getState(), store.getEvents()).map((m) => m.day)).toEqual([4, 6, 7]);
  });
  it("dictionary: shut until used; letters into row 1; lookup's gloss; the extra line from day 15; unknown is 未收录", () => {
    const e14 = env({ day: 14 });
    const e15 = env({ day: 15 });
    expect(press<DictionaryState>(dictionary, ["T"], e14).input).toBe("");
    const typed = press<DictionaryState>(dictionary, ["open", "T", "O", "D", "A", "Y"], e14);
    expect(typed.input).toBe("today");
    const out = {
      typing: dictionary.draw(typed, e14),
      "day 14": dictionary.draw(dictionary.key(typed, "lookup", e14).state, e14),
      "day 15": dictionary.draw(dictionary.key(typed, "lookup", e15).state, e15),
      unknown: dictionary.draw(press(dictionary, ["open", "Z", "Z", "lookup"], e15), e15),
      back: dictionary.draw(press(dictionary, ["open", "N", "O", "X", "back"], e15), e15),
      power: dictionary.draw(press(dictionary, ["open", "N", "power"], e15), e15),
    };
    expect(lookup("zz", 15)).toEqual(["zz", t("dictionary.unknown")]);
    expect(lookup("again", 15)).toEqual(["again", dictionaryTable.words.get("again")!.gloss]);
    expect(out).toMatchSnapshot();
  });
  it("calculator: ordinary arithmetic in 8 digits; E when it does not fit; dark keys do nothing", () => {
    const e = env({ day: 16 });
    const run = (keys: string) => press<CalculatorState>(calculator, keys.split(" "), e).display;
    expect(run("1 2 + 3 0 =")).toBe("42");
    expect(run("7 div 2 =")).toBe("3.5");
    expect(run("9 x 9 x 9 =")).toBe("729");
    expect(run("1 div 3 =")).toBe("0.3333333");
    expect(run("2 sqrt")).toBe("1.4142136");
    expect(run("5 0 0 + 1 0 %")).toBe("50");
    expect(run("9 9 9 9 9 9 9 9 x 9 =")).toBe("E");
    expect(run("1 div 0 =")).toBe("E");
    expect(run("1 2 3 4 5 6 7 8 9")).toBe("12345678");
    expect(formatNumber(-0.5)).toBe("-0.5");
    const dark = calculator.key(calculator.init(e), "5", { ...e, lit: 0.2 });
    expect(dark.state.display).toBe("0");
    expect(lightLevel(false, 1000, 2500)).toBeCloseTo(0.5);
    expect(lightLevel(false, 1000, 9000)).toBe(0);
    expect(lightZone(1)).toBeCloseTo(1 / 3);
    expect(lightZone(16)).toBeCloseTo(1 / 6);
    expect(calculator.keySound).toBeNull();
  });
  it("calculator: upside down the display reads as content's table; the frames of each find", () => {
    const out: Record<string, string> = {};
    for (const f of calculatorTable.finds) {
      expect(upsideDownOf(f.keys).replace(/\./g, "")).toBe(f.reads.replace(/\./g, ""));
      const s = press<CalculatorState>(calculator, [...f.keys], env({ day: 16 }));
      expect(s.display).toBe(f.keys);
      out[f.keys] = ascii(calculator.draw(s, env({ day: 16 })) as PixelFrame);
    }
    expect(out).toMatchSnapshot();
  });
  it("calculator: from day 17 it sometimes shows a number nobody pressed, one of content's four", () => {
    const shown = new Set<string>();
    for (let n = 0; n < 400; n++) {
      expect(unaskedAt(env({ day: 16 }), n)).toBeNull();
      const u = unaskedAt(env({ day: 17 }), n);
      if (u) shown.add(u);
    }
    expect([...shown].sort()).toEqual([...calculatorTable.unasked].sort());
  });
  it("tape: the reels at the true ratio over time (tape area conserved; turn rates inverse to radius)", () => {
    const out: Record<string, { left: number; right: number; spinL: number; spinR: number }> = {};
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const r = packRadii(p);
      const a = reelAngles(p);
      out[String(p)] = { left: +r.left.toFixed(4), right: +r.right.toFixed(4), spinL: +a.left.toFixed(3), spinR: +a.right.toFixed(3) };
      expect(r.left ** 2 + r.right ** 2).toBeCloseTo(packRadii(0).left ** 2 + packRadii(0).right ** 2, 9);
      const dp = 1e-6;
      const q = Math.min(1 - dp, p);
      const dl = reelAngles(q + dp).left - reelAngles(q).left;
      const dr = reelAngles(q + dp).right - reelAngles(q).right;
      expect(dl / dr).toBeCloseTo(packRadii(q).right / packRadii(q).left, 3);
    }
    const s = tape.key(tape.init(env({ t: 0 })), "play", env({ t: 0 })).state;
    expect(tapePos(s, TAPE_SIDE_MS / 2)).toBeCloseTo(0.5);
    expect(out).toMatchSnapshot();
  });
  it("tape: play puts the recording in the box, stop takes it back; the after-15 line only after a rewind from day 16", () => {
    const e = env({ day: 12, t: 0 });
    const played = tape.key(tape.init(e), "play", e);
    expect(played.out).toEqual([{ sound: "tape-hiss", volume: 0.6 }, { say: { key: "d12:tape:news", lines: handOf("tape").recordings[0]!.say } }]);
    expect(tape.key(played.state, "stop", e).out).toEqual([{ stopSay: "d12:tape:" }]);
    expect(playList({ day: 16 }, false).map((r) => r.id)).toEqual(["news", "mother", "child"]);
    expect(playList({ day: 15 }, true).map((r) => r.id)).toEqual(["news", "mother", "child"]);
    expect(playList({ day: 16 }, true).map((r) => r.id)).toEqual(["news", "mother", "child", "after15"]);
    const late = env({ day: 16, t: 0 });
    const rewound = press<TapeState>(tape, ["ff", "ff", "ff", "rew", "stop", "play", "stop", "play", "stop", "play", "stop"], late);
    const last = tape.key(rewound, "play", late).out.find((o) => "say" in o);
    expect(last).toEqual({ say: { key: "d16:tape:after15", lines: handOf("tape").recordings[3]!.say } });
    // Upgraded: the transcript, no reels, nothing in the box.
    const up = tape.key(tape.init(e), "play", { ...e, upgraded: true });
    expect(up.out.some((o) => "say" in o)).toBe(false);
    expect(up.state.mode).toBe("stop");
  });
  it("card, phone, textbook: a flip sound, pinch marks by uses (+1 from day 13), the cracked corner on day 18, the score once", () => {
    expect(iccard.key(iccard.init(env()), "flip", env()).out).toEqual([{ sound: "plastic-flip" }]);
    expect([pinchMarks(2, 12), pinchMarks(2, 13)]).toEqual([2, 3]);
    const e18 = env({ day: 18, t: 1000 });
    const opened = phone.key(phone.init(e18), "flip", e18).state;
    const closed = phone.key(opened, "flip", e18).state;
    expect(crackLit(closed, 1010)).toBe(true);
    expect(crackLit(closed, 1100)).toBe(false);
    expect(phone.key(opened, "flip", env({ day: 17 })).state.crackAt).toBeNull();
    expect(phone.key(opened, "power", e18).state).toBe(opened);
    const w = textbook.key(textbook.init(env()), "cell", env({ t: 5 })).state;
    expect(textbook.key(w, "cell", env({ t: 9 })).state.writtenAt).toBe(5);
  });
});

describe("properties (FR5)", () => {
  const ids = Object.keys(PROGRAMS);
  const keysOf = (id: string) => [...handOf(id).keys.map((k) => k.id), "open", "reset", "flip", "cell"];
  const envs = fc.record({ day: fc.integer({ min: 1, max: 18 }), level: fc.integer({ min: 0, max: MAX_LEVEL }), t: fc.integer({ min: 0, max: 600_000 }), lit: fc.double({ min: 0, max: 1, noNaN: true }), upgraded: fc.boolean() });
  const run = (id: string, presses: number[], e: ObjectEnv): Frame => {
    const p = PROGRAMS[id]!;
    const keys = keysOf(id);
    let s = p.init(e);
    for (const [i, k] of presses.entries()) s = p.key(s, keys[k % keys.length]!, { ...e, t: e.t + i }).state;
    return p.draw(s, e);
  };
  it("a program never draws outside its channel: size = channel × 2ⁿ, ink 0/1; cells within 2 × 16; segments and dots from their sets", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.array(fc.nat(60), { maxLength: 30 }), envs, (id, presses, ev) => {
        const e = env({ ...ev, upgraded: false, pager: pagerSchedule.filter((m) => m.day <= ev.day) });
        const f = run(id, presses, e);
        const ch = PROGRAMS[id]!.channel;
        if (f.kind === "pixels") {
          expect(ch).not.toBeNull();
          expect([f.w, f.h]).toEqual([ch!.w * 2 ** e.level, ch!.h * 2 ** e.level]);
          expect([...f.bits].every((b) => b === 0 || b === 1)).toBe(true);
        } else if (f.kind === "cells") {
          expect(f.rows).toHaveLength(2);
          for (const r of f.rows) expect(rowWidth(r)).toBeLessThanOrEqual(16);
        } else expect(f.kind).toBe("none");
      }),
      { numRuns: 300 },
    );
    // The glyph sets: digits and the letters they can form; the dot matrix's capitals.
    expect(Object.keys(SEGMENTS)).toEqual(expect.arrayContaining([..."0123456789"]));
    expect(DOT_GLYPHS).toEqual(expect.arrayContaining([..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]));
  });
  it("the dream level only scales the channel: the chick and the calculator at level n are level 0 made finer", () => {
    fc.assert(
      fc.property(fc.constantFrom("chick", "calculator"), fc.array(fc.nat(60), { maxLength: 20 }), fc.integer({ min: 1, max: MAX_LEVEL }), fc.integer({ min: 0, max: 100_000 }), (id, presses, level, t0) => {
        const e = env({ day: 16, t: t0 });
        const base = run(id, presses, e) as PixelFrame;
        const fine = run(id, presses, { ...e, level }) as PixelFrame;
        expect(ascii(fine)).toBe(ascii(finer(base, level)));
      }),
      { numRuns: 100 },
    );
    expect([1, 5, 6, 11, 12, 15, 16, 18].map((d) => dreamLevel(d))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(dreamLevel(5, true)).toBe(1);
    expect(dreamLevel(18, true)).toBe(MAX_LEVEL);
  });
  it("an upgraded object never shows the low-res frame", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ids), fc.array(fc.nat(60), { maxLength: 30 }), envs, (id, presses, ev) => {
        const f = run(id, presses, env({ ...ev, upgraded: true, pager: pagerSchedule }));
        expect(f.kind === "pixels" || f.kind === "cells").toBe(false);
      }),
      { numRuns: 300 },
    );
  });
  it("every program's channel is the held screen's", () => {
    for (const id of ids) {
      const ch = PROGRAMS[id]!.channel;
      if (id === "dictionary") expect(CHANNELS.dictionary).toEqual({ w: 96, h: 25 });
      else expect(ch ? CHANNELS[id] : undefined).toEqual(ch ?? undefined);
    }
  });
});
