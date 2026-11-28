// #166 (author 2026-11-27): the toy keeps its look, wood and carved pieces (ce1eda2's tray), and
// klotski-door R4 draws each block by its role: the nameless eye, the gate's keyhole, a god's figure
// with its own mark, a person's face, and you, the only light one.
import "./specimen";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { taskByFlag } from "@state/days/tasks";
import { KLOTSKI_ROT_MOVES, klotskiRot, klotskiStage, klotskiStart } from "@world/desktop/workbench/klotski";
import { setLocale } from "@world/i18n";

setLocale("zh");
const task = () => taskByFlag(17, "task_d17_work")!;
const game = () => task().board!.game as Extract<NonNullable<ReturnType<typeof task>["board"]>["game"], { kind: "klotski" }>;
const stage = (g: ReturnType<typeof klotskiStart> | null) => klotskiStage(task(), task().board!, { slots: {} } as never, { klotski: g }, false, 0).value;

describe("day 17's klotski, as it is drawn", () => {
  it("each block by its role: the eye, the keyhole, four gods with four marks, three faces, you", () => {
    const out = stage(klotskiStart(task().id, game()));
    expect((out.match(/class="kl-block big[^>]*>[^<]*<i class="kl-eye"/g) ?? []).length).toBe(1);
    expect(out).toMatch(/class="kl-block gate[^>]*><i class="kl-arch" aria-hidden="true"><\/i><i class="kl-key" aria-hidden="true"><\/i><span class="kl-label">看门的<\/span>/);
    for (const m of ["H", "F", "P", "S"]) expect(out).toMatch(new RegExp(`data-block="${m}"[^>]*><i class="kl-fig" aria-hidden="true"></i><i class="kl-mark m-${m}"><svg`));
    for (const [id, b] of Object.entries(game().blocks).filter(([, b]) => b.role === "person")) expect(out).toMatch(new RegExp(`data-block="${id}"[^>]*><img class="kl-face" src="${b.face}" alt=""><span class="kl-label">${b.label}</span>`));
    expect(out).toMatch(/class="kl-block you[^>]*><span class="kl-label">你<\/span><i class="kl-you-ring"/);
    expect(out).not.toMatch(/kl-block (named|small)/);
  });

  it("you wear the look the player chose, in full colour (author 2026-11-27: the only living one)", () => {
    const out = klotskiStage(task(), task().board!, { slots: {} } as never, { klotski: klotskiStart(task().id, game()) }, false, 0, "/player/glare.png").value;
    expect(out).toMatch(/class="kl-block you[^>]*><img class="kl-face kl-me" src="\/player\/glare\.png" alt=""><span class="kl-label">你<\/span><i class="kl-you-ring"/);
    const css = fs.readFileSync(new URL("../src/world/desktop/desktop.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.kl-block\.you \.kl-face\.kl-me\{[^}]*filter:none/);
    expect(css).toMatch(/\.kl-block\.person \.kl-face\{[^}]*grayscale\(1\)/);
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{\.kl-block\.you\{animation:none\}/);
  });

  it("the marks are drawn, single colour, no image files; you never wear the rot", () => {
    const css = fs.readFileSync("src/world/desktop/desktop.css", "utf8");
    expect(css).toMatch(/\.kl-mark\{[^}]*color:#9c2318/);
    expect(css).toMatch(/\.kl-block\.you\{[^}]*filter:none/);
    const out = stage(klotskiStart(task().id, game()));
    expect(out).not.toMatch(/kl-mark[^>]*><img/);
  });

  it("the thing at the door comes on with the pushes, and is drawn only (ce1eda2)", () => {
    expect([0, 10, KLOTSKI_ROT_MOVES, 400].map(klotskiRot)).toEqual([0, 0.25, 1, 1]);
    const g = klotskiStart(task().id, game());
    expect(stage(g)).toContain("--rot:0.00");
    expect(stage({ ...g, moves: 20 })).toContain("--rot:0.50");
    expect(stage({ ...g, moves: 20 })).toContain('<i class="kl-peek" aria-hidden="true"></i>');
    expect(stage(null)).toContain("--rot:0.00");
    expect(stage(null)).toContain('<i class="kl-veins" aria-hidden="true"></i>');
  });
});
