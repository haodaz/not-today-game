// tune stage (2026-11-12): the research-node screen, its settlement report, and Vivi's skin on day 3.
import "./specimen";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { taskByFlag } from "@state/days/tasks";
import { initialSession } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { tuneStage } from "../src/world/desktop/workbench/tune-stage";

const day3 = () => taskByFlag(3, "task_d3_1")!;

describe("tune stage", () => {
  it("day 3 opens on the first node with its paths as action cards and the four target bars; no Kuro card", () => {
    setLocale("zh");
    const store = createStore({ startDay: 3, patch: { flags: ["task_receivable_done", "task_merge_done", "task_d2_1", "task_d2_2"] } as never });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const out = tuneStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, day3(), day3().board!).value;
    expect(out).toContain('class="ts-goal"');
    expect(out).toContain("节点 1 / 10");
    expect(out).toContain('data-action="tune-select"');
    expect(out).toContain('data-action="tune-act"');
    expect(out).not.toContain("克总帮我处理一下");
    expect(out).toContain('class="ts-report"');
  });
  it("the budget spent: the report page first (她页面上写的 vs 后台里), 提交 after; with the skin path taken it wears Vivi's look", () => {
    setLocale("zh");
    const store = createStore({ startDay: 3, patch: { flags: ["task_receivable_done", "task_merge_done", "task_d2_1", "task_d2_2"] } as never });
    const task = day3();
    const tune = task.board!.tune!;
    // the first path of the first 8 open modules, then the end-of-work offer taken
    const mods = tune.mods.filter((m) => !m.from && m.paths.some((p) => !p.after && !p.from)).slice(0, tune.steps);
    for (const m of mods) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "mod", id: m.id, path: m.paths.find((p) => !p.after && !p.from)!.id } });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    let out = tuneStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, task, task.board!).value;
    // the settlement: left the bars, right the backend page as it really is (author 2026-11-12)
    // the settlement stays on the lab (author 2026-11-13): the panel left, the real backend page in the middle
    expect(out).toContain('class="ts settle"');
    expect(out).toContain('class="ts-goal"');
    expect(out).toContain('class="ts-page"');
    expect(out).toMatch(/<iframe class="ide-frame sl-frame" data-keep="ide-settle" src="\/docs\/player\/day-03-train\.html\?[^"]*mods=/);
    expect(out).toContain('data-action="board-print"');
    expect(out).not.toContain('data-action="tune-select"');
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "mod", id: "front", path: "skin" } });
    out = tuneStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, task, task.board!).value;
    // her skin taken: the page itself wears it (front:skin in the address; the page does the rest)
    expect(out).toMatch(/<iframe class="ide-frame sl-frame" data-keep="ide-settle" src="[^"]*front(%3A|:)skin/);
  });
});
