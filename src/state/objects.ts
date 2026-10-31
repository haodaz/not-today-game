// Which of the old objects the player still holds. One place for the rule, read by the reply
// menu (lent words), the desk bar and delivery (the day-17 return).
//
// `lost` (state) is what was handed to the hand at night through `item_lost` choices: "loan" or
// an object id, in the order given. The day-17 returned-objects bag brings the objects back; the
// loan row stays lost (delivery applyPickup, night-hand FR3). `raids` is read in nights.ts.
import type { State } from "./types.gen";

/** Objects currently lost to the hand, in the order they were handed over. */
export function lostObjects(state: State): string[] {
  return state.lost.filter((id) => id !== "loan");
}

/** What the returned-objects bag holds: every object lost so far, in the order it was handed over. */
export function returnedObjects(state: State): string[] {
  return lostObjects(state);
}

/** Found, and not lost to the hand. */
export function isHeld(object: string, state: State): boolean {
  return (state.found as string[]).includes(object) && !state.lost.includes(object);
}
