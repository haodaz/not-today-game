import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { applyPickup } from "@state/delivery/effects";
import { canOrder, shopsOn } from "@state/delivery/shops";
import { BOX_FLAG, deliveryTable, MEALS, mealOf, returnMeal, RETURN_FLAG, type Meal } from "@state/delivery/table";
import { f } from "@state/fday";
import { dayFiles } from "@state/days/table";
import { isHeld, lostObjects, returnedObjects } from "@state/objects";
import { createStore } from "@state/store";
import { fold } from "@state/replay";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import { lieDowns, play, stampLog } from "./helpers";

const battery = (() => {
  for (const shop of deliveryTable.shops) {
    const item = shop.items.find((it) => it.effects?.flags?.length);
    if (item) return { shopId: shop.id, itemId: item.id, flag: item.effects!.flags![0]! };
  }
  throw new Error("no item with effects");
})();

const order = (meal: Meal, shopId: string, itemId: string, t = deliveryTable.windows[meal][0]): EventDraft => ({
  kind: "order", meal, shopId, itemId, t,
});

/** The first day (and meal) of each kind in the data. */
const firstDay = (test: (day: number, meal: Meal) => boolean) => {
  for (const day of deliveryTable.days.keys()) for (const meal of MEALS) if (test(day, meal)) return { day, meal };
  throw new Error("no such day");
};
const neverArrives = firstDay((d, m) => mealOf(d, m)!.arrives === null);
const neverArrivesWithFlags = firstDay((d, m) => mealOf(d, m)!.arrives === null && !!mealOf(d, m)!.effects?.flags?.length);

describe("order", () => {
  it("applies the item's effects (the battery sets its flag)", () => {
    expect(canOrder(1, "lunch", battery.shopId, battery.itemId)).toBe(true);
    expect(play(1, [order("lunch", battery.shopId, battery.itemId)]).flags).toContain(battery.flag);
  });

  it("an item with no effects changes nothing", () => {
    const d = deliveryTable.defaults.lunch;
    expect(play(1, [order("lunch", d.shop, d.item)])).toEqual(f(1));
  });

  it("is rejected when the shop is closed for that window, the day's drift, or the item is unknown", () => {
    const evening = deliveryTable.shops.find((s) => s.hours && s.hours[0] >= deliveryTable.windows.lunch[1])!;
    expect(() => play(1, [order("lunch", evening.id, evening.items[0]!.id)])).toThrow(/cannot be ordered/);
    expect(() => play(1, [order("dinner", evening.id, evening.items[0]!.id)])).not.toThrow();
    expect(() => play(1, [order("lunch", battery.shopId, "caviar")])).toThrow(/cannot be ordered/);
    expect(() => play(neverArrives.day, [order("lunch", battery.shopId, battery.itemId)])).toThrow(/cannot be ordered/);
  });

  it("is rejected with a bad time or meal", () => {
    expect(() => play(1, [order("lunch", battery.shopId, battery.itemId, "noon")])).toThrow(/HH:MM/);
    expect(() => play(1, [{ kind: "order", meal: "brunch" as Meal, shopId: battery.shopId, itemId: battery.itemId, t: "11:30" }])).toThrow(/unknown meal/);
  });
});

describe("pickup", () => {
  it("day 1 lunch brings the box", () => {
    expect(mealOf(1, "lunch")!.effects?.flags).toContain(BOX_FLAG);
    expect(f(1).flags).not.toContain(BOX_FLAG);
    expect(play(1, [{ kind: "pickup", meal: "lunch" }]).flags).toContain(BOX_FLAG);
  });

  it("is rejected for a meal that never arrives", () => {
    expect(() => play(neverArrives.day, [{ kind: "pickup", meal: neverArrives.meal }])).toThrow(/nothing arrives/);
  });
});

describe("useItem", () => {
  const chick = membersOf("found")![0]!;
  it("is logged and changes nothing", () => {
    expect(play(1, [{ kind: "useItem", itemId: battery.itemId, objectId: chick }])).toEqual(f(1));
  });
  it("rejects unknown items and objects", () => {
    expect(() => play(1, [{ kind: "useItem", itemId: "caviar", objectId: chick }])).toThrow(/unknown item/);
    expect(() => play(1, [{ kind: "useItem", itemId: battery.itemId, objectId: "toaster" }])).toThrow(/unknown object/);
  });
});

