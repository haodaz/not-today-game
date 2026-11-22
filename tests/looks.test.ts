// texture-pass R6: five looks on the title picker; the two new ones fall back to none's battle sprites.
import { describe, expect, it } from "vitest";
import { PORTRAITS } from "@state/events";
import { createStore } from "@state/store";
import { PORTRAIT_FILES } from "@world/dialogue/box";
import { lookOf } from "@world/endings/boss";
import { cutLook } from "@world/cut/plan";

describe("five looks", () => {
  it("the picker cycles through five, each with its own faceless bust file", () => {
    expect(PORTRAITS).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(PORTRAIT_FILES.p4).toBe("cap");
    expect(PORTRAIT_FILES.p5).toBe("glare");
    expect(new Set(Object.values(PORTRAIT_FILES)).size).toBe(5);
  });
  it("a run can be named with the new looks; the fight uses none's sprites for them", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "names", names: { ...store.getState().names, portrait: "p5" } });
    expect(store.getState().names.portrait).toBe("p5");
    expect(lookOf(store.getState())).toBe("none");
    expect(cutLook(store.getState().names.portrait)).toBe("glare");
    store.appendEvent({ kind: "names", names: { ...store.getState().names, portrait: "p2" } });
    expect(lookOf(store.getState())).toBe("he");
  });
  it("rejects a portrait outside the five", () => {
    const store = createStore({ startDay: 1 });
    expect(() => store.appendEvent({ kind: "names", names: { ...store.getState().names, portrait: "p6" as never } })).toThrow(/portrait/);
  });
});
