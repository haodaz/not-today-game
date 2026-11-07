// @vitest-environment happy-dom
// The motion layer in a real DOM (happy-dom): after every render no two elements share a motion
// key — an element that changes state replaces its old version at once; only what truly leaves
// keeps its exit — and a photo view has exactly one backdrop, also in the middle of a camera move.
import { afterEach, describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { syncLoop } from "@world/loop/runtime";
import { createMotion, duplicateKeys, KEYED, motionKey } from "@world/motion/dom";
import { CHOSEN, CROSSFADE_MS, viewMoveMs } from "@world/motion/timing";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function mount(store: Store, view: Session["view"] = "room") {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const m = mountDesktop(root, {
    store,
    clock: DEFAULT_CLOCK,
    view,
    render: renderGame,
    actions: { ...desktopActions, ...loopActions },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    motion: createMotion,
  });
  destroy = m.destroy;
  // onboarding-steps R1: the run's first desktop visit (the coach marks hold the screen) is not this test's subject.
  m.session.onboard = "done";
  return { root, session: m.session };
}

/** How long after `midway` a move has surely ended: as long as its path (viewMoveMs), and a little. */
const VIEW_OF: Readonly<Record<string, string>> = { room: "room", desk: "desk", screen: "desktop", door: "door", window: "window", bed: "bed" };
const settle = (what: string) => {
  const [a, b] = what.split(" → ").map((w) => VIEW_OF[w.split(" ")[0]!]!);
  return viewMoveMs(a!, b!) + 50;
};

const backdrops = (root: HTMLElement) => [...root.querySelectorAll(KEYED)].filter((el) => motionKey(el) === "backdrop").length;

/** The checks after a render: unique keys; one backdrop on a photo view, at most one otherwise. */
function check(root: HTMLElement, session: Session, what: string): void {
  expect(duplicateKeys(root), what).toEqual([]);
  const n = backdrops(root);
  if (session.view === "desktop") expect(n, `${what}: backdrops`).toBeLessThanOrEqual(1);
  else expect(n, `${what}: backdrops`).toBe(1);
}

async function click(root: HTMLElement, selector: string): Promise<void> {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`nothing to click: ${selector}`);
  el.click();
  await frame();
}

/** Re-render in the middle of whatever is moving (opening and closing the settings panel). */
async function midway(root: HTMLElement, session: Session, what: string): Promise<void> {
  await wait(120);
  await click(root, '[data-action="settings-open"]');
  check(root, session, `${what} (mid-move, settings open)`);
  await click(root, '[data-action="settings-close"]');
  check(root, session, `${what} (mid-move, settings closed)`);
}

function storeAt(day: number, drafts: EventDraft[] = []): Store {
  const store = createStore({ startDay: day });
  for (const d of drafts) store.appendEvent(d);
  return store;
}

