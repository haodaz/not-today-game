// The single store. state = f(startDay) folded over an append-only event log.
// Views read it and subscribe to it; they never write it. They emit events instead.
// No clock, no network, no rendering.
import type { EventDraft, GameEvent } from "./events";
import { f } from "./fday";
import { fold, step } from "./replay";
import type { State } from "./types.gen";

export type Listener = (state: State) => void;

export interface Store {
  /** The current state. Deeply frozen: assigning to it throws. */
  getState(): State;
  /** The append-only log so far (a frozen copy). */
  getEvents(): readonly GameEvent[];
  /** The day the run started on: 1, or N for the `?day=N` debug jump. */
  getStartDay(): number;
  /** The run's id: fixed for the run, saved with it; seeds per-run orders (recognise FR1). */
  getRunId(): string;
  /** Stamps the draft with the current day, applies it, notifies subscribers. Returns new state. */
  appendEvent(draft: EventDraft): State;
  /** Calls `listener` after every appended event. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void;
}

export interface StoreOptions {
  /** 1 for a normal run; N for the `?day=N` debug jump. */
  startDay?: number;
  /** A previously saved log to replay. */
  events?: readonly GameEvent[];
  /** The run's id (from the save, or new). Default: "run-<startDay>", stable for tests and debug jumps. */
  runId?: string;
  /**
   * Dev only (`?day=N&seed=…`, 2026-11-09): fields laid over the fresh state before the log is
   * folded — to stand on day 17 or 18 with the meters, flags and recognised objects a real run would
   * have, and see which ending the night takes. Never saved; a saved run never carries one.
   */
  patch?: Partial<State>;
}

/** Pure: the whole game state for a start day and a log. Replaying the same log twice is equal. */
export function computeState(startDay: number, events: readonly GameEvent[], patch?: Partial<State>): State {
  return fold(events, patch ? { ...f(startDay), ...patch } : f(startDay));
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createStore(options: StoreOptions = {}): Store {
  const startDay = options.startDay ?? 1;
  const runId = options.runId ?? `run-${startDay}`;
  const events: GameEvent[] = [...(options.events ?? [])];
  let state = deepFreeze(computeState(startDay, events, options.patch));
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    getEvents: () => Object.freeze(events.map((event) => Object.freeze({ ...event }))),
    getStartDay: () => startDay,
    getRunId: () => runId,

    appendEvent(draft) {
      const event = { ...draft, day: state.day } as GameEvent;
      // Apply first: if the reducer rejects the event, nothing is committed or notified.
      const next = deepFreeze(step(state, event));
      events.push(event);
      state = next;

      // Subscribers are isolated from each other. The state is already committed, so a failing
      // view cannot corrupt it; the first error is rethrown once everyone has been told.
      let firstError: unknown;
      for (const listener of [...listeners]) {
        try {
          listener(state);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) throw firstError;
      return state;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
