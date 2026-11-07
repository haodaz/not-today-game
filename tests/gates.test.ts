// gates (2026-11-07, the author's rule): a thing that cannot be used here or now never opens its own
// layer: one line, no view change, nothing silent. R1 the bed with work left, R2 the camera's second
// shot and the empty pack, R3 使用 (and the desk's object bar) where the object does not work, R4 the
// black screens, 关机 too early, and the 道具 button before anything is found.
import { describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { completeUntil } from "./complete-items";

function rig(store: Store, view: Session["view"], clock: BeatClock = DEFAULT_CLOCK) {
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: () => {}, now: () => 1_000 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
  const lines = () => ctx.session.dialogue.queue.flatMap((q) => q.lines.map((l) => l.t));
  return { ctx, session: ctx.session, act, room, lines };
}
const atDay = (day: number, found: readonly string[] = []) => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  for (const id of found) store.appendEvent({ kind: "openLayer", objectId: id });
  return store;
};
const useAts = (store: Store) => store.getEvents().filter((e) => e.kind === "useAt").map((e) => [e.objectId, e.facing, e.ok]);

describe("R1 · the bed after nightfall with work left", () => {
  it("says room.bed.locked from where the player stands; no lying down", () => {
    const store = atDay(1);
    completeUntil(store, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    for (const view of ["bed", "room"] as const) {
      const r = rig(store, view, { beat: "desk", time: "18:30" });
      r.act("bed");
      expect(r.session.view, view).toBe(view);
      expect(r.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:bed:locked"]);
      expect(r.lines()).toEqual([t("room.bed.locked")]);
    }
  });
});

describe("R2 · the shutter in hand", () => {
  it("a room photo already taken today: camera.usedToday, no viewfinder", () => {
    const store = atDay(2, ["camera"]);
    store.appendEvent({ kind: "photo", at: "room:room", t: "10:00" });
    const r = rig(store, "room");
    r.act("loop-hold", { object: "camera" });
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("obj-use");
    r.act("obj-key", { object: "camera", key: "shutter" });
    expect(r.session.viewfinder).toBe(false);
    expect(r.session.view).toBe("room");
    expect(r.lines()).toEqual([t("camera.usedToday")]);
  });

  it("the pack at 0: the program's camera.empty, no viewfinder", () => {
    const store = atDay(2, ["camera"]);
    for (let i = 0; i < 10; i++) store.appendEvent({ kind: "photo", at: "room:room", t: "10:00" });
    store.appendEvent({ kind: "lieDown" });
    const r = rig(store, "room");
    r.act("loop-hold", { object: "camera" });
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("obj-use");
    r.act("obj-key", { object: "camera", key: "shutter" });
    expect(r.session.viewfinder).toBe(false);
    expect(r.lines()).toContain(t("camera.empty"));
  });
});

describe("R3 · 使用 where the object does not work", () => {
  it("the IC card in 房间 without the lamp: the line, the device is not entered, useAt ok:false logged", () => {
    const store = atDay(4, ["iccard"]);
    const r = rig(store, "room");
    r.session.lampOn = false;
    r.act("loop-hold", { object: "iccard" });
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("obj-use");
    expect(r.session.hand.using).toBe(false);
    expect(r.session.holding).toBe("iccard");
    expect(r.session.view).toBe("room");
    expect(r.lines()).toEqual([t("obj.works.nolamp")]);
    expect(useAts(store).at(-1)).toEqual(["iccard", "room", false]);
    // Where it works, 使用 as before.
    r.session.lampOn = true;
    r.act("obj-use");
    expect(r.session.hand.using).toBe(true);
  });

  it("the desk's object bar: objbar.notYet, the modal does not open; useAt ok:false logged", () => {
    const store = atDay(4, ["iccard"]);
    const r = rig(store, "desktop", { beat: "work", time: "10:00" });
    r.session.lampOn = false;
    r.act("objbar-open", { object: "iccard" });
    expect(r.session.objbarOpen).toBe(false);
    expect(r.session.holding).toBeNull();
    expect(r.session.hand.using).toBe(false);
    expect(r.lines()).toEqual([t("objbar.notYet")]);
    expect(useAts(store).at(-1)).toEqual(["iccard", "room", false]);
  });
});

describe("R4 · nothing silent", () => {
  it("屏幕 before boot: room.screen.off on every click (not twice for one)", () => {
    const r = rig(atDay(1), "room");
    r.act("view", { view: "desktop" });
    r.act("view", { view: "desktop" });
    expect(r.session.view).toBe("room");
    expect(r.lines()).toEqual([t("room.screen.off")]);
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("view", { view: "desktop" });
    expect(r.lines()).toEqual([t("room.screen.off")]);
  });

  it("关机 before its beat is open: room.shutdown.notyet, every click; nothing logged", () => {
    const store = atDay(1);
    completeUntil(store, "msgs");
    const r = rig(store, "desktop", { beat: "work", time: "10:00" });
    const events = store.getEvents().length;
    r.act("desktop-shutdown");
    expect(r.lines()).toEqual([t("room.shutdown.notyet")]);
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("desktop-shutdown");
    expect(r.lines()).toEqual([t("room.shutdown.notyet")]);
    expect(store.getEvents()).toHaveLength(events);
    expect(r.session.view).toBe("desktop");
  });

  it("the 道具 button is absent while nothing is found; after the first object it shows", () => {
    const store = atDay(1);
    const r = rig(store, "room");
    expect(r.room()).not.toContain('data-action="items-toggle"');
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    expect(r.room()).toContain('data-action="items-toggle"');
  });
});
