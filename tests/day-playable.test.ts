// "A whole day playable" (Claude's headless day-1 walkthrough, 2026-11-02): the blockers it found.
// Lunch arrives at the minimum once work is done; `?fast=1` makes delivery minutes seconds; Space /
// Enter read the box on 屏幕 too, never while typing; 屏幕 before boot says so once a day; the
// overdue count left the room HUD; the workbench home's title is the app's name alone.
import "./specimen";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { desktopApps } from "@world/desktop/apps";
import { buildShell, initialSession, type Session } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import { t } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";
import { arrivalDue, deliveryUnitMs, FAST_MINUTE, MINUTE, msUntilDue, msUntilMinimum } from "@world/loop/waiting";
import { loopActions, loopKeys, typingIn } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

const step = (name: string, at = "09:03"): EventDraft => ({ kind: "step", name, t: at });
const orderLunch: EventDraft = { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" };
const arrived = (store: Store) => store.getEvents().some((e) => e.kind === "step" && e.name === "delivery:arrives:lunch");

describe("1. lunch arrives at the minimum once a work item is done (checkArrivals)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T09:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  const minutes = (n: number) => n * MINUTE;

  function ctxFor(store: Store): ActionContext {
    // Timers are the runtime's own (they call syncLoop with the clock's now).
    return { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: (ms, fn) => void setTimeout(fn, ms) };
  }

  it("order at t0, work done at t0 + 30 s: arrival at t0 + 2 min, not at t0 + 6 min", () => {
    const { minMinutes, waitMinutes } = dayFiles.get(1)!.delivery;
    expect([minMinutes, waitMinutes]).toEqual([2, 6]);
    const store = createStore({ startDay: 1 });
    store.appendEvent(step("boot"));
    store.appendEvent(step("openApp:msgs"));
    const ctx = ctxFor(store);
    syncLoop(ctx);
    // t0: the order; the long look is set for 6 minutes.
    store.appendEvent(orderLunch);
    syncLoop(ctx);
    vi.advanceTimersByTime(30_000);
    // t0 + 30 s: a work item is done after the order.
    store.appendEvent({ kind: "task", flag: "task_v17_done", mode: "look" });
    syncLoop(ctx);
    expect(arrived(store)).toBe(false);
    vi.advanceTimersByTime(minutes(minMinutes) - 30_000 - 1_000);
    expect(arrived(store)).toBe(false);
    // Just past the minimum (the look is at least 250 ms out).
    vi.advanceTimersByTime(1_000 + 300);
    expect(arrived(store)).toBe(true);
    // Well before the six minutes that used to be the only look.
    expect(Date.now() - new Date("2026-11-02T09:00:00Z").getTime()).toBeLessThan(minutes(waitMinutes));
  });

  it("with no work done it still comes at the long wait", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent(step("boot"));
    store.appendEvent(step("openApp:msgs"));
    const ctx = ctxFor(store);
    syncLoop(ctx);
    store.appendEvent(orderLunch);
    syncLoop(ctx);
    vi.advanceTimersByTime(minutes(6) - 1_000);
    expect(arrived(store)).toBe(false);
    vi.advanceTimersByTime(1_300);
    expect(arrived(store)).toBe(true);
  });
});

describe("2. ?fast=1: delivery minutes count as seconds (dev builds only)", () => {
  it("the multiplier: 1 000 ms with ?fast=1 in a dev build, 60 000 otherwise", () => {
    expect(deliveryUnitMs("?day=1&fast=1", true)).toBe(FAST_MINUTE);
    expect(FAST_MINUTE).toBe(1_000);
    expect(deliveryUnitMs("?fast=1", false)).toBe(MINUTE);
    expect(deliveryUnitMs("?day=1", true)).toBe(MINUTE);
    expect(deliveryUnitMs("?fast=0", true)).toBe(MINUTE);
    expect(MINUTE).toBe(60_000);
  });
  it("nothing else changes: the same rule, in seconds", () => {
    const w = { minMinutes: 2, waitMinutes: 6, unitMs: FAST_MINUTE };
    expect(arrivalDue({ ...w, elapsedMs: 1_999, workDoneSinceOrder: true })).toBe(false);
    expect(arrivalDue({ ...w, elapsedMs: 2_000, workDoneSinceOrder: true })).toBe(true);
    expect(arrivalDue({ ...w, elapsedMs: 5_999, workDoneSinceOrder: false })).toBe(false);
    expect(arrivalDue({ ...w, elapsedMs: 6_000, workDoneSinceOrder: false })).toBe(true);
    expect(msUntilDue({ ...w, elapsedMs: 1_000 })).toBe(5_000);
    expect(msUntilMinimum({ ...w, elapsedMs: 500 })).toBe(1_500);
    // Without the param the units are minutes, as before.
    expect(msUntilDue({ minMinutes: 2, waitMinutes: 6, elapsedMs: 0 })).toBe(6 * MINUTE);
    expect(initialSession(DEFAULT_CLOCK).deliveryUnitMs).toBe(MINUTE);
  });
});

