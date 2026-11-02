// @vitest-environment happy-dom
// The box does not jump (dialogue correction 2026-11-02): in 房间, 桌子, 门 and 屏幕 the dialogue box
// lives in the same fixed layer, anchored to the viewport (not to the stage, whose size differs by
// view): the same bottom offset, width and height everywhere. One rule, one CSS block.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { mountDesktop } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function boxIn(view: Session["view"]) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const m = mountDesktop(root, { store, clock: { beat: "work", time: "10:00" }, view, render: renderGame, actions: { ...desktopActions, ...loopActions }, onKey: loopKeys });
  destroy = m.destroy;
  m.session.dialogue = { queue: [{ key: "x", lines: [{ k: "narration", t: "一句话。" }], ending: { kind: "none" } }], line: 0 };
  root.querySelector<HTMLElement>('[data-action="settings-open"]')?.click();
  await frame();
  root.querySelector<HTMLElement>('[data-action="settings-close"]')?.click();
  await frame();
  const box = root.querySelector<HTMLElement>(".dlg")!;
  const cs = getComputedStyle(box);
  const placed = {
    layer: box.parentElement?.className,
    layerIsRootChild: box.parentElement?.parentElement === root,
    inStage: !!box.closest(".stage"),
    position: cs.position,
    bottom: cs.bottom,
    width: cs.width,
    maxWidth: cs.maxWidth,
    height: cs.height,
    transform: cs.transform,
  };
  destroy();
  destroy = null;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  return placed;
}

describe("the dialogue box is anchored to the viewport in every view", () => {
  it("房间, 桌子, 门 and 屏幕: the same layer and the same computed placement (snapshot)", async () => {
    const views = ["room", "desk", "door", "desktop"] as const;
    const placed: Record<string, Awaited<ReturnType<typeof boxIn>>> = {};
    for (const v of views) placed[v] = await boxIn(v);
    for (const v of views) {
      expect(placed[v]!.layer, v).toBe("dlg-layer");
      expect(placed[v]!.layerIsRootChild, v).toBe(true);
      expect(placed[v]!.inStage, v).toBe(false);
      // Property: identical placement in every view.
      expect(placed[v], v).toEqual(placed.room);
    }
    expect(placed.room).toMatchSnapshot();
  });

  it("one CSS block places it: fixed, the shared bottom, 900 px wide at most 80 vw (= min(900px, 80vw)), a fixed height; no view moves or resizes it", () => {
    expect(css).toMatch(/\.dlg-layer \.dlg\{position:fixed;left:50%;bottom:var\(--dlg-bottom,60px\);transform:translateX\(-50%\);width:900px;max-width:80vw;height:var\(--dlg-h,132px\)\}/);
    // No rule scoped to a view (房间 / 桌子 / 门 / 屏幕) sets the box's bottom, width or height.
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }));
    for (const r of rules) {
      if (!/\.dlg\b/.test(r.sel) || !/(room-view|desk-view|door-view|one-monitor|\.room\s*>)/.test(r.sel)) continue;
      expect(r.body, r.sel).not.toMatch(/(^|;)\s*(bottom|width|height|top)\s*:/);
    }
  });
});
