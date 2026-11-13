import "./specimen";
import { describe, expect, it } from "vitest";
import "./specimen";
import day10Raw from "@content/days/day-10.json";
import { choiceOf } from "@state/days/effects";
import { dayFiles, parseDayFile, taskFlags } from "@state/days/table";
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
  /** The hand night's refusal (meters-v2 cleanup 2026-11-13): the content's 不给, marked `hand: "refuse"`. */
  const refusalOn = (day: number) => {
    const index = dayFiles.get(day)!.beats.shutdown!.choices!.findIndex((c) => c.hand === "refuse");
    expect(index, `day ${day}`).toBeGreaterThanOrEqual(0);
    return index;
  };

  it("the night's refusal costs no SAN of its own (the judgement's handSanRefused is its price); flags are added", () => {
    const store = createStore({ startDay: 10 });
    const san = store.getState().san;
    store.appendEvent({ kind: "choose", beat: "shutdown", index: refusalOn(10) });
    expect(store.getState().san).toBe(san);
    const flagged = choiceDay((e) => Array.isArray(e.flags));
    const s2 = createStore({ startDay: flagged.day });
    s2.appendEvent({ kind: "choose", beat: "shutdown", index: flagged.index });
    for (const f of choiceOf(flagged.day, "shutdown", flagged.index)!.effects!.flags!) expect(s2.getState().flags).toContain(f);
  });

  it("a content shutdown choice on a hand night (10–17) answers the hand with nothing; once a night", () => {
    for (const day of [10, 17]) {
      const store = createStore({ startDay: day });
      const index = refusalOn(day);
      store.appendEvent({ kind: "choose", beat: "shutdown", index });
      expect(store.getState().raids[String(day)]).toEqual({ gave: null });
      expect(() => store.appendEvent({ kind: "choose", beat: "shutdown", index })).toThrow(/already answered/);
    }
    // Night 18 is the branch, not a hand night: its choices write no raid.
    const last = createStore({ startDay: 18 });
    last.appendEvent({ kind: "choose", beat: "shutdown", index: 0 });
    expect(last.getState().raids).toEqual({});
  });

  it("the old night-raid effects are rejected by the loader; a missing choice is rejected", () => {
    const zh = structuredClone(day10Raw) as any;
    zh.beats.shutdown.choices[0].effects = { item_dream: "chick" };
    expect(() => parseDayFile(zh, "day-10.json")).toThrow(/unknown key "item_dream"/);
    zh.beats.shutdown.choices[0].effects = { item_lost: "loan" };
    expect(() => parseDayFile(zh, "day-10.json")).toThrow(/unknown key "item_lost"/);
    expect(() => createStore({ startDay: 10 }).appendEvent({ kind: "choose", beat: "shutdown", index: 99 })).toThrow(/no choice/);
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
