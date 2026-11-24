// Playtest 2026-11-24, the later items: #30 前往 on the checklist, #33 the deferred hand-in (今天先不发),
// #31 the empty box, #32 the workbench landing on the open task.
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { checklist, loopContext } from "@world/loop/checklist";
import { loopActions } from "@world/room/game";
import { renderChecklist, renderRoom } from "@world/room/hud";
import { replyTable } from "@state/replies/table";
import { taskForId } from "@state/days/board";
import { t } from "@world/i18n";

const ctxOf = (store: ReturnType<typeof createStore>, view = "room"): ActionContext => {
  const session = initialSession(DEFAULT_CLOCK, "left", view as never);
  // `later` runs at once: a way of several legs (room → desk) completes within the call
  return { store, session, rerender: () => {}, later: (_ms: number, fn: () => void) => fn() } as unknown as ActionContext;
};

describe("#30 前往", () => {
  it("the current line carries 前往; a click lands where that step is done (rise → got up; eat → the table)", () => {
    const store = createStore({ startDay: 1 });
    const out = renderChecklist(checklist(loopContext(store.getState(), store.getEvents())!)).value;
    expect(out).toContain(`data-action="go-item" data-id="rise">${t("checklist.go")}</button>`);
    expect(out.match(/data-action="go-item"/g)).toHaveLength(1);
    const ctx = ctxOf(store);
    ctx.session.view = "lying";
    loopActions["go-item"]!(ctx, { id: "rise" } as DOMStringMap, null as never);
    expect(ctx.session.dialogue.queue.some((q) => q.ending.kind === "riseAsk")).toBe(true); // 起床 asks first (day1-playtest R1)
    ctx.session.dialogue = { queue: [], line: 0, page: 0 };
    ctx.session.view = "room";
    // boot: 房间, where the tower's 开机 is pointed at
    ctx.session.view = "lying";
    loopActions["go-item"]!(ctx, { id: "boot" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
    expect(renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value).toContain('data-hot="tower"');
  });
});

describe("#33 今天先不发", () => {
  it("day 2's first task is deferrable; day 3's are not (the work must reach Vivi)", () => {
    expect(taskForId(2, "task1")?.defer).toBe(true);
    expect(taskForId(3, "task1")?.defer).toBeUndefined();
    expect(taskForId(3, "task3")?.defer).toBeUndefined();
  });
  it("小张 thanks the player only when the work is done but not sent (cond_show has + lacks)", () => {
    const inc = replyTable.get(2)!.recipients.get("xiaozhang")!.incoming;
    const thanks = inc.find((m) => m.cond_show?.lacks !== undefined)!;
    expect(thanks.cond_show).toEqual({ has: "task_d2_1", lacks: "sent_d2-vivi-page" });
  });
});

describe("#37 #39 #40 #41 (the later notes)", () => {
  it("#37 with the ceiling light on in the evening, the window glass keeps the night; day 1's first evening says the lamp can be lit", async () => {
    const { eveningLook, WINDOW_GLASS } = await import("@world/room/hud");
    expect(eveningLook("window", true, false, true)!.value).toContain('class="evening-window"');
    expect(eveningLook("room", true, false, true)!.value).toContain('class="evening-window"');
    expect(eveningLook("window", true, false, false)!.value).not.toContain("evening-window");
    expect(WINDOW_GLASS.window).toBeDefined();
    expect(t("hint.lamp")).toContain("台灯");
  });
  it("#39 workAllDone: false before the work, true once every task item of the day is done", async () => {
    const { workAllDone } = await import("@world/dialogue/kuro");
    const { completeUntil } = await import("./complete-items");
    const store = createStore({ startDay: 1, patch: { fullness: 100 } as never });
    expect(workAllDone(store.getState(), store.getEvents())).toBe(false);
    completeUntil(store, "dinner");
    expect(workAllDone(store.getState(), store.getEvents())).toBe(true);
  });
  it("#40 / #41: on the player's turn the box is not reflowed (no has-choices) and there is no red hint", async () => {
    const { dialogueBox } = await import("@world/dialogue/box");
    const { EMPTY_DIALOGUE, push } = await import("@world/loop/dialogue");
    const store = createStore({ startDay: 3 });
    const session = initialSession({ beat: "night", time: "23:30" }, "left", "room");
    session.dialogue = { ...push(EMPTY_DIALOGUE, { key: "k", lines: [{ k: "speaker", who: "kuro", t: "嗯。" }], ending: { kind: "kuroTurn", mode: "chat" } }), page: 1 };
    const out = dialogueBox({ ...store.getState(), chatTurnsToday: 5 }, [], session)!.value;
    expect(out).toContain('class="dlg-choices');
    expect(out).not.toContain("has-choices");
    expect(out).not.toContain("dc-hint");
  });
});
