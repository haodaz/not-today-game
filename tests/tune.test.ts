// tune (2026-11-08, author): days 2–3's backend is a tuning board — modules move four bars up and
// down, at most N on at once, today's line is what the module set allows (day 2 cannot reach 60,
// day 3 just reaches 80), and day 3 opens with day 2's switches still on.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "@state/events";
import { boardJudgement, boardState, canPrint, freshBoard, stepBoard, tuneBase, tuneCarried, tuneDims, tuneReached, tuneShort, tuneStepsLeft, tuneValues } from "@state/days/board";
import { ideSrc, ideTranscript } from "@state/days/ide";
import { parseTaskFile, taskByFlag, type TaskBoard } from "@state/days/tasks";

const d2 = () => taskByFlag(2, "task_d2_1")!;
const d3 = () => taskByFlag(3, "task_d3_1")!;
const step = (day: number, taskId: string, op: Extract<GameEvent, { kind: "boardStep" }>["op"]): GameEvent => ({ kind: "boardStep", day, taskId, op } as GameEvent);
const min = (b: TaskBoard, mods: readonly string[]) => Math.min(...b.tune!.dims.map((d) => tuneValues(b, mods)[d.id]!));
/** Every subset of `ids` with at most `max` members. */
function* subsets(ids: readonly string[], max: number): Generator<string[]> {
  for (let m = 0; m < 1 << ids.length; m++) {
    const s = ids.filter((_, i) => (m >> i) & 1);
    if (s.length <= max) yield s;
  }
}

