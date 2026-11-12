// rhythm (author 2026-11-13): day 16's 董事长汇报 — the drum lane after the filled form; the beat sheet,
// the last bar twice as fast; a tap on the beat sounds, off it misses, into silence is nothing; the
// clock sweeps the misses and judges the sheet; a pause costs no time; enough 响 approves the form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { BEATS_PER_BAR, elapsed, eyes, RHYTHM_GOOD_MS, RHYTHM_LEAD_MS, rhythmPause, rhythmResume, rhythmStart, rhythmSweep, rhythmTap, score, sheetEnd, type RhythmGame } from "@world/desktop/workbench/rhythm";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "rhythm" as const, bars: 4, bpm: 96 };
const WORDS = ["赋能", "闭环", "抓手", "对齐"];

describe("rhythm", () => {
  it("day 16's board is a rhythm game; the sheet is bars of eight, the last bar twice as fast, a word on each", () => {
    expect(taskByFlag(16, "task_d16_work")!.board!.game).toEqual(GAME);
    const g = rhythmStart("t", GAME, WORDS, dice("s1"), 1, 10_000);
    expect(g.beatMs).toBe(625);
    expect(g.notes).toHaveLength(4 * BEATS_PER_BAR);
    expect(g.notes[0]!.t).toBe(RHYTHM_LEAD_MS);
    expect(g.notes[1]!.t - g.notes[0]!.t).toBe(625);
    const last = g.notes.filter((n) => n.bar === 3);
    expect(last).toHaveLength(8);
    expect(Math.abs(last[1]!.t - last[0]!.t - 312.5)).toBeLessThanOrEqual(1); // half a beat, the beats rounded to the ms
    expect(g.notes.every((n) => WORDS.includes(n.word))).toBe(true);
    expect(elapsed(g, 10_500)).toBe(500);
  });

  it("a tap on the beat sounds, off it misses, into silence is nothing; the sweep misses what nobody hit; the sheet is judged at its end", () => {
    const g = rhythmStart("t", GAME, WORDS, dice("s1"), 1, 0);
    const n0 = g.notes[0]!;
    const good = rhythmTap(g, n0.t + RHYTHM_GOOD_MS - 10);
    expect(good.notes[0]!.hit).toBe("good");
    expect(good.last?.kind).toBe("good");
    const off = rhythmTap(g, n0.t + 300);
    expect(off.notes[0]!.hit).toBe("miss");
    expect(rhythmTap(g, 100)).toBe(g);
    // the sweep: past a note by more than the late window, it is a miss
    const swept = rhythmSweep(g, n0.t + 300);
    expect(swept.notes[0]!.hit).toBe("miss");
    expect(swept.notes[1]!.hit).toBeNull();
    expect(swept.last?.kind).toBe("miss");
    // judged at the end: all but the last bar count; enough hits is done, else over
    const counted = g.notes.filter((n) => n.bar < 3).length;
    const hitAll: RhythmGame = { ...g, notes: g.notes.map((n) => ({ ...n, hit: n.bar < 3 ? ("good" as const) : null })) };
    const done = rhythmSweep(hitAll, sheetEnd(g) + 1);
    expect(done.done).toBe(true);
    expect(done.running).toBe(false);
    expect(score(done)).toEqual({ hits: counted, of: counted });
    const lost = rhythmSweep(g, sheetEnd(g) + 1);
    expect(lost.over).toBe(true);
    expect(lost.notes.every((n) => n.hit === "miss")).toBe(true);
    expect(eyes(lost, sheetEnd(g) + 1)).toBe(2);
    expect(eyes(g, 0)).toBe(0);
    // a pause costs no time
    const paused = rhythmPause(g, 1000);
    expect(elapsed(paused, 5000)).toBe(1000);
    const back = rhythmResume(paused, 5000, 2);
    expect(elapsed(back, 5000)).toBe(1000);
    expect(back.gen).toBe(2);
  });

  it("after the filled form the stage shows the lane; the clock sweeps; a tap through the action; leaving pauses, 继续 resumes; asleep offers Kuro; approved opens the sheet", () => {
    setLocale("zh");
    const store = createStore({ startDay: 16 });
    completeUntil(store, "work");
    const task = taskByFlag(16, "task_d16_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `16:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 16, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="rhythm"');
    act("rhythm-start");
    expect(session.rhythm?.key).toBe(task.id);
    expect(session.rhythm?.running).toBe(true);
    expect(session.rhythm?.startAt).toBe(1000);
    expect(out()).toContain('data-action="rhythm-tap"');
    runTimers();
    expect(timers).toHaveLength(1);
    // a tap on the first beat
    now = 1000 + session.rhythm!.notes[0]!.t;
    act("rhythm-tap");
    expect(session.rhythm!.notes[0]!.hit).toBe("good");
    expect(out()).toContain('class="rh-judge good"');
    // the work page left: the clock pauses; back, 继续 (no time lost)
    session.workShow = null;
    runTimers();
    expect(session.rhythm!.running).toBe(false);
    expect(session.rhythm!.pausedAt).not.toBeNull();
    session.workShow = `16:${task.id}`;
    expect(out()).toContain('data-action="rhythm-resume"');
    const e0 = elapsed(session.rhythm!, now);
    now += 5000;
    act("rhythm-resume");
    expect(session.rhythm!.running).toBe(true);
    expect(elapsed(session.rhythm!, now)).toBe(e0);
    // asleep: Kuro's offer; he makes the sound
    session.rhythm = { ...session.rhythm!, over: true, running: false };
    expect(out()).toContain(`data-action="rhythm-assist">${t("settle.kuro")}</button>`);
    act("rhythm-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 16, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("rhythm.stage.won"));
    now += 6000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
