// Room-scene addition 2026-11-02: the collapse on the stills. Snapshots of the .fx children and
// their variables (not pixels), and the rules: nothing before ring wall, nothing on day 10,
// every variable in [0, 1], no grade at night.
import fc from "fast-check";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { desktopApps } from "@world/desktop/apps";
import { BEATS, type Beat, type BeatClock } from "@world/desktop/beat";
import { buildShell, initialSession, type Session } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import { RINGS } from "@world/desktop/rings";
import { deskLayout } from "@world/room/desk";
import { fxPlan, fxStageAttrs, GLOW_PAD, renderFx, ROOM_LAMP, type FxView } from "@world/room/fx";
import { renderRoom } from "@world/room/hud";

const VIEWS: readonly FxView[] = ["room", "desk", "door", "desktop"];
const clock = (beat: Beat): BeatClock => ({ beat, time: beat === "night" ? "23:41" : "10:00" });

function storeAt(day: number) {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}

/** The .fx layer of a still, as rendered by the room. */
function stillFx(day: number, view: "room" | "desk" | "door", beat: Beat = "work"): string | null {
  const store = storeAt(day);
  const session: Session = initialSession(clock(beat), "left", view);
  const out = renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
  return /<div class="fx"[^>]*>.*?<\/div><\/div>|<div class="fx"[^>]*><\/div>/s.exec(out)?.[0] ?? null;
}

function desktopOf(day: number, beat: Beat = "work"): string {
  const store = storeAt(day);
  const session: Session = initialSession(clock(beat), "left", "desktop");
  return renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, Date.UTC(2026, 9, 31, 12), day)).value;
}

