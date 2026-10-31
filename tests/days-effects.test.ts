import { describe, expect, it } from "vitest";
import { choiceOf } from "@state/days/effects";
import { dayFiles, taskFlags } from "@state/days/table";
import { createStore } from "@state/store";

/** The first day whose shutdown offers a choice with each kind of effect. */
const choiceDay = (test: (e: Record<string, unknown>) => boolean) => {
  for (const [day, file] of dayFiles) {
    const index = file.beats.shutdown?.choices?.findIndex((c) => !c.cond_show && test((c.effects ?? {}) as Record<string, unknown>)) ?? -1;
    if (index >= 0) return { day, index };
  }
  throw new Error("no such choice");
};

describe("step", () => {
  it("records loop moments and changes nothing; rejects unknown ones", () => {
    const store = createStore();
    const before = store.getState();
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "step", name: "delivery:arrives:lunch", t: "12:04" });
    expect(store.getState()).toEqual(before);
    expect(() => store.appendEvent({ kind: "step", name: "dance", t: "09:03" })).toThrow(/unknown step/);
    expect(() => store.appendEvent({ kind: "step", name: "boot", t: "noon" })).toThrow(/HH:MM/);
  });
});

describe("choose", () => {
  it("holding up an object puts it in dream state for that night only and moves san", () => {
    const { day, index } = choiceDay((e) => typeof e.item_dream === "string");
    const choice = choiceOf(day, "shutdown", index)!;
    const object = choice.effects!.item_dream!;
    const store = createStore({ startDay: day });
    // Only a found, recognised object can be held up (night-hand FR2).
    store.appendEvent({ kind: "openLayer", objectId: object });
    store.appendEvent({ kind: "recognise", objectId: object });
    const san = store.getState().san;
    store.appendEvent({ kind: "choose", beat: "shutdown", index });
    const state = store.getState();
    expect(state.dream[object]).toEqual({ until: day + 1 });
    expect(state.san).toBe(Math.min(100, san + (choice.effects!.san ?? 0)));
  });

  it("giving nothing lowers san; flags are added", () => {
    const { day, index } = choiceDay((e) => (e.san as number) < 0);
    const store = createStore({ startDay: day });
    const san = store.getState().san;
    store.appendEvent({ kind: "choose", beat: "shutdown", index });
    expect(store.getState().san).toBeLessThan(san);
    const flagged = choiceDay((e) => Array.isArray(e.flags));
    const s2 = createStore({ startDay: flagged.day });
    s2.appendEvent({ kind: "choose", beat: "shutdown", index: flagged.index });
    for (const f of choiceOf(flagged.day, "shutdown", flagged.index)!.effects!.flags!) expect(s2.getState().flags).toContain(f);
  });

  it("a choice that is not offered (cond_show) or does not exist is rejected", () => {
    const store = createStore({ startDay: 5 });
    const hidden = dayFiles.get(5)!.beats.shutdown!.choices!.findIndex((c) => c.cond_show);
    expect(hidden).toBeGreaterThanOrEqual(0);
    expect(() => store.appendEvent({ kind: "choose", beat: "shutdown", index: hidden })).toThrow(/not offered/);
    expect(() => store.appendEvent({ kind: "choose", beat: "shutdown", index: 99 })).toThrow(/no choice/);
  });
});

describe("task", () => {
  it("sets a work-task flag of the day; let counts as let-it-do unchecked", () => {
    const [flag] = taskFlags(1);
    const store = createStore();
    store.appendEvent({ kind: "task", flag: flag!, mode: "let" });
    expect(store.getState().flags).toContain(flag);
    expect(store.getState().letItDoUnchecked).toBe(1);
    store.appendEvent({ kind: "task", flag: taskFlags(1)[1]!, mode: "look" });
    expect(store.getState().letItDoUnchecked).toBe(1);
  });

  it("rejects a flag that is not one of the day's tasks, and unknown modes", () => {
    const store = createStore();
    expect(() => store.appendEvent({ kind: "task", flag: "anything", mode: "self" })).toThrow(/not a task/);
    expect(() => store.appendEvent({ kind: "task", flag: taskFlags(1)[0]!, mode: "maybe" as never })).toThrow(/mode/);
  });
});
