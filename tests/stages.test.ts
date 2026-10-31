import fc from "fast-check";
import { describe, expect, it } from "vitest";
import stages from "@content/stages.json";
import variables from "@content/variables.json";
import {
  cycleOf,
  dreamNights,
  isCalmDaytime,
  isTenderDay,
  nightBeatOf,
  ringOf,
  stageOf,
} from "@state/stages";

const lastDay = variables.constants.lastDay;
const days = Array.from({ length: lastDay }, (_, i) => i + 1);
const byDay = stages.byDay as Record<string, number>;
const cycleList = Object.entries(stages.cycles)
  .filter(([id]) => !id.startsWith("_"))
  .map(([, cycle]) => cycle as { days: number[]; ring: string });

describe("stageOf", () => {
  it.each(days)("day %i equals the table", (day) => {
    expect(stageOf(day)).toBe(byDay[String(day)]);
  });

  it("uses afterDay18 for every day past the table", () => {
    expect(stageOf(lastDay + 1)).toBe(stages.afterDay18);
    expect(stageOf(25)).toBe(stages.afterDay18);
    expect(stageOf(10_000)).toBe(stages.afterDay18);
  });

  it("rejects days that are not integers >= 1", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => stageOf(bad), String(bad)).toThrow(RangeError);
    }
  });

  it("property: stage(day) is monotonic non-decreasing", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 1, max: 500 }), (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        return stageOf(lo) <= stageOf(hi);
      }),
    );
  });
});

describe("ringOf / cycleOf", () => {
  it.each(days)("day %i has the ring of its cycle", (day) => {
    const expected = cycleList.find((cycle) => cycle.days.includes(day))!.ring;
    expect(ringOf(day)).toBe(expected);
  });

  it("keeps the last ring after the last cycle", () => {
    const last = cycleList[cycleList.length - 1]!;
    expect(ringOf(lastDay + 1)).toBe(last.ring);
    expect(ringOf(40)).toBe(last.ring);
    expect(cycleOf(40).days).toEqual(last.days);
  });

  it("rejects invalid days", () => {
    expect(() => ringOf(0)).toThrow(RangeError);
  });
});

describe("calm daytime, tender day, night beat, dream nights", () => {
  it("isCalmDaytime is true exactly on the tabled days", () => {
    for (const day of days) {
      expect(isCalmDaytime(day), String(day)).toBe(stages.calmDaytime.days.includes(day));
    }
  });

  it("isTenderDay is true on exactly one day", () => {
    expect(days.filter(isTenderDay)).toEqual([stages.tenderDay.day]);
  });

  it("nightBeatOf equals the table, and is null past the last night", () => {
    for (const day of days) {
      expect(nightBeatOf(day), String(day)).toBe(
        (stages.nightBeat as Record<string, string>)[String(day)],
      );
    }
    expect(nightBeatOf(lastDay + 1)).toBeNull();
  });

  it("dreamNights equals the table", () => {
    expect([...dreamNights]).toEqual(stages.dreamNights.nights);
  });
});
