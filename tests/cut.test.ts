// texture-pass R1: cutscenes — the plan (which clip, when, once) and the layer's markup.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { BEATS, CUT_MS, cutFor, cutLook, cutsData, parseCuts } from "@world/cut/plan";
import { cutLayer, cutOn } from "@world/cut/layer";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import type { ActionContext } from "@world/desktop/controller";

describe("content/cuts.json", () => {
  it("loads strictly and names only known beats and moments", () => {
    for (const [beat, b] of Object.entries(cutsData.beats)) {
      expect(BEATS).toContain(beat);
      expect(b?.on).toBeTruthy();
    }
    expect(() => parseCuts({ beats: { wake: { on: "rise", extra: 1 } } })).toThrow(/unknown key/);
    expect(() => parseCuts({ beats: { nap: { on: "rise" } } })).toThrow(/unknown beat/);
    expect(() => parseCuts({ beats: { wake: { on: "snooze" } } })).toThrow(/unknown moment/);
    expect(() => parseCuts({ beats: { wake: { on: "rise", days: [0] } } })).toThrow(/days/);
  });
});

describe("cutFor", () => {
  const data = parseCuts({ beats: { wake: { on: "rise", once: true }, eat: { on: "eat:lunch", days: [1] }, work: { on: "work:start" } } });
  it("picks the file by beat and look", () => {
    const c = cutFor(1, "cap", "rise", new Set(), true, data);
    expect(c).toEqual({ beat: "wake", video: "/cut/wake/cap.mp4", poster: "/cut/wake/cap.jpg", key: "*:wake" });
  });
  it("a once-beat plays once in a run; a dated beat only on its days; an undated one every day", () => {
    expect(cutFor(3, "he", "rise", new Set(["*:wake"]), true, data)).toBeNull();
    expect(cutFor(2, "he", "eat:lunch", new Set(), true, data)).toBeNull();
    expect(cutFor(1, "he", "eat:lunch", new Set(), true, data)?.key).toBe("d1:eat");
    expect(cutFor(1, "he", "eat:lunch", new Set(["d1:eat"]), true, data)).toBeNull();
    expect(cutFor(7, "he", "work:start", new Set(["d6:work"]), true, data)?.key).toBe("d7:work");
  });
  it("is silent when cuts are off or the moment has no beat", () => {
    expect(cutFor(1, "none", "rise", new Set(), false, data)).toBeNull();
    expect(cutFor(1, "none", "shutdown", new Set(), true, data)).toBeNull();
  });
  it("maps the title pick to a look file, none for anything else", () => {
    expect(cutLook("p1")).toBe("she");
    expect(cutLook("p3")).toBe("none");
    expect(cutLook("p5")).toBe("glare");
    expect(cutLook("zz")).toBe("none");
  });
});

describe("the layer", () => {
  function ctxFor(on: boolean) {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.cutsOn = on;
    const timers: number[] = [];
    const ctx = { store, session, rerender: () => {}, later: (ms: number) => { timers.push(ms); }, now: () => 1000 } as unknown as ActionContext;
    return { ctx, session, timers };
  }
  it("starts a cut at a moment, records it, and clears after CUT_MS", () => {
    const { ctx, session, timers } = ctxFor(true);
    cutOn(ctx, "rise");
    expect(session.cut?.beat).toBe("wake");
    expect(session.cutsPlayed.has("*:wake")).toBe(true);
    expect(timers[0]).toBe(CUT_MS + 16);
    const html = cutLayer(session, 1500)!.value;
    expect(html).toContain('class="cut-layer"');
    expect(html).toContain("/cut/wake/she.mp4"); // the default pick is p1 → she
    expect(html).toContain('data-beat="wake"');
    expect(cutLayer(session, 1000 + CUT_MS)).toBeNull();
  });
  it("does nothing while cuts are off (tests, ?fast=1) or while one is already showing", () => {
    const off = ctxFor(false);
    cutOn(off.ctx, "rise");
    expect(off.session.cut).toBeNull();
    const { ctx, session } = ctxFor(true);
    cutOn(ctx, "rise");
    cutOn(ctx, "boot");
    expect(session.cut?.beat).toBe("wake");
    expect(session.cutsPlayed.has("*:boot")).toBe(false);
  });
});
