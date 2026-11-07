// box-arrival (2026-11-07): R1/R2 no carton before day 1's pickup (the box-less stills, no box
// hotspots), R4 day 1's box beat is the arrival scene at the pickup and its end opens the case, R5
// the player's 「我把箱子放在了床边。」 after the chick's arrival line turns the view to 房间.
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { lineBoxModel } from "@world/dialogue/box";
import { backdropFor, BACKDROPS } from "@world/fit";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { recogniseTable } from "@state/recognise";
import { boxArrived, NOBOX_STILLS } from "@world/room/arrival";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { completeUntil } from "./complete-items";

function rig(store: Store, view: Session["view"]) {
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
  const shown = () => lineBoxModel(store.getState(), store.getEvents(), ctx.session);
  return { ctx, session: ctx.session, act, room, shown };
}
const keys = (s: Session) => s.dialogue.queue.map((q) => q.key);
const stageClass = (markup: string) => /<div class="(stage room [^"]*)"/.exec(markup)![1]!.split(" ");
/** Day 1 up to the lunch at the door (not taken in yet). */
function beforePickup(): Store {
  const store = createStore({ startDay: 1 });
  completeUntil(store, "pickup");
  expect(store.getEvents().some((e) => e.kind === "pickup")).toBe(false);
  return store;
}
const pickup = (store: Store) => store.appendEvent({ kind: "pickup", meal: "lunch" });

/** Whether 房间 / 床 show the carton: the stage class, the hotspots, the fit backdrop. */
function carton(store: Store) {
  const arrived = boxArrived(store.getState(), store.getEvents());
  const room = rig(store, "room").room();
  const bed = rig(store, "bed").room();
  return {
    nobox: [stageClass(room).includes("nobox"), stageClass(bed).includes("nobox")],
    hits: [room.includes('data-action="pick-box"'), bed.includes('data-action="bed-box"')],
    backdrops: [backdropFor("room", arrived), backdropFor("bed", arrived)],
  };
}

describe("R1 / R2 · no box before it arrives", () => {
  it("day 1 before the pickup: the box-less stills, no pick-box / bed-box; after it, as before", () => {
    const store = beforePickup();
    expect(carton(store)).toEqual({ nobox: [true, true], hits: [false, false], backdrops: [NOBOX_STILLS.room, NOBOX_STILLS.bed] });
    expect(NOBOX_STILLS).toEqual({ room: "/room/shots/room_nobox.jpg", bed: "/room/shots/bed_nobox.jpg" });
    // The other walls and the desk are untouched.
    for (const v of ["door", "window", "desk"] as const) expect(backdropFor(v, false)).toBe(BACKDROPS[v]);
    // The desk bar (the 道具 strip) has no box at all.
    const strip = rig(store, "room");
    strip.session.itemsOpen = true;
    expect(strip.room()).not.toMatch(/data-action="(pick-box|bed-box)"/);
    // The box click does nothing before it.
    strip.session.itemsOpen = false;
    strip.act("pick-box");
    expect(strip.session.caseOpen).toBe(false);
    pickup(store);
    expect(carton(store)).toEqual({ nobox: [false, false], hits: [true, true], backdrops: [BACKDROPS.room, BACKDROPS.bed] });
  });

  it("a reload keeps each state (it is read from the log); day 2's morning shows the box", () => {
    const store = beforePickup();
    const reloaded = createStore({ startDay: 1, events: store.getEvents() as never });
    expect(carton(reloaded).hits).toEqual([false, false]);
    pickup(store);
    const after = createStore({ startDay: 1, events: store.getEvents() as never });
    expect(carton(after).hits).toEqual([true, true]);
    expect(carton(createStore({ startDay: 2 }))).toEqual({ nobox: [false, false], hits: [true, true], backdrops: [BACKDROPS.room, BACKDROPS.bed] });
  });

  it("the title's room is the box-less one (before any day 1)", () => {
    expect(BACKDROPS.title).toBe(NOBOX_STILLS.room);
  });
});

