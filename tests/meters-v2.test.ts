// meters-v2 (author 2026-11-12, numbers Claude): where SAN goes down now that the old look / let
// paths are gone — the night's judgement by the game's own grade, the hand's cut on its nights, the
// late chat turns and the taboo answers, a stare held too long. Pure reducers, so one store each.
import "./specimen";
import { describe, expect, it } from "vitest";
import { boardJudgement, handCost, handNight, printedBoard } from "@state/days/board";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { constants } from "@state/variables";

const C = (k: string): number => (constants as Record<string, unknown>)[k] as number;

describe("a stare held too long", () => {
  it("costs stareSan, as many times as the runtime appends it; the target must be a token", () => {
    const store = createStore({ startDay: 4 });
    const san = store.getState().san;
    store.appendEvent({ kind: "stare", target: "gap" });
    expect(store.getState().san).toBe(san + C("stareSan"));
    store.appendEvent({ kind: "stare", target: "photo:4:window" });
    expect(store.getState().san).toBe(san + 2 * C("stareSan"));
    expect(() => store.appendEvent({ kind: "stare", target: "" })).toThrow(/token/);
    expect(() => store.appendEvent({ kind: "stare", target: "the gap" })).toThrow(/token/);
  });
});

describe("the chat's costs", () => {
  it("the turns from chatSanLateFrom on cost chatSanLate each; earlier ones nothing", () => {
    const store = createStore({ startDay: 3 });
    const san0 = store.getState().san;
    for (let turn = 1; turn <= C("chatTurnsPerDay"); turn++) {
      store.appendEvent({ kind: "chat", q: turn, said: "q", answer: "a", offline: true });
      const late = Math.max(0, turn - C("chatSanLateFrom") + 1);
      expect(store.getState().san, `after turn ${turn}`).toBe(san0 + late * C("chatSanLate"));
    }
  });

  it("a taboo answer costs chatSanTaboo; the nosebleed one more; a flicker still pays", () => {
    for (const [taboo, extra] of [["flicker", 0], ["blood", 1]] as const) {
      const store = createStore({ startDay: 3 });
      const san0 = store.getState().san;
      store.appendEvent(taboo === "flicker" ? { kind: "chat", q: 1, taboo, forgotten: true } : { kind: "chat", q: 1, said: "q", answer: "a", offline: true, taboo });
      expect(store.getState().san, taboo).toBe(san0 + C("chatSanTaboo") - extra);
    }
  });
});

describe("the night's judgement", () => {
  it("a game board is judged by the game's grade on the task event (quality); without one, perfect", () => {
    const task = taskByFlag(5, "task_d5_1");
    expect(task?.board?.game).toBeTruthy();
    const judge = task!.judge!;
    for (const [quality, san] of [["perfect", judge.perfect], ["flawed", judge.flawed], ["wrong", judge.wrong], [undefined, judge.perfect]] as const) {
      const store = createStore({ startDay: 5 });
      store.appendEvent({ kind: "task", flag: task!.done, mode: "self", slots: {}, assists: 0, ...(quality ? { quality } : {}) });
      if (task!.deliverable) store.appendEvent({ kind: "give", deliverableId: task!.deliverable.id });
      expect(printedBoard(5, store.getEvents())?.quality ?? null).toBe(quality ?? null);
      expect(boardJudgement(5, store.getEvents()), String(quality)).toEqual({ verdict: quality ?? "perfect", san });
    }
    expect(() => createStore({ startDay: 5 }).appendEvent({ kind: "task", flag: task!.done, mode: "self", slots: {}, quality: "great" as never })).toThrow(/quality/);
  });

  it("on a hand night the hand takes its own cut by the verdict, or handSanRefused for nothing given; other nights none", () => {
    expect(handNight(11)).toBe(true);
    expect(handNight(5)).toBe(false);
    expect(handCost(11, "perfect")).toBe(C("handSanPerfect"));
    expect(handCost(11, "flawed")).toBe(C("handSanFlawed"));
    expect(handCost(11, "wrong")).toBe(C("handSanWrong"));
    expect(handCost(11, "refused")).toBe(C("handSanRefused"));
    expect(handCost(5, "wrong")).toBe(0);
    for (const k of ["handSanPerfect", "handSanFlawed", "handSanWrong", "handSanRefused", "chatSanLate", "chatSanTaboo", "stareSan"]) expect(C(k), k).toBeLessThan(0);
    expect(C("handSanPerfect")).toBeGreaterThan(C("handSanFlawed"));
    expect(C("handSanFlawed")).toBeGreaterThan(C("handSanWrong"));
  });
});
