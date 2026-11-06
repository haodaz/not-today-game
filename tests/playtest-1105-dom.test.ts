// @vitest-environment happy-dom
// playtest-1105 R10 in a real DOM (happy-dom): the screen leaving the computer, and one desk prop
// dragged alone. (The turn's timing and the phone are in playtest-1105.test.ts.)
import { afterEach, describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { exitOf, MOTION, viewMoveMs } from "@world/motion/timing";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { createNav } from "@world/room/nav";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function booted(): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
function mount(store: Store, view: Session["view"], nav = false) {
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
    ...(nav ? { nav: createNav() } : {}),
  });
  destroy = m.destroy;
  m.session.dialogue = EMPTY_DIALOGUE;
  m.session.onboard = "done";
  m.rerender();
  return { root, session: m.session, rerender: m.rerender };
}

describe("R10 · bug 2: back from the computer, the screen image goes at once", () => {
  it("the leaving screen is gone after an exit's fade, while the walk to 桌子 is still on", async () => {
    const { root, session } = mount(booted(), "desktop");
    await frame();
    expect(root.querySelector(".stage.one-monitor")).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(session.view).toBe("desk");
    const fade = exitOf(MOTION.view);
    expect(fade).toBeLessThan(viewMoveMs("desktop", "desk"));
    await wait(fade + 60);
    // Still walking (the move is longer), and no copy of the screen is left over the photo.
    expect(root.querySelector(".stage.one-monitor")).toBeNull();
  });
});

describe("R10 · bug 3: on 桌子 one prop is dragged alone", () => {
  it("dragging the cup moves only the cup's box, not the tabletop layer; it goes back on release", async () => {
    const { root } = mount(booted(), "desk", true);
    await frame();
    const cup = root.querySelector<HTMLElement>('.desk-things > .at[data-at="cup"]')!;
    const phone = root.querySelector<HTMLElement>('.desk-things > .at[data-at="phone"]')!;
    expect(cup).not.toBeNull();
    const target = cup.querySelector<HTMLElement>(".slot")!;
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    root.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 160, clientY: 130 }));
    expect(cup.style.translate).toBe("60px 30px");
    expect(phone.style.translate).toBe("");
    const stage = root.querySelector<HTMLElement>(".stage.room")!;
    expect(stage.classList.contains("looking")).toBe(false);
    window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    expect(cup.style.translate).toBe("");
    expect(cup.classList.contains("dragging")).toBe(false);
  });
});
