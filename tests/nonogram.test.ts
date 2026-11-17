// game-swaps §3: day 12's side task 对账结果看一眼 as nonogram (数织), the first side game on a plain
// task. The fixture is day 12's `task1` with the game (built here, never in content/). The clues
// derive right; a wrong fill counts and clears itself; 自己做 opens the stage instead of completing;
// the solved grid's hand-in runs the self branch with the grade; 让它做 skips the stage.
import "./specimen";
import { describe, expect, it, vi } from "vitest";

const NONO = vi.hoisted(() => ({ kind: "nonogram", picture: ["#...#", ".###.", "##.##", ".###.", "#...#"] }));

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const raw = structuredClone((await import("@content/tasks/day-12.json")).default as any);
  raw.tasks = raw.tasks.map((t: any) => (t.id === "task1" ? { ...t, game: structuredClone(NONO) } : t));
  const parsed = real.parseTaskFile(raw, "day-12.json");
  const files = new Map(real.taskFiles);
  files.set(12, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => files.get(day)?.find((x: any) => x.done === flag) };
});

import day12 from "@content/tasks/day-12.json";
import { nonogramRuns, parseTaskFile, taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { workLayer } from "@world/desktop/workbench/compare";
import { gameRunning } from "@world/desktop/workbench/work-mode";
import { NONO_FLASH_MS, NONO_REVEAL_MS } from "@world/desktop/workbench/nonogram";
import { loopActions } from "@world/room/game";
import type { ChipId } from "@world/sound/chip";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const FLAG = "task_d12_1";

function rig() {
  setLocale("zh");
  const store = createStore({ startDay: 12 });
  completeUntil(store, "desk", { skip: ["task1"] });
  const task = taskByFlag(12, FLAG)!;
  const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
  const clock = { now: 1000 };
  const played: ChipId[] = [];
  const ctx = { store, session, rerender: () => {}, later: () => {}, now: () => clock.now, chip: (id: ChipId) => void played.push(id) } as ActionContext;
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: clock.now })?.value ?? "";
  const tasks = () => store.getEvents().filter((e) => e.kind === "task" && e.flag === FLAG);
  return { store, task, session, clock, act, out, tasks, played };
}

/** The `#` cells of the picture, row by row. */
const ink = NONO.picture.flatMap((row, y) => [...row].map((ch, x) => (ch === "#" ? y * 5 + x : -1))).filter((i) => i >= 0);

describe("nonogram: the parser", () => {
  it("derives the clues from the picture; rejects a ragged picture", () => {
    const game = taskByFlag(12, FLAG)!.game!;
    expect(game.kind).toBe("nonogram");
    expect(game.rows).toEqual([[1, 1], [3], [2, 2], [3], [1, 1]]);
    expect(game.cols).toEqual([[1, 1, 1], [3], [1, 1], [3], [1, 1, 1]]);
    expect(nonogramRuns([false, true, true, false, true])).toEqual([2, 1]);
    expect(nonogramRuns([false, false])).toEqual([]);
    const raw = structuredClone(day12 as any);
    raw.tasks = raw.tasks.map((t: any) => (t.id === "task1" ? { ...t, game: { kind: "nonogram", picture: ["#..", "##", "..#"] } } : t));
    expect(() => parseTaskFile(raw, "day-12.json")).toThrow();
  });
});

describe("nonogram: the side game", () => {
  it("自己做 opens the stage instead of completing; a wrong fill counts and clears; solved, the hand-in runs self with the grade", () => {
    const r = rig();
    r.act("wb-send");
    r.act("wb-choose", { mode: "self" });
    expect(r.tasks()).toHaveLength(0);
    expect(r.session.workShow).toBe(`12:${r.task.id}`);
    expect(gameRunning(r.store.getState(), r.store.getEvents(), r.session)).toBe(true);
    expect(r.out()).toContain('data-screen="nonogram"');
    expect(r.out()).toContain(t("nonogram.stage.hint"));
    r.act("nonogram-start");
    // a wrong fill: counted, flashing, cleared
    r.act("nonogram-tap", { i: "1" });
    expect(r.session.nonogram!.mistakes).toBe(1);
    expect(r.session.nonogram!.filled[1]).toBe(false);
    expect(r.out()).toContain("ng-cell bad");
    expect(r.out()).toContain(t("nonogram.stage.mistakes", { n: "1" }));
    expect(r.played.at(-1)).toBe("wrong");
    r.clock.now += NONO_FLASH_MS;
    expect(r.out()).not.toContain("ng-cell bad");
    // a right fill, cleared again, filled again
    r.act("nonogram-tap", { i: "0" });
    expect(r.session.nonogram!.filled[0]).toBe(true);
    expect(r.out()).toContain(t("nonogram.stage.sub"));
    r.act("nonogram-tap", { i: "0" });
    expect(r.session.nonogram!.filled[0]).toBe(false);
    for (const i of ink) r.act("nonogram-tap", { i: String(i) });
    expect(r.session.nonogram!.done).toBe(true);
    expect(r.played.at(-1)).toBe("clear");
    expect(r.out()).toContain("ng-board solved");
    // the picture alone for a moment: no hand-in yet
    expect(r.out()).not.toContain('data-action="nonogram-hand"');
    r.act("nonogram-hand");
    expect(r.tasks()).toHaveLength(0);
    r.clock.now += NONO_REVEAL_MS;
    expect(r.out()).toContain(t("nonogram.stage.won"));
    expect(r.out()).toContain('data-action="nonogram-hand"');
    r.act("nonogram-hand");
    expect(r.tasks()).toEqual([expect.objectContaining({ kind: "task", flag: FLAG, mode: "self", quality: "flawed" })]);
    const flags = r.store.getState().flags;
    expect(flags).toContain("task_d12_1");
    expect(flags).toContain("fought_3");
    expect(r.out()).toBe("");
    expect(gameRunning(r.store.getState(), r.store.getEvents(), r.session)).toBe(false);
  });
  it("no mistakes grades perfect", () => {
    const r = rig();
    r.act("wb-send");
    r.act("wb-choose", { mode: "self" });
    r.act("nonogram-start");
    for (const i of ink) r.act("nonogram-tap", { i: String(i) });
    r.clock.now += NONO_REVEAL_MS;
    r.act("nonogram-hand");
    expect(r.tasks().at(-1)).toMatchObject({ quality: "perfect" });
  });
  it("让它做 skips the stage", () => {
    const r = rig();
    r.act("wb-send");
    r.act("wb-choose", { mode: "let" });
    expect(r.out()).toBe("");
    expect(r.session.workShow).toBeNull();
    expect(r.tasks()).toEqual([expect.objectContaining({ mode: "let" })]);
    expect(r.tasks()[0]).not.toHaveProperty("quality");
  });
});
