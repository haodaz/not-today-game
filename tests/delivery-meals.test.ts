import { describe, expect, it } from "vitest";
import { anythingOrderable, shopsOn } from "@state/delivery/shops";
import { deliveryTable, MEALS, mealOf, type Meal } from "@state/delivery/table";
import type { EventDraft } from "@state/events";
import { f } from "@state/fday";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import { arrivalOf, composeReceipt, mealView, ordersOn } from "@world/delivery/meals";
import { stampLog } from "./helpers";

const lunch = deliveryTable.windows.lunch;
const d1 = mealOf(1, "lunch")!;
const otherItem = (day: number, meal: Meal) =>
  shopsOn(day, meal).flatMap((e) => (e.open ? e.items.map((it) => ({ shopId: e.shop.id, it })) : []))
    .find(({ it }) => it.id !== deliveryTable.defaults[meal].item)!;
const orderDraft = (meal: Meal, shopId: string, itemId: string, t: string): EventDraft => ({ kind: "order", meal, shopId, itemId, t });
const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);

describe("ordersOn", () => {
  it("keeps the first order of each window on that day only", () => {
    const log = stampLog(1, [
      orderDraft("lunch", "a", "x", "11:40"),
      orderDraft("lunch", "b", "y", "11:50"),
      { kind: "lieDown" },
      orderDraft("dinner", "c", "z", "18:10"),
    ]);
    expect(ordersOn(log, 1)).toEqual({ lunch: { meal: "lunch", shopId: "a", itemId: "x", t: "11:40" } });
    expect(ordersOn(log, 2)).toEqual({ dinner: { meal: "dinner", shopId: "c", itemId: "z", t: "18:10" } });
  });
});

describe("arrivalOf (E5)", () => {
  it("ordered: at `arrives`, or the order time if later", () => {
    expect(arrivalOf(1, "lunch", { meal: "lunch", shopId: "s", itemId: "i", t: lunch[0] })).toBe(d1.arrives);
    expect(arrivalOf(1, "lunch", { meal: "lunch", shopId: "s", itemId: "i", t: lunch[1] })).toBe(lunch[1]);
  });

  it("not ordered: the default comes at the end of the window", () => {
    expect(arrivalOf(1, "lunch", undefined)).toBe(lunch[1]);
  });

  it("nothing orderable: at `arrives`; nothing arrives: null", () => {
    for (const day of days) {
      for (const meal of MEALS) {
        const entry = mealOf(day, meal)!;
        if (entry.arrives === null) expect(arrivalOf(day, meal, undefined)).toBeNull();
        else if (!anythingOrderable(day, meal)) expect(arrivalOf(day, meal, undefined)).toBe(entry.arrives);
      }
    }
  });
});

describe("composeReceipt (E6)", () => {
  it("replaces a leading item name with the chosen one, keeping the rest", () => {
    expect(composeReceipt("扁肉 · 收件人：{login}", "拌面")).toBe("拌面 · 收件人：{login}");
    expect(composeReceipt(d1.receipt, "扁肉")).toBe("扁肉" + d1.receipt!.slice("黄焖鸡米饭 · 微辣".length));
  });

  it("matches the longest item name", () => {
    expect(composeReceipt("黄焖鸡米饭 · 不放香菜 · 备注：等", "拿铁 · 热")).toBe("拿铁 · 热 · 备注：等");
  });

  it("leaves receipts that start with no item name, and null, as written", () => {
    expect(composeReceipt("—", "拌面")).toBe("—");
    expect(composeReceipt(null, "拌面")).toBeNull();
    expect(composeReceipt("扁肉", null)).toBe("扁肉");
  });
});

describe("mealView", () => {
  const view = (now: string, drafts: EventDraft[] = [], day = 1, meal: Meal = "lunch", state: State = f(day)) =>
    mealView(day, meal, state, stampLog(day, drafts), now)!;

  it("walks the phases of an unordered lunch", () => {
    expect(view("09:00").phase).toBe("before");
    expect(view(lunch[0]).phase).toBe("open");
    expect(view(lunch[1]).phase).toBe("delivered");
    expect(view(lunch[1], [{ kind: "pickup", meal: "lunch" }]).phase).toBe("pickedUp");
  });

  it("an order waits until it arrives", () => {
    const pick = otherItem(1, "lunch");
    const drafts = [orderDraft("lunch", pick.shopId, pick.it.id, lunch[0])];
    expect(view(lunch[0], drafts).phase).toBe("waiting");
    expect(view(d1.arrives!, drafts).phase).toBe("delivered");
  });

  it("shows the default with who ordered it, or the chosen item with the day's receipt notes", () => {
    const unordered = view(lunch[1]);
    expect(unordered.order).toMatchObject({ shopId: deliveryTable.defaults.lunch.shop, by: deliveryTable.defaults.lunch.by });
    expect(unordered.receipt).toBe(d1.receipt);

    const pick = otherItem(4, "lunch");
    const chosen = view(lunch[1], [orderDraft("lunch", pick.shopId, pick.it.id, lunch[0])], 4);
    expect(chosen.order).toEqual({ shopId: pick.shopId, itemId: pick.it.id, itemName: pick.it.name, by: null });
    expect(chosen.receipt!.startsWith(pick.it.name)).toBe(true);
    expect(chosen.receipt!.endsWith("备注：等")).toBe(true);
  });

  it("day 1 lunch brings the box whatever was chosen", () => {
    const pick = otherItem(1, "lunch");
    expect(view(lunch[1]).extras.box).toBe(true);
    expect(view(lunch[1], [orderDraft("lunch", pick.shopId, pick.it.id, lunch[0])]).extras.box).toBe(true);
    expect(view(lunch[1], [], 2).extras.box).toBe(false);
  });

  it("a meal that never comes is `none` and carries its anomaly", () => {
    const day = days.find((d) => mealOf(d, "lunch")!.arrives === null)!;
    const v = view("12:00", [], day);
    expect(v.phase).toBe("none");
    expect(v.order).toBeNull();
    expect(v.bag).toBeNull();
    expect(v.anomaly).toBe(mealOf(day, "lunch")!.anomaly);
  });


  it("is null past the scripted days", () => {
    expect(mealView(constants.lastDay + 1, "lunch", f(1), [], "12:00")).toBeNull();
  });
});
