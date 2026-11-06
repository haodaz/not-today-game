import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readProfile } from "@state/profile-read";
import { createProfileWriter, createRunSlot, PROFILE_KEY, RUN_KEY, type ProfileData } from "@state/saves";
import { memoryStorage, type KeyValueStorage } from "@state/slot";
import { createStore } from "@state/store";
import { membersOf } from "@state/variables";

const firstObject = membersOf("found")![0]!;

/** Every key in storage that belongs to a slot: the key itself, .bak and .tmp. */
const keysOf = (storage: ReturnType<typeof memoryStorage>, key: string) =>
  Object.fromEntries(Object.entries(storage.dump()).filter(([k]) => k === key || k.startsWith(`${key}.`)));

function playedStore() {
  const store = createStore();
  store.appendEvent({ kind: "openLayer", objectId: firstObject });
  store.appendEvent({ kind: "lieDown" });
  store.appendEvent({ kind: "pokeReset" });
  return store;
}

const profile: ProfileData = { runsStarted: 2, lastTitle: "x" };

describe("run slot", () => {
  it("loads nothing when nothing is saved", () => {
    expect(createRunSlot(memoryStorage()).load()).toBeNull();
  });

  it("round-trips startDay, the day counter and the log, and rebuilds the same state", () => {
    const storage = memoryStorage();
    const run = createRunSlot(storage);
    const store = playedStore();
    run.save(store);
    const loaded = run.load()!;
    expect(loaded.startDay).toBe(1);
    expect(loaded.day).toBe(store.getState().day);
    expect(loaded.events).toEqual(store.getEvents());
    expect(createStore(loaded).getState()).toEqual(store.getState());
  });

  it("saves the ?day=N debug start day too", () => {
    const run = createRunSlot(memoryStorage());
    const store = createStore({ startDay: 9 });
    store.appendEvent({ kind: "lieDown" });
    run.save(store);
    expect(run.load()).toMatchObject({ startDay: 9, day: 10 });
  });

  describe("rejects a save that is not self-consistent", () => {
    const good = () => {
      const storage = memoryStorage();
      const run = createRunSlot(storage);
      run.save(playedStore());
      return { storage, run, saved: JSON.parse(storage.getItem(RUN_KEY)!) };
    };
    const tamper = (change: (saved: Record<string, any>) => void) => {
      const { storage, run, saved } = good();
      change(saved);
      storage.setItem(RUN_KEY, JSON.stringify(saved));
      storage.removeItem(`${RUN_KEY}.bak`);
      return run.load();
    };

    it("day counter disagrees with startDay + lieDown count", () => {
      expect(tamper((s) => (s.day += 1))).toBeNull();
    });
    it("an event is stamped with the wrong day", () => {
      expect(tamper((s) => (s.events[0].day = 5))).toBeNull();
    });
    it("an event kind that does not exist", () => {
      expect(tamper((s) => (s.events[0].kind = "teleport"))).toBeNull();
    });
    it("a log that cannot be replayed (unknown object)", () => {
      expect(tamper((s) => (s.events[0].objectId = "not-an-object"))).toBeNull();
    });
    it("events is not a list", () => {
      expect(tamper((s) => (s.events = {}))).toBeNull();
    });
    it("accepts the untampered save", () => {
      expect(tamper(() => {})).not.toBeNull();
    });
  });

  it("falls back to the backup if the newest run save is corrupt", () => {
    const storage = memoryStorage();
    const run = createRunSlot(storage);
    const store = playedStore();
    run.save(store);
    const earlier = store.getEvents().length;
    store.appendEvent({ kind: "lieDown" });
    run.save(store);
    storage.setItem(RUN_KEY, "{ broken");
    expect(run.load()!.events).toHaveLength(earlier);
  });
});

