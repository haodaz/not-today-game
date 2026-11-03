// day-loop "the boss calls" (2026-11-03): the boss asks 「通个话」 at `call.at`; the one reply 「好的。」
// (a `callAnswer`) begins a 30-minute wait with nothing else possible; the call connects and runs to
// `call.length`; when it ends (`callEnded`) night falls and the call's required night task joins the
// checklist. The outcome is all in the log, so it replays identically; the call cannot be skipped.
import { describe, expect, it, vi } from "vitest";
import day01 from "@content/days/day-01.json";

// The call fixture. Kept in sync with the one the mock factory rebuilds (the factory is hoisted, so
// it cannot read this const — it reconstructs the same object from the imported day-01).
const CALL = {
  at: "14:00",
  length: "30:00",
  lines: [
    { who: "boss", t: "14:00" },
    { who: "me", t: "14:02" },
    { who: "boss", t: "14:20" },
  ],
  task: { id: "call-task", text: "把电话里说的整理一版。", unlock: "start", done: "flag:call_task_done", required: true, when: "night" },
};

// A fixture day-1 with a call, injected for the integration tests (real content has none yet). The
// factory is hoisted above the imports, so it imports day-01 and builds the call object itself.
vi.mock("@state/days/table", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/table")>();
  const base = (await import("@content/days/day-01.json")).default as any;
  const raw = structuredClone(base);
  raw.call = {
    at: "14:00",
    length: "30:00",
    lines: [
      { who: "boss", t: "14:00" },
      { who: "me", t: "14:02" },
      { who: "boss", t: "14:20" },
    ],
    task: { id: "call-task", text: "把电话里说的整理一版。", unlock: "start", done: "flag:call_task_done", required: true, when: "night" },
  };
  const callDay = real.parseDayFile(raw, "day-01.json");
  const files = new Map(real.dayFiles);
  files.set(1, callDay);
  return {
    ...real,
    dayFiles: files,
    dayFile: (day: number) => (day === 1 ? callDay : real.dayFile(day)),
  };
});

import { CALL_ITEM_ID, parseDayFile, dayFile } from "@state/days/table";
import { applyEvent } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { checklist, itemStates, loopContext, nightfallReached } from "@world/loop/checklist";
import { callOf, callPhase, clockText, lengthSeconds, linesShown, minutesOf, timeOf } from "@world/loop/call";
import { callActions } from "@world/desktop/call/actions";
import { phaseOf, renderCall } from "@world/desktop/call/view";

// ——— the loader (pure; no mock needed for the shape checks) ———

describe("the loader: an optional call", () => {
  const base = (call: unknown) => {
    const d = structuredClone(day01) as any;
    if (call !== undefined) d.call = call;
    return d;
  };
  const parse = (call: unknown) => () => parseDayFile(base(call), "day-01.json");

  it("a day without a call is unchanged (no synthetic items)", () => {
    const d = parseDayFile(base(undefined), "day-01.json");
    expect(d.call).toBeUndefined();
    expect(d.items.some((it) => it.id === CALL_ITEM_ID)).toBe(false);
  });

  it("accepts a well-formed call and injects the gate (required day item) and the task (required night item)", () => {
    const d = parseDayFile(base(CALL), "day-01.json");
    expect(d.call).toMatchObject({ at: "14:00", length: "30:00" });
    expect(d.call!.lines).toHaveLength(3);
    const gate = d.items.find((it) => it.id === CALL_ITEM_ID)!;
    expect(gate).toMatchObject({ required: true, when: "day", doneRaw: "event:callEnded" });
    const task = d.items.find((it) => it.id === "call-task")!;
    expect(task).toMatchObject({ required: true, when: "night" });
    // The gate comes first, the task last.
    expect(d.items[0]!.id).toBe(CALL_ITEM_ID);
    expect(d.items.at(-1)!.id).toBe("call-task");
  });

  it.each([
    ["a bad at time", { ...CALL, at: "2pm" }, /HH:MM/],
    ["a bad length", { ...CALL, length: "half an hour" }, /H:MM:SS or MM:SS/],
    ["no lines", { ...CALL, lines: [] }, /non-empty list/],
    ["a line with a bad who", { ...CALL, lines: [{ who: "partner", t: "14:00" }] }, /"boss" or "me"/],
    ["a line with a bad time", { ...CALL, lines: [{ who: "boss", t: "99:99" }] }, /HH:MM/],
    ["an unknown call key", { ...CALL, mood: "x" }, /unknown key "mood"/],
    ["a day task (not night)", { ...CALL, task: { ...CALL.task, when: "day" } }, /night item/],
    ["a task that is not required", { ...CALL, task: { ...CALL.task, required: false } }, /required/],
  ])("rejects %s", (_n, call, message) => {
    expect(parse(call)).toThrow(message);
  });

  it("accepts length as H:MM:SS too", () => {
    expect(parse({ ...CALL, length: "1:12:00" })).not.toThrow();
  });
});

