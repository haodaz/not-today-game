// playtest-1105 R10.1 (Claude, 2026-11-05): the phone went white because the home-indicator rule
// (`.held.phone .home`) also matched the delivery app's home page (`.dapp.home`) and squashed it
// into a 5 px bar. The bar's rule must reach only the screen's own direct child.
import { describe, expect, it } from "vitest";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/world/room/room.css", import.meta.url), "utf8");

describe("the phone's home bar", () => {
  it("is styled only as the screen's direct child, never any .home inside the app", () => {
    expect(css).toMatch(/\.held\.phone \.scr>\.home\{position:absolute/);
    expect(css).not.toMatch(/\.held\.phone \.home\{/);
  });
});
