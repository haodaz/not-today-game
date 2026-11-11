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
import { itemStates, loopContext, nightfallReached } from "@world/loop/checklist";
import { loopActions, renderGame, SHUTDOWN_TO_ROOM_MS } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { DESK_SHOT, rectStyle, ROOM_SHOT, WINDOW_SHOT } from "@world/room/shots";
import { completeUntil } from "./complete-items";
import { upgradeTable } from "@state/upgrades";
import { lineScreens } from "@world/dialogue/box";
import { EMPTY_DIALOGUE, push, showing } from "@world/loop/dialogue";
import { beatQueued } from "@world/loop/runtime";
import { POINTER_CLASS } from "@world/room/pointer";
import { boxObjectFor } from "@world/room/hud";

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

describe("开机: the tower's power button (房间; 桌子 is the tabletop, the tower is out of its frame)", () => {
  it("桌子 has no tower hotspot (day-loop correction 2026-11-01)", () => {
    expect(render(ctxOf(atDay(1), "desk").ctx)).not.toContain("tower-hit");
  });

  it("off: a hotspot with a faint light; pressing it boots; then it is only the picture", () => {
    for (const [view, shot] of [["room", ROOM_SHOT]] as const) {
      const store = atDay(1);
      const { ctx } = ctxOf(store, view);
      const before = render(ctx);
      expect(before).toContain(`<button type="button" class="shot-hit tower-hit" data-action="tower-power" style="${rectStyle(shot.tower)}" aria-label="${t("room.tower.off")}" data-hot="tower"><i class="tower-led"></i></button>`);
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
    for (const r of [ROOM_SHOT.tower, ROOM_SHOT.bed]) expect(r.l >= 0 && r.t >= 0 && r.l + r.w <= 1600 && r.t + r.h <= 900).toBe(true);
    expect(ROOM_SHOT.tower.t).toBeGreaterThan(ROOM_SHOT.desk.t + ROOM_SHOT.desk.h); // below the desk top
    expect(ROOM_SHOT.tower.l + ROOM_SHOT.tower.w).toBeLessThan(ROOM_SHOT.monitors.left.l);
    expect(ROOM_SHOT.bed.l).toBeGreaterThan(ROOM_SHOT.desk.l + ROOM_SHOT.desk.w);
  });
});

describe("吃: the meal on the little table under the window (room-turn R3)", () => {
  it("after 去拿 the food image is on the table; from 窗 a click walks up; at the table it asks 现在吃吗？; 吃 eats and the box is gone (author 2026-11-11)", () => {
    const store = atDay(1);
    completeUntil(store, "eat");
    const { ctx } = ctxOf(store, "window");
    const out = render(ctx);
    expect(out).toMatch(/<button type="button" class="slot meal" data-action="loop-eat" data-meal="lunch" aria-label="[^"]+"><img src="\/food\/[a-z_]+\.png" alt=""><\/button>/);
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "dinner" }); // not the meal on the desk
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "lunch" });
    expect(ctx.session.view).toBe("table");
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "lunch" });
    expect(ctx.session.dialogue.queue[0]?.ending).toEqual({ kind: "eatAsk", meal: "lunch" });
    expect(ctx.session.dialogue.queue[0]?.lines[0]?.t).toBe(t("room.eat.ask"));
    act(ctx, "loop-choice", { choice: "wait" });
    expect(done(store, "eat")).toBe(false);
    act(ctx, "loop-eat", { meal: "lunch" });
    act(ctx, "loop-choice", { choice: "eat" });
    expect(done(store, "eat")).toBe(true);
    const after = render(ctx);
    expect(after).not.toContain("slot meal");
    expect(after).not.toContain("loop-eat");
  });

  it("nothing on the table before it is taken in", () => {
    const store = atDay(1);
    completeUntil(store, "pickup");
    expect(render(ctxOf(store, "window").ctx)).not.toContain("slot meal");
  });

  it("the meal is drawn on 窗's table and not on 桌子; clicking it, or the table under it, logs today's eat step once", () => {
    const store = atDay(1);
    completeUntil(store, "eat");
    expect(render(ctxOf(store, "desk").ctx)).not.toContain("slot meal");
    const items = ctxOf(store, "desk").ctx;
    act(items, "items-toggle");
    expect(render(items)).not.toContain("slot meal");
    // Not from 桌子 (or anywhere but 窗).
    act(ctxOf(store, "desk").ctx, "loop-eat", { meal: "lunch" });
    expect(done(store, "eat")).toBe(false);
    const { ctx } = ctxOf(store, "window");
    const out = render(ctx);
    expect(out).toContain(`<div class="facing-things"><div class="at" data-at="meal" style="${rectStyle(WINDOW_SHOT.meal)}"><button type="button" class="slot meal" data-action="loop-eat" data-meal="lunch"`);
    expect(out).toContain(`class="shot-hit table-hit" data-action="meal-table" style="${rectStyle(WINDOW_SHOT.mealTable)}" aria-label="${t("room.mealTable")}" data-hot="mealTable"`);
    act(ctx, "meal-table");
    act(ctx, "meal-table");
    act(ctx, "loop-eat", { meal: "lunch" });
    act(ctx, "loop-choice", { choice: "eat" });
    expect(store.getEvents().filter((e) => e.kind === "step" && e.name === "eat:lunch")).toHaveLength(1);
    expect(done(store, "eat")).toBe(true);
    // An empty table is only a click.
    const before = store.getEvents().length;
    act(ctx, "meal-table");
    expect(store.getEvents()).toHaveLength(before);
  });
});

