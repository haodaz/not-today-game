// @vitest-environment happy-dom
// The door closes without a crash (day-1 walkthrough 2026-11-02): after 关门，上链 the chain picture
// leaves as a ghost; re-placing that ghost on later renders used to read the motion layer's `out`
// snapshot after it was reset (TypeError: reading 'doorBg'). Driven through the real motion layer.
import { afterEach, describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { createStore } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { mountDesktop } from "@world/desktop/controller";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("the door closes through the motion layer", () => {
  it("open to the chain, reach, close: no throw while the chain picture leaves, and the bag is taken in", async () => {
    const drafts: EventDraft[] = [
      { kind: "step", name: "boot", t: "09:03" },
      { kind: "step", name: "openApp:msgs", t: "09:03" },
      { kind: "order", meal: "lunch", shopId: "huangmenji", itemId: "hmj", t: "11:30" },
      { kind: "step", name: "delivery:arrives:lunch", t: "12:04" },
    ];
    const store = createStore({ startDay: 1 });
    for (const d of drafts) store.appendEvent(d);
    const root = document.createElement("div");
    root.id = "app";
    document.body.appendChild(root);
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener("error", onError);
    const m = mountDesktop(root, {
      store,
      clock: { beat: "work", time: "12:30" },
      view: "room",
      render: renderGame,
      actions: { ...desktopActions, ...loopActions },
      onChange: (ctx) => syncLoop(ctx),
      onKey: loopKeys,
      motion: createMotion,
    });
    destroy = m.destroy;
    await frame();
    // Arriving at 门 is the walk (its proxy, as the pointer or Enter would press it).
    root.querySelector<HTMLElement>('.shot-hit[data-hot="door"]')!.click();
    expect(m.session.view).toBe("door");
    expect(m.session.door?.state).toBe("atDoor");
    await wait(1300);
    await frame();
    for (const input of ["openChain", "reach", "close"]) {
      const spot = root.querySelector<HTMLElement>(`.door-spot[data-input="${input}"]`);
      expect(spot, input).not.toBeNull();
      spot!.click();
      await frame();
      // Re-render while ghosts are still leaving (the settings panel opens and closes).
      for (let i = 0; i < 3; i++) {
        root.querySelector<HTMLElement>('[data-action="settings-open"]')?.click();
        await frame();
        root.querySelector<HTMLElement>('[data-action="settings-close"]')?.click();
        await frame();
      }
    }
    await wait(500);
    await frame();
    window.removeEventListener("error", onError);
    expect(errors).toEqual([]);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "pickup", meal: "lunch" });
    expect(m.session.door?.state).toBe("onDesk");
  }, 10_000);
});
