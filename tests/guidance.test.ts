// guidance (2026-11-07, the author's day-1 playtest): R15 the screen is the whole frame; R1 / R2 the
// guide state and its six moments; R3 windows close and the dock on both monitors; R4 one Kuro on
// the screen; R5 the checklist on the desktop; R6 工作台's home; R7 the task page; R8 the phone hint;
// R9 the reply rule; R10 the deliverable's sender; R11 the kept iframe; R12 {dish}; R13 the case and
// the view; R14 heads and tails.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pastTasks } from "@state/days/past";
import { taskByFlag } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import { bodyState } from "@world/desktop/kuro/body";
import type { ActionContext } from "@world/desktop/controller";
import { guideBlocks } from "@world/desktop/controller";
import { greetingKeyAt, type BeatClock } from "@world/desktop/beat";
import { initialSession, type Session } from "@world/desktop/model";
import { setViviLockForTests } from "@world/desktop/vivi";
import { WINDOW_RECT } from "@world/desktop/shell";
import { transcript } from "@world/desktop/messages/transcript";
import { fillDish } from "@world/delivery/view";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { guideNow, guideRefuses, withRing } from "@world/loop/guide";
import { syncLoop, taskStartKey } from "@world/loop/runtime";
import { loopActions, renderGame } from "@world/room/game";
import { completeItem, completeUntil } from "./complete-items";
import { dayFiles } from "@state/days/table";

const WORK: BeatClock = { beat: "work", time: "10:00" };
/** Today's lunch ordered (ends G4, lunch first). */
const orderLunch = (store: Store) => expect(completeItem(store, dayFiles.get(store.getState().day)!.items.find((it) => it.id === "lunch")!)).toBe(true);
afterEach(() => setViviLockForTests(undefined));

function rig(store: Store, view: Session["view"] = "desktop", clock: BeatClock = WORK) {
  const session = initialSession(clock, "left", view);
  session.onboard = "done";
  let now = 1_000;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => renderGame(store, session, now).value;
  const keys = () => session.dialogue.queue.map((q) => q.key);
  return { ctx, session, act, out, keys, tick: (ms: number) => void (now += ms) };
}
/** Day 1, the tower on (the first item done), 听听 not opened yet. */
function booted(): Store {
  const store = createStore({ startDay: 1 });
  completeUntil(store, "msgs");
  return store;
}
const open = (store: Store, target: string) => store.appendEvent({ kind: "open", target, t: "10:00" });
const step = (store: Store, name: string) => store.appendEvent({ kind: "step", name, t: "10:00" });

// ——— R15 ———

