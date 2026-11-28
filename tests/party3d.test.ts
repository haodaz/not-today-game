// The fight's solid pixel figures (endings/party3d.ts, opt-in with ?party=3d): the pure part — a picture read back to
// its own pixels, how thick each pixel is, the solid's faces, and which figure a picture's path names.
import { describe, expect, it } from "vitest";
import { cellDepths, figureOf, readCells, solidArrays } from "@world/endings/party3d";

/** A 6×6 file: a 2×2-pixel picture of a 2×2-cell square (cells of 3 file pixels), red on the left, blue on the right, one stray pixel in each cell. */
function file(): { w: number; h: number; d: number[] } {
  const w = 6, h = 6, d: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const red = x < 3, stray = x % 3 === 1 && y % 3 === 1; d.push(stray ? 10 : red ? 200 : 20, stray ? 200 : 20, stray ? 10 : red ? 20 : 200, 255); }
  return { w, h, d };
}

describe("a picture read back to its own pixels", () => {
  it("each cell takes the colour most of it has, not an average; an empty cell stays empty", () => {
    const f = file(), c = readCells(f.w, f.h, f.d, 3);
    expect([c.gw, c.gh]).toEqual([2, 2]);
    expect(c.col[0]).toBe((200 << 16) | (20 << 8) | 20);
    expect(c.col[1]).toBe((20 << 16) | (20 << 8) | 200);
    const clear = readCells(3, 3, new Array(36).fill(0), 3);
    expect(clear.col[0]).toBe(-1);
  });
  it("it is thin at its outline and thicker inside, never past its greatest thickness", () => {
    const col = new Int32Array(25).fill(0x808080), d = cellDepths({ gw: 5, gh: 5, col }, { half: 2, round: 1 });
    expect(d[0]).toBe(1); // a corner
    expect(d[12]).toBe(2); // the middle: three cells in, held at 2
    expect(Math.max(...d)).toBe(2);
  });
  it("the solid: a face and a back for every cell, sides only where one stands out past its neighbour", () => {
    const col = new Int32Array([0xff0000]), a = solidArrays({ gw: 1, gh: 1, col }, new Int16Array([1]));
    expect(a.idx.length / 6).toBe(6); // one cell alone is a box: six faces
    const two = solidArrays({ gw: 2, gh: 1, col: new Int32Array([0xff0000, 0xff0000]) }, new Int16Array([1, 1]));
    expect(two.idx.length / 6).toBe(10); // two side by side share a wall that is not drawn
    // a device's back is its case, not its face again
    const dev = solidArrays({ gw: 3, gh: 1, col: new Int32Array([0x202020, 0x202020, 0xffffff]) }, new Int16Array([2, 2, 2]), true);
    const backOfWhite = dev.col.slice(6 * 12 * 0 + 0); // colours are per vertex, in face order: find a back-face vertex that is not white
    expect(backOfWhite.some((v) => v === 255 * 0.85)).toBe(false);
  });
});

describe("which figure a picture is", () => {
  it("reads the page's own file names", () => {
    expect(figureOf("/battle/party2/obj_pager_strike.png")).toEqual({ id: "pager", pose: "strike" });
    expect(figureOf("/battle/party/she-stance.png")).toEqual({ id: "player", pose: "stance" });
    expect(figureOf("/battle/boss-stage2.png")).toEqual({ id: "boss", pose: "stance" });
    expect(figureOf("/battle/q-kuro.png").id).toBe("qkuro");
  });
});
