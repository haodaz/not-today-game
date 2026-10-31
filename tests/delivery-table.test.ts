import fc from "fast-check";
import { describe, expect, it } from "vitest";
import raw from "@content/delivery.json";
import { deliveryTable, MEALS, mealOf, parseDelivery, returnMeal, RETURN_FLAG } from "@state/delivery/table";
import { constants } from "@state/variables";

const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);
const clone = () => structuredClone(raw) as any;

describe("the real delivery table", () => {
  it("loads, frozen, with the strings as written", () => {
    expect(Object.isFrozen(deliveryTable.days.get(1)!.lunch)).toBe(true);
    expect(deliveryTable.days.get(1)!.lunch.bag).toBe((raw as any).days[0].lunch.bag);
    expect(deliveryTable.doorSteps).toEqual((raw as any).door.steps);
  });

  it("FR4 property: every day 1..lastDay has exactly two meals", () => {
    expect([...deliveryTable.days.keys()]).toEqual(days);
    fc.assert(
      fc.property(fc.constantFrom(...days), (day) => {
        const entry = (raw as any).days.find((d: any) => d.day === day);
        const meals = Object.keys(entry).filter((k) => (MEALS as readonly string[]).includes(k));
        expect(meals.sort()).toEqual([...MEALS].sort());
        for (const meal of MEALS) expect(mealOf(day, meal)).toBeDefined();
      }),
    );
  });

  it("FR4 property: arrives null ⇒ bag null (and receipt null)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...days), fc.constantFrom(...MEALS), (day, meal) => {
        const entry = mealOf(day, meal)!;
        if (entry.arrives === null) {
          expect(entry.bag).toBeNull();
          expect(entry.receipt).toBeNull();
        }
      }),
    );
  });

  it("finds the one meal that returns the objects", () => {
    expect(returnMeal).not.toBeNull();
    const entry = mealOf(returnMeal!.day, returnMeal!.meal)!;
    expect(entry.effects?.flags).toContain(RETURN_FLAG);
  });

  it("is empty past the scripted days", () => {
    expect(mealOf(constants.lastDay + 1, "lunch")).toBeUndefined();
  });
});

describe("guard", () => {
  it.each([
    ["an unknown top-level key", (d: any) => (d.extra = 1), /unknown key "extra"/],
    ["a bad arrival time", (d: any) => (d.days[0].lunch.arrives = "12h04"), /HH:MM/],
    ["a missing meal field", (d: any) => delete d.days[0].dinner.anomaly, /missing "anomaly"/],
    ["a default pointing nowhere", (d: any) => (d.defaults.lunch.item = "caviar"), /unknown shop\/item/],
    ["an unknown drift", (d: any) => (d.shopDrift.byRing.room = "only-nowhere"), /unknown drift/],
    ["a ring with no drift", (d: any) => delete d.shopDrift.byRing.door, /no drift for ring "door"/],
    ["a window that ends before it starts", (d: any) => (d.windows.lunch = ["12:30", "11:30"]), /not before/],
    ["the wrong number of door steps", (d: any) => d.door.steps.pop(), /expected 6 steps/],
    ["an unknown placeholder", (d: any) => (d.days[0].lunch.receipt = "{name}"), /placeholder/],
    ["san in meal effects", (d: any) => (d.days[0].lunch.effects = { san: 1 }), /unknown key "san"/],
    ["a duplicate day", (d: any) => d.days.push(structuredClone(d.days[0])), /appears twice/],
  ])("rejects %s", (_name, change, message) => {
    const data = clone();
    change(data);
    expect(() => parseDelivery(data)).toThrow(message);
  });

  it("accepts the untouched file", () => {
    expect(() => parseDelivery(clone())).not.toThrow();
  });
});
