// chick-face v3 (author 2026-11-24 #24): a 48 × 52 LCD — the eight icons on the screen, a row of four
// above the pet and a row of four below, the selected one inverted; the shell prints nothing. The
// status screen shows each stat's number after its bar. (v2, 2026-11-15, had the icons printed on the bezel.)
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import { chick, CHICK_SCREEN_H, drawChick, drawNumber, ICON_ROW_H, ICON_XS, PET_Y, STAT_BAR_MAX, STAT_BAR_X, type ChickState } from "@world/objects/chick";
import { ascii, Bits, type PixelFrame } from "@world/objects/frame";
import { CHICK_H, CHICK_ICONS, CHICK_W, chickFrames, ICON_SIZE, missingChickFrames } from "@world/objects/frames";
import type { ObjectEnv } from "@world/objects/program";
import { chickIconMark, renderDevice } from "@world/room/devices";

const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, taken: false, time: "09:30", t: 0, seed: "run:4:chick", lit: 1, pager: [], uses: 0, ...over });
const on = (f: PixelFrame, x: number, y: number) => f.bits[y * f.w + x] === 1;
const iconRows = (icon: string) => chickFrames.icons.get(icon as never)!;

describe("the content and the constants", () => {
  it("48 × 32 pet frames, 9 × 9 icons, a 48 × 52 screen, nothing owed", () => {
    expect([CHICK_W, CHICK_H, ICON_SIZE, ICON_ROW_H, CHICK_SCREEN_H, PET_Y]).toEqual([48, 32, 9, 10, 52, 10]);
    expect(chick.channel).toEqual({ w: 48, h: 52 });
    expect(missingChickFrames()).toEqual([]);
    for (const rows of chickFrames.frames.values()) expect([rows.length, rows[0]!.length]).toEqual([32, 48]);
    for (const rows of chickFrames.icons.values()) expect([rows.length, rows[0]!.length]).toEqual([9, 9]);
    expect(ICON_XS.map((x) => x + ICON_SIZE <= CHICK_W)).toEqual([true, true, true, true]);
  });
});

describe("the icons on the LCD", () => {
  it("a row of four above the pet and four below, in A's order; nothing inverted with no menu", () => {
    const f = drawChick(chick.init(env()) as ChickState, env()) as PixelFrame;
    expect([f.w, f.h]).toEqual([48, 52]);
    CHICK_ICONS.forEach((icon, i) => {
      const x0 = ICON_XS[i % 4]!;
      const y0 = i < 4 ? 0 : PET_Y + CHICK_H + 1;
      iconRows(icon).forEach((row, y) => [...row].forEach((c, x) => expect(on(f, x0 + x, y0 + y), `${icon} ${x},${y}`).toBe(c === "#")));
    });
    // the gap rows between the icons and the pet are empty
    for (let x = 0; x < CHICK_W; x++) expect(on(f, x, ICON_ROW_H - 1) || on(f, x, PET_Y + CHICK_H)).toBe(false);
  });
  it("A selects: the selected icon's cell is inverted on the LCD; the pet's picture is unchanged; C clears it", () => {
    let p = chick.init(env()) as ChickState;
    for (let i = 0; i < 6; i++) p = chick.key(p, "A", env({ t: i })).state;
    expect(p.menu).toBe(5);
    const sel = drawChick(p, env({ t: 50 })) as PixelFrame;
    const none = drawChick({ ...p, menu: null }, env({ t: 50 })) as PixelFrame;
    // the pet region is the same picture
    for (let y = PET_Y; y < PET_Y + CHICK_H; y++) for (let x = 0; x < CHICK_W; x++) expect(on(sel, x, y)).toBe(on(none, x, y));
    // icon 5 (bottom row, second cell) is inverted: its blank corner pixel is now on
    const x0 = ICON_XS[1]!;
    const y0 = PET_Y + CHICK_H + 1;
    const corner = [...iconRows(CHICK_ICONS[5]!)[0]!][0] === "#";
    expect(on(sel, x0, y0)).toBe(!corner);
    expect(on(none, x0, y0)).toBe(corner);
    // the other icons are not inverted
    expect(on(sel, ICON_XS[0]!, 0)).toBe(on(none, ICON_XS[0]!, 0));
    const cleared = chick.key(p, "C", env({ t: 60 })).state;
    expect(ascii(drawChick(cleared, env({ t: 60 })) as PixelFrame)).toBe(ascii(none));
  });
  it("the shell prints no icon rows; the glass is the whole 48 × 52 screen", () => {
    const store = createStore({ startDay: 4 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    const out = renderDevice("chick", store.getState(), session, 0, 0, true, chick.init(env()))!.value;
    expect(out).not.toContain("egg-icons");
    expect(out).toMatch(/<canvas class="dev" data-screen="chick" width="\d+" height="\d+"/);
    const m = /width="(\d+)" height="(\d+)"/.exec(out)!;
    expect(Number(m[2]) / Number(m[1])).toBeCloseTo(52 / 48, 5);
  });
  it("upgraded: the rows stay empty (the new world has no menu)", () => {
    let p = chick.init(env({ upgraded: true })) as ChickState;
    p = { ...p, menu: 2 };
    const f = drawChick(p, env({ upgraded: true }));
    expect(f.kind).toBe("hi");
    if (f.kind === "hi" && f.picture) {
      const pic = f.picture;
      for (let x = 0; x < pic.w; x++) expect(pic.bits[x]).toBe(0);
    }
  });
  it("chickIconMark: the content's bitmap as crisp unit squares, lit when `on`", () => {
    expect(chickIconMark("meal").value).toContain('shape-rendering="crispEdges"');
    expect(chickIconMark("meal", true).value).toContain('class="egg-ic on"');
  });
});

describe("the status screen's numbers", () => {
  it("drawNumber: 3 × 5 digits right-aligned at `right`", () => {
    const b = new Bits(12, 5);
    drawNumber(b, 7, 11, 0);
    // 7 = ### / ..# / .#. / .#. / .#. at x 9..11
    expect([b.get(9, 0), b.get(10, 0), b.get(11, 0), b.get(9, 1), b.get(11, 1), b.get(10, 2)]).toEqual([1, 1, 1, 0, 1, 1]);
    const c = new Bits(12, 5);
    drawNumber(c, 42, 11, 0);
    expect(c.get(5, 0)).toBe(1); // the 4's top-left at x 5
    expect(c.get(8, 0)).toBe(0); // the gap column between the digits
  });
  it("check-up: each bar from x = 15 capped at 20, then its number ending at x = 47", () => {
    const e = env({ stats: { atk: 3, def: 0, hp: 40, spd: 1 } });
    let s = chick.init(e) as ChickState;
    for (let i = 0; i < 6; i++) s = chick.key(s, "A", e).state;
    s = chick.key(s, "B", e).state;
    expect(s.act?.kind).toBe("check");
    const f = drawChick(s, e) as PixelFrame;
    const row = (i: number) => PET_Y + 3 + 8 * i;
    expect([STAT_BAR_X, STAT_BAR_MAX]).toEqual([15, 20]);
    // 攻 3: three wide
    expect([on(f, 15, row(0)), on(f, 17, row(0)), on(f, 18, row(0))]).toEqual([true, true, false]);
    // 血 40: capped at 20 wide, and its number 40 drawn (the 4's top-left at x 41)
    expect([on(f, 34, row(2)), on(f, 35, row(2)), on(f, 41, PET_Y + 2 + 16)]).toEqual([true, false, true]);
  });
});
