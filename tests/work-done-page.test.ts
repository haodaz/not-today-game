// author 2026-11-27: 「如果当天完成工作，进入工作台也是可以落在完成之后的任务拟真 UI，并且提交工作按钮显示提交了」.
// With the day's work handed in, 工作台 opens on that work's own page (not on a home page that says there is
// nothing to do), and the hand-in button says it has been sent.
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { finishLabel, setSentFlags } from "@world/desktop/workbench/board";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { push } from "@world/loop/dialogue";
import { t } from "@world/i18n";
import { landOnOpenTask, loopActions } from "@world/room/game";

const ctxOf = (store: ReturnType<typeof createStore>): ActionContext => {
  const session = initialSession(DEFAULT_CLOCK, "left", "desktop");
  session.leftApp = "workbench" as never;
  return { store, session, rerender: () => {}, later: (_ms: number, fn: () => void) => fn() } as unknown as ActionContext;
};

describe("the hand-in button after the hand-in", () => {
  it("says where the work went, for each recipient", () => {
    for (const [day, flag, key] of [[4, "task_d4_1", "board.sent.boss"], [5, "task_d5_1", "board.sent.partner"], [6, "task_d6_1", "board.sent.group"]] as const) {
      const task = taskByFlag(day, flag)!;
      setSentFlags([]);
      expect(finishLabel(task)!.value).not.toBe(t(key));
      setSentFlags([flag]);
      expect(finishLabel(task)!.value).toBe(t(key));
    }
    setSentFlags([]);
  });
});

describe("the handed-in task's page", () => {
  it("shows the hand-in button, disabled, saying where the work went", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "task", flag: "task_d4_1", mode: "self" } as never);
    const ctx = ctxOf(store);
    ctx.session.workbenchPage = "task:task1" as never;
    const out = renderWorkbench({ state: store.getState(), events: store.getEvents(), session: ctx.session } as never).body.value;
    expect(out).toContain(`class="sh-chip primary sent" disabled>${t("board.sent.boss")}</button>`);
    expect(out).not.toContain(`>${t("board.send.boss")}</button>`);
  });
});

describe("工作台 after the day's work is handed in", () => {
  it("opening it on home lands on the handed-in task's page", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "task", flag: "task_d4_1", mode: "self" } as never);
    const ctx = ctxOf(store);
    ctx.session.workbenchPage = "home" as never;
    landOnOpenTask(ctx);
    expect(ctx.session.workbenchPage).toBe("task:task1");
  });
  it("the closing line of the day's last hand-in leaves the task page where it is (and still lands in the thread)", () => {
    const store = createStore({ startDay: 4 });
    store.appendEvent({ kind: "task", flag: "task_d4_1", mode: "self" } as never);
    const ctx = ctxOf(store);
    ctx.session.workbenchPage = "task:task1" as never;
    ctx.session.dialogue = push(ctx.session.dialogue, { key: "x", lines: [{ k: "narration", t: t("task.sent") }], ending: { kind: "taskHome", to: "boss" } } as never);
    loopActions["loop-advance"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.workbenchPage).toBe("task:task1");
    expect(ctx.session.conversation).toBe("boss");
  });
});
