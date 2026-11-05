// objects-in-hand FR1–FR5: the content loaders, holding and using, each object's program as a pure
// reducer with its frames, and the properties (channel, dream level, upgrade, no world events).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { setLocale, stringIn, t } from "@world/i18n";
import { calculator, formatNumber, lightLevel, lightZone, unaskedAt, UPSIDE_DOWN_DEG, upsideDownOf, type CalculatorState } from "@world/objects/calculator";
import { chick, chickFrameAt, CHICK_IDLE_MS, drawChick, ICON_ACT, turnTimes, type ChickState } from "@world/objects/chick";
import { dictionary, lookup, type DictionaryState } from "@world/objects/dictionary";
import { ascii, DOT_GLYPHS, finer, rowWidth, SEGMENTS, type Frame, type PixelFrame } from "@world/objects/frame";
import { CHICK_FRAMES, CHICK_H, CHICK_ICONS, CHICK_W, missingChickFrames, parseChickFrames, type ChickFrames } from "@world/objects/frames";
import { DOWN, dragTurn, easeBack, flipsOver, handStep, keysLive, RETURN_MS, TURN_PITCH, TURN_YAW, type Hand } from "@world/objects/hand";
import { arrivedMessages, KEY_DOWN_MS, PROGRAMS } from "@world/objects/index";
import { batteryBars, pager, pagerHistory, PAGER_HISTORY, type PagerState } from "@world/objects/pager";
import { crackLit, iccard, phone, pinchMarks, camera } from "@world/objects/plain";
import { dreamLevel, MAX_LEVEL, SEMITONE, type ObjectEnv } from "@world/objects/program";
import { packRadii, playList, reelAngles, tape, tapePos, TAPE_SIDE_MS, type TapeState } from "@world/objects/tape";
import { keyboardToObjKey, loopActions, loopKeys } from "@world/room/game";
import { CHANNELS, faceBoxWidth, FOCUS_MAX, focusBackingWidth, HELD_W } from "@world/room/held";
import { DICT_KEYS, ghostBits } from "@world/room/devices";
import { paintFrame } from "@world/objects/paint";
import { STAGE_H, STAGE_W } from "@world/room/splat/geometry";
import { renderRoom } from "@world/room/hud";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, taken: false, heldUp: false, time: "09:30", t: 0, seed: "run:4:x", lit: 1, pager: [], uses: 0, ...over });
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
    // A key while holding: no key sound; it is the click that uses it (使用 is a camera move now, so
    // it plays the walk's step sound — not a key sound; 2026-11-03).
    const keySounds = () => sounds.filter((s) => s.id !== "step-1" && s.id !== "step-2");
    act(ctx, "obj-key", { object: "chick", key: "A" });
    expect(ctx.session.hand.using).toBe(true);
    expect(keySounds()).toEqual([]);
    expect((ctx.session.hand.programs.chick as ChickState | undefined)?.menu ?? null).toBeNull();
    expect(render(ctx)).toContain(t("objects.exit"));
    act(ctx, "obj-key", { object: "chick", key: "A" });
    expect((ctx.session.hand.programs.chick as ChickState).menu).toBe(0);
    expect(ctx.session.hand.keyDown).toMatchObject({ object: "chick", key: "A" });
    expect(ctx.session.hand.keyDown!.until - ctx.now!()).toBe(KEY_DOWN_MS);
    // In 使用 the chick is the drawn device: a real button that sinks (class "down"), same action/ids.
    expect(render(ctx)).toMatch(/class="down" data-action="obj-key" data-object="chick" data-key="A"/);
    expect(keySounds()).toEqual([{ id: "chick-beep", rate: undefined }]);
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
  // objects-in-room R2: using an object at a place is a record (`useAt`); nothing else is written.
  it("property: no key, use, turn or put-down writes a world event (only the useAt record)", () => {
    const objects = ["chick", "camera", "pager", "iccard", "tape", "dictionary", "calculator", "phone"];
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
        for (const id of objects) if (!store.getState().recognised.includes(id as never) && id !== "camera" && id !== "phone") store.appendEvent({ kind: "recognise", objectId: id });
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
        expect(store.getEvents().slice(before).filter((e) => e.kind !== "useAt")).toEqual([]);
      }),
      { numRuns: 60 },
    );
  });

  // ——— the five fixes (2026-11-03) ———

  /** The number of 4-connected lit components in a 1-bit frame, and whether any lit pixel is alone. */
  function components(f: { w: number; h: number; bits: Uint8Array }): { count: number; hasIsolated: boolean } {
    const seen = new Uint8Array(f.w * f.h);
    const lit = (x: number, y: number) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.bits[y * f.w + x] === 1;
    let count = 0;
    let hasIsolated = false;
    for (let y = 0; y < f.h; y++)
      for (let x = 0; x < f.w; x++) {
        if (!lit(x, y)) continue;
        if (!lit(x - 1, y) && !lit(x + 1, y) && !lit(x, y - 1) && !lit(x, y + 1)) hasIsolated = true;
        if (seen[y * f.w + x]) continue;
        count++;
        const stack: Array<readonly [number, number]> = [[x, y]];
        seen[y * f.w + x] = 1;
        while (stack.length) {
          const cur = stack.pop()!;
          const cx = cur[0];
          const cy = cur[1];
          const ns: Array<readonly [number, number]> = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
          for (const n of ns) {
            const nx = n[0];
            const ny = n[1];
            if (lit(nx, ny) && !seen[ny * f.w + nx]) {
              seen[ny * f.w + nx] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }
    return { count, hasIsolated };
  }

  // 1. Dream-level resolution keeps whole shapes (not scattered dots).
  it("fix 1: at dream level 3 the chick's idle frame has the same 4-connected count as level 0, and no lit pixel is isolated", () => {
    const e = env({ t: 0 });
    const base = drawChick(chick.init(e), { ...e, level: 0 }) as PixelFrame;
    const fine = drawChick(chick.init(e), { ...e, level: 3 }) as PixelFrame;
    expect(fine.w).toBe(base.w * 8);
    const b = components(base);
    const f = components(fine);
    expect(f.count).toBe(b.count);
    expect(f.hasIsolated).toBe(false);
    // The stroke is thinner: a lit source pixel becomes a 4 px block of its 8 px cell, not a solid 8.
    expect(fine.bits.reduce((n, v) => n + v, 0)).toBeLessThan(base.bits.reduce((n, v) => n + v, 0) * 64);
  });

  // 2. The chick's reset hole is on the back only.
  it("fix 2: the reset hotspot exists only on the back face, never on the front", () => {
    const store = atDay(4, ["chick"]);
    const { ctx } = fakeCtx(store);
    act(ctx, "loop-hold", { object: "chick" });
    act(ctx, "obj-use");
    expect(render(ctx)).not.toContain('data-key="reset"');
    act(ctx, "obj-turn", { face: "back" });
    expect(render(ctx)).toContain('data-key="reset"');
  });

  // 3. Lifted objects are upright: no rest tilt carried in.
  it("fix 3: the held object has rotation 0 at rest (room.css resets the desk tilt; only a drag turns it)", () => {
    const store = atDay(16, ["chick", "pager", "iccard", "tape", "dictionary", "calculator"]);
    const { ctx } = fakeCtx(store);
    for (const id of ["chick", "pager", "iccard", "tape", "dictionary", "calculator"]) {
      act(ctx, "loop-hold", { object: id });
      // The held markup carries no inline rotation; the rest turn is the layer's NO_TURN (0,0,0).
      expect(render(ctx)).not.toMatch(/rotate[XYZ]?\([^)]*[1-9][^)]*\)/);
      act(ctx, "loop-put-down");
    }
    // room.css gives .held.obj an explicit rotate(0deg), overriding the base .held's --m-tilt desk rest.
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toMatch(/\.held\.obj\{[^}]*rotate\(0deg\)/);
    // The rest turn the hand layer sets is zero on every axis.
    expect(easeBack({ yaw: 0, pitch: 0, roll: 0 }, RETURN_MS)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  // 4. The dictionary's keys are under the lid until it is opened.
  it("fix 4: lifted the dictionary is closed with no key hotspots; opened it has 29; T,O,D,A,Y + lookup glosses 'today' in row 2", () => {
    const store = atDay(13, ["dictionary"]);
    store.appendEvent({ kind: "recognise", objectId: "dictionary" });
    const { ctx } = fakeCtx(store);
    act(ctx, "loop-hold", { object: "dictionary" });
    const closed = render(ctx);
    expect((closed.match(/data-action="obj-key"/g) ?? []).length).toBe(0);
    // Using it opens the clamshell and draws the device: the full keyboard — A–Z (26) plus lookup,
    // up, down, back, power, space (6) = 32 real buttons (the photo `grid` is replaced, 2026-11-03).
    act(ctx, "obj-use");
    const open = render(ctx);
    expect((open.match(/data-action="obj-key" data-object="dictionary"/g) ?? []).length).toBe(32);
    for (const k of ["T", "O", "D", "A", "Y"]) act(ctx, "obj-key", { object: "dictionary", key: k });
    act(ctx, "obj-key", { object: "dictionary", key: "lookup" });
    const s = ctx.session.hand.programs.dictionary as DictionaryState;
    expect(s.answer).toEqual(lookup("today", 13));
    expect(s.answer![1]).toBe(dictionaryTable.words.get("today")!.gloss);
  });

  // 5. Using an object is a camera level, the same tier as 屏幕.
  describe("fix 5: using is a focus view", () => {
    it("in 使用 the view level is the object and Esc returns to holding at 桌子", () => {
      const store = atDay(16, ["calculator"]);
      store.appendEvent({ kind: "recognise", objectId: "calculator" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "calculator" });
      act(ctx, "obj-use");
      expect(ctx.session.hand.using).toBe(true);
      expect(ctx.session.view).toBe("desk"); // 使用 is its own level over 桌子, not a view change
      loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
      expect([ctx.session.hand.using, ctx.session.holding, ctx.session.view]).toEqual([false, "calculator", "desk"]);
    });

    it("the whole face fits within 88 % of the stage, every key is inside, and the canvas backing is an integer multiple of the channel", () => {
      const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
      // The front image is contained within 88 % of the stage in both dimensions (aspect kept), so
      // the scaled box — and every key, which sits inside the face — is on-stage for any aspect.
      expect(FOCUS_MAX).toBe(0.88);
      expect(faceBoxWidth()).toBe(HELD_W);
      expect(css).toMatch(/\.held\.obj\.using \.face\.front > img\{[^}]*max-width:calc\(1600px \* var\(--focus-max,\.88\)\)/);
      expect(css).toMatch(/\.held\.obj\.using \.face\.front > img\{[^}]*max-height:calc\(900px \* var\(--focus-max,\.88\)\)/);
      // 88 % of the fixed stage, the on-stage cap for the face box in both dimensions.
      expect(FOCUS_MAX * STAGE_W).toBe(1408);
      expect(FOCUS_MAX * STAGE_H).toBe(792);
      for (const id of ["chick", "pager", "calculator", "dictionary", "iccard", "camera", "tape", "phone"]) {
        // Every key hotspot lies inside the face (0..1), so inside the stage once the face fits.
        for (const k of handOf(id).keys) {
          expect(k.l, `${id}.${k.id}`).toBeGreaterThanOrEqual(0);
          expect(k.t, `${id}.${k.id}`).toBeGreaterThanOrEqual(0);
          expect(k.l + k.w, `${id}.${k.id}`).toBeLessThanOrEqual(1 + 1e-9);
          expect(k.t + k.h, `${id}.${k.id}`).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
      // The canvas backing resolution is an integer multiple of the channel width (at every level).
      for (const id of ["chick", "pager", "calculator", "dictionary"]) {
        for (const lvl of [0, 1, 2, 3]) {
          const back = focusBackingWidth(id, lvl);
          expect(back % CHANNELS[id]!.w, `${id} level ${lvl}`).toBe(0);
          expect(Number.isInteger(back / (CHANNELS[id]!.w * 2 ** lvl)), `${id} level ${lvl}`).toBe(true);
        }
      }
      // The canvas is drawn pixelated (integer scale, no smoothing).
      expect(css).toMatch(/canvas\.dev\{[^}]*image-rendering:pixelated/);
    });

    it("the device's screen canvas is CSS-sized (no inline pixel width) and carries no data-focus-w", () => {
      const store = atDay(16, ["dictionary"]);
      store.appendEvent({ kind: "recognise", objectId: "dictionary" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "dictionary" });
      act(ctx, "obj-use");
      const out = render(ctx);
      expect(out).not.toContain("data-focus-w");
      // The device canvas is sized by CSS (max-width:100% of the glass), not an inline px width.
      const canvas = out.slice(out.indexOf('data-screen="dictionary"'), out.indexOf("</canvas", out.indexOf('data-screen="dictionary"')) + 1);
      expect(canvas).toContain('class="dev"');
      expect(canvas).not.toMatch(/style="[^"]*width:\d+px/);
    });

    it("the stage behind gets the dim + blur class in 使用", () => {
      const store = atDay(16, ["dictionary"]);
      store.appendEvent({ kind: "recognise", objectId: "dictionary" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "dictionary" });
      expect(render(ctx)).not.toContain("held-layer focus");
      act(ctx, "obj-use");
      const out = render(ctx);
      expect(out).toContain("held-layer focus");
      expect(out).toContain("using focus");
      const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
      expect(css).toMatch(/\.held-layer\.focus > \.held-dim\{[^}]*blur\(6px\)/);
    });

    it("the keyboard reaches the dictionary and the calculator only while in use", () => {
      // Dictionary: a letter types only while using.
      const d = atDay(13, ["dictionary"]);
      d.appendEvent({ kind: "recognise", objectId: "dictionary" });
      const dc = fakeCtx(d);
      act(dc.ctx, "loop-hold", { object: "dictionary" });
      expect(keyboardToObjKey("dictionary", "t")).toBe("T");
      // Holding only: the keyboard does not reach it.
      expect(loopKeys(dc.ctx, { key: "t", target: null } as unknown as KeyboardEvent)).toBe(false);
      act(dc.ctx, "obj-use"); // opens the dictionary
      loopKeys(dc.ctx, { key: "t", target: null } as unknown as KeyboardEvent);
      loopKeys(dc.ctx, { key: "o", target: null } as unknown as KeyboardEvent);
      expect((dc.ctx.session.hand.programs.dictionary as DictionaryState).input).toBe("to");
      // Calculator: digits and ops map; Enter is =, Backspace is C.
      expect(keyboardToObjKey("calculator", "7")).toBe("7");
      expect(keyboardToObjKey("calculator", "*")).toBe("x");
      expect(keyboardToObjKey("calculator", "/")).toBe("div");
      expect(keyboardToObjKey("calculator", "Enter")).toBe("=");
      expect(keyboardToObjKey("calculator", "Backspace")).toBe("C");
      // An object with no keyboard (the chick) takes nothing.
      expect(keyboardToObjKey("chick", "a")).toBeNull();
    });
  });

  // ——— 使用 is the game's own drawing of the device (2026-11-03) ———
  describe("the drawn devices in 使用", () => {
    const DEVS = ["chick", "pager", "dictionary", "calculator"] as const;
    // The dictionary's device keyboard: A–Z plus the six function keys (the photo `grid` is gone).
    const DICT = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "lookup", "up", "down", "back", "power", "space"];
    const keyIds = (id: string): string[] => (id === "dictionary" ? DICT : handOf(id).keys.map((k) => k.id));
    const RECOGNISABLE = ["chick", "pager", "iccard", "tape", "dictionary", "calculator"];
    const used = (id: string) => {
      const store = atDay(id === "calculator" ? 16 : id === "dictionary" ? 13 : id === "pager" ? 4 : 4, [id]);
      // Recognise it (so no question is asked), but only objects that can be recognised.
      if (RECOGNISABLE.includes(id)) store.appendEvent({ kind: "recognise", objectId: id });
      const { ctx } = fakeCtx(store);
      ctx.session.hand.inLight = true;
      act(ctx, "loop-hold", { object: id });
      act(ctx, "obj-use");
      return ctx;
    };

    it("the face is a drawn device (no img, a device root) for each of the four; holding still shows the photo", () => {
      for (const id of DEVS) {
        const ctx = used(id);
        const out = render(ctx);
        const face = out.slice(out.indexOf('class="held obj device'), out.indexOf('class="hint"'));
        expect(face, id).toContain(`data-device="${id}"`);
        expect(face, id).toContain("dev-shell");
        expect(face.match(/<img[^>]*_front\.png/), id).toBeNull();
        // Holding (not using) still shows the photo face.
        act(ctx, "loop-put-down"); // using → holding
        const held = render(ctx);
        expect(held, `${id} holding`).toContain(`src="/objects/${id}_front.png"`);
        expect(held, `${id} holding`).not.toContain(`data-device="${id}"`);
      }
    });

    it("every content key id is a button[data-action=obj-key]; clicking reaches the program like the old hotspot", () => {
      for (const id of DEVS) {
        const out = render(used(id));
        for (const k of keyIds(id)) {
          const re = new RegExp(`<button[^>]*data-action="obj-key"[^>]*data-object="${id}"[^>]*data-key="${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
          expect(re.test(out) || new RegExp(`data-key="${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*data-action="obj-key"`).test(out), `${id}.${k}`).toBe(true);
        }
      }
      // Clicking a device key reaches the program exactly as the photo hotspot did.
      const ctx = used("chick");
      act(ctx, "obj-key", { object: "chick", key: "A" });
      expect((ctx.session.hand.programs.chick as ChickState).menu).toBe(0);
    });

    /** A fake 2d context that records every fillRect's style and size. */
    function fakeContext() {
      const fills: { style: string; w: number; h: number }[] = [];
      let style = "";
      const g = {
        set fillStyle(v: string) {
          style = v;
        },
        get fillStyle() {
          return style;
        },
        clearRect() {},
        fillRect(_x: number, _y: number, w: number, h: number) {
          fills.push({ style, w, h });
        },
        imageSmoothingEnabled: false,
      } as unknown as CanvasRenderingContext2D;
      return { g, fills };
    }

    it("the screen fills the glass: backing is channel × 16, CSS fills it, pixelated; a ghost is painted", () => {
      // The ghost bitmap is the channel's full extent for pixel/dot-matrix, the 8. for seven-segment.
      expect([...ghostBits("chick", 0).bits].every((b) => b === 1)).toBe(true); // every pixel ghosts
      expect([...ghostBits("pager", 0).bits].some((b) => b === 1)).toBe(true); // the 8. of every cell
      // The markup backing is channel × 16 (chick 32×16 → 512×256) for every object.
      expect(render(used("chick"))).toMatch(/<canvas class="dev" data-screen="chick" width="512" height="256"/);
      expect(render(used("pager"))).toMatch(new RegExp(`width="${CHANNELS.pager!.w * 16}" height="${CHANNELS.pager!.h * 16}"`));
      // The canvas fills the glass, centred, aspect kept, never smoothed.
      const css = readFileSync(resolve(__dirname, "../src/world/room/devices.css"), "utf8");
      expect(css).toMatch(/\.glass canvas\.dev\{[^}]*image-rendering:pixelated/);
      expect(css).toMatch(/\.glass canvas\.dev\{[^}]*width:100%/);
      expect(css).toMatch(/\.glass canvas\.dev\{[^}]*height:100%/);
      // A ghost (7.5 % ink) is painted under the lit frame.
      const { g, fills } = fakeContext();
      const canvas = { width: CHICK_W * 16, height: CHICK_H * 16, getContext: () => g } as unknown as Parameters<typeof paintFrame>[0];
      paintFrame(canvas, drawChick(chick.init(env()), env()) as PixelFrame, "chick", (() => null) as never, { ghost: ghostBits("chick", 0) });
      expect(fills.some((f) => f.style.includes("0.075"))).toBe(true);
    });

    it("the gap thins with the scale: a level-0 chick frame is squares of 13, a level-3 frame squares of 1", () => {
      // Backing = channel × 16; a level-0 frame (32×16) scales by 16: gap round(16/5)=3, square 13.
      const l0 = fakeContext();
      const c0 = { width: CHICK_W * 16, height: CHICK_H * 16, getContext: () => l0.g } as unknown as Parameters<typeof paintFrame>[0];
      paintFrame(c0, drawChick(chick.init(env()), env({ level: 0 })) as PixelFrame, "chick", (() => null) as never, { ghost: ghostBits("chick", 0) });
      expect(l0.fills.length).toBeGreaterThan(0);
      expect(l0.fills.every((f) => f.w === 13 && f.h === 13)).toBe(true);
      // A level-3 frame (256×128) in the same backing scales by 2: gap round(2/5)=1, square 1.
      const l3 = fakeContext();
      const c3 = { width: CHICK_W * 16, height: CHICK_H * 16, getContext: () => l3.g } as unknown as Parameters<typeof paintFrame>[0];
      paintFrame(c3, drawChick(chick.init(env()), env({ level: 3 })) as PixelFrame, "chick", (() => null) as never, { ghost: ghostBits("chick", 3) });
      expect(l3.fills.length).toBeGreaterThan(0);
      expect(l3.fills.every((f) => f.w === 1 && f.h === 1)).toBe(true);
    });

    it("keycap words come from strings and change with the locale; symbols/digits/letters stay drawn", () => {
      const cap = (id: string, k: string, loc: "zh" | "en"): string => {
        setLocale(loc);
        const out = render(used(id));
        setLocale("zh");
        return new RegExp(`data-key="${k}"[^>]*>([^<]*)<`).exec(out)?.[1] ?? "";
      };
      // The pager's 灯 cap is the string, so it differs by locale (灯 / LIGHT).
      expect(cap("pager", "light", "zh")).toBe(t("obj.cap.pager.light"));
      expect(cap("pager", "light", "en")).toBe(stringIn("en", "obj.cap.pager.light"));
      expect(cap("pager", "light", "zh")).not.toBe(cap("pager", "light", "en"));
      // A calculator digit is drawn, not a string: the same glyph in both locales.
      expect(cap("calculator", "7", "zh")).toBe("7");
      expect(cap("calculator", "7", "en")).toBe("7");
    });

    it("the pager has exactly one data-key=\"light\"", () => {
      const out = render(used("pager"));
      expect((out.match(/data-key="light"/g) ?? []).length).toBe(1);
    });

    it("the upgraded device has the upgraded class, no ghost, and a smooth HiFrame screen", () => {
      const store = atDay(16, ["chick"]);
      store.appendEvent({ kind: "recognise", objectId: "chick" });
      store.appendEvent({ kind: "upgrade", object: "chick" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "chick" });
      act(ctx, "obj-use");
      const out = render(ctx);
      expect(out).toContain("held obj device upgraded");
      expect(out).toMatch(/<canvas class="dev hi" data-screen="chick"/);
      // The upgraded chick's program draws a HiFrame (smooth, no pixel/cells low-res frame).
      const frame = chick.draw(chick.init(env({ upgraded: true })), env({ upgraded: true }));
      expect(frame.kind).toBe("hi");
      // The hand layer does not ghost an upgraded device (onDevice requires !env.upgraded).
    });

    it("the dictionary has a space bar, types \"good day\" with one space, a double space collapses, and \"today \" looks up today", () => {
      // The device renders the space bar key.
      const store = atDay(13, ["dictionary"]);
      store.appendEvent({ kind: "recognise", objectId: "dictionary" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "dictionary" });
      act(ctx, "obj-use");
      expect(render(ctx)).toContain('class="space" data-action="obj-key" data-object="dictionary" data-key="space"');
      expect(DICT_KEYS).toContain("space");
      // The program: space appends one, never two; empty/leading space does nothing.
      const e = env({ day: 13 });
      const type = (keys: string[]) => keys.reduce((s, k) => dictionary.key(s, k, e).state, dictionary.key(dictionary.init(e), "open", e).state) as DictionaryState;
      expect(type(["space"]).input).toBe(""); // empty: no leading space
      expect(type([..."GOOD", "space", ..."DAY"]).input).toBe("good day");
      expect(type([..."GOOD", "space", "space", ..."DAY"]).input).toBe("good day"); // a double space collapses
      // "today " (a trailing space) looks up today (lookup trims first).
      const looked = type([..."TODAY", "space"]);
      const after = dictionary.key(looked, "lookup", e).state as DictionaryState;
      expect(after.answer).toEqual(lookup("today", 13));
      // Through the keyboard in 使用: Space is the dictionary's space, nothing else.
      expect(keyboardToObjKey("dictionary", " ")).toBe("space");
      expect(keyboardToObjKey("calculator", " ")).toBeNull();
    });

    // ——— flip and rotate in 使用, the object turns without going back to holding (2026-11-03) ———
    it("the flip / rotate buttons appear only for the objects with that change, only in 使用", () => {
      // chick, iccard, phone, camera show flip and not rotate.
      for (const id of ["chick", "iccard", "phone", "camera"]) {
        const ctx = used(id);
        const out = render(ctx);
        expect(out, id).toContain('data-action="obj-flip"');
        expect(out, id).not.toContain('data-action="obj-rotate"');
      }
      // calculator shows rotate and not flip.
      const calc = render(used("calculator"));
      expect(calc).toContain('data-action="obj-rotate"');
      expect(calc).not.toContain('data-action="obj-flip"');
      // pager, dictionary, tape show neither.
      for (const id of ["pager", "dictionary", "tape"]) {
        const out = render(used(id));
        expect(out, id).not.toContain('data-action="obj-flip"');
        expect(out, id).not.toContain('data-action="obj-rotate"');
      }
      // Never while only holding.
      const holding = (() => {
        const store = atDay(7, ["iccard"]);
        store.appendEvent({ kind: "recognise", objectId: "iccard" });
        const { ctx } = fakeCtx(store);
        act(ctx, "loop-hold", { object: "iccard" });
        return render(ctx);
      })();
      expect(holding).not.toContain('data-action="obj-flip"');
    });

    it("flip from 使用 changes session.hand.face and keeps using; the chick's reset reaches the program only with the back up", () => {
      const store = atDay(12, ["chick"]);
      store.appendEvent({ kind: "recognise", objectId: "chick" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "chick" });
      act(ctx, "obj-use");
      expect(ctx.session.hand.face).toBe("front");
      // Reset on the front does nothing (the hole is not on the front).
      act(ctx, "obj-key", { object: "chick", key: "reset" });
      expect((ctx.session.hand.programs.chick as ChickState | undefined)?.flashAt ?? null).toBeNull();
      // Flip (not a put-down): face turns, 使用 stays.
      act(ctx, "obj-flip");
      expect(ctx.session.hand.face).toBe("back");
      expect(ctx.session.hand.using).toBe(true);
      // The egg's flip plays right after 翻面 only, never on a later redraw (a key press looked like a spin).
      const at = (nowMs: number) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session, nowMs }).value;
      expect(at(ctx.now!())).toMatch(/dev-shell egg[^"]* flipping/);
      expect(at(ctx.now!() + 1000)).not.toContain("flipping");
      // Now the reset reaches the program.
      act(ctx, "obj-key", { object: "chick", key: "reset" });
      expect((ctx.session.hand.programs.chick as ChickState).flashAt).toBe(ctx.now!());
      // Flip back.
      act(ctx, "obj-flip");
      expect(ctx.session.hand.face).toBe("front");
      expect(ctx.session.hand.using).toBe(true);
    });

    it("rotate sets the roll to 180 and back to 0; with 0.7734 entered the program reads upside down at 180", () => {
      const store = atDay(16, ["calculator"]);
      store.appendEvent({ kind: "recognise", objectId: "calculator" });
      const { ctx } = fakeCtx(store);
      ctx.session.hand.inLight = true;
      act(ctx, "loop-hold", { object: "calculator" });
      act(ctx, "obj-use");
      expect(ctx.session.hand.roll).toBe(0);
      act(ctx, "obj-rotate");
      expect(ctx.session.hand.roll).toBe(180);
      expect(render(ctx)).toContain('data-roll="180"');
      act(ctx, "obj-rotate");
      expect(ctx.session.hand.roll).toBe(0);
      // Past UPSIDE_DOWN_DEG the reading is content's letters (reuse the existing upside-down table).
      expect(180).toBeGreaterThanOrEqual(UPSIDE_DOWN_DEG);
      expect(upsideDownOf("0.7734").replace(/\./g, "")).toBe("hELLO");
    });

    it("the chick's drawn back has the reset button and no img", () => {
      const store = atDay(12, ["chick"]);
      store.appendEvent({ kind: "recognise", objectId: "chick" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "chick" });
      act(ctx, "obj-use");
      act(ctx, "obj-flip"); // to the back
      const out = render(ctx);
      const face = out.slice(out.indexOf('class="held obj device'), out.indexOf('class="hint"'));
      expect(face).toContain('data-action="obj-key" data-object="chick" data-key="reset"');
      // The drawn back: the battery cover, the screw and the RESET label (LR44 is CSS content).
      expect(face).toContain("backface");
      expect(face).toContain('class="cover"');
      expect(face).toContain("RESET");
      expect(face).not.toContain("<img"); // the drawn back, never the photo
    });

    // ——— the walkman is a drawn device too (2026-11-03) ———
    it("the tape in 使用 renders the device (no img) with four keys plus vol+/vol- as obj-key buttons", () => {
      const out = render(used("tape"));
      const face = out.slice(out.indexOf('class="held obj device'), out.indexOf('class="hint"'));
      expect(face).toContain('data-device="tape"');
      expect(face).not.toContain("<img");
      for (const k of ["rew", "play", "ff", "stop", "vol+", "vol-"]) {
        const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        expect(new RegExp(`data-action="obj-key"[^>]*data-object="tape"[^>]*data-key="${esc}"`).test(face), k).toBe(true);
      }
      // Holding still shows the photo with its reels.
      const store = atDay(10, ["tape"]);
      store.appendEvent({ kind: "recognise", objectId: "tape" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "tape" });
      const held = render(ctx);
      expect(held).toContain('src="/objects/tape_front.png"');
      expect(held).not.toContain('data-device="tape"');
    });

    it("after play the play key is pressed and after stop none is; the window reels follow packRadii", () => {
      const store = atDay(10, ["tape"]);
      store.appendEvent({ kind: "recognise", objectId: "tape" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "tape" });
      act(ctx, "obj-use");
      // The `.keys` block of the device, for checking which key latches.
      const keysOf = (out: string) => {
        const from = out.indexOf('<div class="keys">');
        return out.slice(from, out.indexOf("</div>", from) + 6);
      };
      act(ctx, "obj-key", { object: "tape", key: "play" });
      // The piano keys latch: play stays down.
      const playing = render(ctx);
      expect(/data-key="play"/.test(keysOf(playing))).toBe(true);
      expect(keysOf(playing)).toMatch(/class="[^"]*\blatched\b[^"]*"[^>]*data-key="play"/);
      expect((ctx.session.hand.programs.tape as TapeState).mode).toBe("play");
      act(ctx, "obj-key", { object: "tape", key: "stop" });
      expect((ctx.session.hand.programs.tape as TapeState).mode).toBe("stop");
      const stopped = render(ctx);
      expect(stopped).toContain('data-mode="stop"');
      // No key latches once stopped (the stop key springs back; the cap `down` fades with time).
      expect(keysOf(stopped)).not.toMatch(/\blatched\b/);
      // The reels follow packRadii: left larger at the start, right larger near the end.
      const press = { n: 0, at: -Infinity };
      const atStart = packRadii(tapePos({ mode: "stop", since: 0, pos0: 0, volume: 6, index: 0, rewound: false, press, reverse: false }, 0));
      const nearEnd = packRadii(tapePos({ mode: "stop", since: 0, pos0: 0.95, volume: 6, index: 0, rewound: false, press, reverse: false }, 0));
      expect(atStart.left).toBeGreaterThan(atStart.right);
      expect(nearEnd.right).toBeGreaterThan(nearEnd.left);
    });

    it("the upgraded walkman shows the transcript (HiFrame); the reels do not turn between two times", () => {
      const store = atDay(16, ["tape"]);
      store.appendEvent({ kind: "recognise", objectId: "tape" });
      store.appendEvent({ kind: "upgrade", object: "tape" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "tape" });
      act(ctx, "obj-use");
      const out = render(ctx);
      expect(out).toContain("held obj device upgraded");
      expect(out).toMatch(/<canvas class="dev hi" data-screen="tape"/);
      // The program draws a HiFrame (the transcript); the reels stay still (reelAngles unused here).
      const e = env({ day: 16, upgraded: true });
      const frame = tape.draw(tape.init(e), e);
      expect(frame.kind).toBe("hi");
      // Upgraded, the hand layer does not spin the reels (it toggles .playing only when not upgraded).
      const r0 = reelAngles(tapePos(tape.init(e) as TapeState, 0));
      const r1 = reelAngles(tapePos(tape.init(e) as TapeState, 5000));
      expect(r0).toEqual(r1); // stop at 0, no turn
    });

    it("the cord sways only in play (data-mode)", () => {
      const store = atDay(10, ["tape"]);
      store.appendEvent({ kind: "recognise", objectId: "tape" });
      const { ctx } = fakeCtx(store);
      act(ctx, "loop-hold", { object: "tape" });
      act(ctx, "obj-use");
      expect(render(ctx)).toContain('data-mode="stop"');
      act(ctx, "obj-key", { object: "tape", key: "play" });
      expect(render(ctx)).toContain('data-mode="play"');
      // The CSS sways the cord only at data-mode="play", and not under reduced motion.
      const css = readFileSync(resolve(__dirname, "../src/world/room/devices.css"), "utf8");
      expect(css).toMatch(/\.walk\[data-mode="play"\] \.cord\{animation:m-cord-sway/);
      expect(css).toMatch(/prefers-reduced-motion: reduce/);
    });

    it("every drawn device: zh → en changes the brand and keycap words and leaves symbols/digits/letters; no CJK under en", () => {
      const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
      for (const id of ["chick", "pager", "dictionary", "calculator", "tape"]) {
        setLocale("zh");
        const zh = render(used(id));
        setLocale("en");
        const en = render(used(id));
        setLocale("zh");
        // The device changed (a brand or keycap word differs between locales).
        const face = (out: string) => out.slice(out.indexOf(`data-device="${id}"`), out.indexOf('class="hint"'));
        expect(face(zh), id).not.toBe(face(en));
        // No CJK character in the rendered device under en.
        expect(CJK.test(face(en)), `${id} en CJK`).toBe(false);
      }
    });
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
    // The reset hole: one flash, and nothing else changes (every key bumps Kuro's press tracker).
    const r = chick.key(s, "reset", { ...e, t: 500 });
    expect(r).toEqual({ state: { ...s, flashAt: 500, press: { n: s.press.n + 1, at: 500 } }, out: [] });
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
  it("card, phone, camera: a flip sound, pinch marks by uses (+1 from day 13), the cracked corner on day 18; the camera's shutter", () => {
    expect(iccard.key(iccard.init(env()), "flip", env()).out).toEqual([{ sound: "plastic-flip" }]);
    expect([pinchMarks(2, 12), pinchMarks(2, 13)]).toEqual([2, 3]);
    const e18 = env({ day: 18, t: 1000 });
    const opened = phone.key(phone.init(e18), "flip", e18).state;
    const closed = phone.key(opened, "flip", e18).state;
    expect(crackLit(closed, 1010)).toBe(true);
    expect(crackLit(closed, 1100)).toBe(false);
    expect(phone.key(opened, "flip", env({ day: 17 })).state.crackAt).toBeNull();
    expect(phone.key(opened, "power", e18).state).toBe(opened);
    // camera R8: the shutter ejects a sheet (its sound), the flash slider toggles; no wheel.
    const shot = camera.key(camera.init(env()), "shutter", env({ t: 5, sheets: 3 }));
    expect(shot.state.ejectAt).toBe(5);
    expect(shot.out).toEqual([{ sound: "camera-shutter" }]);
    expect(camera.key(camera.init(env()), "flash", env()).state.flash).toBe(true);
    expect(camera.key(camera.init(env()), "wheel", env()).state).toEqual(camera.init(env()));
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
