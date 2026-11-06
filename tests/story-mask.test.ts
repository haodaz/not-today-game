// @vitest-environment happy-dom
// A story masks the stage (dialogue addition 2026-11-02): a sequence of two or more lines dims the
// stage 40 % and holds its hotspots while it plays; a one-line fragment does not. The mask goes with
// the sequence's last line; a click on it reads on; Esc skips to that last line, never past it;
// choices keep their own modality.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import type { SayLine } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { mountDesktop } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { MASK_ALLOWS, maskBlocks, skipToLast, storyMasked } from "@world/dialogue/mask";
import { advance, EMPTY_DIALOGUE, type DialogueState, type Queued } from "@world/loop/dialogue";
import { loopActions, loopKeys, renderGame } from "@world/room/game";

const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
const lines = (n: number): SayLine[] => Array.from({ length: n }, (_, i) => ({ k: "narration", t: `第${i + 1}句。` }));
const story = (n: number, extra: Partial<Queued> = {}): DialogueState => ({ queue: [{ key: `s${n}`, lines: lines(n), ending: { kind: "none" }, ...extra }], line: 0 });

describe("storyMasked (pure)", () => {
  it("two or more lines mask; one line, nothing, and Kuro's talk do not", () => {
    expect(storyMasked(EMPTY_DIALOGUE)).toBe(false);
    expect(storyMasked(story(1))).toBe(false);
    expect(storyMasked(story(2))).toBe(true);
    expect(storyMasked(story(5))).toBe(true);
    expect(storyMasked(story(3, { voice: "kuro" }))).toBe(false);
  });

  it("the mask goes with the last line; at a choice the choice's own modality takes over", () => {
    let d = story(3);
    for (let i = 0; i < 3; i++) {
      expect(storyMasked(d), `line ${d.line}`).toBe(true);
      d = advance(d).dialogue;
    }
    expect(storyMasked(d)).toBe(false);
    const choosing: DialogueState = { queue: [{ key: "c", lines: lines(2), ending: { kind: "bedAsk" } }], line: 1 };
    expect(storyMasked({ ...choosing, line: 0 })).toBe(true);
    expect(storyMasked(choosing)).toBe(false);
  });

  it("Esc's skip lands on the last line and never past it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 8 }), fc.nat(7), (n, at) => {
        const d = { ...story(n), line: Math.min(at, n - 1) };
        const s = skipToLast(d)!;
        expect(s.line).toBe(n - 1);
        expect(s.queue).toBe(d.queue);
        expect(skipToLast(s)).toBe(s);
      }),
    );
    expect(skipToLast(story(1))).toBeNull();
  });
});

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

async function mounted(view: Session["view"], dialogue: DialogueState) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  const root = document.createElement("div");
  document.body.appendChild(root);
  const m = mountDesktop(root, { store, clock: { beat: "work", time: "10:00" }, view, render: renderGame, actions: { ...desktopActions, ...loopActions }, onKey: loopKeys });
  destroy = m.destroy;
  m.session.dialogue = dialogue;
  // A session change needs a render: the settings panel open and shut is one.
  root.querySelector<HTMLElement>('[data-action="settings-open"]')?.click();
  await frame();
  root.querySelector<HTMLElement>('[data-action="settings-close"]')?.click();
  await frame();
  return { root, store, session: m.session };
}

