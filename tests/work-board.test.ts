// Work v2 (2026-11-03): a task is a board — gather, use an old object, assemble into a result that
// lands on the desk and is handed to the hand at night; one SAN judgement a night, never up. Uses
// the day-7 task4 fixture (.kiro/specs/work-v2/board-day07.json); the loader is tested directly, and
// the board/desk/judgement end to end with the fixture injected as day-7 task4.
import { describe, expect, it, vi } from "vitest";
import fixture from "../.kiro/specs/work-v2/board-day07.json";
import tasks07 from "@content/tasks/day-07.json";

/** The fixture wrapped as a full task (what Claude will add to content/tasks/day-07.json). */
const boardTask = () => ({
  id: "task4",
  title: "对比一下。明天早上要。",
  app: "docs",
  done: "task_d7_4",
  board: structuredClone(fixture.board),
  deliverable: structuredClone(fixture.deliverable),
  judge: structuredClone(fixture.judge),
});

/** A day-7 task file whose task4 is the board (the other three tasks unchanged). */
function boardDay07() {
  const raw = structuredClone(tasks07) as any;
  raw.tasks = raw.tasks.map((t: any) => (t.id === "task4" ? boardTask() : t));
  return raw;
}

// ——— 1. the loader (pure; no mock) ———

import { parseTaskFile } from "@state/days/tasks";

describe("the loader accepts the board and rejects bad shapes", () => {
  it("accepts the fixture board, deliverable and judge", () => {
    const parsed = parseTaskFile(boardDay07(), "day-07.json");
    const t4 = parsed.tasks.find((t) => t.id === "task4")!;
    expect(t4.board!.kind).toBe("table");
    expect(t4.board!.slots).toHaveLength(6);
    expect(t4.board!.given.lock).toMatchObject({ object: "pager", answer: "0414" });
    expect(t4.deliverable).toMatchObject({ id: "d7-compare", label: "一叠对比表" });
    expect(t4.judge).toEqual({ perfect: 0, flawed: -3, wrong: -8, wrongAt: 2 });
  });

  const parseWith = (mut: (b: any) => void) => () => {
    const raw = boardDay07();
    const t4 = raw.tasks.find((t: any) => t.id === "task4");
    mut(t4);
    return parseTaskFile(raw, "day-07.json");
  };

  it("rejects an unknown board key", () => {
    expect(parseWith((t) => (t.board.extra = 1))).toThrow(/unknown key "extra"/);
  });
  it("rejects a slot answer that is not a card", () => {
    expect(parseWith((t) => (t.board.slots[0].answer = "nope"))).toThrow(/is not a card/);
  });
  it("rejects a kuro.fill card that is neither a tray card nor a Kuro card", () => {
    expect(parseWith((t) => (t.board.kuro.fill.r1 = "zzz"))).toThrow(/not a card or a Kuro card/);
  });
  it("accepts a kuro.fill that points at a Kuro card (r6 → k1)", () => {
    expect(parseWith(() => {})).not.toThrow();
    const t4 = parseTaskFile(boardDay07(), "day-07.json").tasks.find((t) => t.id === "task4")!;
    expect(t4.board!.kuro.fill.r6).toBe("k1");
  });
  it("rejects a lock answer that is not one of its codes", () => {
    expect(parseWith((t) => (t.board.given.lock.answer = "9999"))).toThrow(/is not one of the codes/);
  });
});

// ——— 2–6: the board, the desk, the judgement (fixture injected as day-7 task4) ———

// The factory is hoisted above the imports, so it loads the fixture and day-7 itself and injects the
// board as day-7 task4 (real content has the tree; Claude swaps it in after this lands).
vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/work-v2/board-day07.json")).default as any;
  const d7 = (await import("@content/tasks/day-07.json")).default as any;
  const raw = structuredClone(d7);
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task4"
      ? { id: "task4", title: "对比一下。明天早上要。", app: "docs", done: "task_d7_4", board: structuredClone(fx.board), deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) }
      : t,
  );
  const parsed = real.parseTaskFile(raw, "day-07.json");
  const boardT = parsed.tasks.find((t: any) => t.id === "task4")!;
  const files = new Map(real.taskFiles);
  files.set(7, parsed.tasks);
  return {
    ...real,
    taskFiles: files,
    taskByFlag: (day: number, flag: string) => (day === 7 && flag === "task_d7_4" ? boardT : real.taskByFlag(day, flag)),
  };
});

import { createStore, type Store } from "@state/store";
import { boardState, canPrint, boardJudgement, deliverableOnDesk, printedBoard, trayCards, wrongCount } from "@state/days/board";
import { taskByFlag } from "@state/days/tasks";

const RIGHT: Record<string, string> = { r1: "c1", r2: "c2", r3: "c3", r4: "c4", r5: "c5", r6: "c6" };
const board = () => taskByFlag(7, "task_d7_4")!.board!;

/** A store at day 7 with the pager found (so the lock's object is available), and recognised. */
function day7(withPager = true): Store {
  const store = createStore({ runId: "r", startDay: 7 });
  if (withPager) {
    store.appendEvent({ kind: "openLayer", objectId: "pager" });
    store.appendEvent({ kind: "recognise", objectId: "pager", option: 0 }); // option 0 may be wrong; found is what matters
  }
  return store;
}
const step = (store: Store, op: any) => store.appendEvent({ kind: "boardStep", taskId: "task4", op });
const fillAllRight = (store: Store) => {
  for (const [slot, card] of Object.entries(RIGHT)) step(store, { t: "fill", slot, card });
};

