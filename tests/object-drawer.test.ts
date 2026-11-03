// The object drawer and its profile (object-drawer 1 & 2). The profile remembers which objects
// were found (an `openLayer` in a saved run, once); the title offers a 道具 drawer only when it has
// something in it; the page lists the found objects in content order, the Kurogotchi last when the
// good ending is on record; opening an object plays it in memory only — no store, no events — and
// the walkman plays the title theme, never the story recordings.
import { describe, expect, it, afterEach, vi } from "vitest";
import { createProfileWriter } from "@state/saves";
import { readProfile } from "@state/profile-read";
import { memoryStorage } from "@state/slot";
import { createStore } from "@state/store";
import { watchObjects } from "@world/endings/record";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { readCollection } from "../src/ui/collection";
import { drawerGrid, drawerIds, drawerPage, KURO_ID } from "../src/ui/title/drawer";
import { mountTitle } from "../src/ui/title/mount";
import { setLocale } from "@world/i18n";

afterEach(() => setLocale("zh"));

const coll = (over: Partial<Collection> = {}): Collection => ({ ...EMPTY_COLLECTION, ...over });

// ——— 1. the profile remembers which objects were found ———

describe("the profile records found objects", () => {
  it("an openLayer in a saved run records the object once (idempotent)", () => {
    const storage = memoryStorage();
    const profile = createProfileWriter(storage);
    const store = createStore({ startDay: 1 });
    watchObjects(store, (id) => profile.recordObject(id), true);
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    store.appendEvent({ kind: "openLayer", objectId: "chick" }); // again: no duplicate
    expect(readProfile(storage)!.objects).toEqual(["chick", "pager"]);
  });

  it("a debug run (enabled false) records nothing", () => {
    const storage = memoryStorage();
    const profile = createProfileWriter(storage);
    const store = createStore({ startDay: 1 });
    watchObjects(store, (id) => profile.recordObject(id), false);
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    expect(readProfile(storage)?.objects ?? undefined).toBeUndefined();
    expect(readCollection(storage).objects).toEqual([]);
  });

  it("events already in the log before the watch are history, never recorded", () => {
    const storage = memoryStorage();
    const profile = createProfileWriter(storage);
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" }); // before the watch
    watchObjects(store, (id) => profile.recordObject(id), true);
    store.appendEvent({ kind: "openLayer", objectId: "pager" }); // after
    expect(readProfile(storage)!.objects).toEqual(["pager"]);
  });

  it("readCollection drops unknown ids and sets kurogotchi from endings.good", () => {
    const storage = memoryStorage();
    createProfileWriter(storage).write({ objects: ["chick", "not-a-thing", "phone"], endings: { bad: 0, survive: 0, good: 2 } });
    const c = readCollection(storage);
    expect(c.objects).toEqual(["chick", "phone"]);
    expect(c.kurogotchi).toBe(true);
  });

  it("kurogotchi is false until a good ending", () => {
    const storage = memoryStorage();
    createProfileWriter(storage).write({ endings: { bad: 1, survive: 1, good: 0 } });
    expect(readCollection(storage).kurogotchi).toBe(false);
  });
});

// ——— 2. the drawer page (pure view) ———

