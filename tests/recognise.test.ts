import fc from "fast-check";
import { describe, expect, it } from "vitest";
import objectsFile from "@content/objects.json";
import stagesFile from "@content/stages.json";
import takesFile from "@content/nights-takes.json";
import { applyChoose, choiceOf } from "@state/days/effects";
import { dayFiles } from "@state/days/table";
import { parseTakes, raidMove, raidNights, takeOf } from "@state/nights";
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
import { dialogueBox, renderRoom } from "@world/room/hud";
import { loopActions } from "@world/room/game";

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
const boxDay = (o: string) => (stagesFile.objectsFoundOnDay as Record<string, number>)[o]!;

describe("content/objects.json", () => {
  it("every object out of the box has a question on its box day, three options, exactly one right", () => {
    expect(objects.sort()).toEqual(Object.keys(stagesFile.objectsFoundOnDay).sort());
    for (const o of objects) {
      const e = recogniseTable.get(o)!;
      expect(e.day, o).toBe(boxDay(o));
      expect(e.options).toHaveLength(3);
      expect(e.options.filter((x) => x.right), o).toHaveLength(1);
    }
  });

  it("is read strictly", () => {
    const raw = () => structuredClone(objectsFile) as any;
    const two = raw();
    two.objects.chick.options[0].right = true;
    expect(() => parseObjects(two)).toThrow(/exactly one right/);
    const day = raw();
    day.objects.chick.day = 2;
    expect(() => parseObjects(day)).toThrow(/box day 1/);
    const missing = raw();
    delete missing.objects.pager;
    expect(() => parseObjects(missing)).toThrow(/"pager" comes out of the box/);
    const short = raw();
    short.objects.chick.options.pop();
    expect(() => parseObjects(short)).toThrow(/exactly 3 options/);
    expect(() => parseObjects({ ...raw(), extra: 1 })).toThrow(/unknown key "extra"/);
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

  it("the textbook is not one of the six: a right answer is known from the log, not state", () => {
    const store = found(2, "textbook");
    store.appendEvent({ kind: "recognise", objectId: "textbook", option: rightIndex("textbook") });
    expect(store.getState().recognised).toEqual([]);
    expect(knows("textbook", store.getState(), store.getEvents())).toBe(true);
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

  it("right after the box beat: the box lines, then the question", () => {
    const store = createStore({ startDay: 1 });
    const d = queued(store, () => store.appendEvent({ kind: "openLayer", objectId: "chick" }));
    const keys = d.queue.map((q) => q.key);
    const box = keys.indexOf("d1:beat:box");
    expect(box).toBeGreaterThanOrEqual(0);
    expect(keys[box + 1]).toBe("d1:recognise:chick");
  });

  it("snapshot: day 1, the chick's question (no hints: every option looks the same)", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.dialogue = push(EMPTY_DIALOGUE, questionQueued(1, "chick", store.getRunId())!);
    const out = dialogueBox(store.getState(), session)!.value;
    expect(out).toContain(recogniseTable.get("chick")!.q);
    const buttons = [...out.matchAll(/<button type="button" data-action="loop-choice" data-index="(\d)">/g)].map((m) => Number(m[1]));
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
    const wrong = recogniseTable.get("pager")!.wrong;
    expect(answer.lines).toEqual([...wrong.say.map((t) => ({ k: "narration", t })), { k: "inner", t: wrong.inner }]);
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
    expect(dialogueBox(store.getState(), ctx.session)!.value).toMatchSnapshot();
    // Answered right this time: it is known, and the desk bar shows it in full colour.
    loopActions["loop-choice"]!(ctx, { index: String(rightIndex("pager")) } as DOMStringMap, null as never);
    expect(store.getState().recognised).toEqual(["pager"]);
    expect(askedOn(store.getEvents(), 5, "pager")).toBe(true);
    loopActions["loop-put-down"]!(ctx, none, null as never);
    loopActions["loop-hold"]!(ctx, { object: "pager" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue).toEqual([]);
  });

  it("the desk bar shows an unrecognised object desaturated, a recognised one in full colour", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
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

describe("what the hand takes when nothing is given (nights-takes)", () => {
  const nothing = (day: number) => dayFiles.get(day)!.beats.shutdown!.choices!.findIndex((c) => raidMove(c).kind === "nothing");

  it("content/nights-takes.json is read strictly: nights 9 and 18 only", () => {
    expect(raidNights.filter((d) => takeOf(d))).toEqual([9, 18]);
    expect(takeOf(9)).toEqual(takesFile.takes["9"]);
    const raw = structuredClone(takesFile) as any;
    expect(() => parseTakes({ ...raw, extra: 1 })).toThrow(/unknown key "extra"/);
    expect(() => parseTakes({ ...raw, takes: { ...raw.takes, 14: raw.takes["9"] } })).toThrow(/not a raid night/);
    expect(() => parseTakes({ ...raw, takes: { 9: { ...raw.takes["9"], flag: "" } } })).toThrow(/non-empty/);
  });

  it("night 9, nothing given: the flag is set and the line plays; the heart rate loses its number", () => {
    const store = createStore({ startDay: 9 });
    const index = nothing(9);
    const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index }));
    const take = takeOf(9)!;
    expect(store.getState().flags).toContain(take.flag);
    expect(store.getState().raids["9"]).toEqual({ blockedWith: null, gave: null });
    expect(d.queue.find((q) => q.key === "d9:take")!.lines).toEqual([{ k: "narration", t: take.say }]);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
    expect(out).toMatch(/<div class="hr"><i><\/i><\/div>/);
  });

  it("night 9, held up instead: nothing is taken", () => {
    const store = createStore({ startDay: 9 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    store.appendEvent({ kind: "recognise", objectId: "chick", option: rightIndex("chick") });
    const block = dayFiles.get(9)!.beats.shutdown!.choices!.findIndex((c) => raidMove(c).kind === "block");
    store.appendEvent({ kind: "choose", beat: "shutdown", index: block });
    expect(store.getState().flags).not.toContain(takeOf(9)!.flag);
  });

  it("other nights only cost san", () => {
    const state = createStore({ startDay: 5 }).getState();
    const next = applyChoose(state, { day: 5, beat: "shutdown", index: nothing(5) });
    expect(next.flags).toEqual(state.flags);
  });

  it("night 18: only 「不填。握住它。」 lets it take the hand; 「填寄件单」 never does (requiresFlag)", () => {
    const take = takeOf(18)!;
    expect(take.requiresFlag).toBe("shook_hand");
    const choices = dayFiles.get(18)!.beats.shutdown!.choices!;
    const hold = choices.findIndex((c) => c.effects?.flags?.includes("shook_hand"));
    const slip = choices.findIndex((c) => c.effects?.flags?.includes("slip_filled"));
    expect(hold).toBeGreaterThanOrEqual(0);
    expect(slip).toBeGreaterThanOrEqual(0);
    const state: State = createStore({ startDay: 18 }).getState();
    expect(applyChoose(state, { day: 18, beat: "shutdown", index: hold }).flags).toContain(take.flag);
    expect(applyChoose(state, { day: 18, beat: "shutdown", index: slip }).flags).not.toContain(take.flag);
    // And the line plays only for holding the hand.
    for (const [index, plays] of [[hold, true], [slip, false]] as const) {
      const store = createStore({ startDay: 18 });
      const d = queued(store, () => store.appendEvent({ kind: "choose", beat: "shutdown", index }));
      expect(d.queue.some((q) => q.key === "d18:take"), choiceOf(18, "shutdown", index)!.text).toBe(plays);
    }
  });

  it("a requiresFlag must be a flag that night's nothing-choices set", () => {
    const raw = structuredClone(takesFile) as any;
    expect(() => parseTakes({ ...raw, takes: { 18: { ...raw.takes["18"], requiresFlag: "nope" } } })).toThrow(/sets "nope"/);
    expect(() => parseTakes({ ...raw, takes: { 18: { ...raw.takes["18"], requiresFlag: "" } } })).toThrow(/non-empty/);
  });
});
