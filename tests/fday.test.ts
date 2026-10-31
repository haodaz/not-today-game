import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { derive, f } from "@state/fday";
import { stageOf } from "@state/stages";
import { constants, defaults, validate } from "@state/variables";
import { draftArb, play } from "./helpers";

const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);

describe("f(startDay)", () => {
  it.each(days)("day %i: day, stage and overdueDays follow the tables", (day) => {
    const state = f(day);
    expect(state.day).toBe(day);
    expect(state.stage).toBe(stageOf(day));
    expect(state.overdueDays).toBe(constants.overdueBase + day);
  });

  it("is a valid state for every day, including past the last", () => {
    for (const day of [...days, constants.lastDay + 1, 25]) {
      expect(() => validate(f(day) as unknown as Record<string, unknown>), String(day)).not.toThrow();
    }
  });

  it("leaves every other variable at its default", () => {
    const { day, stage, overdueDays, ...rest } = f(7) as unknown as Record<string, unknown>;
    const { day: _d, stage: _s, overdueDays: _o, ...expected } = defaults();
    expect(rest).toEqual(expected);
    expect([day, stage, overdueDays].every((v) => typeof v === "number")).toBe(true);
  });

  it("returns an independent state each call", () => {
    f(1).flags.push("x");
    expect(f(1).flags).toEqual([]);
  });

  it("rejects a start day that is not an integer >= 1", () => {
    for (const bad of [0, -3, 2.5, Number.NaN]) expect(() => f(bad), String(bad)).toThrow(RangeError);
  });
});

describe("derive", () => {
  it("is idempotent", () => {
    for (const day of days) {
      const once = derive(f(day));
      expect(derive(once)).toEqual(once);
    }
  });

  it("property: overdueDays === overdueBase + day and stage === stageOf(day) after any log", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 80 }), (startDay, drafts) => {
        const state = play(startDay, drafts);
        expect(state.overdueDays).toBe(constants.overdueBase + state.day);
        expect(state.stage).toBe(stageOf(state.day));
      }),
    );
  });

  it("property: overdueDays === overdueBase + day for every day 1..lastDay", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: constants.lastDay }), (day) => {
        return f(day).overdueDays === constants.overdueBase + day;
      }),
    );
  });
});
