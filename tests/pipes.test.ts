// pipes (author 2026-11-13): day 14's onboarding process — a seeded, scrambled, solvable board;
// openings and flow; a turn; connected approves the form; the stage after the filled form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { connected, flow, openings, pieceFor, pipesSolve, pipesStart, pipesTurn } from "@world/desktop/workbench/pipes";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("pipes", () => {
  it("day 14's board runs the pipes: 8×5", () => {
    expect(taskByFlag(14, "task_d14_work")!.board!.game).toEqual({ kind: "pipes", cols: 8, rows: 5 });
  });

  it("openings rotate; a board starts scrambled and solvable; a turn turns; solved connects", () => {
    expect(openings({ shape: "straight", rot: 0 })).toBe(10);
    expect(openings({ shape: "straight", rot: 1 })).toBe(5);
    expect(openings({ shape: "bend", rot: 0 })).toBe(3);
    expect(openings({ shape: "bend", rot: 1 })).toBe(6);
    expect(pieceFor(10)).toEqual({ shape: "straight", rot: 0 });
    expect(pieceFor(9)).toEqual({ shape: "bend", rot: 3 });
    for (let seed = 0; seed < 12; seed++) {
      const g = pipesStart("work", { kind: "pipes", cols: 8, rows: 5 }, dice(`t:${seed}`));
      expect(g.cells).toHaveLength(40);
      expect(connected(g)).toBe(false);
      const solved = pipesSolve(g);
      expect(connected(solved)).toBe(true);
      expect(flow(solved).size).toBeGreaterThan(7);
    }
    const g = pipesStart("work", { kind: "pipes", cols: 8, rows: 5 }, dice("t:1"));
    const turned = pipesTurn(g, 3);
    expect(turned.cells[3]!.rot).toBe((g.cells[3]!.rot + 1) % 4);
    expect(turned.turns).toBe(1);
    // the same seed, the same board
    expect(pipesStart("work", { kind: "pipes", cols: 8, rows: 5 }, dice("t:1"))).toEqual(g);
  });

  it("after the filled form the stage shows the pipes; connected approves the form and the sheet opens", () => {
    setLocale("zh");
    const store = createStore({ startDay: 14, patch: { found: ["tape"] } });
    completeUntil(store, "work");
    const task = taskByFlag(14, "task_d14_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `14:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 14, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="pipes"');
    act("pipes-start");
    expect(session.pipes?.key).toBe(task.id);
    expect(out()).toContain('data-action="pipes-turn" data-i="0"');
    // turn pieces until the solved rotation of each (the solver says which), then it connects
    const solved = pipesSolve(session.pipes!);
    for (let i = 0; i < solved.cells.length && !session.pipes!.done; i++) {
      while (session.pipes!.cells[i]!.rot !== solved.cells[i]!.rot && !session.pipes!.done) act("pipes-turn", { i: String(i) });
    }
    expect(session.pipes!.done).toBe(true);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 14, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("pipes.stage.won"));
    now = 4000;
    expect(out()).not.toContain('data-screen="pipes"');
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
