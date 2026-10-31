import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { f } from "@state/fday";
import { fold, step } from "@state/replay";
import { draftArb, stampLog } from "./helpers";

describe("fold", () => {
  it("an empty log gives f(startDay)", () => {
    expect(fold([], f(4))).toEqual(f(4));
  });

  it("property: replaying the same log twice gives deep-equal state", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 120 }), (startDay, drafts) => {
        const log = stampLog(startDay, drafts);
        expect(fold(log, f(startDay))).toEqual(fold(log, f(startDay)));
      }),
    );
  });

  it("property: it is a left fold, so splitting the log anywhere gives the same state", () => {
    fc.assert(
      fc.property(fc.array(draftArb, { maxLength: 80 }), fc.nat(80), (drafts, cut) => {
        const log = stampLog(1, drafts);
        const at = Math.min(cut, log.length);
        const whole = fold(log, f(1));
        const split = fold(log.slice(at), fold(log.slice(0, at), f(1)));
        expect(split).toEqual(whole);
      }),
    );
  });

  it("property: day and stage never decrease as a log grows", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 100 }), (startDay, drafts) => {
        let state = f(startDay);
        for (const event of stampLog(startDay, drafts)) {
          const next = step(state, event);
          expect(next.day).toBeGreaterThanOrEqual(state.day);
          expect(next.stage).toBeGreaterThanOrEqual(state.stage);
          state = next;
        }
      }),
    );
  });

  it("does not mutate the log or the base", () => {
    const log = stampLog(1, [{ kind: "lieDown" }, { kind: "pokeReset" }]);
    const snapshot = structuredClone(log);
    const base = f(1);
    const baseSnapshot = structuredClone(base);
    fold(log, base);
    expect(log).toEqual(snapshot);
    expect(base).toEqual(baseSnapshot);
  });

  it("step applies the event and derives in one go", () => {
    const next = step(f(1), { kind: "lieDown", day: 1 });
    expect(next.day).toBe(2);
    expect(next).toEqual(f(2));
  });
});