describe("R15 · the screen is the whole frame", () => {
  it("no floating 回房间 or ⚙; the window fills under the top bar down to the dock; 回房间 and 设置 are dock tiles that act", () => {
    const r = rig(booted());
    r.session.leftApp = "workbench";
    const out = r.out();
    expect(out).not.toContain('class="back-room"');
    expect(out).not.toContain('class="settings-btn"');
    expect(WINDOW_RECT).toEqual({ left: 0, top: 28, width: 1440, height: 800 });
    expect(out).toContain(`data-win="workbench" style="left:0px;top:28px;width:1440px;height:800px"`);
    const dock = /<div class="dock">.*?<\/div>/s.exec(out)![0];
    expect(dock).toMatch(/^<div class="dock"><button type="button" class="app nav room-tile" data-action="view" data-view="room"/);
    expect(dock).toMatch(/class="app nav settings-tile" data-action="settings-open"[^>]*>[^]*<\/button><\/div>$/);
    r.act("settings-open");
    expect(r.session.settingsOpen).toBe(true);
    r.act("view", { view: "room" });
    expect(r.session.view).toBe("room");
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain(".stage.one-monitor{padding:0;gap:0}");
    expect(css).toContain(".stage.one-monitor > .monitor{border-radius:0;box-shadow:none}");
    expect(css).toMatch(/\.top\{height:28px;/);
  });
});

// ——— R1 / R2 ———

describe("R1 / R2 · the guide state and the six moments", () => {
  it("G1: day 1 standing before the tower: the tower is lit (no new refusal); off once it is on", () => {
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room");
    expect(guideNow(store.getState(), store.getEvents(), r.session)).toMatchObject({ id: "G1", target: { kind: "tower" }, refuse: null });
    const out = r.out();
    expect(out.match(/data-guide="on"/g)).toHaveLength(1);
    expect(out).toMatch(/data-action="tower-power"[^>]*data-guide="on"/);
    r.act("tower-power");
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G1");
  });

  it("G2: the first desktop visit: 汀汀's tile is lit; any other tile answers guide.work.first and does nothing; off once 听听 is open", () => {
    const store = booted();
    const r = rig(store);
    r.session.leftApp = null;
    r.session.rightApp = null;
    expect(guideNow(store.getState(), store.getEvents(), r.session)).toMatchObject({ id: "G2", target: { kind: "dock", app: "tingtalk" }, refuse: "guide.work.first" });
    const out = r.out();
    expect(out.match(/data-guide="on"/g)).toHaveLength(1);
    expect(out).toMatch(/data-action="dock" data-app="tingtalk"[^>]*data-guide="on"/);
    const events = store.getEvents().length;
    expect(guideBlocks(r.ctx, "dock", { app: "workbench" })).toBe(true);
    expect(r.session.dialogue.queue).toEqual([{ key: "d1:guide:G2", lines: [{ k: "inner", t: t("guide.work.first") }], ending: { kind: "none" } }]);
    expect(r.session.leftApp).toBeNull();
    expect(store.getEvents()).toHaveLength(events);
    // The target and the always-allowed answer.
    expect(guideBlocks(r.ctx, "dock", { app: "tingtalk" })).toBe(false);
    expect(guideBlocks(r.ctx, "view", { view: "room" })).toBe(false);
    expect(guideBlocks(r.ctx, "settings-open", {})).toBe(false);
    step(store, "openApp:msgs");
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G2");
  });

  it("G3: day 1, 听听 open, the boss not read: the 老板 row is lit, the pane is empty; other rows refuse guide.boss.first; off once it is opened", () => {
    const store = booted();
    step(store, "openApp:msgs");
    const r = rig(store);
    r.session.focus = "right";
    r.session.rightApp = "tingtalk";
    expect(guideNow(store.getState(), store.getEvents(), r.session)).toMatchObject({ id: "G3", target: { kind: "conv", id: "boss" }, refuse: "guide.boss.first" });
    const out = r.out();
    expect(out).toContain('<div class="conv empty"></div>');
    expect(out).toMatch(/data-action="conv" data-conv="boss"[^>]*data-guide="on"/);
    expect(guideRefuses(guideNow(store.getState(), store.getEvents(), r.session), "conv", { conv: "group" })).toBe(true);
    expect(guideRefuses(guideNow(store.getState(), store.getEvents(), r.session), "conv", { conv: "boss" })).toBe(false);
    open(store, "conv:boss");
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G3");
  });

  it("G4: lunch first: the phone is lit at 桌子; on the desktop only the work's steps refuse guide.lunch.first; off once ordered", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    const desk = rig(store, "desk");
    expect(guideNow(store.getState(), store.getEvents(), desk.session)).toMatchObject({ id: "G4", target: { kind: "phone" }, refuse: "guide.lunch.first", scope: "work" });
    expect(desk.out()).toMatch(/data-action="loop-phone"[^>]*data-guide="on"/);
    const g = guideNow(store.getState(), store.getEvents(), rig(store).session);
    expect(g?.id).toBe("G4");
    expect(guideRefuses(g, "wb-send", {})).toBe(true);
    expect(guideRefuses(g, "wb-nav", { page: "task:task1" })).toBe(true);
    expect(guideRefuses(g, "wb-nav", { page: "home" })).toBe(false);
    expect(guideRefuses(g, "dock", { app: "workbench" })).toBe(false);
    orderLunch(store);
    expect(guideNow(store.getState(), store.getEvents(), desk.session)?.id).not.toBe("G4");
  });

  it("G5: Vivi's lock holds only once the boss was read today; its card (or row, or 汀汀) is lit", () => {
    const store = booted();
    const r = rig(store);
    // Not forced: before the boss, no lock (the real derivation).
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G5");
    setViviLockForTests("doc-x", "group");
    expect(guideNow(store.getState(), store.getEvents(), r.session)).toMatchObject({ id: "G5", target: { kind: "card", doc: "doc-x", conv: "group" }, refuse: "vivi.lock" });
    const html = withRing('<button data-action="dock" data-app="tingtalk"></button><button data-action="conv" data-conv="group"></button>', guideNow(store.getState(), store.getEvents(), r.session));
    expect(html).toBe('<button data-action="dock" data-app="tingtalk"></button><button data-action="conv" data-conv="group" data-guide="on"></button>');
    open(store, "file:doc-x");
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G5");
  });

  it("G6: a self read of a conflict: each unclicked clause is ringed; nothing is refused; off once both are clicked", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    completeUntil(store, "task1");
    const r = rig(store);
    r.session.workbenchPage = "task:task1";
    r.act("wb-send");
    r.act("wb-choose", { mode: "self" });
    const g = guideNow(store.getState(), store.getEvents(), r.session)!;
    const conflict = taskByFlag(1, "task_v17_done")!.doc!.conflict;
    expect(g).toMatchObject({ id: "G6", target: { kind: "clauses", indexes: conflict }, refuse: null });
    expect(guideRefuses(g, "dock", { app: "msgs" })).toBe(false);
    for (const i of conflict) r.act("wb-clause", { i: String(i) });
    expect(guideNow(store.getState(), store.getEvents(), r.session)?.id).not.toBe("G6");
  });
});

