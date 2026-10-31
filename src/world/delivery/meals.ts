// One meal of one day, as the phone and the door see it. Orders and pickups are read from the
// event log (design E2); the beat time `now` is story time, HH:MM. Pure.
import { anythingOrderable, itemOf } from "@state/delivery/shops";
import { BOX_FLAG, deliveryTable, mealOf, RETURN_FLAG, type Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import { returnedObjects } from "@state/objects";
import type { State } from "@state/types.gen";

export interface OrderRecord {
  readonly meal: Meal;
  readonly shopId: string;
  readonly itemId: string;
  readonly t: string;
}

/** The first order of each meal on `day`. A later order for the same window is ignored. */
export function ordersOn(events: readonly GameEvent[], day: number): Partial<Record<Meal, OrderRecord>> {
  const out: Partial<Record<Meal, OrderRecord>> = {};
  for (const e of events) {
    if (e.kind === "order" && e.day === day && !out[e.meal]) {
      out[e.meal] = { meal: e.meal, shopId: e.shopId, itemId: e.itemId, t: e.t };
    }
  }
  return out;
}

export function pickedUp(events: readonly GameEvent[], day: number, meal: Meal): boolean {
  return events.some((e) => e.kind === "pickup" && e.day === day && e.meal === meal);
}

/**
 * E5. Null if nothing comes. If nothing could be ordered (every shop closed), at `arrives`.
 * If ordered, at `arrives` or the order time, whichever is later. Otherwise the default comes
 * at the end of the window.
 */
export function arrivalOf(day: number, meal: Meal, order: OrderRecord | undefined): string | null {
  const entry = mealOf(day, meal);
  if (!entry || entry.arrives === null) return null;
  if (!anythingOrderable(day, meal)) return entry.arrives;
  if (order) return order.t > entry.arrives ? order.t : entry.arrives;
  return deliveryTable.windows[meal][1];
}

/** Every item name in the table, longest first, for receipt matching. */
const itemNames: readonly string[] = deliveryTable.shops
  .flatMap((s) => s.items.map((it) => it.name))
  .sort((a, b) => b.length - a.length);

/**
 * E6. For display only: if the receipt starts with an item name, that prefix becomes the chosen
 * item's name; everything after it (备注, 收件人, typos) stays. A receipt that starts with no item
 * name is shown as written. Content is never changed.
 */
export function composeReceipt(receipt: string | null, chosenName: string | null): string | null {
  if (receipt === null || chosenName === null) return receipt;
  const prefix = itemNames.find((name) => receipt.startsWith(name));
  return prefix ? chosenName + receipt.slice(prefix.length) : receipt;
}

export type MealPhase = "none" | "before" | "open" | "waiting" | "delivered" | "pickedUp";

export interface MealView {
  readonly day: number;
  readonly meal: Meal;
  readonly window: readonly [string, string];
  readonly phase: MealPhase;
  readonly arrivesAt: string | null;
  /** What comes: the player's order, or the default (with who ordered it for you). */
  readonly order: { readonly shopId: string; readonly itemId: string; readonly itemName: string; readonly by: string | null } | null;
  /** Raw content texts; placeholders unfilled. */
  readonly outside: string;
  readonly bag: string | null;
  readonly receipt: string | null;
  readonly anomaly: string | null;
  readonly flags: readonly string[];
  readonly extras: { readonly box: boolean; readonly returned: readonly string[] };
}

/**
 * The meal at beat time `now`:
 *   none       nothing comes today (the anomaly stands where the bag would be)
 *   before     the window has not opened
 *   open       the player can order
 *   waiting    ordered (or nothing could be ordered), not here yet
 *   delivered  已送达: the door beat is available
 *   pickedUp   the bag is on the desk
 */
export function mealView(day: number, meal: Meal, state: State, events: readonly GameEvent[], now: string): MealView | null {
  const entry = mealOf(day, meal);
  if (!entry) return null;
  const window = deliveryTable.windows[meal];
  const placed = ordersOn(events, day)[meal];
  const arrivesAt = arrivalOf(day, meal, placed);
  const orderable = anythingOrderable(day, meal);

  const phase: MealPhase =
    arrivesAt === null ? "none"
    : pickedUp(events, day, meal) ? "pickedUp"
    : now < window[0] && orderable ? "before"
    : now >= arrivesAt ? "delivered"
    : placed || !orderable ? "waiting"
    : "open";

  let order: MealView["order"] = null;
  if (arrivesAt !== null) {
    if (placed) {
      order = { shopId: placed.shopId, itemId: placed.itemId, itemName: itemOf(placed.shopId, placed.itemId)!.name, by: null };
    } else {
      const d = deliveryTable.defaults[meal];
      order = { shopId: d.shop, itemId: d.item, itemName: itemOf(d.shop, d.item)!.name, by: d.by };
    }
  }

  const flags = entry.effects?.flags ?? [];
  const returnsObjects = flags.includes(RETURN_FLAG);
  return {
    day,
    meal,
    window,
    phase,
    arrivesAt,
    order,
    outside: entry.outside,
    bag: entry.bag,
    receipt: composeReceipt(entry.receipt, placed ? order!.itemName : null),
    anomaly: entry.anomaly,
    flags,
    extras: {
      box: flags.includes(BOX_FLAG),
      // What the bag holds: everything that comes back once it is taken in (design E3).
      returned: returnsObjects ? returnedObjects({ ...state, flags: [...new Set([...state.flags, RETURN_FLAG])] }) : [],
    },
  };
}
