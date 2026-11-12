// snake (author 2026-11-13): day 6's 「本体」 — the Nokia screen after the filled form; the five sentences
// eaten in order grow the body, out of order breaks it, biting yourself ends it; the edges wrap; all
// five approves the form; the clock runs through the session's timers.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { ahead, snakeStart, snakeStep, snakeTier, snakeTurn, type SnakeGrid } from "@world/desktop/workbench/snake";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "snake" as const, cols: 20, rows: 12 };

describe("snake", () => {
  it("day 6's board is a snake", () => {
    expect(taskByFlag(6, "task_d6_1")!.board!.game).toEqual(GAME);
  });

  it("starts mid-screen heading right with the five sentences on free cells; the edges wrap", () => {
    const g = snakeStart("t", GAME, 5, dice("s1"), 1);
    expect(g.body).toEqual([6 * 20 + 10, 6 * 20 + 9, 6 * 20 + 8]);
    expect(g.foods.map((f) => f.n)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(g.foods.map((f) => f.cell)).size).toBe(5);
    for (const f of g.foods) expect(g.body).not.toContain(f.cell);
    expect(g.want).toBe(1);
    expect(ahead(g, 19, "right")).toBe(0);
    expect(ahead(g, 0, "left")).toBe(19);
    expect(ahead(g, 5, "up")).toBe(11 * 20 + 5);
    expect(ahead(g, 11 * 20 + 5, "down")).toBe(5);
  });

  it("steps forward; a turn is taken at the next step and never straight back; eating in order grows, out of order breaks, biting ends", () => {
    const g0 = snakeStart("t", GAME, 5, dice("s1"), 1);
    const g1 = snakeStep(g0);
    expect(g1.body[0]).toBe(g0.body[0]! + 1);
    expect(g1.body).toHaveLength(3);
    expect(g1.steps).toBe(1);
    // straight back is ignored; a real turn is taken next step
    expect(snakeTurn(g1, "left")).toBe(g1);
    const turned = snakeStep(snakeTurn(g1, "up"));
    expect(turned.dir).toBe("up");
    expect(turned.body[0]).toBe(g1.body[0]! - 20);
    // the sentence in order: lay 1 right ahead
    const ahead1: SnakeGrid = { ...g1, foods: g1.foods.map((f) => (f.n === 1 ? { ...f, cell: g1.body[0]! + 1 } : f)) };
    const ate = snakeStep(ahead1);
    expect(ate.want).toBe(2);
    expect(ate.foods[0]!.eaten).toBe(true);
    expect(ate.grow).toBe(2);
    expect(snakeStep(snakeStep(ate)).body.length).toBe(5);
    // out of order: lay 3 ahead of a long body — a stretch of the tail falls off, the sentence stays
    const long: SnakeGrid = { ...g1, body: Array.from({ length: 9 }, (_, i) => g1.body[0]! - i), foods: g1.foods.map((f) => (f.n === 3 ? { ...f, cell: g1.body[0]! + 1 } : f)) };
    const broke = snakeStep(long);
    expect(broke.broke).toBe(1);
    expect(broke.body.length).toBe(6); // a third of nine falls off
    expect(broke.foods[2]!.eaten).toBe(false);
    expect(broke.want).toBe(1);
    // biting yourself: a body curled so the head's next cell is its own
    const h = g1.body[0]!;
    const curled: SnakeGrid = { ...g1, dir: "right", next: "right", body: [h, h - 20, h - 19, h - 18, h + 2, h + 1, h + 21] }; // the tail is h+21, so h+1 is still there
    const bit = snakeStep(curled);
    expect(bit.over).toBe(true);
    expect(bit.running).toBe(false);
    // all five in order: done
    let g: SnakeGrid = { ...g1, foods: g1.foods.map((f, i) => ({ ...f, eaten: i < 4 })), want: 5 };
    g = { ...g, foods: g.foods.map((f) => (f.n === 5 ? { ...f, cell: g.body[0]! + 1 } : f)) };
    const done = snakeStep(g);
    expect(done.done).toBe(true);
    expect(done.running).toBe(false);
    // the body stops looking like a snake as it grows
    expect(snakeTier(3)).toBe(0);
    expect(snakeTier(9)).toBe(1);
    expect(snakeTier(15)).toBe(2);
  });

  it("after the filled form the stage shows the screen; the clock steps it; all eaten approves the form and the sheet opens; bitten offers Kuro", () => {
    setLocale("zh");
    const store = createStore({ startDay: 6 });
    completeUntil(store, "task1");
    const task = taskByFlag(6, "task_d6_1")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `6:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 6, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="snake"');
    expect(out()).toContain('data-action="snake-start"');
    act("snake-start");
    expect(session.snake?.key).toBe(task.id);
    expect(session.snake?.running).toBe(true);
    expect(out()).toContain('data-action="snake-turn" data-dir="up"');
    // the clock: one tick moves the head
    const head0 = session.snake!.body[0]!;
    runTimers();
    expect(session.snake!.body[0]).toBe(head0 + 1);
    expect(timers).toHaveLength(1);
    // a turn through the action
    act("snake-turn", { dir: "up" });
    expect(session.snake!.next).toBe("up");
    // the work page left: the clock stops and 继续 is offered when it is back
    session.workShow = null;
    runTimers();
    expect(session.snake!.running).toBe(false);
    expect(timers).toHaveLength(0);
    session.workShow = `6:${task.id}`;
    expect(out()).toContain('data-action="snake-resume"');
    act("snake-resume");
    expect(session.snake!.running).toBe(true);
    // bitten: Kuro's offer; he eats the rest
    session.snake = { ...session.snake!, over: true, running: false };
    expect(out()).toContain(`data-action="snake-assist">${t("settle.kuro")}</button>`);
    act("snake-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 6, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("snake.stage.won"));
    now = 4000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