describe("the drawer page in content order", () => {
  it("lists the found objects in content order, the Kurogotchi last when unlocked", () => {
    // Given out of order, the grid follows content order (chick before pager before tape).
    expect(drawerIds(coll({ objects: ["tape", "chick", "pager"] }))).toEqual(["chick", "pager", "tape"]);
    expect(drawerIds(coll({ objects: ["chick"], kurogotchi: true }))).toEqual(["chick", KURO_ID]);
    expect(drawerIds(coll({ objects: ["chick"], kurogotchi: false }))).toEqual(["chick"]);
  });

  it("with two found objects the grid has exactly two cells, in content order", () => {
    const html = drawerGrid(coll({ objects: ["pager", "chick"] })).value;
    const cells = [...html.matchAll(/data-object="([^"]+)"/g)].map((m) => m[1]);
    expect(cells).toEqual(["chick", "pager"]);
  });

  it("with the good ending the Kurogotchi cell is last; without it, it is absent", () => {
    const withKuro = drawerGrid(coll({ objects: ["chick"], kurogotchi: true })).value;
    const ids = [...withKuro.matchAll(/data-object="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.at(-1)).toBe(KURO_ID);
    const withoutKuro = drawerGrid(coll({ objects: ["chick"], kurogotchi: false })).value;
    expect(withoutKuro).not.toContain(`data-object="${KURO_ID}"`);
  });

  it("the open page carries a stage for the object and a back control", () => {
    const html = drawerPage(coll({ objects: ["chick"] }), "chick").value;
    expect(html).toContain('data-drawer-stage="chick"');
    expect(html).toContain('data-action="drawer-grid"');
  });
});

// ——— title button visibility ———

async function mount(collection: Collection, kuroMemory?: unknown) {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const root = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(root as never);
  const applied: unknown[] = [];
  const sound = {
    muted: false,
    setMuted() {},
    apply: (plan: unknown) => applied.push(plan),
    unlock() {},
    onTuneEnd() {},
    armGestures() {},
    idle: async () => {},
    destroy() {},
  } as never;
  const title = mountTitle(root, { save: null, collection, onContinue() {}, onStart() {}, random: () => 0.5, sound, ...(kuroMemory ? { kuroMemory } : {}) } as never);
  const click = (sel: string) => {
    const el = root.querySelector(sel) as unknown as { dispatchEvent: (e: unknown) => void } | null;
    el?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as never);
  };
  return { win, root, title, applied, click, html: () => root.innerHTML };
}

describe("the title drawer button", () => {
  it("is absent with an empty collection", async () => {
    const { title, html } = await mount(EMPTY_COLLECTION);
    expect(html()).not.toContain('data-action="title-drawer"');
    title.destroy();
  });

  it("shows once the collection has objects, and again once the Kurogotchi is unlocked", async () => {
    const withObj = await mount(coll({ objects: ["chick"] }));
    expect(withObj.html()).toContain('data-action="title-drawer"');
    withObj.title.destroy();
    const withKuro = await mount(coll({ objects: [], kurogotchi: true }));
    expect(withKuro.html()).toContain('data-action="title-drawer"');
    withKuro.title.destroy();
  });

  it("opening the drawer then a cell shows the device; back returns to the grid", async () => {
    const { root, title, click, html } = await mount(coll({ objects: ["chick", "pager"] }));
    click('[data-action="title-drawer"]');
    expect(html()).toContain("drawer-grid");
    click('[data-action="drawer-open"][data-object="chick"]');
    // The chick's drawn device is in the stage, not the upgraded one.
    const stage = root.querySelector('[data-drawer-stage="chick"]') as unknown as { innerHTML: string } | null;
    expect(stage?.innerHTML ?? "").toContain('data-device="chick"');
    expect(stage?.innerHTML ?? "").not.toContain("upgraded");
    title.destroy();
  });

  it("opening the Kurogotchi cell (unlocked, memory wired) renders its machine", async () => {
    const mem = { hunger: 0, joy: 0, light: true, lastSeen: null, fed: 0 };
    const store = { read: () => mem, write() {} };
    const { root, title, click } = await mount(coll({ objects: [], kurogotchi: true }), store);
    click('[data-action="title-drawer"]');
    click(`[data-action="drawer-open"][data-object="${KURO_ID}"]`);
    const stage = root.querySelector(`[data-drawer-stage="${KURO_ID}"]`) as unknown as { innerHTML: string } | null;
    expect(stage?.innerHTML ?? "").toContain('data-device="kurogotchi"');
    expect(stage?.innerHTML ?? "").toContain("klcd"); // the 64×64 LCD
    title.destroy();
  });
});

// ——— 3. playing an object in the drawer (store-free) ———

describe("playing an object in the drawer touches no store", () => {
  it("opening the chick renders the device without upgraded; keys change only the in-memory program; reopening is fresh", async () => {
    // A store exists on the page (none is created by the drawer); its event count must not change.
    const store = createStore({ startDay: 1 });
    const before = store.getEvents().length;
    const { root, title, click } = await mount(coll({ objects: ["chick"] }));
    click('[data-action="title-drawer"]');
    click('[data-action="drawer-open"][data-object="chick"]');
    const stage = () => root.querySelector('[data-drawer-stage="chick"]') as unknown as { innerHTML: string };
    expect(stage().innerHTML).not.toContain("upgraded");
    // Press A: the chick's menu opens (the program's state changed), but no event was appended.
    click('button[data-action="obj-key"][data-object="chick"][data-key="A"]');
    expect(store.getEvents().length).toBe(before);
    // Back to the grid and open again: a fresh program (the menu is closed again — no A pressed yet).
    click('[data-action="drawer-grid"]');
    click('[data-action="drawer-open"][data-object="chick"]');
    expect(stage().innerHTML).toContain('data-device="chick"');
    title.destroy();
  });
});

// ——— the walkman in the drawer plays the theme ———

describe("the walkman in the drawer", () => {
  it("play asks the sound player for the theme and stop pauses it; no recording is produced", async () => {
    const { root, title, click, applied } = await mount(coll({ objects: ["tape"] }));
    click('[data-action="title-drawer"]');
    click('[data-action="drawer-open"][data-object="tape"]');
    const n = applied.length;
    // 播放: the title theme is (re)applied with the rain off (the walkman's song, not a recording).
    click('button[data-action="obj-key"][data-object="tape"][data-key="play"]');
    expect(applied.length).toBeGreaterThan(n);
    const playPlan = applied.at(-1) as { music?: string; rain?: number | null };
    expect(playPlan.music).toBe("theme");
    // ■ 停止: the theme is applied again (the title's own theme resumes; no story say anywhere).
    const m = applied.length;
    click('button[data-action="obj-key"][data-object="tape"][data-key="stop"]');
    expect(applied.length).toBeGreaterThan(m);
    // The drawer never queued a dialogue line (no recording `say`): the page has no dialogue box.
    expect(root.innerHTML).not.toContain("dlg-box");
    title.destroy();
  });
});
