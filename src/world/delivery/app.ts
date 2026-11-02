// The delivery app on the phone (delivery addition 2026-11-02, "the app should feel like an app"):
// home (search, chips, shop cards), a shop page, the checkout, the order status and the rating.
// Only the surfaces are new: the order is still the one `order` event (the checkout's 下单 is
// `loop-order`), arrivals follow `mealView`, the drift rules apply to the cards. The pages, the
// cart and the ratings are session only. Pure: context in, markup out. No story text: names,
// prices and numbers come from content/delivery.json, labels from strings; a missing number
// renders as a dash.
import { deliveryTable, type Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { cls, html, type SafeHtml } from "@world/html";
import { tr } from "@world/i18n";
import { loopContext, mealToOrder } from "@world/loop/checklist";
import type { PhoneUi, Session } from "@world/desktop/model";
import { mealView, ordersOn, type MealView } from "./meals";
import { shopListView, type ItemView, type ShopView } from "./shops-view";

/** The five steps of the status strip, in order (strings `delivery.status.*`). */
export const STATUS_STEPS = ["accepted", "cooking", "pickup", "riding", "arrived"] as const;
export type StatusStep = (typeof STATUS_STEPS)[number];

/** The rating's three canned remarks (strings `delivery.rate.*`); 「和图片一模一样」 is `same`. */
export const REMARKS = ["same", "fast", "hot"] as const;
/** Day 17 (the author's detail): one remark, and the stars are already five. */
export const ONE_REMARK_DAY = 17;

/** The page the phone shows now: chosen pages, with the status and a due rating derived on top. */
export type PhonePage =
  | { readonly kind: "home"; readonly meal: Meal | null; readonly shown: Meal }
  | { readonly kind: "shop"; readonly meal: Meal; readonly shop: ShopView }
  | { readonly kind: "checkout"; readonly meal: Meal; readonly shop: ShopView; readonly item: ItemView }
  | { readonly kind: "status"; readonly view: MealView }
  | { readonly kind: "rate"; readonly view: MealView; readonly key: string; readonly thanks: boolean };

/** The window the phone shows when nothing can be ordered: the next one by the clock (lunch after dinner's). */
export function nextWindow(time: string): Meal {
  return (["lunch", "dinner"] as const).find((m) => time < deliveryTable.windows[m][1]) ?? "lunch";
}

export const rateKey = (day: number, meal: Meal): string => `d${day}:${meal}`;

/** A meal the player ordered that is on its way or at the door: the status page's. */
export function trackedMeal(state: State, events: readonly GameEvent[], now: string): MealView | null {
  const placed = ordersOn(events, state.day);
  for (const meal of ["lunch", "dinner"] as const) {
    const v = mealView(state.day, meal, state, events, now);
    if (v && placed[meal] && (v.phase === "waiting" || v.phase === "delivered")) return v;
  }
  return null;
}

/** The latest meal on the desk (picked up) that has not been rated this session: the rating's. */
export function rateableMeal(state: State, events: readonly GameEvent[], now: string, ui: Pick<PhoneUi, "rated">): MealView | null {
  for (const meal of ["dinner", "lunch"] as const) {
    const v = mealView(state.day, meal, state, events, now);
    if (v?.phase === "pickedUp" && !ui.rated.includes(rateKey(state.day, meal))) return v;
  }
  return null;
}

/** The meal of a rating just given (感谢您的评价), if it is still today's. */
function thanked(state: State, events: readonly GameEvent[], now: string, ui: PhoneUi): MealView | null {
  if (!ui.thanks) return null;
  const meal = (["lunch", "dinner"] as const).find((m) => rateKey(state.day, m) === ui.thanks);
  return meal ? mealView(state.day, meal, state, events, now) : null;
}

export function phonePage(state: State, events: readonly GameEvent[], session: Pick<Session, "clock" | "phoneUi">): PhonePage {
  const now = session.clock.time;
  const ui = session.phoneUi;
  const thanks = thanked(state, events, now, ui);
  if (thanks) return { kind: "rate", view: thanks, key: ui.thanks!, thanks: true };
  // Tapping the phone during a wait shows the status page.
  const tracked = trackedMeal(state, events, now);
  if (tracked) return { kind: "status", view: tracked };
  const rateable = rateableMeal(state, events, now, ui);
  if (ui.page === "rate" && rateable) return { kind: "rate", view: rateable, key: rateKey(state.day, rateable.meal), thanks: false };
  const lc = loopContext(state, events);
  const meal: Meal | null = lc ? mealToOrder(lc) : null;
  if (meal) {
    const shop = shopListView(state.day, meal).shops.find((s) => s.id === ui.shop && s.open);
    const item = shop?.items.find((it) => it.id === ui.item);
    if (ui.page === "checkout" && shop && item) return { kind: "checkout", meal, shop, item };
    if ((ui.page === "shop" || ui.page === "checkout") && shop) return { kind: "shop", meal, shop };
    return { kind: "home", meal, shown: meal };
  }
  // Nothing to order: the meal on the desk asks to be rated; else the home page, greyed.
  if (rateable) return { kind: "rate", view: rateable, key: rateKey(state.day, rateable.meal), thanks: false };
  return { kind: "home", meal: null, shown: nextWindow(now) };
}

// ——— the pages ———

const photo = (sprite: string | null, css: string): SafeHtml =>
  html`<span class="${cls("ph", css)}" aria-hidden="true">${sprite ? html`<img src="/${sprite}.png" alt="" draggable="false">` : null}</span>`;
const shopPhoto = (s: ShopView, css: string) => photo(s.items.find((it) => it.sprite)?.sprite ?? null, css);
const dash = (v: number | null, f: (n: number) => string = String): string => (v === null ? "—" : f(v));
const yuan = (n: number) => `¥${n}`;
/** The cut-out of what came. */
const spriteOf = (v: MealView): string | null =>
  deliveryTable.shops.find((s) => s.id === v.order?.shopId)?.items.find((it) => it.id === v.order?.itemId)?.sprite ?? null;

/** The card's numbers: ★ rating, ◷ minutes, the fee; a dash for each one content does not have yet. */
function meta(s: ShopView): SafeHtml {
  return html`<span class="d-meta"><span class="r">★ ${dash(s.rating, (n) => n.toFixed(1))}</span><span class="eta"><i class="ic clock" aria-hidden="true"></i>${dash(s.eta)}</span><span class="fee"><i class="ic ride" aria-hidden="true"></i>${dash(s.fee, yuan)}</span></span>`;
}

/** Decorative category chips: food cut-outs, no words. */
const CHIP_SPRITES = ["food/noodle", "food/onigiri", "food/latte", "food/oden", "food/steamed"];

function home(state: State, page: Extract<PhonePage, { kind: "home" }>, rateDue: boolean): SafeHtml {
  const [from, to] = deliveryTable.windows[page.shown];
  const list = shopListView(state.day, page.shown);
  const cards = list.shops.map((s) => {
    const orderable = page.meal !== null && s.open;
    const note = !page.meal ? html`<em>${from}–${to}</em>` : !s.open && s.closedKey ? html`<em>${tr(s.closedKey)}</em>` : null;
    const body = html`${shopPhoto(s, "card")}<b>${s.name}</b><small>${s.tag}</small>${meta(s)}${note}`;
    return orderable
      ? html`<button type="button" class="d-card" data-action="phone-shop" data-shop="${s.id}">${body}</button>`
      : html`<div class="${cls("d-card", "off", page.meal !== null && "closed")}">${body}</div>`;
  });
  const rate = rateDue ? html`<button type="button" class="d-rate-chip" data-action="phone-rate">${tr("delivery.rate")}</button>` : null;
  return html`<div class="dapp home"><div class="d-search"><i class="ic mag" aria-hidden="true"></i>${tr("delivery.search")}</div><div class="d-chips" aria-hidden="true">${CHIP_SPRITES.map((s) => photo(s, "chip"))}</div>${rate}<h2>${tr(`delivery.window.${page.shown}`)} · ${from}–${to}</h2><div class="d-cards">${cards}</div></div>`;
}

const back = html`<button type="button" class="d-back" data-action="phone-back" aria-label="${tr("hud.back")}">‹</button>`;

function shop(page: Extract<PhonePage, { kind: "shop" }>, ui: PhoneUi): SafeHtml {
  const s = page.shop;
  const rows = s.items.map((it) => {
    const n = ui.item === it.id ? 1 : 0;
    return html`<div class="d-row">${photo(it.sprite, "sm")}<span class="n">${it.name}</span><span class="p">${yuan(it.price)}</span><button type="button" class="${cls("d-add", n > 0 && "on")}" data-action="phone-add" data-item="${it.id}" aria-pressed="${n > 0 ? "true" : "false"}">${n > 0 ? n : "+"}</button></div>`;
  });
  const chosen = s.items.find((it) => it.id === ui.item);
  const bar = chosen ? html`<button type="button" class="d-bar" data-action="phone-checkout">${tr("delivery.checkout")} · ${yuan(chosen.price)}</button>` : null;
  return html`<div class="dapp shop-page">${back}${shopPhoto(s, "head")}<div class="d-title"><b>${s.name}</b><small>${s.tag}</small>${meta(s)}</div><div class="d-menu">${rows}</div>${bar}</div>`;
}

function checkout(page: Extract<PhonePage, { kind: "checkout" }>): SafeHtml {
  const { shop: s, item } = page;
  const total = item.price + (s.fee ?? 0);
  return html`<div class="dapp checkout">${back}<h2>${tr("delivery.checkout")}</h2><div class="d-line addr"><i class="ic pin" aria-hidden="true"></i>${deliveryTable.address ?? "—"}</div><div class="d-line item">${photo(item.sprite, "sm")}<span class="n">${s.name} · ${item.name}</span><span class="p">${yuan(item.price)}</span></div><div class="d-line fee"><i class="ic ride" aria-hidden="true"></i><span class="n"></span><span class="p">${dash(s.fee, yuan)}</span></div><div class="d-line card"><i class="ic card" aria-hidden="true"></i>${deliveryTable.card ?? "—"}</div><div class="d-total">${yuan(total)}</div><button type="button" class="d-order" data-action="loop-order" data-meal="${page.meal}" data-shop="${s.id}" data-item="${item.id}">${tr("delivery.order")}</button></div>`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** How far along the strip the order is at `now`: evenly between the order time and the arrival. */
export function statusStep(view: MealView, orderedAt: string, now: string): StatusStep {
  if (view.phase === "delivered" || view.phase === "pickedUp" || view.arrivesAt === null) return "arrived";
  const from = toMin(orderedAt);
  const to = toMin(view.arrivesAt);
  if (toMin(now) >= to) return "arrived";
  const share = to > from ? (toMin(now) - from) / (to - from) : 1;
  return STATUS_STEPS[Math.min(3, Math.max(0, Math.floor(share * 4)))]!;
}

function status(state: State, events: readonly GameEvent[], page: Extract<PhonePage, { kind: "status" }>, now: string): SafeHtml {
  const v = page.view;
  const placed = ordersOn(events, state.day)[v.meal]!;
  const at = STATUS_STEPS.indexOf(statusStep(v, placed.t, now));
  const shopName = deliveryTable.shops.find((s) => s.id === v.order?.shopId)?.name ?? "";
  const steps = STATUS_STEPS.map((step, i) => {
    const time = i === 0 ? placed.t : i === STATUS_STEPS.length - 1 ? v.arrivesAt : null;
    return html`<li class="${cls(i < at && "done", i === at && "on")}"><span>${tr(`delivery.status.${step}`)}</span>${time ? html`<time>${time}</time>` : null}</li>`;
  });
  // TODO(Claude): the rider's name (spec: "with the rider's name") needs a content field.
  return html`<div class="dapp status"><div class="d-rider"><span class="helmet" aria-hidden="true"></span></div><ol class="d-steps">${steps}</ol><div class="d-line item"><span class="n">${shopName} · ${v.order?.itemName ?? ""}</span></div></div>`;
}

function rate(state: State, page: Extract<PhonePage, { kind: "rate" }>, ui: PhoneUi): SafeHtml {
  if (page.thanks) return html`<div class="dapp rate thanks"><p>${tr("delivery.rate.thanks")}</p></div>`;
  const one = state.day === ONE_REMARK_DAY;
  const stars = one ? 5 : ui.stars;
  const starRow = [1, 2, 3, 4, 5].map(
    (n) => html`<button type="button" class="${cls("star", n <= stars && "on")}" data-action="phone-star" data-n="${n}" aria-label="${n}" aria-pressed="${n <= stars ? "true" : "false"}"${one ? html` disabled` : null}>★</button>`,
  );
  const remarks = (one ? (["same"] as const) : REMARKS).map((r) => html`<button type="button" class="remark" data-action="phone-remark" data-remark="${r}">${tr(`delivery.rate.${r}`)}</button>`);
  return html`<div class="dapp rate"><h2>${tr("delivery.rate")}</h2><div class="d-line item">${photo(spriteOf(page.view), "sm")}<span class="n">${page.view.order?.itemName ?? ""}</span></div><div class="stars">${starRow}</div><div class="remarks">${remarks}</div></div>`;
}

/** The app's markup for the page it is on. */
export function renderPhoneApp(state: State, events: readonly GameEvent[], session: Pick<Session, "clock" | "phoneUi">): SafeHtml {
  return renderPhonePage(state, events, session, phonePage(state, events, session));
}

/** One page's markup (exported so tests can show each page). */
export function renderPhonePage(state: State, events: readonly GameEvent[], session: Pick<Session, "clock" | "phoneUi">, page: PhonePage): SafeHtml {
  switch (page.kind) {
    case "home":
      return home(state, page, rateableMeal(state, events, session.clock.time, session.phoneUi) !== null);
    case "shop":
      return shop(page, session.phoneUi);
    case "checkout":
      return checkout(page);
    case "status":
      return status(state, events, page, session.clock.time);
    case "rate":
      return rate(state, page, session.phoneUi);
  }
}
