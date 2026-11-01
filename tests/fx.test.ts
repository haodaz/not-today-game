// Room-scene correction 2026-11-02: the collapse is in the photos, not on the lens. A still's
// backdrop is a stack (the clean photo, then edited photos at opacities from the day). Snapshots of
// which photos and which opacities; clean before day 11 and on day 10; the stage order only goes
// forward; the glitch flicker is seeded and deterministic; the desktop keeps only its pores/text.
import fc from "fast-check";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import type { Beat, BeatClock } from "@world/desktop/beat";
import { buildShell, initialSession, type Session } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import { flickerCss, FLICKER_MS, FLICKER_STEPS, FLICKER_SWING, fxPlan, fxStageAttrs, glitchFlicker, renderFx, STACK_BY_DAY, STAGES, type FxView } from "@world/room/fx";
import { renderRoom } from "@world/room/hud";

const STILLS = ["room", "desk", "door"] as const;
const clock = (beat: Beat): BeatClock => ({ beat, time: beat === "night" ? "23:41" : "10:00" });
const stageIndex = (s: string) => STAGES.indexOf(s as (typeof STAGES)[number]);

function storeAt(day: number) {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}

function stillPage(day: number, view: (typeof STILLS)[number], beat: Beat = "work"): string {
  const store = storeAt(day);
  const session: Session = initialSession(clock(beat), "left", view);
  return renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
}

/** The photo stack of a still: what is in the `.fx` element, or null for a clean one. */
const stackOf = (page: string): string | null => /<div class="fx"[^>]*>.*?<\/div>(?:<style>.*?<\/style>)?<\/div>/s.exec(page)?.[0] ?? null;

/** [stage, opacity] pairs read back from the markup. */
const photosIn = (page: string): [string, number, string][] =>
  [...page.matchAll(/<div class="fx-photo" data-stage="(\w+)" style="--fx:([\d.]+);background-image:url\(([^)]+)\)/g)].map((m) => [m[1]!, Number(m[2]), m[3]!]);

function desktopOf(day: number, beat: Beat = "work"): string {
  const store = storeAt(day);
  const session: Session = initialSession(clock(beat), "left", "desktop");
  return renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, Date.UTC(2026, 9, 31, 12), day)).value;
}

