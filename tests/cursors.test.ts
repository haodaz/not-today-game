// room-scene addition 2026-11-02 "the cursor says what you can do here": a still cursor set in the
// game (never the title page). Test: every cursor has a rule with the hotspot from cursors.json;
// the cursors.json hotspots are inside 0–31; the rules are not applied to the title page.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const css = readFileSync(resolve(root, "src/world/room/cursors.css"), "utf8");
const hotspots = JSON.parse(readFileSync(resolve(root, "public/cursors/cursors.json"), "utf8")) as {
  hotspots: Record<string, { x: number; y: number }>;
};
const CURSORS = ["default", "point", "look", "take", "open", "walk", "back", "turn-left", "turn-right"] as const;

describe("the cursor set", () => {
  it("every cursor's hotspot is listed and inside 0–31", () => {
    const h = hotspots.hotspots;
    for (const name of CURSORS) {
      expect(h[name], name).toBeDefined();
      expect(h[name]!.x, `${name}.x`).toBeGreaterThanOrEqual(0);
      expect(h[name]!.x, `${name}.x`).toBeLessThanOrEqual(31);
      expect(h[name]!.y, `${name}.y`).toBeGreaterThanOrEqual(0);
      expect(h[name]!.y, `${name}.y`).toBeLessThanOrEqual(31);
    }
  });

  it("every cursor has a CSS rule using its image and its json hotspot", () => {
    const h = hotspots.hotspots;
    for (const name of CURSORS) {
      const { x, y } = h[name]!;
      // e.g. cursor: url(/cursors/point.png) 11 3, auto;
      const rule = new RegExp(`cursor:\\s*url\\(/cursors/${name}\\.png\\)\\s*${x}\\s*${y}\\s*,\\s*auto`);
      expect(css, `${name} rule with hotspot ${x} ${y}`).toMatch(rule);
    }
  });

  it("every cursor image a rule names has a matching json hotspot (no stray cursor)", () => {
    const used = [...css.matchAll(/url\(\/cursors\/([a-z-]+)\.png\)\s*(\d+)\s*(\d+)/g)];
    expect(used.length).toBeGreaterThan(0);
    for (const [, name, x, y] of used) {
      const h = hotspots.hotspots[name!];
      expect(h, `${name} in json`).toBeDefined();
      expect([h!.x, h!.y], `${name} hotspot`).toEqual([Number(x), Number(y)]);
    }
  });

  it("is a game cursor set, not the title page's", () => {
    expect(css).not.toMatch(/\.title-page/);
    // The game roots carry the default cursor.
    expect(css).toMatch(/\.room[\s\S]*cursor:\s*url\(\/cursors\/default\.png\)/);
  });

  it("the key categories target their hotspot classes/actions", () => {
    expect(css).toContain(".monitor-hit"); // look: a screen hotspot
    expect(css).toContain('[data-action="loop-phone"]'); // take: the phone
    expect(css).toContain('[data-action="pick-box"]'); // open: the box
    expect(css).toContain('[data-action="view"][data-view="desk"]'); // walk: the desk
    expect(css).toContain(".back-room"); // back: 回房间
    expect(css).toContain(".chip"); // point: a chip
  });

  it("the turn edges use the turn cursors, walk stays for walking up to things (room-turn correction 2026-11-04)", () => {
    const rule = (sel: string) => {
      const m = new RegExp(`${sel.replace(/[.[\]"=-]/g, "\\$&")}\\s*\\{[^}]*\\}`).exec(css);
      return m?.[0] ?? "";
    };
    expect(rule(".room.edge-left")).toMatch(/url\(\/cursors\/turn-left\.png\)/);
    expect(rule(".room.edge-right")).toMatch(/url\(\/cursors\/turn-right\.png\)/);
    const walk = /([^{}]*)\{\s*cursor:\s*url\(\/cursors\/walk\.png\)/.exec(css)?.[1] ?? "";
    expect(walk).not.toMatch(/edge-(left|right)/);
    expect(walk).toContain('[data-action="view"][data-view="desk"]');
  });
});
