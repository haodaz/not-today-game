// delivery addition 2026-11-02: the app should feel like an app. Home (search, chips, shop cards),
// a shop page, the checkout, the order status and the rating. Only the surfaces change: the order
// is the same one `order` event, arrivals follow the same rule; the pages and the rating are
// session only (no event).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import raw from "@content/delivery.json";
import { deliveryTable, parseDelivery, type Meal } from "@state/delivery/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { ONE_REMARK_DAY, phonePage, REMARKS, renderPhonePage, statusStep, type PhonePage } from "@world/delivery/app";
import { mealView } from "@world/delivery/meals";
import { shopListView } from "@world/delivery/shops-view";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const copy = () => JSON.parse(JSON.stringify(raw)) as Record<string, unknown> & { shops: Record<string, unknown>[] };

describe("the loader: optional rating, eta, fee per shop; address and card at the top", () => {
  it("accepts them when present, and the table is unchanged without them", () => {
    const f = copy();
    Object.assign(f.shops[0]!, { rating: 4.8, eta: 30, fee: 3 });
    Object.assign(f, { address: "某某路 17 号 · 3 栋 602", card: "**** 2047" });
    const table = parseDelivery(f);
    expect(table.shops[0]).toMatchObject({ rating: 4.8, eta: 30, fee: 3 });
    expect(table).toMatchObject({ address: "某某路 17 号 · 3 栋 602", card: "**** 2047" });
    // Without them (content has them now: strip them) the shop parses with none.
    const bare = copy();
    for (const s of bare.shops) for (const k of ["rating", "eta", "fee"]) delete s[k];
    delete bare.address;
    delete bare.card;
    const plain = parseDelivery(bare);
    expect(plain.shops[0]!.rating).toBeUndefined();
    expect(plain.address).toBeUndefined();
  });

  it.each([
    ["rating above 5", { rating: 5.1 }],
    ["a negative rating", { rating: -1 }],
    ["eta not whole minutes", { eta: 2.5 }],
    ["eta zero", { eta: 0 }],
    ["a text fee", { fee: "3" }],
    ["a negative fee", { fee: -2 }],
    ["an unknown shop key", { stars: 4 }],
  ])("rejects %s", (_name, extra) => {
    const f = copy();
    Object.assign(f.shops[0]!, extra);
    expect(() => parseDelivery(f)).toThrow(/content\/delivery\.json/);
  });

  it("rejects a non-string address or card, and still rejects unknown top-level keys", () => {
    expect(() => parseDelivery({ ...copy(), address: 17 })).toThrow(/address/);
    expect(() => parseDelivery({ ...copy(), card: null })).toThrow(/card/);
    expect(() => parseDelivery({ ...copy(), rider: "x" })).toThrow(/unknown key "rider"/);
  });
});

function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  for (const d of drafts) store.appendEvent(d);
  return store;
}
function sessionAt(time: string): Session {
  const s = initialSession({ beat: "work", time });
  s.phoneOpen = true;
  return s;
}
const ctxOf = (store: Store, session: Session): ActionContext => ({ store, session, rerender: () => {}, later: () => {} });
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
/** Today's work done up to the lunch window (the checklist must allow ordering). */
const atLunch = (day: number, extra: EventDraft[] = []) => storeAt(day, [{ kind: "step", name: "boot", t: "09:03" }, { kind: "step", name: "openApp:msgs", t: "09:03" }, ...extra]);

