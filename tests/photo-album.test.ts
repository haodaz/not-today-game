// photo-album (2026-11-04): R1 the cross-run profile collects a room photo when it is first seen
// developed ("<day>:<facing>"); R2 the 影集 on the title page: store-free, nothing appended.
import { afterEach, describe, expect, it } from "vitest";
import { createProfileWriter } from "@state/saves";
import { readProfile } from "@state/profile-read";
import { memoryStorage } from "@state/slot";
import { createStore, type Store } from "@state/store";
import { DEVELOP_MS, photosTable } from "@state/photos";
import type { ActionContext } from "@world/desktop/controller";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import { ALBUM_TAB } from "@world/desktop/files/view";
import { t, setLocale } from "@world/i18n";
import { loopActions } from "@world/room/game";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { readCollection } from "../src/ui/collection";
import { albumCells, albumPage, albumRing, albumStep, hasAlbum } from "../src/ui/title/album";
import { initialTitle } from "../src/ui/title/model";
import { renderTitle } from "../src/ui/title/view";
import { mountTitle } from "../src/ui/title/mount";

afterEach(() => setLocale("zh"));
const coll = (over: Partial<Collection> = {}): Collection => ({ ...EMPTY_COLLECTION, ...over });

// ——— R1 · the profile ———

describe("R1 · the profile's photos", () => {
  it("collecting 10:window writes it once; order kept; unknown keys dropped on read", () => {
    const storage = memoryStorage();
    const writer = createProfileWriter(storage);
    writer.recordPhoto("10:window");
    writer.recordPhoto("3:bed");
    writer.recordPhoto("10:window");
    expect(readProfile(storage)!.photos).toEqual(["10:window", "3:bed"]);
    expect(readCollection(storage).photos).toEqual(["10:window", "3:bed"]);
    // Keys content does not have are dropped (and anything that is not a string).
    writer.write({ photos: ["3:bed", "99:window", "2:room", 7, "10:kitchen", "18:door"] });
    expect(readCollection(storage).photos).toEqual(["3:bed", "18:door"]);
    expect(readCollection(memoryStorage()).photos).toEqual([]);
  });
});

/** A run on `day` with the camera, a room photo shot on `shotDay` (and the days lain down after). */
function run(shotDay: number, facing: string, today: number): { store: Store; ctx: ActionContext; collected: string[]; tick: (ms: number) => void; timers: { at: number; fn: () => void }[] } {
  const store = createStore({ startDay: shotDay });
  store.appendEvent({ kind: "openLayer", objectId: "camera" });
  store.appendEvent({ kind: "photo", at: `room:${facing}`, t: "10:00" });
  for (let d = shotDay; d < today; d++) store.appendEvent({ kind: "lieDown" });
  const collected: string[] = [];
  let now = 1_000_000;
  const timers: { at: number; fn: () => void }[] = [];
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  session.filesApp = { which: "files", tab: ALBUM_TAB, open: null };
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now, developed: (k) => collected.push(k) };
  const tick = (ms: number) => {
    now += ms;
    for (const x of timers.splice(0)) {
      if (x.at <= now) x.fn();
      else timers.push(x);
    }
  };
  return { store, ctx, collected, tick, timers };
}
const openPhoto = (ctx: ActionContext) => loopActions["photo-open"]!(ctx, { photo: "1" } as DOMStringMap, null as never);

describe("R1 · collected only when seen developed", () => {
  it("not when shot, not on its own day; on day n+1 when its 20 s end with it open", () => {
    const sameDay = run(10, "window", 10);
    openPhoto(sameDay.ctx);
    sameDay.tick(DEVELOP_MS * 2);
    expect(sameDay.collected).toEqual([]);
    const next = run(10, "window", 11);
    openPhoto(next.ctx);
    expect(next.collected).toEqual([]);
    next.tick(DEVELOP_MS + 20);
    expect(next.collected).toEqual(["10:window"]);
  });
  it("closed before its developing ends: not yet; a later day it is final at once", () => {
    const r = run(5, "bed", 6);
    openPhoto(r.ctx);
    r.ctx.session.filesApp = { which: "files", tab: ALBUM_TAB, open: null };
    r.tick(DEVELOP_MS + 20);
    expect(r.collected).toEqual([]);
    const later = run(5, "bed", 8);
    openPhoto(later.ctx);
    expect(later.collected).toEqual(["5:bed"]);
  });
  it("day 18: collected when its 20 s on the spot finish (taken with the shutter)", () => {
    const store = createStore({ startDay: 18 });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    const collected: string[] = [];
    const timers: { ms: number; fn: () => void }[] = [];
    const session = initialSession(DEFAULT_CLOCK, "left", "door");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => 0, developed: (k) => collected.push(k) };
    loopActions["loop-hold"]!(ctx, { object: "camera" } as DOMStringMap, null as never);
    // The question for the camera may be queued; it does not stop the hand.
    loopActions["obj-use"]!(ctx, {} as DOMStringMap, null as never);
    loopActions["obj-key"]!(ctx, { object: "camera", key: "shutter" } as DOMStringMap, null as never);
    expect(store.getEvents().filter((e) => e.kind === "photo").map((e) => (e.kind === "photo" ? e.at : ""))).toEqual(["room:door"]);
    expect(collected).toEqual([]);
    for (const x of timers.filter((x) => x.ms <= DEVELOP_MS + 16)) x.fn();
    expect(collected).toEqual(["18:door"]);
  });
  it("a debug run (no host callback) records nothing and does not break", () => {
    const silent = run(3, "door", 5);
    const ctx = { ...silent.ctx, developed: undefined };
    expect(() => openPhoto(ctx)).not.toThrow();
  });
});

