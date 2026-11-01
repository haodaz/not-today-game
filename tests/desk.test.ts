// day-loop correction 2026-11-01: 桌子 is the tabletop, seen from the chair. The strict loader for
// content/desk.json; each placed thing at its rect; the meal, box and slip states; the 道具 strip
// opening and closing. Positions are read from the table, never repeated here.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import deskFile from "@content/desk.json";
import stagesFile from "@content/stages.json";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { BACKDROPS } from "@world/fit";
import { setLocale, t } from "@world/i18n";
import { itemStates, loopContext } from "@world/loop/checklist";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { renderRoom, SLIP_ITEM } from "@world/room/hud";
import { deskGap, deskLayout, fullMonitor, objectSlot, OBJECT_SLOTS, parseDesk } from "@world/room/desk";
import { DESK_SHOT, rectStyle } from "@world/room/shots";
import { completeUntil } from "./complete-items";

afterEach(() => setLocale("zh"));

function ctxOf(store: Store, view: Session["view"] = "desk") {
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {} };
  return ctx;
}
const render = (ctx: ActionContext) =>
  ctx.session.view === "desktop" ? renderGame(ctx.store, ctx.session, 0).value : renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const atDay = (day: number) => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};
/** The placed wrapper for `name` and its inner markup. */
const placed = (out: string, name: string) => {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`<div class="at" data-at="${esc}" style="([^"]+)">`).exec(out);
  return m ? m[1]! : null;
};
const clone = () => JSON.parse(JSON.stringify(deskFile)) as Record<string, any>;

describe("the loader (content/desk.json, strict)", () => {
  it("reads the file as it is", () => {
    expect(parseDesk(deskFile)).toEqual(deskLayout);
    expect(deskLayout.objects.slots).toHaveLength(OBJECT_SLOTS);
    expect(deskLayout.backdrop).toBe(deskFile.backdrop);
  });

  it.each([
    ["an unknown top key", (d: any) => (d.chair = { l: 0, t: 0, w: 1, h: 1 }), /unknown key "chair"/],
    ["a missing key", (d: any) => delete d.cup, /missing "cup"/],
    ["an unknown rect key", (d: any) => (d.cup.z = 1), /cup: unknown key "z"/],
    ["an unknown monitor", (d: any) => (d.monitors.middle = d.monitors.left), /monitors: unknown key "middle"/],
    ["a rect off the stage", (d: any) => (d.lamp.l = 1500), /lamp: is off the 1600×900 stage/],
    ["a non-number", (d: any) => (d.phone.w = "130"), /phone\.w: must be a number/],
    ["an empty rect", (d: any) => (d.box.h = 0), /box: must have a positive size/],
    ["five slots", (d: any) => d.objects.slots.pop(), /objects\.slots: must list 6/],
    ["a slot off the stage", (d: any) => (d.objects.slots[5] = 1500), /objects\.slots\[5\]: is off/],
    ["an unknown row key", (d: any) => (d.objects.row.l = 0), /objects\.row: unknown key "l"/],
    ["a backdrop that is not a path", (d: any) => (d.backdrop = "desk.jpg"), /backdrop: must be a site path/],
  ])("rejects %s", (_name, edit, msg) => {
    const d = clone();
    edit(d);
    expect(() => parseDesk(d)).toThrow(msg);
  });

  it("the 桌子 backdrop is the table's, in the CSS and the letterbox", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toContain(`.room.desk-view{background-image:url(${deskLayout.backdrop})}`);
    expect(BACKDROPS.desk).toBe(deskLayout.backdrop);
  });

  it("the monitors are their visible lower halves; the gap lies between; the camera's monitor runs above the frame", () => {
    expect(DESK_SHOT.monitors).toEqual(deskLayout.monitors);
    const gap = deskGap(deskLayout);
    expect(gap.l).toBe(deskLayout.monitors.left.l + deskLayout.monitors.left.w);
    expect(gap.l + gap.w).toBe(deskLayout.monitors.right.l);
    expect(DESK_SHOT.gap).toEqual(gap);
    const full = fullMonitor(deskLayout.monitors.left, 1496 / 956);
    expect(full.t + full.h).toBeCloseTo(deskLayout.monitors.left.t + deskLayout.monitors.left.h, 9);
    expect(full.w / full.h).toBeCloseTo(1496 / 956, 9);
    expect(full.t).toBeLessThan(0);
  });
});

