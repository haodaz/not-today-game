import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { f } from "@state/fday";
import { computeState, createStore } from "@state/store";
import { membersOf } from "@state/variables";
import { draftArb, stampLog } from "./helpers";

const firstObject = membersOf("found")![0]!;

describe("computeState", () => {
  it("an empty log is f(startDay)", () => {
    expect(computeState(1, [])).toEqual(f(1));
    expect(computeState(12, [])).toEqual(f(12));
  });

  it("replaying a 200-event log twice gives deep-equal state", () => {
    const drafts = fc.sample(draftArb, { numRuns: 200, seed: 20261030 });
    expect(drafts).toHaveLength(200);
    const log = stampLog(1, drafts);
    expect(computeState(1, log)).toEqual(computeState(1, log));
  });

  it("property: replay is idempotent for any start day and log", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 150 }), (startDay, drafts) => {
        const log = stampLog(startDay, drafts);
        expect(computeState(startDay, log)).toEqual(computeState(startDay, log));
      }),
    );
  });
});

describe("createStore / appendEvent", () => {
  it("starts from f(startDay); the ?day=N jump has an empty log", () => {
    const store = createStore({ startDay: 12 });
    expect(store.getState()).toEqual(f(12));
    expect(store.getStartDay()).toBe(12);
    expect(store.getEvents()).toEqual([]);
  });

  it("stamps each event with the current day; lieDown carries the day it was pressed on", () => {
    const store = createStore();
    store.appendEvent({ kind: "pokeReset" });
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "pokeReset" });
    expect(store.getEvents().map((e) => [e.kind, e.day])).toEqual([
      ["pokeReset", 1],
      ["lieDown", 1],
      ["pokeReset", 2],
    ]);
    expect(store.getState().day).toBe(2);
  });

  it("property: a store fed a log, then rebuilt from its saved events, has the same state", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 100 }), (startDay, drafts) => {
        const live = createStore({ startDay });
        for (const draft of drafts) live.appendEvent(draft);
        const rebuilt = createStore({ startDay, events: live.getEvents() });
        expect(rebuilt.getState()).toEqual(live.getState());
      }),
    );
  });

  it("is append-only: the log only grows and earlier snapshots do not change", () => {
    const store = createStore();
    store.appendEvent({ kind: "pokeReset" });
    const snapshot = store.getEvents();
    store.appendEvent({ kind: "lieDown" });
    expect(snapshot).toHaveLength(1);
    expect(store.getEvents()).toHaveLength(2);
    expect(() => (snapshot as unknown as unknown[]).push({})).toThrow(TypeError);
    expect(() => {
      (store.getEvents()[0] as { kind: string }).kind = "lieDown";
    }).toThrow(TypeError);
    expect(store.getEvents()[0]!.kind).toBe("pokeReset");
  });

  it("returns frozen state, so views cannot write it", () => {
    const store = createStore();
    expect(() => {
      (store.getState() as { san: number }).san = 1;
    }).toThrow(TypeError);
    expect(() => store.getState().flags.push("x")).toThrow(TypeError);
  });

  it("a rejected event commits nothing and notifies no one", () => {
    const store = createStore();
    const seen: unknown[] = [];
    store.subscribe((state) => seen.push(state));
    const before = store.getState();
    expect(() => store.appendEvent({ kind: "openLayer", objectId: "not-an-object" })).toThrow();
    expect(store.getState()).toBe(before);
    expect(store.getEvents()).toHaveLength(0);
    expect(seen).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("notifies after each event with the new state, until unsubscribed", () => {
    const store = createStore();
    const days: number[] = [];
    const unsubscribe = store.subscribe((state) => days.push(state.day));
    store.appendEvent({ kind: "lieDown" });
    store.appendEvent({ kind: "lieDown" });
    unsubscribe();
    store.appendEvent({ kind: "lieDown" });
    expect(days).toEqual([2, 3]);
  });

  it("a failing subscriber does not stop the others or undo the state, and its error surfaces", () => {
    const store = createStore();
    const seen: string[] = [];
    store.subscribe(() => {
      throw new Error("view broke");
    });
    store.subscribe(() => seen.push("second"));
    const draft: EventDraft = { kind: "openLayer", objectId: firstObject };
    expect(() => store.appendEvent(draft)).toThrow("view broke");
    expect(seen).toEqual(["second"]);
    expect(store.getState().found).toEqual([firstObject]);
    expect(store.getEvents()).toHaveLength(1);
  });
});
