// Which of the old objects the player still holds. One place for the rule, read by the reply
// menu (lent words) and by delivery (the day-17 return).
//
// Reading of the variable table (night-hand spec not written yet; see docs/kiro-log.md):
//   raids[night].blockedWith = the object the player held up to the hand that night, i.e. handed
//   over. That object is lost until the returned-objects delivery brings it back.
import { returnMeal, RETURN_FLAG } from "./delivery/table";
import type { State } from "./types.gen";

export interface Handed {
  readonly object: string;
  readonly night: number;
}

/** Every object held up to the hand, in night order (earliest first). */
export function handedObjects(state: State): Handed[] {
  return Object.entries(state.raids)
    .filter(([, raid]) => raid.blockedWith !== null)
    .map(([night, raid]) => ({ object: raid.blockedWith as string, night: Number(night) }))
    .sort((a, b) => a.night - b.night);
}

/**
 * Design E3: once the returned-objects delivery has been taken in (its flag is set), everything
 * handed over on an earlier night is back. Anything handed over from that night on is lost again.
 */
function cameBack(handed: Handed, state: State): boolean {
  return returnMeal !== null && state.flags.includes(RETURN_FLAG) && handed.night < returnMeal.day;
}

/** Objects currently lost to the hand, in the order they were handed over, no repeats. */
export function lostObjects(state: State): string[] {
  const lost: string[] = [];
  for (const handed of handedObjects(state)) {
    if (!cameBack(handed, state) && !lost.includes(handed.object)) lost.push(handed.object);
  }
  return lost;
}

/** Objects that came back with the returned-objects delivery, in the order they were handed over. */
export function returnedObjects(state: State): string[] {
  const back: string[] = [];
  for (const handed of handedObjects(state)) {
    if (cameBack(handed, state) && !back.includes(handed.object)) back.push(handed.object);
  }
  return back;
}

/** Found, and not lost to the hand. */
export function isHeld(object: string, state: State): boolean {
  return (state.found as string[]).includes(object) && !lostObjects(state).includes(object);
}
