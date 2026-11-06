// camera (2026-11-04): R1 the camera in every object list (content still says `textbook`; the game
// reads it as `camera`), R8 the instant camera (10 room sheets, unlimited screen photos, 20 s of
// developing, room additions by (day, facing)), R3 the album and its difference rings, R4 the
// photos.json loader, R9 the drawn device. Content is not edited: photos.json is a fixture here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { membersOf } from "@state/variables";
import { objectsFoundOnDay } from "@state/stages";
import { recogniseTable } from "@state/recognise";
import { handOf } from "@state/hands";
import { createStore, type Store } from "@state/store";
import { lockCodesOffered, lockObjectAvailable } from "@state/days/board";
import type { TaskBoard } from "@state/days/tasks";
import { CAMERA_SHEETS, DEVELOP_BLANK_MS, DEVELOP_MS, ON_THE_SPOT_DAY, albumPhotos, developStage, parsePhotos, photoAdds, photoStage, sheetsLeft } from "@state/photos";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { photoPicture, screenPlaceOf } from "@world/desktop/files/album";
import { changedKeys, DIFF_ATTR, markDiffs } from "@world/desktop/files/diff";
import { ALBUM_TAB, renderFiles } from "@world/desktop/files/view";
import { t } from "@world/i18n";
import { camera, CAM_W } from "@world/objects/plain";
import type { ObjectEnv } from "@world/objects/program";
import { CASE_OBJECTS } from "@world/room/case";
import { CAMERA_KEYS, DEVICE_IDS, FLIPPERS, SHEET_GONE_MS, SHEET_SLIDE_MS } from "@world/room/devices";
import { loopActions } from "@world/room/game";
import { boxObjectFor, renderRoom } from "@world/room/hud";

const css = (f: string) => readFileSync(resolve(__dirname, f), "utf8");

describe("R1 · the camera replaces the textbook in every object list", () => {
  it("found, the box days, the case, the hand table and the questions all say camera", () => {
    expect(membersOf("found")).toContain("camera");
    expect(membersOf("found")).not.toContain("textbook");
    expect(objectsFoundOnDay.camera).toBe(2);
    expect("textbook" in objectsFoundOnDay).toBe(false);
    expect(boxObjectFor(2)).toBe("camera");
    expect(CASE_OBJECTS).toContain("camera");
    expect(CASE_OBJECTS).not.toContain("textbook");
    expect(recogniseTable.has("camera")).toBe(true);
    expect(recogniseTable.has("textbook")).toBe(false);
    expect(handOf("camera")).toBeDefined();
    // Content says camera now (task 8): no load-time mapping is left.
    expect(css("../src/state/types.gen.ts")).toContain('"camera"');
    expect(css("../src/state/types.gen.ts")).not.toContain("textbook");
  });
  it("day 2's box gives the camera; opening it finds the camera", () => {
    const store = createStore({ startDay: 2 });
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    expect(store.getState().found).toEqual(["camera"]);
    expect(() => createStore({ startDay: 2 }).appendEvent({ kind: "openLayer", objectId: "textbook" })).toThrow(/unknown object/);
  });
  it("the textbook's back-cover cell is gone; the camera is a drawn device that flips", () => {
    expect("cell" in handOf("camera")).toBe(false);
    expect(DEVICE_IDS).toContain("camera");
    expect(FLIPPERS).toContain("camera");
  });
});

// ——— R8 · the instant camera ———

const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 2, level: 0, upgraded: false, taken: false, time: "10:00", t: 0, seed: "s", lit: 1, pager: [], uses: 0, sheets: 10, onScreen: false, ...over });

describe("R8 · the program: shutter and flash, no wheel", () => {
  it("the shutter ejects a sheet (its sound); at 0 sheets in the room it clicks and nothing comes out", () => {
    const s0 = camera.init(env());
    const shot = camera.key(s0, "shutter", env({ t: 40 }));
    expect(shot.state.ejectAt).toBe(40);
    expect(shot.out).toEqual([{ sound: "camera-shutter" }]);
    const empty = camera.key(s0, "shutter", env({ t: 40, sheets: 0 }));
    expect(empty.state).toEqual(s0);
    expect(empty.out).toEqual([{ say: { key: "d2:camera.empty", lines: [{ k: "inner", t: t("camera.empty") }] } }]);
    // On the screen it is unlimited.
    expect(camera.key(s0, "shutter", env({ t: 40, sheets: 0, onScreen: true })).state.ejectAt).toBe(40);
  });
  it("flash toggles the slider; there is no wheel", () => {
    const s0 = camera.init(env());
    const on = camera.key(s0, "flash", env()).state;
    expect(on.flash).toBe(true);
    expect(camera.key(on, "flash", env()).state.flash).toBe(false);
    expect(camera.key(s0, "wheel", env()).state).toEqual(s0);
    expect(CAMERA_KEYS).toEqual(["shutter", "flash"]);
    expect(css("../src/world/objects/plain.ts")).not.toContain('"camera-wheel"');
  });
  it("the back counter is the calculator's seven segments (two cells)", () => {
    const f = camera.draw(camera.init(env()), env({ sheets: 7 }));
    expect(f.kind).toBe("pixels");
    expect(f.kind === "pixels" && f.w).toBe(CAM_W);
  });
});

