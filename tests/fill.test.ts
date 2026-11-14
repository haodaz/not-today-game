// day11-budget-fill: day 11's cost sheet as a budget fill — the loader, the pure engine (placement,
// overlap, budget, refund, round end, the 自己人 greying, Kuro's fill order), the solver over the
// content's four rounds, a known solution replayed, a view snapshot of round 1, and the cheat.
import "./specimen";
import { describe, expect, it } from "vitest";
import day11 from "@content/tasks/day-11.json";
import { boardState } from "@state/days/board";
import { parseTaskFile, taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import {
  cellsAt, fillKuro, fillLift, fillNext, fillPeopleNeeded, fillPick, fillPlace, fillRecord, fillRotate, fillSheet, fillSolve, fillStage, fillStart, fillStuck,
  orientations, peopleShown, roundComplete, spentNow, turned, type FillBoard, type FillGame,
} from "@world/desktop/workbench/fill";
import { openWork } from "@world/desktop/workbench/work";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

setLocale("zh");
const task = taskByFlag(11, "task_d11_work")!;
const game = task.board!.game as FillBoard;
const names = { login: "林晚" };

/** A board for engine tests: one 3×3 round per entry. */
const tiny = (over: Partial<FillBoard["rounds"][number]> = {}, people: FillBoard["people"] = ["boss", "partner", "me"]): FillBoard => ({
  kind: "fill",
  people,
  rounds: [0, 1, 2, 3].map(() => ({ size: 3, cells: [0, 1, 4], budget: 10, pieces: [{ shape: "1", price: 3, n: 2 }, { shape: "I2", price: 5, n: 1 }], people: false, ...over })),
});

describe("the loader", () => {
  it("day 11 carries the fill: four rounds, the content's people, round 3 and 4 with 自己人; no balance", () => {
    expect(game.kind).toBe("fill");
    expect(game.rounds.map((r) => r.size)).toEqual([4, 5, 6, 7]);
    expect(game.rounds.map((r) => r.people)).toEqual([false, false, true, true]);
    expect(game.people).toEqual(["boss", "partner", "xiaozhang", "laozhou", "me"]);
    expect(game.rounds[0]!.cells).toContain(0 * 4 + 1);
  });
  it("is strict: shapes from the set, cells inside the grid, prices ≥ 0, four rounds, me last", () => {
    const bad = (edit: (g: any) => void) => () => {
      const raw = structuredClone(day11) as any;
      edit(raw.tasks.find((t: any) => t.id === "work").board.game);
      return parseTaskFile(raw, "day-11.json");
    };
    expect(bad((g) => (g.rounds[0].pieces[0].shape = "X9"))).toThrow(/must be one of/);
    expect(bad((g) => (g.rounds[0].cells[0] = "4,0"))).toThrow(/inside the 4×4 grid/);
    expect(bad((g) => (g.rounds[0].pieces[0].price = -1))).toThrow(/price/);
    expect(bad((g) => g.rounds.pop())).toThrow(/4 rounds/);
    expect(bad((g) => (g.people = ["me", "boss"]))).toThrow(/"me" must come last/);
    expect(bad((g) => (g.rounds[1].cells.push(g.rounds[1].cells[0])))).toThrow(/twice/);
  });
});

describe("the engine", () => {
  it("turns shapes; anchors inside the grid only", () => {
    expect(turned("I2", 1)).toEqual([[0, 0], [1, 0]]);
    expect(orientations("O4")).toHaveLength(1);
    expect(orientations("I4")).toHaveLength(2);
    expect(orientations("T4")).toHaveLength(4);
    expect(cellsAt(3, "I2", 0, 2)).toBeNull();
    expect(cellsAt(3, "I2", 1, 2)).toEqual([2, 5]);
  });
  it("placement pays, overlap and over-budget do nothing, lifting refunds; the round ends when every 要求 cell is covered", () => {
    const b = tiny();
    let g = fillStart("t");
    g = fillPick(b, g, { kind: "piece", tray: 1 });
    g = fillPlace(b, g, 0); // I2 over 0,1
    expect(spentNow(g)).toBe(5);
    expect(g.pick).toBeNull(); // the only I2 is used
    const same = fillPlace(b, fillPick(b, g, { kind: "piece", tray: 0 }), 1);
    expect(same.placed).toHaveLength(1); // overlaps
    g = fillPlace(b, fillPick(b, g, { kind: "piece", tray: 0 }), 4);
    expect(spentNow(g)).toBe(8);
    expect(roundComplete(b, g)).toBe(true);
    // over the budget: 8 + 3 > 10
    expect(fillPlace(b, g, 8).placed).toHaveLength(2);
    // lift the I2: refunded, the round open again
    const lifted = fillLift(g, g.placed[0]!.id);
    expect(spentNow(lifted)).toBe(3);
    expect(roundComplete(b, lifted)).toBe(false);
    // rotate turns the pick
    expect(fillRotate(g).rot).toBe(1);
    // the round passes: the next one starts empty, the old pieces kept faint
    const next = fillNext(b, g, 100);
    expect(next.round).toBe(1);
    expect(next.placed).toEqual([]);
    expect(next.prev?.placed).toHaveLength(2);
    expect(next.spentBefore).toBe(8);
  });
  it("自己人: free, greyed for the rest of the game; 你 only when everyone else is used", () => {
    const b = tiny({ people: true, budget: 0 });
    let g = fillStart("t");
    expect(peopleShown(b, g)).toEqual([{ person: "boss", free: true }, { person: "partner", free: true }]);
    g = fillPlace(b, fillPick(b, g, { kind: "person", person: "boss" }), 0);
    g = fillPlace(b, fillPick(b, g, { kind: "person", person: "partner" }), 1);
    expect(peopleShown(b, g)).toEqual([{ person: "boss", free: false }, { person: "partner", free: false }, { person: "me", free: true }]);
    g = fillPlace(b, fillPick(b, g, { kind: "person", person: "me" }), 4);
    expect(spentNow(g)).toBe(0);
    g = fillNext(b, g);
    expect(g.used).toEqual(["boss", "partner", "me"]);
    expect(peopleShown(b, g).every((p) => !p.free)).toBe(true);
    expect(fillPick(b, g, { kind: "person", person: "boss" })).toBe(g);
  });
  it("stuck, Kuro fills: every person left in order (you last) on the 要求 cells, then free cells with no name; the round passes", () => {
    const b = tiny({ cells: [0, 1, 2, 3, 4], budget: 0 }, ["boss", "partner", "me"]);
    const g = fillStart("t");
    expect(fillStuck(b, g)).toBe(true);
    const k = fillKuro(b, g);
    expect(k.round).toBe(1);
    expect(k.kuro).toBe(true);
    expect(k.used).toEqual(["boss", "partner", "me"]);
    const pieces = k.prev!.placed;
    expect(pieces.map((p) => [p.person ?? null, p.cells[0]])).toEqual([["boss", 0], ["partner", 1], ["me", 2], [null, 3], [null, 4]]);
    // fewer cells than people: the rest are spent too, on blank cells
    const few = fillKuro(tiny({ cells: [0], budget: 0 }), fillStart("t"));
    expect(few.used).toEqual(["boss", "partner", "me"]);
  });
});

describe("the solver on the content's four rounds", () => {
  it("each round passes with its budget plus the 自己人 by then; round 4 not on the budget alone; a known solution replays", () => {
    const [r1, r2, r3, r4] = game.rounds;
    expect(fillSolve(r1!, 0)).not.toBeNull();
    expect(fillSolve(r2!, 0)).not.toBeNull();
    const need3 = fillPeopleNeeded(r3!, 4);
    expect(need3).not.toBeNull();
    const left = game.people.length - need3!;
    expect(fillSolve(r4!, 0)).toBeNull();
    expect(fillPeopleNeeded(r4!, left)).not.toBeNull();
    // replay round 1's solution through the engine
    const moves = fillSolve(r1!, 0)!;
    let g: FillGame = fillStart("t");
    for (const m of moves) g = fillPlace(game, { ...fillPick(game, { ...g, pick: null }, m.pick), rot: m.rot }, m.cell);
    expect(roundComplete(game, g)).toBe(true);
    expect(spentNow(g)).toBeLessThanOrEqual(r1!.budget);
  });
});

describe("the view and the actions", () => {
  it("snapshot: round 1, started, one piece placed and the next picked", () => {
    let g = fillStart(task.id);
    g = fillPlace(game, fillPick(game, g, { kind: "piece", tray: 1 }), 1);
    g = fillPick(game, g, { kind: "piece", tray: 0 });
    const s = boardState(task.board!, 11, task.id, []);
    expect(fillStage(task, task.board!, s, { fill: g }, false, 0, names).value).toMatchSnapshot();
    expect(fillStage(task, task.board!, s, { fill: null }, false, 0, names).value).toContain('data-action="fill-start"');
  });
  it("the cheat wins all four rounds: one record in the log, the approval, the settlement; graded perfect", () => {
    const store = createStore({ startDay: 11 });
    completeUntil(store, "work");
    expect(openWork(store.getState(), store.getEvents())?.tree?.id).toBe(task.id);
    const b = task.board!;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: b.given.lock!.answer } });
    for (const sl of b.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: sl.id, card: sl.answer } });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    act("fill-start");
    expect(session.fill?.round).toBe(0);
    act("fill-cheat");
    expect(session.fill?.done).toBe(true);
    expect(boardState(b, 11, task.id, store.getEvents()).approved).toBe(true);
    const rec = fillRecord(store.getEvents(), 11, task.id)!;
    expect(rec.kuro).toBe(false);
    expect(rec.people.length).toBeGreaterThan(0);
    // the settlement's real sheet: one 人 row per person, the spent ones struck; the sum line
    const sheet = fillSheet(game, rec, names).value;
    expect([...sheet.matchAll(/class="fl-row struck"/g)]).toHaveLength(rec.people.length);
    expect([...sheet.matchAll(/<li class="fl-row/g)]).toHaveLength(game.people.length);
    expect(sheet).toContain(t("settle.fill.sum", { budget: String(game.rounds.reduce((n, r) => n + r.budget, 0)), spent: String(rec.spent), n: String(rec.people.length) }));
    if (rec.people.includes("me")) expect(sheet).toContain(t("settle.fill.row.me", { name: "林晚" }));
    act("board-print");
    expect(store.getEvents().some((e) => e.kind === "task" && e.flag === task.done && e.quality === "perfect")).toBe(true);
  });
  it("Kuro's fill grades it wrong", () => {
    const store = createStore({ startDay: 11 });
    completeUntil(store, "work");
    const b = task.board!;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: b.given.lock!.answer } });
    for (const sl of b.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: sl.id, card: sl.answer } });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    act("fill-start");
    // spend round 1's budget on blank cells until stuck, then 让克总帮忙, then the rest by the cheat
    session.fill = { ...session.fill!, placed: [{ id: 99, cells: [], price: game.rounds[0]!.budget }] };
    act("fill-assist");
    expect(session.fill?.kuro).toBe(true);
    act("fill-cheat");
    expect(fillRecord(store.getEvents(), 11, task.id)?.kuro).toBe(true);
    act("board-print");
    expect(store.getEvents().some((e) => e.kind === "task" && e.flag === task.done && e.quality === "wrong")).toBe(true);
  });
});
