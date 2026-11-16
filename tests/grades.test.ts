// meters-v2 §1: every game grades its own play — one test per engine on a built session, the printed
// task event carrying `quality`, and the settlement's line.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { boardState } from "@state/days/board";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { boardActions } from "@world/desktop/workbench/board";
import { gradedInLog, gradeGame } from "@world/desktop/workbench/grades";
import { freshTally, type GameTally } from "@world/desktop/workbench/tally";
import { qualityLine } from "@world/desktop/workbench/settle-sheet";
import { grade as link } from "@world/desktop/workbench/link";
import { grade as match3 } from "@world/desktop/workbench/match3";
import { grade as snake } from "@world/desktop/workbench/snake";
import { grade as pacman } from "@world/desktop/workbench/pacman";
import { grade as mines } from "@world/desktop/workbench/mines";
import { grade as sokoban, sokobanMove, sokobanPar, sokobanStart, type SokobanGame } from "@world/desktop/workbench/sokoban";
import { grade as spot } from "@world/desktop/workbench/spot";
import { grade as tetris, tetrisNearTop } from "@world/desktop/workbench/tetris";
import { grade as pipes, pipesLeaks, pipesSolve, pipesStart, pipesRoll } from "@world/desktop/workbench/pipes";
import { grade as moles } from "@world/desktop/workbench/moles";
import { grade as rhythm } from "@world/desktop/workbench/rhythm";
import { grade as gacha } from "@world/desktop/workbench/gacha";
import { grade as fill } from "@world/desktop/workbench/fill";
import { grade as chain } from "@world/desktop/workbench/stack-stage";
import { completeUntil } from "./complete-items";

setLocale("zh");
const tally = (over: Partial<GameTally> = {}): GameTally => ({ ...freshTally("t"), ...over });

