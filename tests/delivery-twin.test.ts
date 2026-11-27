// The delivery texts in English (2026-11-27): content/en/delivery.json is the twin of
// content/delivery.json. Before it, every door line, receipt, shop and dish name showed in Chinese in
// the English build. Every delivery string the player reads has an English twin; under lang=en the
// door lines, the receipt, the phone's shop list and the diary's order read in English; a twin that
// lacks a string, or differs in shape, is refused by the loader and reported by `npm run validate`.
import { afterEach, describe, expect, it, vi } from "vitest";
import zhRaw from "@content/delivery.json";
import enRaw from "@content/en/delivery.json";
import { deliveryTable, localiseDelivery, MEALS, mealOf } from "@state/delivery/table";
import { deliveryTwinProblems, MEAL_TEXTS } from "@state/delivery/twin";
import { diaryPage } from "@state/diary";
import type { GameEvent } from "@state/events";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { doorCaption, DOOR_STATES, type DoorInput } from "@world/delivery/door";
import { composeReceipt, mealView } from "@world/delivery/meals";
import { shopListView } from "@world/delivery/shops-view";
import { doorLines, renderDoorView } from "@world/delivery/view";
import { setLocale } from "@world/i18n";
import { main } from "../scripts/validate-content";

afterEach(() => setLocale("zh"));

const HAN = /[㐀-鿿]/;
const days = Array.from({ length: constants.lastDay }, (_, i) => i + 1);
/** Test-only names, plain ASCII, so a Chinese character in a line can only come from content. */
const names: State["names"] = { login: "LOGIN", nick: "NICK", calledBy: "CALLEDBY", bossCalls: "BOSSCALLS", pronoun: null, portrait: "p1" };
const zhClone = () => structuredClone(zhRaw) as any;
const enClone = () => structuredClone(enRaw) as any;
const AFTER: readonly ("delivered" | DoorInput)[] = ["delivered", "walk", "openChain", "reach", "close", "place"];

/** Every delivery text the table holds, read in the current content locale, with where it is. */
function everyText(): [string, string | null | undefined][] {
  const out: [string, string | null | undefined][] = [];
  deliveryTable.doorSteps.forEach((s, i) => out.push([`door.steps[${i}]`, s]));
  for (const shop of deliveryTable.shops) {
    out.push([`shop ${shop.id} name`, shop.name], [`shop ${shop.id} tag`, shop.tag], [`shop ${shop.id} typo`, shop.typo]);
    for (const it of shop.items) out.push([`item ${shop.id}/${it.id} name`, it.name]);
  }
  for (const meal of MEALS) out.push([`defaults.${meal}.by`, deliveryTable.defaults[meal].by]);
  for (const day of days) for (const meal of MEALS) for (const k of MEAL_TEXTS) out.push([`day ${day} ${meal} ${k}`, mealOf(day, meal)![k]]);
  out.push(["address", deliveryTable.address]);
  return out;
}

describe("the English twin of the delivery table", () => {
  it("has every string the Chinese has: no problems", () => {
    expect(deliveryTwinProblems(zhRaw, enRaw)).toEqual([]);
  });

  it("under lang=en no delivery text has a Chinese character in it; under zh the source is untouched", () => {
    setLocale("zh");
    const zh = everyText();
    expect(mealOf(1, "lunch")!.outside).toBe((zhRaw as any).days[0].lunch.outside);
    setLocale("en");
    const en = everyText();
    expect(en).toHaveLength(zh.length);
    const stillChinese = en.filter(([, s]) => typeof s === "string" && HAN.test(s)).map(([w, s]) => `${w}: ${s}`);
    expect(stillChinese).toEqual([]);
    // A text is null or absent in English exactly where it is in Chinese.
    en.forEach(([w, s], i) => expect([w, s === null, s === undefined]).toEqual([w, zh[i]![1] === null, zh[i]![1] === undefined]));
    // And it is another text wherever the Chinese had Chinese in it.
    const same = en.filter(([, s], i) => typeof s === "string" && s === zh[i]![1] && HAN.test(s)).map(([w]) => w);
    expect(same).toEqual([]);
    setLocale("zh");
    expect(everyText()).toEqual(zh);
  });

  it("placeholders are kept exactly, text by text", () => {
    const marks = (s: string | null | undefined) => (s ?? "").match(/\{[^{}]*\}/g)?.sort() ?? [];
    setLocale("zh");
    const zh = everyText();
    setLocale("en");
    everyText().forEach(([w, s], i) => expect([w, marks(s)]).toEqual([w, marks(zh[i]![1])]));
    expect(mealOf(1, "dinner")!.receipt).toContain("{login}");
    expect(mealOf(7, "dinner")!.receipt).toContain("{bossCalls}");
    expect(mealOf(13, "lunch")!.receipt).toContain("{nick}");
  });
});