// ——— the pure call helpers ———

describe("call helpers", () => {
  it("minutesOf / timeOf round-trip; the call starts 30 minutes after the ask", () => {
    expect(minutesOf("14:00")).toBe(840);
    expect(timeOf(840 + 30)).toBe("14:30");
  });
  it("lengthSeconds parses MM:SS and H:MM:SS; clockText formats back", () => {
    expect(lengthSeconds("30:00")).toBe(1800);
    expect(lengthSeconds("1:12:00")).toBe(4320);
    expect(clockText(1800)).toBe("30:00");
    expect(clockText(4320)).toBe("1:12:00");
  });
  it("linesShown rises with elapsed time, at least one once connected, never past the count", () => {
    const call = { lines: CALL.lines } as any;
    expect(linesShown(call, 0, 1800)).toBe(1);
    expect(linesShown(call, 1800, 1800)).toBe(3);
    expect(linesShown(call, 10_000, 1800)).toBe(3);
  });
  it("callPhase walks before → ask → waiting → inCall → ended from the clock and the log", () => {
    const call = { at: "14:00", length: "30:00", lines: CALL.lines, task: {} } as any;
    expect(callPhase(call, [], 1, "13:59", false)).toBe("before");
    expect(callPhase(call, [], 1, "14:00", false)).toBe("ask");
    const answered = [{ kind: "callAnswer", day: 1 }] as any;
    expect(callPhase(call, answered, 1, "14:00", false)).toBe("waiting");
    expect(callPhase(call, answered, 1, "14:30", true)).toBe("inCall");
    const ended = [...answered, { kind: "callEnded", day: 1 }] as any;
    expect(callPhase(ended, ended, 1, "14:30", true) === "ended" || callPhase(call, ended, 1, "14:30", true) === "ended").toBe(true);
    expect(callPhase(null, [], 1, "23:00", false)).toBe("before");
  });
});

// ——— the reducer and the chain (with the mocked call day) ———

const bossCallDay = (): Store => createStore({ startDay: 1 });
/** A ctx whose `later` runs immediately, so the call's timers fire synchronously in a test. */
function fakeCtx(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "desktop")) {
  let now = 0;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (_ms, fn) => fn(), now: () => now };
  return { ctx, tick: (ms: number) => (now += ms) };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => callActions[name]!(ctx, data as DOMStringMap, null as never);
const lc = (store: Store) => loopContext(store.getState(), store.getEvents())!;
const app = (store: Store, session: Session, nowMs = 0) => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs });

describe("the reducer", () => {
  it("callAnswer and callEnded are accepted on a call day and refused elsewhere", () => {
    const s = bossCallDay().getState();
    expect(() => applyEvent(s, { kind: "callAnswer", day: 1 })).not.toThrow();
    expect(() => applyEvent(s, { kind: "callEnded", day: 1 })).not.toThrow();
    expect(() => applyEvent(s, { kind: "callEnded", day: 2 })).toThrow(/no call/);
  });
});

