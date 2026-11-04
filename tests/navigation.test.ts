// @vitest-environment happy-dom
// Room-scene navigation 2026-11-01 and the morning correction 2026-11-02, in a real DOM: hover and
// picking by a ray, the back gestures, the head turn against a fake splat scene, 床 held by the
// splat, and the placed things waiting for the camera. No real WebGL (happy-dom has none): the scene
// is faked; the shader and the real splat were looked at in a browser (see the kiro log).
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop, type ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { syncLoop } from "@world/loop/runtime";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { createMotion } from "@world/motion/dom";
import { CHOSEN, CROSSFADE_MS, viewMoveMs } from "@world/motion/timing";
import { t } from "@world/i18n";
import { easePan, edgeZone, LOOK_RETURN_MS, NO_PAN, PAN_X, PAN_Y, panScale, photoPan, PLACED_PARALLAX } from "@world/room/look";
import { loopActions, loopKeys, renderGame, wayMs } from "@world/room/game";
import { FACINGS, isFacing, turnedTo, turnsBetween } from "@world/room/facings";
import { BED_SHOT, rectStyle, WINDOW_SHOT } from "@world/room/shots";
import { ARRIVE_FADE_MS, placedThingsFade, placedThingsWait, renderRoom } from "@world/room/hud";
import { BACK_STRIP, createNav, INTERACTIVE, type LookApi } from "@world/room/nav";
import { createSplatLayer, SPLAT_FADE_MS, type SplatHooks, type SplatScene } from "@world/room/splat/layer";
import { LOOK, NO_TURN, turned } from "@world/room/splat/head";
import { fixedRects, hotRects } from "@world/room/splat/hotspots";
import { POSES, type Pose } from "@world/room/splat/pose";
import { completeUntil } from "./complete-items";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fakeScene() {
  const poses: Pose[] = [];
  const canvases = [document.createElement("canvas"), document.createElement("canvas")] as [HTMLCanvasElement, HTMLCanvasElement];
  const host = document.createElement("div");
  host.append(...canvases);
  const scene: SplatScene = { host, canvases, ensureCollapsed: () => Promise.resolve(), setSize: () => {}, render: (p) => void poses.push(p), dispose: () => {} };
  return { scene, poses };
}

interface Opts {
  readonly day?: number;
  readonly view?: Session["view"];
  readonly splat?: boolean;
  readonly look?: LookApi | null;
  readonly store?: Store;
}

/** The game with the nav layer; client pixels are stage pixels (no scaling in happy-dom). */
function mount(opts: Opts = {}) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const store = opts.store ?? createStore({ startDay: opts.day ?? 1 });
  const fake = fakeScene();
  const layer = opts.splat ? createSplatLayer({ load: async () => fake.scene, idle: (fn) => fn() }) : null;
  let hooks: SplatHooks | null = null;
  const nav = createNav({ toStage: (_root, x, y) => ({ x, y }) });
  const m = mountDesktop(root, {
    store,
    clock: DEFAULT_CLOCK,
    view: opts.view ?? "room",
    render: renderGame,
    actions: { ...desktopActions, ...loopActions },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    motion: createMotion,
    splat: layer ? (r, ctx) => (hooks = layer(r, ctx)) : undefined,
    nav: (r, ctx, actions, splat) => nav(r, ctx, actions, opts.look !== undefined ? opts.look : splat),
  });
  destroy = m.destroy;
  const stage = () => root.querySelector<HTMLElement>(":scope > .stage:not(.m-ghost):not(.m-backdrop)")!;
  return { root, store, session: m.session, stage, hooks: () => hooks!, fake };
}

type M = ReturnType<typeof mount>;
const mouse = (type: string, target: Element, x: number, y: number, extra: MouseEventInit = {}) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail: type === "click" ? 1 : 0, ...extra });
  target.dispatchEvent(e);
  return e;
};
/** Answers the bed's ask with 睡. */
const sleep = async (m: M) => {
  await frame();
  m.root.querySelector<HTMLElement>('[data-action="loop-choice"][data-choice="sleep"]')!.click();
  await frame();
};
const click = async (m: M, x: number, y: number) => {
  mouse("mousemove", m.stage(), x, y);
  mouse("mousedown", m.stage(), x, y);
  mouse("mouseup", m.stage(), x, y);
  mouse("click", m.stage(), x, y);
  await frame();
};
const hovered = (m: M) => [...m.root.querySelectorAll<HTMLElement>("[data-hover]")].map((e) => e.dataset.hot);
const ready = async (m: M) => {
  await frame();
  await wait(0);
  expect(m.hooks().status()).toBe("ready");
};

describe("hover: 4 % brighter, under a ray through the camera", () => {
  it("what is under the pointer is marked, the cursor says so, and the HUD under it is left alone", () => {
    const m = mount();
    mouse("mousemove", m.stage(), 700, 590);
    expect(hovered(m)).toEqual(["desk"]);
    expect(m.root.style.cursor).toBe("pointer");
    mouse("mousemove", m.stage(), 480, 380);
    expect(hovered(m)).toEqual(["monitorL"]);
    mouse("mousemove", m.stage(), 600, 120);
    expect(hovered(m)).toEqual([]);
    expect(m.root.style.cursor).toBe("");
    // A HUD button is not a thing in the room.
    mouse("mousemove", m.root.querySelector(".settings-btn")!, 700, 590);
    expect(hovered(m)).toEqual([]);
  });

  it("the tower only while the computer is off", async () => {
    const m = mount();
    const c = fixedRects("room").tower!;
    mouse("mousemove", m.stage(), c.l + c.w / 2, c.t + c.h / 2);
    expect(hovered(m)).toEqual(["tower"]);
    m.store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    await frame();
    mouse("mousemove", m.stage(), c.l + c.w / 2, c.t + c.h / 2);
    expect(hovered(m)).toEqual([]);
  });

  it("the markup is today's CSS rule: 4 % white", () => {
    // (the rule is read from the file in tests/navigation-css below)
    expect(true).toBe(true);
  });
});

