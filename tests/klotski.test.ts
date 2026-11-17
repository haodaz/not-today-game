// game-swaps §1: day 17's 回电话 as klotski (华容道). The fixture is day 17's `work` board with the
// klotski game in place of its old one (built here, never in content/). The parser accepts it and
// rejects two N; the stage shows with r2–r4 filled; a push into a wall is no move; 老王 out in 8
// writes r1 = d1 then approve and grades wrong; 青禾 out in 19 is perfect, in 51 flawed; 退一步
// restores; the tentacle comes in after the exit.
import "./specimen";
import { describe, expect, it, vi } from "vitest";

const KLOTSKI = vi.hoisted(() => ({
  kind: "klotski",
  slot: "r1",
  level: ["xNNy", "xNNy", "AABB", "CCDD", "s..t"],
  blocks: { A: { card: "c1", label: "青禾" }, B: { card: "k1", label: "克总" }, C: { card: "d1", label: "老王" }, D: { card: "d2", label: "Vivi" } },
}));

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const raw = structuredClone((await import("@content/tasks/day-17.json")).default as any);
  raw.tasks = raw.tasks.map((t: any) => (t.id === "work" ? { ...t, board: { ...t.board, game: structuredClone(KLOTSKI) } } : t));
  const parsed = real.parseTaskFile(raw, "day-17.json");
  const files = new Map(real.taskFiles);
  files.set(17, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => files.get(day)?.find((x: any) => x.done === flag) };
});

import day17 from "@content/tasks/day-17.json";
import { parseTaskFile, taskByFlag, type BoardGame } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { workLayer } from "@world/desktop/workbench/compare";
import { gradeGame } from "@world/desktop/workbench/grades";
import { KLOTSKI_DONE_MS, KLOTSKI_SLIDE_MS, klotskiPath, klotskiPush, klotskiStart, klotskiUndo, type KlotskiStep } from "@world/desktop/workbench/klotski";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

type Game = Extract<BoardGame, { kind: "klotski" }>;
const FLAG = "task_d17_work";

function rig() {
  setLocale("zh");
  const store = createStore({ startDay: 17 });
  completeUntil(store, "desk", { skip: ["work"] });
  const task = taskByFlag(17, FLAG)!;
  const board = task.board!;
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  session.workShow = `17:${task.id}`;
  const clock = { now: 1000 };
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => clock.now };
  const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: clock.now })?.value ?? "";
  const fillOthers = () => {
    if (board.given.lock) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock.answer } });
    for (const slot of board.slots.filter((x) => x.id !== "r1")) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
  };
  return { store, task, board, session, clock, act, out, fillOthers };
}

/** The steps as push actions only (the pick set per push through data-block). */
function playPushes(r: ReturnType<typeof rig>, steps: readonly KlotskiStep[]): void {
  for (const s of steps) r.act("klotski-push", { dir: s.dir, block: s.id });
}

describe("klotski: the parser", () => {
  it("accepts the fixture and rejects a level with two N", () => {
    const game = taskByFlag(17, FLAG)!.board!.game as Game;
    expect(game.kind).toBe("klotski");
    expect(game.slot).toBe("r1");
    expect(game.blocks.C).toEqual({ card: "d1", label: "老王" });
    const raw = structuredClone(day17 as any);
    raw.tasks = raw.tasks.map((t: any) => (t.id === "work" ? { ...t, board: { ...t.board, game: { ...KLOTSKI, level: ["xNNy", "xNNy", "AABB", "CCDD", "NN.t"] } } } : t));
    expect(() => parseTaskFile(raw, "day-17.json")).toThrow();
  });
});

describe("klotski: the engine", () => {
  it("a push into a wall or a block is no move; 退一步 restores", () => {
    const game = taskByFlag(17, FLAG)!.board!.game as Game;
    const g = klotskiStart("t", game);
    // x stands at the left wall: left is a wall, right is the big block
    expect(klotskiPush(g, "left", 0, "x")).toBe(g);
    expect(klotskiPush(g, "right", 0, "x")).toBe(g);
    expect(klotskiPush(g, "up", 0, "N")).toBe(g);
    // s moves right into the empty cell
    const moved = klotskiPush(g, "right", 0, "s");
    expect(moved).not.toBe(g);
    expect(moved.moves).toBe(1);
    expect(moved.blocks.find((b) => b.id === "s")).toMatchObject({ x: 1, y: 4 });
    const back = klotskiUndo(moved);
    expect(back.blocks).toEqual(g.blocks);
  });
  it("the fewest pushes: 老王 and Vivi 8, 青禾 and 克总 19, the big block never", () => {
    const game = taskByFlag(17, FLAG)!.board!.game as Game;
    expect(klotskiPath(game, "C")).toHaveLength(8);
    expect(klotskiPath(game, "D")).toHaveLength(8);
    expect(klotskiPath(game, "A")).toHaveLength(19);
    expect(klotskiPath(game, "B")).toHaveLength(19);
    expect(klotskiPath(game, "N")).toBeNull();
  });
});

