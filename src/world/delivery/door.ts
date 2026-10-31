// The door beat: phone says 已送达 → walk to the door → open to the chain → reach out →
// close and chain → the bag is on the desk corner. A pure state machine; each state is one of the
// six `door.steps` captions in content (index = step). The last move emits the `pickup` event,
// the only state change. The corridor is a strip of light; the player never steps out.
import { DOOR_STEPS, deliveryTable, type Meal } from "@state/delivery/table";
import type { EventDraft } from "@state/events";
import type { MealView } from "./meals";

export const DOOR_STATES = ["delivered", "atDoor", "chainOpen", "holding", "closing", "onDesk"] as const;
export type DoorState = (typeof DOOR_STATES)[number];

export type DoorInput = "walk" | "openChain" | "reach" | "close" | "place";

/** Each input moves exactly one step, from one state. */
const MOVES: Readonly<Record<DoorInput, readonly [DoorState, DoorState]>> = {
  walk: ["delivered", "atDoor"],
  openChain: ["atDoor", "chainOpen"],
  reach: ["chainOpen", "holding"],
  close: ["holding", "closing"],
  place: ["closing", "onDesk"],
};

if (DOOR_STATES.length !== DOOR_STEPS) {
  throw new Error(`door machine has ${DOOR_STATES.length} states but content has ${DOOR_STEPS} steps`);
}

export interface DoorBeat {
  readonly day: number;
  readonly meal: Meal;
  readonly state: DoorState;
}

/**
 * The door beat for a meal: from `delivered` once 已送达 shows, at `onDesk` if the bag was already
 * taken in. Null while nothing is at the door, and for a meal that never comes (the door does not
 * open; the view shows the anomaly where the bag would be).
 */
export function startDoor(view: MealView): DoorBeat | null {
  if (view.phase === "delivered") return { day: view.day, meal: view.meal, state: "delivered" };
  if (view.phase === "pickedUp") return { day: view.day, meal: view.meal, state: "onDesk" };
  return null;
}

/** The inputs that are possible from `state` (at most one). */
export function nextInputs(state: DoorState): DoorInput[] {
  return (Object.keys(MOVES) as DoorInput[]).filter((input) => MOVES[input][0] === state);
}

/** One move. Throws for an input that is not possible from the current state. */
export function stepDoor(beat: DoorBeat, input: DoorInput): { beat: DoorBeat; emit: EventDraft | null } {
  const move = MOVES[input];
  if (!move || move[0] !== beat.state) throw new Error(`door: "${input}" is not possible from "${beat.state}"`);
  const next: DoorBeat = { ...beat, state: move[1] };
  return { beat: next, emit: input === "place" ? { kind: "pickup", meal: beat.meal } : null };
}

/** The content caption for a door state. */
export function doorCaption(state: DoorState): string {
  return deliveryTable.doorSteps[DOOR_STATES.indexOf(state)]!;
}
