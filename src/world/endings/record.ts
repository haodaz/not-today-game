// Every ending reached goes into the profile once, when it happens (title-page T8). Only an ending
// event appended AFTER the watch began counts: events already in the log (a replayed save, a
// continued run) are history, never recorded again. A debug run (`?day=N`) touches no save, so it
// records nothing (`enabled: false`). One ending per run: a second ending event is ignored.
import type { Store } from "@state/store";
import type { Ending } from "@state/endings";

export type EndingKind = Exclude<Ending, "none">;

/** Calls `record` for the first ending event appended after now; returns the unsubscribe. */
export function watchEndings(store: Store, record: (kind: EndingKind) => void, enabled = true): () => void {
  if (!enabled) return () => {};
  let seen = store.getEvents().length;
  let done = false;
  return store.subscribe(() => {
    const events = store.getEvents();
    const fresh = events.slice(seen);
    seen = events.length;
    for (const e of fresh) {
      if (e.kind !== "ending" || done) continue;
      done = true;
      record(e.ending as EndingKind);
    }
  });
}

/**
 * Every object found in a saved run goes into the profile once (object-drawer 1): for each new
 * `openLayer` event appended after the watch began, `record(objectId)`. Like `watchEndings`, a
 * debug run (`?day=N`, `enabled: false`) records nothing, and events already in the log (a replayed
 * or continued run) are history, never recorded again. `recordObject` is idempotent, so a layer
 * opened in an earlier session and replayed on continue would be a no-op anyway.
 */
export function watchObjects(store: Store, record: (objectId: string) => void, enabled = true): () => void {
  if (!enabled) return () => {};
  let seen = store.getEvents().length;
  return store.subscribe(() => {
    const events = store.getEvents();
    const fresh = events.slice(seen);
    seen = events.length;
    for (const e of fresh) if (e.kind === "openLayer" && typeof e.objectId === "string") record(e.objectId);
  });
}