describe("R4 · day 1: the arrival scene at the pickup", () => {
  /** The pickup with the loop watching; the queue keeps only the scene's pieces. */
  const scene = () => {
    const store = beforePickup();
    const r = rig(store, "door");
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    pickup(store);
    syncLoop(r.ctx, 0);
    return { store, r };
  };

  it("the pickup queues day 1's box beat (its pieces in order, the last ending in the case)", () => {
    const { r } = scene();
    const pieces = r.session.dialogue.queue.filter((q) => q.key.replace(/#\d+$/, "") === "d1:beat:box");
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.flatMap((q) => q.lines.map((l) => l.t))).toEqual(dayFiles.get(1)!.beats.box!.say.map((l) => l.t));
    expect(pieces.at(-1)!.ending).toEqual({ kind: "openCase" });
    // Its pictures are the content's.
    expect(pieces.flatMap((q) => q.lines.map((l) => l.backdrop).filter(Boolean))).toContain("/room/dream/door.jpg");
  });

  it("advancing past its last line opens the case (at 窗); opening the loose box on day 1 queues no box beat", () => {
    const { store, r } = scene();
    r.session.dialogue = { queue: r.session.dialogue.queue.filter((q) => q.key.startsWith("d1:beat:box")), line: 0 };
    const n = dayFiles.get(1)!.beats.box!.say.length;
    for (let i = 0; i < n; i++) {
      expect(r.session.caseOpen, `line ${i}`).toBe(false);
      r.act("loop-advance");
    }
    expect(r.session.caseOpen).toBe(true);
    expect(r.session.view).toBe("window");
    expect(r.room()).toContain('class="case-layer"');
    // The loose box (the case's own flow): openLayer, the chick held, its question; no box beat.
    r.session.caseOpen = false;
    r.act("loop-box");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "openLayer", objectId: "chick" });
    syncLoop(r.ctx, 0);
    expect(keys(r.session).some((k) => k.startsWith("d1:beat:box"))).toBe(false);
    expect(keys(r.session)).toContain("d1:recognise:chick");
  });

  it("day 2's openLayer still queues its box beat", () => {
    const store = createStore({ startDay: 2 });
    completeUntil(store, "box");
    const r = rig(store, "room");
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    store.appendEvent({ kind: "openLayer", objectId: "camera" });
    syncLoop(r.ctx, 0);
    expect(keys(r.session)).toContain("d2:beat:box");
  });
});

describe("R5 · 「我把箱子放在了床边。」", () => {
  const right = (id: string) => recogniseTable.get(id)!.options.findIndex((o) => o.right);
  /** An object out of its box and recognised, with the loop watching; the queue from its answer on. */
  const answered = (day: number, object: string, view: Session["view"]) => {
    const store = createStore({ startDay: day });
    const r = rig(store, view);
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    store.appendEvent({ kind: "openLayer", objectId: object });
    store.appendEvent({ kind: "recognise", objectId: object, option: right(object) });
    syncLoop(r.ctx, 0);
    const q = r.session.dialogue.queue;
    r.session.dialogue = { queue: q.slice(q.findIndex((x) => x.key === `d${day}:recognise:${object}:answer`)), line: 0 };
    return { store, r };
  };

  it("day 1: after the answer and Kuro's line, the player's line (their tag); read, the view turns to 房间", () => {
    const { r } = answered(1, "chick", "window");
    expect(keys(r.session)).toEqual(["d1:recognise:chick:answer", "d1:tutor:chick", "d1:box:placed"]);
    const placed = r.session.dialogue.queue[2]!;
    expect(placed.lines).toEqual([{ k: "speaker", who: "me", t: t("box.placed") }]);
    expect(placed.voice).toBeUndefined();
    const before = r.session.dialogue.queue.slice(0, 2).reduce((n, q) => n + q.lines.length, 0);
    for (let i = 0; i < before; i++) r.act("loop-advance");
    const m = r.shown()!;
    expect(m.text).toBe(t("box.placed"));
    expect(m.tag).toEqual({ kind: "who", text: t("who.me") });
    expect(m.playerPortrait).not.toBeNull();
    expect(r.session.view).toBe("window");
    r.act("loop-advance");
    expect(r.session.view).toBe("room");
    expect(r.session.cam).toMatchObject({ to: "room" });
  });

  it("day 2's box plays no such line", () => {
    const { r } = answered(2, "camera", "room");
    expect(keys(r.session).some((k) => k.endsWith(":box:placed"))).toBe(false);
  });
});
