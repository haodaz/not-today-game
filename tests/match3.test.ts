// match-3 (author 2026-11-13): day 5's 「分身」 — no match at the start, runs of three, the swap, the
// fall and the refill, the goal approving the form, out of moves lost; the stage after the filled form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { match3Start, match3Tap, matches, settle, type Match3Grid } from "@world/desktop/workbench/match3";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "match3" as const, cols: 8, rows: 8, kinds: 5, goal: 45, moves: 20 };

describe("match-3", () => {
  it("day 5's board is a match-3", () => {
    expect(taskByFlag(5, "task_d5_1")!.board!.game).toEqual(GAME);
  });

  it("starts with no match; a run of three clears, the rest fall, new ones come; moves count; the goal wins", () => {
    for (let seed = 0; seed < 8; seed++) expect(matches(match3Start("t", GAME, dice(`s${seed}`))).size).toBe(0);
    // a hand-made board: swapping (1,0) and (2,0) makes a row of three at the top-left
    const base = match3Start("t", GAME, dice("s1"));
    const cells = [...base.cells];
    cells[0] = 0; cells[1] = 1; cells[2] = 0; cells[3] = 2; cells[9] = 0; // row 0: 0 1 0 2 …, under (1,0) a 0 at (1,1)
    const g: Match3Grid = { ...base, cells };
    const swapped = match3Tap({ ...g, pick: 1 }, 9, dice("r"));
    expect(swapped.moves).toBe(GAME.moves - 1);
    expect(swapped.cleared).toBeGreaterThanOrEqual(3);
    expect(matches(swapped).size).toBe(0);
    expect(swapped.cells).toHaveLength(64);
    // a swap that matches nothing swaps back and costs nothing (find one such pair on this board)
    let pair: [number, number] | null = null;
    for (let i = 8; i < 63 && !pair; i++) {
      const j = i + 1;
      if (j % 8 === 0) continue;
      const c = [...g.cells]; [c[i], c[j]] = [c[j]!, c[i]!];
      if (matches({ cols: 8, rows: 8, cells: c }).size === 0) pair = [i, j];
    }
    expect(pair).not.toBeNull();
    const noMatch = match3Tap({ ...g, pick: pair![0] }, pair![1], dice("r"));
    expect(noMatch.cells).toEqual(g.cells);
    expect(noMatch.moves).toBe(GAME.moves);
    expect(noMatch.pick).toBeNull();
    // not adjacent: the pick moves
    expect(match3Tap({ ...g, pick: 0 }, 20, dice("r")).pick).toBe(20);
    // the goal: cleared enough wins; out of moves without it loses
    const near = settle({ ...g, cleared: GAME.goal - 3, moves: 1, cells: (() => { const c = [...g.cells]; c[0] = 4; c[1] = 4; c[2] = 4; return c; })() }, dice("r"));
    expect(near.won).toBe(true);
    const spent = settle({ ...g, cleared: 0, moves: 0, cells: (() => { const c = [...g.cells]; c[0] = 4; c[1] = 4; c[2] = 4; return c; })() }, dice("r"));
    expect(spent.over).toBe(true);
  });

  it("after the filled form the stage shows the board; cleared enough approves the form and the sheet opens; out of moves offers Kuro", () => {
    setLocale("zh");
    const store = createStore({ startDay: 5 });
    completeUntil(store, "task1");
    const task = taskByFlag(5, "task_d5_1")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `5:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 5, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="match3"');
    act("match3-start");
    expect(session.match3?.key).toBe(task.id);
    expect(out()).toContain('data-action="match3-tap" data-i="0"');
    // out of moves: Kuro's offer; he clears it
    session.match3 = { ...session.match3!, moves: 0, over: true };
    expect(out()).toContain(`data-action="match3-assist">${t("settle.kuro")}</button>`);
    act("match3-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 5, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("match3.stage.won"));
    now = 4000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