describe("slot isolation", () => {
  it("a profile write never changes the run save", () => {
    const storage = memoryStorage();
    const run = createRunSlot(storage);
    run.save(playedStore());
    const before = keysOf(storage, RUN_KEY);
    createProfileWriter(storage).write(profile);
    createProfileWriter(storage).write({ ...profile, runsStarted: 3 });
    expect(keysOf(storage, RUN_KEY)).toEqual(before);
    expect(run.load()).not.toBeNull();
  });

  it("a run-save clear never touches the profile", () => {
    const storage = memoryStorage();
    createProfileWriter(storage).write(profile);
    createProfileWriter(storage).write({ ...profile, runsStarted: 3 });
    const run = createRunSlot(storage);
    run.save(playedStore());
    const before = keysOf(storage, PROFILE_KEY);
    run.clear();
    expect(keysOf(storage, PROFILE_KEY)).toEqual(before);
    expect(keysOf(storage, RUN_KEY)).toEqual({});
    expect(readProfile(storage)).toEqual({ ...profile, runsStarted: 3 });
  });

  it("clearing the run also removes its backup, so an old run cannot come back", () => {
    const storage = memoryStorage();
    const run = createRunSlot(storage);
    const store = playedStore();
    run.save(store);
    store.appendEvent({ kind: "lieDown" });
    run.save(store);
    run.clear();
    expect(run.load()).toBeNull();
  });

  it("the two slots use different keys", () => {
    expect(RUN_KEY).not.toBe(PROFILE_KEY);
    expect(PROFILE_KEY.startsWith(RUN_KEY)).toBe(false);
  });
});

describe("profile", () => {
  it("is empty until written, then round-trips through the one reader", () => {
    const storage = memoryStorage();
    expect(readProfile(storage)).toBeNull();
    createProfileWriter(storage).write(profile);
    expect(readProfile(storage)).toEqual(profile);
  });

  it("keeps the previous good profile if the newest is corrupt", () => {
    const storage = memoryStorage();
    const writer = createProfileWriter(storage);
    writer.write(profile);
    writer.write({ ...profile, runsStarted: 3 });
    storage.setItem(PROFILE_KEY, "{ broken");
    expect(readProfile(storage)).toEqual(profile);
  });

  it("the writer has no read method; increment returns nothing", () => {
    // san-and-endings: `increment` (runs + 1) reads and writes inside saves.ts, returns nothing.
    const writer = createProfileWriter(memoryStorage());
    // title-page T8 / object-drawer 1: recordEnding, recordObject and writeKurogotchi also only write.
    // photo-album R1: recordPhoto only writes too.
    // playtest-1105 R8: clear (清除全部记录 only) removes it; still no read.
    expect(Object.keys(writer)).toEqual(["write", "increment", "recordEnding", "recordObject", "recordPhoto", "writeKurogotchi", "clear"]);
    expect(writer.increment("runs")).toBeUndefined();
    expect(writer.recordEnding("bad")).toBeUndefined();
    expect(writer.recordObject("chick")).toBeUndefined();
    expect(writer.recordPhoto("10:window")).toBeUndefined();
    expect(writer.writeKurogotchi({})).toBeUndefined();
  });

  it("increment adds 1 to a counter and keeps the rest of the profile", () => {
    const storage = memoryStorage();
    const writer = createProfileWriter(storage);
    writer.write({ runsStarted: 2 });
    writer.increment("runs");
    writer.increment("runs");
    expect(readProfile(storage)).toEqual({ runsStarted: 2, runs: 2 });
  });
});

describe("only the title page may read the profile", () => {
  const srcDir = new URL("../src/", import.meta.url);
  const files = (readdirSync(srcDir, { recursive: true }) as string[])
    .map((p) => p.split("\\").join("/"))
    .filter((p) => p.endsWith(".ts"));

  it("finds the source files it is meant to guard", () => {
    expect(files).toContain("state/saves.ts");
    expect(files).toContain("state/profile-read.ts");
  });

  it("no module outside saves.ts and profile-read.ts touches the profile key or spec", () => {
    const offenders = files.filter((rel) => {
      if (rel === "state/saves.ts" || rel === "state/profile-read.ts") return false;
      return /PROFILE_KEY|PROFILE_SPEC|nt_profile/.test(readFileSync(new URL(rel, srcDir), "utf8"));
    });
    expect(offenders).toEqual([]);
  });

  // Matches a real import or re-export of profile-read, not a mention in a comment.
  const importsProfileRead = /(?:from|import\()\s*["'][^"']*profile-read["']/;

  it("the import pattern catches the ways of importing it", () => {
    for (const line of [
      'import { readProfile } from "./profile-read";',
      "export { readProfile } from '@state/profile-read';",
      'const m = await import("./profile-read");',
    ]) {
      expect(importsProfileRead.test(line), line).toBe(true);
    }
    expect(importsProfileRead.test("// only src/ui/ imports profile-read.ts")).toBe(false);
  });

  it("nothing outside src/ui/ imports profile-read", () => {
    const offenders = files.filter((rel) => {
      if (rel.startsWith("ui/")) return false;
      return importsProfileRead.test(readFileSync(new URL(rel, srcDir), "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});
