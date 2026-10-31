// The few things the player does with the phone and the door, bound to the store. Each checks
// what needs the log or the beat time (E8), then appends one event; the reducers check the rest.
import { deliveryTable, mealOf, type Meal } from "@state/delivery/table";
import type { State } from "@state/types.gen";
import type { Store } from "@state/store";
import { itemOf } from "@state/delivery/shops";
import { doorCaption, nextInputs, startDoor, stepDoor, type DoorBeat, type DoorInput } from "./door";
import { mealView, ordersOn } from "./meals";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function checkBeat(now: string): void {
  if (!HHMM.test(now)) throw new Error(`beat time must be HH:MM, got "${now}"`);
}

/** True while `now` is inside the meal's window (start inclusive, end exclusive). */
export function windowOpen(meal: Meal, now: string): boolean {
  const [start, end] = deliveryTable.windows[meal];
  return start <= now && now < end;
}

export interface OrderInput {
  readonly meal: Meal;
  readonly shopId: string;
  readonly itemId: string;
  /** The beat time, HH:MM. */
  readonly now: string;
}

/** One order per window, only while the window is open. Returns the new state. */
export function placeOrder(store: Store, { meal, shopId, itemId, now }: OrderInput): State {
  checkBeat(now);
  const day = store.getState().day;
  if (!windowOpen(meal, now)) throw new Error(`order: the ${meal} window is not open at ${now}`);
  if (mealOf(day, meal)?.arrives == null) throw new Error(`order: nothing comes on day ${day} ${meal}`);
  if (ordersOn(store.getEvents(), day)[meal]) throw new Error(`order: already ordered ${meal} on day ${day}`);
  return store.appendEvent({ kind: "order", meal, shopId, itemId, t: now });
}

export interface DoorSession {
  readonly beat: () => DoorBeat;
  readonly caption: () => string;
  readonly next: () => DoorInput[];
  /** Moves one step; the last step takes the bag in (appends `pickup`). */
  readonly advance: (input: DoorInput) => DoorBeat;
}

/** The door beat for `meal` at beat time `now`, or null if nothing is at the door. */
export function doorBeat(store: Store, meal: Meal, now: string): DoorSession | null {
  checkBeat(now);
  const state = store.getState();
  const start = startDoor(mealView(state.day, meal, state, store.getEvents(), now)!);
  if (!start) return null;
  let beat = start;
  return {
    beat: () => beat,
    caption: () => doorCaption(beat.state),
    next: () => nextInputs(beat.state),
    advance(input) {
      const { beat: moved, emit } = stepDoor(beat, input);
      // Append first: if the store rejects the event, the beat does not move.
      if (emit) store.appendEvent(emit);
      beat = moved;
      return beat;
    },
  };
}

/** Uses a bought item on an object (the battery in the chick). Logged; changes nothing (FR1). */
export function installItem(store: Store, { shopId, itemId, objectId }: { shopId: string; itemId: string; objectId: string }): State {
  const item = itemOf(shopId, itemId);
  if (!item) throw new Error(`install: unknown item ${shopId}/${itemId}`);
  const state = store.getState();
  const bought = item.effects?.flags ?? [];
  if (!bought.length || !bought.every((flag) => state.flags.includes(flag))) {
    throw new Error(`install: ${itemId} has not been bought`);
  }
  if (!(state.found as string[]).includes(objectId)) throw new Error(`install: ${objectId} is not on the desk`);
  return store.appendEvent({ kind: "useItem", itemId, objectId });
}
