// wait-card (author 2026-11-20): a meal on its way is its own card under the checklist — 外卖在路上 and a
// countdown of the order's own roll (between the day's minMinutes and waitMinutes), never a line of the list.
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import { t } from "@world/i18n";
import { checklist, loopContext } from "@world/loop/checklist";
import { freshMemo, rollWaitMs } from "@world/loop/runtime";
import { countdownText, waitCard } from "@world/room/hud";

const step = (name: string, at = "09:03") => ({ kind: "step" as const, name, t: at });

describe("the roll", () => {
  it("stays between the day's minMinutes and waitMinutes, in delivery units", () => {
    const d = dayFiles.get(1)!.delivery;
    expect(rollWaitMs(d, 1000, () => 0)).toBe(d.minMinutes * 1000);
    expect(rollWaitMs(d, 1000, () => 1)).toBe(d.waitMinutes * 1000);
    expect(rollWaitMs(d, 60_000, () => 0.5)).toBe(Math.round((d.minMinutes + (d.waitMinutes - d.minMinutes) / 2) * 60_000));
  });
  it("an order placed before a reload rolls its own wait too", () => {
    const store = createStore({ startDay: 1 });
    for (const e of [step("rise"), step("boot"), step("openApp:msgs"), { kind: "reply" as const, choice: "fine", recipient: "boss", t: "09:05" }, { kind: "order" as const, meal: "lunch" as const, shopId: "huangmenji", itemId: "hmj", t: "11:30" }]) store.appendEvent(e);
    const memo = freshMemo(loopContext(store.getState(), store.getEvents())!, store.getEvents(), 5000, 1000);
    const o = memo.orders.get("lunch")!;
    expect(o.atMs).toBe(5000);
    expect(o.waitMs).toBeGreaterThanOrEqual(1000);
    expect(o.waitMs).toBeLessThanOrEqual(2000);
  });
});

describe("the card", () => {
  it("mm:ss, floored at zero", () => {
    expect(countdownText(92_000)).toBe("01:32");
    expect(countdownText(400)).toBe("00:01");
    expect(countdownText(-5)).toBe("00:00");
  });
  it("shows while a meal is on its way, with the generic text and the countdown; gone once it arrives", () => {
    const store = createStore({ startDay: 1 });
    for (const e of [step("rise"), step("boot"), step("openApp:msgs"), { kind: "reply" as const, choice: "fine", recipient: "boss", t: "09:05" }, { kind: "order" as const, meal: "lunch" as const, shopId: "huangmenji", itemId: "hmj", t: "11:30" }]) store.appendEvent(e);
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.loop = freshMemo(loopContext(store.getState(), store.getEvents())!, store.getEvents(), 10_000, 1000);
    session.loop.orders.set("lunch", { atMs: 10_000, workDone: 0, waitMs: 90_000 });
    const view = checklist(loopContext(store.getState(), store.getEvents())!);
    expect(view.waiting).toBe(true);
    expect(view.lines.some((l) => l.state === "wait")).toBe(false);
    const out = waitCard(view, session, 40_000)!.value;
    // author 2026-11-25 (#77): with nothing else current, what to do meanwhile — no 前往 on it
    expect(out).toContain(`<div class="it now idle"><i class="mark" aria-hidden="true">▸</i><span class="txt">${t("checklist.waitIdle")}</span></div>`);
    expect(out).not.toContain("go-item");
    expect(out).toContain(`<span>${t("checklist.wait.text")}</span><b class="count">01:00</b>`);
    expect(waitCard(view, session, 0)!.value).not.toContain("count"); // no clock given: the text alone
    store.appendEvent(step("delivery:arrives:lunch", "12:04"));
    const after = checklist(loopContext(store.getState(), store.getEvents())!);
    expect(after.waiting).toBe(false);
    expect(waitCard(after, session, 40_000)).toBeNull();
  });
});