describe("each placed thing at its rect", () => {
  it("the cup, the phone and the box, always; the monitor hotspots; no strip, no tower", () => {
    const out = render(ctxOf(atDay(1)));
    expect(placed(out, "cup")).toBe(rectStyle(deskLayout.cup));
    expect(placed(out, "phone")).toBe(rectStyle(deskLayout.phone));
    expect(placed(out, "box")).toBe(rectStyle(deskLayout.box));
    expect(out).toContain(`data-at="phone" style="${rectStyle(deskLayout.phone)}"><button type="button" class="slot" data-action="loop-phone">`);
    expect(out).toContain(`data-at="box" style="${rectStyle(deskLayout.box)}"><button type="button" class="slot" data-action="loop-box">`);
    for (const side of ["left", "right"] as const) expect(out).toContain(`data-view="desktop" data-screen="${side}" style="${rectStyle(deskLayout.monitors[side])}"`);
    expect(out).not.toContain('class="items-strip"');
    expect(out).not.toContain("tower-hit");
    expect(placed(out, "meal")).toBeNull();
    expect(placed(out, "slip")).toBeNull();
  });

  it("the objects in the slots, in arrival order; a lost one leaves its place to the next", () => {
    const store = atDay(1);
    for (const id of ["pager", "chick", "tape"]) store.appendEvent({ kind: "openLayer", objectId: id });
    const found = store.getState().found as string[];
    const ctx = ctxOf(store);
    const out = render(ctx);
    found.forEach((id, i) => expect(placed(out, `object:${id}`), id).toBe(rectStyle(objectSlot(deskLayout, i)!)));
    expect(out).toContain(`data-at="object:${found[0]}" style="${rectStyle(objectSlot(deskLayout, 0)!)}"><button type="button" class="slot unknown pointer-once" data-object="${found[0]}" data-action="loop-hold">`);
    const lost = renderRoom({ state: { ...store.getState(), lost: [found[0]!] }, events: store.getEvents(), session: ctx.session }).value;
    expect(placed(lost, `object:${found[0]}`)).toBeNull();
    expect(placed(lost, `object:${found[1]}`)).toBe(rectStyle(objectSlot(deskLayout, 0)!));
  });

  it("only at 桌子: 房间 and 门 have no tabletop", () => {
    for (const view of ["room", "door"] as const) expect(render(ctxOf(atDay(1), view))).not.toContain('class="desk-things"');
  });
});