describe("the pages", () => {
  it("home → shop → add → 去结算 → 下单 places the same one order event as before", () => {
    const store = atLunch(1);
    const session = sessionAt("11:40");
    const ctx = ctxOf(store, session);
    expect(phonePage(store.getState(), store.getEvents(), session).kind).toBe("home");
    const shop = shopListView(1, "lunch").shops.find((s) => s.open)!;
    act(ctx, "phone-shop", { shop: shop.id });
    expect(phonePage(store.getState(), store.getEvents(), session).kind).toBe("shop");
    act(ctx, "phone-checkout"); // nothing in the cart yet: stays on the shop page
    expect(phonePage(store.getState(), store.getEvents(), session).kind).toBe("shop");
    act(ctx, "phone-add", { item: shop.items[0]!.id });
    act(ctx, "phone-checkout");
    const page = phonePage(store.getState(), store.getEvents(), session);
    expect(page.kind).toBe("checkout");
    const before = store.getEvents().length;
    const markup = renderPhonePage(store.getState(), store.getEvents(), session, page).value;
    const m = /data-action="loop-order" data-meal="([^"]+)" data-shop="([^"]+)" data-item="([^"]+)"/.exec(markup)!;
    act(ctx, "loop-order", { meal: m[1]!, shop: m[2]!, item: m[3]! });
    expect(store.getEvents().slice(before)).toEqual([expect.objectContaining({ kind: "order", meal: "lunch", shopId: shop.id, itemId: shop.items[0]!.id, t: "11:40" })]);
    expect(store.getEvents()).toHaveLength(before + 1);
  });

  it("tapping the phone during a wait shows the status page, its step following the arrival rule", () => {
    const store = atLunch(1, [{ kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:40" }]);
    const view = mealView(1, "lunch", store.getState(), store.getEvents(), "11:41")!;
    expect(phonePage(store.getState(), store.getEvents(), sessionAt("11:41")).kind).toBe("status");
    expect(statusStep(view, "11:40", "11:41")).toBe("accepted");
    expect(statusStep(view, "11:40", view.arrivesAt!)).toBe("arrived");
    const steps = ["11:41", "11:50", "11:55", "12:00", "12:03"].map((now) => statusStep(mealView(1, "lunch", store.getState(), store.getEvents(), now)!, "11:40", now));
    // Monotonic along the strip.
    const order = ["accepted", "cooking", "pickup", "riding", "arrived"];
    expect(steps.map((s) => order.indexOf(s))).toEqual([...steps.map((s) => order.indexOf(s))].sort((a, b) => a - b));
  });

  it("after the bag is on the desk: 评价一下, five stars, three remarks; a remark thanks and logs nothing", () => {
    const store = atLunch(1, [{ kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:40" }, { kind: "pickup", meal: "lunch" }]);
    const session = sessionAt("13:00");
    const ctx = ctxOf(store, session);
    const page = phonePage(store.getState(), store.getEvents(), session);
    expect(page.kind).toBe("rate");
    const out = renderPhonePage(store.getState(), store.getEvents(), session, page).value;
    expect(out.match(/data-action="phone-star"/g)).toHaveLength(5);
    expect(out.match(/data-action="phone-remark"/g)).toHaveLength(REMARKS.length);
    expect(out).toContain(t("delivery.rate.same"));
    act(ctx, "phone-star", { n: "4" });
    expect(session.phoneUi.stars).toBe(4);
    const before = store.getEvents().length;
    act(ctx, "phone-remark", { remark: "same" });
    expect(store.getEvents()).toHaveLength(before);
    const thanks = phonePage(store.getState(), store.getEvents(), session);
    expect(thanks).toMatchObject({ kind: "rate", thanks: true });
    expect(renderPhonePage(store.getState(), store.getEvents(), session, thanks).value).toContain(t("delivery.rate.thanks"));
    // Rated: once the phone is put down and picked up, it does not ask again.
    act(ctx, "loop-phone");
    act(ctx, "loop-phone");
    expect(phonePage(store.getState(), store.getEvents(), session).kind).not.toBe("rate");
  });

  it(`day ${ONE_REMARK_DAY}: one remark, and the stars are already five`, () => {
    const store = storeAt(ONE_REMARK_DAY, [{ kind: "pickup", meal: "lunch" }]);
    const session = sessionAt("13:00");
    session.phoneUi.page = "rate";
    const page = phonePage(store.getState(), store.getEvents(), session);
    expect(page.kind).toBe("rate");
    const out = renderPhonePage(store.getState(), store.getEvents(), session, page).value;
    expect(out.match(/data-action="phone-remark"/g)).toHaveLength(1);
    expect(out).toContain(t("delivery.rate.same"));
    expect(out.match(/class="star on"/g)).toHaveLength(5);
  });

  it("the cards and the checkout show content's numbers as written; a missing one is a dash, never made up", () => {
    const store = atLunch(1);
    const session = sessionAt("11:40");
    const home = renderPhonePage(store.getState(), store.getEvents(), session, phonePage(store.getState(), store.getEvents(), session)).value;
    for (const s of shopListView(1, "lunch").shops) {
      expect(home, s.id).toContain(s.rating === null ? "★ —" : `★ ${s.rating.toFixed(1)}`);
      if (s.fee !== null) expect(home, s.id).toContain(`¥${s.fee}`);
    }
    const shop = shopListView(1, "lunch").shops.find((s) => s.open)!;
    session.phoneUi = { ...session.phoneUi, page: "checkout", shop: shop.id, item: shop.items[0]!.id };
    const out = renderPhonePage(store.getState(), store.getEvents(), session, phonePage(store.getState(), store.getEvents(), session)).value;
    expect(out).toContain(`<i class="ic pin" aria-hidden="true"></i>${deliveryTable.address ?? "—"}`);
    expect(out).toContain(`<i class="ic card" aria-hidden="true"></i>${deliveryTable.card ?? "—"}`);
  });
});

describe("property: the rating page never appears before the meal is on the desk", () => {
  it("over days, times, orders and pickups, and with 评价一下 asked for", () => {
    const times = ["09:00", "11:30", "11:45", "12:05", "12:30", "13:00", "18:00", "18:20", "18:45", "19:00", "22:00"];
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 18 }),
        fc.constantFrom(...times),
        fc.boolean(),
        fc.constantFrom<Meal | null>(null, "lunch", "dinner"),
        fc.boolean(),
        (day, now, ordered, picked, ask) => {
          const drafts: EventDraft[] = [{ kind: "step", name: "boot", t: "09:03" }];
          const store = storeAt(day, drafts);
          if (ordered && deliveryTable.days.get(day)?.lunch.arrives) {
            try {
              store.appendEvent({ kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:40" });
            } catch {
              // Not orderable that day: fine.
            }
          }
          if (picked) {
            try {
              store.appendEvent({ kind: "pickup", meal: picked });
            } catch {
              // Nothing at the door: fine.
            }
          }
          const session = sessionAt(now);
          if (ask) session.phoneUi.page = "rate";
          const page = phonePage(store.getState(), store.getEvents(), session);
          if (page.kind === "rate") {
            const v = mealView(day, page.view.meal, store.getState(), store.getEvents(), now)!;
            expect(v.phase, `d${day} ${now}`).toBe("pickedUp");
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("snapshots", () => {
  /** Every page, forced where the day cannot reach it (day 16 has nothing to order or rate). */
  function pages(day: number): Record<string, string | null> {
    const lunch = atLunch(day);
    const s = sessionAt("11:40");
    const st = lunch.getState();
    const ev = lunch.getEvents();
    const list = shopListView(day, "lunch");
    const shop = list.shops.find((x) => x.open && x.items.length) ?? null;
    const render = (p: PhonePage, session: Session = s) => renderPhonePage(st, ev, session, p).value;
    // Day 16 (全部打烊): no shop has anything to show, so there is no shop page, checkout, status or rating.
    const out: Record<string, string | null> = {
      home: render(phonePage(st, ev, s)),
      shop: shop ? render({ kind: "shop", meal: "lunch", shop }, { ...s, phoneUi: { ...s.phoneUi, item: shop.items[0]!.id } }) : null,
      checkout: shop ? render({ kind: "checkout", meal: "lunch", shop, item: shop.items[0]! }) : null,
      status: null,
      rating: null,
    };
    if (shop && deliveryTable.days.get(day)?.lunch.arrives) {
      const ordered = atLunch(day, [{ kind: "order", meal: "lunch", shopId: shop.id, itemId: shop.items[0]!.id, t: "11:40" }]);
      const sw = sessionAt("11:50");
      out.status = renderPhonePage(ordered.getState(), ordered.getEvents(), sw, phonePage(ordered.getState(), ordered.getEvents(), sw)).value;
      ordered.appendEvent({ kind: "pickup", meal: "lunch" });
      const sr = sessionAt("13:00");
      out.rating = renderPhonePage(ordered.getState(), ordered.getEvents(), sr, phonePage(ordered.getState(), ordered.getEvents(), sr)).value;
    }
    return out;
  }
  for (const day of [1, 16]) {
    it(`day ${day}: home, shop, checkout, status, rating`, () => {
      expect(pages(day)).toMatchSnapshot();
    });
  }
});
