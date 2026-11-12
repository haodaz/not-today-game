// whack-a-mole (author 2026-11-13): day 15's launch — the hall after the filled deck; the seeded schedule
// of faces looking down, a tap on a lit one, the special face that never looks up, the pages judged
// at their ends, a pause that costs no time, the approval back to the meeting stage.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { activePop, elapsed, hitsOn, molesPause, molesResume, molesSolve, molesStart, molesSweep, molesTap, pageAt, specialDown, type MolesGame } from "@world/desktop/workbench/moles";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "moles" as const, seats: 12, pages: 3, pageMs: 22000 };

describe("whack-a-mole", () => {
  it("day 15's board is a whack-a-mole; the schedule fills the pages, faster on the last, never the special seat on the last page", () => {
    expect(taskByFlag(15, "task_d15_work")!.board!.game).toEqual(GAME);
    const g = molesStart("t", GAME, "she", dice("s1"), 1, 1000);
    expect(g.pops.length).toBeGreaterThan(40);
    for (let p = 0; p < 3; p++) expect(g.pops.filter((x) => x.page === p).length).toBeGreaterThan(10);
    expect(g.pops.filter((x) => x.page === 2).length).toBeGreaterThan(g.pops.filter((x) => x.page === 0).length);
    expect(g.pops.every((x) => x.seat >= 0 && x.seat < 12)).toBe(true);
    expect(g.pops.filter((x) => x.page === 2).every((x) => x.seat !== g.special)).toBe(true);
    expect(g.need.every((n) => n > 0)).toBe(true);
    expect(pageAt(g, 0)).toBe(0);
    expect(pageAt(g, 22000)).toBe(1);
    expect(elapsed(g, 1500)).toBe(500);
  });

  it("a tap on a lit face looks it up, on a dark one nothing; the special face stays down and shows you; the pages are judged at their ends", () => {
    const g = molesStart("t", GAME, "she", dice("s1"), 1, 0);
    const first = g.pops[0]!;
    expect(activePop(g, first.seat, first.t + 100)).toBe(first);
    expect(activePop(g, first.seat, first.t - 100)).toBeUndefined();
    const hit = molesTap(g, first.seat, first.t + 100);
    expect(hit.pops[0]!.hit).toBe(true);
    expect(hitsOn(hit, 0)).toBe(1);
    expect(molesTap(g, first.seat, first.t - 100)).toBe(g);
    expect(molesTap(hit, first.seat, first.t + 100)).toBe(hit);
    // the special face: down through the last page; a tap does not lift it, it shows you
    const last = 2 * GAME.pageMs + 1000;
    expect(specialDown(g, last)).toBe(true);
    expect(specialDown(g, 1000)).toBe(false);
    const seen = molesTap(g, g.special, last);
    expect(seen.youSeen).toBe(true);
    expect(seen.pops.some((p) => p.hit)).toBe(false);
    // a cold first page: over at its end; a warm one goes on; all three warm: done
    const cold = molesSweep(g, GAME.pageMs + 1);
    expect(cold.over).toBe(true);
    const warm: MolesGame = { ...g, pops: g.pops.map((p) => (p.page === 0 ? { ...p, hit: true } : p)) };
    expect(molesSweep(warm, GAME.pageMs + 1).over).toBe(false);
    const all: MolesGame = { ...g, pops: g.pops.map((p) => ({ ...p, hit: true })) };
    const done = molesSweep(all, 3 * GAME.pageMs + 1);
    expect(done.done).toBe(true);
    expect(done.running).toBe(false);
    // a pause costs no time; the solved hall is done with you seen
    const paused = molesPause(g, 700);
    expect(elapsed(paused, 9000)).toBe(700);
    expect(elapsed(molesResume(paused, 9000, 2), 9000)).toBe(700);
    expect(molesSolve(g).done).toBe(true);
    expect(molesSolve(g).youSeen).toBe(true);
  });

  it("after the filled deck the meeting-view board shows the hall; a tap through the action; leaving pauses, 继续 resumes; cold offers Kuro; approved brings the meeting stage back", () => {
    setLocale("zh");
    const store = createStore({ startDay: 15 });
    completeUntil(store, "work");
    const task = taskByFlag(15, "task_d15_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `15:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 15, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="moles"');
    act("moles-start");
    expect(session.moles?.key).toBe(task.id);
    expect(session.moles?.running).toBe(true);
    expect(out()).toContain('data-action="moles-tap" data-seat="0"');
    const first = session.moles!.pops[0]!;
    now = 1000 + first.t + 200;
    expect(out()).toContain(`data-action="moles-tap" data-seat="${String(first.seat)}"`);
    expect(out()).toMatch(new RegExp(`class="ml-seat down" data-action="moles-tap" data-seat="${String(first.seat)}"`));
    act("moles-tap", { seat: String(first.seat) });
    expect(session.moles!.pops[0]!.hit).toBe(true);
    // the work page left: the clock pauses; back, 继续 (no time lost)
    session.workShow = null;
    runTimers();
    expect(session.moles!.running).toBe(false);
    session.workShow = `15:${task.id}`;
    expect(out()).toContain('data-action="moles-resume"');
    const e0 = elapsed(session.moles!, now);
    now += 5000;
    act("moles-resume");
    expect(elapsed(session.moles!, now)).toBe(e0);
    // cold: Kuro's offer; he keeps their heads up
    session.moles = { ...session.moles!, over: true, running: false };
    expect(out()).toContain(`data-action="moles-assist">${t("settle.kuro")}</button>`);
    act("moles-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 15, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("moles.stage.won"));
    now += 6000;
    expect(out()).toContain('data-screen="meeting"');
  });
});
