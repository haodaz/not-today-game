// @vitest-environment happy-dom
// tingtalk (2026-11-04): 听听 / TingTalk holds the work threads; Hi信 the family; 工作台 home and the
// task pages. 工作台 on the left monitor, 听听 on the right by default. Windows move the macOS way
// (the green button's menu, a title-bar drag across the inner edge, 调度中心), and the placement is
// remembered for the run.
import { afterEach, describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { mountDesktop, shellActions, type ActionContext } from "@world/desktop/controller";
import { desktopActions } from "@world/desktop/actions";
import { buildShell, initialSession, type Session } from "@world/desktop/model";
import { defaultPlacement, loadPlacement, moveApp, PLACE_KEY, savePlacement, windowsOn } from "@world/desktop/placement";
import { APPS, renderDesktop } from "@world/desktop/shell";
import { acrossInnerEdge, createWindowDrag } from "@world/desktop/windrag";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const WORK: BeatClock = { beat: "work", time: "10:00" };
const booted = (day = 1): Store => {
  const store = createStore({ runId: "run-a", startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
};
const render = (store: Store, session: Session) => renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, 0, store.getStartDay())).value;
const ctxOf = (store: Store, session = initialSession(WORK, "left", "desktop")): ActionContext => ({ store, session, rerender: () => {}, later: () => {}, now: () => 0 });
/** The game's actions over the controller's built-in ones (as mountDesktop merges them). */
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => ({ ...shellActions, ...loopActions })[name]!(ctx, data as DOMStringMap, null as never);
const dom = (markup: string): HTMLElement => {
  const div = document.createElement("div");
  div.innerHTML = markup;
  return div;
};

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("R1 · two chat apps, one workbench; the default placement", () => {
  it("工作台 on the left monitor, 听听 on the right; Hi信 and the browser open on the left", () => {
    const s = initialSession(WORK);
    expect([s.leftApp, s.rightApp]).toEqual(["workbench", "tingtalk"]);
    expect(s.place).toEqual({ msgs: "left", tingtalk: "right", workbench: "left", browser: "left" });
    const store = booted();
    const right = render(store, { ...s, focus: "right" });
    expect(right).toContain('<div class="monitor" data-side="right" data-ring="software" data-app="tingtalk">');
    expect(right).toContain(`<span class="title">${t("tingtalk.title")}</span>`);
    expect(render(store, s)).toContain('data-side="left" data-ring="software" data-app="workbench"');
  });

  it("the dock: 听听 and Hi信 tiles with their own unread; 工作台 has no 消息 rail item", () => {
    const store = booted();
    const page = dom(render(store, initialSession(WORK)));
    const tile = (app: string) => page.querySelector<HTMLElement>(`.dock [data-action="dock"][data-app="${app}"]`)!;
    expect(tile("tingtalk").title).toBe(t("dock.tingtalk"));
    expect(tile("msgs").title).toBe(t("dock.msgs"));
    expect(Number(tile("tingtalk").querySelector(".badge")!.textContent)).toBeGreaterThan(0);
    expect(tile("msgs").querySelector(".badge")).not.toBeNull();
    expect(tile("workbench").querySelector(".badge")).toBeNull();
    expect(page.querySelector('.wb-rail [data-page="msgs"]')).toBeNull();
  });

  it("auto-day selectors still work: [data-action=dock][data-app=tingtalk], [data-action=conv][data-conv=…]", () => {
    const store = booted();
    // The dock is on the left monitor (as before); 听听's conversations on the right one.
    expect(dom(render(store, initialSession(WORK))).querySelector("[data-action=dock][data-app=tingtalk]")).not.toBeNull();
    const page = dom(render(store, { ...initialSession(WORK), focus: "right" }));
    for (const id of ["boss", "partner", "group", "xiaozhang", "laozhou"]) expect(page.querySelector(`[data-action=conv][data-conv=${id}]`), id).not.toBeNull();
    expect(page.querySelector("[data-action=conv][data-conv=family]")).toBeNull();
  });

  it("a dock tile brings its window to the front on its monitor and shows that monitor", () => {
    const ctx = ctxOf(booted());
    act(ctx, "dock", { app: "tingtalk" });
    expect([ctx.session.focus, ctx.session.rightApp]).toEqual(["right", "tingtalk"]);
    act(ctx, "dock", { app: "msgs" });
    expect([ctx.session.focus, ctx.session.leftApp]).toEqual(["left", "msgs"]);
    act(ctx, "dock", { app: "workbench" });
    expect(ctx.session.leftApp).toBe("workbench");
  });
});

describe("R1b · moving a window to the other screen", () => {
  it("the green button's menu: 移到左屏 / 移到右屏, the current one disabled", () => {
    const page = dom(render(booted(), initialSession(WORK)));
    const items = [...page.querySelectorAll<HTMLButtonElement>('.win[data-win="workbench"] .tl-g .win-menu [data-action="win-move"]')];
    expect(items.map((b) => [b.dataset.side, b.textContent, b.disabled])).toEqual([
      ["left", t("win.moveLeft"), true],
      ["right", t("win.moveRight"), false],
    ]);
  });

  it("win-move moves the window, the view follows; the monitor it left shows its next window back, or nothing", () => {
    const store = booted();
    const ctx = ctxOf(store);
    act(ctx, "win-move", { app: "workbench", side: "right" });
    expect(ctx.session).toMatchObject({ focus: "right", rightApp: "workbench", leftApp: null });
    expect(ctx.session.place.workbench).toBe("right");
    // Both on one monitor: the one moved last is in front; the left display is empty.
    const left = render(store, { ...ctx.session, focus: "left" });
    expect(left).toContain('data-side="left" data-ring="software" data-app=""');
    expect(left).not.toContain('<div class="win');
    expect(windowsOn(ctx.session, "right")).toEqual(["workbench", "tingtalk"]);
    // The other tab lists the windows on that monitor, front first.
    expect(left).toMatch(/<button type="button" class="other-tab" data-side="right"[^>]*><span class="tab-app docs">[^<]*<\/span><span class="tab-app tt">/);
    act(ctx, "win-move", { app: "tingtalk", side: "left" });
    expect(ctx.session).toMatchObject({ focus: "left", leftApp: "tingtalk", rightApp: "workbench" });
    // Unknown apps and sides do nothing.
    act(ctx, "win-move", { app: "nope", side: "right" });
    act(ctx, "win-move", { app: "workbench", side: "up" });
    expect(ctx.session).toMatchObject({ leftApp: "tingtalk", rightApp: "workbench" });
  });

  it("moving onto its own monitor only brings it to the front", () => {
    const p = defaultPlacement();
    expect(moveApp(p, "workbench", "left")).toBe(false);
    expect(p).toMatchObject({ leftApp: "workbench", rightApp: "tingtalk" });
  });

  it("the title-bar drag: across the inner edge on release (left monitor's right edge, right monitor's left edge)", () => {
    const rect = { left: 0, right: 1440 };
    expect(acrossInnerEdge("left", 1440, rect)).toBe(true);
    expect(acrossInnerEdge("left", 1300, rect)).toBe(false);
    expect(acrossInnerEdge("right", 0, rect)).toBe(true);
    expect(acrossInnerEdge("right", 200, rect)).toBe(false);
    // The drag layer itself, on a monitor whose rect is known.
    const root = dom(render(booted(), initialSession(WORK)));
    document.body.appendChild(root);
    root.querySelector<HTMLElement>(".monitor")!.getBoundingClientRect = () => ({ left: 0, right: 1440, top: 0, bottom: 900, width: 1440, height: 900, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const runs: [string, Record<string, string>][] = [];
    const d = createWindowDrag(root, (name, data) => void runs.push([name, data]));
    const bar = root.querySelector<HTMLElement>('.bar[data-drag-win="workbench"]')!;
    const fire = (type: string, x: number, on: Element = bar) => on.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 20, button: 0, bubbles: true }));
    // A drag that stops short: nothing.
    fire("pointerdown", 600);
    fire("pointermove", 900);
    fire("pointerup", 900);
    expect(runs).toEqual([]);
    // Across the right edge: moves to the right monitor.
    fire("pointerdown", 600);
    fire("pointermove", 1440);
    fire("pointerup", 1440);
    expect(runs).toEqual([["win-move", { app: "workbench", side: "right" }]]);
    // A press on the traffic lights is not a drag.
    runs.length = 0;
    const green = root.querySelector<HTMLElement>(".tl-g button")!;
    fire("pointerdown", 600, green);
    fire("pointermove", 1440, green);
    fire("pointerup", 1440, green);
    expect(runs).toEqual([]);
    d.destroy();
  });

  it("remembered for the run (a reload, the next day); another run starts with the default", () => {
    const p = defaultPlacement();
    moveApp(p, "tingtalk", "left");
    savePlacement(localStorage, "run-a", p);
    expect(JSON.parse(localStorage.getItem(PLACE_KEY)!).runId).toBe("run-a");
    expect(loadPlacement(localStorage, "run-a", APPS)).toEqual({ place: { msgs: "left", tingtalk: "left", workbench: "left", browser: "left" }, stack: ["workbench", "tingtalk"], leftApp: "tingtalk", rightApp: null, onboard: "no" });
    expect(loadPlacement(localStorage, "run-b", APPS)).toBeNull();
    localStorage.setItem(PLACE_KEY, "{not json");
    expect(loadPlacement(localStorage, "run-a", APPS)).toBeNull();
  });

  it("the mounted desktop loads the run's placement and saves each change", async () => {
    const store = booted();
    const p = defaultPlacement();
    moveApp(p, "workbench", "right");
    savePlacement(localStorage, store.getRunId(), p);
    const root = document.createElement("div");
    document.body.appendChild(root);
    const m = mountDesktop(root, { store, clock: DEFAULT_CLOCK, actions: desktopActions, placement: { storage: localStorage, runId: store.getRunId() } });
    destroy = m.destroy;
    expect([m.session.leftApp, m.session.rightApp]).toEqual([null, "workbench"]);
    root.querySelector<HTMLElement>('[data-action="dock"][data-app="msgs"]')!.click();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(JSON.parse(localStorage.getItem(PLACE_KEY)!).leftApp).toBe("msgs");
  });
});