describe("the door beat under lang=en", () => {
  it("doorLines returns English for every meal of every day", () => {
    setLocale("en");
    let lines = 0;
    for (const day of days) {
      for (const meal of MEALS) {
        const view = mealView(day, meal, createStore({ startDay: day }).getState(), [], deliveryTable.windows[meal][1])!;
        for (const after of AFTER) {
          for (const l of doorLines(view, after, names)) {
            lines += 1;
            expect(`day ${day} ${meal} ${after}: ${l.t}`).not.toMatch(HAN);
            expect(l.t).toMatch(/[A-Za-z0-9—]/);
          }
        }
        // A meal that never comes prints its sounds where the bag would be.
        expect(`day ${day} ${meal}: ${renderDoorView(view, null, names)}`).not.toMatch(HAN);
      }
    }
    expect(lines).toBeGreaterThan(100);
  });

  it("day 1 lunch, line by line", () => {
    const view = () => mealView(1, "lunch", createStore({ startDay: 1 }).getState(), [], "12:30")!;
    setLocale("en");
    expect(doorLines(view(), "delivered", names)).toEqual([{ k: "narration", t: "The phone says: Delivered." }]);
    expect(doorLines(view(), "openChain", names)).toEqual([{ k: "narration", t: "The corridor light is white. One person's footsteps go down the stairs." }]);
    expect(doorLines(view(), "reach", names)).toEqual([{ k: "narration", t: "Hot. The top is tied in a hard knot." }]);
    expect(doorLines(view(), "place", names)).toEqual([{ k: "narration", t: "Braised chicken rice · mild" }]);
    setLocale("zh");
    expect(doorLines(view(), "openChain", names)).toEqual([{ k: "narration", t: (zhRaw as any).days[0].lunch.outside }]);
  });

  it("the placeholders are filled in the English lines, and the anomaly is the inner line", () => {
    setLocale("en");
    const d1 = mealView(1, "dinner", createStore({ startDay: 1 }).getState(), [], "19:00")!;
    expect(doorLines(d1, "place", names)).toEqual([{ k: "narration", t: "Wontons · To: LOGIN" }]);
    const d3 = mealView(3, "lunch", createStore({ startDay: 3 }).getState(), [], "12:30")!;
    expect(doorLines(d3, "openChain", names)[0]!.t).toBe("The corridor floor is still wet. A line of footprints comes to your door and turns back.");
    expect(doorLines(d3, "place", names)[1]).toEqual({ k: "inner", t: "The knot is tied your way." });
  });

  it("the six door captions are English, one per state", () => {
    setLocale("en");
    const captions = DOOR_STATES.map(doorCaption);
    expect(new Set(captions).size).toBe(DOOR_STATES.length);
    for (const c of captions) expect(c).not.toMatch(HAN);
  });

  it("a receipt opens with what the player ordered, in English too", () => {
    const order: GameEvent = { kind: "order", day: 1, meal: "dinner", shopId: "shaxian", itemId: "noodle", t: "18:05", i: 0 } as GameEvent;
    const view = () => mealView(1, "dinner", createStore({ startDay: 1 }).getState(), [order], "19:00")!;
    setLocale("en");
    expect(view().order!.itemName).toBe("Tossed noodles");
    expect(view().receipt).toBe("Tossed noodles · To: {login}");
    expect(composeReceipt("Wontons · Note: take your time", "Latte · hot")).toBe("Latte · hot · Note: take your time");
    setLocale("zh");
    expect(view().receipt).toBe("拌面 · 收件人：{login}");
  });
});

describe("the phone's shops and the diary under lang=en", () => {
  it("shop names, tags and dishes are English on every day, the typo name included", () => {
    setLocale("en");
    let typos = 0;
    for (const day of days) {
      for (const meal of MEALS) {
        for (const s of shopListView(day, meal).shops) {
          if (s.extra) continue; // the shop that is only a year: "1997"
          if (s.typo) typos += 1;
          expect(`day ${day} ${s.id}: ${s.name} / ${s.tag} / ${s.items.map((it) => it.name).join(", ")}`).not.toMatch(HAN);
        }
      }
    }
    expect(typos).toBeGreaterThan(0);
    expect(shopListView(1, "lunch").shops.map((s) => s.name)).toEqual(["Braised Chicken Rice (East Gate)", "Shaxian Snacks", "FamilyMart", "Luckin Coffee", "Spicy Hot Pot (late night)"]);
  });

  it("a typo name is the shop's name with one letter wrong", () => {
    setLocale("en");
    for (const shop of deliveryTable.shops) {
      const [name, typo] = [shop.name, shop.typo!];
      expect(typo).not.toBe(name);
      // One letter replaced, or one letter drawn as two ("m" as "rn").
      expect(Math.abs(typo.length - name.length)).toBeLessThanOrEqual(1);
      let head = 0;
      while (head < name.length && name[head] === typo[head]) head += 1;
      let tail = 0;
      while (tail < name.length - head && name[name.length - 1 - tail] === typo[typo.length - 1 - tail]) tail += 1;
      expect([shop.id, name.length - head - tail]).toEqual([shop.id, 1]);
    }
  });

  it("the diary's order line names the dish in English", () => {
    const order = { kind: "order", day: 1, meal: "lunch", shopId: "shaxian", itemId: "wonton", t: "11:40" } as unknown as GameEvent;
    setLocale("en");
    expect(diaryPage(1, [order]).lines).toContainEqual({ key: "diary.order.lunch", args: { item: "Wontons" } });
    setLocale("zh");
    expect(diaryPage(1, [order]).lines).toContainEqual({ key: "diary.order.lunch", args: { item: "扁肉" } });
  });
});