describe("tune: the bars and the switches", () => {
  it("day 2's board is a tuning board: four bars, ten modules, six at once, the line at 60, her page at 100", () => {
    const b = d2().board!;
    expect(b.tune).toBeDefined();
    expect(b.slots).toEqual([]);
    expect(b.cards).toEqual([]);
    expect(b.tune!.dims.map((d) => d.id)).toEqual(["auto", "safe", "hands", "gain"]);
    expect(b.tune!.mods).toHaveLength(10);
    expect(b.tune!.steps).toBe(6);
    expect(b.tune!.reach).toBe(60);
    expect(b.tune!.promise).toBe(100);
    expect(tuneValues(b, [])).toEqual(b.tune!.start);
  });
  it("a switch moves the bars by its deltas; off gives the step back; over the budget nothing happens", () => {
    const b = d2().board!;
    let s = freshBoard(b);
    s = stepBoard(b, s, { t: "mod", id: "m5", on: true });
    expect(s.mods).toEqual(["m5"]);
    expect(tuneDims(b, s)).toEqual({ auto: 55, safe: 25, hands: 25, gain: 30 });
    expect(stepBoard(b, s, { t: "mod", id: "m5", on: true })).toBe(s); // already on
    expect(stepBoard(b, s, { t: "mod", id: "zzz", on: true })).toBe(s); // not a module
    for (const id of ["m1", "m2", "m3", "m4", "m6"]) s = stepBoard(b, s, { t: "mod", id, on: true });
    expect(tuneStepsLeft(b, s)).toBe(0);
    expect(stepBoard(b, s, { t: "mod", id: "m7", on: true })).toBe(s); // the budget
    s = stepBoard(b, s, { t: "mod", id: "m5", on: false });
    expect(s.mods).toEqual(["m1", "m2", "m3", "m4", "m6"]);
    expect(tuneStepsLeft(b, s)).toBe(1);
  });
  it("the bars clamp to 0–100", () => {
    const b = d3().board!;
    const v = tuneValues(b, ["m5", "m8", "m9", "m10", "n1", "n2"]);
    expect(v.auto).toBe(100);
    expect(v.safe).toBeGreaterThanOrEqual(0);
  });
  it("day 2 cannot reach its line however the six are chosen; the best set lands at 55", () => {
    const b = d2().board!;
    const ids = b.tune!.mods.map((m) => m.id);
    let best = -1;
    const bestSets: string[][] = [];
    for (const s of subsets(ids, b.tune!.steps)) {
      const m = min(b, s);
      if (m > best) { best = m; bestSets.length = 0; }
      if (m === best) bestSets.push(s);
    }
    expect(best).toBe(55);
    expect(best).toBeLessThan(b.tune!.reach);
    expect(bestSets).toEqual([["m1", "m2", "m6", "m8", "m9", "m10"]]);
    // the trap (the animation) is in no best set
    expect(bestSets.some((s) => s.includes("m4"))).toBe(false);
  });
  it("day 3 reaches 80 with exactly one set of eight, and neither trap is in it", () => {
    const b = d3().board!;
    const ids = b.tune!.mods.map((m) => m.id);
    const reach = [...subsets(ids, b.tune!.steps)].filter((s) => min(b, s) >= 80);
    expect(reach).toHaveLength(1);
    expect([...reach[0]!].sort()).toEqual(["m1", "m2", "m6", "m8", "m9", "n1", "n2", "n3"]);
    expect(reach[0]).not.toContain("m4");
    expect(reach[0]).not.toContain("n4");
    expect(reach.some((s) => min(b, s) > 80)).toBe(false);
  });
  it("今天先这样 is enabled once the budget is spent or every bar is over the line; a free switch keeps it off", () => {
    const b2 = d2().board!;
    let s = freshBoard(b2);
    expect(canPrint(b2, s)).toBe(false);
    for (const id of ["m1", "m2", "m6", "m8", "m9"]) s = stepBoard(b2, s, { t: "mod", id, on: true });
    expect(canPrint(b2, s)).toBe(false);
    s = stepBoard(b2, s, { t: "mod", id: "m10", on: true });
    expect(canPrint(b2, s)).toBe(true);
    expect(tuneReached(b2, s)).toBe(false);
    const b3 = d3().board!;
    let t = freshBoard(b3);
    for (const id of ["m1", "m2", "m6", "m8", "m9", "n1", "n2"]) t = stepBoard(b3, t, { t: "mod", id, on: true });
    expect(canPrint(b3, t)).toBe(false);
    t = stepBoard(b3, t, { t: "mod", id: "n3", on: true });
    expect(tuneReached(b3, t)).toBe(true);
    expect(canPrint(b3, t)).toBe(true);
  });
  it("day 3 opens with day 2's switches on (carried from the log), and its base bars are where day 2 ended", () => {
    const b3 = d3().board!;
    const events: GameEvent[] = ["m1", "m2", "m6", "m8", "m9", "m10"].map((id) => step(2, "task1", { t: "mod", id, on: true }));
    expect(tuneCarried(b3, events)).toEqual(["m1", "m2", "m6", "m8", "m9", "m10"]);
    const s = boardState(b3, 3, "task1", events);
    expect(s.mods).toEqual(["m1", "m2", "m6", "m8", "m9", "m10"]);
    expect(tuneBase(b3, events)).toEqual(tuneValues(d2().board!, ["m1", "m2", "m6", "m8", "m9", "m10"]));
    expect(tuneStepsLeft(b3, s)).toBe(2);
    // switching a carried module off today gives a step back
    const off = boardState(b3, 3, "task1", [...events, step(3, "task1", { t: "mod", id: "m10", on: false })]);
    expect(off.mods).not.toContain("m10");
    expect(tuneStepsLeft(b3, off)).toBe(3);
    // without day 2's steps nothing carries
    expect(tuneCarried(b3, [])).toEqual([]);
  });
  it("Kuro's assist switches its own set on in place of yours (it ignores the safety bar)", () => {
    const b = d2().board!;
    let s = stepBoard(b, freshBoard(b), { t: "mod", id: "m6", on: true });
    s = stepBoard(b, s, { t: "assistFill" });
    expect(s.mods).toEqual(b.tune!.assist);
    expect(s.assists).toBe(1);
    expect(tuneDims(b, s).safe).toBeLessThan(b.tune!.reach - 10);
  });
  it("the night's judgement counts the bars further than the slack under the line as wrong slots", () => {
    const b = d2().board!;
    expect(tuneShort(b, ["m1", "m2", "m6", "m8", "m9", "m10"])).toEqual([]); // 55 ≥ 50: perfect
    expect(tuneShort(b, b.tune!.assist)).toEqual(["safe"]); // Kuro's set: safety at 25
    const printed = (mods: string[]): GameEvent[] => [...mods.map((id) => step(2, "task1", { t: "mod", id, on: true })), { kind: "task", day: 2, flag: "task_d2_1", mode: "self", slots: {}, assists: 0 } as GameEvent, { kind: "give", day: 2, deliverableId: "d2-vivi-page" } as GameEvent];
    expect(boardJudgement(2, printed(["m1", "m2", "m6", "m8", "m9", "m10"]))?.verdict).toBe("perfect");
    expect(boardJudgement(2, printed(["m1", "m2", "m8", "m9", "m10"]))?.verdict).toBe("flawed");
    expect(boardJudgement(2, printed(["m4", "m5"]))?.verdict).toBe("wrong");
  });
  it("the preview's query carries the switches, the bars, the base, the line and the steps left", () => {
    const b = d3().board!;
    const carried = ["m1", "m2", "m6", "m8", "m9", "m10"];
    const s = boardState(b, 3, "task1", carried.map((id) => step(2, "task1", { t: "mod", id, on: true })));
    const src = ideSrc(b, s, [], null, carried);
    expect(src).toContain("/docs/player/day-03-train.html?theme=light&pane=preview&c=0&mods=m1,m2,m6,m8,m9,m10&dims=");
    expect(src).toContain("&base=auto:60,safe:55,hands:55,gain:85");
    expect(src).toContain("&reach=80&promise=100&left=2");
    expect(src).not.toContain("done=1");
    expect(ideSrc(b, s, [{ t: "print" }], null, carried)).toContain("&done=1");
  });
  it("the transcript: a switch's own beat (on / off), `steps` as the budget runs out, `reach` as the bars clear the line; a switch that did not take says nothing", () => {
    const b2 = d2().board!;
    const ons = ideTranscript(b2, [{ t: "mod", id: "m5", on: true }, { t: "mod", id: "m5", on: true }, { t: "mod", id: "m6", on: true }, { t: "mod", id: "m6", on: false }]).map((l) => l.on);
    expect(ons.filter((o) => o === "mod:m5")).toHaveLength(1);
    expect(ons).toContain("mod:m6");
    expect(ons).toContain("unmod:m6");
    const six = ["m1", "m2", "m6", "m8", "m9", "m10"].map((id) => ({ t: "mod", id, on: true }) as const);
    expect(ideTranscript(b2, six).map((l) => l.on)).toContain("steps");
    const b3 = d3().board!;
    const carried = ["m1", "m2", "m6", "m8", "m9", "m10"];
    const day3 = [{ t: "mod", id: "m10", on: false }, { t: "mod", id: "n1", on: true }, { t: "mod", id: "n2", on: true }, { t: "mod", id: "n3", on: true }] as const;
    const lines = ideTranscript(b3, day3, carried).map((l) => l.on);
    expect(lines).toContain("unmod:m10"); // a carried module switched off is seen as off
    expect(lines).toContain("reach");
    expect(lines.indexOf("reach")).toBeGreaterThan(lines.indexOf("mod:n3"));
  });
  it("the loader: a tuning board has no slots and no cards, deltas name dimensions, the assist stays within the budget, beats name modules", () => {
    const base = JSON.parse(JSON.stringify(d2()));
    const bad = (mut: (b: any) => void, msg: RegExp) => {
      const t = JSON.parse(JSON.stringify(base));
      mut(t.board);
      expect(() => parseTaskFile({ day: 2, tasks: [t] }, "t")).toThrow(msg);
    };
    expect(() => parseTaskFile({ day: 2, tasks: [base] }, "t")).not.toThrow();
    bad((b) => b.slots.push({ id: "r1", label: "x", answer: "c1" }), /no slots/);
    bad((b) => b.cards.push({ id: "c1", text: "x" }), /no cards/);
    bad((b) => (b.tune.mods[0].delta.speed = 5), /not a dimension/);
    bad((b) => (b.tune.mods[0].delta.auto = 0), /non-zero/);
    bad((b) => (b.tune.assist = ["m1", "m2", "m3", "m4", "m5", "m6", "m7"]), /budget/);
    bad((b) => b.beats.push({ on: "mod:zzz", lines: [{ who: "kuro", text: "x" }] }), /not a module/);
    bad((b) => (b.tune.start = { auto: 20 }), /no start value/);
    bad((b) => (b.view = undefined), /needs view "ide"/);
  });
});
