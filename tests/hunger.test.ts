// 饱食度 (author 2026-11-20): +meal on eating, -work on a task handed in, -sleep on lying down; too hungry
// to work (a line, nothing opens) and too hungry to sleep (the bed's hungry word); the status card's bar
// and the number floating off the status tile. Days 1–3 as she asked: one guided, one plain, one with
// the call's cold dinner.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { afterEat, afterSleep, afterWork, dayHasMeals, hungerNumbers, tooHungryToSleep, tooHungryToWork } from "@state/hunger";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { workBar, workHold } from "@world/desktop/workbench/work-mode";
import { t } from "@world/i18n";
import { showing } from "@world/loop/dialogue";
import { loopActions } from "@world/room/game";
import { hudTiles, statusPanel } from "@world/room/status";
import { completeUntil } from "./complete-items";

const H = hungerNumbers();

describe("the numbers", () => {
  it("a fresh run wakes at the variable's default, below what work needs; a meal, a task and a night move it within 0–100", () => {
    const s0 = createStore({ startDay: 1 }).getState();
    expect(s0.fullness).toBe(10);
    expect(tooHungryToWork(s0)).toBe(true);
    const fed = afterEat(s0);
    expect(fed.fullness).toBe(10 + H.meal);
    expect(afterWork(fed, "self").fullness).toBe(10 + H.meal - H.work);
    expect(afterWork(fed, "auto").fullness).toBe(fed.fullness); // a task that ticked itself costs nothing
    expect(afterSleep({ ...s0, fullness: 70 }).fullness).toBe(H.wake); // every morning wakes at 10
    expect(afterEat({ ...s0, fullness: 90 }).fullness).toBe(100);
  });
  it("days without a delivery never hold the player hungry", () => {
    expect(dayHasMeals(1)).toBe(true);
    expect(dayHasMeals(16)).toBe(false);
    expect(tooHungryToWork({ day: 16, fullness: 0 })).toBe(false);
    expect(tooHungryToSleep({ day: 16, fullness: 0 })).toBe(false);
  });
  it("the log drives it: day 1 lunch → work → dinner → sleep wakes day 2 at 10 (too hungry to work until lunch)", () => {
    const store = createStore({ startDay: 1 });
    completeUntil(store, "task3");
    expect(store.getState().fullness).toBe(10 + H.meal); // lunch eaten
    completeUntil(store, "dinner");
    expect(store.getState().fullness).toBe(10 + H.meal - H.work); // v17 handed in
    completeUntil(store, "bed");
    expect(store.getState().fullness).toBe(10 + H.meal - H.work + H.meal); // dinner eaten
    store.appendEvent({ kind: "lieDown" });
    expect(store.getState().day).toBe(2);
    expect(store.getState().fullness).toBe(H.wake); // 10: every morning
    expect(tooHungryToWork(store.getState())).toBe(true);
  });
});

describe("the holds", () => {
  const rig = (day: number, fullness: number) => {
    const store = createStore({ startDay: day, patch: { fullness } as never });
    const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
    return { store, session, ctx };
  };
  it("開始工作 is held while too hungry or while a meal is on its way; a started game is never held", () => {
    const { store, session } = rig(2, 10);
    expect(workHold(store.getState(), session)).toBe("hungry");
    const fed = rig(2, 80);
    expect(workHold(fed.store.getState(), fed.session)).toBeNull();
    fed.session.loop = { day: 2, items: new Map(), seen: 0, orders: new Map([["lunch", { atMs: 0, workDone: 0, waitMs: 60_000 }]]), selfScheduled: new Set(), timers: new Set() };
    expect(workHold(fed.store.getState(), fed.session)).toBe("waiting");
    completeUntil(fed.store, "task1");
    expect(workBar(fed.store.getState(), fed.store.getEvents(), fed.session)).toMatchObject({ label: "work.start", enabled: false });
    fed.session.loop = null;
    expect(workBar(fed.store.getState(), fed.store.getEvents(), fed.session)).toMatchObject({ label: "work.start", enabled: true });
  });
  it("the line: the protagonist's on day 1, Kuro's after; nothing opens", () => {
    // day 1: the work opens only after lunch, so hunger itself never holds it; a meal on its way does (the protagonist's word)
    const one = rig(1, 10);
    completeUntil(one.store, "task3");
    one.session.view = "desktop";
    one.session.dialogue = { queue: [], line: 0 };
    one.session.loop = { day: 1, items: new Map(), seen: 0, orders: new Map([["dinner", { atMs: 0, workDone: 0, waitMs: 60_000 }]]), selfScheduled: new Set(), timers: new Set() };
    loopActions["work-start"]!(one.ctx, {} as DOMStringMap, null as never);
    expect(showing(one.session.dialogue, one.store.getState(), one.store.getEvents())?.line?.t).toBe(t("hunger.wait.me"));
    expect(one.session.workShow).toBeNull();
    // day 4: the work opens after lunch (2026-11-25, as days 1–3); a stomach still under needWork
    // there (lunch's +40 from -30) holds it with Kuro's line
    const two = rig(4, -30);
    completeUntil(two.store, "task1");
    two.session.dialogue = { queue: [], line: 0 };
    loopActions["work-start"]!(two.ctx, {} as DOMStringMap, null as never);
    const l = showing(two.session.dialogue, two.store.getState(), two.store.getEvents())?.line;
    expect(l?.t).toBe(t("hunger.work.kuro"));
    expect(l?.who).toBe("kuro");
  });
  it("the bed: below needSleep with a meal still to come, the hungry word", () => {
    const { store, session, ctx } = rig(2, 10);
    completeUntil(store, "bed", { all: true, skip: ["dinner", "dpick", "deat", "bed"] }); // dinner still to come
    session.view = "room";
    loopActions["bed"]!(ctx, {} as DOMStringMap, null as never);
    expect(showing(session.dialogue, store.getState(), store.getEvents())?.line?.t).toBe(t("room.bed.hungry.kuro"));
  });
});

describe("the card and the tile", () => {
  it("the status card has the bar; the number floats off the tile only while the card is closed and the clock runs", () => {
    const store = createStore({ startDay: 1 });
    const session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), statusOpen: true };
    // game-menu (2026-11-25): ten cells, one lit at 10, marked hungry with its word
    expect(statusPanel(store.getState(), [], session)!.value).toContain(`<span class="st-k">${t("status.fullness")}</span><span class="st-bar full hungry"><i class="f"></i><i class=""></i>`);
    expect(statusPanel(store.getState(), [], session)!.value).toContain(`<span class="st-v warn">10<em>${t("status.hungry")}</em></span>`);
    const s = { ...initialSession(DEFAULT_CLOCK, "left", "room"), fullnessFloat: { delta: 40, at: 1000 } };
    expect(hudTiles(s, store.getState(), { settings: true, nowMs: 1500 }).value).toContain('<i class="st-float" data-at="1000">+40</i>');
    expect(hudTiles(s, store.getState(), { settings: true, nowMs: 9000 }).value).not.toContain("st-float");
    expect(hudTiles({ ...s, statusOpen: true }, store.getState(), { settings: true, nowMs: 1500 }).value).not.toContain("st-float");
    expect(hudTiles(s, store.getState(), { settings: true }).value).not.toContain("st-float");
  });
});