describe("klotski: the stage", () => {
  it("shows with r2–r4 filled and r1 empty; 老王 out in 8 writes r1 = d1 then approve and grades wrong; the tentacle after the slide", () => {
    const r = rig();
    expect(r.out()).not.toContain('data-screen="klotski"');
    r.fillOthers();
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBeUndefined();
    expect(r.out()).toContain('data-screen="klotski"');
    expect(r.out()).toContain('data-action="klotski-start"');
    r.act("klotski-start");
    expect(r.out()).toContain(">老王<");
    // a push into the wall: no move
    r.act("klotski-pick", { block: "x" });
    r.act("klotski-push", { dir: "left" });
    expect(r.session.klotski!.moves).toBe(0);
    playPushes(r, klotskiPath(r.board.game as Game, "C")!);
    expect(r.session.klotski!.done).toBe(true);
    expect(r.session.klotski!.moves).toBe(8);
    const steps = r.store.getEvents().filter((e) => e.kind === "boardStep").slice(-2);
    expect(steps[0]).toMatchObject({ op: { t: "fill", slot: "r1", card: "d1" } });
    expect(steps[1]).toMatchObject({ op: { t: "approve" } });
    expect(canPrint(r.board, boardState(r.board, 17, r.task.id, r.store.getEvents()))).toBe(true);
    expect(gradeGame(r.board, r.task.id, 17, r.session, r.store.getEvents())).toBe("wrong");
    expect(r.out()).toContain(t("klotski.stage.won", { name: "老王" }));
    expect(r.out()).not.toContain("kl-tentacle");
    r.clock.now += KLOTSKI_SLIDE_MS;
    expect(r.out()).toContain("kl-tentacle");
    r.clock.now += KLOTSKI_DONE_MS;
    expect(r.out()).not.toContain('data-screen="klotski"');
  });
  it("青禾 out in 19 grades perfect; in 51 flawed; 重排 over a board under way is a fail", () => {
    const r = rig();
    r.fillOthers();
    r.act("klotski-start");
    playPushes(r, klotskiPath(r.board.game as Game, "A")!);
    expect(r.session.klotski!.moves).toBe(19);
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBe("c1");
    expect(gradeGame(r.board, r.task.id, 17, r.session, r.store.getEvents())).toBe("perfect");

    const r2 = rig();
    r2.fillOthers();
    r2.act("klotski-start");
    // a few pushes, then 重排: a fail, and the count starts again
    for (let i = 0; i < 4; i++) r2.act("klotski-push", { dir: i % 2 === 0 ? "right" : "left", block: "s" });
    r2.act("klotski-start");
    expect(r2.session.gameTally!.fails).toBe(1);
    expect(r2.session.klotski!.moves).toBe(0);
    // 32 pushes that lead nowhere (s right and back), then the 19. Any way back to a position takes an
    // even number of pushes, so the spec's "50" is 51 here: the same grade band.
    for (let i = 0; i < 32; i++) r2.act("klotski-push", { dir: i % 2 === 0 ? "right" : "left", block: "s" });
    playPushes(r2, klotskiPath(r2.board.game as Game, "A")!);
    expect(r2.session.klotski!.moves).toBe(51);
    expect(gradeGame(r2.board, r2.task.id, 17, r2.session, r2.store.getEvents())).toBe("flawed");
  });
  it("Kuro's fill in r1 is overwritten by the block that goes out", () => {
    const r = rig();
    r.fillOthers();
    r.store.appendEvent({ kind: "boardStep", taskId: r.task.id, op: { t: "fill", slot: "r1", card: "k1" } });
    expect(r.out()).toContain('data-screen="klotski"');
    r.act("klotski-start");
    playPushes(r, klotskiPath(r.board.game as Game, "D")!);
    expect(boardState(r.board, 17, r.task.id, r.store.getEvents()).slots.r1).toBe("d2");
  });
});
