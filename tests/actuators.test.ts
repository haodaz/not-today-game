// day-loop correction 2026-11-01: "the checklist observes our behaviour; the player is the one who
// acts." One test per row of the spec's table: the world action ticks the line, and the line
// itself is not a button (clicking it changes nothing).
import { afterEach, describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { constants } from "@state/variables";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { itemStates, loopContext } from "@world/loop/checklist";
import { loopActions, renderGame, SHUTDOWN_TO_ROOM_MS } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { DESK_SHOT, rectStyle, ROOM_SHOT } from "@world/room/shots";
import { completeUntil } from "./complete-items";

afterEach(() => setLocale("zh"));

const none = {} as DOMStringMap;
function ctxOf(store: Store, view: Session["view"] = "room", clock: BeatClock = DEFAULT_CLOCK) {
  const timers: { ms: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }) };
  return { ctx, timers };
}
const render = (ctx: ActionContext) =>
  ctx.session.view === "desktop" ? renderGame(ctx.store, ctx.session, 0).value : renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
const done = (store: Store, id: string) => itemStates(loopContext(store.getState(), store.getEvents())!).get(id)!.done;
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const atDay = (day: number) => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};

describe("no checklist line is a button", () => {
  it("lines render as plain rows in every view, every day; loop-item is gone", () => {
    expect(loopActions["loop-item"]).toBeUndefined();
    for (const day of dayFiles.keys()) {
      const { ctx } = ctxOf(atDay(day));
      const list = render(ctx).match(/<div class="list">[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
      expect(list, `day ${day}`).not.toMatch(/<button|data-action/);
    }
  });
});

describe("开机: the tower's power button (房间 and 桌子)", () => {
  it("off: a hotspot with a faint light; pressing it boots; then it is only the picture", () => {
    for (const [view, shot] of [["room", ROOM_SHOT], ["desk", DESK_SHOT]] as const) {
      const store = atDay(1);
      const { ctx } = ctxOf(store, view);
      const before = render(ctx);
      expect(before).toContain(`<button type="button" class="shot-hit tower-hit" data-action="tower-power" style="${rectStyle(shot.tower)}" aria-label="${t("room.tower.off")}"><i class="tower-led"></i></button>`);
      act(ctx, "tower-power");
      expect(done(store, "boot")).toBe(true);
      expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "boot" });
      expect(render(ctx)).not.toContain("tower-hit");
      act(ctx, "tower-power");
      expect(store.getEvents().filter((e) => e.kind === "step" && e.name === "boot")).toHaveLength(1);
    }
  });

  it("before boot 屏幕 is two black monitors and nothing else", () => {
    const store = atDay(1);
    const { ctx } = ctxOf(store, "desktop");
    const out = render(ctx);
    expect(out).toContain('class="monitor off"');
    expect(out).not.toMatch(/class="(top|win|dock)"/);
    act(ctx, "tower-power");
    expect(render(ctx)).not.toContain("monitor off");
  });

  it("the rects sit on the photos: under the desk's left end, the bed at the right of 房间", () => {
    for (const r of [ROOM_SHOT.tower, DESK_SHOT.tower, ROOM_SHOT.bed]) expect(r.l >= 0 && r.t >= 0 && r.l + r.w <= 1600 && r.t + r.h <= 900).toBe(true);
    expect(ROOM_SHOT.tower.t).toBeGreaterThan(ROOM_SHOT.desk.t + ROOM_SHOT.desk.h); // below the desk top
    expect(ROOM_SHOT.tower.l + ROOM_SHOT.tower.w).toBeLessThan(ROOM_SHOT.monitors.left.l);
    expect(ROOM_SHOT.bed.l).toBeGreaterThan(ROOM_SHOT.desk.l + ROOM_SHOT.desk.w);
  });
});

