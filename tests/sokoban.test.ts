// sokoban (author 2026-11-13): day 9's seating — the warehouse floor after the filled form; the level
// parses, steps and pushes follow the classic rules, stuck does nothing, 退一步 takes one back, the
// fourth chair on a mark brings the shadow, every chair seated is done; the content level is solvable;
// the meeting-view board shows the game and the approval sends it back to the meeting stage.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { onMarks, parseLevel, SHADOW_AT, sokobanMove, sokobanSolve, sokobanStart, sokobanUndo, type SokobanGame } from "@world/desktop/workbench/sokoban";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const TINY = { kind: "sokoban" as const, level: ["#####", "#@$.#", "#   #", "#####"] };

describe("sokoban", () => {
  it("parses a level; a step moves, a push moves the chair, a wall or a second chair is stuck; 退一步; done when every chair sits", () => {
    const lv = parseLevel(TINY.level);
    expect(lv.cols).toBe(5);
    expect(lv.player).toBe(1 * 5 + 1);
    expect(lv.boxes).toEqual([1 * 5 + 2]);
    expect(lv.targets).toEqual([1 * 5 + 3]);
    const g = sokobanStart("t", TINY);
    expect(sokobanMove(g, "up")).toBe(g);
    expect(sokobanMove(g, "left")).toBe(g);
    const pushed = sokobanMove(g, "right");
    expect(pushed.player).toBe(1 * 5 + 2);
    expect(pushed.boxes).toEqual([1 * 5 + 3]);
    expect(pushed.pushes).toBe(1);
    expect(pushed.done).toBe(true);
    expect(onMarks(pushed)).toBe(1);
    // against the wall past the chair: stuck
    const corner: SokobanGame = { ...g, boxes: [1 * 5 + 3], player: 1 * 5 + 2 };
    expect(sokobanMove(corner, "right")).toBe(corner);
    // a second chair behind the first: stuck
    const two: SokobanGame = { ...g, boxes: [1 * 5 + 2, 1 * 5 + 3] };
    expect(sokobanMove(two, "right")).toBe(two);
    // 退一步 puts the chair and you back
    const down = sokobanMove(g, "down");
    const back = sokobanUndo(down);
    expect(back.player).toBe(g.player);
    expect(back.history).toHaveLength(0);
    expect(sokobanUndo(g)).toBe(g);
  });

  it("the fourth chair on a mark brings the shadow; the content level is solvable", () => {
    const task = taskByFlag(9, "task_d9_3")!;
    const game = task.board!.game!;
    expect(game.kind).toBe("sokoban");
    const g = sokobanStart("t", game as Extract<typeof game, { kind: "sokoban" }>);
    expect(g.targets).toHaveLength(5);
    expect(g.boxes).toHaveLength(5);
    // a known solution (found by a search over the level): replayed, every chair sits
    const DIRS = { u: "up", d: "down", l: "left", r: "right" } as const;
    let played = g;
    for (const ch of "uurdldrrururrddluddll") played = sokobanMove(played, DIRS[ch as keyof typeof DIRS]);
    expect(played.done).toBe(true);
    expect(onMarks(played)).toBe(5);
    expect(played.shadow).not.toBeNull();
    // three chairs already seated (marks 0, 1, 3), a fourth pushed onto the row-3 mark (marks[2], two cells right of you): the shadow sits on it
    let cur: SokobanGame = { ...g, boxes: [g.targets[0]!, g.targets[1]!, g.targets[3]!, g.player + 2, g.boxes[4]!] };
    cur = sokobanMove(cur, "right"); // you to x=2
    expect(cur.shadow).toBeNull();
    cur = sokobanMove(cur, "right"); // the chair from x=3 onto the mark at x=4
    expect(onMarks(cur)).toBe(SHADOW_AT);
    expect(cur.shadow).toBe(cur.boxes[3]);
    expect(sokobanSolve(g).done).toBe(true);
    expect(sokobanSolve(g).shadow).not.toBeNull();
  });

  it("after the filled seating form the meeting-view board shows the floor; a push through the action; seated approves and the meeting stage is back", () => {
    setLocale("zh");
    const store = createStore({ startDay: 9 });
    // the seating task is the open work once the day's earlier items (the reply, the dinner order) are done
    completeUntil(store, "desk", { skip: ["task3"] });
    const task = taskByFlag(9, "task_d9_3")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `9:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 9, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="sokoban"');
    act("sokoban-start");
    expect(session.sokoban?.key).toBe(task.id);
    expect(out()).toContain('data-action="sokoban-move" data-dir="up"');
    const p0 = session.sokoban!.player;
    act("sokoban-move", { dir: "up" });
    expect(session.sokoban!.player).toBe(p0 - session.sokoban!.cols);
    act("sokoban-undo");
    expect(session.sokoban!.player).toBe(p0);
    // the dev cheat seats them all: approved; the stamp; then the meeting stage with its send
    act("sokoban-cheat");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 9, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("sokoban.stage.won"));
    now += 6000;
    expect(out()).toContain('data-screen="meeting"');
  });
});
