// Three numbers (2026-11-03): assimilation is the new one. Letting Kuro work raises it, not SAN;
// a board's assists and kept Kuro cards raise it; an upgrade raises it; 全员升级 maxes it; doing
// the work yourself no longer gains SAN. It only ever goes up, clamped 0–100. Pure reducer tests.
import { describe, expect, it, vi } from "vitest";

// Inject day-7 so task1 carries an `assimilation: 4` on its `let` path and task4 is the board
// (real content has neither yet; Claude moves the effects after this lands).
vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/work-v2/board-day07.json")).default as any;
  const d7 = (await import("@content/tasks/day-07.json")).default as any;
  const raw = structuredClone(d7);
  raw.tasks = raw.tasks.map((t: any) => {
    if (t.id === "task1") {
      // Move the let path's SAN loss into assimilation (what Claude will do in content).
      t.let.effects = { flags: ["task_d7_1"], assimilation: 4 };
      return t;
    }
    if (t.id === "task4") {
      return { id: "task4", title: "对比一下。明天早上要。", app: "docs", done: "task_d7_4", board: structuredClone(fx.board), deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) };
    }
    return t;
  });
  const parsed = real.parseTaskFile(raw, "day-07.json");
  const files = new Map(real.taskFiles);
  files.set(7, parsed.tasks);
  const byFlag = (day: number, flag: string) => (day === 7 ? parsed.tasks.find((t: any) => t.done === flag) ?? files.get(day)?.find((x: any) => x.done === flag) : files.get(day)?.find((x: any) => x.done === flag));
  return { ...real, taskFiles: files, taskByFlag: byFlag };
});

import { applyTask, clampAssimilation, raiseAssimilation } from "@state/days/effects";
import { applyUpgrade } from "@state/upgrades";
import { f } from "@state/fday";
import type { State } from "@state/types.gen";

const day7 = (): State => f(7);
const at = <T extends object>(day: number, e: T) => ({ ...e, day });

describe("the assimilation helper", () => {
  it("raises, clamps to 0–100, and never goes down", () => {
    expect(clampAssimilation(-5)).toBe(0);
    expect(clampAssimilation(150)).toBe(100);
    const s = { ...day7(), assimilation: 10 };
    expect(raiseAssimilation(s, 4).assimilation).toBe(14);
    expect(raiseAssimilation(s, 0)).toBe(s); // no change, same object
    // Never down: a negative (or over-max subtraction) never lowers it.
    expect(raiseAssimilation(s, -20).assimilation).toBe(10);
    expect(raiseAssimilation({ ...day7(), assimilation: 98 }, 5).assimilation).toBe(100);
  });
});

describe("a path's assimilation", () => {
  it("raises it by 4, never past 100, and leaves SAN alone", () => {
    const s = day7();
    const san0 = s.san;
    const next = applyTask(s, at(7, { kind: "task", flag: "task_d7_1", mode: "let" }));
    expect(next.assimilation).toBe(4);
    expect(next.san).toBe(san0); // SAN untouched by assimilation
    expect(next.flags).toContain("task_d7_1");
    // Applied again on top of 98: clamps at 100.
    const high = applyTask({ ...s, assimilation: 98 }, at(7, { kind: "task", flag: "task_d7_1", mode: "let" }));
    expect(high.assimilation).toBe(100);
  });
});

describe("a board task's assimilation", () => {
  const RIGHT = { r1: "c1", r2: "c2", r3: "c3", r4: "c4", r5: "c5", r6: "c6" };
  it("adds assists × assimAssist and assimKuroCardKept per Kuro card kept (2 assists + k1 = +9)", () => {
    const s = day7();
    const next = applyTask(s, at(7, { kind: "task", flag: "task_d7_4", mode: "let", slots: { ...RIGHT, r6: "k1" }, assists: 2 }));
    expect(next.assimilation).toBe(2 * 3 + 1 * 3); // assimAssist 3, assimKuroCardKept 3
    expect(next.san).toBe(s.san);
  });

  it("no assists, no Kuro card kept → assimilation unchanged", () => {
    const next = applyTask(day7(), at(7, { kind: "task", flag: "task_d7_4", mode: "self", slots: RIGHT, assists: 0 }));
    expect(next.assimilation).toBe(0);
  });
});