describe("the collapse is in the photos", () => {
  it("snapshots: 房间, 桌子 and 门 on days 10, 11, 12, 13, 15, 16, 17, 18 (which photos, which opacities)", () => {
    const out: Record<string, [string, number, string][]> = {};
    for (const day of [10, 11, 12, 13, 15, 16, 17, 18]) for (const view of STILLS) out[`${view} day ${day}`] = photosIn(stillPage(day, view));
    expect(out).toMatchSnapshot();
  });

  it("snapshot: the markup of the stack on day 16 (glitch over other, with its flicker keyframes)", () => {
    expect(stackOf(stillPage(16, "room"))).toMatchSnapshot();
    expect(stackOf(stillPage(14, "desk"))).toMatchSnapshot();
  });

  it("snapshot: the desktop on days 13 and 17 keeps only the pores on the left monitor and the dimmed text", () => {
    const stage = (page: string) => /<div class="stage one-monitor"[^>]*>/.exec(page)![0];
    const d13 = desktopOf(13);
    const d17 = desktopOf(17);
    expect({ "day 13": stage(d13), "day 17": stage(d17) }).toMatchSnapshot();
    expect(stage(d13)).toContain('data-fx="pores" style="--fx-pores:0.5"');
    expect(stage(d17)).toContain('data-fx="pores dim" style="--fx-pores:0.3"');
    // No photo stack and no overlay on the desktop.
    for (const page of [d13, d17]) expect(page).not.toContain('class="fx"');
  });

  it("the stack by day, exactly as the spec has it", () => {
    const at = (day: number) => (fxPlan(day, "room")?.layers ?? []).map((l) => [l.stage, l.opacity]);
    expect(at(11)).toEqual([["wall", 0.6]]);
    expect(at(12)).toEqual([["wall", 1]]);
    expect([13, 14, 15].map(at)).toEqual([[["other", 0.5]], [["other", 0.8]], [["other", 1]]]);
    expect(at(16)).toEqual([["other", 1], ["glitch", 0.45]]);
    expect(at(17)).toEqual([["other", 0.4], ["white", 0.85]]);
    expect(at(18)).toEqual([["white", 1]]);
    // The good ending's day 19 keeps day 18's photos.
    expect(at(19)).toEqual(at(18));
  });

  it("clean before day 11 and on day 10: no stack, in any still, any beat", () => {
    for (let day = 1; day <= 10; day++) {
      for (const view of STILLS) for (const beat of ["boot", "night"] as const) expect(stackOf(stillPage(day, view, beat)), `day ${day} ${view} ${beat}`).toBeNull();
    }
    for (let day = 1; day <= 10; day++) expect(STACK_BY_DAY[day]).toBeUndefined();
  });

  it("the same stack at night: the dark layers above it do their work", () => {
    for (const day of [11, 13, 16, 17, 18]) for (const view of STILLS) expect(photosIn(stillPage(day, view, "night"))).toEqual(photosIn(stillPage(day, view, "work")));
  });

  it("each still shows the photos of its own framing: room_ / desk_ / door_, under the scene", () => {
    for (const view of STILLS) {
      const photos = photosIn(stillPage(16, view));
      expect(photos.map(([, , url]) => url)).toEqual([`/room/fx/${view}_other.jpg`, `/room/fx/${view}_glitch.jpg`]);
    }
    const page = stillPage(13, "desk");
    expect(page.indexOf('class="fx"')).toBeLessThan(page.indexOf('class="desk-things"'));
    expect(page.indexOf('class="fx"')).toBeLessThan(page.indexOf('class="items-btn'));
  });

  it("the fx layer is the first child of the stage and ignores clicks (CSS)", () => {
    const page = stillPage(13, "room");
    expect(page).toMatch(/<div class="stage room room-view"[^>]*><div class="fx"/);
  });

  describe("properties", () => {
    const days = fc.integer({ min: 1, max: 20 });
    const views = fc.constantFrom<FxView>("room", "desk", "door", "desktop");

    it("clean before day 11 and on day 10", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), views, (day, view) => {
          expect(fxPlan(day, view)?.layers ?? []).toEqual([]);
        }),
      );
    });

    it("opacities are within [0, 1], and in the markup too", () => {
      fc.assert(
        fc.property(days, views, (day, view) => {
          const plan = fxPlan(day, view);
          for (const l of plan?.layers ?? []) {
            expect(l.opacity).toBeGreaterThanOrEqual(0);
            expect(l.opacity).toBeLessThanOrEqual(1);
          }
          if (plan?.pores != null) expect(plan.pores >= 0 && plan.pores <= 1).toBe(true);
          for (const [, o] of photosIn(renderFx(plan)?.value ?? "")) expect(o >= 0 && o <= 1).toBe(true);
        }),
      );
    });

    it("the stage order is monotone: wall → other → glitch → white, in a day and across days, never back", () => {
      fc.assert(
        fc.property(days, (day) => {
          const stages = (fxPlan(day, "room")?.layers ?? []).map((l) => stageIndex(l.stage));
          expect([...stages].sort((a, b) => a - b)).toEqual(stages);
          expect(new Set(stages).size).toBe(stages.length);
          if (day > 1) {
            const before = (fxPlan(day - 1, "room")?.layers ?? []).map((l) => stageIndex(l.stage));
            expect(Math.max(-1, ...stages)).toBeGreaterThanOrEqual(Math.max(-1, ...before));
          }
        }),
      );
    });

    it("deterministic", () => {
      fc.assert(
        fc.property(days, views, (day, view) => {
          expect(fxPlan(day, view)).toEqual(fxPlan(day, view));
          expect(renderFx(fxPlan(day, view))?.value).toEqual(renderFx(fxPlan(day, view))?.value);
        }),
      );
    });

    it("only the glitch layer flickers, and only the stack of day 16 has one", () => {
      fc.assert(
        fc.property(days, (day) => {
          const flickers = (fxPlan(day, "room")?.layers ?? []).filter((l) => l.flicker).map((l) => l.stage);
          expect(flickers).toEqual(day === 16 ? ["glitch"] : []);
        }),
      );
    });
  });

  describe("the glitch flicker", () => {
    it("is seeded by the day: the same day flickers the same way, another day does not", () => {
      expect(glitchFlicker(16)).toEqual(glitchFlicker(16));
      expect(flickerCss(16)).toBe(flickerCss(16));
      expect(glitchFlicker(16)).not.toEqual(glitchFlicker(15));
    });

    it("steps at irregular intervals of 0.3–2 s, opacity 0.45 ± 0.3, starting at the layer's own 0.45", () => {
      const f = glitchFlicker(16);
      expect(f.steps).toHaveLength(FLICKER_STEPS);
      expect(f.steps[0]).toEqual({ at: 0, opacity: 0.45 });
      const gaps = f.steps.slice(1).map((s, i) => (s.at - f.steps[i]!.at) * f.durationMs);
      for (const gap of gaps) {
        expect(gap).toBeGreaterThanOrEqual(FLICKER_MS[0] - 1e-6);
        expect(gap).toBeLessThanOrEqual(FLICKER_MS[1] + 1e-6);
      }
      expect(new Set(gaps.map((g) => Math.round(g))).size).toBeGreaterThan(10);
      for (const s of f.steps) {
        expect(s.opacity).toBeGreaterThanOrEqual(0.45 - FLICKER_SWING - 1e-9);
        expect(s.opacity).toBeLessThanOrEqual(0.45 + FLICKER_SWING + 1e-9);
      }
      // It does flicker: not one steady value.
      expect(new Set(f.steps.map((s) => s.opacity)).size).toBeGreaterThan(5);
      expect(f.steps.every((s, i) => i === 0 || s.at > f.steps[i - 1]!.at && s.at < 1)).toBe(true);
    });

    it("property: for any day the schedule is valid and deterministic", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 40 }), (day) => {
          const a = glitchFlicker(day);
          expect(glitchFlicker(day)).toEqual(a);
          expect(a.durationMs).toBeGreaterThanOrEqual(FLICKER_STEPS * FLICKER_MS[0]);
          expect(a.durationMs).toBeLessThanOrEqual(FLICKER_STEPS * FLICKER_MS[1]);
          expect(a.steps.every((s) => s.opacity >= 0.15 - 1e-9 && s.opacity <= 0.75 + 1e-9)).toBe(true);
        }),
      );
    });

    it("the markup carries the keyframes and the animation as a variable; reduced motion turns it off (steady 0.45)", () => {
      const out = stackOf(stillPage(16, "room"))!;
      expect(out).toContain(`<style>${flickerCss(16)}</style>`);
      expect(out).toMatch(/data-stage="glitch" style="--fx:0\.45;background-image:url\(\/room\/fx\/room_glitch\.jpg\);--flicker:fx-flicker-16 [\d.]+s steps\(1,end\) infinite"/);
      expect(stackOf(stillPage(15, "room"))).not.toContain("<style>");
      const css = readFileSync(resolve(__dirname, "../src/world/room/fx.css"), "utf8");
      expect(css).toContain('.fx-photo[data-stage="glitch"]{animation:var(--flicker,none)}');
      expect(css).toContain('@media (prefers-reduced-motion:reduce){.fx-photo[data-stage="glitch"]{animation:none}}');
    });
  });

  describe("the desktop keeps the pores, the tint and the dimmed text", () => {
    it("pores from ring room: 0.5 / 0.75 / 1 across 13–15, 0.5 on 16, 0.3 on the white days; none before", () => {
      const pores = (day: number) => fxPlan(day, "desktop")?.pores ?? null;
      expect([11, 12].map(pores)).toEqual([null, null]);
      expect([13, 14, 15, 16, 17, 18].map(pores)).toEqual([0.5, 0.75, 1, 0.5, 0.3, 0.3]);
      expect(fxPlan(12, "desktop")).toBeNull();
      expect(fxStageAttrs(fxPlan(12, "desktop"))).toBeNull();
    });

    it("the text dims on days 17 and 18 only; the stills never carry the flag", () => {
      expect([15, 16, 17, 18].map((d) => fxPlan(d, "desktop")!.dimText)).toEqual([false, false, true, true]);
      expect(fxPlan(17, "room")!.dimText).toBe(false);
      expect(fxPlan(17, "room")!.pores).toBeNull();
    });

    it("the desktop's --tint is untouched (the ring variables are still on the monitor)", () => {
      const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
      expect(css).toContain("--tint:");
      expect(desktopOf(13)).toContain('data-ring="room"');
    });
  });

  describe("the CSS and the assets", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/fx.css"), "utf8");

    it("the layer takes no click and lies under the scene", () => {
      expect(css).toMatch(/\.fx\{[^}]*pointer-events:none/);
      expect(css).toMatch(/\.fx-photo\{[^}]*opacity:var\(--fx\)/);
    });

    it("every photo the stack can name exists (12 stage photos), and the pore tile; veins.png is not needed", () => {
      for (const view of STILLS) for (const stage of STAGES) expect(existsSync(resolve(__dirname, "../public/room/fx", `${view}_${stage}.jpg`)), `${view}_${stage}`).toBe(true);
      expect(existsSync(resolve(__dirname, "../public/room/fx/pores.jpg"))).toBe(true);
    });

    it("nothing in src refers to the veins any more", () => {
      const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
      const hits = walk(resolve(__dirname, "../src")).filter((f) => /\.(ts|css)$/.test(f) && /veins/i.test(readFileSync(f, "utf8")));
      expect(hits).toEqual([]);
    });
  });
});
