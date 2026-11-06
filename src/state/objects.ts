// Which of the old objects the player still holds. One place for the rule, read by the reply
// menu (lent words) and the desk. Nothing is lost to the hand any more (the old night-raid
// `item_lost` / `lost` set was removed 2026-11-06): an object found is an object held.
import type { State } from "./types.gen";

/** Found (and so held: nothing is handed to the hand). */
export function isHeld(object: string, state: State): boolean {
  return (state.found as string[]).includes(object);
}
