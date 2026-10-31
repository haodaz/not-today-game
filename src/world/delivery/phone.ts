// The phone on the desk: the 外卖 app at beat time `now`. A pure view of the store.
import { MEALS, type Meal } from "@state/delivery/table";
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";
import { windowOpen } from "./commands";
import { mealView, ordersOn, type MealView, type OrderRecord } from "./meals";
import { shopListView, type ShopListView } from "./shops-view";

export interface PhoneModel {
  readonly day: number;
  /** The meal whose window is open now, if any. */
  readonly meal: Meal | null;
  /** The shop list for the open window (null outside the windows). */
  readonly shops: ShopListView | null;
  /** True if the player can order now: a window is open, nothing ordered yet, a shop is open. */
  readonly canOrder: boolean;
  readonly ordered: OrderRecord | null;
  readonly meals: Readonly<Record<Meal, MealView>>;
  /** Meals showing 已送达 and waiting at the door. */
  readonly atDoor: readonly Meal[];
}

/** The phone model for the current day, or null past the scripted days. */
export function phoneModel(state: State, events: readonly GameEvent[], now: string): PhoneModel | null {
  const day = state.day;
  const meals = {} as Record<Meal, MealView>;
  for (const meal of MEALS) {
    const view = mealView(day, meal, state, events, now);
    if (!view) return null;
    meals[meal] = view;
  }
  const meal = MEALS.find((m) => windowOpen(m, now)) ?? null;
  return {
    day,
    meal,
    shops: meal ? shopListView(day, meal) : null,
    canOrder: meal !== null && meals[meal].phase === "open",
    ordered: meal ? (ordersOn(events, day)[meal] ?? null) : null,
    meals,
    atDoor: MEALS.filter((m) => meals[m].phase === "delivered"),
  };
}
