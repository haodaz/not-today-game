// How deliveries change state. Only flags; orders and pickups themselves stay in the event log
// (the variable table has no field for them; see design E2). Pure, clock-free.
import { withFlags } from "../flags";
import type { State } from "../types.gen";
import { membersOf } from "../variables";
import { canOrder, itemOf } from "./shops";
import { deliveryTable, MEALS, mealOf, RETURN_FLAG, type Meal } from "./table";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isMeal(value: unknown): value is Meal {
  return (MEALS as readonly unknown[]).includes(value);
}

export interface OrderPlaced {
  readonly day: number;
  readonly meal: Meal;
  readonly shopId: string;
  readonly itemId: string;
  readonly t: string;
}

/** An order: rejected unless the item can be ordered that day for that meal; item effects apply. */
export function applyOrder(state: State, event: OrderPlaced): State {
  if (!isMeal(event.meal)) throw new Error(`order: unknown meal "${String(event.meal)}"`);
  if (!HHMM.test(event.t)) throw new Error(`order: time must be HH:MM, got "${event.t}"`);
  if (!canOrder(event.day, event.meal, event.shopId, event.itemId)) {
    throw new Error(`order: ${event.shopId}/${event.itemId} cannot be ordered on day ${event.day} ${event.meal}`);
  }
  return withFlags(state, itemOf(event.shopId, event.itemId)!.effects?.flags);
}

/** The bag is taken in at the door: the meal's effects apply. Rejected for a meal that never comes. */
export function applyPickup(state: State, event: { readonly day: number; readonly meal: Meal }): State {
  if (!isMeal(event.meal)) throw new Error(`pickup: unknown meal "${String(event.meal)}"`);
  const entry = mealOf(event.day, event.meal);
  if (!entry || entry.arrives === null) throw new Error(`pickup: nothing arrives on day ${event.day} ${event.meal}`);
  const next = withFlags(state, entry.effects?.flags);
  // The returned-objects bag: everything handed to the hand comes back.
  return entry.effects?.flags?.includes(RETURN_FLAG) && next.lost.length ? { ...next, lost: [] } : next;
}

/** Using a bought item on an object (the battery in the chick). Logged; changes nothing. */
export function applyUseItem(state: State, event: { readonly itemId: string; readonly objectId: string }): State {
  if (!deliveryTable.shops.some((s) => s.items.some((it) => it.id === event.itemId))) {
    throw new Error(`useItem: unknown item "${event.itemId}"`);
  }
  if (!(membersOf("found") ?? []).includes(event.objectId)) throw new Error(`useItem: unknown object "${event.objectId}"`);
  return state;
}

/**
 * A meal that never arrives has nobody to pick it up, so its flags are a function of the day
 * (design E4), like the incoming messages. Idempotent.
 */
export function applyUndeliveredMealFlags(state: State): State {
  const added: string[] = [];
  for (const [day, entry] of deliveryTable.days) {
    if (day > state.day) break;
    for (const meal of MEALS) {
      if (entry[meal].arrives === null && entry[meal].effects?.flags) added.push(...entry[meal].effects!.flags!);
    }
  }
  return withFlags(state, added);
}