describe("an upgrade's assimilation", () => {
  it("one upgrade raises it by assimUpgrade (8)", () => {
    const s = { ...day7(), found: ["chick", "pager"] as State["found"] };
    const next = applyUpgrade(s, { day: 7, object: "pager" });
    expect(next.assimilation).toBe(8);
    expect(next.upgraded.pager).toBe(true);
  });

  it("day 13 is an ordinary day (no 全员升级 any more, 2026-11-06): + assimUpgrade, not the max", () => {
    const s = { ...day7(), day: 13, found: ["chick", "pager", "iccard"] as State["found"], assimilation: 20 };
    const next = applyUpgrade(s, { day: 13, object: "pager" });
    expect(next.assimilation).toBe(28);
  });
});

describe("old saves", () => {
  it("replay to assimilation 0 with no assimilation events", () => {
    // A fresh state has 0; nothing in a pre-three-meters log touches it.
    expect(day7().assimilation).toBe(0);
  });
});

// ——— the collapse ending (SAN ≤ 0) ———

import { dueAtLieDown, dueAtShutdown } from "@state/endings";
import { applyEvent, type EventDraft, type GameEvent } from "@state/events";
import type { Store } from "@state/store";
import { createProfileWriter } from "@state/saves";
import { memoryStorage } from "@state/slot";
import { lieDownOrEnd } from "@world/loop/runtime";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { DEFAULT_CLOCK } from "@world/desktop/beat";

/** A store over a hand-made state (so SAN can start at 0); appends go through the real reducer. */
function storeOver(initial: State): Store & { events: GameEvent[] } {
  let state = initial;
  const events: GameEvent[] = [];
  return {
    events,
    getState: () => state,
    getEvents: () => events,
    getStartDay: () => initial.day,
    getRunId: () => "r",
    appendEvent(draft: EventDraft) {
      const e = { ...draft, day: state.day } as GameEvent;
      state = applyEvent(state, e);
      events.push(e);
      return state;
    },
    subscribe: () => () => {},
  } as Store & { events: GameEvent[] };
}

describe("collapse (SAN ≤ 0)", () => {
  it("SAN 0 at the shutdown beat is due as collapse, not bad (even with assimilation maxed)", () => {
    expect(dueAtShutdown({ ...f(5), san: 0 })).toBe("collapse");
    expect(dueAtShutdown({ ...f(5), san: 0, assimilation: 100 })).toBe("collapse");
  });

  it("SAN 0 is collapse at 躺下 on any day — the run ends there, with no next day", () => {
    // dueAtLieDown returns collapse on a mid-run day (not just the last).
    expect(dueAtLieDown({ ...f(5), san: 0 })).toBe("collapse");
    // Through the runtime: lieDownOrEnd appends `ending: collapse`, never `lieDown`.
    const store = storeOver({ ...f(5), san: 0 });
    const ctx = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender() {}, later() {}, now: () => 0 } as unknown as ActionContext;
    lieDownOrEnd(ctx);
    const kinds = store.events.map((e) => e.kind);
    expect(kinds).toContain("ending");
    expect(kinds).not.toContain("lieDown");
    expect(store.getState().ending).toBe("collapse");
    expect(store.getState().day).toBe(5); // no next day
  });

  it("the collapse line carries the day it happened", async () => {
    const { renderCollapse } = await import("@world/endings/view");
    const state = { ...f(7), san: 0, ending: "collapse" as const };
    const session = initialSession(DEFAULT_CLOCK, "left", "room");
    session.endingPage = { phase: "collapse", startMs: 0, skipped: false };
    // nowMs past the run-to-white so the line shows; it names day 7.
    const out = renderCollapse({ state, events: [], session, startDay: 1, nowMs: 10_000 }).value;
    expect(out).toContain("collapse-page");
    expect(out).toContain("7"); // the day in the line
  });

  it("the profile counts a collapse ending", () => {
    const storage = memoryStorage();
    const profile = createProfileWriter(storage);
    expect(() => profile.recordEnding("collapse")).not.toThrow();
    profile.recordEnding("collapse");
    const raw = JSON.parse(storage.getItem("nt_profile")!);
    expect(raw.data.endings.collapse).toBe(2);
  });
});
