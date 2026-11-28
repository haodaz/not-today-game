// author 2026-11-24 (#61 #63: 「发完没有进入对话」「同样的问题 18 天都要一起改」), still open on the 2026-11-27
// walk: a hand-in reaches the recipient's thread through the `taskHome` ending of the item's closing lines,
// and board tasks without closing lines (day 3's engine, days 4–9) had nothing to carry them there. They
// now say one plain line (strings `task.sent`) with that ending.
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { deliverableTarget, taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { t } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";

function handIn(day: number, flag: string) {
  const store = createStore({ startDay: day });
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
  syncLoop(ctx, 1000);
  session.dialogue = { ...session.dialogue, queue: [] };
  const d = taskByFlag(day, flag)!.deliverable!;
  store.appendEvent({ kind: "task", flag, mode: "self" } as never);
  syncLoop(ctx, 2000);
  store.appendEvent({ kind: "give", deliverableId: d.id, t: "15:00" } as never);
  syncLoop(ctx, 3000);
  return { queue: session.dialogue.queue, to: d.to };
}

describe("a hand-in lands in its recipient's thread on every day", () => {
  it("a board task without closing lines: one line, then taskHome to whoever it went to", () => {
    for (const [day, flag] of [[3, "task_d3_1"], [4, "task_d4_1"], [5, "task_d5_1"], [6, "task_d6_1"], [7, "task_d7_4"], [8, "task_d8_1"]] as const) {
      const { queue, to } = handIn(day, flag);
      const sent = queue.filter((q) => q.ending.kind === "taskHome");
      expect(sent.length, `day ${day}`).toBe(1);
      expect(sent[0]!.lines.map((l) => l.t)).toEqual([t("task.sent")]);
      expect(sent[0]!.ending).toMatchObject({ kind: "taskHome", to });
    }
  });
  it("every item that hands work to a person has a way there: its own closing lines, or this line", () => {
    for (const [day, file] of dayFiles) {
      for (const it of file.items) {
        if (it.done.kind !== "flag") continue;
        const to = taskByFlag(day, it.done.flag)?.deliverable?.to;
        if (deliverableTarget(to)?.receives !== true) continue;
        // an item with its own closing lines goes by them (day 1's 「今天的活交了。」, the call's night task: seen
        // landing in the walk); one without gets the plain line here
        if (it.onDone) continue;
        const { queue } = handIn(day, it.done.flag);
        expect(queue.filter((q) => q.ending.kind === "taskHome").length, `day ${day} ${it.id}`).toBe(1);
      }
    }
  });
});