describe("on the stage", () => {
  it("a 40 % dim under the box, in the box's fixed layer; a clear one for a one-line fragment (playtest-1105 R2)", async () => {
    const masked = await mounted("room", story(3));
    const mask = masked.root.querySelector<HTMLElement>(".story-mask")!;
    expect(mask).not.toBeNull();
    expect(mask.parentElement!.classList.contains("dlg-layer")).toBe(true);
    expect(mask.nextElementSibling?.classList.contains("dlg")).toBe(true);
    expect(getComputedStyle(mask).backgroundColor.replace(/\s/g, "")).toMatch(/^rgba\(0,0,0,0?\.4\)$/);
    destroy!();
    document.body.innerHTML = "";
    const plain = await mounted("room", story(1));
    // playtest-1105 R2: the box owns the screen for one line too: a mask without the dim.
    const clear = plain.root.querySelector<HTMLElement>(".story-mask.clear")!;
    expect(clear).not.toBeNull();
    expect(clear.dataset.action).toBe("loop-advance");
    expect(plain.root.querySelector(".dlg-layer.masked")).toBeNull();
    expect(plain.root.querySelector(".dlg")).not.toBeNull();
  });

  it("a click on the mask reads on; the mask goes with the last line", async () => {
    const { root, session } = await mounted("room", story(3));
    for (const line of [1, 2]) {
      root.querySelector<HTMLElement>(".story-mask")!.click();
      await frame();
      expect(session.dialogue.line).toBe(line);
    }
    expect(root.querySelector(".story-mask")).not.toBeNull();
    root.querySelector<HTMLElement>(".story-mask")!.click();
    await frame();
    expect(session.dialogue.queue).toEqual([]);
    expect(root.querySelector(".story-mask")).toBeNull();
  });

  it("Esc skips to the last line, never past it, and the camera stays", async () => {
    const { root, session } = await mounted("desk", story(4));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(session.dialogue.line).toBe(3);
    expect(session.view).toBe("desk");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    expect(session.dialogue.line).toBe(3);
    expect(session.dialogue.queue).toHaveLength(1);
    expect(session.view).toBe("desk");
    expect(root.querySelector(".story-mask")).not.toBeNull();
  });

  it("the settings panel stays above the box (and the mask) in every view", async () => {
    for (const view of ["room", "desk", "door", "desktop"] as const) {
      const { root } = await mounted(view, story(2));
      root.querySelector<HTMLElement>('[data-action="settings-open"]')!.click();
      await frame();
      const layer = root.querySelector<HTMLElement>(".settings-layer")!;
      expect(layer, view).not.toBeNull();
      expect(layer.closest(".stage"), view).toBeNull();
      expect(layer.parentElement!.classList.contains("hud-host"), view).toBe(true);
      expect(getComputedStyle(layer).position, view).toBe("fixed");
      expect(Number(getComputedStyle(layer).zIndex), view).toBeGreaterThan(Number(getComputedStyle(root.querySelector(".dlg-layer")!).zIndex));
      destroy!();
      destroy = null;
      document.body.innerHTML = "";
      document.head.innerHTML = "";
    }
  });
});

describe("property: hotspots never fire under the mask", () => {
  const hotspots = Object.keys({ ...desktopActions, ...loopActions }).filter((a) => !MASK_ALLOWS.has(a));

  it("pure: every action but reading on, the box's controls and the settings is held while masked", () => {
    expect(hotspots.length).toBeGreaterThan(20);
    for (const a of hotspots) {
      expect(maskBlocks(story(2), a), a).toBe(true);
      expect(maskBlocks(story(1), a), a).toBe(false);
    }
    expect(maskBlocks(story(2), "loop-advance")).toBe(false);
  });

  it("through the controller: no event, no camera move, the story untouched", async () => {
    const { root, store, session } = await mounted("room", story(3));
    const snapshot = (s: Store, ses: Session) => JSON.stringify({ n: s.getEvents().length, view: ses.view, line: ses.dialogue.line, key: ses.dialogue.queue[0]?.key, holding: ses.holding, phone: ses.phoneOpen, items: ses.itemsOpen, leftApp: ses.leftApp });
    const before = snapshot(store, session);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...hotspots), fc.constantFrom("room", "desk", "desktop", "door", "bed"), async (action, data) => {
        const el = document.createElement("button");
        el.dataset.action = action;
        // The usual data a hotspot carries; whatever it is, nothing may answer.
        el.dataset.view = data;
        el.dataset.app = "workbench";
        el.dataset.object = "chick";
        el.dataset.conv = "boss";
        el.dataset.page = "docs";
        root.appendChild(el);
        el.click();
        el.remove();
        expect(snapshot(store, session), action).toBe(before);
      }),
      { numRuns: 120 },
    );
    expect(storyMasked(session.dialogue)).toBe(true);
  });
});

describe("snapshots", () => {
  it("one masked and one unmasked state (房间)", async () => {
    const pick = (root: HTMLElement) => root.querySelector(".dlg-layer")!.outerHTML;
    const masked = pick((await mounted("room", story(2))).root);
    destroy!();
    document.body.innerHTML = "";
    const unmasked = pick((await mounted("room", story(1))).root);
    expect({ masked, unmasked }).toMatchSnapshot();
  });
});

