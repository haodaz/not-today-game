import { describe, expect, it } from "vitest";
import { createSlot, memoryStorage, type KeyValueStorage, type SlotSpec } from "@state/slot";

const spec = (over: Partial<SlotSpec> = {}): SlotSpec => ({
  key: "k",
  version: 1,
  migrations: {},
  isValid: (data) => typeof data.n === "number",
  ...over,
});

/** Storage whose writes to `failKey` throw (like a full disk) while `armed` is true. */
function flaky(failKey: string) {
  const base = memoryStorage();
  const state = { armed: false };
  const storage: KeyValueStorage = {
    getItem: (key) => base.getItem(key),
    removeItem: (key) => base.removeItem(key),
    setItem(key, value) {
      if (state.armed && key === failKey) throw new Error("quota exceeded");
      base.setItem(key, value);
    },
  };
  return { storage, base, state };
}

describe("write / read", () => {
  it("round-trips, stores a version, and returns data without it", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 7 });
    expect(JSON.parse(storage.getItem("k")!)).toEqual({ n: 7, version: 1 });
    expect(slot.read()).toEqual({ n: 7 });
  });

  it("returns null when nothing is saved", () => {
    expect(createSlot(memoryStorage(), spec()).read()).toBeNull();
  });

  it("leaves no temp key behind and keeps the previous save as the backup", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    expect(Object.keys(storage.dump()).sort()).toEqual(["k", "k.bak"]);
    expect(JSON.parse(storage.getItem("k.bak")!).n).toBe(1);
    expect(JSON.parse(storage.getItem("k")!).n).toBe(2);
  });

  it("refuses to write invalid data and changes nothing", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    const before = storage.dump();
    expect(() => slot.write({ n: "nope" })).toThrow(/invalid/);
    expect(storage.dump()).toEqual(before);
  });
});

describe("atomic write", () => {
  it("a failure while promoting leaves the last good save intact and no temp", () => {
    const { storage, base, state } = flaky("k");
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    state.armed = true;
    expect(() => slot.write({ n: 2 })).toThrow(/quota/);
    expect(slot.read()).toEqual({ n: 1 });
    expect(base.getItem("k.tmp")).toBeNull();
  });

  it("a temp write that cannot be confirmed aborts before touching the save", () => {
    const base = memoryStorage();
    const storage: KeyValueStorage = {
      ...base,
      getItem: (key) => base.getItem(key),
      setItem: (key, value) => {
        if (key !== "k.tmp") base.setItem(key, value); // temp writes are silently dropped
      },
    };
    const slot = createSlot(storage, spec());
    storage.setItem("k", JSON.stringify({ n: 1, version: 1 }));
    expect(() => slot.write({ n: 2 })).toThrow(/could not be confirmed/);
    expect(slot.read()).toEqual({ n: 1 });
    expect(base.getItem("k.bak")).toBeNull();
  });
});

describe("backup", () => {
  it("falls back to the backup when the main save is corrupt, and promotes it", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    storage.setItem("k", "{ half a write");
    expect(slot.read()).toEqual({ n: 1 });
    expect(JSON.parse(storage.getItem("k")!).n).toBe(1);
    expect(JSON.parse(storage.getItem("k.bak")!).n).toBe(1);
  });

  it("a corrupt main save never overwrites the good backup", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    storage.setItem("k", "garbage");
    slot.write({ n: 3 });
    expect(JSON.parse(storage.getItem("k.bak")!).n).toBe(1);
    expect(slot.read()).toEqual({ n: 3 });
  });

  it("returns null when both main and backup are bad", () => {
    const storage = memoryStorage();
    storage.setItem("k", "x");
    storage.setItem("k.bak", "y");
    expect(createSlot(storage, spec()).read()).toBeNull();
  });
});

describe("migrations", () => {
  it("run forward one step at a time and upgrade the stored save in place", () => {
    const storage = memoryStorage();
    createSlot(storage, spec()).write({ n: 1 });

    const order: number[] = [];
    const v3 = createSlot(
      storage,
      spec({
        version: 3,
        migrations: {
          1: (d) => (order.push(1), { ...d, n: (d.n as number) + 1 }),
          2: (d) => (order.push(2), { ...d, n: (d.n as number) * 10 }),
        },
      }),
    );
    expect(v3.read()).toEqual({ n: 20 });
    // Every pass goes 1 then 2, never skipping or reordering. (There is more than one pass: the
    // write-back re-checks the old main save before keeping it as the backup. Migrations are pure.)
    expect(order.length).toBeGreaterThanOrEqual(2);
    expect(order.join(",")).toMatch(/^1,2(,1,2)*$/);
    expect(JSON.parse(storage.getItem("k")!)).toEqual({ n: 20, version: 3 });
    expect(JSON.parse(storage.getItem("k.bak")!)).toEqual({ n: 1, version: 1 });
  });

  it("refuses to be built with a gap, so a step can never be skipped", () => {
    expect(() => createSlot(memoryStorage(), spec({ version: 3, migrations: { 2: (d) => d } }))).toThrow(
      /no migration from version 1 to 2/,
    );
  });

  it("does not read a save from a newer build, and leaves it untouched", () => {
    const storage = memoryStorage();
    const newer = JSON.stringify({ n: 1, version: 9 });
    storage.setItem("k", newer);
    expect(createSlot(storage, spec()).read()).toBeNull();
    expect(storage.getItem("k")).toBe(newer);
  });

  it("treats a failing or invalid migration result as an unusable save", () => {
    const old = (storage: KeyValueStorage) => createSlot(storage, spec()).write({ n: 1 });
    const throwing = memoryStorage();
    old(throwing);
    expect(
      createSlot(throwing, spec({ version: 2, migrations: { 1: () => { throw new Error("bad"); } } })).read(),
    ).toBeNull();
    const invalid = memoryStorage();
    old(invalid);
    expect(createSlot(invalid, spec({ version: 2, migrations: { 1: () => ({ n: "x" }) } })).read()).toBeNull();
  });

  it("rejects a save with a missing or non-integer version", () => {
    const storage = memoryStorage();
    for (const text of [JSON.stringify({ n: 1 }), JSON.stringify({ n: 1, version: 1.5 }), JSON.stringify({ n: 1, version: 0 })]) {
      storage.setItem("k", text);
      expect(createSlot(storage, spec()).read(), text).toBeNull();
    }
  });
});

describe("clear", () => {
  it("removes the save, the backup and any leftover temp", () => {
    const storage = memoryStorage();
    const slot = createSlot(storage, spec());
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    storage.setItem("k.tmp", "leftover");
    slot.clear();
    expect(storage.dump()).toEqual({});
    expect(slot.read()).toBeNull();
  });
});
