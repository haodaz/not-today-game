// #166 (author 2026-11-27: 「17 天那个华容道的设计非常简单」): the toy keeps its look, wood and carved
// pieces, with day 17 in it. Drawn only: the layout, the pushes and the grade are as they were.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { KLOTSKI_ROT_MOVES, klotskiPath, klotskiRot, klotskiStage, klotskiStart } from "@world/desktop/workbench/klotski";
import { setLocale } from "@world/i18n";

setLocale("zh");
const task = () => taskByFlag(17, "task_d17_work")!;
const game = () => task().board!.game as Extract<NonNullable<ReturnType<typeof task>["board"]>["game"], { kind: "klotski" }>;
const stage = (g: ReturnType<typeof klotskiStart> | null) => klotskiStage(task(), task().board!, { slots: {} } as never, { klotski: g }, false, 0).value;

describe("day 17's klotski, as it is drawn", () => {
  it("every caller is a seal with its name and a ringing line; the big one an eye; the tall ones figures; the small ones a pupil", () => {
    const out = stage(klotskiStart(task().id, game()));
    for (const b of Object.values(game().blocks)) expect(out).toContain(`<span class="kl-seal"><span class="kl-name">${b.label}</span></span><i class="kl-ring" aria-hidden="true"></i>`);
    expect((out.match(/class="kl-block named/g) ?? []).length).toBe(4);
    expect((out.match(/class="kl-block big[^>]*>[^<]*<i class="kl-eye"/g) ?? []).length).toBe(1);
    expect((out.match(/class="kl-block tall[^>]*><i class="kl-fig"/g) ?? []).length).toBe(2);
    expect((out.match(/class="kl-block small[^>]*><i class="kl-pupil"/g) ?? []).length).toBe(2);
  });

  it("the thing at the door comes on with the pushes, and is drawn only", () => {
    expect([0, 10, KLOTSKI_ROT_MOVES, 400].map(klotskiRot)).toEqual([0, 0.25, 1, 1]);
    const g = klotskiStart(task().id, game());
    expect(stage(g)).toContain("--rot:0.00");
    expect(stage({ ...g, moves: 20 })).toContain("--rot:0.50");
    expect(stage({ ...g, moves: 20 })).toContain('<i class="kl-peek" aria-hidden="true"></i>');
    expect(stage(null)).toContain("--rot:0.00");
  });

  it("the puzzle is as it was: the one who paid is 19 pushes from the door, the two nearest 8, the nameless one never", () => {
    const idOf = (label: string) => Object.entries(game().blocks).find(([, b]) => b.label === label)![0];
    expect(klotskiPath(game(), idOf("青禾"))!.length).toBe(19);
    expect(klotskiPath(game(), idOf("老王"))!.length).toBe(8);
    expect(klotskiPath(game(), idOf("Vivi"))!.length).toBe(8);
  });
});
