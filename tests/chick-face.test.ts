// chick-face v2 (author 2026-11-15): a 48 × 32 LCD for the pet alone; the eight icons printed on the
// egg's bezel, two rows of four around the glass, the selected one lit; nothing marked when upgraded.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import { chick, drawChick, type ChickState } from "@world/objects/chick";
import { ascii, type PixelFrame } from "@world/objects/frame";
import { CHICK_H, CHICK_ICONS, CHICK_W, chickFrames, ICON_SIZE, missingChickFrames } from "@world/objects/frames";
import type { ObjectEnv } from "@world/objects/program";
import { chickIconRows, renderDevice } from "@world/room/devices";

const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, taken: false, time: "09:30", t: 0, seed: "run:4:chick", lit: 1, pager: [], uses: 0, ...over });

describe("the content and the constants", () => {
  it("48 × 32 frames, 9 × 9 icons, nothing owed", () => {
    expect([CHICK_W, CHICK_H, ICON_SIZE]).toEqual([48, 32, 9]);
    expect(missingChickFrames()).toEqual([]);
    for (const rows of chickFrames.frames.values()) expect([rows.length, rows[0]!.length]).toEqual([32, 48]);
    for (const rows of chickFrames.icons.values()) expect([rows.length, rows[0]!.length]).toEqual([9, 9]);
  });
});

describe("the egg's printed icons", () => {
  const icons = (out: string) => [...out.matchAll(/<i class="egg-ic( on)?" data-icon="(\w+)">/g)].map((m) => [m[2], m[1] === " on"]);
  it("two rows of four in A's order, top row first; none lit with no menu", () => {
    const { top, bottom } = chickIconRows(null, false);
    expect(icons(top.value).map((x) => x[0])).toEqual(CHICK_ICONS.slice(0, 4));
    expect(icons(bottom.value).map((x) => x[0])).toEqual(CHICK_ICONS.slice(4));
    expect([...icons(top.value), ...icons(bottom.value)].some((x) => x[1])).toBe(false);
    expect(top.value).toContain('shape-rendering="crispEdges"');
  });
  it("the selected one carries `on` (in the shell's markup), the LCD does not change; upgraded marks none", () => {
    const store = createStore({ startDay: 4 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    let p = chick.init(env()) as ChickState;
    for (let i = 0; i < 6; i++) p = chick.key(p, "A", env({ t: i })).state;
    expect(p.menu).toBe(5);
    const out = renderDevice("chick", store.getState(), session, 0, 0, true, p)!.value;
    const all = icons(out);
    expect(all).toHaveLength(8);
    expect(all.filter((x) => x[1]).map((x) => x[0])).toEqual([CHICK_ICONS[5]]);
    // the glass is between the rows
    expect(out.indexOf('class="egg-icons egg-top"')).toBeLessThan(out.indexOf('class="glass"'));
    expect(out.indexOf('class="glass"')).toBeLessThan(out.indexOf('class="egg-icons egg-bottom"'));
    expect(ascii(drawChick(p, env({ t: 50 })) as PixelFrame)).toBe(ascii(drawChick({ ...p, menu: null }, env({ t: 50 })) as PixelFrame));
    const up = chickIconRows(5, true);
    expect([...icons(up.top.value), ...icons(up.bottom.value)].some((x) => x[1])).toBe(false);
  });
});
