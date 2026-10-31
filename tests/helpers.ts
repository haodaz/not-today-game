import fc from "fast-check";
import type { EventDraft, GameEvent } from "@state/events";
import { f } from "@state/fday";
import { fold } from "@state/replay";
import type { State } from "@state/types.gen";
import { defaults, membersOf } from "@state/variables";

/** The raw table defaults as a typed State (day = 1). Task 8 adds the real f(startDay). */
export function baseState(): State {
  return defaults() as unknown as State;
}

/** Stamps drafts with the day counter the way the store does: day after each lieDown is +1. */
export function stampLog(startDay: number, drafts: readonly EventDraft[]): GameEvent[] {
  let day = startDay;
  return drafts.map((draft) => {
    const event = { ...draft, day } as GameEvent;
    if (draft.kind === "lieDown") day += 1;
    return event;
  });
}

/** Plays a log from `startDay` the way the store will: stamp, then fold onto f(startDay). */
export function play(startDay: number, drafts: readonly EventDraft[]): State {
  return fold(stampLog(startDay, drafts), f(startDay));
}

export const lieDowns = (count: number): EventDraft[] =>
  Array.from({ length: count }, (): EventDraft => ({ kind: "lieDown" }));

export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const objectIds = fc.constantFrom(...(membersOf("found") ?? []));
const recognisableIds = fc.constantFrom(...(membersOf("recognised") ?? []));

/** Any valid event draft. Object ids come from the table, never from this file. */
export const draftArb: fc.Arbitrary<EventDraft> = fc.oneof(
  objectIds.map((objectId): EventDraft => ({ kind: "openLayer", objectId })),
  recognisableIds.map((objectId): EventDraft => ({ kind: "recognise", objectId })),
  objectIds.map((objectId): EventDraft => ({ kind: "looked", objectId })),
  objectIds.map((objectId): EventDraft => ({ kind: "handObject", objectId })),
  fc.string().map((key): EventDraft => ({ kind: "pressKey", key })),
  fc.string().map((choice): EventDraft => ({ kind: "reply", choice })),
  fc.string().map((taskId): EventDraft => ({ kind: "letItDo", taskId })),
  fc.constantFrom<EventDraft>(
    { kind: "pokeReset" },
    { kind: "lieDown" },
    { kind: "sitUp" },
    { kind: "handLost" },
    { kind: "handNothing" },
  ),
);
