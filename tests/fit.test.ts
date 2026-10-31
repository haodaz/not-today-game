// @vitest-environment happy-dom
// polish, correction 2026-11-01: the stage fills the window. Scale = min(w/1600, h/900), capped at
// 2; centred both ways; the letterbox is the current view's photo; title page included; resize
// recomputes. The numbers are the spec's.
import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop, ROOM_STAGE, stageSize } from "@world/desktop/controller";
import { applyFit, BACKDROPS, FIT_MAX, fitStage } from "@world/fit";
import { renderGame } from "@world/room/game";
import { mountTitle } from "../src/ui/title/mount";
import { EMPTY_COLLECTION } from "@world/room/collection";

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});

/** A root of a given window size (happy-dom does no layout). */
function sizedRoot(w: number, h: number): HTMLElement & { resize: (w: number, h: number) => void } {
  const root = document.createElement("div") as unknown as HTMLElement & { resize: (w: number, h: number) => void };
  root.id = "app";
  let size = { w, h };
  Object.defineProperty(root, "clientWidth", { get: () => size.w });
  Object.defineProperty(root, "clientHeight", { get: () => size.h });
  root.resize = (nw, nh) => {
    size = { w: nw, h: nh };
    window.dispatchEvent(new Event("resize"));
  };
  document.body.appendChild(root);
  return root;
}

const px = (el: HTMLElement, name: string) => parseFloat(el.style.getPropertyValue(name));

describe("fitStage (pure)", () => {
  it("the spec's case: 2185×1160 → scale 1.2889, left (2185 − 1600×1.2889)/2, top 0", () => {
    const f = fitStage(2185, 1160, ROOM_STAGE.w, ROOM_STAGE.h);
    expect(f.scale).toBeCloseTo(1.2889, 4);
    expect(f.left).toBeCloseTo((2185 - 1600 * f.scale) / 2, 6);
    expect(f.left).toBeCloseTo(61.39, 2);
    expect(f.top).toBeCloseTo(0, 6);
  });

  it("scale is min(w/1600, h/900): 1 at 1600×900, smaller windows shrink, tall windows centre vertically", () => {
    expect(fitStage(1600, 900, 1600, 900)).toEqual({ scale: 1, left: 0, top: 0 });
    expect(fitStage(800, 450, 1600, 900)).toEqual({ scale: 0.5, left: 0, top: 0 });
    const tall = fitStage(1600, 1200, 1600, 900);
    expect(tall.scale).toBe(1);
    expect(tall.left).toBe(0);
    expect(tall.top).toBe(150);
  });

  it("capped at 2, still centred", () => {
    expect(FIT_MAX).toBe(2);
    expect(fitStage(5120, 2880, 1600, 900)).toEqual({ scale: 2, left: 960, top: 540 });
  });

  it("an empty window (no layout) is scale 1 at 0,0", () => {
    expect(fitStage(0, 0, 1600, 900)).toEqual({ scale: 1, left: 0, top: 0 });
  });
});

describe("applying it", () => {
  it("writes --scale and the offsets on the stage, the photo on the root", () => {
    const root = sizedRoot(2185, 1160);
    const stage = document.createElement("div");
    root.appendChild(stage);
    applyFit(root, stage, ROOM_STAGE, BACKDROPS.room);
    expect(px(stage, "--scale")).toBeCloseTo(1.2889, 4);
    expect(px(stage, "--stage-x")).toBeCloseTo((2185 - 1600 * px(stage, "--scale")) / 2, 3);
    expect(px(stage, "--stage-y")).toBeCloseTo(0, 6);
    expect(root.style.getPropertyValue("--letterbox")).toBe(`url(${BACKDROPS.room})`);
  });

  it("the game: the view's photo, recomputed on resize and on a view change", async () => {
    const root = sizedRoot(2185, 1160);
    const m = mountDesktop(root, { store: createStore({ startDay: 1 }), clock: DEFAULT_CLOCK, view: "room", render: renderGame });
    destroy = m.destroy;
    const stage = () => root.querySelector<HTMLElement>(".stage")!;
    expect(px(stage(), "--scale")).toBeCloseTo(1.2889, 4);
    expect(root.style.getPropertyValue("--letterbox")).toBe(`url(${BACKDROPS.room})`);
    root.resize(3200, 2000);
    expect(px(stage(), "--scale")).toBe(2);
    expect(px(stage(), "--stage-y")).toBe(100);
    m.session.view = "desk";
    root.resize(1600, 900);
    expect(root.style.getPropertyValue("--letterbox")).toBe(`url(${BACKDROPS.desk})`);
    expect(px(stage(), "--scale")).toBe(1);
    m.session.view = "desktop";
    root.resize(2185, 1160);
    const d = stageSize("desktop");
    expect(px(stage(), "--scale")).toBeCloseTo(Math.min(2185 / d.w, 1160 / d.h), 6);
  });

  it("the title page too", () => {
    const root = sizedRoot(2185, 1160);
    const m = mountTitle(root, { save: null, collection: EMPTY_COLLECTION, onContinue: () => {}, onStart: () => {}, random: () => 0 });
    destroy = m.destroy;
    const stage = root.querySelector<HTMLElement>(".stage")!;
    expect(stage.classList.contains("title-page")).toBe(true);
    expect(px(stage, "--scale")).toBeCloseTo(1.2889, 4);
    expect(px(stage, "--stage-x")).toBeCloseTo((2185 - 1600 * px(stage, "--scale")) / 2, 3);
    expect(root.style.getPropertyValue("--letterbox")).toBe(`url(${BACKDROPS.title})`);
    root.resize(1600, 1200);
    expect(px(root.querySelector<HTMLElement>(".stage")!, "--stage-y")).toBe(150);
  });
});
