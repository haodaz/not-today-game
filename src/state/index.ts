// Public API of world-state. Views and other specs import from here.
// Deliberately absent: the profile reader (profile-read.ts), which only src/ui/ may import.
export type { State, StateKey } from "./types.gen";

export { applyEvent, eventKinds } from "./events";
export type { EventDraft, EventKind, GameEvent } from "./events";

export { computeState, createStore } from "./store";
export type { Listener, Store, StoreOptions } from "./store";

export { cycleOf, dreamNights, isCalmDaytime, isTenderDay, nightBeatOf, ringOf, stageOf } from "./stages";

export { debugStartDay, fakeClock, realClock } from "./clock";
export type { Clock } from "./clock";

export { constants, validate } from "./variables";

export { createProfileWriter, createRunSlot } from "./saves";
export type { ProfileData, ProfileWriter, RunSave, RunSlot } from "./saves";
export { memoryStorage } from "./slot";
export type { KeyValueStorage } from "./slot";