describe("meals that never arrive (day-driven flags, E4)", () => {
  it("set their flags from that day on", () => {
    const flag = mealOf(neverArrivesWithFlags.day, neverArrivesWithFlags.meal)!.effects!.flags![0]!;
    expect(f(neverArrivesWithFlags.day).flags).toContain(flag);
    expect(f(neverArrivesWithFlags.day - 1).flags).not.toContain(flag);
    expect(play(neverArrivesWithFlags.day - 1, lieDowns(1)).flags).toContain(flag);
  });
});

describe("held, lost and returned objects (state `lost`)", () => {
  const [a, b] = membersOf("found")! as string[];
  const handed = (state: State, lost: string[]): State => ({ ...state, found: [a, b] as State["found"], lost });

  it("what was handed to the hand is lost, in the order given; the loan row is not an object", () => {
    const state = handed(f(8), [b!, "loan", a!]);
    expect(lostObjects(state)).toEqual([b, a]);
    expect(isHeld(a!, state)).toBe(false);
  });

  it("the returned-objects pickup brings everything back, and the bag held it in order", () => {
    const before = handed(f(returnMeal!.day), [a!, "loan", b!]);
    expect(returnedObjects(before)).toEqual([a, "loan", b]);
    const after = applyPickup(before, { day: returnMeal!.day, meal: returnMeal!.meal });
    expect(after.flags).toContain(RETURN_FLAG);
    expect(after.lost).toEqual([]);
    expect(isHeld(a!, after) && isHeld(b!, after)).toBe(true);
  });

  it("an item_lost choice adds to `lost`; raids are untouched", () => {
    const store = createStore({ startDay: 5 });
    store.appendEvent({ kind: "reply", choice: "lend" });
    const index = dayFiles.get(5)!.beats.shutdown!.choices!.findIndex((c) => c.effects?.item_lost === "loan");
    store.appendEvent({ kind: "choose", beat: "shutdown", index });
    expect(store.getState().lost).toEqual(["loan"]);
    expect(store.getState().raids).toEqual({});
  });

  it("an object never found is not held", () => {
    expect(isHeld(a!, { ...f(1), found: [] })).toBe(false);
  });
});

describe("replay with delivery events", () => {
  /** Valid by construction: each day may order what is orderable, pick up what arrives, then lie down. */
  const dayPlan = fc.record({
    lunchPick: fc.nat(20),
    dinnerPick: fc.nat(20),
    orderLunch: fc.boolean(),
    orderDinner: fc.boolean(),
    pickUp: fc.boolean(),
  });

  function logFor(plans: { lunchPick: number; dinnerPick: number; orderLunch: boolean; orderDinner: boolean; pickUp: boolean }[]): EventDraft[] {
    const drafts: EventDraft[] = [];
    plans.forEach((p, i) => {
      const day = i + 1;
      for (const meal of MEALS) {
        const wanted = meal === "lunch" ? p.orderLunch : p.orderDinner;
        const options = shopsOn(day, meal).flatMap((e) => (e.open ? e.items.map((it) => [e.shop.id, it.id] as const) : []));
        if (wanted && options.length) {
          const [shopId, itemId] = options[(meal === "lunch" ? p.lunchPick : p.dinnerPick) % options.length]!;
          drafts.push(order(meal, shopId, itemId));
        }
        if (p.pickUp && mealOf(day, meal)?.arrives) drafts.push({ kind: "pickup", meal });
      }
      drafts.push({ kind: "lieDown" });
    });
    return drafts;
  }

  it("property: replaying a delivery log twice gives deep-equal state", () => {
    fc.assert(
      fc.property(fc.array(dayPlan, { maxLength: constants.lastDay }), (plans) => {
        const log = stampLog(1, logFor(plans));
        expect(fold(log, f(1))).toEqual(fold(log, f(1)));
      }),
    );
  });

  it("property: picking up every meal over the whole run sets every arriving meal's flags", () => {
    fc.assert(
      fc.property(fc.array(dayPlan, { minLength: constants.lastDay, maxLength: constants.lastDay }), (plans) => {
        const state = play(1, logFor(plans.map((p) => ({ ...p, pickUp: true }))));
        for (const [, entry] of deliveryTable.days) {
          for (const meal of MEALS) for (const flag of entry[meal].effects?.flags ?? []) expect(state.flags).toContain(flag);
        }
      }),
    );
  });
});
