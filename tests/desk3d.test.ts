// @vitest-environment happy-dom
// room-3d-desk: 桌子 is the shared room frame at its desk spot; the things on it are the hotspots. The
// pure parts (the pick map, the command, what each change posts, the rectangles) and the DOM layer
// (the commands after ready, the picks through the controller's actions, the 8 s fallback).
import { describe, expect, it, vi } from "vitest";
import { weatherOf } from "@state/stages";
import { printsOnDesk } from "@state/days/prints";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { EMPTY_COLLECTION } from "@world/room/collection";
import { deskCommand, deskPick, desk3dOn, LOCATE_IDS, LOCATE_RETRY_MS, NOTHING_POSTED, pickBlocked, rectsFromWhere, ROOM_READY_NET_MS, roomPosts, settleRoomFrame, type RoomWant } from "@world/room/desk3d";
import { renderRoom } from "@world/room/hud";
import { createRoom3dLayer } from "@world/room/outside";
import { onRoomMessage } from "@world/room/wake";
import { initialTitle } from "../src/ui/title/model";
import { renderTitle } from "../src/ui/title/view";

setLocale("zh");

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}

describe("deskPick: the parity table", () => {
  const found: Parameters<typeof deskPick>[1] = { found: ["chick", "pager"] };
  it("each row", () => {
    expect(deskPick("screen-left", found)).toEqual({ action: "view", data: { view: "desktop", screen: "left" } });
    expect(deskPick("screen-right", found)).toEqual({ action: "view", data: { view: "desktop", screen: "right" } });
    expect(deskPick("chick", found)).toEqual({ action: "loop-hold", data: { object: "chick" } });
    expect(deskPick("pager", found)).toEqual({ action: "loop-hold", data: { object: "pager" } });
    // an old object not found yet: nothing
    expect(deskPick("camera", found)).toBeNull();
    expect(deskPick("deskphone", found)).toEqual({ action: "loop-phone", data: {} });
    expect(deskPick("prints", found)).toEqual({ action: "prints-open", data: {} });
    expect(deskPick("slip", found)).toEqual({ action: "desk-slip", data: {} });
    expect(deskPick("lamp", found)).toEqual({ action: "lamp", data: {} });
    expect(deskPick("tower", found)).toEqual({ action: "tower-power", data: {} });
    // room-light-switch R4: the wall switch from the desk
    expect(deskPick("switch", found)).toEqual({ action: "switch", data: {} });
    // author 2026-11-24 (#64): the mug asks how to drink it
    expect(deskPick("mug", found)).toEqual({ action: "mug-ask", data: {} });
    for (const id of ["keyboard", "desk", "meal", "window", "slit", "box", "bed", "shelf", "door", "coat", "bag", "walkman"]) expect(deskPick(id, found), id).toBeNull();
    expect(deskPick(null, found)).toBeNull();
    expect(deskPick(undefined, found)).toBeNull();
  });
});

