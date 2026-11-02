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
import { CHOSEN } from "@world/motion/timing";
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
  return { root, session: m.session };
}

/** How long after `midway` a move has surely ended: 房间 ↔ 桌子 take CHOSEN.roomDesk (900 ms), the rest 400 ms. */
const settle = (what: string) => (/^(room → desk|desk → room)/.test(what) ? CHOSEN.roomDesk : 450);

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
      ['[data-view="desktop"][data-screen="right"]', "desk → screen"],
      ['[data-action="view"][data-view="room"]', "screen → room"],
      ['[data-action="view"][data-view="desktop"]', "room → screen"],
    ];
    for (const [selector, what] of moves) {
      await click(root, selector);
      check(root, session, what);
      if (what === "room → desk") {
        // The move is carried by a picture-only copy; the arriving stage hides its own picture.
        expect(root.querySelectorAll(".m-backdrop").length, what).toBe(1);
        expect(root.querySelector(".m-backdrop")!.children.length, what).toBe(0);
        expect(root.querySelector(".stage.desk-view")!.classList.contains("m-nobg"), what).toBe(true);
      }
      await midway(root, session, what);
      await wait(settle(what));
      await frame();
      check(root, session, `${what} (after)`);
      // Over: the copy is gone and the stage shows its own picture again.
      expect(root.querySelectorAll(".m-backdrop").length, `${what} (after)`).toBe(0);
      expect(root.querySelector(".stage.m-nobg"), `${what} (after)`).toBeNull();
    }
    // 屏幕 → 桌子 → 房间 → 门 → 房间 by Esc and by pointing (the door's proxy).
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    check(root, session, "screen → desk (Esc)");
    await midway(root, session, "screen → desk");
    for (const [selector, what] of [
      ["Escape", "desk → room"],
      ['[data-action="view"][data-view="door"]', "room → door"],
      ["Escape", "door → room"],
    ] as const) {
      if (selector === "Escape") {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await frame();
      } else await click(root, selector);
      check(root, session, what);
      await midway(root, session, what);
      await wait(settle(what));
      await frame();
      check(root, session, `${what} (after)`);
    }
    // Seven real-time moves, two of them 900 ms (房间 ↔ 桌子): more than the default 5 s.
  }, 15_000);

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
    expect(root.querySelector(".stage > .dlg .txt .ch")).not.toBeNull(); // only the page's text reveals
    expect(root.querySelector(".stage > .dlg .tag .ch")).toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    check(root, session, "talk left");
    expect(root.querySelectorAll(".kuro-btn").length).toBe(1);
    await click(root, '[data-action="kuro-call"]');
    check(root, session, "talk reopened during its exit");
    expect(root.querySelectorAll(".stage > .dlg:not(.m-ghost)").length).toBe(1);
    expect(root.querySelectorAll(".kuro-btn").length).toBe(0);
  });
});
