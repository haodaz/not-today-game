// tetris (author 2026-11-13): day 12's 值班表 — the Game Boy well after the filled form; pieces fall,
// move, turn with a kick, lock and clear rows; every seventh piece is ΥΠΝΟΣ; the stack at the top ends
// it; a week of rows approves the form; gravity runs through the session's timers.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { fits, kindFor, PIECES, tetrisDropMs, tetrisKey, tetrisStart, tetrisTick, YPNOS, YPNOS_EVERY, type TetrisGame } from "@world/desktop/workbench/tetris";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "tetris" as const, cols: 7, rows: 12, goal: 7 };

describe("tetris", () => {
  it("day 12's board is a tetris; every seventh piece is ΥΠΝΟΣ", () => {
    expect(taskByFlag(12, "task_d12_work")!.board!.game).toEqual(GAME);
    expect(PIECES[YPNOS]!.name).toBe("Y");
    expect(PIECES[YPNOS]!.rots[0]).toHaveLength(5);
    for (let n = 1; n < 30; n++) expect(kindFor(n, dice(`k${n}`)) === YPNOS).toBe(n % YPNOS_EVERY === 0);
    for (let n = 1; n < 7; n++) expect(kindFor(n, dice(`k${n}`))).toBeLessThan(YPNOS);
  });

  it("starts with a piece entering mid-well; gravity lowers it; walls and blocks stop moves; a turn kicks off the wall", () => {
    const g = tetrisStart("t", GAME, dice("s1"), 1);
    expect(g.piece).not.toBeNull();
    expect(g.piece!.y).toBe(-1);
    expect(g.cells.every((v) => v === 0)).toBe(true);
    expect(g.lines).toBe(0);
    const g1 = tetrisTick(g, dice("r"), 100);
    expect(g1.piece!.y).toBe(0);
    // an I piece against the left wall cannot go further left; against the right wall neither
    const I: TetrisGame = { ...g1, piece: { kind: 0, rot: 0, x: 0, y: 2 } };
    expect(tetrisKey(I, "left", dice("r"), 0)).toBe(I);
    expect(tetrisKey(I, "right", dice("r"), 0).piece!.x).toBe(1);
    const Ir: TetrisGame = { ...g1, piece: { kind: 0, rot: 0, x: 3, y: 2 } };
    expect(tetrisKey(Ir, "right", dice("r"), 0)).toBe(Ir);
    // turning the I upright at the left wall needs a kick: the vertical rotation sits at column x+2
    const turned = tetrisKey(I, "rotate", dice("r"), 0);
    expect(turned.piece!.rot).toBe(1);
    expect(fits(turned, turned.piece!)).toBe(true);
    // a hard drop locks it on the floor
    const dropped = tetrisKey(I, "drop", dice("r"), 0);
    expect(dropped.cells.slice(11 * 7, 12 * 7)).toEqual([1, 1, 1, 1, 0, 0, 0]);
    expect(dropped.piece).not.toBeNull();
    expect(dropped.spawned).toBe(2);
    expect(dropped.lines).toBe(0);
    expect(tetrisDropMs(0)).toBeGreaterThan(tetrisDropMs(5));
  });

  it("a full row clears and the rest comes down; the goal is done; a piece that cannot enter is over", () => {
    const g = tetrisStart("t", GAME, dice("s1"), 1);
    // the floor row full but for four cells at columns 1–4; an I piece dropped there clears it
    const cells = [...g.cells];
    for (const x of [0, 5, 6]) cells[11 * 7 + x] = 2;
    cells[10 * 7 + 0] = 2; // a block above the floor at the far left, to come down
    const set: TetrisGame = { ...g, cells, piece: { kind: 0, rot: 0, x: 1, y: 0 } };
    const after = tetrisKey(set, "drop", dice("r"), 500);
    expect(after.lines).toBe(1);
    expect(after.flash).toEqual([11]);
    expect(after.flashAt).toBe(500);
    expect(after.cells.slice(11 * 7, 12 * 7)).toEqual([2, 0, 0, 0, 0, 0, 0]);
    expect(after.cells.slice(10 * 7, 11 * 7)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    // the goal: one row short, the clearing row finishes it
    const near: TetrisGame = { ...set, lines: GAME.goal - 1 };
    const won = tetrisKey(near, "drop", dice("r"), 0);
    expect(won.done).toBe(true);
    expect(won.piece).toBeNull();
    expect(won.running).toBe(false);
    // over: the well stacked (never a full row: columns 5–6 stay free), the top row holding the next piece's entry cells;
    // an upright I drops down column 6, locks, and the O that follows cannot enter
    const brim = [...g.cells];
    for (let y = 1; y < 12; y++) for (let x = 0; x < 5; x++) brim[y * 7 + x] = 2;
    brim[2] = 2; brim[3] = 2;
    const tight: TetrisGame = { ...g, cells: brim, piece: { kind: 0, rot: 1, x: 4, y: -1 }, nextKind: 1 };
    const lost = tetrisKey(tight, "drop", dice("r"), 0);
    expect(lost.lines).toBe(0);
    expect(lost.over).toBe(true);
    expect(lost.piece).toBeNull();
  });

  it("after the filled form the stage shows the well; gravity runs on the timers; the keys move the piece; a week staffed approves the form and the sheet opens; the stack at the top offers Kuro", () => {
    setLocale("zh");
    const store = createStore({ startDay: 12 });
    completeUntil(store, "work");
    const task = taskByFlag(12, "task_d12_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `12:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 12, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="tetris"');
    act("tetris-start");
    expect(session.tetris?.key).toBe(task.id);
    expect(session.tetris?.running).toBe(true);
    expect(out()).toContain('data-action="tetris-key" data-k="rotate"');
    const y0 = session.tetris!.piece!.y;
    runTimers();
    expect(session.tetris!.piece!.y).toBe(y0 + 1);
    expect(timers).toHaveLength(1);
    const x0 = session.tetris!.piece!.x;
    act("tetris-key", { k: "right" });
    expect(session.tetris!.piece!.x).toBe(x0 + 1);
    // the work page left: gravity stops; back, 继续
    session.workShow = null;
    runTimers();
    expect(session.tetris!.running).toBe(false);
    session.workShow = `12:${task.id}`;
    expect(out()).toContain('data-action="tetris-resume"');
    act("tetris-resume");
    expect(session.tetris!.running).toBe(true);
    // stacked to the top: Kuro's offer; he staffs it
    session.tetris = { ...session.tetris!, over: true, running: false, piece: null };
    expect(out()).toContain(`data-action="tetris-assist">${t("settle.kuro")}</button>`);
    act("tetris-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 12, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("tetris.stage.won"));
    // the approval moment holds the well a while (the timers moved `now` on); then the table is back with the sheet's button
    now += 6000;
    expect(out()).toContain('data-screen="table"');
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