// ——— R3 ———

describe("R3 · windows close; the dock on both monitors; the doc page's ×", () => {
  it("red closes (the next window comes up), yellow minimises; the dock is on the right monitor too", () => {
    const store = booted();
    const r = rig(store);
    r.session.stack = ["msgs", "workbench"];
    r.session.leftApp = "workbench";
    r.act("win-close", { app: "workbench" });
    expect(r.session.leftApp).toBe("msgs");
    expect(r.session.stack).toEqual(["msgs"]);
    r.act("win-min", { app: "msgs" });
    expect(r.session.leftApp).toBeNull();
    r.session.focus = "right";
    r.session.rightApp = "tingtalk";
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    expect(r.out()).toContain('<div class="dock">');
  });

  it("the doc page has no ×; ‹ in the bar goes back to the news page", () => {
    const store = booted();
    const r = rig(store);
    r.session.leftApp = "browser";
    r.session.browserDoc = "/docs/x.html";
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    const out = r.out();
    expect(out).not.toContain('data-action="br-doc-close"');
    expect(out).toContain('data-action="br-back"');
    // R11: the frame is kept across renders.
    expect(out).toContain('data-keep="doc:/docs/x.html"');
    r.act("br-back");
    expect(r.session.browserDoc).toBeNull();
  });
});

// ——— R4 / R5 ———