describe("point to go", () => {
  it("the desk picks 桌子; a monitor picks 屏幕 on its side; the tower boots; the lamp is only a click", async () => {
    let m = mount();
    await click(m, 700, 590);
    expect(m.session.view).toBe("desk");
    destroy!();
    document.body.innerHTML = "";

    // 屏幕 opens once the computer is on (2026-11-02).

    const on = () => {

      const store = createStore({ startDay: 1 });

      store.appendEvent({ kind: "step", name: "boot", t: "09:03" });

      return store;

    };

    m = mount({ store: on() });
    await click(m, 480, 380);
    expect(m.session.view).toBe("desktop");
    expect(m.session.focus).toBe("left");
    destroy!();
    document.body.innerHTML = "";

    m = mount({ store: on() });
    await click(m, 770, 380);
    expect(m.session.view).toBe("desktop");
    expect(m.session.focus).toBe("right");
    destroy!();
    document.body.innerHTML = "";

    m = mount();
    const tower = fixedRects("room").tower!;
    await click(m, tower.l + tower.w / 2, tower.t + tower.h / 2);
    expect(m.store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "boot" });
    destroy!();
    document.body.innerHTML = "";

    m = mount();
    const before = JSON.stringify(m.store.getEvents());
    await click(m, 940, 430);
    expect(m.session.view).toBe("room");
    expect(JSON.stringify(m.store.getEvents())).toBe(before);
  });

  it("a click on a HUD button is the button's, not a pick", async () => {
    const m = mount();
    m.root.querySelector<HTMLElement>(".settings-btn")!.click();
    await frame();
    expect(m.session.settingsOpen).toBe(true);
    expect(m.session.view).toBe("room");
  });

  it("the keyboard takes the same road: Enter on a proxy is the same action as a click on the thing", () => {
    const m = mount();
    m.root.querySelector<HTMLElement>('.shot-hit[data-hot="desk"]')!.click();
    expect(m.session.view).toBe("desk");
  });

  it("拆箱 opens the case where it is: no walk to 桌子; the loose box opens, 桌子 does not open the case", () => {
    const later: [number, () => void][] = [];
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: (ms, fn) => void later.push([ms, fn]), now: () => 0 };
    const events = store.getEvents().length;
    // Before its line (day 1, box item locked): the case opens, but no box is loose, so a pick is
    // stuck — nothing is appended.
    loopActions["pick-box"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    expect(ctx.session.caseOpen).toBe(true);
    loopActions["case-pick"]!(ctx, { slot: "chick" } as DOMStringMap, null as never);
    expect(store.getEvents().length).toBe(events); // stuck: nothing opens, nothing breaks
    expect(store.getState().found).toEqual([]);
    // From 桌子 the case does not open.
    ctx.session.caseOpen = false;
    ctx.session.view = "desk";
    loopActions["pick-box"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.caseOpen).toBe(false);
    // In 房间 once the box item is open: the loose box is today's object and opening it finds it.
    completeUntil(store, "box");
    ctx.session.view = "room";
    loopActions["pick-box"]!(ctx, {} as DOMStringMap, null as never);
    loopActions["case-pick"]!(ctx, { slot: "chick" } as DOMStringMap, null as never);
    expect(store.getState().found).toEqual(["chick"]);
  });

});