describe("the collapse on the stills", () => {
  it("snapshots: 房间 and 桌子 on days 10, 11, 13, 14, 17, 18", () => {
    const out: Record<string, string | null> = {};
    for (const day of [10, 11, 13, 14, 17, 18]) {
      out[`房间 day ${day}`] = stillFx(day, "room");
      out[`桌子 day ${day}`] = stillFx(day, "desk");
    }
    expect(out).toMatchSnapshot();
  });

  it("snapshots: 门 on days 16, 17, 18, and the night grade", () => {
    expect({
      "门 day 16": stillFx(16, "door"),
      "门 day 17": stillFx(17, "door"),
      "门 day 18": stillFx(18, "door"),
      "房间 day 13 night": stillFx(13, "room", "night"),
      "房间 day 11 night": stillFx(11, "room", "night"),
    }).toMatchSnapshot();
  });

  it("snapshot: the desktop on day 13 (and 17, with its dimmed text)", () => {
    const stage = (page: string) => /<div class="stage one-monitor"[^>]*>/.exec(page)![0];
    const layer = (page: string) => /<div class="fx".*?<\/div><\/div>/s.exec(page)?.[0] ?? null;
    const d13 = desktopOf(13);
    const d17 = desktopOf(17);
    expect({ "day 13": { stage: stage(d13), fx: layer(d13) }, "day 17": { stage: stage(d17), fx: layer(d17) } }).toMatchSnapshot();
    // The left monitor's own background takes the pores: the stage carries the flag and the level.
    expect(stage(d13)).toContain('data-fx="pores" style="--fx-pores:0.5"');
    expect(stage(d17)).toContain('data-fx="pores dim"');
  });

  it("nothing before ring wall, and nothing on day 10 (calm), in any view or beat", () => {
    for (let day = 1; day <= 10; day++) {
      for (const view of VIEWS) for (const beat of BEATS) expect(fxPlan(day, beat, view), `day ${day} ${view} ${beat}`).toBeNull();
    }
    for (const view of ["room", "desk", "door"] as const) expect(stillFx(5, view)).toBeNull();
    expect(stillFx(10, "room")).toBeNull();
    expect(desktopOf(10)).not.toContain('class="fx"');
  });

  it("the layer starts at ring wall: day 11", () => {
    expect(RINGS[RINGS.indexOf("wall")]).toBe("wall");
    expect(fxPlan(11, "work", "room")).not.toBeNull();
  });

  it("strength by day within the ring: 0.5, 0.75, 1 (day 10, the first of wall, is calm)", () => {
    const level = (day: number, id: string, view: FxView = "room") => fxPlan(day, "work", view)!.children.find((c) => c.id === id)?.level;
    expect([11, 12].map((d) => level(d, "veins"))).toEqual([0.75, 1]);
    expect([13, 14, 15].map((d) => level(d, "pores"))).toEqual([0.5, 0.75, 1]);
    expect([16].map((d) => level(d, "pores"))).toEqual([0.5]);
    // Veins stay from wall, at 0.5; day 17 and 18 fade veins and pores to 0.3.
    expect([13, 14, 15, 16].map((d) => level(d, "veins"))).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect([17, 18].flatMap((d) => [level(d, "veins"), level(d, "pores")])).toEqual([0.3, 0.3, 0.3, 0.3]);
  });

  it("wall: veins and the pink lamp, no grade and no pores", () => {
    const ids = (view: FxView) => fxPlan(12, "work", view)!.children.map((c) => c.id);
    expect(ids("room")).toEqual(["veins", "lamp"]);
    expect(ids("desk")).toEqual(["veins", "lamp"]);
    expect(ids("door")).toEqual([]);
  });

  it("the lamp's light sits at the lamp's rect: desk.json's in 桌子, the measured spot in 房间; padded for the glow", () => {
    const rectOf = (view: FxView) => fxPlan(12, "work", view)!.children.find((c) => c.id === "lamp")!.rect!;
    expect(rectOf("desk")).toEqual({ l: deskLayout.lamp.l - GLOW_PAD, t: deskLayout.lamp.t - GLOW_PAD, w: deskLayout.lamp.w + 2 * GLOW_PAD, h: deskLayout.lamp.h + 2 * GLOW_PAD });
    expect(rectOf("room")).toEqual({ l: ROOM_LAMP.l - GLOW_PAD, t: ROOM_LAMP.t - GLOW_PAD, w: ROOM_LAMP.w + 2 * GLOW_PAD, h: ROOM_LAMP.h + 2 * GLOW_PAD });
    // 2048 × 1152 image px (1090–1290 × 420–600) × 0.78125
    expect(ROOM_LAMP).toEqual({ l: Math.round(1090 * 0.78125), t: Math.round(420 * 0.78125), w: Math.round(200 * 0.78125), h: Math.round(180 * 0.78125) });
  });

  it("room: grade and pores, and the veins at 0.5; day 14's grade is warm; day 17 on it is white", () => {
    const grade = (day: number) => fxPlan(day, "work", "room")!.children.find((c) => c.id === "grade")!.grade;
    expect([13, 14, 15, 16, 17, 18].map(grade)).toEqual(["cool", "warm", "cool", "cool", "white", "white"]);
    expect(fxPlan(14, "work", "room")!.children.map((c) => c.id)).toEqual(["veins", "grade", "pores"]);
  });

  it("night beats keep their look: no grade at night, the rest of the layer stays", () => {
    for (const day of [13, 14, 16, 17, 18]) {
      const ids = fxPlan(day, "night", "room")!.children.map((c) => c.id);
      expect(ids, `day ${day}`).not.toContain("grade");
      expect(ids).toContain("pores");
    }
    expect(fxPlan(13, "work", "room")!.children.map((c) => c.id)).toContain("grade");
  });

  it("door: day 16 darkens 门 by 25 %; day 17 and 18 do not, and have the white vignette at 0.45 and 0.6", () => {
    const door = (day: number) => Object.fromEntries(fxPlan(day, "work", "door")!.children.map((c) => [c.id, c.level]));
    expect(door(16)).toEqual({ grade: 1, pores: 0.5, dark: 0.25 });
    expect(door(17)).toEqual({ grade: 1, pores: 0.3, vignette: 0.45 });
    expect(door(18)).toEqual({ grade: 1, pores: 0.3, vignette: 0.6 });
    expect(fxPlan(16, "work", "room")!.children.map((c) => c.id)).not.toContain("dark");
  });

  it("the desktop: no veins, no lamp; the pores are on the left monitor's background; the text dims from day 17", () => {
    const d13 = fxPlan(13, "work", "desktop")!;
    expect(d13.children.map((c) => c.id)).toEqual(["grade"]);
    expect(d13).toMatchObject({ pores: 0.5, dimText: false });
    expect(fxPlan(17, "work", "desktop")).toMatchObject({ pores: 0.3, dimText: true });
    expect(fxPlan(12, "work", "desktop")).toMatchObject({ pores: null, dimText: false });
    expect(fxStageAttrs(fxPlan(12, "work", "desktop"))).toBeNull();
  });

  it("the layer sits over the backdrop and the placed things and under the HUD", () => {
    const store = storeAt(13);
    const out = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(clock("work"), "left", "desk") }).value;
    const at = (needle: string) => out.indexOf(needle);
    expect(at('class="desk-things"')).toBeGreaterThan(-1);
    expect(at('class="fx"')).toBeGreaterThan(at('class="desk-things"'));
    expect(at('class="fx"')).toBeLessThan(at('class="items-btn')); // the HUD's buttons
  });

  describe("properties", () => {
    const days = fc.integer({ min: 1, max: 20 });
    const beats = fc.constantFrom(...BEATS);
    const views = fc.constantFrom(...VIEWS);

    it("every variable is within [0, 1]", () => {
      fc.assert(
        fc.property(days, beats, views, (day, beat, view) => {
          const plan = fxPlan(day, beat, view);
          for (const c of plan?.children ?? []) {
            expect(c.level).toBeGreaterThanOrEqual(0);
            expect(c.level).toBeLessThanOrEqual(1);
          }
          if (plan?.pores != null) {
            expect(plan.pores).toBeGreaterThanOrEqual(0);
            expect(plan.pores).toBeLessThanOrEqual(1);
          }
          const html = renderFx(plan)?.value ?? "";
          for (const m of html.matchAll(/--fx:([\d.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(1);
        }),
      );
    });

    it("no child before ring wall, none on day 10, and never a grade at night", () => {
      fc.assert(
        fc.property(days, beats, views, (day, beat, view) => {
          const plan = fxPlan(day, beat, view);
          const ring = RINGS.indexOf(day <= 3 ? "software" : day <= 6 ? "screen" : day <= 9 ? "desk" : day <= 12 ? "wall" : day <= 15 ? "room" : "door");
          if (ring < RINGS.indexOf("wall") || day === 10) expect(plan).toBeNull();
          if (beat === "night") expect(plan?.children.some((c) => c.id === "grade") ?? false).toBe(false);
        }),
      );
    });

    it("deterministic", () => {
      fc.assert(
        fc.property(days, beats, views, (day, beat, view) => {
          expect(fxPlan(day, beat, view)).toEqual(fxPlan(day, beat, view));
        }),
      );
    });
  });

  describe("the CSS and the assets", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/fx.css"), "utf8");

    it("the layer never takes a click, and reduced motion stops the breathing and the drift", () => {
      expect(css).toMatch(/\.fx\{[^}]*pointer-events:none/);
      expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.fx-veins,\.fx-pores\{animation:none\}\}/);
    });

    it("the files it points at exist", () => {
      for (const url of css.match(/\/room\/fx\/[\w.]+/g) ?? []) expect(existsSync(resolve(__dirname, "../public", url.slice(1))), url).toBe(true);
    });

    it("the numbers of the spec: veins 0.35 × s, breathing 1.00→1.02 in 6 s, pores 0.18 × s drifting 20 px in 12 s", () => {
      expect(css).toContain("opacity:calc(.35 * var(--fx))");
      expect(css).toContain("fx-breathe 6s");
      expect(css).toContain("scale(1.02)");
      expect(css).toContain("opacity:calc(.18 * var(--fx))");
      expect(css).toContain("fx-drift 12s");
      expect(css).toContain("translate(20px,20px)");
      expect(css).toContain("rgba(255,159,176,calc(.25 * var(--fx)))");
      expect(css).toContain("saturate(.8) sepia(.12) contrast(1.05)");
      expect(css).toContain("sepia(.2) brightness(1.05)");
      expect(css).toContain("brightness(1.3) contrast(.75) saturate(.5)");
    });
  });
});
