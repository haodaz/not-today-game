// @vitest-environment happy-dom
// room-3d-room: on the frame days (the rings `wall`, `room`, and `door`'s first two days: 10–17) the
// four facings are the shared room frame in the day beats; nights, days 1–9 and 18, `lying` and
// `table` stay photographs. The predicate, the markup, the posts and the picks.
import { describe, expect, it } from "vitest";
import { ringOf } from "@state/stages";
import { createStore, type Store } from "@state/store";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext, ActionHandler } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { faceCommand, FACE_LOCATE_IDS, frameDay, room3dOn, roomPick, settleRoomFrame } from "@world/room/desk3d";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { createRoom3dLayer } from "@world/room/outside";
import { onRoomMessage } from "@world/room/wake";

setLocale("zh");

const DAY_BEAT: BeatClock = { beat: "work", time: "14:00" };
function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function rig(day: number, view: Session["view"] = "room", clock: BeatClock = DAY_BEAT) {
  const store = storeAt(day);
  let now = 1000;
  const timers: { at: number; fn: () => void }[] = [];
  const session = initialSession(clock, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
  const room = () => {
    settleRoomFrame(session, store.getState().day);
    return renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs: now }).value;
  };
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
const FACINGS = ["room", "window", "door", "bed"] as const;
const BEATS = ["boot", "work", "afternoon", "desk"] as const;

describe("R1 · room3dOn", () => {
  const on = (day: number, view: Session["view"], patch: Partial<Session> = {}, beat: BeatClock["beat"] = "work") => {
    const s = Object.assign(initialSession({ beat, time: "14:00" }, "left", view), { roomFrame: { day } }, patch);
    return room3dOn(day, s);
  };
  it("true on days 10–17 for the four facings in the day beats", () => {
    for (let day = 10; day <= 17; day++) for (const view of FACINGS) for (const beat of BEATS) expect(on(day, view, {}, beat), `day ${day} ${view} ${beat}`).toBe(true);
  });
  it("false on days 1–9 and 18, at night, on lying / table / desk, with deskPhoto or no WebGL, in a scene, during a cut, before the frame exists", () => {
    for (let day = 1; day <= 9; day++) expect(on(day, "room"), `day ${day}`).toBe(false);
    expect(on(18, "room")).toBe(false);
    expect(on(12, "room", {}, "night")).toBe(false);
    for (const view of ["lying", "table", "desk", "desktop"] as const) expect(on(12, view), view).toBe(false);
    expect(on(12, "room", { deskPhoto: true })).toBe(false); // ?desk=photo, or the 8 s net failed
    expect(on(12, "room", { noWebGL: true })).toBe(false);
    expect(on(12, "room", { dialogue: push(EMPTY_DIALOGUE, { key: "d", lines: [{ k: "inner", t: "x", backdrop: "/dream/x.jpg" } as never], ending: { kind: "none" } }) })).toBe(false);
    expect(on(12, "room", { cut: { beat: "b", video: "v", poster: "p", key: "k", at: 0 } })).toBe(false);
    expect(on(12, "room", { roomFrame: null })).toBe(false);
  });
  it("property: never true for any day or view while the day's ring is before `wall`", () => {
    const RINGS = ["software", "screen", "desk", "wall", "room", "door"];
    for (let day = 1; day <= 18; day++) {
      const before = RINGS.indexOf(ringOf(day)) < RINGS.indexOf("wall");
      for (const view of [...FACINGS, "desk", "lying", "table", "desktop"] as const)
        for (const beat of [...BEATS, "night"] as const) if (before) expect(on(day, view, {}, beat), `day ${day} ${view} ${beat}`).toBe(false);
    }
    expect([...Array(18)].map((_, i) => frameDay(i + 1))).toEqual([...Array(18)].map((_, i) => i + 1 >= 10 && i + 1 <= 17));
  });
});

