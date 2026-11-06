// Debug params beside ?day=N: `&night=1` and `&shutdown=1` queue that day's night or shutdown beat
// in the box after the page loads, staged as at bedtime; nothing is logged (world/loop/preview.ts).
import { afterEach, describe, expect, it } from "vitest";
import { handDeliverableOf } from "@state/days/board";
import { dayFiles, type DayFile } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { GIVE_INDEX, placedLines, REFUSE_INDEX, showing } from "@world/loop/dialogue";
import { previewParam, previewQueued, startPreview } from "@world/loop/preview";
import { BEAT_TIMES, syncLoop } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";

/** A ?day=N debug run, its page loaded (the first look has run, as on mount). */
function loaded(day: number) {
  const store = createStore({ startDay: day });
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "desktop"), rerender: () => {}, later: () => {}, now: () => 0 };
  syncLoop(ctx, 0);
  return { store, ctx };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);

const real = new Map(dayFiles);
afterEach(() => {
  for (const [d, f] of real) (dayFiles as Map<number, DayFile>).set(d, f);
});

describe("the params", () => {
  it("only `1` counts; both at once, or neither, is nothing", () => {
    expect(previewParam("?day=5&night=1")).toBe("night");
    expect(previewParam("?day=12&shutdown=1")).toBe("shutdown");
    expect(previewParam("?day=5&night=1&shutdown=1")).toBeNull();
    expect(previewParam("?day=5&night=yes")).toBeNull();
    expect(previewParam("?day=5&shutdown=0")).toBeNull();
    expect(previewParam("?day=5")).toBeNull();
  });
});

describe("?night=1", () => {
  it("queues the day's night beat and nothing else, in 房间 at the night clock; nothing is logged", () => {
    const { store, ctx } = loaded(5);
    const before = store.getEvents().length;
    expect(startPreview(ctx.session, 5, "night")).toBe(true);
    const night = dayFiles.get(5)!.beats.night!;
    expect(ctx.session.dialogue.queue).toHaveLength(1);
    expect(ctx.session.dialogue.queue[0]).toMatchObject({ key: "d5:beat:night", lines: placedLines(night), ending: { kind: "none" }, preview: true });
    expect([ctx.session.view, ctx.session.clock]).toEqual(["lying", { beat: "night", time: BEAT_TIMES.night }]);
    // Read to the end: no lieDown, still day 5, nothing in the log.
    for (let i = 0; i < 400 && ctx.session.dialogue.queue.length; i++) act(ctx, "loop-advance");
    expect(store.getState().day).toBe(5);
    expect(store.getEvents()).toHaveLength(before);
  });
});

describe("?shutdown=1", () => {
  it("queues the day's shutdown beat with its choices, and nothing else", () => {
    const { store, ctx } = loaded(18);
    expect(startPreview(ctx.session, 18, "shutdown")).toBe(true);
    expect(ctx.session.dialogue.queue).toHaveLength(1);
    expect(ctx.session.dialogue.queue[0]).toMatchObject({ key: "d18:beat:shutdown", ending: { kind: "beatChoices", day: 18, beat: "shutdown" }, preview: true });
    expect(ctx.session.view).toBe("lying");
    const q = ctx.session.dialogue.queue[0]!;
    const choices = showing({ queue: [q], line: q.lines.length - 1 }, store.getState(), store.getEvents())!.choices!;
    // Night 18 is not a hand night: its own two choices only.
    expect(choices.map((c) => c.index)).toEqual(dayFiles.get(18)!.beats.shutdown!.choices!.map((_, i) => i));
  });

  it("days 10–17: the hand's give (when the day has a hand deliverable), the content's choices, refuse when it has none", () => {
    for (let day = 10; day <= 17; day++) {
      const { store, ctx } = loaded(day);
      expect(startPreview(ctx.session, day, "shutdown"), `day ${day}`).toBe(true);
      const q = ctx.session.dialogue.queue[0]!;
      const choices = showing({ queue: [q], line: q.lines.length - 1 }, store.getState(), store.getEvents())!.choices!;
      const own = dayFiles.get(day)!.beats.shutdown!.choices?.length ?? 0;
      expect(choices.some((c) => c.index === GIVE_INDEX), `day ${day}`).toBe(handDeliverableOf(day) !== null);
      expect(choices.some((c) => c.index === REFUSE_INDEX), `day ${day}`).toBe(own === 0);
      expect(choices.filter((c) => c.index >= 0).map((c) => c.index), `day ${day}`).toEqual(Array.from({ length: own }, (_, i) => i));
      expect(choices.length, `day ${day}`).toBeGreaterThan(0);
    }
  });

  it("a choice in the preview logs nothing and closes it", () => {
    const { store, ctx } = loaded(10);
    startPreview(ctx.session, 10, "shutdown");
    const before = store.getEvents().length;
    const q = ctx.session.dialogue.queue[0]!;
    ctx.session.dialogue = { ...ctx.session.dialogue, line: q.lines.length - 1 };
    const first = showing(ctx.session.dialogue, store.getState(), store.getEvents())!.choices![0]!;
    act(ctx, "loop-choice", { index: String(first.index), ...(first.choice ? { choice: first.choice } : {}) });
    expect(store.getEvents()).toHaveLength(before);
    expect(store.getState().raids).toEqual({});
    expect(ctx.session.dialogue.queue).toEqual([]);
  });
});

describe("a day without that beat queues nothing", () => {
  it("no day file, or a day file without the beat: nothing is queued, the session is untouched", () => {
    const { ctx } = loaded(5);
    const dialogue = ctx.session.dialogue;
    expect(previewQueued(99, "night")).toBeNull();
    const { night: _n, ...rest } = real.get(5)!.beats;
    (dayFiles as Map<number, DayFile>).set(5, { ...real.get(5)!, beats: rest });
    expect(startPreview(ctx.session, 5, "night")).toBe(false);
    expect(ctx.session.dialogue).toBe(dialogue);
    expect(ctx.session.view).toBe("desktop");
    const { shutdown: _s, ...noShutdown } = real.get(5)!.beats;
    (dayFiles as Map<number, DayFile>).set(5, { ...real.get(5)!, beats: noShutdown });
    expect(startPreview(ctx.session, 5, "shutdown")).toBe(false);
  });
});
