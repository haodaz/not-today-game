import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { missingKeys, resetMissing, t } from "@world/i18n";
import { checklist, loopContext } from "@world/loop/checklist";
import { EMPTY_DIALOGUE, showing } from "@world/loop/dialogue";
import { freshMemo, react, SELF_TICK_MS, syncLoop } from "@world/loop/runtime";
import { boxObjectFor, heartRate, HEART_RATE_FROM_DAY, renderChecklist, renderRoom } from "@world/room/hud";
import { loopActions, renderGame } from "@world/room/game";

const step = (name: string, t = "09:03"): EventDraft => ({ kind: "step", name, t });
const orderLunch: EventDraft = { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" };

function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: day });
  for (const d of drafts) store.appendEvent(d);
  return store;
}
const list = (store: Store) => renderChecklist(checklist(loopContext(store.getState(), store.getEvents())!)).value;

/** A context whose timers are collected, not run, and whose sounds are recorded. */
function fakeCtx(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "room")) {
  const timers: { ms: number; fn: () => void }[] = [];
  const sounds: string[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), play: (id) => void sounds.push(id) };
  return { ctx, timers, sounds };
}

describe("FR5 checklist snapshots", () => {
  it("day 1 at boot", () => {
    expect(list(storeAt(1))).toMatchSnapshot();
  });

  it("day 1 after ordering lunch", () => {
    expect(list(storeAt(1, [step("boot"), step("openApp:msgs"), { kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }, orderLunch]))).toMatchSnapshot();
  });

  it("day 1 after lunch arrives", () => {
    const out = list(storeAt(1, [step("boot"), step("openApp:msgs"), { kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }, orderLunch, step("delivery:arrives:lunch", "12:04")]));
    // Item text is content's (day-loop rule 2026-11-01): read from the day file.
    expect(out).toContain(dayFiles.get(1)!.items.find((it) => it.id === "pickup")!.text);
    expect(out).toMatchSnapshot();
  });

  it("day 17 with the item that ticked itself", () => {
    const self = dayFiles.get(17)!.items.find((it) => it.self)!;
    const store = storeAt(17, [step("boot"), step("openApp:msgs")]);
    // playtest-1105 R7: it is a work task (`flag:task_*`), so it is counted on the one work line.
    const before = list(store);
    const work = /data-id="work"><i><\/i>[^<]*（(\d+)\/(\d+)）/;
    expect(before).not.toContain(self.text);
    const [, d0] = work.exec(before)!;
    store.appendEvent({ kind: "task", flag: (self.done as { flag: string }).flag, mode: "self" });
    const after = list(store);
    expect(after).not.toContain(self.text);
    expect(Number(work.exec(after)![1])).toBe(Number(d0) + 1);
    // Same style as an ordinary item: no highlight for a self-ticked one.
    expect(after).not.toMatch(/self|highlight/);
    expect({ before, after }).toMatchSnapshot();
  });

  it("day 18 at its last item", () => {
    const store = storeAt(18, [
      step("boot"),
      step("openApp:msgs"),
      { kind: "task", flag: "task_d18_seen", mode: "look" },
      { kind: "openLayer", objectId: boxObjectFor(18)! },
      { kind: "reply", choice: "fine", recipient: "boss", t: "10:00" },
      step("beat:desk"),
      step("beat:shutdown"),
      step("chat:any"),
    ]);
    const view = checklist(loopContext(store.getState(), store.getEvents())!);
    expect(view.lines.map((l) => l.id)).toEqual(["bed"]);
    expect(view.bedOpen).toBe(true);
    expect(renderChecklist(view).value).toMatchSnapshot();
  });
});

