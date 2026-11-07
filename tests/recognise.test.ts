import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { objectsFoundOnDay } from "@state/stages";
import objectsFile from "@content/objects.json";
import { applyChoose, choiceOf } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import { askedOn, knows, optionOrder, parseObjects, recogniseTable, wasRight } from "@state/recognise";
import { createRunSlot, LEGACY_RUN_ID, RUN_KEY } from "@state/saves";
import { memoryStorage } from "@state/slot";
import { createStore, type Store } from "@state/store";
import type { State } from "@state/types.gen";
import { membersOf } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { freshMemo, questionQueued, react } from "@world/loop/runtime";
import { loopContext } from "@world/loop/checklist";
import { renderRoom } from "@world/room/hud";
import { everyScreen } from "./box-screens";
import { loopActions, loopKeys } from "@world/room/game";

const objects = [...recogniseTable.keys()];
const six = membersOf("recognised")! as string[];
const rightIndex = (o: string) => recogniseTable.get(o)!.options.findIndex((x) => x.right);
const wrongIndex = (o: string) => recogniseTable.get(o)!.options.findIndex((x) => !x.right);
const none = {} as DOMStringMap;

function ctxOf(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "room")): ActionContext {
  return { store, session, rerender: () => {}, later: () => {} };
}
/** What the runtime queues for the events appended by `act`. */
function queued(store: Store, act: () => void, runId = store.getRunId()) {
  const before = store.getEvents();
  const memo = freshMemo(loopContext(store.getState(), before)!, before, 0);
  act();
  const lc = loopContext(store.getState(), store.getEvents())!;
  return react(memo, lc, store.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] }, runId).dialogue;
}
const boxDay = (o: string) => objectsFoundOnDay[o]!;

