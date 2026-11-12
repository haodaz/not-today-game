// minesweeper (author 2026-11-13): day 8's month — seeded placement, the first click safe, the flood,
// the flag, the loss, the win approving the form; the stage after the filled form; the sheet needs it.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { minesCount, minesFlag, minesOpen, minesStage, minesStart, type MinesGrid } from "@world/desktop/workbench/mines";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const roll = (seed: number) => { let a = seed; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x80000000; }; };

describe("minesweeper", () => {
  it("day 8's board plays the month: 7×5, seven mines", () => {
    const task = taskByFlag(8, "task_d8_1")!;
    expect(task.board!.game).toEqual({ kind: "mines", cols: 7, rows: 5, mines: 7 });
  });

  it("the first click is safe and floods; a flag holds; a mine loses; every safe day wins", () => {
    const game = { kind: "mines" as const, cols: 7, rows: 5, mines: 7 };
    let g: MinesGrid = minesStart("task1", game);
    expect(g.mines).toBeNull();
    g = minesOpen(g, 0, roll(7));
    expect(g.mines).not.toBeNull();
    expect(g.mines!.filter(Boolean)).toHaveLength(7);
    expect(g.mines![0]).toBe(false); expect(g.mines![1]).toBe(false); expect(g.mines![7]).toBe(false); expect(g.mines![8]).toBe(false);
    expect(g.open[0]).toBe(true);
    expect(g.over).toBe(false);
    // the corner has no mines around it, so it floods its neighbours at least
    expect(minesCount(g, 0)).toBe(0);
    expect(g.open[1] && g.open[7] && g.open[8]).toBe(true);
    // a flag holds a cell closed; opening it does nothing; the flag comes off again
    const closed = g.open.findIndex((o) => !o);
    const flagged = minesFlag(g, closed);
    expect(flagged.flags[closed]).toBe(true);
    expect(minesOpen(flagged, closed, roll(1))).toBe(flagged);
    expect(minesFlag(flagged, closed).flags[closed]).toBe(false);
    // a mine loses the month and shows every mine
    const mine = g.mines!.findIndex(Boolean);
    const lost = minesOpen(g, mine, roll(1));
    expect(lost.over).toBe(true);
    expect(g.mines!.every((m, i) => !m || lost.open[i])).toBe(true);
    // every safe day opened wins
    let w = g;
    for (let i = 0; i < 35; i++) if (!g.mines![i]) w = minesOpen(w, i, roll(1));
    expect(w.won).toBe(true);
    expect(w.opened).toBe(35 - 7);
  });

  it("after the filled form the stage shows the month; the schedule done approves the form and the sheet opens", () => {
    setLocale("zh");
    const store = createStore({ startDay: 8, patch: { found: ["calculator"] } });
    completeUntil(store, "task1");
    const task = taskByFlag(8, "task_d8_1")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `8:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    // the form filled, not yet approved: the month, not the sheet
    expect(canPrint(board, boardState(board, 8, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="mines"');
    expect(out()).toContain(`data-action="mines-start">${t("mines.stage.start")}</button>`);
    act("mines-start");
    expect(session.mines?.key).toBe(task.id);
    expect(out()).toContain('data-action="mines-open" data-i="0"');
    // mark mode, then back
    act("mines-mode"); expect(session.mines!.flagMode).toBe(true);
    act("mines-open", { i: "3" }); expect(session.mines!.flags[3]).toBe(true);
    act("mines-mode"); expect(session.mines!.flagMode).toBe(false);
    act("mines-open", { i: "3" }); expect(session.mines!.open[3]).toBe(false); // flagged stays closed
    // open the rest of the safe days by hand through the action
    act("mines-open", { i: "0" });
    const mines = session.mines!.mines!;
    for (let i = 0; i < 35; i++) if (!mines[i] && !session.mines!.open[i] && !session.mines!.flags[i]) act("mines-open", { i: String(i) });
    if (!session.mines!.won) { act("mines-mode"); act("mines-open", { i: "3" }); act("mines-mode"); act("mines-open", { i: "3" }); }
    expect(session.mines!.won).toBe(true);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 8, task.id, store.getEvents()))).toBe(true);
    // the done state holds a beat, then the board (the sheet's 整理好了) returns
    expect(out()).toContain(t("mines.stage.won"));
    now = 3000;
    expect(out()).not.toContain('data-screen="mines"');
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
    // the stage renders the notes from the form
    const stage = minesStage(task, board, boardState(board, 8, task.id, store.getEvents()), session, true, 1000).value;
    expect(stage).toContain('class="mn-note"');
  });
});
