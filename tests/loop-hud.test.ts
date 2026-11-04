import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { missingKeys, resetMissing } from "@world/i18n";
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
    expect(list(storeAt(1, [step("boot"), step("openApp:msgs"), orderLunch]))).toMatchSnapshot();
  });

  it("day 1 after lunch arrives", () => {
    const out = list(storeAt(1, [step("boot"), step("openApp:msgs"), orderLunch, step("delivery:arrives:lunch", "12:04")]));
    // Item text is content's (day-loop rule 2026-11-01): read from the day file.
    expect(out).toContain(dayFiles.get(1)!.items.find((it) => it.id === "pickup")!.text);
    expect(out).toMatchSnapshot();
  });

  it("day 17 with the item that ticked itself", () => {
    const self = dayFiles.get(17)!.items.find((it) => it.self)!;
    const store = storeAt(17, [step("boot"), step("openApp:msgs")]);
    const before = list(store);
    expect(before).toContain(self.text);
    store.appendEvent({ kind: "task", flag: (self.done as { flag: string }).flag, mode: "self" });
    const after = list(store);
    expect(after).not.toContain(self.text);
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
    expect(desk).toContain('class="back-room"');
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
  it("boot plays the boot beat and sets the morning clock; nothing old is replayed on load", () => {
    const store = storeAt(1);
    const { ctx } = fakeCtx(store);
    syncLoop(ctx, 0);
    expect(ctx.session.dialogue.queue).toHaveLength(0);
    store.appendEvent(step("boot", "09:03"));
    syncLoop(ctx, 0);
    const shown = showing(ctx.session.dialogue, store.getState())!;
    expect(shown.line!.t).toBe(dayFiles.get(1)!.beats.boot!.say[0]!.t);
    expect(ctx.session.clock).toEqual(DEFAULT_CLOCK);
  });

  it("an unlock with a sound plays it and queues its onUnlock lines", () => {
    const store = storeAt(1, [step("boot"), step("openApp:msgs"), orderLunch]);
    const lc = loopContext(store.getState(), store.getEvents())!;
    const memo = freshMemo(lc, store.getEvents(), 0);
    store.appendEvent(step("delivery:arrives:lunch", "12:04"));
    const fx = react(memo, loopContext(store.getState(), store.getEvents())!, store.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] });
    expect(fx.sounds).toEqual(["doorbell"]);
    expect(fx.dialogue.queue.map((q) => q.key)).toContain("d1:pickup:onUnlock");
  });

  it("shutdown queues the beat with its choices; the loan item opens its prompt", () => {
    const d5 = storeAt(5);
    const memo = freshMemo(loopContext(d5.getState(), d5.getEvents())!, d5.getEvents(), 0);
    d5.appendEvent(step("beat:shutdown", "23:00"));
    const fx = react(memo, loopContext(d5.getState(), d5.getEvents())!, d5.getEvents(), { dialogue: EMPTY_DIALOGUE, clock: DEFAULT_CLOCK, sounds: [] });
    expect(fx.dialogue.queue.find((q) => q.key === "d5:beat:shutdown")!.ending).toEqual({ kind: "beatChoices", day: 5, beat: "shutdown" });
    expect(fx.clock.beat).toBe("night");
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
    expect(ctx.session.view).toBe("room");
    expect(ctx.session.clock).toEqual(DEFAULT_CLOCK);
  });
});
