// pac-man (author 2026-11-13): day 7's minutes — the maze after the filled form; the maze parses, you
// move tile by tile with a queued turn and stop at walls, dots and lines are eaten on the way, a
// pellet frightens the ghosts and lets you eat them, a ghost catches you, the five lines are done.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { FEAR_MS, linesEaten, pacPause, pacResume, pacSolve, pacStart, pacTick, pacTurn, parseMaze, type PacGame } from "@world/desktop/workbench/pacman";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const MAZE = ["#######", "#1...2#", "#.#.#.#", "#o.P.G#", "#.#.#.#", "#3.4.5#", "#######"];
const GAME = { kind: "pacman" as const, maze: MAZE };

/** Ticks of 80 ms from `from` until `pred` or `limit` ms. */
const run = (g: PacGame, from: number, pred: (x: PacGame) => boolean, limit = 6000): { g: PacGame; now: number } => {
  let now = from, cur = g;
  while (!pred(cur) && now - from < limit) { now += 80; cur = pacTick(cur, now); }
  return { g: cur, now };
};

describe("pac-man", () => {
  it("day 7's board is a pac-man; a maze parses into walls, dots, lines, pellets, you and the ghosts' homes", () => {
    const game = taskByFlag(7, "task_d7_4")!.board!.game!;
    expect(game.kind).toBe("pacman");
    const m = parseMaze(MAZE);
    expect(m.cols).toBe(7);
    expect(m.lines).toEqual([1 * 7 + 1, 1 * 7 + 5, 5 * 7 + 1, 5 * 7 + 3, 5 * 7 + 5]);
    expect(m.powers).toEqual([3 * 7 + 1]);
    expect(m.you).toBe(3 * 7 + 3);
    expect(m.homes).toEqual([3 * 7 + 5]);
    const big = parseMaze((game as Extract<typeof game, { kind: "pacman" }>).maze);
    expect(big.lines).toHaveLength(5);
    expect(big.homes.length).toBeGreaterThanOrEqual(3);
    expect(big.powers).toHaveLength(2);
  });

  it("you move a tile at a time, turn at centres, queue a turn, stop at walls; dots and a line are eaten on the way", () => {
    let g = pacStart("t", GAME, "s", 1, 0);
    g = { ...g, ghosts: [] }; // no ghosts here
    expect(g.you).toMatchObject({ x: 3, y: 3, dir: "left" });
    // left along row 3: the dot at (2,3) then the pellet at (1,3)
    const r1 = run(g, 0, (x) => x.you.x <= 2);
    expect(r1.g.dots[3 * 7 + 2]).toBe(false);
    expect(r1.g.score).toBe(10);
    // straight back is taken at once; a side turn waits for a centre
    const back = pacTurn(r1.g, "right");
    expect(back.you.dir).toBe("right");
    const queued = pacTurn({ ...back, you: { ...back.you, x: 2.4 } }, "up");
    expect(queued.you.next).toBe("up");
    // into a wall: you stop at the centre
    const wallward: PacGame = { ...g, you: { x: 3, y: 3, dir: "up", next: null } };
    const stuck = run(wallward, 0, (x) => x.steps > 10, 1000);
    expect(stuck.g.you).toMatchObject({ x: 3, y: 1 }); // the top row's corridor, under the wall
    // up the middle column then right to line 2 at (5,1): the line is eaten
    const m: PacGame = { ...g, you: { x: 3, y: 3, dir: "up", next: null } };
    const top = run(m, 0, (x) => x.you.y <= 1, 4000);
    const r2 = run(pacTurn(top.g, "right"), top.now, (x) => x.you.x >= 5, 4000);
    expect(r2.g.lines[1]).toBe(-1);
    expect(linesEaten(r2.g)).toBe(1);
    // all five eaten: done
    const five = pacTick({ ...g, lines: [-1, -1, -1, -1, 3 * 7 + 2], you: { x: 3, y: 3, dir: "left", next: null } }, 300);
    expect(five.done).toBe(true);
    expect(five.running).toBe(false);
  });

  it("a ghost catches you; after a pellet the ghosts are frightened for a while and you eat them; the solved maze; a pause costs no time", () => {
    const g = pacStart("t", GAME, "s", 1, 0);
    // a ghost right next to you, on your way: caught
    const close: PacGame = { ...g, ghosts: [{ ...g.ghosts[0]!, x: 4, y: 3, dir: "left", next: null }], you: { x: 3, y: 3, dir: "right", next: null } };
    const caught = run(close, 0, (x) => x.over, 1000);
    expect(caught.g.over).toBe(true);
    // the pellet first: the ghost is frightened and eaten instead
    const onPellet: PacGame = { ...g, you: { x: 2, y: 3, dir: "left", next: null }, ghosts: [{ ...g.ghosts[0]!, x: 5, y: 3, dir: "left", next: null }] };
    const ate = run(onPellet, 0, (x) => x.fearUntil > 0, 1000);
    expect(ate.g.fearUntil).toBeGreaterThan(0);
    expect(ate.g.fearUntil - (ate.now - ate.g.startAt)).toBeLessThanOrEqual(FEAR_MS);
    const turned = pacTurn(ate.g, "right");
    const meal = run(turned, ate.now, (x) => x.eatenGhosts > 0 || x.over, 4000);
    expect(meal.g.over).toBe(false);
    expect(meal.g.eatenGhosts).toBe(1);
    expect(meal.g.score).toBeGreaterThanOrEqual(250);
    // the eaten ghost is back home on the next tick
    const home = pacTick(meal.g, meal.now + 80);
    expect(home.ghosts[0]!.eaten).toBe(false);
    expect(home.ghosts[0]).toMatchObject({ x: 5, y: 3 });
    expect(pacSolve(g).done).toBe(true);
    const paused = pacPause(g, 500);
    expect(pacTick(paused, 9000)).toBe(paused);
    const back = pacResume(paused, 9000, 2);
    expect(back.pausedAt).toBeNull();
    expect(back.startAt).toBe(8500);
  });

  it("after the filled minutes the meeting-view board shows the maze; the clock runs on the timers; a turn through the action; caught offers Kuro; approved brings the meeting stage back", () => {
    setLocale("zh");
    const store = createStore({ startDay: 7 });
    completeUntil(store, "desk", { skip: ["task4"] });
    const task = taskByFlag(7, "task_d7_4")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `7:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const runTimers = () => { const due = timers.splice(0); for (const x of due) { now = Math.max(now, x.at); x.fn(); } };
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 7, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="pacman"');
    act("pacman-start");
    expect(session.pacman?.key).toBe(task.id);
    expect(session.pacman?.running).toBe(true);
    expect(out()).toContain('data-action="pacman-turn" data-dir="up"');
    const x0 = session.pacman!.you.x;
    runTimers();
    expect(session.pacman!.you.x).toBeLessThan(x0);
    act("pacman-turn", { dir: "right" });
    expect(session.pacman!.you.dir).toBe("right");
    // caught: Kuro's offer; he eats the lines
    session.pacman = { ...session.pacman!, over: true, running: false };
    expect(out()).toContain(`data-action="pacman-assist">${t("settle.kuro")}</button>`);
    act("pacman-assist");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 7, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("pacman.stage.won"));
    now += 6000;
    expect(out()).toContain('data-screen="meeting"');
  });
});