describe("看一眼桌子: entering 桌子", () => {
  it("counts only while the item is open; the desk beat plays on arrival", () => {
    const store = atDay(1);
    const { ctx } = ctxOf(store, "room");
    act(ctx, "view", { view: "desk" });
    expect(done(store, "desk")).toBe(false);
    completeUntil(store, "desk");
    // Unlocked, but night has not fallen (the box and the pickup are still to do): not yet.
    act(ctx, "view", { view: "room" });
    act(ctx, "view", { view: "desk" });
    expect(done(store, "desk")).toBe(false);
    completeUntil(store, "desk", { all: true, skip: ["desk"] });
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
  const line = (key: string, text: string) => [{ key, lines: [{ k: "inner", t: t(text) }], ending: { kind: "none" } }];
  it("before nightfall: room.bed.notyet; after it: room.bed.locked until the night's required items are done; then it asks", () => {
    const store = atDay(1);
    const { ctx } = ctxOf(store, "room");
    expect(render(ctx)).toContain(`class="shot-hit bed-hit" data-action="bed" style="${rectStyle(ROOM_SHOT.bed)}"`);
    act(ctx, "bed");
    expect(ctx.session.dialogue.queue).toEqual(line("d1:bed:notyet", "room.bed.notyet"));
    act(ctx, "bed"); // the same line, not twice
    expect(ctx.session.dialogue.queue).toHaveLength(1);
    ctx.session.dialogue = { queue: [], line: 0 };
    // Night falls (every required day item done); dinner, desk and shutdown are still to do.
    completeUntil(store, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    expect(nightfallReached(loopContext(store.getState(), store.getEvents())!)).toBe(true);
    act(ctx, "bed");
    expect(ctx.session.dialogue.queue).toEqual(line("d1:bed:locked", "room.bed.locked"));
    ctx.session.dialogue = { queue: [], line: 0 };
    // Chat is optional: the bed opens without it.
    completeUntil(store, "bed", { all: true, skip: ["chat"] });
    act(ctx, "bed");
    expect(ctx.session.dialogue.queue).toEqual([{ key: "d1:bed:ask", lines: [{ k: "inner", t: t("room.bed.confirm") }], ending: { kind: "bedAsk" } }]);
    expect(store.getState().day).toBe(1);
  });
  it("the ask offers room.bed.sleep / room.bed.stay; stay closes the box and changes nothing", () => {
    const store = atDay(1);
    const { ctx, timers } = ctxOf(store, "room");
    completeUntil(store, "bed", { all: true });
    act(ctx, "bed");
    // lying-view R4: after nightfall the bed is lain on first (房间 → 床 → the ceiling).
    for (const x of timers.splice(0)) x.fn();
    expect(ctx.session.view).toBe("lying");
    const html = render(ctx);
    expect(html).toContain(`data-action="loop-choice" data-index="0" data-choice="sleep"`);
    expect(html).toContain(`data-action="loop-choice" data-index="1" data-choice="stay"`);
    expect(html).toContain(t("room.bed.sleep"));
    expect(html).toContain(t("room.bed.stay"));
    const events = store.getEvents().length;
    const state = JSON.stringify(store.getState());
    act(ctx, "loop-choice", { choice: "stay" });
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(store.getEvents()).toHaveLength(events);
    expect(JSON.stringify(store.getState())).toBe(state);
    // 再待会儿 keeps the player lying (lying-view R4).
    expect(ctx.session.view).toBe("lying");
    // Asked again from the bed, sleep: the night begins at once, from `lying`.
    act(ctx, "bed");
    act(ctx, "loop-choice", { choice: "sleep" });
    expect(ctx.session.view).toBe("lying");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:beat:night"]);
    for (let i = 0; i < dayFiles.get(1)!.beats.night!.say.length; i++) act(ctx, "loop-advance");
    expect(store.getState().day).toBe(2);
  });
});
describe("the bed and the meal are named by their strings", () => {
  it("room.bed on the bed, room.meal on the meal", () => {
    const store = atDay(1);
    expect(render(ctxOf(store).ctx)).toContain(`data-action="bed" style="${rectStyle(ROOM_SHOT.bed)}" aria-label="${t("room.bed")}"`);
    completeUntil(store, "eat");
    expect(render(ctxOf(store, "window").ctx)).toContain(`data-action="loop-eat" data-meal="lunch" aria-label="${t("room.meal")}"`);
  });
});

describe("the one-time pointer (day-loop rule 2026-11-01)", () => {
  const ptr = (s: string) => (s.match(/pointer-once/g) ?? []).length;

  it("举起来: on the first object of the desk bar until one is held once; never again; no event", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "openLayer", objectId: boxObjectFor(1)! });
    const { ctx } = ctxOf(store, "desk");
    const before = render(ctx);
    expect(ptr(before)).toBe(1);
    expect(before).toMatch(new RegExp(`class="slot[^"]*pointer-once" data-object="${boxObjectFor(1)}"`));
    const events = store.getEvents().length;
    act(ctx, "loop-hold", { object: boxObjectFor(1)! });
    act(ctx, "loop-put-down");
    expect(ptr(render(ctx))).toBe(0);
    expect(store.getEvents().slice(events).some((e) => e.kind === "step")).toBe(false); // session, not an event
  });

  it("the first upgrade offer: on Kuro's body while an offer waits, until the body is clicked", () => {
    const pager = upgradeTable.objects.get("pager")!;
    const store = atDay(1);
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    while (store.getState().day < pager.offerFrom) store.appendEvent({ kind: "lieDown" });
    const { ctx } = ctxOf(store, "room");
    expect(render(ctx)).toContain('class="kuro-btn pointer-once"');
    act(ctx, "kuro-call");
    act(ctx, "kuro-leave");
    expect(render(ctx)).not.toContain("pointer-once");
    // No offer: no pointer, even on a fresh session.
    expect(render(ctxOf(atDay(1)).ctx)).not.toContain("pointer-once");
  });

  it("the first night's hand: on the raid's choices in the box, until one is chosen; not on the next raid", () => {
    // The hand's first night is 10 (author 2026-11-06: nights 1–9 have no hand).
    const store = atDay(10);
    const { ctx } = ctxOf(store, "room", { beat: "night", time: "23:41" });
    const raidAt = (day: number) => {
      ctx.session.dialogue = push(EMPTY_DIALOGUE, beatQueued(day, "shutdown", dayFiles.get(day)!.beats.shutdown!));
      const n = lineScreens(store.getState(), ctx.session)!.all.length;
      ctx.session.dialogue = { ...ctx.session.dialogue, line: ctx.session.dialogue.queue[0]!.lines.length - 1, page: n - 1 };
    };
    raidAt(10);
    // world-prompts R2: the choices are the column on the right; the pointer is on it.
    expect(render(ctx)).toMatch(/<div class="dlg-choices pointer-once" role="group">/);
    const offered = showing(ctx.session.dialogue, store.getState())!.choices!;
    act(ctx, "loop-choice", { index: String(offered.at(-1)!.index) });
    expect(ctx.session.pointed.has("raid")).toBe(true);
    // Choices outside a raid never get it.
    ctx.session.pointed.clear();
    ctx.session.dialogue = push(EMPTY_DIALOGUE, { key: "k", lines: [], ending: { kind: "loan" } });
    expect(render(ctx)).not.toContain("pointer-once");
  });

  it("one component, one class", () => {
    expect(POINTER_CLASS).toBe("pointer-once");
  });
});

describe("老周的事: the loan, in 老周's conversation (day 5)", () => {
  it("opening 老周 while the item is open brings up the loan prompt; anyone else does not", () => {
    const store = atDay(constants.loanReplyDay);
    completeUntil(store, "loan");
    // Vivi's PRD is posted at 09:50 now (day graph); opened, so its lock does not stand in the way.
    store.appendEvent({ kind: "open", target: "file:vivi-prd", t: "09:51" });
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