describe("the meal, the box and the slip", () => {
  it("the meal: nothing before 去拿; the food after; eaten, its empty box stays at the same place", () => {
    const store = atDay(1);
    completeUntil(store, "pickup");
    expect(placed(render(ctxOf(store)), "meal")).toBeNull();
    completeUntil(store, "eat");
    const ctx = ctxOf(store);
    const out = render(ctx);
    expect(placed(out, "meal")).toBe(rectStyle(deskLayout.meal));
    expect(out).toMatch(/data-at="meal" style="[^"]+"><button type="button" class="slot meal" data-action="loop-eat" data-meal="lunch"/);
    act(ctx, "loop-eat", { meal: "lunch" });
    const after = render(ctx);
    expect(placed(after, "meal")).toBe(rectStyle(deskLayout.meal));
    expect(after).toMatch(/data-at="meal" style="[^"]+"><div class="slot meal done" data-meal="lunch">/);
  });

  it("the box: its layers left, then empty; clicking it opens today's layer", () => {
    const store = atDay(1);
    const ctx = ctxOf(store);
    // Total is the number of objects that can arrive (read from the data, not hard-coded).
    const totalObjects = Object.keys((stagesFile as { objectsFoundOnDay: Record<string, number> }).objectsFoundOnDay).length;
    expect(render(ctx)).toContain(t("hud.box.left", { n: totalObjects }));
    completeUntil(store, "box");
    act(ctx, "loop-box");
    expect(render(ctx)).toContain(t("hud.box.left", { n: totalObjects - 1 }));
  });

  it("the slip: on day 18 by the lamp once its line is open; reading it opens 屏幕's 工作台; it stays", () => {
    const last = constants.lastDay as number;
    const store = atDay(last);
    const ctx = ctxOf(store);
    expect(placed(render(ctx), "slip")).toBeNull();
    completeUntil(store, SLIP_ITEM);
    const out = render(ctx);
    expect(placed(out, "slip")).toBe(rectStyle(deskLayout.slip));
    expect(out).toMatch(/data-at="slip" style="[^"]+"><button type="button" class="slot slip" data-action="desk-slip" aria-label="[^"]+">/);
    act(ctx, "desk-slip");
    expect(ctx.session.view).toBe("desktop");
    expect(ctx.session.leftApp).toBe("workbench");
    // Read: it stays on the desk; clicking again does nothing.
    const lc = loopContext(store.getState(), store.getEvents())!;
    const item = lc.file.items.find((it) => it.id === SLIP_ITEM)!;
    if (item.done.kind === "flag") store.appendEvent({ kind: "task", flag: item.done.flag, mode: "self" });
    expect(itemStates(loopContext(store.getState(), store.getEvents())!).get(SLIP_ITEM)!.done).toBe(true);
    const back = ctxOf(store);
    expect(placed(render(back), "slip")).toBe(rectStyle(deskLayout.slip));
    act(back, "desk-slip");
    expect(back.session.view).toBe("desk");
    // Not on other days.
    expect(placed(render(ctxOf(atDay(last - 1))), "slip")).toBeNull();
  });
});

describe("道具: the strip as a panel", () => {
  it("the button next to ⚙ opens the strip over the current view; it or Esc closes it", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    for (const view of ["room", "desk", "door", "desktop"] as const) {
      const ctx = ctxOf(store, view);
      const before = render(ctx);
      expect(before, view).toContain(`data-action="items-toggle" aria-expanded="false" aria-controls="items-panel">${t("hud.items")}</button>`);
      expect(before).not.toContain('class="items-panel"');
      act(ctx, "items-toggle");
      const open = render(ctx);
      expect(open).toContain(`<div class="items-panel" id="items-panel" role="dialog" aria-label="${t("hud.items")}"><div class="items-strip">`);
      expect(open).toContain(`aria-expanded="true" aria-controls="items-panel">${t("hud.itemsClose")}</button>`);
      const strip = open.slice(open.indexOf('class="items-strip"'));
      for (const a of ['data-action="loop-box"', 'data-action="loop-phone"', 'data-object="pager" data-action="loop-hold"']) expect(strip, view).toContain(a);
      act(ctx, "items-toggle");
      expect(render(ctx)).not.toContain('class="items-panel"');
      act(ctx, "items-toggle");
      expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
      expect(ctx.session.itemsOpen).toBe(false);
    }
  });

  it("lifting from the strip closes it; on 屏幕 or 门 the camera goes to 桌子 first, where it is held", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    for (const view of ["desktop", "door", "room"] as const) {
      const ctx = ctxOf(store, view);
      act(ctx, "items-toggle");
      act(ctx, "loop-hold", { object: "pager" });
      expect(ctx.session.itemsOpen).toBe(false);
      expect(ctx.session.holding).toBe("pager");
      expect(ctx.session.view).toBe(view === "room" ? "room" : "desk");
      expect(render(ctx)).toContain('class="held-layer" data-held="pager"');
      const phone = ctxOf(store, view);
      act(phone, "items-toggle");
      act(phone, "loop-phone");
      expect(phone.session.phoneOpen).toBe(true);
      expect(phone.session.itemsOpen).toBe(false);
    }
  });

  it("a view change closes it", () => {
    const ctx = ctxOf(atDay(1), "room");
    act(ctx, "items-toggle");
    act(ctx, "view", { view: "desk" });
    expect(ctx.session.itemsOpen).toBe(false);
  });
});
