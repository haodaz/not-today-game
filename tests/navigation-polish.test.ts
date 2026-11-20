// navigation-polish (author's playtest, 2026-11-16): 离开屏幕 at the stage's left edge instead of the
// dock's room tile; leaving the screen lands on 桌子; the checklist shows the current item first with
// a marker, the other open items dimmed, no done items and no done count.
import "./specimen";
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { leaveControl } from "@world/desktop/shell";
import { checklist, checklistDoneCount, loopContext } from "@world/loop/checklist";
import { checklistNow, guidedItem, renderChecklist } from "@world/room/hud";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { t } from "@world/i18n";

const step = (name: string, at = "09:03"): EventDraft => ({ kind: "step", name, t: at });
function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: day });
  for (const d of drafts) store.appendEvent(d);
  return store;
}
function rig(store: Store, view: Session["view"] = "room") {
  const session = initialSession(DEFAULT_CLOCK, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const go = (to: Session["view"]) => loopActions.view!(ctx, { view: to } as DOMStringMap, null as never);
  const esc = () => loopKeys(ctx, { key: "Escape" } as KeyboardEvent);
  const out = () => renderGame(store, session, 0).value;
  return { ctx, session, go, esc, out };
}
/** The run's first desktop visit is over (no coach marks). */
const past = (s: Session) => {
  s.onboard = "done" as Session["onboard"];
  s.onboardStep = null as never;
};

describe("离开屏幕", () => {
  it("the dock has no room tile; the leave control is on the screen, off the monitor, with view desk and the string", () => {
    const store = storeAt(1, [step("rise"), step("boot")]);
    const r = rig(store, "desktop");
    past(r.session);
    const out = r.out();
    const dock = /<div class="dock">.*?<\/div>/s.exec(out)![0];
    expect(dock).not.toContain("room-tile");
    expect(dock).not.toContain('data-view="room"');
    expect(dock).not.toMatch(/^<div class="dock"><span class="sep/);
    expect(dock).toContain('data-action="settings-open"');
    expect(out).toContain(leaveControl().value);
    expect(leaveControl().value).toContain('class="leave-screen" data-action="view" data-view="desk"');
    expect(leaveControl().value).toContain(`<span class="word">${t("desktop.leave")}</span>`);
    // outside the monitor: in the HUD's fixed layer, not inside .monitor
    const monitor = /<div class="monitor[^]*?<\/div><\/div>/.exec(out)?.[0] ?? "";
    expect(monitor).not.toContain("leave-screen");
    expect(out).not.toContain('data-action="view" data-view="room"');
  });

  it("absent while the coach marks are up (day 1's first visit)", () => {
    const store = storeAt(1, [step("rise"), step("boot")]);
    const r = rig(store, "room");
    r.session.onboard = "no"; // a new run: the first desktop visit brings the coach marks
    r.go("desktop");
    expect(r.session.onboard).toBe("due");
    // day1-playtest-1117 R4: the first visit's line first; the coach marks after it.
    loopActions["loop-advance"]!(r.ctx, {} as DOMStringMap, null as never);
    expect(r.out()).toContain('class="coach"');
    expect(r.out()).not.toContain("leave-screen");
  });

  it("the CSS: a vertical pill at the stage's left edge, centred, the word top to bottom, above the box's dim", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    const rule = /\.hud-host \.leave-screen\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toContain("position:fixed;left:12px;top:50%;transform:translateY(-50%)");
    expect(rule).toContain("width:36px;height:140px");
    expect(Number(/z-index:(\d+)/.exec(rule)![1])).toBeGreaterThan(41); // .dlg-layer is 41
    expect(css).toMatch(/\.leave-screen \.word\{writing-mode:vertical-rl/);
    expect(readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8")).not.toContain("room-tile");
  });
});

describe("where leaving lands", () => {
  it("leaving from the screen → 桌子; Esc on the screen → 桌子; Esc on 桌子 → 房间", () => {
    const store = storeAt(1, [step("rise"), step("boot")]);
    const r = rig(store, "desktop");
    past(r.session);
    r.go("desk");
    expect(r.session.view).toBe("desk");
    r.go("desktop");
    expect(r.session.view).toBe("desktop");
    r.session.cam = null;
    // Esc closes 工作台's sidebar first (it opens on the run's first look); then it steps out
    r.session.wbSidebar = false;
    r.session.wbTitleMenu = false;
    expect(r.esc()).toBe(true);
    expect(r.session.view).toBe("desk");
    r.session.cam = null;
    expect(r.esc()).toBe(true);
    expect(r.session.view).toBe("room");
  });
});

describe("the checklist", () => {
  const view = (store: Store) => checklist(loopContext(store.getState(), store.getEvents())!);
  const html = (store: Store) => renderChecklist(view(store)).value;

  it("one item open: one line under the heading, with the marker, nothing else (no done line)", () => {
    const store = storeAt(1, [step("rise"), step("boot")]);
    const out = html(store);
    expect(out).toBe(`<div class="list"><div class="h">${t("hud.today")}</div><div class="it now" data-id="msgs"><i class="mark" aria-hidden="true">▸</i>${dayFiles.get(1)!.items.find((i) => i.id === "msgs")!.text}</div></div>`);
    expect(out).not.toContain('class="done"');
    expect(out).not.toContain(t("hud.done", { n: 1 }));
    expect(checklistDoneCount(loopContext(store.getState(), store.getEvents())!)).toBe(2);
    expect("doneCount" in view(store)).toBe(false);
  });

  it("done items are absent; the current item leads with ▸; every other open item is `later` with no marker; a meal on its way comes last", () => {
    const store = storeAt(1, [step("rise"), step("boot"), step("openApp:msgs"), { kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }, { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" }]);
    const v = view(store);
    const items = dayFiles.get(1)!.items;
    for (const id of ["rise", "boot", "msgs", "reply"]) expect(v.lines.some((l) => l.id === id), id).toBe(false);
    expect(v.lines[0]!.state).toBe("now");
    expect(v.lines.filter((l) => l.state === "now")).toHaveLength(1);
    expect(v.lines.slice(1).every((l) => l.state !== "now")).toBe(true);
    // wait-card (2026-11-20): the meal on its way is not a line any more; the view says it is waiting
    expect(v.lines.some((l) => l.id === "lunch")).toBe(false);
    expect(v.waiting).toBe(true);
    const out = html(store);
    expect(out.match(/▸/g)).toHaveLength(1);
    expect(out).not.toMatch(/<i><\/i>/);
    for (const l of v.lines.slice(1).filter((x) => x.state === "later")) expect(out).toContain(`<div class="it later" data-id="${l.id}">`);
  });

  it("the current item is the guide's when it has one (the phone → the lunch order), else the first open required item", () => {
    const store = storeAt(1, [step("rise"), step("boot"), step("openApp:msgs"), { kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }]);
    const lc = loopContext(store.getState(), store.getEvents())!;
    expect(guidedItem(lc, { id: "G4", target: { kind: "phone" }, refuse: null, scope: "all" })).toBe("lunch");
    expect(guidedItem(lc, { id: "G7", target: { kind: "board", step: "lock" }, refuse: null, scope: "none" })).toBe("work");
    expect(guidedItem(lc, null)).toBeNull();
    expect(checklist(lc, "work").lines[0]).toMatchObject({ id: "work", state: "now" });
    expect(checklist(lc, "lunch").lines[0]).toMatchObject({ id: "lunch", state: "now" });
    // no guide: the first open required one leads
    const plain = checklist(lc).lines[0]!;
    const first = dayFiles.get(1)!.items.find((i) => i.id === plain.id || (plain.id === "work" && i.done.kind === "flag"))!;
    expect(first.required).toBe(true);
    // what the room shows goes through the guide
    const r = rig(store, "desk");
    expect(checklistNow(lc, store.getState(), store.getEvents(), r.session).lines[0]!.state).toBe("now");
  });
});
