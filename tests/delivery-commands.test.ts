import { describe, expect, it } from "vitest";
import { shopsOn } from "@state/delivery/shops";
import { BOX_FLAG, deliveryTable, mealOf } from "@state/delivery/table";
import { createStore } from "@state/store";
import { constants, membersOf } from "@state/variables";
import { doorBeat, installItem, placeOrder } from "@world/delivery/commands";
import { phoneModel } from "@world/delivery/phone";

const [lunchStart, lunchEnd] = deliveryTable.windows.lunch;
const battery = deliveryTable.shops.flatMap((s) => s.items.map((it) => ({ shopId: s.id, it }))).find(({ it }) => it.effects?.flags?.length)!;
const chick = membersOf("found")![0]!;
const lieDownTo = (store: ReturnType<typeof createStore>, day: number) => {
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
};
const closedDay = Array.from({ length: constants.lastDay }, (_, i) => i + 1).find((d) => mealOf(d, "lunch")!.arrives === null)!;

describe("placeOrder", () => {
  it("orders once per window, while it is open", () => {
    const store = createStore();
    const d = deliveryTable.defaults.lunch;
    expect(() => placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: "09:00" })).toThrow(/not open/);
    placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchStart });
    expect(() => placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchStart })).toThrow(/already ordered/);
    expect(() => placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchEnd })).toThrow(/not open/);
    expect(store.getEvents().filter((e) => e.kind === "order")).toHaveLength(1);
  });

  it("an order the shop cannot take is rejected by the reducer and nothing is logged", () => {
    const store = createStore();
    expect(() => placeOrder(store, { meal: "lunch", shopId: battery.shopId, itemId: "caviar", now: lunchStart })).toThrow(/cannot be ordered/);
    expect(store.getEvents()).toHaveLength(0);
  });

  it("nothing can be ordered on a day nothing comes", () => {
    const store = createStore({ startDay: closedDay });
    const d = deliveryTable.defaults.lunch;
    expect(() => placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchStart })).toThrow(/nothing comes/);
  });
});

describe("doorBeat", () => {
  it("is null before 已送达; at the door it walks to the desk and takes the box in", () => {
    const store = createStore();
    expect(doorBeat(store, "lunch", lunchStart)).toBeNull();
    const door = doorBeat(store, "lunch", lunchEnd)!;
    const captions = [door.caption()];
    for (const input of ["walk", "openChain", "reach", "close", "place"] as const) {
      expect(door.next()).toEqual([input]);
      door.advance(input);
      captions.push(door.caption());
    }
    expect(captions).toEqual(deliveryTable.doorSteps);
    expect(store.getState().flags).toContain(BOX_FLAG);
    expect(store.getEvents().map((e) => e.kind)).toEqual(["pickup"]);
    expect(doorBeat(store, "lunch", lunchEnd)!.beat().state).toBe("onDesk");
  });

  it("an ordered meal is at the door at its arrival time", () => {
    const store = createStore({ startDay: 2 });
    const d = deliveryTable.defaults.lunch;
    placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchStart });
    const arrives = mealOf(2, "lunch")!.arrives!;
    expect(doorBeat(store, "lunch", lunchStart)).toBeNull();
    expect(doorBeat(store, "lunch", arrives)).not.toBeNull();
  });

  it("there is no door beat for a meal that never comes", () => {
    expect(doorBeat(createStore({ startDay: closedDay }), "lunch", "23:00")).toBeNull();
  });
});

describe("installItem", () => {
  it("needs the item bought and the object on the desk; then it is logged and changes nothing else", () => {
    const store = createStore();
    const install = () => installItem(store, { shopId: battery.shopId, itemId: battery.it.id, objectId: chick });
    expect(install).toThrow(/not been bought/);
    placeOrder(store, { meal: "lunch", shopId: battery.shopId, itemId: battery.it.id, now: lunchStart });
    expect(install).toThrow(/not on the desk/);
    store.appendEvent({ kind: "openLayer", objectId: chick });
    const before = store.getState();
    expect(install()).toEqual(before);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "useItem", itemId: battery.it.id, objectId: chick });
  });
});

describe("phoneModel", () => {
  it("offers the open window's shops until an order is placed", () => {
    const store = createStore();
    const at = (now: string) => phoneModel(store.getState(), store.getEvents(), now)!;
    expect(at("09:00")).toMatchObject({ meal: null, shops: null, canOrder: false, atDoor: [] });
    expect(at(lunchStart)).toMatchObject({ meal: "lunch", canOrder: true, ordered: null });
    expect(at(lunchStart).shops!.shops.length).toBe(shopsOn(1, "lunch").length);
    const d = deliveryTable.defaults.lunch;
    placeOrder(store, { meal: "lunch", shopId: d.shop, itemId: d.item, now: lunchStart });
    expect(at(lunchStart)).toMatchObject({ canOrder: false, ordered: { shopId: d.shop, itemId: d.item } });
    expect(at(mealOf(1, "lunch")!.arrives!).atDoor).toEqual(["lunch"]);
  });

  it("on a closed day the window is open but nothing can be ordered", () => {
    const store = createStore({ startDay: closedDay });
    const model = phoneModel(store.getState(), store.getEvents(), lunchStart)!;
    expect(model.canOrder).toBe(false);
    expect(model.shops!.shops.every((s) => !s.open)).toBe(true);
    expect(model.meals.lunch.phase).toBe("none");
  });

  it("follows the day counter", () => {
    const store = createStore();
    lieDownTo(store, 3);
    expect(phoneModel(store.getState(), store.getEvents(), lunchStart)!.day).toBe(3);
  });
});