describe("R2 / R4 · the markup", () => {
  it("a frame view: the room host and frame-on; no .fx, no .window-light, no .evening-look, no photo hot areas", () => {
    for (const view of FACINGS) {
      const out = rig(12, view, { beat: "desk", time: "19:00" }).room();
      expect(out, view).toContain('class="outside-host room face" data-host="face"');
      expect(out, view).toMatch(/class="stage room [a-z]+-view[^"]* frame-on/);
      for (const off of ['class="fx"', "window-light", "evening-look", "shot-hit", "look-hit", "door-spot", "figures", "shelf-book"]) expect(out, `${view}: ${off}`).not.toContain(off);
      expect(out, view).toContain('<div class="frame-edge left" aria-hidden="true"></div>');
    }
  });
  it("day 9, day 18 and night 12 are the photographs as today", () => {
    for (const [day, clock] of [[9, DAY_BEAT], [18, DAY_BEAT], [12, { beat: "night", time: "23:00" } as BeatClock]] as const) {
      const out = rig(day, "room", clock).room();
      expect(out, `day ${day}`).toContain("shot-hit");
      expect(out, `day ${day}`).not.toContain("frame-on");
      expect(out, `day ${day}`).not.toContain('data-host="face"');
    }
  });
  it("the marks: at the room's rects, the photo hot area's own attributes and chip", () => {
    const r = rig(12, "window");
    r.session.roomRects = { window: { l: 600, t: 100, w: 300, h: 400 }, meal: { l: 100, t: 600, w: 200, h: 100 }, slit: { l: 0, t: 0, w: 10, h: 10 } };
    const out = r.room();
    expect(out).toMatch(/<i class="room-mark window" data-id="window" data-action="window-out" data-chip="[^"]+" style="left:600px;top:100px;width:300px;height:400px" aria-hidden="true"><\/i>/);
    expect(out).toContain('class="room-mark meal" data-id="meal" data-action="meal-table"');
    expect(out).not.toContain("room-mark slit");
  });
});

describe("R2 · posts", () => {
  const setup = (day: number, view: Session["view"]) => {
    const r = rig(day, view);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const posted: Record<string, unknown>[] = [];
    const win = { postMessage: (m: Record<string, unknown>) => void posted.push(m) } as unknown as Window;
    const paint = () => {
      root.innerHTML = r.room().replace(/ src="[^"]*"/g, "");
      const f = root.querySelector<HTMLIFrameElement>('iframe[data-keep="room3d:room"]');
      if (f) Object.defineProperty(f, "contentWindow", { get: () => win, configurable: true });
    };
    const calls: [string, Record<string, string | undefined>][] = [];
    const spy = (name: string): ActionHandler => (_c, data) => void calls.push([name, { ...data }]);
    const names = ["view", "tower-power", "lamp", "switch", "window-out", "room-look", "loop-door", "bed", "bed-box", "pick-box", "book-open", "meal-table", "loop-hold", "mug-ask"];
    const actions: Record<string, ActionHandler> = Object.fromEntries(names.map((n) => [n, spy(n)]));
    const layer = createRoom3dLayer(onRoomMessage)(root, r.ctx, actions);
    const from = (data: object) => window.dispatchEvent(new MessageEvent("message", { data: { source: "nt-room", ...data }, source: win as unknown as MessageEventSource }));
    const step = () => {
      paint();
      layer.after();
    };
    step();
    return { ...r, root, posted, from, calls, step, done: () => { layer.destroy(); root.remove(); } };
  };
  const main = (p: Record<string, unknown>) => "face" in p;

  it("entering 床 on day 12 posts its wall; turning to 门 posts the new face and nothing else changes; the garment when not 0", () => {
    const r = setup(12, "bed");
    r.from({ type: "ready" });
    const first = r.posted.find(main)!;
    expect(first).toEqual(faceCommand(r.store.getState(), r.session));
    expect(first).toMatchObject({ face: 1, spot: null }); // room.js FACES: 床墙 is 1 (the spec's table says 3: see design.md)
    expect(r.posted.at(-1)).toEqual({ target: "nt-room", locate: [...FACE_LOCATE_IDS] });
    const n = r.posted.length;
    r.session.view = "door";
    r.step();
    const turned = r.posted.slice(n);
    expect(turned.filter(main)).toEqual([{ ...first, face: 2 }]);
    expect(turned.filter((p) => !main(p))).toEqual([{ target: "nt-room", locate: [...FACE_LOCATE_IDS] }]);
    r.session.coat = 2;
    r.step();
    expect(r.posted.at(-1)).toEqual({ target: "nt-room", coat: 2 });
    r.done();
  });

  it("each pick runs the photo's action; an unmapped id does nothing; ignored while something is open", () => {
    const r = setup(12, "window");
    r.from({ type: "ready" });
    for (const id of ["window", "meal", "coat", "bag", "switch", "lamp", "desk", "keyboard", "screen-left", "slit", "deskphone", null]) r.from({ type: "pick", id });
    expect(r.calls).toEqual([
      ["window-out", {}],
      ["meal-table", {}],
      ["room-look", { look: "coat" }],
      ["room-look", { look: "bag" }],
      ["switch", {}],
      ["lamp", {}],
      ["view", { view: "desk" }],
      ["view", { view: "desk" }],
      ["view", { view: "desktop", screen: "left" }],
    ]);
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "x", lines: [{ k: "inner", t: "x" }], ending: { kind: "none" } });
    r.from({ type: "pick", id: "lamp" });
    expect(r.calls).toHaveLength(9);
    r.done();
  });
});

