// Replay is a left fold over the event list. An event may read the state produced by earlier
// events; none may read a clock. Because every step is pure, replaying a log twice gives
// deep-equal state.
import { applyEvent, type GameEvent } from "./events";
import { derive } from "./fday";
import type { State } from "./types.gen";

/**
 * One fold step: apply the event, then derive the day-driven fields. Deriving after every event
 * (not just at the end) keeps `stage` and the loan correct for any reducer that reads them
 * mid-fold, for example right after a `lieDown`.
 */
export function step(state: State, event: GameEvent): State {
  return derive(applyEvent(state, event));
}

/** state = events.reduce(step, base). `base` is f(startDay). */
export function fold(events: readonly GameEvent[], base: State): State {
  return events.reduce(step, base);
}
