// Which shops the phone lists on a day, for a meal, and what can be ordered from them.
// shopDrift.byRing says at which ring each drift starts ("screen 起…, desk 起…"): drifts
// accumulate from their ring onward. A shop's `hours` close it outside them.
// Pure; used by the order reducer (state) and the phone view (world).
import stagesFile from "@content/stages.json";
import { ringOf } from "../stages";
import { deliveryTable, type Item, type Meal, type Shop } from "./table";

export type DriftKind = "typo" | "sameCourierFace" | "extraShop" | "only" | "allClosed";

export interface Drift {
  /** The drifts in force on the day, in the order their rings come. */
  readonly active: readonly DriftKind[];
  /** The extra shop's name (from `extra-shop-<name>`), if that drift is in force. */
  readonly extraShop: string | null;
  /** The one remaining shop's id (from `only-<shopId>`), if that drift is in force. */
  readonly onlyShop: string | null;
}

/** Rings in the order the cycles reach them. */
const ringOrder: readonly string[] = Object.entries(stagesFile.cycles)
  .filter(([id]) => !id.startsWith("_"))
  .map(([, cycle]) => cycle as { days: number[]; ring: string })
  .sort((a, b) => Math.min(...a.days) - Math.min(...b.days))
  .map((cycle) => cycle.ring);

const SIMPLE: Readonly<Record<string, DriftKind>> = {
  "typo-in-one-shop-name": "typo",
  "same-courier-face": "sameCourierFace",
  "all-closed": "allClosed",
};

/** The drifts in force on `day`: every ring up to and including the day's ring. */
export function driftOn(day: number): Drift {
  const reached = ringOrder.slice(0, ringOrder.indexOf(ringOf(day)) + 1);
  const active: DriftKind[] = [];
  let extraShop: string | null = null;
  let onlyShop: string | null = null;
  for (const ring of reached) {
    const code = deliveryTable.driftByRing[ring] ?? "normal";
    if (SIMPLE[code]) active.push(SIMPLE[code]!);
    const extra = /^extra-shop-(.+)$/.exec(code);
    if (extra) (active.push("extraShop"), (extraShop = extra[1]!));
    const only = /^only-(.+)$/.exec(code);
    if (only) (active.push("only"), (onlyShop = only[1]!));
  }
  return { active, extraShop, onlyShop };
}

export interface ShopEntry {
  readonly shop: Shop;
  /** Open for this meal's window (drift and hours). */
  readonly open: boolean;
  /** What can be ordered here today. Empty when closed. */
  readonly items: readonly Item[];
  /** A shop that is not in the table: it appears with the drift (the empty "1997"). */
  readonly extra: boolean;
}

function overlaps(a: readonly [string, string], b: readonly [string, string]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** The shops listed on `day` for `meal`, in table order (an extra shop last). */
export function shopsOn(day: number, meal: Meal): ShopEntry[] {
  const drift = driftOn(day);
  const allClosed = drift.active.includes("allClosed");
  const window = deliveryTable.windows[meal];
  const entry = (shop: Shop, items: readonly Item[], extra = false): ShopEntry => {
    const open = !allClosed && !extra && (!shop.hours || overlaps(shop.hours, window));
    return { shop, open, items: open ? items : [], extra };
  };

  if (drift.onlyShop !== null) {
    // One shop left, and of its menu only the item it is ordered for by default
    // (the note: "菜单只剩「不放香菜」"). The extra shop is gone with the rest.
    const shop = deliveryTable.shops.find((s) => s.id === drift.onlyShop)!;
    const defaultItems = Object.values(deliveryTable.defaults)
      .filter((d) => d.shop === shop.id)
      .map((d) => d.item);
    const items = defaultItems.length ? shop.items.filter((it) => defaultItems.includes(it.id)) : shop.items;
    return [entry(shop, items)];
  }

  const listed = deliveryTable.shops.map((shop) => entry(shop, shop.items));
  if (drift.extraShop !== null) {
    listed.push(entry({ id: drift.extraShop, name: drift.extraShop, tag: "", items: [] }, [], true));
  }
  return listed;
}

/** True if `itemId` from `shopId` can be ordered on `day` for `meal`. */
export function canOrder(day: number, meal: Meal, shopId: string, itemId: string): boolean {
  const entry = shopsOn(day, meal).find((e) => e.shop.id === shopId);
  return entry !== undefined && entry.open && entry.items.some((it) => it.id === itemId);
}

/** True if anything at all can be ordered on `day` for `meal`. */
export function anythingOrderable(day: number, meal: Meal): boolean {
  return shopsOn(day, meal).some((e) => e.open && e.items.length > 0);
}

/** The item `itemId` of `shopId` as listed in the table. */
export function itemOf(shopId: string, itemId: string): Item | undefined {
  return deliveryTable.shops.find((s) => s.id === shopId)?.items.find((it) => it.id === itemId);
}