describe("the lock", () => {
  it("with the pager found, a wrong code keeps it locked, the right one opens it", () => {
    const store = day7(true);
    step(store, { t: "unlock", code: "7734" }); // wrong
    expect(boardState(board(), 7, "task4", store.getEvents()).unlocked).toBe(false);
    step(store, { t: "unlock", code: "0414" }); // right
    expect(boardState(board(), 7, "task4", store.getEvents()).unlocked).toBe(true);
  });

  it("without the pager, 让它试 opens it and counts one assist", () => {
    const store = day7(false);
    step(store, { t: "assistUnlock" });
    const s = boardState(board(), 7, "task4", store.getEvents());
    expect(s.unlocked).toBe(true);
    expect(s.assists).toBe(1);
  });
});

describe("filling and print", () => {
  it("print is disabled until all six slots are filled and the lock is open", () => {
    const store = day7(true);
    const b = board();
    expect(canPrint(b, boardState(b, 7, "task4", store.getEvents()))).toBe(false);
    fillAllRight(store); // filled, but still locked
    expect(canPrint(b, boardState(b, 7, "task4", store.getEvents()))).toBe(false);
    step(store, { t: "unlock", code: "0414" });
    expect(canPrint(b, boardState(b, 7, "task4", store.getEvents()))).toBe(true);
  });

  it("printing logs the task done with slots and assists; the deliverable is on the desk", () => {
    const store = day7(true);
    step(store, { t: "unlock", code: "0414" });
    fillAllRight(store);
    const s = boardState(board(), 7, "task4", store.getEvents());
    store.appendEvent({ kind: "task", flag: "task_d7_4", mode: s.assists > 0 ? "let" : "self", slots: { ...s.slots }, assists: s.assists });
    expect(store.getState().flags).toContain("task_d7_4");
    const printed = printedBoard(7, store.getEvents())!;
    expect(printed.slots).toEqual(RIGHT);
    const d = deliverableOnDesk(7, store.getEvents());
    expect(d).toMatchObject({ id: "d7-compare" });
  });
});

describe("让它补全", () => {
  it("fills every empty slot as kuro.fill says (r6 gets k1) and opens the lock", () => {
    const store = day7(true);
    step(store, { t: "assistFill" });
    const s = boardState(board(), 7, "task4", store.getEvents());
    expect(s.unlocked).toBe(true);
    expect(s.slots).toEqual({ r1: "c1", r2: "c2", r3: "c3", r4: "c4", r5: "c5", r6: "k1" });
    expect(s.assists).toBe(1);
  });

  it("sending k1 back removes it from the board, not into the tray", () => {
    const store = day7(true);
    step(store, { t: "assistFill" });
    step(store, { t: "clear", slot: "r6" });
    const b = board();
    const s = boardState(b, 7, "task4", store.getEvents());
    expect("r6" in s.slots).toBe(false);
    // k1 is a Kuro card: it never appears in the tray (the tray is the board's own cards, minus placed).
    expect(trayCards(b, s)).not.toContain("k1");
  });
});

describe("the judgement (never up)", () => {
  // Print with the given slots, optionally give the deliverable, then read the judgement.
  const run = (slots: Record<string, string>, give: boolean, mode: "self" | "let" = "self") => {
    const store = day7(true);
    step(store, { t: "unlock", code: "0414" });
    store.appendEvent({ kind: "task", flag: "task_d7_4", mode, slots, assists: mode === "let" ? 1 : 0 });
    if (give) store.appendEvent({ kind: "give", deliverableId: "d7-compare" });
    return { store, verdict: boardJudgement(7, store.getEvents()) };
  };

  it("all right and given → SAN unchanged (perfect, 0)", () => {
    const { verdict } = run(RIGHT, true);
    expect(verdict).toEqual({ verdict: "perfect", san: 0 });
  });

  it("k1 kept → flawed (−3)", () => {
    const { verdict } = run({ ...RIGHT, r6: "k1" }, true, "let");
    expect(wrongCount(board(), { ...RIGHT, r6: "k1" })).toBe(1);
    expect(verdict).toEqual({ verdict: "flawed", san: -3 });
  });

  it("three wrong → wrong (−8)", () => {
    const { verdict } = run({ ...RIGHT, r4: "d1", r5: "d2", r6: "k1" }, true);
    expect(verdict).toEqual({ verdict: "wrong", san: -8 });
  });

  it("printed but not given by 躺下 → wrong (−8)", () => {
    const { verdict } = run(RIGHT, false);
    expect(verdict).toEqual({ verdict: "wrong", san: -8 });
  });

  it("the boardJudge event lowers SAN and never raises it", () => {
    const store = day7(true);
    const san0 = store.getState().san;
    store.appendEvent({ kind: "boardJudge", verdict: "flawed", san: -3 });
    expect(store.getState().san).toBe(san0 - 3);
    // A perfect (0) never moves it; a positive delta is rejected by the reducer.
    expect(() => store.appendEvent({ kind: "boardJudge", verdict: "perfect", san: 1 })).toThrow(/<= 0/);
  });
});

describe("replay", () => {
  it("the same log rebuilds the same board, desk and SAN", () => {
    const build = () => {
      const store = day7(true);
      step(store, { t: "unlock", code: "0414" });
      fillAllRight(store);
      const s = boardState(board(), 7, "task4", store.getEvents());
      store.appendEvent({ kind: "task", flag: "task_d7_4", mode: "self", slots: { ...s.slots }, assists: 0 });
      store.appendEvent({ kind: "boardJudge", verdict: "wrong", san: -8 });
      return store;
    };
    const a = build();
    const b = build();
    expect(a.getState()).toEqual(b.getState());
    expect(boardState(board(), 7, "task4", a.getEvents())).toEqual(boardState(board(), 7, "task4", b.getEvents()));
    expect(deliverableOnDesk(7, a.getEvents())).toEqual(deliverableOnDesk(7, b.getEvents()));
  });
});