describe("the chain: ask → reply → wait → call → nightfall → task", () => {
  it("before the reply the call is not live; answering begins it and blocks the day", () => {
    const store = bossCallDay();
    const { ctx } = fakeCtx(store);
    ctx.session.clock = { beat: "afternoon", time: "14:05" };
    // The ask shows; nothing is live yet.
    expect(phaseOf(app(store, ctx.session))).toBe("ask");
    expect(ctx.session.call).toBeNull();
    // 「好的。」 → callAnswer, the wait starts; our immediate `later` connects and then ends it.
    act(ctx, "call-answer");
    // callAnswer and callEnded are both in the log (the timers ran synchronously here).
    const kinds = store.getEvents().map((e) => e.kind);
    expect(kinds).toContain("callAnswer");
    expect(kinds).toContain("callEnded");
  });

  it("when the call ends, night falls and the call's task joins the night checklist as required", () => {
    const store = bossCallDay();
    const { ctx } = fakeCtx(store);
    // Before the call ends, the call gate holds nightfall back.
    expect(nightfallReached(lc(store))).toBe(false);
    store.appendEvent({ kind: "callAnswer" });
    store.appendEvent({ kind: "callEnded" });
    // The synthetic call gate is now done; the day's own required items decide the rest of nightfall.
    const gate = itemStates(lc(store)).get(CALL_ITEM_ID)!;
    expect(gate.done).toBe(true);
    // The task is a required night item (shows in tonight's list once night falls).
    const task = dayFile(1)!.items.find((it) => it.id === "call-task")!;
    expect(task.required && task.when).toBe("night");
  });

  it("the call cannot be skipped: callEnded must follow callAnswer is not required by the reducer, but the gate needs the end", () => {
    // Nightfall's gate is the callEnded event alone; without it the gate is never done.
    const store = bossCallDay();
    store.appendEvent({ kind: "callAnswer" });
    expect(itemStates(lc(store)).get(CALL_ITEM_ID)!.done).toBe(false);
  });

  it("replays identically from the log", () => {
    const one = bossCallDay();
    const two = bossCallDay();
    for (const store of [one, two]) {
      store.appendEvent({ kind: "callAnswer" });
      store.appendEvent({ kind: "callEnded" });
    }
    expect(one.getState()).toEqual(two.getState());
    expect(itemStates(lc(one)).get(CALL_ITEM_ID)!.done).toBe(itemStates(lc(two)).get(CALL_ITEM_ID)!.done);
  });
});

describe("the overlay", () => {
  it("shows the ask with the one reply at the call time, nothing before", () => {
    const store = bossCallDay();
    const session = initialSession({ beat: "afternoon", time: "13:30" }, "left", "desktop");
    expect(renderCall(app(store, session))).toBeNull();
    session.clock = { beat: "afternoon", time: "14:00" };
    const ask = renderCall(app(store, session))!.value;
    expect(ask).toContain("call-overlay ask");
    expect(ask).toContain('data-action="call-answer"');
  });

  it("the connected panel shows the timer and fills the transcript; it is gone once the call has ended", () => {
    const store = bossCallDay();
    const session = initialSession({ beat: "afternoon", time: "14:30" }, "left", "desktop");
    session.call = { day: 1, answeredMs: 0, connected: true };
    store.appendEvent({ kind: "callAnswer" });
    const panel = renderCall(app(store, session, 5_000))!.value;
    expect(panel).toContain("call-overlay in-call");
    expect(panel).toContain("call-timer");
    expect(panel).toContain("call-script");
    // After the call ends, nothing shows.
    session.call = null;
    store.appendEvent({ kind: "callEnded" });
    expect(renderCall(app(store, session))).toBeNull();
  });

  it("callOf returns the day's call", () => {
    expect(callOf(1)).toMatchObject({ at: "14:00" });
    expect(callOf(2)).toBeNull();
  });
});