/** Day 2 with the camera found and known; the player at `view`. */
function rig(view: Session["view"], day = 2): { store: Store; ctx: ActionContext; act: (n: string, d?: Record<string, string>) => void; tick: (ms: number) => void } {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "openLayer", objectId: "camera" });
  // Known (its right answer), so no question is asked on lifting; it is not one of the six.
  store.appendEvent({ kind: "recognise", objectId: "camera", option: recogniseTable.get("camera")!.options.findIndex((o) => o.right) });
  let now = 1_000_000;
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {}, now: () => now };
  const act = (n: string, d: Record<string, string> = {}) => loopActions[n]!(ctx, d as DOMStringMap, null as never);
  return { store, ctx, act, tick: (ms) => void (now += ms) };
}
const photos = (store: Store) => store.getEvents().flatMap((e) => (e.kind === "photo" ? [e.at] : []));

describe("R8 · sheets: 10 for the room, the screen unlimited and uncounted", () => {
  it("ten room photos, then the shutter clicks and nothing comes out", () => {
    // camera-viewfinder R2: one room sheet a day, through the viewfinder; so one a day for ten days.
    const r = rig("window");
    r.act("loop-hold", { object: "camera" });
    r.act("obj-use");
    for (let i = 0; i < CAMERA_SHEETS + 1; i++) {
      r.tick(1000);
      r.act("obj-key", { object: "camera", key: "shutter" });
      r.act("vf-shutter");
      r.act("vf-sheet-away");
      if (i < CAMERA_SHEETS) r.store.appendEvent({ kind: "lieDown" });
    }
    expect(photos(r.store)).toEqual(Array(CAMERA_SHEETS).fill("room:window"));
    expect(sheetsLeft(r.store.getEvents())).toBe(0);
    const day = r.store.getState().day;
    expect(r.ctx.session.dialogue.queue.some((q) => q.key === `d${day}:camera.empty`)).toBe(true);
  });
  it("on 屏幕 (the 老物件栏 over the desktop) every shot is a screen photo, never counted", () => {
    const r = rig("desktop");
    for (let i = 0; i < CAMERA_SHEETS; i++) r.ctx.store.appendEvent({ kind: "photo", at: "room:bed", t: "10:00" });
    expect(sheetsLeft(r.store.getEvents())).toBe(0);
    r.act("objbar-open", { object: "camera" });
    for (let i = 0; i < 4; i++) {
      r.tick(1000);
      r.act("obj-key", { object: "camera", key: "shutter" });
    }
    const at = screenPlaceOf(r.ctx.session, 2);
    expect(at.startsWith("screen")).toBe(true);
    expect(photos(r.store).slice(CAMERA_SHEETS)).toEqual(Array(4).fill(at));
    expect(sheetsLeft(r.store.getEvents())).toBe(0);
    // The screen's still was kept for each.
    expect(Object.values(r.ctx.session.photos).every((p) => p.still !== null && p.still.includes('class="win'))).toBe(true);
  });
  it("the photo event checks where it was pointed and needs the camera", () => {
    const s = createStore({ startDay: 2 });
    expect(() => s.appendEvent({ kind: "photo", at: "room:room", t: "10:00" })).toThrow(/camera has not been found/);
    s.appendEvent({ kind: "openLayer", objectId: "camera" });
    for (const bad of ["room:kitchen", "nowhere", "screen:", "meeting:"]) expect(() => s.appendEvent({ kind: "photo", at: bad, t: "10:00" }), bad).toThrow(/photo: at must be/);
    expect(() => s.appendEvent({ kind: "photo", at: "room:door", t: "9:00" })).toThrow(/HH:MM/);
  });
});

