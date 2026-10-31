import { describe, expect, it } from "vitest";
import raw from "@content/delivery.json";
import { anythingOrderable, canOrder, driftOn, shopsOn } from "@state/delivery/shops";
import { deliveryTable, MEALS } from "@state/delivery/table";
import { isCalmDaytime, ringOf } from "@state/stages";
import { constants } from "@state/variables";
import { shopListView, swapAdjacent } from "@world/delivery/shops-view";

const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);
/** The first day of each ring, from the stage table. */
const firstDayOf = (ring: string) => days.find((d) => ringOf(d) === ring)!;
const byRing = (raw as any).shopDrift.byRing as Record<string, string>;
const ringOfCode = (pattern: RegExp) => Object.entries(byRing).find(([, code]) => pattern.test(code))![0];

const typoDay = firstDayOf(ringOfCode(/^typo/));
const faceDay = firstDayOf(ringOfCode(/^same-courier/));
const extraDay = firstDayOf(ringOfCode(/^extra-shop-/));
const onlyDay = firstDayOf(ringOfCode(/^only-/));
const closedDay = firstDayOf(ringOfCode(/^all-closed$/));
const tableNames = deliveryTable.shops.map((s) => s.name);

describe("driftOn: drifts start at their ring and stay", () => {
  it("is empty on the first ring", () => {
    expect(driftOn(1).active).toEqual([]);
  });

  it("accumulates ring by ring, never dropping one", () => {
    let previous: readonly string[] = [];
    for (const day of days) {
      const active = driftOn(day).active;
      expect(active.slice(0, previous.length), `day ${day}`).toEqual(previous);
      previous = active;
    }
    expect(driftOn(closedDay).active).toEqual(["typo", "sameCourierFace", "extraShop", "only", "allClosed"]);
  });

  it("reads the extra shop's name and the one remaining shop from the drift codes", () => {
    expect(driftOn(extraDay).extraShop).toBe(/^extra-shop-(.+)$/.exec(byRing[ringOf(extraDay)]!)![1]);
    expect(driftOn(onlyDay).onlyShop).toBe(/^only-(.+)$/.exec(byRing[ringOf(onlyDay)]!)![1]);
  });
});

describe("shopsOn", () => {
  it("lists every shop on day 1; a shop with hours is closed outside them", () => {
    const lunch = shopsOn(1, "lunch");
    expect(lunch.map((e) => e.shop.id)).toEqual(deliveryTable.shops.map((s) => s.id));
    const evening = deliveryTable.shops.find((s) => s.hours)!;
    expect(lunch.find((e) => e.shop.id === evening.id)!.open).toBe(false);
    expect(shopsOn(1, "dinner").find((e) => e.shop.id === evening.id)!.open).toBe(true);
  });

  it("adds the empty extra shop from its ring on, which cannot be ordered from", () => {
    const extra = shopsOn(extraDay, "lunch").find((e) => e.extra)!;
    expect(extra.shop.name).toBe(driftOn(extraDay).extraShop);
    expect(extra.open).toBe(false);
    expect(extra.items).toEqual([]);
    expect(shopsOn(extraDay - 1, "lunch").some((e) => e.extra)).toBe(false);
  });

  it("keeps one shop with only its default item from its ring on", () => {
    const list = shopsOn(onlyDay, "lunch");
    expect(list).toHaveLength(1);
    expect(list[0]!.shop.id).toBe(driftOn(onlyDay).onlyShop);
    expect(list[0]!.items.map((it) => it.id)).toEqual([deliveryTable.defaults.lunch.item]);
  });

  it("closes everything from the door ring on", () => {
    for (const day of days.filter((d) => d >= closedDay)) {
      for (const meal of MEALS) {
        expect(anythingOrderable(day, meal), `day ${day} ${meal}`).toBe(false);
      }
    }
    expect(canOrder(closedDay, "lunch", deliveryTable.defaults.lunch.shop, deliveryTable.defaults.lunch.item)).toBe(false);
  });

  it("something is orderable for every meal before the door ring", () => {
    for (const day of days.filter((d) => d < closedDay)) {
      for (const meal of MEALS) expect(anythingOrderable(day, meal), `day ${day} ${meal}`).toBe(true);
    }
  });
});

describe("shopListView", () => {
  it("shows the table as it is on the first ring", () => {
    const view = shopListView(1, "lunch");
    expect(view.shops.map((s) => s.name)).toEqual(tableNames);
    expect(view.courierFace).toBe("normal");
    expect(view.shops.some((s) => s.typo)).toBe(false);
  });

  it("from the screen ring, one shop shows its authored typo name, nothing invented", () => {
    const view = shopListView(typoDay, "lunch");
    const typos = view.shops.filter((s) => s.typo);
    expect(typos).toHaveLength(1);
    const shop = deliveryTable.shops.find((s) => s.id === typos[0]!.id)!;
    expect(shop.typo).toBeDefined();
    expect(typos[0]!.name).toBe(shop.typo);
    expect(shopListView(typoDay, "lunch")).toEqual(view);
  });

  it("from the desk ring, the courier face is the same", () => {
    expect(shopListView(faceDay, "lunch").courierFace).toBe("same");
    expect(shopListView(faceDay - 1, "lunch").courierFace).toBe("normal");
  });

  it("on a calm-daytime day the list looks undrifted, but ordering still follows the ring", () => {
    const calm = days.find((d) => isCalmDaytime(d) && driftOn(d).active.length > 0)!;
    const view = shopListView(calm, "lunch");
    expect(view.drift).toEqual([]);
    expect(view.shops.some((s) => s.extra || s.typo)).toBe(false);
    expect(view.courierFace).toBe("normal");
  });

  it("closed shops carry the closed strings key", () => {
    const view = shopListView(closedDay, "lunch");
    expect(view.shops.every((s) => !s.open && s.closedKey === "delivery.shop.closed")).toBe(true);
  });
});

describe("swapAdjacent", () => {
  it("swaps the first differing pair from the start position, wrapping", () => {
    expect(swapAdjacent("沙县小吃", 0)).toBe("县沙小吃");
    expect(swapAdjacent("沙县小吃", 2)).toBe("沙县吃小");
    expect(swapAdjacent("沙县小吃", 3)).toBe("县沙小吃");
    expect(swapAdjacent("aab", 0)).toBe("aba");
    expect(swapAdjacent("aa", 0)).toBe("aa");
    expect(swapAdjacent("a", 0)).toBe("a");
  });
});
