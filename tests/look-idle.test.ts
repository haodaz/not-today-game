// The look on the title card moves a little, once in a while (ledger #163, author 2026-11-27):
// five people, five different small movements, each still for most of its cycle.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PORTRAIT_FILES } from "@world/dialogue/box";

const css = readFileSync(resolve(__dirname, "../src/ui/title/title.css"), "utf8");
const rule = (p: string) => new RegExp(`\\.title-pick \\.big\\[data-portrait="${p}"\\] img\\{animation:(look-[a-z]+) ([\\d.]+)s ease-in-out infinite\\}`).exec(css);

describe("the look's idle movement", () => {
  it("every look has its own movement, and no two share one", () => {
    const names = Object.keys(PORTRAIT_FILES).map((p) => rule(p)?.[1]);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(css).toContain(`@keyframes ${n}{`);
  });

  it("each one is slow, and still for more than half of its cycle", () => {
    for (const p of Object.keys(PORTRAIT_FILES)) {
      const [, name, secs] = rule(p)!;
      expect(Number(secs)).toBeGreaterThanOrEqual(6);
      // the first keyframe group is the rest pose; it holds from 0 % to its second stop
      const first = new RegExp(`@keyframes ${name}\\{0%,(\\d+)%`).exec(css);
      expect(Number(first?.[1])).toBeGreaterThanOrEqual(40);
    }
  });

  it("stands still for people who ask for less motion", () => {
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion:reduce){"));
    expect(block).toContain(".title-pick .big img{animation:none!important}");
  });
});
