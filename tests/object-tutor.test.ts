// object-tutor (2026-11-07): R1 Kuro's arrival line after an object is recognised on its day (once a
// run, from the log); R2 night 5's bed question offers the recorder; R4 the cannot-use line answers
// a key press too.
import { describe, expect, it } from "vitest";
import { handOf } from "@state/hands";
import { recogniseTable } from "@state/recognise";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { lineBoxModel } from "@world/dialogue/box";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, push, showing } from "@world/loop/dialogue";
import { syncLoop, tutorQueued } from "@world/loop/runtime";
import { loopActions, recordOffered } from "@world/room/game";
import { completeUntil } from "./complete-items";

const NIGHT: BeatClock = { beat: "night", time: "23:41" };

function rig(store: Store, view: Session["view"], clock: BeatClock = DEFAULT_CLOCK) {
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const shown = () => lineBoxModel(store.getState(), store.getEvents(), ctx.session);
  return { ctx, session: ctx.session, act, shown };
}
const keys = (s: Session) => s.dialogue.queue.map((q) => q.key);
const rightOption = (id: string) => recogniseTable.get(id)!.options.findIndex((o) => o.right);

describe("R1 · the arrival line", () => {
  /** Day 1: the chick out of the box and recognised, with the loop watching. */
  const recogniseChick = () => {
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room");
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    syncLoop(r.ctx, 0);
    store.appendEvent({ kind: "recognise", objectId: "chick", option: rightOption("chick") });
    syncLoop(r.ctx, 0);
    return { store, r };
  };

  it("day 1: after the chick's question and its answer, Kuro's two lines, voice kuro, once", () => {
    const { r } = recogniseChick();
    const k = keys(r.session);
    const at = k.indexOf("d1:recognise:chick:answer");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(k[at + 1]).toBe("d1:tutor:chick");
    const tutor = r.session.dialogue.queue[at + 1]!;
    expect(tutor.voice).toBe("kuro");
    expect(tutor.lines).toEqual([
      { k: "speaker", who: "kuro", t: t("kuro.tutor.chick") },
      { k: "speaker", who: "kuro", t: t("kuro.tutor.chick.2") },
    ]);
    expect(k.filter((x) => x === "d1:tutor:chick")).toHaveLength(1);
    // Read up to it: Kuro's tag and portrait.
    r.session.dialogue = { queue: [tutor], line: 0 };
    const m = r.shown()!;
    expect(m.text).toBe(t("kuro.tutor.chick"));
    expect(m.tag).toMatchObject({ kind: "kuro" });
    expect(m.portrait).not.toBeNull();
  });

  it("a reload does not queue it again; a new run does", () => {
    const { store } = recogniseChick();
    const reload = rig(store, "room");
    syncLoop(reload.ctx, 0);
    store.appendEvent({ kind: "step", name: "boot", t: "09:00" });
    syncLoop(reload.ctx, 0);
    expect(keys(reload.session)).not.toContain("d1:tutor:chick");
    const again = recogniseChick();
    expect(keys(again.r.session)).toContain("d1:tutor:chick");
  });

  it("an object with one line has one; a missing string queues nothing", () => {
    expect(tutorQueued(5, "tape")!.lines).toEqual([{ k: "speaker", who: "kuro", t: t("kuro.tutor.tape") }]);
    expect(tutorQueued(1, "no-such-object")).toBeNull();
    expect(push(EMPTY_DIALOGUE, { key: "x", lines: [], ending: { kind: "none" } })).toBe(EMPTY_DIALOGUE);
  });
});

