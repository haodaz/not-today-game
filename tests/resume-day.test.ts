// author 2026-11-27: 「每次重新进入还是回到躺着的状态」 — a reload mid-day came back lying in bed at
// 09:03 though the player was up and lunch was on its way. The first look after a reload resumes the
// day as its events left it (runtime.ts resumeDay).
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { syncLoop } from "@world/loop/runtime";

const step = (name: string, t = "09:03") => ({ kind: "step" as const, name, t });

/** A fresh mount over the saved log, as the game makes it on a reload. */
function reload(events: readonly object[], day = 1) {
  const store = createStore({ startDay: day });
  for (const e of events) store.appendEvent(e as never);
  const session = initialSession(DEFAULT_CLOCK, "left", "lying");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
  syncLoop(ctx, 1000);
  return session;
}

describe("a reload resumes the day", () => {
  it("up, booted, lunch ordered: standing in the room, the clock not before the order", () => {
    const s = reload([step("rise"), step("boot"), step("openApp:msgs", "09:05"), { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" }]);
    expect(s.view).toBe("room");
    expect(s.clock.time >= "11:30").toBe(true);
    expect(s.clock.beat).not.toBe("boot"); // the messages were opened: the work beat
  });

  it("a meal ordered before the reload still arrives: its look is set on the first look", () => {
    const store = createStore({ startDay: 1 });
    for (const e of [step("rise"), step("boot"), step("openApp:msgs", "09:05"), { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" }]) store.appendEvent(e as never);
    const timers: { ms: number; fn: () => void }[] = [];
    const session = initialSession(DEFAULT_CLOCK, "left", "lying");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }) };
    syncLoop(ctx, 1000);
    expect(session.loop!.timers.has("lunch")).toBe(true); // before the fix: no look was set, the countdown stopped at 00:00
    const order = session.loop!.orders.get("lunch")!;
    syncLoop(ctx, order.atMs + order.waitMs + 1); // the look's time has come (the store does not re-enter here)
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "delivery:arrives:lunch")).toBe(true);
  });

  it("nothing done yet today: still lying in bed at 09:03", () => {
    const s = reload([]);
    expect(s.view).toBe("lying");
    expect(s.clock).toEqual(DEFAULT_CLOCK);
  });

  it("a dev view or clock given on the URL is kept", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent(step("rise") as never);
    const session = initialSession({ beat: "night", time: "23:00" }, "left", "desk");
    syncLoop({ store, session, rerender: () => {}, later: () => {} }, 1000);
    expect(session.view).toBe("desk");
    expect(session.clock).toEqual({ beat: "night", time: "23:00" });
  });
});