describe("each engine's grade", () => {
  it("link: mistaken pairs 0 / ≤ 2 / more; Kuro's help at best flawed", () => {
    expect(link({ done: true }, tally())).toBe("perfect");
    expect(link({ done: true }, tally({ mistakes: 2 }))).toBe("flawed");
    expect(link({ done: true }, tally({ mistakes: 3 }))).toBe("wrong");
    expect(link({ done: true }, tally({ assisted: true }))).toBe("flawed");
  });
  it("match3: ≥ 3 moves left / cleared / ran out or assisted", () => {
    expect(match3({ won: true, moves: 3 }, tally())).toBe("perfect");
    expect(match3({ won: true, moves: 1 }, tally())).toBe("flawed");
    expect(match3({ won: false, moves: 0 }, tally())).toBe("wrong");
    expect(match3({ won: true, moves: 9 }, tally({ assisted: true }))).toBe("wrong");
  });
  it("snake: no death / one / more", () => {
    expect(snake({ done: true, over: false }, tally())).toBe("perfect");
    expect(snake({ done: true, over: false }, tally({ fails: 1 }))).toBe("flawed");
    expect(snake({ done: true, over: false }, tally({ fails: 2 }))).toBe("wrong");
  });
  it("pacman: all lines and no hit / hit once / otherwise", () => {
    expect(pacman({ done: true, over: false }, tally())).toBe("perfect");
    expect(pacman({ done: true, over: false }, tally({ fails: 1 }))).toBe("flawed");
    expect(pacman({ done: false, over: true }, tally())).toBe("wrong");
  });
  it("mines: no mine / one / more", () => {
    expect(mines({ won: true, over: false }, tally())).toBe("perfect");
    expect(mines({ won: true, over: true }, tally({ assisted: true }))).toBe("flawed");
    expect(mines({ won: true, over: false }, tally({ fails: 2 }))).toBe("wrong");
  });
  it("sokoban: ≤ par / ≤ par × 1.5 / more", () => {
    const game = { kind: "sokoban" as const, level: ["#####", "#@$.#", "#   #", "#####"] };
    expect(sokobanPar(game)).toBe(1);
    const won = sokobanMove(sokobanStart("t", game), "right");
    expect(won.done).toBe(true);
    expect(sokoban(won, game)).toBe("perfect");
    const long = { ...won, moves: 5 } as SokobanGame;
    expect(sokoban(long, game)).toBe("wrong");
    const par3 = { kind: "sokoban" as const, level: ["#######", "#@ $ .#", "#######"] };
    expect(sokobanPar(par3)).toBe(3);
    expect(sokoban({ done: true, moves: 4 }, par3)).toBe("flawed");
  });
  it("spot: 0 misses / ≤ 3 / more", () => {
    expect(spot(null)).toBe("perfect");
    expect(spot({ n: 3 })).toBe("flawed");
    expect(spot({ n: 4 })).toBe("wrong");
  });
  it("tetris: never near the top / near it / topped out or assisted", () => {
    expect(tetris({ done: true, nearTop: false }, tally())).toBe("perfect");
    expect(tetris({ done: true, nearTop: true }, tally())).toBe("flawed");
    expect(tetris({ done: true }, tally({ fails: 1 }))).toBe("wrong");
    expect(tetris({ done: true }, tally({ assisted: true }))).toBe("wrong");
    expect(tetrisNearTop({ cols: 3, cells: [0, 0, 0, 0, 1, 0, 0, 0, 0] })).toBe(true);
    expect(tetrisNearTop({ cols: 3, cells: [0, 0, 0, 0, 0, 0, 1, 0, 0] })).toBe(false);
  });
  it("pipes: the solved grid's leaks decide it", () => {
    const solved = pipesSolve(pipesStart("t", { kind: "pipes", cols: 6, rows: 4 }, pipesRoll("run", "t", 0)));
    expect(solved.done).toBe(true);
    const leaks = pipesLeaks(solved);
    expect(pipes(solved)).toBe(leaks === 0 ? "perfect" : leaks === 1 ? "flawed" : "wrong");
    expect(pipes({ ...solved, done: false })).toBe("wrong");
  });
  it("moles: ≥ 90 % / ≥ 70 % / less", () => {
    const pops = (hit: number, of: number) => Array.from({ length: of }, (_, i) => ({ seat: 0, t: 0, dur: 1, page: 0, hit: i < hit }));
    expect(moles({ done: true, pops: pops(9, 10) })).toBe("perfect");
    expect(moles({ done: true, pops: pops(7, 10) })).toBe("flawed");
    expect(moles({ done: true, pops: pops(6, 10) })).toBe("wrong");
  });
  it("rhythm: ≤ 2 misses / ≤ 6 / more", () => {
    const notes = (miss: number) => Array.from({ length: 20 }, (_, i) => ({ t: i, word: "w", bar: 0, hit: i < miss ? ("miss" as const) : ("good" as const) }));
    expect(rhythm({ done: true, notes: notes(2) })).toBe("perfect");
    expect(rhythm({ done: true, notes: notes(6) })).toBe("flawed");
    expect(rhythm({ done: true, notes: notes(7) })).toBe("wrong");
  });
  it("gacha: ≤ 3 pulls / ≤ 6 / more", () => {
    expect(gacha({ opened: true }, tally({ starts: 3 }))).toBe("perfect");
    expect(gacha({ opened: true }, tally({ starts: 6 }))).toBe("flawed");
    expect(gacha({ opened: true }, tally({ starts: 7 }))).toBe("wrong");
  });
  it("fill: Kuro's fill wrong, the player's own perfect", () => {
    expect(fill({ done: true, kuro: false })).toBe("perfect");
    expect(fill({ done: true, kuro: true })).toBe("wrong");
  });
  it("the chain (day 13): 2048 / 1024 / less", () => {
    const cells = (top: number) => [top, ...Array(15).fill(0)];
    expect(chain({ cells: cells(2048) })).toBe("perfect");
    expect(chain({ cells: cells(1024) })).toBe("flawed");
    expect(chain({ cells: cells(512) })).toBe("wrong");
  });
});