describe("R1b · 调度中心 / Mission Control", () => {
  it("the top-bar button opens it over both monitors: the two screens on top, every open window spread with its name", () => {
    const store = booted();
    const ctx = ctxOf(store);
    act(ctx, "mc-toggle");
    expect(ctx.session.mcOpen).toBe(true);
    const page = dom(render(store, ctx.session));
    const mc = page.querySelector<HTMLElement>(".mc")!;
    expect(mc.getAttribute("aria-label")).toBe(t("mc.title"));
    expect([...mc.querySelectorAll<HTMLElement>(".mc-screen")].map((s) => [s.dataset.mcDrop, s.querySelector(".mc-sname")!.textContent])).toEqual([
      ["left", t("desktop.screen.left")],
      ["right", t("desktop.screen.right")],
    ]);
    const wins = [...mc.querySelectorAll<HTMLElement>(".mc-win")];
    expect(wins.map((w) => [w.dataset.app, w.dataset.side, w.querySelector(".mc-name")!.textContent])).toEqual([
      ["workbench", "left", t("dock.workbench")],
      ["tingtalk", "right", t("dock.tingtalk")],
    ]);
    // Each is a scaled picture of the live window: nothing in it answers a click, no iframe loads.
    for (const w of wins) {
      expect(w.querySelector(".mc-scale .win")).not.toBeNull();
      expect(w.querySelector(".mc-scale [data-action]")).toBeNull();
      expect(w.querySelector(".mc-scale iframe")).toBeNull();
    }
    // Nothing else answers in it: no new desktops, no + button; each picture is inert.
    expect(mc.querySelectorAll("[data-action]").length).toBe(wins.length);
    for (const w of wins) expect(w.querySelector(".mc-scale")!.hasAttribute("inert")).toBe(true);
    expect(page.querySelector('.top [data-action="mc-toggle"]')!.getAttribute("aria-label")).toBe(t("mc.open"));
    act(ctx, "mc-toggle");
    expect(ctx.session.mcOpen).toBe(false);
  });

  it("click a window: 调度中心 closes and the window is focused (switching monitor)", () => {
    const store = booted();
    const ctx = ctxOf(store);
    ctx.session.mcOpen = true;
    act(ctx, "mc-focus", { app: "tingtalk" });
    expect(ctx.session).toMatchObject({ mcOpen: false, focus: "right", rightApp: "tingtalk" });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "openApp:msgs" });
  });

  it("drag a window onto a screen: it moves there; the release is not a click", () => {
    const store = booted();
    const session = { ...initialSession(WORK), mcOpen: true };
    const root = dom(render(store, session));
    document.body.appendChild(root);
    const runs: [string, Record<string, string>][] = [];
    const d = createWindowDrag(root, (name, data) => void runs.push([name, data]));
    const win = root.querySelector<HTMLElement>('.mc-win[data-app="workbench"]')!;
    const right = root.querySelector<HTMLElement>('.mc-screen[data-mc-drop="right"]')!;
    document.elementFromPoint = () => right;
    const fire = (type: string, x: number) => win.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 300, button: 0, bubbles: true }));
    fire("pointerdown", 100);
    fire("pointermove", 400);
    fire("pointerup", 400);
    expect(runs).toEqual([["win-move", { app: "workbench", side: "right" }]]);
    // The click after the drop is swallowed.
    let clicked = false;
    root.addEventListener("click", () => (clicked = true));
    win.click();
    expect(clicked).toBe(false);
    d.destroy();
  });

  it("F3 opens and closes it; Esc closes it first", () => {
    const store = booted();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const m = mountDesktop(root, { store, clock: DEFAULT_CLOCK, actions: desktopActions });
    destroy = m.destroy;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F3" }));
    expect(m.session.mcOpen).toBe(true);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(m.session.mcOpen).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F3" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "F3" }));
    expect(m.session.mcOpen).toBe(false);
  });

  it("only on 屏幕", () => {
    const ctx = ctxOf(booted(), initialSession(WORK, "left", "room"));
    shellActions["mc-toggle"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.mcOpen).toBe(false);
  });
});
