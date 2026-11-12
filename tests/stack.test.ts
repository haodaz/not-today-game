// stack (author 2026-11-12): the approval chain as 2048 on day 13's 借阅审批单.
import "./specimen";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { taskByFlag } from "@state/days/tasks";
import { boardState, canPrint, freshBoard, stepBoard } from "@state/days/board";
import { rankOf, stackBest, stackMove, stackStart, stackTarget, swipeDir, SWIPE_MIN_PX, tileMotion, type StackGrid } from "../src/world/desktop/workbench/stack-stage";

const day13 = () => taskByFlag(13, "task_d13_work")!;

describe("the approval chain", () => {
  it("day 13's board carries eleven office ranks as symbols, approval at 2048, and two silhouette easter eggs past it", () => {
    const st = day13().board!.stack!;
    expect(st.ranks).toHaveLength(13);
    expect(st.ranks[0]!.img).toBe("/npc/power/p1.jpg");
    expect(st.target).toBe(2048);
    expect(st.ranks[11]!.silhouette).toBe(true);
    expect(st.ranks[12]!.name).toBe("克总");
    expect(rankOf(2)).toBe(0);
    expect(rankOf(2048)).toBe(10);
    expect(stackTarget(st)).toBe(2048);
  });
  it("a move slides and merges once per pair, scores, spawns; an unchanged grid stays the same object", () => {
    const g: StackGrid = { key: "k", cells: [2, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, over: false };
    const left = stackMove(g, "left", () => 0.5);
    expect(left.cells.slice(0, 2)).toEqual([4, 4]);
    expect(left.score).toBe(4);
    expect(left.moves).toBe(1);
    expect(left.cells.filter((v) => v !== 0)).toHaveLength(3); // one spawned
    const full: StackGrid = { key: "k", cells: [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], score: 0, moves: 0, over: false };
    expect(stackMove(full, "left")).toBe(full);
    const start = stackStart("k", () => 0.5);
    expect(start.cells.filter((v) => v !== 0)).toHaveLength(2);
    expect(stackBest({ ...g, cells: [2, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })).toBe(1024);
  });
  it("the filled form is not handed in until the chain approves it; the approve step unlocks 提交", () => {
    const b = day13().board!;
    let s = freshBoard(b);
    s = { ...s, unlocked: true };
    for (const slot of b.slots) s = stepBoard(b, s, { t: "fill", slot: slot.id, card: slot.answer });
    expect(canPrint(b, s)).toBe(false);
    s = stepBoard(b, s, { t: "approve" });
    expect(s.approved).toBe(true);
    expect(canPrint(b, s)).toBe(true);
    const store = createStore({ startDay: 13 });
    store.appendEvent({ kind: "boardStep", taskId: day13().id, op: { t: "approve" } });
    expect(boardState(b, 13, day13().id, store.getEvents()).approved).toBe(true);
  });
  it("work-stages-polish 3: a swipe's direction from dx / dy (the main axis), none under 24 px or on the diagonal", () => {
    expect(SWIPE_MIN_PX).toBe(24);
    expect(swipeDir(30, 4)).toBe("right");
    expect(swipeDir(-30, 10)).toBe("left");
    expect(swipeDir(5, 40)).toBe("down");
    expect(swipeDir(-12, -25)).toBe("up");
    expect(swipeDir(23, 0)).toBeNull();
    expect(swipeDir(-10, 20)).toBeNull();
    expect(swipeDir(30, 30)).toBeNull();
    expect(swipeDir(0, 0)).toBeNull();
  });
  it("work-stages-polish 3: a move remembers where each tile came from (slide, merge, new) for the 120 ms slide", () => {
    const g: StackGrid = { key: "k", cells: [0, 2, 0, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0, moves: 0, over: false };
    const left = stackMove(g, "left", () => 0.99);
    expect(left.cells.slice(0, 8)).toEqual([4, 0, 0, 0, 4, 0, 0, 0]);
    expect(tileMotion(left, 0)).toEqual({ kind: "merge", dx: 1, dy: 0 });
    expect(tileMotion(left, 4)).toEqual({ kind: "slide", dx: 2, dy: 0 });
    const spawned = left.cells.findIndex((v, i) => v !== 0 && i !== 0 && i !== 4);
    expect(tileMotion(left, spawned)).toEqual({ kind: "born" });
    expect(tileMotion(left, 1)).toBeNull();
  });
});