describe("the live DOM after a render (fix 2026-10-31)", () => {
  it("camera moves through every level: one backdrop, no doubled HUD, mid-move too", async () => {
    const store = storeAt(1, [{ kind: "step", name: "boot", t: "09:03" }]);
    const { root, session } = mount(store);
    await frame();
    check(root, session, "room");
    const moves: [string, string][] = [
      ['[data-action="view"][data-view="desk"]', "room → desk"],
      // The left monitor (工作台): the right one has 听听, whose 看一眼消息 tells day 1's story (tingtalk 2026-11-04).
      ['[data-view="desktop"][data-screen="left"]', "desk → screen"],
      ['[data-action="view"][data-view="room"]', "screen → room"],
      ['[data-action="view"][data-view="desktop"]', "room → screen"],
    ];
    for (const [selector, what] of moves) {
      await click(root, selector);
      check(root, session, what);
      if (what === "room → desk") {
        // A walk, then a crossfade (room-scene 2026-11-02): two picture-only copies, the arriving one
        // under the leaving one; the arriving stage hides its own picture. No zoom: no camera vars.
        const copies = [...root.querySelectorAll<HTMLElement>(".m-backdrop")];
        expect(copies, what).toHaveLength(2);
        expect(copies.every((c) => c.children.length === 0), what).toBe(true);
        expect(copies[0]!.classList.contains("m-arriving"), what).toBe(true);
        const leaving = copies[1]!.style.animation;
        expect(leaving, what).toMatch(/m-walk-bob 900ms/);
        // The fade is the move's last 400 ms (the walk of 500 ms first).
        expect(leaving, what).toMatch(new RegExp(`m-fade-out ${CROSSFADE_MS}ms \\S+ (\\d+)ms both`));
        expect(Number(/m-fade-out \d+ms \S+ (\d+)ms/.exec(leaving)![1]), what).toBeGreaterThan(400);
        expect(copies[0]!.style.animation, what).toMatch(/m-walk-bob 900ms/);
        expect(copies.some((c) => c.style.getPropertyValue("--m-z") !== ""), what).toBe(false);
        expect(root.querySelector(".stage.desk-view:not(.m-backdrop)")!.classList.contains("m-nobg"), what).toBe(true);
        expect(root.querySelector(".splat-layer"), what).toBeNull();
      }
      await midway(root, session, what);
      await wait(settle(what));
      await frame();
      check(root, session, `${what} (after)`);
      // Over: the copy is gone and the stage shows its own picture again.
      expect(root.querySelectorAll(".m-backdrop").length, `${what} (after)`).toBe(0);
      expect(root.querySelector(".stage.m-nobg"), `${what} (after)`).toBeNull();
    }
    // A story on the screen (day 1's two lines, when 听听 has been looked at) masks the stage, and Esc
    // under it only skips to its last line (dialogue addition 2026-11-02). Read it off first, if any.
    // (The first click on a line still appearing completes it; the next reads on.)
    // (A leaving box may linger as a ghost, which takes no clicks: only the live mask counts.)
    const liveMask = () => [...root.querySelectorAll<HTMLElement>(".story-mask")].find((el) => !el.closest(".m-ghost")) ?? null;
    for (let i = 0; i < 30 && liveMask(); i++) {
      liveMask()!.click();
      await frame();
    }
    expect(liveMask()).toBeNull();
    // 屏幕 → 桌子 → 房间 by Esc; then round the walls (room-turn): the door's proxy turns twice to 门,
    // and → turns on to 窗 and back to 房间. 门 has no back.
    // guidance R6: 工作台's first open in the run shows its sidebar; Esc closes that first.
    if (session.wbSidebar) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await frame();
    }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    check(root, session, "screen → desk (Esc)");
    await midway(root, session, "screen → desk");
    for (const [selector, what] of [
      ["Escape", "desk → room"],
      ['[data-action="view"][data-view="door"]', "room → door"],
      ["ArrowRight", "door → window"],
      ["ArrowRight", "window → room"],
    ] as const) {
      if (selector === "Escape" || selector === "ArrowRight") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: selector }));
        await frame();
      } else await click(root, selector);
      expect(session.view, what).toBe(VIEW_OF[what.split(" → ")[1]!]);
      check(root, session, what);
      await midway(root, session, what);
      await wait(settle(what));
      await frame();
      check(root, session, `${what} (after)`);
    }
    // Eight real-time moves at their walking and turning lengths: more than the default 5 s.
  }, 20_000);

  it("a turn is a head turn inside a box (room-turn correction 2026-11-04): the box rotates 0 → ∓90° by side, no still is scaled down or slid, the HUD stays; to the opposite wall two 400 ms turns", async () => {
    const store = storeAt(1, [{ kind: "step", name: "boot", t: "09:03" }]);
    const { root, session } = mount(store);
    await frame();
    const live = () => root.querySelector<HTMLElement>(".stage.room:not(.m-ghost)")!;
    /** Nothing on the box or its faces shrinks or slides flat. */
    const noSlideNoShrink = (what: string) => {
      const els = [root.querySelector<HTMLElement>(".m-turn")!, root.querySelector<HTMLElement>(".m-turn-box")!, ...root.querySelectorAll<HTMLElement>(".m-turn-face, .m-turn-things")];
      for (const el of els) {
        const s = el.getAttribute("style") ?? "";
        expect(s, `${what}: translateX`).not.toMatch(/translateX|translate\(/);
        for (const [, n] of s.matchAll(/scale[XY]?\(\s*([\d.]+)/g)) expect(Number(n), `${what}: scale`).toBeGreaterThanOrEqual(1);
      }
    };
    // One turn right: 房间 → 床, 650 ms.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await frame();
    expect(session.view).toBe("bed");
    check(root, session, "room → bed (turn)");
    const turn = root.querySelector<HTMLElement>(".m-turn")!;
    expect(turn).not.toBeNull();
    expect(turn.parentElement).toBe(live());
    const box = turn.querySelector<HTMLElement>(".m-turn-box")!;
    expect(box.style.getPropertyValue("--m-turn-to")).toBe("90deg");
    expect(box.style.animation).toMatch(new RegExp(`m-turn-rotate ${CHOSEN.turn}ms ease-in-out`));
    expect(turn.style.animation).toMatch(new RegExp(`m-turn-blur ${CHOSEN.turn}ms`));
    const faces = [...box.querySelectorAll<HTMLElement>(".m-turn-face")];
    expect(faces.map((f) => f.dataset.view)).toEqual(["room", "bed"]);
    expect(faces[0]!.style.transform).toContain("rotateY(0deg)");
    expect(faces[1]!.style.transform).toContain("rotateY(-90deg)");
    // The leaving wall's placed things ride on its face (the click areas of 房间), never the HUD.
    expect(faces[0]!.querySelector(".shot-hit")).not.toBeNull();
    expect(turn.querySelector(".list, .day, .hud-br, .settings-btn")).toBeNull();
    noSlideNoShrink("room → bed");
    // The live stage keeps its HUD; its own still waits under the box; it stays the one backdrop.
    expect(live().classList.contains("m-turning")).toBe(true);
    expect(live().classList.contains("m-nobg")).toBe(false);
    expect(live().querySelector(":scope > .list")).not.toBeNull();
    expect(root.querySelector(".m-backdrop")).toBeNull();
    await wait(CHOSEN.turn + 80);
    await frame();
    expect(root.querySelector(".m-turn")).toBeNull();
    expect(live().classList.contains("m-turning")).toBe(false);
    // Back left: 床 → 房间, the box to −90°, the arriving wall at +90°.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    await frame();
    expect(session.view).toBe("room");
    const left = root.querySelector<HTMLElement>(".m-turn-box")!;
    expect(left.style.getPropertyValue("--m-turn-to")).toBe("-90deg");
    expect(left.querySelectorAll<HTMLElement>(".m-turn-face")[1]!.style.transform).toContain("rotateY(90deg)");
    noSlideNoShrink("bed → room");
    await wait(CHOSEN.turn + 80);
    await frame();
    expect(root.querySelector(".m-turn")).toBeNull();
    // Two away (房间 → 门): two 400 ms turns to the right, 床 passing through.
    // (A code move, as a data-view hotspot or the sleep flow makes it.)
    const go = document.createElement("button");
    go.dataset.action = "view";
    go.dataset.view = "door";
    root.appendChild(go);
    go.click();
    await frame();
    expect(session.view).toBe("door");
    check(root, session, "room → door (two turns)");
    const box2 = root.querySelector<HTMLElement>(".m-turn-box")!;
    expect(box2.style.getPropertyValue("--m-turn-to")).toBe("180deg");
    expect(box2.style.animation).toMatch(new RegExp(`m-turn-rotate-2 ${2 * CHOSEN.turnFast}ms`));
    expect(root.querySelector<HTMLElement>(".m-turn")!.style.animation).toMatch(new RegExp(`m-turn-blur ${CHOSEN.turnFast}ms ease-in-out -?\\d+ms 2`));
    const faces2 = [...box2.querySelectorAll<HTMLElement>(".m-turn-face")];
    expect(faces2.map((f) => f.dataset.view)).toEqual(["room", "bed", "door"]);
    expect(faces2[1]!.style.transform).toContain("rotateY(-90deg)");
    expect(faces2[2]!.style.transform).toContain("rotateY(-180deg)");
    noSlideNoShrink("room → door");
    await wait(2 * CHOSEN.turnFast + 80);
    await frame();
    expect(root.querySelector(".m-turn")).toBeNull();
    check(root, session, "room → door (after)");
  });

  it("reduced motion: a turn is the crossfade", async () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const store = storeAt(1, [{ kind: "step", name: "boot", t: "09:03" }]);
      const { root, session } = mount(store);
      await frame();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      await frame();
      expect(session.view).toBe("window");
      check(root, session, "room → window (reduced)");
      expect(root.querySelector(".m-turn")).toBeNull();
      expect(root.querySelector(".stage.room:not(.m-ghost):not(.m-backdrop)")!.classList.contains("m-turning")).toBe(false);
      const copies = [...root.querySelectorAll<HTMLElement>(".m-backdrop")];
      expect(copies).toHaveLength(2);
      expect(copies[1]!.style.animation).toMatch(new RegExp(`m-fade-out ${CROSSFADE_MS}ms`));
    } finally {
      window.matchMedia = real;
    }
  });

  it("a held item that changes is replaced at once (phone → object); putting down leaves once", async () => {
    const store = storeAt(1, [
      { kind: "step", name: "boot", t: "09:03" },
      { kind: "openLayer", objectId: "chick" },
    ]);
    const { root, session } = mount(store, "desk");
    await frame();
    await click(root, '.desk-things [data-action="loop-phone"]');
    check(root, session, "phone held");
    await click(root, '.desk-things [data-object="chick"]');
    check(root, session, "phone → chick");
    expect(root.querySelectorAll(".held-layer").length).toBe(1);
    await click(root, '[data-action="loop-put-down"]');
    check(root, session, "put down");
    await midway(root, session, "put down");
  });

  it("a checklist line whose text changes is the same line (keyed by item id)", async () => {
    const store = storeAt(1, [
      { kind: "step", name: "boot", t: "09:03" },
      { kind: "step", name: "openApp:msgs", t: "09:03" },
    ]);
    const { root, session } = mount(store, "desk");
    await frame();
    check(root, session, "before ordering");
    store.appendEvent({ kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" });
    await frame();
    check(root, session, "after ordering (the line is rewritten to wait)");
    await midway(root, session, "after ordering");
  });

  it("left ↔ right: the other side's monitor pushes out, the shown one is never doubled; shutdown darkens in place", async () => {
    const store = storeAt(1, [{ kind: "step", name: "boot", t: "09:03" }]);
    const { root, session } = mount(store, "desktop");
    await frame();
    check(root, session, "screen");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    await frame();
    check(root, session, "left → right");
    await midway(root, session, "left → right");
    // Let the push end: until then the left monitor is still leaving (its own key, monitor:left).
    await wait(300);
    await frame();
    expect(root.querySelectorAll(".monitor").length).toBe(1);
    store.appendEvent({ kind: "step", name: "beat:shutdown", t: "23:00" });
    await frame();
    check(root, session, "shutdown");
    expect(root.querySelectorAll(".monitor").length).toBe(1);
    await midway(root, session, "shutdown");
  });

  it("talking to Kuro (dialogue FR2): opening, leaving and reopening never leave two boxes or two bodies", async () => {
    const store = storeAt(1, [{ kind: "step", name: "boot", t: "09:03" }]);
    const { root, session } = mount(store);
    await frame();
    await click(root, '[data-action="kuro-call"]');
    check(root, session, "talk open");
    expect(root.querySelectorAll(".hud-kuro.away").length).toBe(1);
    // The box is in the viewport's layer in every view (dialogue 2026-11-02).
    expect(root.querySelector(".dlg-layer .dlg .txt .ch")).not.toBeNull(); // only the page's text reveals
    expect(root.querySelector(".dlg-layer .dlg .tag .ch")).toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    check(root, session, "talk left");
    expect(root.querySelectorAll(".kuro-btn").length).toBe(1);
    await click(root, '[data-action="kuro-call"]');
    check(root, session, "talk reopened during its exit");
    expect(root.querySelectorAll(".dlg-layer:not(.m-ghost) > .dlg").length).toBe(1);
    expect(root.querySelectorAll(".kuro-btn").length).toBe(0);
  });
});
