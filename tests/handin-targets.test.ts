// handin-targets (author 2026-11-28, #182–#185): days 7–9 hand their work to the fusion group
// (`merge` → g_merge), day 18 to Kuro (`kuro`, no conversation). One map, DELIVERABLE_TARGETS, says
// what each target is; the transcript, the header chip, the `task.sent` line and the landing read it.
import "./specimen";
import { describe, expect, it } from "vitest";
import day07 from "@content/tasks/day-07.json";
import { DELIVERABLE_TARGETS, DELIVERABLE_TO, checkHandinTargets, parseTaskFile, taskByFlag, taskFiles } from "@state/days/tasks";
import { dayTable } from "@state/replies/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { sentFiles } from "@world/desktop/messages/transcript";
import { initialSession } from "@world/desktop/model";
import { finishLabel } from "@world/desktop/workbench/board";
import { forWhom } from "@world/desktop/workbench/shell";
import { hasString, setLocale, t } from "@world/i18n";
import { syncLoop } from "@world/loop/runtime";

const recipients = (day: number) => new Set(dayTable(day)?.recipients.keys() ?? []);

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
  return { store, queue: session.dialogue.queue };
}

describe("handin-targets: the targets", () => {
  it("every target has one entry in the map; merge is g_merge, kuro has no thread", () => {
    expect([...DELIVERABLE_TO].sort()).toEqual(Object.keys(DELIVERABLE_TARGETS).sort());
    expect(DELIVERABLE_TARGETS.merge).toEqual({ conversation: "g_merge", name: "msgs.g_merge", receives: true });
    expect(DELIVERABLE_TARGETS.kuro).toEqual({ conversation: null, name: "kuro.name", receives: false });
  });
  it("the loader takes merge and kuro; days 7–9 go to the fusion group, day 18 to Kuro", () => {
    expect(taskByFlag(7, "task_d7_4")!.deliverable!.to).toBe("merge");
    expect(taskByFlag(8, "task_d8_1")!.deliverable!.to).toBe("merge");
    expect(taskByFlag(9, "task_d9_3")!.deliverable!.to).toBe("merge");
    expect(taskByFlag(18, "task_d18_work")!.deliverable!.to).toBe("kuro");
  });
  it("merge only on a day whose reply table has g_merge (the real content; a made-up day 10)", () => {
    for (const [day, tasks] of taskFiles) expect(() => checkHandinTargets(day, tasks, recipients(day)), `day ${day}`).not.toThrow();
    const tasks = parseTaskFile(structuredClone(day07 as any), "day-07.json").tasks;
    expect(() => checkHandinTargets(10, tasks, recipients(10))).toThrow(/g_merge/);
    expect(() => checkHandinTargets(7, tasks, new Set(["boss", "group"]))).toThrow(/g_merge/);
  });
  it("the four strings, and no new target falls back to boss's", () => {
    for (const lang of ["zh", "en"] as const) {
      setLocale(lang);
      for (const k of ["board.send.merge", "board.sent.merge", "board.send.kuro", "board.sent.kuro"]) expect(hasString(k), `${lang} ${k}`).toBe(true);
    }
    setLocale("zh");
    expect(t("board.send.merge")).toBe("发到融合工作群");
    expect(t("board.sent.kuro")).toBe("已交给克总");
    expect(finishLabel(taskByFlag(7, "task_d7_4")!)!.value).toBe("发到融合工作群");
    expect(finishLabel(taskByFlag(18, "task_d18_work")!)!.value).toBe("交给克总");
  });
});

describe("handin-targets: where the work lands", () => {
  it("day 7: the sent file is in g_merge's thread, not the company group's; the task.sent line is said, landing in g_merge", () => {
    const { store, queue } = handIn(7, "task_d7_4");
    const files = sentFiles(store.getEvents());
    expect(files.filter((f) => f.conversation === "g_merge").map((f) => f.t)).toEqual(["15:00"]);
    expect(files.some((f) => f.conversation === "group")).toBe(false);
    const sent = queue.filter((q) => q.ending.kind === "taskHome");
    expect(sent.map((q) => q.lines.map((l) => l.t))).toEqual([[t("task.sent")]]);
    expect(sent[0]!.ending).toMatchObject({ kind: "taskHome", to: "merge" });
  });
  it("day 18: handed to Kuro, no file card anywhere and no task.sent line", () => {
    const { store, queue } = handIn(18, "task_d18_work");
    expect(sentFiles(store.getEvents())).toEqual([]);
    expect(queue.some((q) => q.lines.some((l) => l.t === t("task.sent")))).toBe(false);
  });
  it("the header chip names the fusion group and Kuro", () => {
    setLocale("zh");
    expect(forWhom(taskByFlag(7, "task_d7_4")!)!.value).toBe(t("wb.task.for", { who: t("msgs.g_merge") }));
    expect(forWhom(taskByFlag(18, "task_d18_work")!)!.value).toBe(t("wb.task.for", { who: t("kuro.name") }));
    setLocale("en");
    expect(forWhom(taskByFlag(18, "task_d18_work")!)!.value).toBe("For Kuro");
    setLocale("zh");
  });
});