describe("R8 · developing for 20 s: blank, cyan, final", () => {
  it("the three stages by elapsed time; unknown (an earlier session) and upgraded are developed", () => {
    expect(DEVELOP_MS).toBe(20_000);
    expect(developStage(0)).toBe("blank");
    expect(developStage(DEVELOP_BLANK_MS - 1)).toBe("blank");
    expect(developStage(DEVELOP_BLANK_MS)).toBe("cyan");
    expect(developStage(DEVELOP_MS - 1)).toBe("cyan");
    expect(developStage(DEVELOP_MS)).toBe("final");
    expect(developStage(null)).toBe("final");
    expect(developStage(0, true)).toBe("final");
  });
  it("a room photo on (day, facing) shows that day's addition only once developed (never the upgraded camera's)", () => {
    const table = parsePhotos({ room: [{ day: 10, facing: "window", add: { text: "TEXT-10", overlay: "/room/over/w10.png" } }, { day: 11, facing: "window", add: { text: "TEXT-11" } }] });
    const p = { at: "room:window", day: 10, takenAt: 0, still: null };
    const at = (stage: "blank" | "cyan" | "final", upgraded = false) => photoPicture(p, stage, upgraded, 0.1, null, table).value;
    for (const s of ["blank", "cyan"] as const) expect(at(s), s).not.toContain("TEXT-10");
    expect(at("final")).toContain('<span class="ph-add">TEXT-10</span>');
    expect(at("final")).toContain('<img class="ph-over" src="/room/over/w10.png"');
    expect(at("final")).not.toContain("TEXT-11");
    expect(at("final", true)).not.toContain("TEXT-10");
    expect(at("final")).toContain('<img class="ph-room" src="/room/shots/window.jpg"');
    expect(at("blank")).toContain('class="ph-pic dev-blank" data-stage="blank"');
    // Another facing or another day: nothing.
    expect(photoAdds({ at: "room:bed", day: 10 }, table)).toEqual([]);
    expect(photoAdds({ at: "room:window", day: 12 }, table)).toEqual([]);
  });
});

describe("R4 · content/photos.json (strict; a missing file means nothing extra)", () => {
  it("reads room (day, facing) and screen (at, day); rejects what is not the shape", () => {
    const ok = parsePhotos({ _note: "x", room: [{ day: 3, facing: "bed", add: { text: "a" } }], screen: [{ at: "meeting:task4", day: 10, add: { overlay: "/x.png" } }] });
    expect(ok.room).toEqual([{ day: 3, facing: "bed", add: { text: "a" } }]);
    expect(ok.screen).toEqual([{ at: "meeting:task4", day: 10, add: { overlay: "/x.png" } }]);
    expect(parsePhotos({})).toEqual({ room: [], screen: [] });
    const bad: [unknown, RegExp][] = [
      [{ extra: 1 }, /unknown key "extra"/],
      [{ room: [{ day: 3, facing: "kitchen", add: { text: "a" } }] }, /facing: must be one of/],
      [{ room: [{ fromDay: 3, facing: "bed", add: { text: "a" } }] }, /unknown key "fromDay"/],
      [{ room: [{ day: 19, facing: "bed", add: { text: "a" } }] }, /day: must be a day 1–18/],
      [{ room: [{ day: 3, facing: "bed", add: {} }] }, /needs a text or an overlay/],
      [{ room: [{ day: 3, facing: "bed", add: { overlay: "x.png" } }] }, /overlay: must be a path under \//],
      [{ room: [{ day: 3, facing: "bed", add: { text: "a" } }, { day: 3, facing: "bed", add: { text: "b" } }] }, /a second entry/],
      [{ screen: [{ at: "room:bed", day: 3, add: { text: "a" } }] }, /must be a screen place/],
    ];
    for (const [input, error] of bad) expect(() => parsePhotos(input)).toThrow(error);
  });
});

// ——— R3 · the album and the difference rings ———

describe("R3 · differences: a thin red ring on exactly the elements whose text changed", () => {
  const before = `<div class="win" data-win="workbench"><div data-slot="s1">alpha</div><div data-slot="s2">beta</div><p data-person="p1"><b>name</b> keeps</p><span data-card="c1">same</span></div>`;
  const after = `<div class="win" data-win="workbench"><div data-slot="s1">alpha</div><div data-slot="s2">BETA</div><p data-person="p1"><b>name</b> changed</p><span data-card="c1">same</span></div>`;
  it("marks the two changed elements and not the window around them", () => {
    expect(changedKeys(before, after)).toEqual(['div[data-slot=s2]#0', "p[data-person=p1]#0"]);
    const m = markDiffs(before, after);
    for (const side of [m.photo, m.live]) {
      expect([...side.matchAll(new RegExp(` ${DIFF_ATTR}`, "g"))]).toHaveLength(2);
      expect(side).toContain(`<div ${DIFF_ATTR} data-slot="s2">`);
      expect(side).toContain(`<p ${DIFF_ATTR} data-person="p1">`);
      expect(side).not.toContain(`<div ${DIFF_ATTR} class="win"`);
    }
    expect(markDiffs(before, before).keys).toEqual([]);
  });

  it("in 相册: a developed screen photo of the place on screen now sits beside the live screen, both ringed", () => {
    const store = createStore({ startDay: 2 });
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    store.appendEvent({ kind: "photo", at: "screen:workbench:home", t: "10:00" });
    const index = store.getEvents().length - 1;
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    session.photos = { [index]: { at: "screen:workbench:home", day: 2, takenAt: 0, still: before } };
    session.filesApp = { which: "files", tab: ALBUM_TAB, open: `photo:${index}` };
    const app = (nowMs: number): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 2, session, night: false, nowMs });
    const live = { at: "screen:workbench:home", still: after };
    // Listed at once, developing.
    expect(albumPhotos(store.getEvents()).map((p) => p.index)).toEqual([index]);
    const developing = renderFiles(app(DEVELOP_BLANK_MS + 10), live)!.value;
    expect(developing).toContain(`data-action="photo-open" data-photo="${index}"`);
    expect(developing).toContain('data-stage="cyan"');
    expect(developing).not.toContain("ph-pair");
    const done = renderFiles(app(DEVELOP_MS + 10), live)!.value;
    expect(done).toContain('<div class="ph-pair">');
    expect([...done.matchAll(new RegExp(` ${DIFF_ATTR}`, "g"))]).toHaveLength(4);
    // Another place on screen: the photo alone.
    expect(renderFiles(app(DEVELOP_MS + 10), { at: "screen:tingtalk", still: after })!.value).not.toContain("ph-pair");
    expect(done).toContain(`>${t("files.album")}</button>`);
  });
});

