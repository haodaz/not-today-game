// The screen's own collapse (author 2026-11-28: 「18天屏幕上的崩坏不能是这种的…屏幕上文字动画飘过的触须，
// 游动的怪物」): creatures made of the screen's characters, by ring; the windows are no longer faded.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { eyeGlyphs, EYE_EVERY_S, fishGlyphs, glyphsFrom, lifeGlyphs, lifePlan, NO_LIFE, SCREEN_H, SCREEN_W, swimmerGlyphs, tendrilGlyphs } from "@world/desktop/textlife/plan";
import { textLifeEnabled } from "@world/desktop/textlife/layer";

describe("what lives on the screen, by day", () => {
  it("nothing on days 1–9 and on the calm day", () => {
    for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(lifePlan(day), `day ${day}`).toEqual(NO_LIFE);
  });

  it("a fish from the wall ring, the eye from the room ring, tendrils at the door, the swimmer on the last two days", () => {
    expect(lifePlan(11)).toMatchObject({ fish: 1, eye: false, tendrils: 0, swimmer: false });
    expect(lifePlan(13)).toMatchObject({ fish: 2, eye: true, tendrils: 0, swimmer: false });
    expect(lifePlan(16)).toMatchObject({ eye: true, tendrils: 3, swimmer: false });
    expect(lifePlan(17)).toMatchObject({ tendrils: 5, swimmer: true });
    expect(lifePlan(18)).toMatchObject({ tendrils: 7, swimmer: true });
    // it only ever gets stronger (the calm day apart), and the ink turns from the screen's grey to wine at the door
    let last = 0;
    for (let day = 11; day <= 18; day++) {
      expect(lifePlan(day).strength, `day ${day}`).toBeGreaterThanOrEqual(last);
      last = lifePlan(day).strength;
    }
    expect(lifePlan(12).ink).not.toBe(lifePlan(18).ink);
  });
});

describe("the creatures", () => {
  it("a fish waits, crosses the screen, and is gone; the same time gives the same fish", () => {
    const seen: number[] = [];
    for (let t = 0; t < 120; t += 0.5) seen.push(fishGlyphs(0, t, 7).length);
    expect(seen.some((n) => n === 0)).toBe(true);
    expect(seen.some((n) => n > 40)).toBe(true);
    const t = seen.findIndex((n) => n > 40) * 0.5 + 6;
    const a = fishGlyphs(0, t, 7), b = fishGlyphs(0, t + 2, 7);
    expect(fishGlyphs(0, t, 7)).toEqual(a);
    expect(Math.abs(b[0]!.x - a[0]!.x)).toBeGreaterThan(60); // it moves
    expect(new Set(a.map((g) => g.k)).size).toBe(a.length); // each cell its own character
  });

  it("the eye is shut most of the time, opens with a pupil, and shuts", () => {
    let open = 0, shut = 0, pupil = 0;
    for (let t = 0; t < EYE_EVERY_S; t += 0.1) {
      const g = eyeGlyphs(t, 3);
      if (g.length === 0) shut++;
      else {
        open++;
        if (g.length > 90) pupil++;
      }
    }
    expect(shut).toBeGreaterThan(open * 5);
    expect(pupil).toBeGreaterThan(10);
  });

  it("a tendril grows from an edge, is thicker at the root than at the tip, and draws back", () => {
    const lens: number[] = [];
    for (let t = 0; t < 40; t += 0.5) lens.push(tendrilGlyphs(0, t, 5).length);
    const peak = Math.max(...lens);
    expect(peak).toBeGreaterThan(100);
    expect(lens.some((n) => n > 0 && n < peak / 3)).toBe(true); // growing or going
    const full = tendrilGlyphs(0, lens.indexOf(peak) * 0.5, 5);
    const root = full[0]!, tip = full.at(-1)!;
    expect(root.size).toBeGreaterThan(tip.size + 6);
    // it starts at an edge of the screen
    expect(root.x < 40 || root.x > SCREEN_W - 40 || root.y < 60 || root.y > SCREEN_H - 90).toBe(true);
  });

  it("the swimmer is a head and seven arms, and crosses", () => {
    const frames = [];
    for (let t = 0; t < 70; t += 1) frames.push(swimmerGlyphs(t, 2));
    const shown = frames.filter((f) => f.length > 0);
    expect(shown.length).toBeGreaterThan(30);
    expect(shown[5]!.length).toBeGreaterThan(350);
    const xs = shown.map((f) => f[0]!.x);
    expect(Math.abs(xs.at(-1)! - xs[0]!)).toBeGreaterThan(SCREEN_W);
  });

  it("day 18 has everything at once; day 11 at most a fish", () => {
    let most18 = 0, most11 = 0;
    for (let t = 0; t < 140; t += 2) {
      most18 = Math.max(most18, lifeGlyphs(lifePlan(18), t, 9).length);
      most11 = Math.max(most11, lifeGlyphs(lifePlan(11), t, 9).length);
    }
    expect(most18).toBeGreaterThan(900);
    expect(most11).toBeLessThan(140);
    expect(lifeGlyphs(NO_LIFE, 30, 9)).toEqual([]);
  });

  it("they are made of the screen's own text; an empty screen lends a few characters", () => {
    expect(glyphsFrom("好。 收到。\n今天也辛苦了。早点睡。 相亲相爱一家人 爸妈 朋友圈 说点什么")).toContain("睡");
    expect(glyphsFrom("好。 收到。\n今天也辛苦了。早点睡。 相亲相爱一家人 爸妈 朋友圈 说点什么")).not.toContain(" ");
    expect(glyphsFrom("").length).toBeGreaterThan(10);
  });
});

describe("the old veil is gone", () => {
  it("no window is faded on days 17–18, and the screen is not blurred", () => {
    const fx = fs.readFileSync("src/world/room/fx.css", "utf8");
    expect(fx).not.toMatch(/data-fx~="dim"\][^{]*\{[^}]*opacity/);
    const css = fs.readFileSync("src/world/desktop/desktop.css", "utf8");
    expect(css).not.toMatch(/\.monitor\[data-ring="(wall|room|door)"\][^{]*\{[^}]*--blur/);
    expect(css).toContain("canvas.textlife{position:absolute;inset:0;width:100%;height:100%;pointer-events:none");
  });

  it("?fx=0 turns the creatures off (the headless walk)", () => {
    expect(textLifeEnabled("?fx=0")).toBe(false);
    expect(textLifeEnabled("?day=18")).toBe(true);
  });
});

describe("day 18, looking up from the bed", () => {
  it("the ceiling and the light have day 18's own line (author 2026-11-28)", async () => {
    const { t, hasString, setLocale } = await import("@world/i18n");
    expect(t("room.lying.ceiling.d18")).toBe("房子这样，押金肯定不退了吧。");
    expect(hasString("room.lying.lamp.d18")).toBe(true);
    setLocale("en");
    expect(t("room.lying.ceiling.d18")).toContain("deposit");
    setLocale("zh");
    const game = fs.readFileSync("src/world/room/game.ts", "utf8");
    expect(game).toContain("const own = `room.lying.${look}.d${String(day)}`;");
  });
});