describe("3. Space / Enter read the box on 屏幕 too; never while typing", () => {
  const ctxAt = (view: Session["view"]) => {
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {} };
    ctx.session.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "one" }, { k: "narration", t: "two" }], ending: { kind: "none" } }], line: 0 };
    return ctx;
  };
  it("on 屏幕 a Space or Enter reads on", () => {
    for (const key of [" ", "Enter"]) {
      const ctx = ctxAt("desktop");
      expect(loopKeys(ctx, { key, target: document_like("BUTTON") } as unknown as KeyboardEvent), key).toBe(true);
      expect(ctx.session.dialogue.line, key).toBe(1);
    }
  });
  it("in an input, a textarea or anything contenteditable it does not", () => {
    for (const target of [document_like("INPUT"), document_like("TEXTAREA"), document_like("DIV", true)]) {
      const ctx = ctxAt("desktop");
      expect(loopKeys(ctx, { key: " ", target } as unknown as KeyboardEvent)).toBe(false);
      expect(ctx.session.dialogue.line).toBe(0);
      expect(typingIn(target)).toBe(true);
    }
    expect(typingIn(document_like("BUTTON"))).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});
/** A stand-in for a focused element (no DOM in this file). */
function document_like(tagName: string, editable = false): EventTarget {
  return { tagName, isContentEditable: editable, getAttribute: (n: string) => (n === "contenteditable" && editable ? "true" : null) } as unknown as EventTarget;
}

describe("4. 屏幕 before boot: the monitors are black, it does not open, one line says so (once a day)", () => {
  it("left and right; the line once a day; after the tower it opens", () => {
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "desk"), rerender: () => {}, later: () => {} };
    for (const screen of ["left", "right"]) loopActions.view!(ctx, { view: "desktop", screen } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("desk");
    expect(ctx.session.dialogue.queue).toEqual([{ key: "d1:screen:off", lines: [{ k: "narration", t: t("room.screen.off") }], ending: { kind: "none" } }]);
    expect(store.getEvents()).toEqual([]);
    // The next day says it again, once.
    store.appendEvent({ kind: "lieDown" });
    ctx.session.dialogue = { queue: [], line: 0 };
    loopActions.view!(ctx, { view: "desktop", screen: "left" } as DOMStringMap, null as never);
    loopActions.view!(ctx, { view: "desktop", screen: "left" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d2:screen:off"]);
    loopActions["tower-power"]!(ctx, {} as DOMStringMap, null as never);
    loopActions.view!(ctx, { view: "desktop", screen: "right" } as DOMStringMap, null as never);
    expect([ctx.session.view, ctx.session.focus]).toEqual(["desktop", "right"]);
  });
  it("the string is there in both languages", () => {
    expect(t("room.screen.off")).not.toBe("room.screen.off");
  });
});

describe("5. the overdue count left the room HUD (it stays on 工作台's 账本 tile)", () => {
  it("no overdue span on the day line, any day", () => {
    for (const day of [1, 9, 18]) {
      const store = createStore({ startDay: day });
      const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "room") }).value;
      expect(out, `day ${day}`).not.toContain('class="ov"');
      expect(out).not.toContain(t("hud.overdue", { n: store.getState().overdueDays }));
    }
  });
});

describe("7. the workbench home's title is the app's name alone", () => {
  const title = (page: Session["workbenchPage"]) => {
    const store = createStore({ startDay: 1 });
    store.appendEvent(step("boot"));
    // 工作台 is on the left monitor by default (tingtalk 2026-11-04).
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workbenchPage = page;
    const out = renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps)).value;
    return /<span class="brand">[^<]*<\/span><span>([^<]*)<\/span>/.exec(out)![1];
  };
  it("home: 工作台; the other pages: 工作台 · <page>", () => {
    expect(title("home")).toBe(t("dock.workbench"));
    expect(title("home")).not.toContain("·");
    for (const [page, key] of [["docs", "wb.nav.docs"], ["ledger", "wb.nav.ledger"], ["code", "wb.nav.code"]] as const) expect(title(page)).toBe(`${t("dock.workbench")} · ${t(key)}`);
  });
});
