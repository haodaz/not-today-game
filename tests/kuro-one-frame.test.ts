// @vitest-environment happy-dom
// One body, never two (ledger #164, author 2026-11-27: a carried Kuro showed its sitting frame over
// its leaning one). The two frames of a pose take turns; the crawl is cut in and out, not faded.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { KuroBodyElement } from "@world/desktop/kuro/body";

const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
const motion = readFileSync(resolve(__dirname, "../src/world/motion/motion.css"), "utf8");

/** The opacity a steps(1,end) keyframe list gives in each half of its cycle. */
function halves(name: string): [number, number] {
  const body = new RegExp(`@keyframes ${name}\\{([^@]+?\\})\\}`).exec(css)?.[1] ?? "";
  const at = (pct: number) => {
    let v = NaN;
    for (const m of body.matchAll(/([\d%,]+)\{opacity:([\d.]+)\}/g)) {
      const stops = m[1]!.split(",").map((x) => Number(x.replace("%", "")));
      if (Math.min(...stops) <= pct) v = Number(m[2]);
    }
    return v;
  };
  return [at(0), at(50)];
}

describe("Kuro's two frames take turns", () => {
  it.each([["kuro-frames", "kuro-frames-a"], ["kuro-talk", "kuro-talk-a"], ["kuro-step", "kuro-step-a"]])("%s and %s are never both on", (second, first) => {
    const [b0, b1] = halves(second);
    const [a0, a1] = halves(first);
    expect([a0 + b0, a1 + b1]).toEqual([1, 1]);
  });

  it("the first frame runs on the same clock as the second, in every pose", () => {
    expect(css).toContain(".kpet .layer img.f2{animation:kuro-frames 2.8s steps(1,end) infinite alternate}");
    expect(css).toContain(".kpet .layer:not(.cut) img.f1{animation:kuro-frames-a 2.8s steps(1,end) infinite alternate}");
    expect(css).toContain('.kpet .layer[data-state="talk"] img.f1{animation:kuro-talk-a 440ms steps(1,end) infinite}');
    expect(css).toContain('.kpet.kuro-closer[data-phase="crawl"] .layer img.f1{animation:kuro-step-a 333ms steps(1,end) infinite}');
  });

  it("with less motion asked for, only the first frame shows", () => {
    expect(motion).toContain(".kpet .layer img.f2{display:none}");
  });
});

describe("the crawl is cut, not faded", () => {
  it("going into the crawl and out of it leaves one layer at once, even inside the hold", () => {
    vi.stubGlobal("requestAnimationFrame", (f: FrameRequestCallback) => { f(0); return 0; });
    const body = new KuroBodyElement(document);
    body.set("idle");
    body.set("crawl");
    expect([...body.element.children].map((c) => (c as HTMLElement).dataset.state)).toEqual(["crawl"]);
    body.set("happy");
    expect([...body.element.children].map((c) => (c as HTMLElement).dataset.state)).toEqual(["happy"]);
    vi.unstubAllGlobals();
  });
});