describe("the desk command and what is posted", () => {
  const cmd = (day: number, time: string, lampOn: boolean | null = null) => deskCommand({ day }, { clock: { beat: "work", time }, lampOn });
  it("the hour clamped, the lamp by default from 18:00 and the player's choice, the rain from the stages table", () => {
    expect(cmd(1, "09:03")).toEqual({ target: "nt-room", day: 1, time: 9.05, face: 0, spot: "desk", lamp: false, ceil: false, rain: weatherOf(1) === "rain", outer: false, eaten: false, far: 0 });
    expect(cmd(1, "05:10").time).toBe(6);
    expect(cmd(1, "18:30").lamp).toBe(true);
    expect(cmd(1, "18:30", false).lamp).toBe(false);
    expect(cmd(1, "10:00", true).lamp).toBe(true);
    expect(cmd(4, "10:00").rain).toBe(true);
    expect(cmd(10, "10:00").rain).toBe(false);
    expect(cmd(30, "10:00").day).toBe(18);
  });
  it("objects / prints / chick only when they change; objects again with a new day; pause true on hide, false on show", () => {
    const desk = (over: Partial<RoomWant> = {}): RoomWant => ({ mode: "desk", main: cmd(2, "10:00"), objects: ["chick"], prints: false, chick: "idle-1", ...over });
    const a = roomPosts(NOTHING_POSTED, desk());
    expect(a.posts).toEqual([cmd(2, "10:00"), { target: "nt-room", objects: ["chick"] }, { target: "nt-room", prints: false }, { target: "nt-room", chick: "idle-1" }]);
    expect(a.locate).toBe(true);
    // nothing changed: nothing
    const b = roomPosts(a.next, desk());
    expect(b.posts).toEqual([]);
    expect(b.locate).toBe(false);
    // the chick's face only
    const c = roomPosts(b.next, desk({ chick: "idle-2" }));
    expect(c.posts).toEqual([{ target: "nt-room", chick: "idle-2" }]);
    expect(c.locate).toBe(false);
    // a print on the desk: posted, and the things located again
    const d = roomPosts(c.next, desk({ chick: "idle-2", prints: true }));
    expect(d.posts).toEqual([{ target: "nt-room", prints: true }]);
    expect(d.locate).toBe(true);
    // a later hour: the command alone (same day)
    const e = roomPosts(d.next, desk({ chick: "idle-2", prints: true, main: cmd(2, "11:00") }));
    expect(e.posts).toEqual([cmd(2, "11:00")]);
    // a new day: the command and the objects again, even unchanged
    const f = roomPosts(e.next, desk({ chick: "idle-2", prints: true, main: cmd(3, "09:00") }));
    expect(f.posts).toEqual([cmd(3, "09:00"), { target: "nt-room", objects: ["chick"] }]);
    // hidden: paused, once
    const g = roomPosts(f.next, { mode: "hidden", main: null, objects: [], prints: false, chick: "" });
    expect(g.posts).toEqual([{ target: "nt-room", pause: true }]);
    expect(roomPosts(g.next, { mode: "hidden", main: null, objects: [], prints: false, chick: "" }).posts).toEqual([]);
    // shown again: unpaused first
    const h = roomPosts(g.next, desk({ chick: "idle-2", prints: true, main: cmd(3, "09:00") }));
    expect(h.posts).toEqual([{ target: "nt-room", pause: false }]);
  });
  it("where → stage px; moving → ask again; not a where → null", () => {
    expect(rectsFromWhere({ rects: { "screen-left": [0.25, 0.1, 0.2, 0.3], chick: null }, moving: false })).toEqual({ "screen-left": { l: 400, t: 90, w: 320, h: 270 }, chick: null });
    expect(rectsFromWhere({ rects: {}, moving: true })).toBe("moving");
    expect(rectsFromWhere({})).toBeNull();
    expect(LOCATE_IDS).toEqual(expect.arrayContaining(["screen-left", "screen-right", "deskphone", "prints", "lamp", "mug", "chick", "phone"]));
  });
  it("picks are blocked while something is open over the view, not by the look-out or the flash", () => {
    const s = initialSession(DEFAULT_CLOCK, "left", "desk");
    expect(pickBlocked(s, 0)).toBe(false);
    expect(pickBlocked({ ...s, dialogue: push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } }) }, 0)).toBe(true);
    expect(pickBlocked({ ...s, settingsOpen: true }, 0)).toBe(true);
    expect(pickBlocked({ ...s, holding: "chick" }, 0)).toBe(true);
  });
});

