// box-arrival (2026-11-07): the blind-box case comes on day 1 with the lunch delivery. Until it has
// arrived the room has no carton: the box-less stills, no box hotspots, no box hint. Derived from the
// log only (a reload before the pickup still shows no box). Pure; no imports that close a cycle.
import type { GameEvent } from "@state/events";
import type { State } from "@state/types.gen";

/** The day the case arrives (its `box` beat is the arrival scene, played at the pickup). */
export const ARRIVAL_DAY = 1;

/** The case is in the room: a `pickup` on the arrival day, or any later day. */
export function boxArrived(state: Pick<State, "day">, events: readonly GameEvent[]): boolean {
  return state.day > ARRIVAL_DAY || events.some((e) => e.kind === "pickup" && e.day === ARRIVAL_DAY);
}

/** The stills that show the carton, and their box-less twins (public/room/shots/*_nobox.jpg). */
export const NOBOX_STILLS: Readonly<Record<"room" | "bed", string>> = {
  room: "/room/shots/room_nobox.jpg",
  bed: "/room/shots/bed_nobox.jpg",
};