describe("吃: the meal on the desk bar", () => {
  it("after 去拿 the food image is on the bar; clicking it eats; the empty box stays", () => {
    const store = atDay(1);
    completeUntil(store, "eat");
    const { ctx } = ctxOf(store, "desk");
    const out = render(ctx);
    expect(out).toMatch(/<button type="button" class="slot meal" data-action="loop-eat" data-meal="lunch" aria-label="[^"]+"><img src="\/food\/[a-z_]+\.png" alt=""><\/button>/);
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "dinner" }); // not the meal on the desk
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "lunch" });
    expect(done(store, "eat")).toBe(true);
    const after = render(ctx);
    expect(after).toMatch(/<div class="slot meal done" data-meal="lunch"><object data="\/food\/[a-z_]+_done\.png" type="image\/png" aria-hidden="true"><img class="eaten"/);
    expect(after).not.toContain("loop-eat");
  });

  it("nothing on the bar before it is taken in", () => {
    const store = atDay(1);
    completeUntil(store, "pickup");
    expect(render(ctxOf(store, "desk").ctx)).not.toContain("slot meal");
  });
});

describe("看一眼桌子: entering 桌子", () => {
  it("counts only while the item is open; the desk beat plays on arrival", () => {
    const store = atDay(1);
    const { ctx } = ctxOf(store, "room");
    act(ctx, "view", { view: "desk" });
    expect(done(store, "desk")).toBe(false);
    completeUntil(store, "desk");
    act(ctx, "view", { view: "room" });
    act(ctx, "view", { view: "desk" });
    expect(done(store, "desk")).toBe(true);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "beat:desk" });
  });
});

describe("关机: in the work system's own top bar", () => {
  it("disabled until the item is open; then the shutdown beat, both monitors dark, back to 房间", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    const { ctx, timers } = ctxOf(store, "desktop", { beat: "work", time: "10:00" });
    expect(render(ctx)).toContain('data-action="desktop-shutdown" disabled');
    act(ctx, "desktop-shutdown");
    expect(done(store, "shutdown")).toBe(false);
    completeUntil(store, "shutdown");
    expect(render(ctx)).toMatch(/<button type="button" class="sys-off" data-action="desktop-shutdown">关机<\/button>/);
    act(ctx, "desktop-shutdown");
    expect(done(store, "shutdown")).toBe(true);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "beat:shutdown" });
    const back = timers.find((x) => x.ms === SHUTDOWN_TO_ROOM_MS)!;
    expect(ctx.session.view).toBe("desktop");
    back.fn();
    expect(ctx.session.view).toBe("room");
  });
});

describe("躺下: the bed in 房间", () => {
  it("locked: one inner line (room.bed.locked), nothing else; unlocked: the night, then lieDown", () => {
    const store = atDay(1);
    const { ctx } = ctxOf(store, "room");
    expect(render(ctx)).toContain(`class="shot-hit bed-hit" data-action="bed" style="${rectStyle(ROOM_SHOT.bed)}"`);
    act(ctx, "bed");
    expect(ctx.session.dialogue.queue).toEqual([{ key: "d1:bed:locked", lines: [{ k: "inner", t: t("room.bed.locked") }], ending: { kind: "none" } }]);
    act(ctx, "bed"); // the same line, not twice
    expect(ctx.session.dialogue.queue).toHaveLength(1);
    expect(store.getState().day).toBe(1);
    ctx.session.dialogue = { queue: [], line: 0 };
    completeUntil(store, "bed", { all: true });
    act(ctx, "bed");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:beat:night"]);
    for (let i = 0; i < dayFiles.get(1)!.beats.night!.say.length; i++) act(ctx, "loop-advance");
    expect(store.getState().day).toBe(2);
  });
});

describe("老周的事: the loan, in 老周's conversation (day 5)", () => {
  it("opening 老周 while the item is open brings up the loan prompt; anyone else does not", () => {
    const store = atDay(constants.loanReplyDay);
    completeUntil(store, "loan");
    const { ctx } = ctxOf(store, "desktop", { beat: "work", time: "14:00" });
    act(ctx, "conv", { conv: "boss" });
    expect(ctx.session.dialogue.queue).toEqual([]);
    act(ctx, "conv", { conv: "laozhou" });
    expect(ctx.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["loan"]);
    expect(render(ctx)).toContain('data-action="loop-choice" data-index="0" data-choice="lend"');
    act(ctx, "loop-choice", { index: "1", choice: "no" });
    expect(done(store, "loan")).toBe(true);
    // Decided: opening 老周 again asks nothing.
    act(ctx, "conv", { conv: "laozhou" });
    expect(ctx.session.dialogue.queue).toEqual([]);
  });
});