describe("R4 / R5 · one Kuro on the screen; the checklist there", () => {
  it("no stage Kuro body on the desktop; the pet carries kuro-call and the one body slot; the checklist card is drawn", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    const r = rig(store);
    const out = r.out();
    expect(out).not.toContain('class="hud-br"');
    expect(out).toMatch(/<button type="button" class="kpet-btn[^"]*" data-action="kuro-call"[^>]*><span class="kpet" data-kuro-slot/);
    expect(out.match(/data-kuro-slot/g)).toHaveLength(1);
    // R5 (2026-11-08): the checklist's current line is in the top bar, not a card over the window.
    expect(out).not.toContain('class="os-list"');
    expect(out).toMatch(/<span class="next-item"><i aria-hidden="true"><\/i>[^<]+<\/span>/);
  });

  it("a Kuro line on the desktop: the pet talks; the box's portrait is a still; the box's class list is the room's", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    orderLunch(store);
    const r = rig(store);
    r.session.dialogue = push(EMPTY_DIALOGUE, { key: "kuro:1:1", lines: [{ k: "speaker", who: t("kuro.name"), t: "x" }], ending: { kind: "none" }, voice: "kuro" });
    const out = r.out();
    expect(out).toMatch(/class="kpet-btn[^"]*"[^>]*><span class="kpet" data-kuro-slot data-state="talk"/);
    expect(out.match(/data-kuro-slot/g)).toHaveLength(1);
    expect(out).toContain('class="kpet kuro-portrait still"');
    const roomOut = rig(store, "room").out();
    const dlgClass = (s: string) => /<div class="(dlg(?: [^"]*)?)"/.exec(s)?.[1];
    expect(dlgClass(out)).toMatch(/^dlg tagged kuro/);
    const room2 = rig(store, "room");
    room2.session.dialogue = r.session.dialogue;
    expect(dlgClass(out)).toBe(dlgClass(room2.out()));
    expect(roomOut).toBeTruthy();
  });

  it("the states in order: maw > rest > busy > happy > crawl > think > talk > idle; happy after 已交, think while a guide is on", () => {
    const base = { night: false, taskRunning: false, saidPretty: false, moving: false, waiting: false, talking: false };
    expect(bodyState({ ...base, talking: true })).toBe("talk");
    expect(bodyState({ ...base, talking: true, waiting: true })).toBe("think");
    expect(bodyState({ ...base, waiting: true, moving: true })).toBe("crawl");
    expect(bodyState({ ...base, moving: true, saidPretty: true })).toBe("happy");
    expect(bodyState({ ...base, saidPretty: true, taskRunning: true })).toBe("busy");
    expect(bodyState({ ...base, taskRunning: true, night: true })).toBe("rest");
    expect(bodyState({ ...base, night: true, maw: "maw" })).toBe("maw");
    // think while a guide is on (G2).
    const store = booted();
    const r = rig(store);
    expect(r.out()).toMatch(/class="kpet" data-kuro-slot data-state="think"/);
    // happy after 已交 (a task event appended by an action).
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    completeUntil(store, "task1");
    r.session.workbenchPage = "task:task1";
    r.act("wb-send");
    r.act("wb-choose", { mode: "let" });
    r.tick(5000);
    r.act("wb-pass");
    expect(r.session.happyUntil).toBeGreaterThan(5000);
  });
});

// ——— R6 / R7 ———

describe("R6 / R7 · 工作台's home and the task page", () => {
  it("the sidebar is open on the run's first open; the past rows; no empty cards; the greeting by the clock", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    const r = rig(store, "room");
    r.session.leftApp = "workbench";
    r.act("view", { view: "desktop" });
    expect(r.session.wbSidebar).toBe(true);
    const out = r.out();
    for (const p of pastTasks("zh")) expect(out).toContain(`data-action="wb-past" data-past="${p.id}"`);
    r.act("wb-past", { past: "past-1" });
    expect(r.out()).toContain('<div class="wb-past-thread" data-past="past-1">');
    expect(greetingKeyAt("12:04")).toBe("wb.hello.afternoon");
    expect(greetingKeyAt("09:03")).toBe("wb.hello.morning");
    expect(greetingKeyAt("19:00")).toBe("wb.hello.evening");
    expect(r.out()).toContain(`<h1>${t("wb.hello.morning")}</h1>`);
  });

  it("a task page has no text box; the start narration plays on open; Kuro's busy bubble says wb.busy", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    completeUntil(store, "task1");
    const r = rig(store);
    r.session.leftApp = "workbench";
    r.act("wb-nav", { page: "task:task1" });
    expect(r.keys()).toContain(taskStartKey(1, "task1"));
    r.session.dialogue = EMPTY_DIALOGUE;
    expect(r.out()).not.toContain("input class=\"ph\"");
    expect(r.out()).toContain('data-action="wb-send" data-task="task1"');
    r.act("wb-send");
    r.act("wb-choose", { mode: "look" });
    expect(r.out()).toContain(t("wb.busy"));
  });
});

// ——— R8–R13 ———

