// day-loop addition 2026-11-02: night falls — the day has a threshold. Items carry `when`; the
// moment the last required day item is done, night falls once: one narration line, the clock to
// 18:30 if earlier, sting-soft, the evening look; the card then shows tonight's list.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dayFiles, ITEM_WHEN, parseDayFile } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, isNight, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { t } from "@world/i18n";
import { checklist, itemStates, loopContext, nightfallReached, WORK_LINE_ID } from "@world/loop/checklist";
import { BEAT_TIMES, eveningClock, NIGHTFALL_STING, syncLoop } from "@world/loop/runtime";
import { EVENING_DARK, isEvening, renderChecklist, renderRoom } from "@world/room/hud";
import { splatLook } from "@world/room/splat/look";
import { completeItem, completeUntil } from "./complete-items";

const atDay = (day: number): Store => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};
function fakeCtx(store: Store, session: Session = initialSession(DEFAULT_CLOCK, "left", "room")) {
  const sounds: string[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, play: (id) => void sounds.push(id) };
  return { ctx, sounds };
}
const lc = (store: Store) => loopContext(store.getState(), store.getEvents())!;
const nightfallKeys = (ctx: ActionContext, day: number) => ctx.session.dialogue.queue.filter((q) => q.key === `d${day}:nightfall`);
const isBed = (id: string, day: number) => {
  const it = dayFiles.get(day)!.items.find((x) => x.id === id)!;
  return it.done.kind === "event" && it.done.event.type === "lieDown";
};

describe("the loader: `when` on items", () => {
  const base = (extra: Record<string, unknown>) => ({
    day: 3,
    beats: {},
    items: [{ id: "x", text: "t", unlock: "start", done: "flag:f", required: true, ...extra }],
    delivery: { minMinutes: 1, waitMinutes: 2 },
  });
  it("accepts day and night; defaults to day", () => {
    expect(ITEM_WHEN).toEqual(["day", "night"]);
    expect(parseDayFile(base({}), "day-03.json").items[0]!.when).toBe("day");
    for (const when of ITEM_WHEN) expect(parseDayFile(base({ when }), "day-03.json").items[0]!.when).toBe(when);
  });
  it.each([["evening"], ["Night"], [""], [1], [null], [["night"]]])("rejects %j", (when) => {
    expect(() => parseDayFile(base({ when }), "day-03.json")).toThrow(/when/);
  });
  it("every day file has night items, and the bed is one of them", () => {
    for (const [day, file] of dayFiles) {
      const night = file.items.filter((it) => it.when === "night");
      expect(night.length, `day ${day}`).toBeGreaterThan(0);
      expect(night.some((it) => isBed(it.id, day)), `day ${day}`).toBe(true);
    }
  });
});