describe("room HUD (FR6)", () => {
  it("day 1: checklist, day and overdue, desk bar, cameras, menu; no heart rate", () => {
    const store = storeAt(1);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
    expect(out).not.toContain('class="hr"');
    expect(out).toContain('data-action="view" data-view="desktop"');
    expect(out).toMatchSnapshot();
  });

  it(`the heart-rate chip appears from day ${HEART_RATE_FROM_DAY} and rises as SAN falls; SAN is never shown`, () => {
    const store = storeAt(HEART_RATE_FROM_DAY);
    const out = renderRoom({ state: store.getState(), events: [], session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
    expect(out).toContain('class="hr"');
    expect(out).not.toContain(`>${store.getState().san}<`);
    expect(heartRate(constants.sanStart)).toBe(72);
    expect(heartRate(50)).toBeGreaterThan(heartRate(80));
    expect(out).toMatchSnapshot();
  });

  it("objects taken out sit on the desk bar in found order, as cutouts", () => {
    const store = storeAt(4, [{ kind: "openLayer", objectId: "pager" }, { kind: "openLayer", objectId: "chick" }]);
    // The desk bar is 桌子's object layer (four camera levels).
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "desk") }).value;
    expect(out.indexOf('data-object="pager"')).toBeLessThan(out.indexOf('data-object="chick"'));
    expect(out).toContain('src="/objects/pager_white.png"');
  });

  it("the game opens in the room; 桌面 switches to one monitor; a 房间 chip goes back", () => {
    const store = storeAt(1);
    const { ctx } = fakeCtx(store);
    expect(renderGame(store, ctx.session, 0).value).toContain('class="stage room');
    // Not on yet (2026-11-02): 屏幕 does not open; one line says so, and nothing counts.
    loopActions.view!(ctx, { view: "desktop" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:screen:off"]);
    expect(store.getEvents()).toEqual([]);
    // Once the tower is pressed, 屏幕 is one monitor with the way back, and opening it counts as
    // looking at what is in front: 工作台 on the left (tingtalk 2026-11-04); 听听 on the right is 看一眼消息.
    loopActions["tower-power"]!(ctx, {} as DOMStringMap, null as never);
    loopActions.view!(ctx, { view: "desktop" } as DOMStringMap, null as never);
    const desk = renderGame(store, ctx.session, 0).value;
    expect(desk.match(/class="monitor/g)).toHaveLength(1);
    // guidance R15: 回房间 is the dock's left tile now (no floating button).
    expect(desk).not.toContain('class="back-room"');
    expect(desk).toContain('class="app nav room-tile" data-action="view" data-view="room"');
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "openApp:workbench" });
    loopActions.screen!(ctx, { screen: "right" } as DOMStringMap, null as never);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "openApp:msgs" });
  });

  it("only these HUD strings are missing (TODO for Claude)", () => {
    resetMissing();
    for (const day of dayFiles.keys()) {
      const store = storeAt(day);
      renderRoom({ state: store.getState(), events: [], session: initialSession(DEFAULT_CLOCK, "left", "room") });
    }
    expect(missingKeys()).toEqual([]);
    resetMissing();
  });
});