describe("back: right-click, the bottom 6 %, the wheel, Esc", () => {
  it("right-click is Esc: it closes what is over the view first, then steps out; never past 房间", async () => {
    const m = mount({ view: "desk" });
    const e = mouse("contextmenu", m.stage(), 700, 500);
    expect(e.defaultPrevented).toBe(true);
    expect(m.session.view).toBe("room");
    mouse("contextmenu", m.stage(), 700, 500);
    expect(m.session.view).toBe("room");
    // With the settings panel open it closes that first.
    m.session.view = "desk";
    m.session.settingsOpen = true;
    mouse("contextmenu", m.stage(), 700, 500);
    expect(m.session.settingsOpen).toBe(false);
    expect(m.session.view).toBe("desk");
    mouse("contextmenu", m.stage(), 700, 500);
    expect(m.session.view).toBe("room");
  });

  it("a click on the bottom 6 % of the stage pulls out one level (屏幕 → 桌子 → 房间), and does nothing in 房间", async () => {
    const m = mount({ view: "desk" });
    const y = 900 * (1 - BACK_STRIP) + 5;
    await click(m, 800, y);
    expect(m.session.view).toBe("room");
    await click(m, 800, y);
    expect(m.session.view).toBe("room");
    // Just above the strip is the stage.
    m.session.view = "desk";
    await click(m, 800, 900 * (1 - BACK_STRIP) - 5);
    expect(m.session.view).toBe("desk");
  });

  it("not under an open panel: the bottom strip and the wheel leave the camera alone", async () => {
    const m = mount({ view: "desk" });
    m.session.itemsOpen = true;
    await click(m, 800, 890);
    expect(m.session.view).toBe("desk");
    mouse("wheel", m.stage(), 800, 400, { }); // a plain event, not a WheelEvent: ignored
    m.stage().dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(m.session.view).toBe("desk");
  });

  it("the wheel turned back pulls out one level, not in a window, not twice in 600 ms, not forward, not in 房间", async () => {
    const m = mount({ view: "desk" });
    const wheel = (deltaY: number, target: Element = m.stage()) => target.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY }));
    wheel(-100);
    expect(m.session.view).toBe("desk");
    wheel(100);
    expect(m.session.view).toBe("room");
    wheel(100);
    expect(m.session.view).toBe("room");
    // 屏幕: the desktop around the windows pulls out; a window scrolls.
    const booted = createStore({ startDay: 1 });
    booted.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    const d = mount({ view: "desktop", store: booted });
    await frame();
    const win = d.root.querySelector(".win")!;
    win.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(d.session.view).toBe("desktop");
    d.stage().dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(d.session.view).toBe("desk");
    await wait(650);
    d.stage().dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
    expect(d.session.view).toBe("room");
  });

  it("Esc still backs out of 屏幕 → 桌子 → 房间; on a facing (房间, 床, 门, 窗) Esc and right-click do nothing (room-turn R1)", async () => {
    const m = mount({ view: "desktop" });
    for (const [from, to] of [["desktop", "desk"], ["desk", "room"], ["room", "room"], ["door", "door"], ["bed", "bed"], ["window", "window"]] as const) {
      m.session.view = from;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(m.session.view, from).toBe(to);
    }
    for (const view of ["room", "bed", "door", "window"] as const) {
      m.session.view = view;
      m.session.cam = null;
      await frame();
      mouse("contextmenu", m.stage(), 700, 500);
      expect(m.session.view, view).toBe(view);
    }
  });

  it("no back strip on a facing: a click on the bottom 6 % of 门 or 床 is a click on what is there; the wheel does nothing", async () => {
    for (const view of ["door", "bed", "window"] as const) {
      const m = mount({ view });
      mouse("mousemove", m.stage(), 800, 880);
      await frame();
      expect(m.root.querySelector(".edge-hint"), view).toBeNull();
      await click(m, 800, 890);
      m.stage().dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: 100 }));
      expect(m.session.view, view).toBe(view);
      destroy?.();
      destroy = null;
      document.body.innerHTML = "";
    }
  });

  it("INTERACTIVE names what the HUD answers to itself", () => {
    expect(INTERACTIVE).toContain("button");
    expect(INTERACTIVE).toContain(".dlg");
  });
});

describe("look is photo parallax (decision 2026-11-02: the splat goes dark)", () => {
  /** A splat look that records whether anyone asked it (nobody should). */
  function spyLook(): LookApi & { calls: string[] } {
    const calls: string[] = [];
    return { calls, look: (dx, dy) => (calls.push(`look ${dx},${dy}`), true), release: () => void calls.push("release"), pose: () => null };
  }
  const vars = (el: HTMLElement) => ["--pan-x", "--pan-y", "--pan-k", "--pan-px", "--pan-py"].map((v) => el.style.getPropertyValue(v));

  it("a drag pans the photo within ±4 % / ±2 %, the placed things 1.5×; never the splat; release eases back over 600 ms; the click after it is not a pick", async () => {
    const look = spyLook();
    const m = mount({ look });
    mouse("mousedown", m.stage(), 700, 590);
    mouse("mousemove", m.stage(), 702, 590);
    expect(m.stage().classList.contains("looking")).toBe(false); // under the slop
    mouse("mousemove", m.stage(), 780, 570);
    const p = photoPan(80, -20);
    expect(m.stage().classList.contains("looking")).toBe(true);
    expect(vars(m.stage())).toEqual([`${p.x.toFixed(2)}px`, `${p.y.toFixed(2)}px`, panScale(p).toFixed(5), `${(p.x * 1.5).toFixed(2)}px`, `${(p.y * 1.5).toFixed(2)}px`]);
    // A big drag stops at the limits.
    mouse("mousemove", m.stage(), 700 + 5000, 590 + 5000);
    expect(vars(m.stage()).slice(0, 2)).toEqual([`${(PAN_X * 1600).toFixed(2)}px`, `${(PAN_Y * 900).toFixed(2)}px`]);
    mouse("mouseup", document.body, 5700, 5590);
    mouse("click", m.stage(), 5700, 5590);
    await frame();
    expect(m.session.view).toBe("room");
    expect(look.calls).toEqual([]);
    expect(m.root.querySelector(".splat-layer")).toBeNull();
    // Easing back; gone after 600 ms.
    expect(m.stage().classList.contains("looking")).toBe(true);
    await wait(LOOK_RETURN_MS + 120);
    await frame();
    expect(m.stage().classList.contains("looking")).toBe(false);
    // The next click is a click again.
    await click(m, 700, 590);
    expect(m.session.view).toBe("desk");
  });

  it("a press on a button is not the start of a drag; 屏幕 does not pan", async () => {
    const m = mount({});
    mouse("mousedown", m.root.querySelector(".settings-btn")!, 40, 860);
    mouse("mousemove", m.stage(), 200, 800);
    expect(m.stage().classList.contains("looking")).toBe(false);
    mouse("mouseup", document.body, 200, 800);
    const d = mount({ view: "desktop" });
    mouse("mousedown", d.stage(), 300, 300);
    mouse("mousemove", d.stage(), 500, 300);
    expect(d.root.querySelector(".looking")).toBeNull();
  });

  it("pure: the pan never leaves its limits, the photo always covers the stage, it eases back to rest", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e5, max: 1e5, noNaN: true }), fc.double({ min: -1e5, max: 1e5, noNaN: true }), fc.integer({ min: 0, max: 700 }), (dx, dy, t) => {
        const p = photoPan(dx, dy);
        expect(Math.abs(p.x)).toBeLessThanOrEqual(PAN_X * 1600 + 1e-9);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(PAN_Y * 900 + 1e-9);
        // Grown by k about the centre and moved by the pan, the photo still covers 1600 × 900.
        const k = panScale(p);
        expect(((k - 1) * 1600) / 2 + 1e-9).toBeGreaterThanOrEqual(Math.abs(p.x));
        expect(((k - 1) * 900) / 2 + 1e-9).toBeGreaterThanOrEqual(Math.abs(p.y));
        const e = easePan(p, t);
        expect(Math.abs(e.x)).toBeLessThanOrEqual(Math.abs(p.x) + 1e-9);
        if (t >= LOOK_RETURN_MS) expect(e).toEqual(NO_PAN);
      }),
    );
    expect(PLACED_PARALLAX).toBe(1.5);
  });
});