describe("content/objects.json", () => {
  it("every object out of the box has a question on its box day, 2–4 options, at most one right", () => {
    expect(objects.sort()).toEqual(Object.keys(objectsFoundOnDay).sort());
    for (const o of objects) {
      const e = recogniseTable.get(o)!;
      expect(e.day, o).toBe(boxDay(o));
      expect(e.options.length, o).toBeGreaterThanOrEqual(2);
      expect(e.options.length, o).toBeLessThanOrEqual(4);
      expect(e.options.filter((x) => x.right).length, o).toBeLessThanOrEqual(1);
    }
  });

  it("is read strictly", () => {
    // Content (2026-11-06) gives every option its own lines and no shared blocks; these cases are
    // about the loader's rules for the shared shape too, so they start from the chick in that shape:
    // shared right / wrong rebuilt from the option lines, the options bare.
    const raw = () => {
      const o = structuredClone(objectsFile) as any;
      const chick = o.objects.chick;
      const r = chick.options.find((x: any) => x.right);
      const w = chick.options.find((x: any) => !x.right);
      chick.right = { say: [...r.say], inner: r.inner };
      chick.wrong = { say: [...w.say], inner: w.inner };
      for (const x of chick.options) { delete x.say; delete x.inner; }
      return o;
    };
    const two = raw();
    two.objects.chick.options[0].right = true;
    expect(() => parseObjects(two)).toThrow(/at most one right/);
    const day = raw();
    day.objects.chick.day = 2;
    expect(() => parseObjects(day)).toThrow(/box day 1/);
    const missing = raw();
    delete missing.objects.pager;
    expect(() => parseObjects(missing)).toThrow(/"pager" comes out of the box/);
    const short = raw();
    short.objects.chick.options.splice(1);
    expect(() => parseObjects(short)).toThrow(/must have 2–4 options/);
    const long = raw();
    long.objects.chick.options.push({ t: "四" }, { t: "五" });
    expect(() => parseObjects(long)).toThrow(/must have 2–4 options/);
    expect(() => parseObjects({ ...raw(), extra: 1 })).toThrow(/unknown key "extra"/);
    // An option is { t, right?, say?, inner? }: strict keys; inner only with say; say non-empty.
    const extraKey = raw();
    extraKey.objects.chick.options[0].next = "x";
    expect(() => parseObjects(extraKey)).toThrow(/options\[0\]: unknown key "next"/);
    const innerAlone = raw();
    innerAlone.objects.chick.options[0].inner = "x";
    expect(() => parseObjects(innerAlone)).toThrow(/options\[0\]\.inner: needs the option's own say/);
    const emptySay = raw();
    emptySay.objects.chick.options[0].say = [];
    expect(() => parseObjects(emptySay)).toThrow(/options\[0\]\.say: must be a non-empty list/);
    // A shared block an option falls back to cannot be left out; one nobody falls back to can.
    const noWrong = raw();
    delete noWrong.objects.chick.wrong;
    expect(() => parseObjects(noWrong)).toThrow(/objects\.chick\.wrong: missing/);
    for (const o of noWrong.objects.chick.options) if (!o.right) o.say = ["自己的一句。"];
    expect(parseObjects(noWrong).get("chick")!.wrong).toBeUndefined();
    // `right` may be left out (false); with none right the shared `right` block is the fallback.
    const noTest = raw();
    for (const o of noTest.objects.chick.options) delete o.right;
    expect(parseObjects(noTest).get("chick")!.options.every((o) => o.right === false)).toBe(true);
    delete noTest.objects.chick.right;
    expect(() => parseObjects(noTest)).toThrow(/objects\.chick\.right: missing/);
  });
});

describe("the recognise event (FR1/FR2)", () => {
  const found = (day: number, o: string) => {
    const store = createStore({ startDay: day });
    store.appendEvent({ kind: "openLayer", objectId: o });
    return store;
  };

  it("property: a wrong answer never sets recognised or moves the judgement; a right one is idempotent", () => {
    fc.assert(
      fc.property(fc.constantFrom(...objects), fc.integer({ min: 0, max: 2 }), fc.integer({ min: 1, max: 3 }), (o, option, times) => {
        const store = found(boxDay(o), o);
        const before = store.getState();
        for (let i = 0; i < times; i++) store.appendEvent({ kind: "recognise", objectId: o, option });
        const after = store.getState();
        const right = recogniseTable.get(o)!.options[option]!.right;
        if (!right) {
          expect(after).toEqual(before);
          return;
        }
        expect(after.recognised.includes(o as never)).toBe(six.includes(o));
        expect(after.recognised.filter((x) => x === o).length).toBe(six.includes(o) ? 1 : 0);
        expect(after.judgement.truth).toBe(Math.min(10, before.judgement.truth + 1));
        expect(after.judgement.evidence.filter((e) => e.eventId === `recognise:${o}`)).toHaveLength(1);
      }),
    );
  });

  it("a right answer is truth +1 evidence citing the event, noted with what it was", () => {
    const store = found(4, "pager");
    store.appendEvent({ kind: "recognise", objectId: "pager", option: rightIndex("pager") });
    expect(store.getState().judgement.evidence.at(-1)).toEqual({ day: 4, eventId: "recognise:pager", note: recogniseTable.get("pager")!.options[rightIndex("pager")]!.t });
  });

  it("the recognised set is all eight objects: a right answer for the camera (or the phone) puts it in state", () => {
    expect([...six].sort()).toEqual(["calculator", "camera", "chick", "dictionary", "iccard", "pager", "phone", "tape"]);
    const store = found(2, "camera");
    store.appendEvent({ kind: "recognise", objectId: "camera", option: rightIndex("camera") });
    expect(store.getState().recognised).toEqual(["camera"]);
    expect(knows("camera", store.getState(), store.getEvents())).toBe(true);
  });

  it("an object not found, or an option that does not exist, is rejected", () => {
    expect(() => createStore({ startDay: 1 }).appendEvent({ kind: "recognise", objectId: "chick", option: 0 })).toThrow(/not been found/);
    expect(() => found(1, "chick").appendEvent({ kind: "recognise", objectId: "chick", option: 3 })).toThrow(/no option 3/);
  });

  it("world-state's plain form still recognises (no option)", () => {
    const store = found(1, "chick");
    store.appendEvent({ kind: "recognise", objectId: "chick" });
    expect(store.getState().recognised).toEqual(["chick"]);
    expect(wasRight({ objectId: "chick" })).toBe(true);
  });
});

describe("when it is asked (FR1)", () => {
  it("the options are shuffled once per run, seeded by the run id; replay gives the same order", () => {
    for (const o of objects) {
      expect([...optionOrder("run-a", o)].sort()).toEqual([0, 1, 2]);
      expect(optionOrder("run-a", o)).toEqual(optionOrder("run-a", o));
    }
    const orders = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((r) => optionOrder(r, "chick").join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("right after the box beat: the box lines, then the question (day 1: the box beat was the arrival scene, so the question alone)", () => {
    const store = createStore({ startDay: 2 });
    const d = queued(store, () => store.appendEvent({ kind: "openLayer", objectId: "camera" }));
    const keys = d.queue.map((q) => q.key);
    const box = keys.map((k) => k.replace(/#\d+$/, "")).lastIndexOf("d2:beat:box"); // (findLastIndex is past this tsconfig's lib)
    expect(box).toBeGreaterThanOrEqual(0);
    expect(keys[box + 1]).toBe("d2:recognise:camera");
    // box-arrival R4: on day 1 opening the box queues no box beat.
    const one = createStore({ startDay: 1 });
    const d1 = queued(one, () => one.appendEvent({ kind: "openLayer", objectId: "chick" }));
    expect(d1.queue.map((q) => q.key)).toEqual(["d1:recognise:chick"]);
  });

  it("snapshot: day 1, the chick's question (no hints: every option looks the same)", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.dialogue = push(EMPTY_DIALOGUE, questionQueued(1, "chick", store.getRunId())!);
    const out = everyScreen(store.getState(), session);
    expect(out).toContain(recogniseTable.get("chick")!.q);
    // world-prompts R2: the options are the column's rows.
    const buttons = [...out.matchAll(/<button type="button" class="dc-row" data-action="loop-choice" data-index="(\d)"/g)].map((m) => Number(m[1]));
    expect(buttons).toEqual(optionOrder(store.getRunId(), "chick"));
    expect(out).toMatchSnapshot();
  });

  it("snapshot: day 4 pager, a wrong answer plays its lines; no retry that day; the next day picking it up asks again, once", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    const ctx = ctxOf(store);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, questionQueued(4, "pager", store.getRunId())!);
    const answered = queued(store, () => loopActions["loop-choice"]!(ctx, { index: String(wrongIndex("pager")) } as DOMStringMap, null as never));
    const answer = answered.queue.find((q) => q.key === "d4:recognise:pager:answer")!;
    // Content 2026-11-06: the picked wrong option carries its own lines.
    const wrong = recogniseTable.get("pager")!.options[wrongIndex("pager")]!;
    expect(answer.lines).toEqual([...wrong.say!.map((t) => ({ k: "narration", t })), { k: "inner", t: wrong.inner! }]);
    expect(store.getState().recognised).toEqual([]);

    // Same day: picking it up does not ask again.
    ctx.session.dialogue = EMPTY_DIALOGUE;
    loopActions["loop-hold"]!(ctx, { object: "pager" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue).toEqual([]);
    loopActions["loop-put-down"]!(ctx, none, null as never);

    // The next day: picking it up asks again.
    store.appendEvent({ kind: "lieDown" });
    loopActions["loop-hold"]!(ctx, { object: "pager" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d5:recognise:pager"]);
    expect(everyScreen(store.getState(), ctx.session)).toMatchSnapshot();
    // Answered right this time: it is known, and the desk bar shows it in full colour.
    loopActions["loop-choice"]!(ctx, { index: String(rightIndex("pager")) } as DOMStringMap, null as never);
    expect(store.getState().recognised).toEqual(["pager"]);
    expect(askedOn(store.getEvents(), 5, "pager")).toBe(true);
    loopActions["loop-put-down"]!(ctx, none, null as never);
    loopActions["loop-hold"]!(ctx, { object: "pager" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue).toEqual([]);
  });

  it("put down before it is answered, the question goes with the object: never asked under another; asked again on its next pick-up", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    const ctx = ctxOf(store);
    const hold = (o: string) => loopActions["loop-hold"]!(ctx, { object: o } as DOMStringMap, null as never);
    const box = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
    const chickQ = recogniseTable.get("chick")!.q;
    const cameraQ = recogniseTable.get("camera")!.q;

    hold("chick");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d2:recognise:chick"]);
    // Esc puts it down unanswered: the question leaves the queue (and the waiting list).
    expect(loopKeys(ctx, { key: "Escape", target: null } as unknown as KeyboardEvent)).toBe(true);
    expect(ctx.session.holding).toBeNull();
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(ctx.session.dialogue.waiting ?? []).toEqual([]);
    expect(askedOn(store.getEvents(), 2, "chick")).toBe(false);

    // The camera in hand: its own question, never the chick's.
    hold("camera");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d2:recognise:camera"]);
    expect(box()).toContain(cameraQ);
    expect(box()).not.toContain(chickQ);

    // The chick again (the camera put down by taking it up): the chick's question is asked, once.
    hold("chick");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d2:recognise:chick"]);
    expect(box()).toContain(chickQ);
    expect(box()).not.toContain(cameraQ);
  });

  it("the desk bar shows an unrecognised object desaturated, a recognised one in full colour", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    session.pointed.add("hold"); // the one-time 举起来 pointer is tested in actuators.test.ts
    const bar = () => renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
    expect(bar()).toContain('class="slot unknown" data-object="pager"');
    store.appendEvent({ kind: "recognise", objectId: "pager", option: rightIndex("pager") });
    expect(bar()).toContain('class="slot" data-object="pager"');
  });

  it("the run id is saved; a save from before run ids gets the legacy one", () => {
    const storage = memoryStorage();
    const slot = createRunSlot(storage);
    const store = createStore({ runId: "run-xyz" });
    slot.save(store);
    expect(slot.load()!.runId).toBe("run-xyz");
    const old = memoryStorage();
    old.setItem(RUN_KEY, JSON.stringify({ version: 1, startDay: 1, day: 1, events: [] }));
    expect(createRunSlot(old).load()!.runId).toBe(LEGACY_RUN_ID);
  });
});

describe("the hand takes nothing any more (nights-takes removed, 2026-11-06)", () => {
  it("night 9 has no hand: no choices, nothing taken; the heart rate keeps its number", () => {
    expect(dayFiles.get(9)!.beats.shutdown!.choices ?? []).toEqual([]);
    const store = createStore({ startDay: 9 });
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
    expect(out).toMatch(/<div class="hr"><i><\/i>[^<]+<\/div>/);
  });

  it("night 18: 「不填。握住它。」 sets shook_hand, 「填寄件单」 slip_filled; nothing else is taken or said", () => {
    const choices = dayFiles.get(18)!.beats.shutdown!.choices!;
    const hold = choices.findIndex((c) => c.effects?.flags?.includes("shook_hand"));
    const slip = choices.findIndex((c) => c.effects?.flags?.includes("slip_filled"));
    expect(hold).toBeGreaterThanOrEqual(0);
    expect(slip).toBeGreaterThanOrEqual(0);
    const state: State = createStore({ startDay: 18 }).getState();
    expect(applyChoose(state, { day: 18, beat: "shutdown", index: hold }).flags).toEqual([...state.flags, "shook_hand"]);
    expect(applyChoose(state, { day: 18, beat: "shutdown", index: slip }).flags).toEqual([...state.flags, "slip_filled"]);
    for (const index of [hold, slip]) {
      const store = createStore({ startDay: 18 });
      const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index }));
      expect(d.queue.some((q) => q.key === "d18:take"), choiceOf(18, "shutdown", index)!.text).toBe(false);
    }
  });
});