// ——— R9 · the drawn device ———

describe("R9 · the camera in 使用 is a drawn device", () => {
  it("the flat shell: lens, stripe, flash window, viewfinder, shutter and flash keys, the slot; no text, no logo", () => {
    const r = rig("room");
    r.act("loop-hold", { object: "camera" });
    r.act("obj-use");
    const out = renderRoom({ state: r.store.getState(), events: r.store.getEvents(), session: r.ctx.session, nowMs: 1 }).value;
    const shell = /<div class="dev-shell cam[^"]*" data-device="camera".*?<\/div><\/div>(?=<div class="turnbar">)/s.exec(out)?.[0] ?? "";
    expect(shell).not.toBe("");
    for (const part of ["cam-top", "cam-bottom", "cam-slot", "cam-stripe", "cam-flashwin", "cam-vf", "cam-lens"]) expect(shell, part).toContain(part);
    expect(shell).toContain('data-action="obj-key" data-object="camera" data-key="shutter"');
    expect(shell).toContain('data-action="obj-key" data-object="camera" data-key="flash"');
    expect(shell).toContain('<circle cx="66" cy="66" r="66" fill="#1E1E21"/>');
    expect(shell).toContain('<stop offset="0%" stop-color="#3A4A55"/><stop offset="100%" stop-color="#11161A"/>');
    // No visible text in the shell.
    expect(shell.replace(/<[^>]+>/g, "").trim()).toBe("");
    expect(out).toContain('data-action="obj-flip" data-object="camera"');
  });

  it("a shot slides a sheet out of the slot (0–600 ms), shows it until 2600 ms, then it is gone; flipped, the back shows the counter's glass", () => {
    const r = rig("bed");
    r.act("loop-hold", { object: "camera" });
    r.act("obj-use");
    r.act("obj-key", { object: "camera", key: "shutter" });
    // camera-viewfinder: through the viewfinder, then the sheet in hand is put away.
    r.act("vf-shutter");
    r.act("vf-sheet-away");
    const render = (nowMs: number) => renderRoom({ state: r.store.getState(), events: r.store.getEvents(), session: r.ctx.session, nowMs }).value;
    const taken = r.ctx.session.photos[r.ctx.session.lastPhoto!]!.takenAt;
    // Sliding out: 0–600 ms, its place kept across re-renders (a negative delay).
    expect(render(taken)).toMatch(/<div class="cam-sheet" style="--late:-0ms"><div class="ph-pic dev-blank"/);
    expect(render(taken + 100)).toMatch(/<div class="cam-sheet" style="--late:-100ms"><div class="ph-pic dev-blank"/);
    expect(render(taken + SHEET_SLIDE_MS - 1)).toMatch(/<div class="cam-sheet" style="--late:-599ms">/);
    // Out and still (R10: a room photo stays blank all its shooting day), until 2600 ms.
    expect(SHEET_GONE_MS).toBe(2600);
    expect(render(taken + SHEET_SLIDE_MS)).toMatch(/<div class="cam-sheet out"><div class="ph-pic dev-blank"/);
    expect(render(taken + SHEET_GONE_MS - 1)).toMatch(/<div class="cam-sheet out"><div class="ph-pic dev-blank"/);
    // Then gone: it never hangs for good.
    expect(render(taken + SHEET_GONE_MS)).not.toContain("cam-sheet");
    expect(render(taken + DEVELOP_MS + 1)).not.toContain("cam-sheet");
    r.act("obj-flip");
    const back = render(taken + 1000);
    expect(back).toContain('class="cam-counter"><div class="glass"><canvas class="dev" data-screen="camera"');
    expect(back).not.toContain("cam-sheet");
  });

  it("the R9 parameters are in the stylesheet", () => {
    const c = css("../src/world/room/devices.css");
    expect(c).toContain(".dev-shell.cam{width:360px;height:300px;border-radius:28px 28px 18px 18px");
    expect(c).toMatch(/\.dev-shell\.cam \.cam-top\{[^}]*height:62%;[^}]*background:#F6F4EF;border:1px solid #E3DED4/);
    expect(c).toMatch(/\.dev-shell\.cam \.cam-bottom\{[^}]*background:#2B2B2E/);
    expect(c).toMatch(/\.dev-shell\.cam \.cam-slot\{[^}]*bottom:21px;width:260px;height:10px;[^}]*background:#141416;border-radius:5px/);
    expect(c).toMatch(/\.dev-shell\.cam \.cam-stripe\{[^}]*width:34px/);
    expect(c).toContain(".dev-shell.cam .cam-stripe .t{background:#2FB7A8}");
    expect(c).toContain(".dev-shell.cam .cam-stripe .c{background:#F07A5A}");
    expect(c).toMatch(/\.cam-flashwin\{[^}]*width:78px;height:46px;border-radius:8px;background:#FFFFFF/);
    expect(c).toContain(".dev-shell.cam .cam-flashwin i{width:1px;background:#D9D9D9}");
    expect(c).toMatch(/\.cam-vf\{[^}]*width:54px;height:46px;border-radius:10px;background:#1E1E21/);
    expect(c).toMatch(/\.cam-vf i\{[^}]*background:#5B6770/);
    expect(c).toMatch(/\.cam-shutter\{[^}]*width:46px;height:46px;border-radius:50%;background:#E5322D;box-shadow:0 0 0 2px #B32420/);
    expect(c).toContain(".dev-shell.cam .cam-shutter.down{transform:translateY(2px)}");
    expect(c).toMatch(/\.cam-flashsl\{[^}]*width:30px;height:14px/);
    expect(c).toMatch(/\.cam-flashsl::after\{[^}]*background:#F2B632/);
    expect(c).toMatch(/\.cam-sheet\{[^}]*width:200px;height:236px;[^}]*padding:10px 10px 46px;background:#FFFFFF;[^}]*animation:cam-eject 600ms/);
    // It comes out of the slot itself: its top at the slot's middle line, in front of the dark band.
    expect(c).toMatch(/\.cam-sheet\{[^}]*top:274px;[^}]*z-index:2;/);
  });
});

describe("a board lock with object: camera behaves like the other object locks", () => {
  const board = { given: { lock: { object: "camera", codes: ["1", "2"], answer: "1" }, rows: {} } } as unknown as TaskBoard;
  it("available and its chips offered once the camera is found; not before", () => {
    const store = createStore({ startDay: 2 });
    expect(lockObjectAvailable(board, store.getState(), store.getEvents())).toBe(false);
    expect(lockCodesOffered(board, store.getState(), store.getEvents())).toBe(false);
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    expect(lockObjectAvailable(board, store.getState(), store.getEvents())).toBe(true);
    expect(lockCodesOffered(board, store.getState(), store.getEvents())).toBe(true);
  });
});

// ——— R10 · room photos develop overnight; on the last day on the spot ———

describe("R10 · a room photo shot on day n is blank on day n and developed on day n+1", () => {
  const fixture = parsePhotos({ room: [{ day: 5, facing: "door", add: { text: "ADD-5" } }, { day: 18, facing: "door", add: { text: "ADD-18" } }] });

  it("the rule: blank all of day n; developed from n+1, the 20 s playing the first time it is opened that day", () => {
    const p = { at: "room:door", day: 5 };
    for (const since of [0, DEVELOP_MS + 1, 10 * DEVELOP_MS]) expect(photoStage(p, 5, since, null)).toBe("blank");
    expect(photoStage(p, 6, null, null)).toBe("final");
    expect(photoStage(p, 6, null, 0)).toBe("blank");
    expect(photoStage(p, 6, null, DEVELOP_BLANK_MS)).toBe("cyan");
    expect(photoStage(p, 6, null, DEVELOP_MS)).toBe("final");
    // Later days: developed, no animation.
    expect(photoStage(p, 7, null, 0)).toBe("final");
    // Screen photos are unchanged: 20 s from when they were taken.
    expect(photoStage({ at: "screen:workbench:home", day: 5 }, 5, DEVELOP_BLANK_MS, null)).toBe("cyan");
    expect(photoStage({ at: "screen:workbench:home", day: 5 }, 5, DEVELOP_MS, null)).toBe("final");
  });

  it("on the last day a room photo develops on the spot in 20 s and shows that day's addition", () => {
    expect(ON_THE_SPOT_DAY).toBe(18);
    const p = { at: "room:door", day: 18 };
    expect(photoStage(p, 18, 0, null)).toBe("blank");
    expect(photoStage(p, 18, DEVELOP_BLANK_MS, null)).toBe("cyan");
    expect(photoStage(p, 18, DEVELOP_MS, null)).toBe("final");
    expect(photoPicture({ ...p, takenAt: 0, still: null }, "final", false, 0.1, null, fixture).value).toContain("ADD-18");
  });

  it("in 相册: blank on day n with its time and facing; on day n+1 it opens developing, then shows the shooting day's addition", () => {
    const store = createStore({ startDay: 5 });
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    store.appendEvent({ kind: "photo", at: "room:door", t: "11:20" });
    const index = store.getEvents().length - 1;
    let now = 5_000_000;
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    session.filesApp = { which: "files", tab: ALBUM_TAB, open: null };
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const out = () => renderFiles({ state: store.getState(), events: store.getEvents(), startDay: 5, session, night: false, nowMs: now }, null)!.value;
    const row = () => new RegExp(`data-photo="${index}"><span class="ph-thumb"><div class="ph-pic dev-(\\w+)"`).exec(out())?.[1];
    // Day n: listed, blank, with its time and facing.
    expect(row()).toBe("blank");
    expect(out()).toContain(`<span class="f-date">${t("shell.day", { day: 5 })} 11:20</span>`);
    expect(out()).toContain(`<span class="f-name">${t("hud.cam.door")}</span>`);
    // Day n+1: developed in the list; opening it plays the 20 s, then the addition of day n.
    store.appendEvent({ kind: "lieDown" });
    expect(store.getState().day).toBe(6);
    expect(row()).toBe("final");
    loopActions["photo-open"]!(ctx, { photo: String(index) } as DOMStringMap, null as never);
    expect(session.photoOpened[index]).toEqual({ day: 6, at: now });
    expect(row()).toBe("blank");
    now += DEVELOP_BLANK_MS;
    expect(row()).toBe("cyan");
    now += DEVELOP_MS;
    expect(row()).toBe("final");
    // Opened again the same day: no second animation.
    loopActions["photo-open"]!(ctx, { photo: String(index) } as DOMStringMap, null as never);
    expect(row()).toBe("final");
    expect(photoAdds({ at: "room:door", day: 5 }, fixture)).toEqual([{ text: "ADD-5" }]);
    expect(photoAdds({ at: "room:door", day: 6 }, fixture)).toEqual([]);
  });

  it("door photos use the door's own still", () => {
    expect(photoPicture({ at: "room:door", day: 5, takenAt: null, still: null }, "final", false, 0.1, null, fixture).value).toContain('<img class="ph-room" src="/room/door_wall.png"');
  });
});