describe("the printed task event and the settlement", () => {
  it("day 8 mines: a loss and a restart, then won → the task event carries flawed; the line reads it", () => {
    const task = taskByFlag(8, "task_d8_1")!;
    const store = createStore({ startDay: 8 });
    completeUntil(store, "task1");
    const b = task.board!;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: b.given.lock!.answer } });
    for (const sl of b.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: sl.id, card: sl.answer } });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (n: string) => boardActions[n]!(ctx, {} as DOMStringMap, null as never);
    if (b.game?.kind !== "mines") return;
    act("mines-start");
    session.mines = { ...session.mines!, over: true };
    act("mines-start");
    expect(session.gameTally).toMatchObject({ key: task.id, starts: 2, fails: 1 });
    act("mines-cheat");
    expect(boardState(b, 8, task.id, store.getEvents()).approved).toBe(true);
    expect(gradeGame(b, task.id, 8, session)).toBe("flawed");
    act("board-print");
    expect(store.getEvents().find((e) => e.kind === "task" && e.flag === task.done)).toMatchObject({ quality: "flawed" });
    expect(qualityLine("flawed")!.value).toBe(`<p class="sl-quality flawed">${t("settle.quality.flawed")}</p>`);
    expect(qualityLine(null)).toBeNull();
  });
});

// game-grade-log: the grade goes into the log as the play goes, so a reload before 提交 keeps it.
describe("the graded event", () => {
  const setup = () => {
    const task = taskByFlag(8, "task_d8_1")!;
    const store = createStore({ startDay: 8 });
    completeUntil(store, "task1");
    const b = task.board!;
    expect(b.game?.kind).toBe("mines");
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: b.given.lock!.answer } });
    for (const sl of b.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: sl.id, card: sl.answer } });
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (n: string) => boardActions[n]!(ctx, {} as DOMStringMap, null as never);
    const graded = () => store.getEvents().filter((e) => e.kind === "graded").map((e) => (e as { task: string; quality: string; day: number }));
    return { task, store, b, session, act, graded };
  };
  /** What a reload leaves: the session is new, the log is the same. */
  const reload = (session: ReturnType<typeof initialSession>) => {
    session.mines = null;
    session.gameTally = null;
  };

  it("a win writes perfect; the same grade twice writes one event", () => {
    const { task, act, graded } = setup();
    act("mines-start");
    expect(graded()).toEqual([{ kind: "graded", day: 8, task: task.id, quality: "wrong" }]);
    act("mines-cheat");
    act("mines-cheat"); // already approved: the grade stays perfect, nothing more is written
    expect(graded().map((e) => e.quality)).toEqual(["wrong", "perfect"]);
    expect(gradedInLog(graded() as never, 8, task.id)).toBe("perfect");
    expect(gradedInLog(graded() as never, 9, task.id)).toBeNull();
    expect(gradedInLog(graded() as never, 8, "other")).toBeNull();
  });

  it("a restart after a loss writes wrong once; the win after it flawed", () => {
    const { act, session, graded } = setup();
    act("mines-start");
    session.mines = { ...session.mines!, over: true };
    act("mines-start");
    expect(graded().map((e) => e.quality)).toEqual(["wrong"]);
    act("mines-cheat");
    expect(graded().map((e) => e.quality)).toEqual(["wrong", "flawed"]);
  });

  it("the session gone: gradeGame reads the log's last grade; with neither, null; the session wins while it exists", () => {
    const { task, b, store, session, act } = setup();
    expect(gradeGame(b, task.id, 8, session, store.getEvents())).toBeNull();
    act("mines-start");
    session.mines = { ...session.mines!, over: true };
    act("mines-start");
    act("mines-cheat");
    reload(session);
    expect(gradeGame(b, task.id, 8, session, store.getEvents())).toBe("flawed");
    expect(gradeGame(b, task.id, 8, session)).toBeNull(); // no log given: nothing to read
    session.mines = { key: task.id, won: true, over: false } as never; // a session again: it wins over the log
    expect(gradeGame(b, task.id, 8, session, store.getEvents())).toBe("perfect");
  });

  it("printBoard's task event carries the log's grade after the session is cleared", () => {
    const { task, store, session, act } = setup();
    act("mines-start");
    session.mines = { ...session.mines!, over: true };
    act("mines-start");
    act("mines-cheat");
    reload(session);
    act("board-print");
    expect(store.getEvents().find((e) => e.kind === "task" && e.flag === task.done)).toMatchObject({ quality: "flawed" });
  });
});