describe("R3 · roomPick, view by view, and three real actions", () => {
  const c = (view: string, doorStep: string | null = null) => ({ view, day: 12, found: ["chick"], doorStep });
  it("the map", () => {
    expect(roomPick("door", c("room"))).toEqual({ action: "view", data: { view: "door" } });
    expect(roomPick("door", c("door"))).toEqual({ action: "room-look", data: { look: "door" } });
    expect(roomPick("door", c("door", "openChain"))).toEqual({ action: "loop-door", data: { input: "openChain" } });
    expect(roomPick("box", c("bed"))).toEqual({ action: "bed-box", data: {} });
    expect(roomPick("box", c("room"))).toEqual({ action: "pick-box", data: {} });
    expect(roomPick("bed", c("room"))).toEqual({ action: "bed", data: {} });
    expect(roomPick("shelf", c("bed"))).toEqual({ action: "book-open", data: {} });
    expect(roomPick("tower", c("room"))).toEqual({ action: "tower-power", data: {} });
    expect(roomPick("window", c("room"))).toBeNull();
    expect(roomPick("chick", c("room"))).toEqual({ action: "loop-hold", data: { object: "chick" } });
    expect(roomPick("pager", c("room"))).toBeNull();
    expect(roomPick("mug", c("room"))).toEqual({ action: "mug-ask", data: {} });
    for (const id of ["slit", "deskphone", "prints", "nothing", null, 3]) expect(roomPick(id, c("room")), String(id)).toBeNull();
  });
  it("coat leaves the 换一件 ask in the box; switch toggles the ceiling light; bed asks", () => {
    const run = (id: string, view: Session["view"]) => {
      const r = rig(12, view);
      const to = roomPick(id, { view, day: 12, found: [], doorStep: null })!;
      loopActions[to.action]!(r.ctx, to.data as DOMStringMap, null as never);
      return r.session;
    };
    expect(run("coat", "door").dialogue.queue.at(-1)?.ending).toEqual({ kind: "coatAsk" });
    const s0 = rig(12, "door").session.ceilOn;
    expect(run("switch", "door").ceilOn).toBe(!s0);
    expect(run("bed", "bed").dialogue.queue.length).toBeGreaterThan(0);
  });
});