describe("guard: a twin that lacks a string or differs in shape", () => {
  it.each([
    ["a missing door line", (e: any) => delete e.days[2].lunch.outside, /day 3 lunch\.outside: missing \(zh: /],
    ["an empty text", (e: any) => (e.days[0].lunch.bag = " "), /day 1 lunch\.bag: empty/],
    ["a text left in Chinese", (e: any) => (e.days[0].lunch.bag = "热的。"), /day 1 lunch\.bag: still has Chinese/],
    ["a null where the Chinese has a text", (e: any) => (e.days[1].dinner.anomaly = null), /day 2 dinner\.anomaly: missing/],
    ["a text where the Chinese has none", (e: any) => (e.days[0].lunch.anomaly = "Nothing."), /day 1 lunch\.anomaly: has a text, the Chinese has none/],
    ["a dropped placeholder", (e: any) => (e.days[0].dinner.receipt = "Wontons · To: you"), /day 1 dinner\.receipt: placeholders \(none\), the Chinese has \{login\}/],
    ["a renamed placeholder", (e: any) => (e.days[12].lunch.receipt = e.days[12].lunch.receipt.replace("{nick}", "{name}")), /day 13 lunch\.receipt: placeholders \{name\}/],
    ["a missing day", (e: any) => e.days.pop(), /days: days \[.*17\], the Chinese has \[.*18\]/],
    ["a missing meal", (e: any) => delete e.days[4].dinner, /day 5 dinner: missing/],
    ["a missing shop", (e: any) => e.shops.pop(), /shops: ids \[/],
    ["a missing item name", (e: any) => delete e.shops[1].items[0].name, /shops\[1\] \(shaxian\)\.items\[0\] \(wonton\)\.name: missing/],
    ["a missing typo name", (e: any) => delete e.shops[0].typo, /shops\[0\] \(huangmenji\)\.typo: missing/],
    ["a typo name with no typo", (e: any) => (e.shops[0].typo = e.shops[0].name), /typo: is the same as the name/],
    ["five door captions", (e: any) => e.door.steps.pop(), /door\.steps: 5 steps, the Chinese has 6/],
    ["a missing address", (e: any) => delete e.address, /address: missing/],
    ["a missing default line", (e: any) => delete e.defaults.lunch.by, /defaults\.lunch\.by: missing/],
    ["a receipt that does not open with the dish", (e: any) => (e.days[1].lunch.receipt = "No coriander · braised chicken rice"), /day 2 lunch\.receipt: must open with the item's English name "Braised chicken rice · no coriander"/],
    ["a field that is not text", (e: any) => (e.days[0].lunch.arrives = "12:04"), /day 1 lunch: unknown key "arrives"/],
    ["an unknown top-level key", (e: any) => (e.windows = {}), /top level: unknown key "windows"/],
  ])("%s is a problem, and the loader refuses it", (_name, change, message) => {
    const en = enClone();
    change(en);
    const problems = deliveryTwinProblems(zhRaw, en);
    expect(problems.join("\n")).toMatch(message);
    for (const p of problems) expect(p).toMatch(/^content\/en\/delivery\.json /);
    expect(() => localiseDelivery(zhRaw, en)).toThrow(/content\/en\/delivery\.json/);
  });

  it("a new Chinese text with no English is reported (the twin must follow the source)", () => {
    const zh = zhClone();
    zh.days[15].dinner.bag = "凉的。";
    expect(deliveryTwinProblems(zh, enRaw).join("\n")).toMatch(/day 16 dinner\.bag: missing \(zh: "凉的。"\)/);
    const more = zhClone();
    more.shops[3].items.push({ id: "mocha", name: "摩卡", price: 16 });
    expect(deliveryTwinProblems(more, enRaw).join("\n")).toMatch(/shops\[3\] \(coffee\)\.items: ids \[latte, americano\], the Chinese has \[latte, americano, mocha\]/);
  });

  it("the Chinese file is still checked by its own guard first", () => {
    const zh = zhClone();
    zh.days[0].lunch.arrives = "noon";
    expect(() => localiseDelivery(zh, enRaw)).toThrow(/content\/delivery\.json day 1 lunch\.arrives/);
  });
});

describe("npm run validate", () => {
  it("--delivery: the twin as it is, clean; it is part of the plain run", () => {
    const log: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s: string) => void log.push(s));
    try {
      expect(main(["--delivery"])).toBe(0);
      expect(log).toEqual(["delivery: 2 files, 0 problems"]);
      expect(main([])).toBe(0);
      expect(log.filter((l) => l === "delivery: 2 files, 0 problems")).toHaveLength(2);
    } finally {
      vi.restoreAllMocks();
    }
  });
});
