// author 2026-11-27 (#106): 「时间改回 22:40 吧」 — day 3's evening had no clock: the dinner came at
// 18:40, the hour-long call and the v18 work left the time where it was, and 老王's answer had been
// moved to 19:05 so that it could show at all. The evening's clock runs now: the call connects half
// an hour after 「好的。」 and ends its length later; the night task is done by 22:30; what is sent
// that late is answered a quarter of an hour on. 老王 answers at 22:40, in two messages.
import { describe, expect, it } from "vitest";
import zh from "@content/replies/day-03.json";
import en from "@content/replies/en/day-03.json";
import { dayFile } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { callAnswerTime, callConnectTime, callEndTime, callPhase } from "@world/loop/call";
import { syncLoop } from "@world/loop/runtime";

const step = (name: string, t: string) => ({ kind: "step" as const, name, t });
const EVENING = [step("boot", "09:03"), { kind: "order", meal: "dinner", shopId: "huangmenji", itemId: "hmj", t: "17:40" }, step("delivery:arrives:dinner", "18:40"), { kind: "pickup", meal: "dinner" }];

function clockAfter(events: readonly object[]): string {
  const store = createStore({ startDay: 3 });
  for (const e of events) store.appendEvent(e as never);
  const session = initialSession(DEFAULT_CLOCK, "left", "room");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
  syncLoop(ctx, 1000);
  return session.clock.time;
}

describe("day 3's evening keeps time", () => {
  const call = dayFile(3)!.call!;
  it("the call starts from when it was answered: the dinner came at 18:40", () => {
    const log = [...EVENING, { kind: "callAnswer" }].map((e) => ({ ...e, day: 3 })) as never[];
    expect(callAnswerTime(call, log, 3)).toBe("18:40");
    expect(callConnectTime(call, log, 3)).toBe("19:10");
    expect(callEndTime(call, log, 3)).toBe("20:10");
    // nothing timed before the answer: the ask's own time
    expect(callConnectTime(call, [], 3)).toBe("18:30");
  });
  it("the ask waits for the dinner to be taken in, though the order already moved the clock past 18:00", () => {
    expect(call.afterPickup).toBe("dinner");
    const ordered = [{ kind: "order", meal: "dinner", shopId: "huangmenji", itemId: "hmj", t: "18:00", day: 3 }] as never[];
    expect(callPhase(call, ordered, 3, "18:20", false)).toBe("before");
    expect(callPhase(call, [...ordered, { kind: "pickup", meal: "dinner", day: 3 }] as never[], 3, "18:40", false)).toBe("ask");
  });
  it("the call over: 20:10; v18 sent: 22:30, and the clock goes on to his answer", () => {
    const ended = [...EVENING, { kind: "callAnswer" }, { kind: "callEnded" }];
    expect(clockAfter(ended)).toBe("20:10");
    const done = [...ended, { kind: "task", flag: "task_d3_3", mode: "self" }];
    expect(clockAfter(done)).toBe("22:30");
    expect(clockAfter([...done, { kind: "give", deliverableId: "d3-theory", t: "22:30" }])).toBe("22:45");
  });
  it("老王 answers at 22:40, in two messages, in both languages", () => {
    for (const file of [zh, en]) {
      const lines = file.recipients.boss.incoming;
      expect(lines.map((l) => l.t)).toEqual(["22:40", "22:41"]);
      for (const l of lines) expect(l.cond_show).toEqual({ has: "sent_d3-theory" });
    }
    expect(zh.recipients.boss.incoming.map((l) => l.text)).toEqual(["收到。", "这版肯定没问题，18，数字吉利。"]);
  });
});