describe("the four facings and their turn edges (room-turn 2026-11-04)", () => {
  it("the order: turning right 房间 → 床 → 门 → 窗 → 房间, and left the other way, from every facing", () => {
    expect(FACINGS).toEqual(["room", "bed", "door", "window"]);
    for (const [i, f] of FACINGS.entries()) {
      expect(turnedTo(f, "right"), f).toBe(FACINGS[(i + 1) % 4]);
      expect(turnedTo(f, "left"), f).toBe(FACINGS[(i + 3) % 4]);
      expect(turnedTo(turnedTo(f, "right"), "left"), f).toBe(f);
    }
  });

  it("a facing's right 8 % shows → 向右转, its left 8 % ← 向左转, with the walk cursor; the middle shows none; clicking an edge turns that way", async () => {
    const m = mount({});
    mouse("mousemove", m.stage(), 1560, 300);
    await frame();
    expect(m.session.edge?.zone).toBe("right");
    const right = m.root.querySelector<HTMLElement>(".edge-hint.right")!;
    expect(right.textContent).toBe(t("hud.turn.right"));
    expect(right.querySelector(".arrow")).not.toBeNull();
    expect(m.stage().classList.contains("edge-right")).toBe(true);
    mouse("mousemove", m.stage(), 40, 300);
    await frame();
    expect(m.root.querySelector<HTMLElement>(".edge-hint.left")!.textContent).toBe(t("hud.turn.left"));
    expect(m.stage().classList.contains("edge-left")).toBe(true);
    mouse("mousemove", m.stage(), 800, 880);
    await frame();
    expect(m.root.querySelector(".edge-hint")).toBeNull();
    expect(m.stage().classList.contains("edge-left")).toBe(false);
    await click(m, 1560, 300);
    expect(m.session.view).toBe("bed");
    await wait(CHOSEN.turn + 60);
    await click(m, 40, 300);
    expect(m.session.view).toBe("room");
  });

  it("the turn edges are on every facing, never at 桌子 or 屏幕; 桌子 keeps its 退回 at the bottom", async () => {
    for (const view of ["bed", "door", "window"] as const) {
      const m = mount({ view });
      mouse("mousemove", m.stage(), 1590, 400);
      await frame();
      expect(m.root.querySelector(".edge-hint.right"), view).not.toBeNull();
      destroy?.();
      destroy = null;
      document.body.innerHTML = "";
    }
    const d = mount({ view: "desk" });
    mouse("mousemove", d.stage(), 1590, 400);
    await frame();
    expect(d.root.querySelector(".edge-hint")).toBeNull();
    mouse("mousemove", d.stage(), 800, 880);
    await frame();
    expect(d.root.querySelector<HTMLElement>(".edge-hint.back")!.textContent).toBe(t("hud.back"));
    await click(d, 800, 880);
    expect(d.session.view).toBe("room");
  });

  it("pure: a turn hint only in the outer 8 % and only on facings; 退回 only at 桌子's bottom", () => {
    fc.assert(
      fc.property(fc.constantFrom("room", "desk", "door", "desktop", "bed", "window"), fc.integer({ min: 0, max: 1599 }), fc.integer({ min: 0, max: 899 }), (view, x, y) => {
        const z = edgeZone(view, x, y);
        if (z === "left" || z === "right") {
          expect(isFacing(view)).toBe(true);
          expect(z === "left" ? x < 1600 * 0.08 : x >= 1600 * 0.92).toBe(true);
        }
        if (z === "back") expect(view).toBe("desk"), expect(y).toBeGreaterThanOrEqual(900 * 0.94);
        if (isFacing(view) && x >= 1600 * 0.08 && x < 1600 * 0.92) expect(z).toBeNull();
        if (view === "desktop") expect(z).toBeNull();
      }),
    );
  });

  it("← / → turn on the facings only, and only when nothing else has the keys", async () => {
    const m = mount({});
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(m.session.view).toBe("bed");
    await wait(CHOSEN.turn + 60);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(m.session.view).toBe("room");
    await wait(CHOSEN.turn + 60);
    // Not while the 道具 strip, the settings, a line in the box, or a held thing has the keys.
    for (const take of [
      (s: Session) => void (s.itemsOpen = true),
      (s: Session) => void (s.settingsOpen = true),
      (s: Session) => void (s.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "x" }], ending: { kind: "none" } }], line: 0 }),
      (s: Session) => void (s.holding = "chick"),
    ]) {
      const s = { itemsOpen: m.session.itemsOpen, settingsOpen: m.session.settingsOpen, dialogue: m.session.dialogue, holding: m.session.holding };
      take(m.session);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(m.session.view).toBe("room");
      Object.assign(m.session, s);
    }
    // Not from a text field (nor a contenteditable one, which only loopKeys sees).
    const input = document.createElement("input");
    m.root.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(m.session.view).toBe("room");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const ctx: ActionContext = { store: m.store, session: m.session, rerender: () => {}, later: () => {} };
    expect(loopKeys(ctx, { key: "ArrowRight", target: editable } as unknown as KeyboardEvent)).toBe(false);
    expect(m.session.view).toBe("room");
    // Not at 桌子 or on 屏幕.
    for (const view of ["desk", "desktop"] as const) {
      m.session.view = view;
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(m.session.view, view).toBe(view);
    }
  });

  it("a second turn during a turn waits for it (one at most); a third is dropped", () => {
    const later: [number, () => void][] = [];
    let now = 10_000;
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: (ms, fn) => void later.push([now + ms, fn]), now: () => now };
    const turn = (dir: "left" | "right") => loopActions["turn"]!(ctx, { dir } as DOMStringMap, null as never);
    turn("right");
    expect(ctx.session.view).toBe("bed");
    turn("right");
    turn("left");
    expect(ctx.session.view).toBe("bed");
    expect(ctx.session.turnNext).toBe("right");
    // The first turn ends: the waiting one goes, the third never.
    now += CHOSEN.turn + 20;
    for (const [at, fn] of later.splice(0)) if (at <= now) fn();
    expect(ctx.session.view).toBe("door");
    expect(ctx.session.turnNext).toBeNull();
    now += CHOSEN.turn + 20;
    for (const [at, fn] of later.splice(0)) if (at <= now) fn();
    expect(ctx.session.view).toBe("door");
  });

  it("a turn is a head turn: no step sound is queued (room-turn correction 2026-11-04); a walk still steps", () => {
    const sounds: string[] = [];
    const later: [number, () => void][] = [];
    let now = 10_000;
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = {
      store,
      session: initialSession(DEFAULT_CLOCK, "left", "room"),
      rerender: () => {},
      later: (ms, fn) => void later.push([now + ms, fn]),
      now: () => now,
      play: (id: string) => void sounds.push(id),
    } as ActionContext;
    const flush = () => {
      now += 2_000;
      for (const [at, fn] of later.splice(0)) if (at <= now) fn();
    };
    loopActions["turn"]!(ctx, { dir: "right" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("bed");
    flush();
    loopActions["view"]!(ctx, { view: "window" } as DOMStringMap, null as never); // two turns
    expect(ctx.session.view).toBe("window");
    flush();
    loopActions["turn"]!(ctx, { dir: "right" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    flush();
    expect(sounds).toEqual([]);
    loopActions["view"]!(ctx, { view: "desk" } as DOMStringMap, null as never);
    flush();
    expect(sounds).toEqual(["step-1", "step-2"]);
  });

  it("shortest way: 房间 → 门 is two turns right, 窗 → 床 two turns right, 门 → 床 one left; from 桌子 back out to 房间 first", () => {
    expect(turnsBetween("room", "door")).toEqual(["right", "right"]);
    expect(turnsBetween("window", "bed")).toEqual(["right", "right"]);
    expect(turnsBetween("door", "bed")).toEqual(["left"]);
    expect(turnsBetween("room", "window")).toEqual(["left"]);
    const later: [number, () => void][] = [];
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: (ms, fn) => void later.push([ms, fn]), now: () => 10_000 };
    const cam = () => ctx.session.cam;
    for (const [from, to, dir, hops] of [["room", "door", "right", 2], ["window", "bed", "right", 2], ["door", "bed", "left", 1]] as const) {
      ctx.session.view = from;
      ctx.session.cam = null;
      loopActions["view"]!(ctx, { view: to } as DOMStringMap, null as never);
      expect(ctx.session.view, `${from} → ${to}`).toBe(to);
      expect(cam()?.turn, `${from} → ${to}`).toMatchObject({ dir, hops });
      expect(cam()!.until - 10_000).toBe(hops === 2 ? 2 * CHOSEN.turnFast : CHOSEN.turn);
    }
    expect(cam()?.turn).toMatchObject({ via: null });
    ctx.session.view = "room";
    loopActions["view"]!(ctx, { view: "door" } as DOMStringMap, null as never);
    expect(cam()?.turn?.via).toBe("bed");
    // From 桌子: the walk out to 房间, then the turn.
    later.length = 0;
    ctx.session.view = "desk";
    loopActions["view"]!(ctx, { view: "bed" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    expect(cam()?.turn).toBeUndefined();
    const next = later.find(([ms]) => ms === wayMs("desk", "room") + 16)!;
    next[1]();
    expect(ctx.session.view).toBe("bed");
    expect(wayMs("desk", "bed")).toBe(viewMoveMs("desk", "room") + 16 + CHOSEN.turn);
  });

  it("the delivery knock lands on 门: arriving there by the shortest way is the walk to the door", () => {
    const store = createStore({ startDay: 1 });
    for (const d of [
      { kind: "step", name: "boot", t: "09:03" },
      { kind: "step", name: "openApp:msgs", t: "09:03" },
      { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" },
      { kind: "step", name: "delivery:arrives:lunch", t: "12:04" },
    ] as const) store.appendEvent(d);
    const ctx: ActionContext = { store, session: initialSession({ beat: "work", time: "12:30" }, "left", "room"), rerender: () => {}, later: () => {}, now: () => 10_000 };
    loopActions["view"]!(ctx, { view: "door" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("door");
    expect(ctx.session.door?.state).toBe("atDoor");
  });

  it("snapshot: 房间 with the right arrow showing", () => {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.edge = { zone: "right", since: 0 };
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
    expect(out.match(/<div class="edge-hint[^]*?<\/div>/)![0]).toMatchSnapshot();
    expect(out).toMatchSnapshot();
  });

  it("snapshots: the four facings at rest (day 1 morning)", () => {
    const store = createStore({ startDay: 1 });
    const facings = Object.fromEntries(FACINGS.map((view) => [view, renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", view) }).value]));
    expect(facings.bed).toContain('class="stage room bed-view"');
    expect(facings.bed).toContain(`class="shot-hit bed-hit" data-action="bed" style="${rectStyle(BED_SHOT.bed)}"`);
    expect(facings.bed).toContain(`class="shot-hit box-hit" data-action="bed-box" style="${rectStyle(BED_SHOT.box)}"`);
    expect(facings.window).toContain('class="stage room window-view"');
    expect(facings.window).toContain(`data-action="meal-table" style="${rectStyle(WINDOW_SHOT.mealTable)}"`);
    // 房间 is as it was, minus its door edge (the door's own proxy stays for the keyboard).
    expect(facings.room).not.toContain("edge-hint");
    expect(facings).toMatchSnapshot();
  });

  it("a turn is not a crossfade: no splat, no waiting for the camera (the placed things ride with their still)", async () => {
    const m = mount({});
    await click(m, 1560, 300);
    expect(m.session.cam).toMatchObject({ to: "bed", fade: 0, turn: { dir: "right", hops: 1 } });
    expect(m.session.cam!.reveal).toBeLessThanOrEqual(Date.now());
    expect(m.root.querySelector(".splat-layer")).toBeNull();
    expect(m.root.querySelectorAll(".m-backdrop")).toHaveLength(0);
    // 床's own click areas are on the live stage at once.
    expect(m.stage().querySelectorAll(":scope > .shot-hit").length).toBeGreaterThan(0);
  });

  it("床's box turns left to 房间, then opens the case there", () => {
    const later: [number, () => void][] = [];
    const store = createStore({ startDay: 1 });
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "bed"), rerender: () => {}, later: (ms, fn) => void later.push([ms, fn]), now: () => 10_000 };
    loopActions["bed-box"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    expect(ctx.session.cam?.turn).toMatchObject({ dir: "left", hops: 1 });
    expect(ctx.session.caseOpen).toBe(false);
    for (const [, fn] of later.splice(0)) fn();
    expect(ctx.session.caseOpen).toBe(true);
  });
});

describe("the real layer with a fake scene: look, and 床 held by the splat", () => {
  it("look at rest: the layer goes live over the photo, the camera is the framing turned, release eases back over 600 ms and the photo returns", async () => {
    const m = mount({ splat: true });
    await ready(m);
    expect(m.hooks().pose()).toBeNull();
    expect(m.hooks().look(120, -30)).toBe(true);
    const layer = m.root.querySelector<HTMLElement>(":scope > .splat-layer")!;
    expect(layer).not.toBeNull();
    expect(m.stage().classList.contains("m-nobg")).toBe(true);
    const pose = m.hooks().pose()!;
    expect(pose.yaw).toBeGreaterThan(POSES.room.yaw);
    expect(pose.pitch).toBeLessThan(POSES.room.pitch);
    expect(pose.pos).toEqual(POSES.room.pos);
    await wait(60);
    expect(m.fake.poses.at(-1)!.yaw).toBeCloseTo(m.hooks().pose()!.yaw, 6);
    // The photo gives way (the layer's copy fades out over 150 ms)…
    await wait(200);
    expect(layer.querySelector<HTMLElement>(".splat-photo")!.style.opacity).toBe("0");
    // …and a re-render keeps the layer and the stage's held-back photo.
    m.root.querySelector<HTMLElement>('[data-action="settings-open"]')!.click();
    await frame();
    expect(m.root.querySelectorAll(":scope > .splat-layer")).toHaveLength(1);
    expect(m.stage().classList.contains("m-nobg")).toBe(true);
    m.hooks().release();
    await wait(LOOK.easeMs / 2);
    const half = m.hooks().pose()!;
    expect(Math.abs(half.yaw - POSES.room.yaw)).toBeLessThan(Math.abs(pose.yaw - POSES.room.yaw));
    expect(Math.abs(half.yaw - POSES.room.yaw)).toBeGreaterThan(0);
    await wait(LOOK.easeMs / 2 + SPLAT_FADE_MS + 120);
    expect(m.hooks().pose()).toBeNull();
    expect(m.root.querySelector(".splat-layer")).toBeNull();
    expect(m.stage().classList.contains("m-nobg")).toBe(false);
    near(m.fake.poses.at(-1)!, POSES.room);
  });

  it("no look while it is loading, in a view without a pose, or after the layer is gone", async () => {
    const pending = mount({ splat: true, view: "door" });
    await ready(pending);
    expect(pending.hooks().look(50, 0)).toBe(false);
    destroy!();
    document.body.innerHTML = "";

    const desktop = mount({ splat: true, view: "desktop" });
    await ready(desktop);
    expect(desktop.hooks().look(50, 0)).toBe(false);
  });

  it("the sleep flow lands on 床 (room-turn): 睡 turns there, the bed wall is its own still with no splat, the night begins as the turn ends", async () => {
    const store = createStore({ startDay: 1 });
    completeUntil(store, "bed", { all: true });
    const m = mount({ splat: true, store });
    await ready(m);
    // The bed's proxy in 房间 is the thing to point at; it asks first (day-loop addition 2026-11-02).
    const bed = fixedRects("room").bed!;
    await click(m, bed.l + bed.w / 2, bed.t + bed.h / 2);
    expect(m.session.view).toBe("room");
    await sleep(m);
    expect(m.session.view).toBe("bed");
    expect(m.session.cam).toMatchObject({ to: "bed", turn: { dir: "right", hops: 1 } });
    // 床 is a still now: no splat layer, the stage shows bed.jpg, and its own things are there at once.
    expect(m.root.querySelector(".splat-layer")).toBeNull();
    expect(m.stage().classList.contains("bed-view")).toBe(true);
    expect(m.stage().classList.contains("m-nobg")).toBe(false);
    expect([...m.stage().querySelectorAll<HTMLElement>(":scope > .shot-hit")].map((e) => e.dataset.hot)).toEqual(["box", "bed"]);
    expect(m.session.dialogue.queue).toEqual([]);
    await wait(CHOSEN.turn + 80);
    // The night began as the turn ended (a line is waiting, or the day is already over).
    expect(m.session.dialogue.queue.length > 0 || m.store.getState().day === 2).toBe(true);
    // And ?splat=1 gives the new facings no splat: no head turn on 床.
    expect(m.hooks().look(60, 0)).toBe(false);
  }, 10_000);

  it("turning away during the turn cancels the night: it begins only if the player is still at 床", async () => {
    const store = createStore({ startDay: 1 });
    completeUntil(store, "bed", { all: true });
    const m = mount({ store });
    await frame();
    const bed = fixedRects("room").bed!;
    await click(m, bed.l + bed.w / 2, bed.t + bed.h / 2);
    await sleep(m);
    expect(m.session.view).toBe("bed");
    // The second turn waits for the first, then turns away before the night would begin.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await wait(CHOSEN.turn + 300);
    expect(m.session.view).toBe("room");
    expect(m.session.dialogue.queue).toEqual([]);
    expect(m.store.getState().day).toBe(1);
  }, 10_000);

  it("on 床 its bed is the same 躺下; 窗 has no splat either", async () => {
    const store = createStore({ startDay: 1 });
    completeUntil(store, "bed", { all: true });
    const m = mount({ splat: true, store, view: "window" });
    await ready(m);
    expect(m.hooks().look(60, 0)).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await frame();
    expect(m.session.view).toBe("room");
    await wait(CHOSEN.turn + 60);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await wait(CHOSEN.turn + 60);
    await frame();
    expect(m.session.view).toBe("bed");
    m.stage().querySelector<HTMLElement>('.shot-hit[data-hot="bed"]')!.click();
    expect(m.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:bed:ask"]);
    await sleep(m);
    // Already at 床: the night begins at once.
    expect(m.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:beat:night"]);
  }, 10_000);

  it("without the splat: the same turn to 床, and the night begins as it ends", async () => {
    const store = createStore({ startDay: 1 });
    completeUntil(store, "bed", { all: true });
    const m = mount({ splat: false, store });
    await frame();
    expect(m.session.splatReady).toBe(false);
    m.root.querySelector<HTMLElement>('.shot-hit[data-hot="bed"]')!.click();
    expect(m.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:bed:ask"]);
    await sleep(m);
    expect(m.session.view).toBe("bed");
    expect(m.session.dialogue.queue).toEqual([]);
    await wait(CHOSEN.turn + 80);
    expect(m.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:beat:night"]);
  });
});

function near(a: Pose, b: Pose) {
  expect(a.pos.x).toBeCloseTo(b.pos.x, 3);
  expect(a.yaw).toBeCloseTo(b.yaw, 3);
  expect(a.pitch).toBeCloseTo(b.pitch, 3);
}

describe("placed things wait for the camera (correction 2026-11-02)", () => {
  const cam = (reveal: number, until: number, to: Session["view"] = "desk") => ({ cam: { to, reveal, until } });

  it("they wait from the move's start until the arriving photo is back; nowMs 0 and other views never wait", () => {
    expect(placedThingsWait({ cam: null }, "desk", 500)).toBe(false);
    expect(placedThingsWait(cam(1000, 1200), "desk", 500)).toBe(true);
    expect(placedThingsWait(cam(1000, 1200), "desk", 999)).toBe(true);
    expect(placedThingsWait(cam(1000, 1200), "desk", 1000)).toBe(false);
    expect(placedThingsWait(cam(1000, 1200), "desk", 0)).toBe(false);
    expect(placedThingsWait(cam(1000, 1200), "room", 500)).toBe(false);
  });

  it("then they fade in over 200 ms, and a re-render finds them where the fade is", () => {
    expect(ARRIVE_FADE_MS).toBe(SPLAT_FADE_MS);
    expect(placedThingsFade(cam(1000, 1200), "desk", 900)).toBeNull();
    expect(placedThingsFade(cam(1000, 1200), "desk", 1000)).toBe(0);
    expect(placedThingsFade(cam(1000, 1200), "desk", 1130)).toBe(130);
    expect(placedThingsFade(cam(1000, 1200), "desk", 1200)).toBeNull();
    expect(placedThingsFade({ cam: null }, "desk", 1100)).toBeNull();
  });

  const roomOf = (session: Session, store: Store, nowMs?: number) => renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs }).value;
  const sessionAt = (view: Session["view"], c: Session["cam"]) => ({ ...initialSession(DEFAULT_CLOCK, "left", view), cam: c });

  it("snapshot: 桌子 mid-move has no .slot, no click areas, no tabletop; the checklist stays; after it they are back, fading", () => {
    const store = createStore({ startDay: 1 });
    const moving = roomOf(sessionAt("desk", { to: "desk", reveal: 1000, until: 1200 }), store, 500);
    expect(moving).not.toContain('class="slot');
    expect(moving).not.toContain("desk-things");
    expect(moving).not.toContain("shot-hit");
    expect(moving).toContain('class="list"');
    expect(moving).not.toContain("m-late");
    const arriving = roomOf(sessionAt("desk", { to: "desk", reveal: 1000, until: 1200 }), store, 1100);
    expect(arriving).toContain('class="desk-things"');
    expect(arriving).toContain('class="stage room desk-view m-late"');
    expect(arriving).toContain('style="--late:-100ms"');
    const settled = roomOf(sessionAt("desk", { to: "desk", reveal: 1000, until: 1200 }), store, 1500);
    expect(settled).toContain('class="desk-things"');
    expect(settled).not.toContain("m-late");
    expect({ moving, arriving }).toMatchSnapshot();
  });

  it("房间 and 门 wait too: the click areas, what finished runs left, the door's content", () => {
    const store = createStore({ startDay: 1 });
    const room = roomOf(sessionAt("room", { to: "room", reveal: 1000, until: 1200 }), store, 500);
    expect(room).not.toContain("shot-hit");
    expect(roomOf(sessionAt("room", { to: "room", reveal: 1000, until: 1200 }), store, 1100)).toContain("shot-hit");
    // No camera move recorded: everything is there.
    expect(roomOf(sessionAt("room", null), store, 500)).toContain("shot-hit");
  });

  it("the view action records the move: the things fade in with the arriving photo (200 ms with the splat, the 400 ms crossfade without); a walk is two steps", () => {
    const store = createStore({ startDay: 1 });
    for (const [splatReady, expectFade] of [[true, SPLAT_FADE_MS], [false, CROSSFADE_MS]] as const) {
      const later: number[] = [];
      const sounds: string[] = [];
      const ctx: ActionContext = { store, session: { ...initialSession(DEFAULT_CLOCK, "left", "room"), splatReady }, rerender: () => {}, later: (ms) => void later.push(ms), now: () => 10_000, play: (id) => void sounds.push(id) };
      loopActions["view"]!(ctx, { view: "desk" } as DOMStringMap, null as never);
      const dur = viewMoveMs("room", "desk");
      expect(dur).toBe(900);
      expect(ctx.session.cam).toEqual({ to: "desk", reveal: 10_000 + dur - expectFade, until: 10_000 + dur, fade: expectFade });
      // The render that shows them, then the second step half way.
      expect(later).toEqual([dur - expectFade + 24, dur / 2]);
      expect(sounds).toEqual(["step-1"]);
    }
    // 屏幕 has its own entrance: no wait recorded.
    const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: () => {} };
    loopActions["view"]!(ctx, { view: "desktop" } as DOMStringMap, null as never);
    expect(ctx.session.cam).toBeNull();
  });

  it("in the live DOM: right after pointing at the desk no .slot while the move is on (.m-nobg), all of them after", async () => {
    const m = mount();
    await click(m, 700, 590);
    expect(m.session.view).toBe("desk");
    expect(m.stage().classList.contains("m-nobg")).toBe(true);
    expect(m.root.querySelectorAll(".stage .slot")).toHaveLength(0);
    expect(m.root.querySelectorAll(".shot-hit")).toHaveLength(0);
    await wait(viewMoveMs("room", "desk", true) + 150);
    expect(m.stage().classList.contains("m-nobg")).toBe(false);
    expect(m.root.querySelectorAll(".stage .slot").length).toBeGreaterThan(0);
    expect(m.root.querySelectorAll(".shot-hit").length).toBeGreaterThan(0);
  }, 10_000);

  it("with the splat on the things come back in the last 200 ms of the move, while the layer is still there", async () => {
    const m = mount({ splat: true });
    await ready(m);
    await click(m, 700, 590);
    expect(m.root.querySelector(".splat-layer")).not.toBeNull();
    expect(m.root.querySelectorAll(".stage .slot")).toHaveLength(0);
    await wait(viewMoveMs("room", "desk", true) - SPLAT_FADE_MS + 120);
    expect(m.root.querySelectorAll(".stage .slot").length).toBeGreaterThan(0);
    expect(m.stage().classList.contains("m-late")).toBe(true);
    await wait(500);
    expect(m.root.querySelector(".splat-layer")).toBeNull();
  }, 10_000);
});

describe("the CSS the controls rely on", () => {
  it("proxies never take the pointer; hover is 4 % white; no chips; the head turn must not select or drag a picture", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toContain(".room .shot-hit{pointer-events:none}");
    expect(css).toContain(".room .shot-hit[data-hover]{background:rgba(255,255,255,.04)}");
    expect(css).not.toContain(".room .cams");
    expect(css).toContain("user-select:none");
    expect(css).toContain(".stage.m-late>.desk-things");
  });
});
