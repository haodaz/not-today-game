// The two persisted slots, kept strictly separate:
//   nt_run      the in-progress run (startDay, day counter, event log). Cleared on a bad-ending
//               restart.
//   nt_profile  the cross-run profile. Never cleared. Never readable by story or state logic:
//               this module can only WRITE it. The one reader is profile-read.ts, imported by
//               the title page alone (a test enforces this).
import { eventKinds, type GameEvent } from "./events";
import { createSlot, type KeyValueStorage, type SlotData, type SlotSpec } from "./slot";
import { computeState, type Store } from "./store";
import type { Json } from "./variables";

export const RUN_KEY = "nt_run";
export const PROFILE_KEY = "nt_profile";

/** Bump when the saved shape changes and add the step to the matching `migrations`. */
const RUN_VERSION = 2;

/** A run saved before run ids existed gets a fixed one, so its option orders stay stable. */
export const LEGACY_RUN_ID = "run-legacy";
const PROFILE_VERSION = 1;

export interface RunSave {
  /** Version 2 (recognise spec): seeds per-run orders such as the recognise options. */
  runId: string;
  startDay: number;
  /** The day counter. Must equal startDay plus the number of lieDown events. */
  day: number;
  events: GameEvent[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDay = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;

/**
 * A run save is good only if the counter agrees with the log, every event is stamped with the
 * day it happened on, and the log actually replays. Anything else is treated as corrupt.
 */
function isValidRun(data: SlotData): boolean {
  const { startDay, day, events, runId } = data;
  if (typeof runId !== "string" || runId === "") return false;
  if (!isDay(startDay) || !isDay(day) || !Array.isArray(events)) return false;

  let expected = startDay;
  for (const event of events) {
    if (!isRecord(event) || !eventKinds.includes(event.kind as GameEvent["kind"])) return false;
    if (event.day !== expected) return false;
    if (event.kind === "lieDown") expected += 1;
  }
  if (day !== expected) return false;

  try {
    computeState(startDay, events as GameEvent[]);
    return true;
  } catch {
    return false;
  }
}

export const RUN_SPEC: SlotSpec = {
  key: RUN_KEY,
  version: RUN_VERSION,
  migrations: {
    1: (data) => ({ ...data, runId: LEGACY_RUN_ID }),
  },
  isValid: isValidRun,
};

/** The profile's contents are defined by the title-page spec; here it is opaque JSON. */
export type ProfileData = Record<string, Json>;

export const PROFILE_SPEC: SlotSpec = {
  key: PROFILE_KEY,
  version: PROFILE_VERSION,
  migrations: {},
  isValid: (data) => isRecord(data.data),
};

export interface RunSlot {
  /** Saves the store's run id, start day, day counter and log. */
  save(store: Pick<Store, "getRunId" | "getStartDay" | "getState" | "getEvents">): void;
  /** The saved run, or null if none (or none that is good). Feed it to createStore. */
  load(): RunSave | null;
  /** Bad-ending restart: removes the run save and its backup. Never touches the profile. */
  clear(): void;
}

export function createRunSlot(storage: KeyValueStorage): RunSlot {
  const slot = createSlot(storage, RUN_SPEC);
  return {
    save: (store) =>
      slot.write({
        runId: store.getRunId(),
        startDay: store.getStartDay(),
        day: store.getState().day,
        events: [...store.getEvents()],
      }),
    load() {
      const data = slot.read();
      return data && ({ runId: data.runId, startDay: data.startDay, day: data.day, events: data.events } as RunSave);
    },
    clear: () => slot.clear(),
  };
}

export interface ProfileWriter {
  /** Replaces the profile. Never touches the run save. There is deliberately no read here. */
  write(data: ProfileData): void;
  /**
   * Adds 1 to a counter in the profile (san-and-endings: `runs` after a bad ending). It reads and
   * writes here and returns nothing, so the story still never sees the profile.
   */
  increment(key: string): void;
}

export function createProfileWriter(storage: KeyValueStorage): ProfileWriter {
  const slot = createSlot(storage, PROFILE_SPEC);
  return {
    write: (data) => slot.write({ data }),
    increment(key) {
      const current = (slot.read()?.data ?? {}) as ProfileData;
      const n = typeof current[key] === "number" ? (current[key] as number) : 0;
      slot.write({ data: { ...current, [key]: n + 1 } });
    },
  };
}