describe("nightfall", () => {
  it("fires exactly once per day, only as the last required day item is done, on every day", () => {
    for (const day of dayFiles.keys()) {
      const store = atDay(day);
      const { ctx, sounds } = fakeCtx(store);
      syncLoop(ctx, 0);
      let firedAt = -1;
      for (let guard = 0; guard < 80; guard++) {
        const before = nightfallReached(lc(store));
        // Do the next unlocked, undone item (never the bed), one at a time, as the world would.
        const states = itemStates(lc(store));
        const next = lc(store).file.items.find((it) => !isBed(it.id, day) && states.get(it.id)!.unlocked && !states.get(it.id)!.done);
        if (!next) {
          const waiting = lc(store).file.items.find((it) => !states.get(it.id)!.unlocked && it.unlock.kind === "event" && it.unlock.event.type === "arrives");
          if (!waiting || waiting.unlock.kind !== "event" || waiting.unlock.event.type !== "arrives") break;
          store.appendEvent({ kind: "step", name: `delivery:arrives:${waiting.unlock.event.meal}`, t: "12:04" });
          syncLoop(ctx, 0);
          continue;
        }
        const n = nightfallKeys(ctx, day).length;
        if (!completeItem(store, next)) break;
        syncLoop(ctx, 0);
        const fired = nightfallKeys(ctx, day).length > n;
        // Never before the threshold, always as it is crossed.
        expect(fired, `day ${day} at ${next.id}`).toBe(!before && nightfallReached(lc(store)));
        if (fired) {
          expect(firedAt, `day ${day}: twice`).toBe(-1);
          firedAt = guard;
          expect(next.when === "day" && next.required, `day ${day}: ${next.id} was not the last required day item`).toBe(true);
          expect(nightfallKeys(ctx, day)[0]!.lines).toEqual([{ k: "narration", t: t("day.nightfall") }]);
          expect(sounds.filter((s) => s === NIGHTFALL_STING)).toHaveLength(1);
          expect(isEvening(ctx.session.clock)).toBe(true);
        }
        ctx.session.dialogue = { queue: [], line: 0 };
      }
      expect(firedAt, `day ${day}: never fired`).toBeGreaterThanOrEqual(0);
      expect(sounds.filter((s) => s === NIGHTFALL_STING), `day ${day}`).toHaveLength(1);
    }
  });
  it("a reload after nightfall plays nothing again, and keeps the evening look", () => {
    const store = atDay(1);
    completeUntil(store, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    expect(nightfallReached(lc(store))).toBe(true);
    const { ctx, sounds } = fakeCtx(store);
    syncLoop(ctx, 0);
    expect(nightfallKeys(ctx, 1)).toHaveLength(0);
    expect(sounds).toEqual([]);
    expect(ctx.session.clock).toEqual({ beat: "desk", time: BEAT_TIMES.desk });
  });
  it("the clock goes to the desk beat at 18:30 only if earlier; later times and the night beat stay", () => {
    expect(eveningClock({ beat: "work", time: "10:00" })).toEqual({ beat: "desk", time: "18:30" });
    expect(eveningClock({ beat: "afternoon", time: "19:10" })).toEqual({ beat: "desk", time: "19:10" });
    const night: BeatClock = { beat: "night", time: "23:41" };
    expect(eveningClock(night)).toBe(night);
    // Evening is not the night: the desktop stays open, the chat beat waits for shutdown.
    expect(isNight(eveningClock(DEFAULT_CLOCK))).toBe(false);
  });
});

describe("tonight's list", () => {
  it("before nightfall: only day items under 今日; after: only night items under 今晚, in content order", () => {
    fc.assert(
      fc.property(fc.constantFrom(...dayFiles.keys()), (day) => {
        const store = atDay(day);
        const ids = (s: Store) => checklist(lc(s)).lines.map((l) => l.id);
        // playtest-1105 R7: the one work line stands for the list's own tasks.
        const whenOf = (id: string) => (id === WORK_LINE_ID ? checklist(lc(store)).heading === "tonight" ? "night" : "day" : dayFiles.get(day)!.items.find((it) => it.id === id)!.when);
        expect(checklist(lc(store)).heading).toBe("today");
        for (const id of ids(store)) expect(whenOf(id)).toBe("day");
        completeUntil(store, "bed", { all: true, skip: dayFiles.get(day)!.items.filter((it) => it.when === "night").map((it) => it.id) });
        const view = checklist(lc(store));
        expect(view.heading).toBe("tonight");
        expect(view.lines.length).toBeGreaterThan(0);
        for (const id of view.lines.map((l) => l.id)) expect(whenOf(id)).toBe("night");
      }),
      { numRuns: 18 },
    );
  });
  it("snapshots day 1's card before and after nightfall", () => {
    const store = atDay(1);
    completeUntil(store, "reply");
    const before = renderChecklist(checklist(lc(store))).value;
    completeUntil(store, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    const after = renderChecklist(checklist(lc(store))).value;
    expect(before).toContain(t("hud.today"));
    expect(after).toContain(t("hud.tonight"));
    expect({ before, after }).toMatchSnapshot();
  });
});

describe("the evening look", () => {
  const room = (clock: BeatClock, view: Session["view"] = "room") => {
    const store = atDay(1);
    return renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(clock, "left", view) }).value;
  };
  it("is on from the desk beat, in 房间, 桌子 and 门; never by day; the lamp glows where there is a lamp", () => {
    for (const beat of ["boot", "work", "afternoon"] as const) expect(room({ beat, time: "10:00" })).not.toContain("evening-look");
    for (const beat of ["desk", "night"] as const) {
      expect(room({ beat, time: "18:30" })).toContain(`class="evening-look" style="--evening-dark:${EVENING_DARK}"`);
      expect(room({ beat, time: "18:30" }, "desk")).toContain("evening-lamp");
      expect(room({ beat, time: "18:30" }, "door")).toContain("evening-look");
      expect(room({ beat, time: "18:30" }, "door")).not.toContain("evening-lamp");
    }
    expect(EVENING_DARK).toBe(0.6);
  });
  it("the splat takes the night's dark and lamp at the desk beat; the gap's light is the night's alone", () => {
    expect(splatLook(1, "desk")).toMatchObject({ night: true, gap: "none" });
    expect(splatLook(1, "night")).toMatchObject({ night: true, gap: "white" });
    expect(splatLook(1, "afternoon")).toMatchObject({ night: false, gap: "none" });
  });
  it("snapshots 房间 in the evening look", () => {
    const out = room({ beat: "desk", time: "18:30" });
    expect(out.match(/<div class="evening-look"[^]*?<\/div>/)?.[0]).toMatchSnapshot();
    expect(out).toMatchSnapshot();
  });
});