describe("R1 · the shared frame: when it is made", () => {
  it("not on the title page; on the first lying render (the settle); on 桌子 or the look-out failing that; never twice", () => {
    expect(renderTitle(initialTitle(null, EMPTY_COLLECTION)).value).not.toContain("room3d");
    const s = initialSession(DEFAULT_CLOCK, "left", "room");
    settleRoomFrame(s, 3);
    expect(s.roomFrame).toBeNull();
    s.view = "lying";
    settleRoomFrame(s, 3);
    expect(s.roomFrame).toEqual({ day: 3 });
    settleRoomFrame(s, 4);
    expect(s.roomFrame).toEqual({ day: 3 });
    const d = initialSession(DEFAULT_CLOCK, "left", "desk");
    settleRoomFrame(d, 5);
    expect(d.roomFrame).toEqual({ day: 5 });
    const photo = { ...initialSession(DEFAULT_CLOCK, "left", "desk"), deskPhoto: true };
    settleRoomFrame(photo, 5);
    expect(photo.roomFrame).toBeNull();
  });
});

function rig(day: number, view: Session["view"] = "desk", clock: BeatClock = DEFAULT_CLOCK) {
  const store = storeAt(day);
  let now = 1000;
  const timers: { at: number; fn: () => void }[] = [];
  const session = initialSession(clock, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs: now }).value;
  const advance = (ms: number) => {
    const to = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at);
      const next = timers[0];
      if (!next || next.at > to) break;
      timers.shift();
      now = Math.max(now, next.at);
      next.fn();
    }
    now = to;
  };
  return { store, session, ctx, room, advance };
}

describe("R2 · 桌子 is the frame; desk=photo is the old tabletop", () => {
  it("the frame instead of the photo's things; the marks at the room's rectangles; the back strip", () => {
    const r = rig(2);
    settleRoomFrame(r.session, 2);
    expect(desk3dOn(r.session)).toBe(true);
    r.session.roomRects = { "screen-left": { l: 400, t: 90, w: 320, h: 270 }, deskphone: { l: 10, t: 20, w: 30, h: 40 }, chick: null };
    const out = r.room();
    expect(out).toContain('class="outside-host room desk" data-host="desk"');
    expect(out).toContain('src="/room3d/index.html?embed=1&amp;day=2"');
    expect(out).not.toContain("desk-things");
    expect(out).not.toContain('class="shot-hit monitor-hit"');
    expect(out).toContain('<i class="room-mark screen-left" data-action="view" data-view="desktop" data-screen="left" style="left:400px;top:90px;width:320px;height:270px" aria-hidden="true"></i>');
    expect(out).toContain('class="room-mark deskphone" data-action="loop-phone"');
    expect(out).toContain('<div class="desk3d-back" aria-hidden="true"></div>');
    // the frame is hidden — not removed — on another view
    r.session.view = "room";
    expect(r.room()).toContain('class="outside-host room hidden" data-host="hidden"');
  });
  it("desk=photo (or the fallback): the photo 桌子 with its tabletop and hits", () => {
    const r = rig(2);
    r.session.deskPhoto = true;
    settleRoomFrame(r.session, 2);
    const out = r.room();
    expect(out).toContain("desk-things");
    expect(out).toContain('class="shot-hit monitor-hit"');
    expect(out).not.toContain("outside-host");
  });
});

