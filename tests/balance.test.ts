// balance (author 2026-11-13): day 11's 成本表 — the scale after the filled form; the crane swings on the
// clock, a drop lands on the pan under it (square or 歪), three 歪 fall, the last block judges the
// level; a pause costs no time; level approves the form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { BALANCE_PERIOD_MS, balanceDrop, balancePause, balanceResume, balanceSolve, balanceStart, craneX, elapsed, PAN_X, tilt, weight, type BalanceGame } from "@world/desktop/workbench/balance";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "balance" as const, fixed: 5 };
const BLOCKS = [{ label: "麦子", w: 3 }, { label: "大麦", w: 1 }, { label: "盐", w: 2 }, { label: "柴", w: 2 }];
/** The clock time at which the crane sits over a pan's centre (right, or left). */
const over = (side: "l" | "r"): number => Math.round((Math.asin(PAN_X) / (2 * Math.PI)) * BALANCE_PERIOD_MS) * (side === "r" ? 1 : -1) + (side === "l" ? BALANCE_PERIOD_MS : 0);

describe("balance", () => {
  it("day 11's board is a balance; the crane swings on the clock; the welded weights are equal", () => {
    expect(taskByFlag(11, "task_d11_work")!.board!.game).toEqual(GAME);
    const g = balanceStart("t", GAME, BLOCKS, 1, 1000);
    expect(weight(g, "l")).toBe(5);
    expect(weight(g, "r")).toBe(5);
    expect(tilt(g)).toBe(0);
    expect(craneX(g, 1000)).toBeCloseTo(0, 5);
    expect(craneX(g, 1000 + BALANCE_PERIOD_MS / 4)).toBeCloseTo(1, 5);
    expect(craneX(g, 1000 + (3 * BALANCE_PERIOD_MS) / 4)).toBeCloseTo(-1, 5);
    expect(craneX(g, 1000 + over("r"))).toBeCloseTo(PAN_X, 2);
    expect(craneX(g, 1000 + over("l"))).toBeCloseTo(-PAN_X, 2);
  });

  it("a drop lands on the pan under the crane, square over its centre and 歪 off it; three 歪 fall; the last block judges the level", () => {
    const g = balanceStart("t", GAME, BLOCKS, 1, 0);
    const r = balanceDrop(g, over("r"));
    expect(r.placed).toHaveLength(1);
    expect(r.placed[0]).toMatchObject({ side: "r", bad: false, w: 3 });
    expect(weight(r, "r")).toBe(8);
    expect(tilt(r)).toBe(18);
    const l = balanceDrop(r, BALANCE_PERIOD_MS + over("l"));
    expect(l.placed[1]).toMatchObject({ side: "l", bad: false, w: 1 });
    // far from a pan's centre (the crane at the middle): 歪
    const bad = balanceDrop(l, 2 * BALANCE_PERIOD_MS);
    expect(bad.placed[2]!.bad).toBe(true);
    expect(bad.over).toBe(false);
    // three 歪: fallen
    let f: BalanceGame = balanceStart("t", GAME, [...BLOCKS, ...BLOCKS], 1, 0);
    for (let k = 0; k < 3; k++) f = balanceDrop(f, k * BALANCE_PERIOD_MS);
    expect(f.over).toBe(true);
    expect(f.fell).toBe(true);
    // the last block: level within one is done, else over
    const two = balanceStart("t", GAME, [{ label: "a", w: 3 }, { label: "b", w: 3 }], 1, 0);
    const level = balanceDrop(balanceDrop(two, over("r")), BALANCE_PERIOD_MS + over("l"));
    expect(level.done).toBe(true);
    expect(level.running).toBe(false);
    const tilted = balanceDrop(balanceDrop(two, over("r")), BALANCE_PERIOD_MS + over("r"));
    expect(tilted.over).toBe(true);
    expect(tilted.fell).toBe(false);
    // a pause costs no time; the solved scale is level
    const paused = balancePause(g, 500);
    expect(elapsed(paused, 9000)).toBe(500);
    expect(elapsed(balanceResume(paused, 9000, 2), 9000)).toBe(500);
    const solved = balanceSolve(g);
    expect(solved.done).toBe(true);
    expect(Math.abs(weight(solved, "l") - weight(solved, "r"))).toBeLessThanOrEqual(1);
  });

  it("after the filled form the stage shows the scale; a drop through the action; leaving pauses, 继续 resumes; fallen offers Kuro; approved opens the sheet", () => {
    setLocale("zh");
    const store = createStore({ startDay: 11 });
    completeUntil(store, "work");
    const task = taskByFlag(11, "task_d11_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `11:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string) => boardActions[name]!(ctx, {} as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 11, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="balance"');
    act("balance-start");
    expect(session.balance?.key).toBe(task.id);
    expect(session.balance?.running).toBe(true);
    expect(session.balance?.blocks.length).toBeGreaterThan(0);
    expect(out()).toContain('data-action="balance-drop"');
    expect(out()).toContain('class="bl-block welded"');
    now = 1000 + over("r");
    act("balance-drop");
    expect(session.balance!.placed).toHaveLength(1);
    expect(session.balance!.placed[0]!.side).toBe("r");
    // the work page left: the clock pauses; back, 继续 (no time lost)
    session.workShow = null;
    runTimers();
    expect(session.balance!.running).toBe(false);
    expect(session.balance!.pausedAt).not.toBeNull();
    session.workShow = `11:${task.id}`;
    expect(out()).toContain('data-action="balance-resume"');
    const e0 = elapsed(session.balance!, now);
    now += 5000;
    act("balance-resume");
    expect(session.balance!.running).toBe(true);
    expect(elapsed(session.balance!, now)).toBe(e0);
    // fallen: Kuro's offer; he levels it
    session.balance = { ...session.balance!, over: true, fell: true, running: false };
    expect(out()).toContain(`data-action="balance-assist">${t("settle.kuro")}</button>`);
    act("balance-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 11, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("balance.stage.won"));
    now += 6000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