// ——— R2 · the 影集 ———

describe("R2 · the 影集 on the title page", () => {
  it("hidden before any camera, shown after", () => {
    expect(hasAlbum(coll())).toBe(false);
    expect(renderTitle(initialTitle(null, coll({ objects: ["chick"] }))).value).not.toContain('data-action="title-album"');
    expect(hasAlbum(coll({ objects: ["chick", "camera"] }))).toBe(true);
    expect(renderTitle(initialTitle(null, coll({ objects: ["chick", "camera"] }))).value).toContain(`data-action="title-album">${t("title.album")}</button>`);
  });

  it("a grid of 16 days × 4 (days 3–18, 房间 · 床 · 门 · 窗); a count at the top", () => {
    const cells = albumCells(coll(), photosTable);
    expect(cells).toHaveLength(64);
    expect([...new Set(cells.map((c) => c.day))]).toEqual(Array.from({ length: 16 }, (_, i) => i + 3));
    expect(cells.slice(0, 4).map((c) => c.facing)).toEqual(["room", "bed", "door", "window"]);
    const page = albumPage(coll({ photos: ["10:window", "3:bed"] })).value;
    expect([...page.matchAll(/class="album-day" data-day="(\d+)"/g)].map((m) => Number(m[1]))).toEqual(Array.from({ length: 16 }, (_, i) => i + 3));
    expect(page).toContain(`<div class="album-count">${t("album.count", { n: 2, total: 64 })}</div>`);
  });

  it("collected cells are the developed photo; uncollected are labelled blank sheets; day 18's are unlabelled", () => {
    const page = albumPage(coll({ photos: ["10:window"] })).value;
    expect(page).toMatch(/<button type="button" class="album-cell got" data-action="album-open" data-photo="10:window"[^>]*><span class="album-sheet"><div class="ph-pic dev-final" data-stage="final"><img class="ph-room" src="\/room\/shots\/window.jpg"/);
    expect(page).toContain(`<div class="album-cell blank" data-photo="3:room" aria-label="${t("album.cell", { day: 3, facing: t("hud.cam.room") })}"><span class="album-sheet"></span><span class="album-label">${t("album.cell", { day: 3, facing: t("hud.cam.room") })}</span></div>`);
    for (const f of ["room", "bed", "door", "window"]) expect(page).toContain(`<div class="album-cell blank last" data-photo="18:${f}"><span class="album-sheet"></span><span class="album-label">？</span></div>`);
    // Collected, day 18 is a photo like any other.
    expect(albumPage(coll({ photos: ["18:door"] })).value).toContain('data-action="album-open" data-photo="18:door"');
  });

  it("opened large with the addition's text under it; ← → only over the collected ones, wrapping", () => {
    const c = coll({ photos: ["10:window", "3:bed", "12:door"] });
    expect(albumRing(c)).toEqual(["3:bed", "10:window", "12:door"]);
    expect(albumStep(c, "3:bed", 1)).toBe("10:window");
    expect(albumStep(c, "12:door", 1)).toBe("3:bed");
    expect(albumStep(c, "3:bed", -1)).toBe("12:door");
    expect(albumStep(c, "4:room", 1)).toBeNull();
    const big = albumPage(c, "10:window").value;
    const text = photosTable.room.find((r) => r.day === 10 && r.facing === "window")!.add.text!;
    expect(big).toContain('<div class="album-open" data-photo="10:window">');
    expect(big).toContain(`<p class="album-text">${text}</p>`);
    expect(big).toContain('data-action="album-prev"');
    expect(big).not.toContain('class="album-grid"');
    // An uncollected key never opens.
    expect(albumPage(c, "4:room").value).toContain('class="album-grid"');
    // One collected photo: the arrows are there but do nothing.
    expect(albumPage(coll({ photos: ["3:bed"] }), "3:bed").value).toMatch(/data-action="album-next" aria-label="→" disabled/);
  });

  it("mounted: the button opens it; a photo opens large; → / ArrowRight step; 返回 goes back to the grid, then the menu; nothing stored", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    const root = win.document.createElement("div") as unknown as HTMLElement;
    win.document.body.appendChild(root as never);
    const sound = { muted: false, setMuted() {}, apply() {}, unlock() {}, onTuneEnd() {}, armGestures() {}, idle: async () => {}, destroy() {} } as never;
    const collection = coll({ objects: ["camera"], photos: ["10:window", "3:bed"] });
    const title = mountTitle(root, { save: null, collection, onContinue() {}, onStart() {}, random: () => 0.5, sound } as never);
    const click = (sel: string) => (root.querySelector(sel) as unknown as { dispatchEvent: (e: unknown) => void } | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as never);
    click('[data-action="title-album"]');
    expect(title.model().screen).toBe("album");
    click('[data-action="album-open"][data-photo="3:bed"]');
    expect(title.model().albumOpen).toBe("3:bed");
    click('[data-action="album-next"]');
    expect(title.model().albumOpen).toBe("10:window");
    win.dispatchEvent(new win.KeyboardEvent("keydown", { key: "ArrowRight" }) as never);
    expect(title.model().albumOpen).toBe("3:bed");
    click('[data-action="title-back"]');
    expect([title.model().screen, title.model().albumOpen]).toEqual(["album", null]);
    click('[data-action="title-back"]');
    expect(title.model().screen).toBe("menu");
    expect(win.localStorage.length).toBe(0);
    title.destroy();
  });
});