describe("R3 / R4 / R6 · the DOM layer on 桌子", () => {
  const setup = (day = 2) => {
    const r = rig(day);
    settleRoomFrame(r.session, day);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const posted: unknown[] = [];
    const win = { postMessage: (m: unknown) => void posted.push(m) } as unknown as Window;
    const paint = () => {
      // happy-dom loads no frames: the host without its src, a stand-in window (the same across renders, as a kept frame's is)
      root.innerHTML = r.room().replace(/ src="[^"]*"/g, "");
      const f = root.querySelector<HTMLIFrameElement>('iframe[data-keep="room3d:room"]');
      if (f) Object.defineProperty(f, "contentWindow", { get: () => win, configurable: true });
    };
    const calls: [string, Record<string, string | undefined>][] = [];
    const spy = (name: string): ActionHandler => (_c, data) => void calls.push([name, { ...data }]);
    const actions: Record<string, ActionHandler> = Object.fromEntries(["view", "loop-hold", "loop-phone", "prints-open", "lamp", "tower-power", "desk-slip"].map((n) => [n, spy(n)]));
    const layer = createRoom3dLayer(onRoomMessage)(root, r.ctx, actions);
    const from = (data: object) => window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", ...data }, source: win as unknown as MessageEventSource }));
    paint();
    layer.after();
    const done = () => {
      layer.destroy();
      root.remove();
    };
    return { ...r, root, posted, paint, layer, from, calls, done };
  };

  it("nothing before ready; on ready the command, the things and a locate; the where becomes roomRects", () => {
    const r = setup();
    expect(r.posted).toEqual([]);
    r.from({ type: "pick", id: "screen-left" });
    expect(r.calls).toEqual([]);
    r.from({ type: "ready" });
    const state = r.store.getState();
    expect(r.posted).toEqual([
      deskCommand(state, r.session),
      { target: "nt-room", objects: [...state.found] },
      { target: "nt-room", prints: printsOnDesk(state.day, r.store.getEvents()).length > 0 },
      expect.objectContaining({ target: "nt-room", chick: expect.any(String) }),
      { target: "nt-room", locate: [...LOCATE_IDS] },
    ]);
    expect(r.root.querySelector("iframe.room3d")!.classList.contains("ready")).toBe(true);
    // still moving: asked again after 700 ms
    r.from({ type: "where", rects: {}, face: 0, spot: "desk", moving: true });
    expect(r.session.roomRects).toBeNull();
    const n = r.posted.length;
    r.advance(LOCATE_RETRY_MS);
    expect(r.posted.slice(n)).toEqual([{ target: "nt-room", locate: [...LOCATE_IDS] }]);
    r.from({ type: "where", rects: { "screen-right": [0.5, 0.5, 0.1, 0.1], tower: null }, face: 0, spot: "desk", moving: false });
    expect(r.session.roomRects).toEqual({ "screen-right": { l: 800, t: 450, w: 160, h: 90 }, tower: null });
    // a render with nothing changed posts nothing
    const m = r.posted.length;
    r.paint();
    r.layer.after();
    expect(r.posted.length).toBe(m);
    // the lamp clicked: the new lamp state goes
    r.session.lampOn = true;
    r.paint();
    r.layer.after();
    expect(r.posted.slice(m)).toEqual([expect.objectContaining({ lamp: true, face: 0, spot: "desk" })]);
    // off 桌子: paused
    r.session.view = "room";
    r.paint();
    r.layer.after();
    expect(r.posted.at(-1)).toEqual({ target: "nt-room", pause: true });
    r.done();
  });

  it("a pick runs the old hit's action through the controller's map; ignored while something is open", () => {
    const r = setup();
    r.from({ type: "ready" });
    r.from({ type: "pick", id: "screen-left", face: 0, spot: "desk" });
    r.from({ type: "pick", id: "deskphone" });
    r.from({ type: "pick", id: "mug" });
    r.from({ type: "pick", id: "bed" });
    r.from({ type: "pick", id: null });
    expect(r.calls).toEqual([
      ["view", { view: "desktop", screen: "left" }],
      ["loop-phone", {}],
    ]);
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    r.from({ type: "pick", id: "screen-right" });
    expect(r.calls).toHaveLength(2);
    r.done();
  });

  it("no ready 8 s after 桌子 showed it: the photo 桌子 for the run, one warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = setup();
    r.advance(ROOM_READY_NET_MS - 1);
    expect(r.session.deskPhoto).toBe(false);
    r.advance(1);
    expect(r.session.deskPhoto).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    r.paint();
    r.layer.after();
    expect(r.root.innerHTML).toContain("desk-things");
    warn.mockRestore();
    r.done();
  });

  it("ready in time: no fallback", () => {
    const r = setup();
    r.from({ type: "ready" });
    r.advance(ROOM_READY_NET_MS * 2);
    expect(r.session.deskPhoto).toBe(false);
    r.done();
  });
});