describe("runtime (design L5/L6)", () => {
  it("waking plays the boot beat (playtest-1105 R3); the tower's boot sets the morning clock and says its two lines", () => {
    const store = storeAt(1);
    const { ctx } = fakeCtx(store);
    syncLoop(ctx, 0);
    // The day starts in the room: its boot beat, before the player does anything.
    // lying-view R1: day 1's boot opens with Kuro's lines, so it is split into pieces (`#n`), in order.
    expect([...new Set(ctx.session.dialogue.queue.map((q) => q.key.replace(/#\d+$/, "")))]).toEqual(["d1:beat:boot"]);
    expect(showing(ctx.session.dialogue, store.getState())!.line!.t).toBe(dayFiles.get(1)!.beats.boot!.say[0]!.t);
    ctx.session.dialogue = EMPTY_DIALOGUE;
    store.appendEvent(step("boot", "09:03"));
    syncLoop(ctx, 0);
    expect(ctx.session.dialogue.queue[0]!.lines).toEqual([
      { k: "narration", t: t("room.boot.on") },
      { k: "inner", t: t("room.boot.hint") },
    ]);
    expect(ctx.session.clock).toEqual(DEFAULT_CLOCK);
    // Not again on a later first look (a reload once the tower is on).
    const again = fakeCtx(store).ctx;
    syncLoop(again, 0);
    expect(again.session.dialogue.queue).toEqual([]);
  });

  it("an unlock with a sound plays it and queues its onUnlock lines", () => {
    const store = storeAt(1, [step("boot"), step("openApp:msgs"), { kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }, orderLunch]);
    const lc = loopContext(store.getState(), store.getEvents())!;
    const memo = freshMemo(lc, store.getEvents(), 0);
    store.appendEvent(step("delivery:arrives:lunch", "12:04"));
    const fx = react(memo, loopContext(store.getState(), store.getEvents())!, store.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] });
    expect(fx.sounds).toEqual(["doorbell"]);
    expect(fx.dialogue.queue.map((q) => q.key)).toContain("d1:pickup:onUnlock");
  });

  it("shutdown queues the beat with its choices; the loan item opens its prompt", () => {
    // Night 5 has no hand any more (author 2026-11-06): its shutdown beat is plain lines.
    const shutdownOn = (day: number) => {
      const store = storeAt(day);
      const memo = freshMemo(loopContext(store.getState(), store.getEvents())!, store.getEvents(), 0);
      store.appendEvent(step("beat:shutdown", "23:00"));
      return react(memo, loopContext(store.getState(), store.getEvents())!, store.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] });
    };
    const five = shutdownOn(5);
    expect(five.dialogue.queue.find((q) => q.key === "d5:beat:shutdown")!.ending).toEqual({ kind: "none" });
    expect(five.clock.beat).toBe("night");
    // A hand night with content choices (day 10): the beat ends in them.
    const ten = shutdownOn(10);
    expect(ten.dialogue.queue.find((q) => q.key === "d10:beat:shutdown")!.ending).toEqual({ kind: "beatChoices", day: 10, beat: "shutdown" });
  });

  it("delivery arrives after the minimum once the next work item is done", () => {
    const store = storeAt(1, [step("boot"), step("openApp:msgs")]);
    const { ctx } = fakeCtx(store);
    syncLoop(ctx, 0);
    store.appendEvent(orderLunch);
    syncLoop(ctx, 0);
    store.appendEvent({ kind: "task", flag: "task_v17_done", mode: "look" });
    syncLoop(ctx, 30_000);
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "delivery:arrives:lunch")).toBe(false);
    syncLoop(ctx, dayFiles.get(1)!.delivery.minMinutes * 60_000);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "delivery:arrives:lunch" });
    expect(ctx.session.clock.time >= "12:00").toBe(true);
  });

  it("a self-ticking item ticks itself after a moment", () => {
    const store = storeAt(17, [step("boot")]);
    const { ctx, timers } = fakeCtx(store);
    syncLoop(ctx, 0);
    store.appendEvent(step("openApp:msgs"));
    syncLoop(ctx, 0);
    const tick = timers.find((x) => x.ms === SELF_TICK_MS)!;
    tick.fn();
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "task", mode: "auto" });
  });

  it("lying down plays the night first, then appends lieDown; the next day starts in the room", () => {
    const store = storeAt(1);
    const { ctx } = fakeCtx(store);
    syncLoop(ctx, 0);
    ctx.session.dialogue = EMPTY_DIALOGUE;
    // The bed in 房间 before night falls: it only says so (day-loop addition 2026-11-02).
    loopActions["bed"]!(ctx, {} as DOMStringMap, null as never);
    expect(store.getState().day).toBe(1);
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:bed:notyet"]);
    const night = dayFiles.get(1)!.beats.night!.say.length;
    ctx.session.dialogue = { queue: [{ key: "n", lines: dayFiles.get(1)!.beats.night!.say, ending: { kind: "lieDown" } }], line: 0 };
    for (let i = 0; i < night; i++) loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    expect(store.getState().day).toBe(2);
    syncLoop(ctx, 0);
    // lying-view R3: the next day starts lying in bed (the ceiling).
    expect(ctx.session.view).toBe("lying");
    expect(ctx.session.clock).toEqual(DEFAULT_CLOCK);
  });
});