describe("R2 · night 5: 打开录音机", () => {
  /** Day `day` with the tape out of the box (on day 5) and known, the bed open. */
  const night = (day: number) => {
    const store = createStore({ startDay: Math.min(day, 5) });
    if (day >= 5) {
      store.appendEvent({ kind: "openLayer", objectId: "tape" });
      store.appendEvent({ kind: "recognise", objectId: "tape", option: rightOption("tape") });
    }
    while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
    completeUntil(store, "bed", { all: true });
    const r = rig(store, "bed", NIGHT);
    return { store, r };
  };
  // The ask's options as the dialogue offers them (the box itself waits for the move onto the bed).
  const offered = (r: ReturnType<typeof rig>) => showing(r.session.dialogue, r.ctx.store.getState(), r.ctx.store.getEvents())!.choices!;
  const choices = (r: ReturnType<typeof rig>) => offered(r).map((c) => c.choice);

  it("day 5: 睡 / 打开录音机 / 再待会儿; days 4 and 6: two", () => {
    const five = night(5);
    five.r.act("bed");
    expect(keys(five.r.session)).toEqual(["d5:bed:ask"]);
    expect(choices(five.r)).toEqual(["sleep", "record", "stay"]);
    expect(offered(five.r).map((c) => t(c.labelKey!))).toEqual([t("room.bed.sleep"), t("room.bed.record"), t("room.bed.stay")]);
    for (const day of [4, 6]) {
      const n = night(day);
      n.r.act("bed");
      expect(choices(n.r), `day ${day}`).toEqual(["sleep", "stay"]);
    }
  });

  it("打开录音机: the walkman in use at 床; put down, asked again (with it); after REC, without it", () => {
    const { store, r } = night(5);
    r.act("bed");
    r.act("loop-choice", { choice: "record" });
    expect(r.session.view).toBe("bed");
    expect(r.session.holding).toBe("tape");
    expect(r.session.hand.using).toBe(true);
    expect(keys(r.session)).toEqual([]);
    // Put down without recording: asked again from the bed, the recorder still offered.
    r.act("loop-put-down");
    expect(r.session.holding).toBeNull();
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual(["d5:bed:ask"]);
    expect(choices(r)).toEqual(["sleep", "record", "stay"]);
    // Again, and REC this time: one `record` event; put down, asked without the recorder.
    r.act("loop-choice", { choice: "record" });
    r.act("obj-key", { object: "tape", key: "rec" });
    expect(store.getEvents().filter((e) => e.kind === "record")).toHaveLength(1);
    r.act("loop-put-down");
    expect(r.session.view).toBe("lying");
    expect(choices(r)).toEqual(["sleep", "stay"]);
  });

  it("not offered without the tape found; a stale 打开录音机 on a two-choice question does nothing", () => {
    const five = night(5);
    const state = five.store.getState();
    expect(recordOffered(state, five.store.getEvents())).toBe(true);
    expect(recordOffered({ ...state, found: (state.found as string[]).filter((x) => x !== "tape") } as typeof state, five.store.getEvents())).toBe(false);
    const n = night(6);
    n.r.act("bed");
    expect(choices(n.r)).toEqual(["sleep", "stay"]);
    n.r.act("loop-choice", { choice: "record" });
    expect(n.r.session.holding).toBeNull();
    expect(keys(n.r.session)).toEqual(["d6:bed:ask"]);
  });
});

describe("R4 · the cannot-use line answers a key press", () => {
  it("the IC card in 房间: lamp off, entering use says it, a key says it once more (not twice); lamp on, nothing", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "openLayer", objectId: "iccard" });
    store.appendEvent({ kind: "recognise", objectId: "iccard", option: rightOption("iccard") });
    const r = rig(store, "room");
    r.session.lampOn = false;
    const line = t(handOf("iccard").works!.line);
    const lines = () => r.session.dialogue.queue.flatMap((q) => q.lines.map((l) => l.t));
    r.act("loop-hold", { object: "iccard" });
    r.act("obj-use");
    expect(lines()).toEqual([line]);
    r.session.dialogue = EMPTY_DIALOGUE;
    // The card has no keys of its own: 翻面 is its one press in 使用.
    expect(handOf("iccard").keys).toEqual([]);
    const press = () => r.act("obj-flip");
    press();
    expect(lines()).toEqual([line]);
    // Still turned over (the flip is not refused).
    expect(r.session.hand.face).toBe("back");
    r.session.dialogue = EMPTY_DIALOGUE;
    press();
    expect(lines()).toEqual([]);
    // The lamp on: it works; the press says nothing.
    r.session.lampOn = true;
    press();
    expect(lines()).toEqual([]);
    // Off again: a change, so the next failing press is answered again.
    r.session.lampOn = false;
    press();
    expect(lines()).toEqual([line]);
  });
});
