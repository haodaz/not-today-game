// The author, 2026-11-27: 「又把人物盖到蒙版里了吗」「人不该在里面」. The figures come before the mask in the layer's
// markup (the keeper wants them first), so the stylesheet has to put the mask under them.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/world/room/room.css", "utf8");
const rule = (selector: string): string => {
  const at = css.indexOf(`\n${selector}{`);
  if (at < 0) throw new Error(`no rule ${selector}`);
  return css.slice(at, css.indexOf("}", at));
};

describe("a standing figure is over the story's dim, never in it", () => {
  it("the layer is its own stacking context and the mask is the lowest thing in it", () => {
    expect(rule(".dlg-layer")).toMatch(/z-index:41/);
    expect(rule(".dlg-layer .story-mask")).toMatch(/z-index:-1/);
  });
  it("the figures and the box keep the layer's order (no z-index of their own to fall under the mask)", () => {
    for (const s of [".dlg-layer .scene-stand", ".dlg-layer .scene-stand-anim", ".dlg-layer .dlg"]) expect(rule(s)).not.toMatch(/z-index:-/);
  });
});