describe("R8–R13", () => {
  it("R8: the put-down hint is under the phone (the phone's bottom edge at 800 of 900 px)", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    const [, bottom, lh] = /\.room \.held-layer\.phone-up \.hint\{bottom:(\d+)px;line-height:(\d+)px\}/.exec(css)!;
    const top = 900 - Number(bottom) - Number(lh);
    expect(top).toBeGreaterThan(800);
  });

  it("R9: a thread with no hint of its own says 能说的就这四句。 once (until it is left)", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    const r = rig(store);
    r.session.focus = "right";
    r.session.rightApp = "tingtalk";
    r.act("conv", { conv: "group" });
    expect(r.out()).toContain(t("reply.hint.other"));
    r.act("conv", { conv: "boss" });
    r.act("conv", { conv: "group" });
    expect(r.out()).not.toContain(t("reply.hint.other"));
  });

  it("R10: day 1's 全员 card is Vivi's bubble, its title without the 「Vivi：」 prefix", () => {
    const store = createStore({ startDay: 1 });
    const bubbles = transcript({ conversation: "group", state: store.getState(), clock: { beat: "night", time: "23:59" }, replies: [], progress: new Map() } as never);
    const card = bubbles.find((b) => b.kind === "msg" && b.body.type === "deliverable");
    expect(card).toMatchObject({ who: "partner" });
    expect(card && card.kind === "msg" && card.body.type === "deliverable" ? card.body.raw : "").not.toMatch(/^Vivi：/);
  });

  it("R12: {dish} is the ordered dish", () => {
    expect(fillDish("{dish} · 备注：别放香菜", { order: { shopId: "s", itemId: "i", itemName: "沙县拌面", by: null } })).toBe("沙县拌面 · 备注：别放香菜");
  });

  it("R13: a view change closes the case", () => {
    const r = rig(createStore({ startDay: 2 }), "room");
    r.session.caseOpen = true;
    r.act("view", { view: "door" });
    expect(r.session.caseOpen).toBe(false);
    r.session.view = "room";
    r.session.caseOpen = true;
    r.act("turn", { dir: "right" });
    expect(r.session.caseOpen).toBe(false);
  });
});

// ——— R14 ———

describe("R14 · heads and tails", () => {
  it("Vivi's page: vivi.back, then the page closes and the app before it is in front again", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    setViviLockForTests("doc-x", "group");
    const r = rig(store);
    r.session.focus = "right";
    r.session.rightApp = "tingtalk";
    r.session.place = { ...r.session.place, browser: "right" };
    r.act("open-deliverable", { doc: "doc-x" });
    expect(r.session.rightApp).toBe("browser");
    expect(r.keys()).toContain("d1:vivi:back");
    while (r.session.dialogue.queue.length) r.act("loop-advance");
    expect(r.session.browserDoc).toBeNull();
    expect(r.session.rightApp).toBe("tingtalk");
  });

  it("the doorbell: its last line takes the camera to 门, from a facing and from the desktop", () => {
    for (const view of ["window", "desktop"] as const) {
      const store = booted();
      step(store, "openApp:msgs");
      open(store, "conv:boss");
      const r = rig(store, view);
      syncLoop(r.ctx, 0);
      r.session.dialogue = EMPTY_DIALOGUE;
      completeUntil(store, "pickup");
      syncLoop(r.ctx, 0);
      expect(r.keys(), view).toContain("d1:door:lunch:leave");
      r.session.dialogue = { queue: r.session.dialogue.queue.filter((q) => q.key.startsWith("d1:door:lunch")), line: 0 };
      while (r.session.dialogue.queue.length) r.act("loop-advance");
      // From a facing the turn to 门; from the screen the way out starts (回房间 first, then 门).
      expect(r.session.view, view).toBe(view === "window" ? "door" : "room");
    }
  });

  it("a task sent: its closing lines read, 工作台 is home with the next task's row lit", () => {
    const store = booted();
    step(store, "openApp:msgs");
    open(store, "conv:boss");
    orderLunch(store);
    completeUntil(store, "task1");
    const r = rig(store);
    r.session.leftApp = "workbench";
    syncLoop(r.ctx, 0);
    r.act("wb-nav", { page: "task:task1" });
    r.act("wb-send");
    r.act("wb-choose", { mode: "let" });
    r.tick(5000);
    r.act("wb-pass");
    syncLoop(r.ctx, 0);
    r.session.dialogue = { queue: r.session.dialogue.queue.filter((q) => q.key === "d1:task:task1"), line: 0 };
    expect(r.session.dialogue.queue[0]?.ending).toEqual({ kind: "taskHome" });
    while (r.session.dialogue.queue.length) r.act("loop-advance");
    expect(r.session.workbenchPage).toBe("home");
    const g = guideNow(store.getState(), store.getEvents(), r.session);
    expect(g?.id).toBe("next");
    expect(r.out()).toMatch(new RegExp(`data-action="wb-nav" data-page="task:${g!.target.kind === "task" ? g!.target.id : ""}"[^>]*data-guide="on"`));
  });
});
