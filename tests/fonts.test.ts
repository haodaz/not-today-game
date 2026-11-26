// The bundled Noto Serif SC subset for the game menu (game-menu "Open"; Kiro made the subset and the
// cmap reader, 2026-11-26). The menu, the task card and the title set --gm-serif; it must lead with
// our own "NT Song", and every character those surfaces print must be in the subset (a missing glyph
// would fall back to a system face mid-line).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { woff2Codepoints } from "../script/tools/woff2-cmap.mjs";

const root = resolve(__dirname, "..");
const WEIGHTS = ["Regular", "SemiBold"] as const;
const file = (w: string) => resolve(root, `public/fonts/NotoSerifSC-${w}.woff2`);
const MENU_KEYS = /^(hud|status|settings|items|badge|auth|title|checklist)\./;
// Not in Noto Serif SC at all (the history button's arrow): it falls back by design.
const NOT_IN_FONT = new Set(["↻"]);

function menuText(): string {
  let s = "";
  for (const loc of ["zh", "en"]) {
    const strings = JSON.parse(readFileSync(resolve(root, `content/strings/${loc}.json`), "utf8")) as Record<string, unknown>;
    for (const [k, v] of Object.entries(strings)) if (MENU_KEYS.test(k) && typeof v === "string") s += v;
  }
  for (const dir of ["content/days", "content/days/en"]) {
    for (const f of readdirSync(resolve(root, dir)).filter((n) => n.endsWith(".json"))) {
      const day = JSON.parse(readFileSync(resolve(root, dir, f), "utf8")) as { items?: { text?: string; rewrite?: string }[] };
      for (const it of day.items ?? []) s += (it.text ?? "") + (it.rewrite ?? "");
    }
  }
  return s;
}

describe("NT Song (Noto Serif SC subset)", () => {
  it("both weights exist, each under 600 KB", () => {
    for (const w of WEIGHTS) {
      expect(existsSync(file(w)), w).toBe(true);
      expect(statSync(file(w)).size, w).toBeLessThan(600 * 1024);
    }
  });

  it("fonts.css declares NT Song 400 and 600 and its fallback; --gm-serif leads with it", () => {
    const fonts = readFileSync(resolve(root, "src/ui/fonts.css"), "utf8");
    expect(fonts).toContain('font-family:"NT Song";src:url(/fonts/NotoSerifSC-Regular.woff2) format("woff2");font-weight:400');
    expect(fonts).toContain('font-family:"NT Song";src:url(/fonts/NotoSerifSC-SemiBold.woff2) format("woff2");font-weight:600');
    expect(fonts).toContain('font-family:"NT Song Fallback"');
    const room = readFileSync(resolve(root, "src/world/room/room.css"), "utf8");
    expect(room).toMatch(/--gm-serif:"NT Song","NT Song Fallback",/);
  });

  it("every character of the menu's strings and of every checklist line is in both weights", () => {
    const wanted = [...new Set(menuText())].filter((ch) => ch.codePointAt(0)! >= 0x20 && !NOT_IN_FONT.has(ch));
    for (const w of WEIGHTS) {
      const have = woff2Codepoints(readFileSync(file(w)));
      const missing = wanted.filter((ch) => !have.has(ch.codePointAt(0)!));
      expect(missing.join(""), `${w}: rerun node script/tools/serif-chars.mjs and bash script/tools/subset-serif.sh`).toBe("");
    }
  });
});
