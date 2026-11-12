// work-stages-polish 1: the clue / meeting stage ends on a settlement sheet. 整理好了 (board-settle) is
// enabled only once every slot is filled; it shows the sheet with each placed card and 再改改 / 提交;
// 再改改 (board-settle-back) returns to the board. Day 4's 「意识」 board (a pager lock, four slots).
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions, cardText } from "@world/desktop/workbench/board";
import { clueStage } from "@world/desktop/workbench/clue-stage";
import { openWork } from "@world/desktop/workbench/work";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("the settlement sheet (clue stage)", () => {
  it("整理好了 waits for every slot; the sheet lists each placed card with 再改改 and 提交; 再改改 goes back", () => {
    setLocale("zh");
    const store = createStore({ startDay: 4 });
    completeUntil(store, "task1");
    const task = taskByFlag(4, "task_d4_1")!;
    const board = task.board!;
    expect(openWork(store.getState(), store.getEvents())?.tree?.id).toBe(task.id);
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (name: string) => boardActions[name]!(ctx, {} as DOMStringMap, null as never);
    const out = () => clueStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, task, board).value;

    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    const [last, ...rest] = [...board.slots].reverse();
    for (const slot of rest) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });

    // Not every slot: 整理好了 is there and disabled; 提交 is not on the board any more.
    expect(out()).toContain(`data-action="board-settle" disabled>${t("sheet.settle.open")}</button>`);
    expect(out()).not.toContain('data-action="board-print"');
    act("board-settle");
    expect(session.workPhase).toBeNull();

    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: last!.id, card: last!.answer } });
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
    act("board-settle");
    expect(session.workPhase).toEqual({ key: `4:${task.id}`, phase: "settle" });

    const sheet = out();
    expect(sheet).toContain('class="st-sheet"');
    expect(sheet).not.toContain('class="cs-notes"');
    expect(sheet).toContain(escapeHtml(board.title));
    expect([...sheet.matchAll(/class="st-row"/g)]).toHaveLength(board.slots.length);
    for (const slot of board.slots) expect(sheet).toContain(`<p class="st-card">${escapeHtml(cardText(board, slot.answer))}</p>`);
    expect(sheet).toContain(`data-action="board-settle-back">${t("sheet.settle.back")}</button>`);
    expect(sheet).toMatch(/<button type="button" class="wl-cta" data-action="board-print">[^<]+<\/button>/);

    act("board-settle-back");
    expect(session.workPhase).toBeNull();
    expect(out()).toContain('class="cs-notes"');
    expect(out()).not.toContain('class="st-sheet"');
  });
});
