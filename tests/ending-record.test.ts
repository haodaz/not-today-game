// A fresh load writes nothing to the profile; an ending is recorded only when it is appended after
// the watch began (never replayed from a save, never in a ?day=N debug run); the desk book never
// renders while no run has finished.
import { describe, expect, it } from "vitest";
import { createProfileWriter } from "@state/saves";
import { readProfile } from "@state/profile-read";
import { memoryStorage } from "@state/slot";
import { createStore, type Store } from "@state/store";
import { watchEndings, type EndingKind } from "@world/endings/record";
import { deskBook, EMPTY_COLLECTION } from "@world/room/collection";
import { renderRoom } from "@world/room/hud";
import { initialSession } from "@world/desktop/model";
import { mountTitle } from "../src/ui/title/mount";
import { readCollection } from "../src/ui/collection";

/** A minimal store: a log and listeners (the real one rejects an ending that is not due). */
function fakeStore(initial: unknown[] = []): Store & { push(e: unknown): void } {
  const events = [...initial];
  const listeners = new Set<() => void>();
  return {
    getEvents: () => events,
    subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
    push: (e: unknown) => (events.push(e), listeners.forEach((l) => l())),
  } as never;
}
const ending = (kind: EndingKind) => ({ kind: "ending", day: 18, ending: kind });

describe("a fresh load writes nothing", () => {
  it("reading the collection and mounting the title leave the profile empty", () => {
    const storage = memoryStorage();
    expect(readCollection(storage)).toEqual(EMPTY_COLLECTION);
    expect(storage.getItem("nt_profile")).toBeNull();
    expect(storage.getItem("nt_run")).toBeNull();
  });

  it("mounting the title page (no clicks, timers run) never touches storage", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    const root = win.document.createElement("div") as unknown as HTMLElement;
    win.document.body.appendChild(root as never);
    const storage = memoryStorage();
    const writes: string[] = [];
    const watched = { ...storage, setItem: (k: string, v: string) => (writes.push(k), storage.setItem(k, v)) };
    const title = mountTitle(root, { save: null, collection: readCollection(watched), onContinue() {}, onStart() {}, random: () => 0.5 });
    await new Promise((r) => setTimeout(r, 50));
    title.destroy();
    expect(writes).toEqual([]);
    expect(storage.getItem("nt_profile")).toBeNull();
  });
});

describe("recordEnding runs only for an ending appended after the watch began", () => {
  it("events already in the log (a replayed save) are history", () => {
    const store = fakeStore([ending("survive"), ending("survive")]);
    const got: string[] = [];
    watchEndings(store, (k) => got.push(k));
    store.push({ kind: "lieDown", day: 18 });
    expect(got).toEqual([]);
  });

  it("an ending appended after is recorded once, and a second one the same run is ignored", () => {
    const store = fakeStore();
    const got: string[] = [];
    watchEndings(store, (k) => got.push(k));
    store.push({ kind: "lieDown", day: 18 });
    expect(got).toEqual([]);
    store.push(ending("survive"));
    expect(got).toEqual(["survive"]);
    store.push(ending("survive"));
    expect(got).toEqual(["survive"]);
  });

  it("a debug run (?day=N, not saved) records nothing", () => {
    const store = fakeStore();
    const got: string[] = [];
    watchEndings(store, (k) => got.push(k), false);
    store.push(ending("survive"));
    expect(got).toEqual([]);
  });

  it("into the profile: nothing before, one ending and one run after", () => {
    const storage = memoryStorage();
    const profile = createProfileWriter(storage);
    const store = fakeStore();
    watchEndings(store, (k) => profile.recordEnding(k));
    expect(readProfile(storage)).toBeNull();
    store.push(ending("good"));
    expect(readProfile(storage)).toMatchObject({ endings: { bad: 0, survive: 0, good: 1 }, finishedRuns: 1 });
  });
});

describe("the desk book", () => {
  it("never renders while finishedRuns is 0; renders once a run has finished", () => {
    expect(deskBook(EMPTY_COLLECTION)).toBeNull();
    expect(deskBook({ finishedRuns: 1, endings: { bad: 0, survive: 1, good: 0 } })).not.toBeNull();
    const store = createStore({ startDay: 13 });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "room");
    const room = (c: typeof session.collection) => renderRoom({ state: store.getState(), events: store.getEvents(), session: { ...session, collection: c } }).value;
    expect(room(EMPTY_COLLECTION)).not.toContain("desk-book");
    expect(room(EMPTY_COLLECTION)).not.toContain('class="figure"');
    expect(room({ finishedRuns: 2, endings: { bad: 0, survive: 2, good: 0 } })).toContain("desk-book");
  });
});
