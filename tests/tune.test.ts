// tune (2026-11-08, author): days 2–3's backend is a tuning board — each module is done one of a
// few ways (paths with sub-actions and their own deltas), the bars move up and down, at most N
// modules set at once, today's line is what the menu allows (day 2 cannot reach 60, day 3 just
// reaches 80 with its new paths), and day 3 opens with day 2's choices still set.
import { describe, expect, it } from "vitest";
import type { GameEvent } from "@state/events";
import { boardJudgement, boardState, canPrint, freshBoard, pathFound, pathOnMenu, stepBoard, tuneNeedsTry, tuneBase, tuneCarried, tuneDims, tuneReached, tuneShort, tuneStepsLeft, tuneValues } from "@state/days/board";
import { ideSrc, ideTranscript } from "@state/days/ide";
import { parseTaskFile, taskByFlag, type TaskBoard } from "@state/days/tasks";

const d2 = () => taskByFlag(2, "task_d2_1")!;
const d3 = () => taskByFlag(3, "task_d3_1")!;
type Choice = Readonly<Record<string, string>>;
const step = (day: number, taskId: string, op: Extract<GameEvent, { kind: "boardStep" }>["op"]): GameEvent => ({ kind: "boardStep", day, taskId, op } as GameEvent);
const set = (day: number, choice: Choice): GameEvent[] => Object.entries(choice).map(([id, path]) => step(day, "task1", { t: "mod", id, path }));
const min = (b: TaskBoard, mods: Choice) => Math.min(...b.tune!.dims.map((d) => tuneValues(b, mods)[d.id]!));
/** Every way of setting at most `max` modules, each to one of its paths (or none). */
function* choices(b: TaskBoard, max: number): Generator<Choice> {
  const mods = b.tune!.mods;
  const opts = mods.map((m) => [null, ...m.paths.map((p) => p.id)]);
  const idx = new Array(mods.length).fill(0);
  for (;;) {
    const c: Record<string, string> = {};
    for (let i = 0; i < mods.length; i++) { const p = opts[i]![idx[i]!]; if (p) c[mods[i]!.id] = p; }
    if (Object.keys(c).length <= max) yield c;
    let i = 0;
    while (i < mods.length) { idx[i]!++; if (idx[i]! < opts[i]!.length) break; idx[i] = 0; i++; }
    if (i === mods.length) return;
  }
}
const best = (b: TaskBoard) => {
  let top = -1;
  const sets: Choice[] = [];
  for (const c of choices(b, b.tune!.steps)) { const m = min(b, c); if (m > top) { top = m; sets.length = 0; } if (m === top) sets.push(c); }
  return { top, sets };
};
const DAY2_BEST: Choice = { cadence: "nightly", gate: "sample", evals: "frozen", observe: "logs", front: "export" };
const DAY3_BEST: Choice = { cadence: "nightly", ingest: "pull", compute: "cached", gate: "diff", rollout: "canary", evals: "shadow", observe: "logs", front: "export" };
const TRAPS = { ingest: "magic", compute: "canned", front: "page" };

describe("tune: modules, paths and the bars", () => {
  it("day 2's board is a tuning board: four bars, ten modules with two or three paths each, six at once, the line at 60", () => {
    const b = d2().board!;
    expect(b.slots).toEqual([]);
    expect(b.cards).toEqual([]);
    expect(b.tune!.dims.map((d) => d.id)).toEqual(["auto", "safe", "hands", "gain"]);
    expect(b.tune!.mods).toHaveLength(10);
    for (const m of b.tune!.mods) {
      expect(m.paths.length).toBeGreaterThanOrEqual(1);
      for (const p of m.paths) expect(p.bullets.length).toBeGreaterThanOrEqual(2);
    }
    expect(b.tune!.steps).toBe(6);
    expect(b.tune!.reach).toBe(60);
    expect(tuneValues(b, {})).toEqual(b.tune!.start);
    // day 3's menu has the new paths; day 2's does not
    expect(d3().board!.tune!.mods.find((m) => m.id === "evals")!.paths.map((p) => p.id)).toContain("shadow");
    expect(b.tune!.mods.find((m) => m.id === "evals")!.paths.map((p) => p.id)).not.toContain("shadow");
  });
  it("a path moves the bars by its deltas; another path swaps for free; null clears and gives the step back; over the budget nothing happens", () => {
    const b = d2().board!;
    let s = freshBoard(b);
    s = stepBoard(b, s, { t: "mod", id: "selfedit", path: "config" });
    expect(s.mods).toEqual({ selfedit: "config" });
    expect(tuneDims(b, s)).toEqual({ auto: 55, safe: 25, hands: 25, gain: 30 });
    expect(stepBoard(b, s, { t: "mod", id: "selfedit", path: "config" })).toBe(s); // already that path
    expect(stepBoard(b, s, { t: "mod", id: "selfedit", path: "zzz" })).toBe(s); // not a path
    expect(stepBoard(b, s, { t: "mod", id: "zzz", path: "config" })).toBe(s); // not a module
    for (const [id, path] of Object.entries({ cadence: "nightly", ingest: "manual", compute: "real", params: "auto", gate: "every" })) s = stepBoard(b, s, { t: "mod", id, path });
    expect(tuneStepsLeft(b, s)).toBe(0);
    expect(stepBoard(b, s, { t: "mod", id: "rollout", path: "sandbox" })).toBe(s); // the budget
    const swapped = stepBoard(b, s, { t: "mod", id: "selfedit", path: "prompt" }); // a swap costs nothing
    expect(swapped.mods.selfedit).toBe("prompt");
    expect(tuneStepsLeft(b, swapped)).toBe(0);
    s = stepBoard(b, s, { t: "mod", id: "selfedit", path: null });
    expect(s.mods.selfedit).toBeUndefined();
    expect(tuneStepsLeft(b, s)).toBe(1);
    expect(stepBoard(b, s, { t: "mod", id: "selfedit", path: null })).toBe(s); // already clear
  });
  it("the bars clamp to 0–100", () => {
    const b = d3().board!;
    const v = tuneValues(b, { cadence: "nightly", selfedit: "config", params: "auto", evals: "shadow", observe: "logs", rollout: "canary" });
    expect(v.auto).toBe(100);
    expect(v.safe).toBeGreaterThanOrEqual(0);
  });
  it("day 2 cannot reach its line however the six are chosen; the best lands at 55 and never uses a trap", { timeout: 60_000 }, () => {
    const b = d2().board!;
    const { top, sets } = best(b);
    expect(top).toBe(55);
    expect(top).toBeLessThan(b.tune!.reach);
    expect(sets.some((c) => Object.entries(c).every(([m, p]) => DAY2_BEST[m] === p) && Object.keys(c).length === 5)).toBe(true);
    for (const c of sets) for (const [m, p] of Object.entries(TRAPS)) expect(c[m]).not.toBe(p);
  });
  it("day 3 reaches 80 with exactly one set of eight: four of its new paths, and no trap", { timeout: 60_000 }, () => {
    const b = d3().board!;
    const { top, sets } = best(b);
    expect(top).toBe(80);
    expect(sets).toEqual([DAY3_BEST]);
    expect(Object.values(DAY3_BEST).filter((p) => ["cached", "diff", "canary", "shadow", "flywheel"].includes(p))).toHaveLength(4);
    for (const [m, p] of Object.entries(TRAPS)) expect(DAY3_BEST[m]).not.toBe(p);
    expect(DAY3_BEST.front).not.toBe("skin");
  });
  it("今天先这样 is enabled once the budget is spent or every bar is over the line", () => {
    const b2 = d2().board!;
    let s = freshBoard(b2);
    expect(canPrint(b2, s)).toBe(false);
    for (const [id, path] of Object.entries(DAY2_BEST)) s = stepBoard(b2, s, { t: "mod", id, path });
    expect(canPrint(b2, s)).toBe(false); // five set, the line not reached
    s = stepBoard(b2, s, { t: "mod", id: "ingest", path: "manual" });
    expect(canPrint(b2, s)).toBe(true);
    expect(tuneReached(b2, s)).toBe(false);
    const b3 = d3().board!;
    let t = freshBoard(b3);
    for (const [id, path] of Object.entries(DAY3_BEST)) t = stepBoard(b3, t, { t: "mod", id, path });
    expect(tuneReached(b3, t)).toBe(true);
    expect(canPrint(b3, t)).toBe(true);
  });
  it("day 3 opens with day 2's choices (carried from the log); its base bars are where day 2 ended; a swap today is free, a clear gives a step back", () => {
    const b3 = d3().board!;
    const events = set(2, { ...DAY2_BEST, ingest: "manual" });
    expect(tuneCarried(b3, events)).toEqual({ ...DAY2_BEST, ingest: "manual" });
    const s = boardState(b3, 3, "task1", events);
    expect(s.mods).toEqual({ ...DAY2_BEST, ingest: "manual" });
    expect(tuneBase(b3, events)).toEqual(tuneValues(d2().board!, { ...DAY2_BEST, ingest: "manual" }));
    expect(tuneStepsLeft(b3, s)).toBe(2);
    const off = boardState(b3, 3, "task1", [...events, step(3, "task1", { t: "mod", id: "ingest", path: null })]);
    expect(off.mods.ingest).toBeUndefined();
    expect(tuneStepsLeft(b3, off)).toBe(3);
    const swapped = boardState(b3, 3, "task1", [...events, step(3, "task1", { t: "mod", id: "evals", path: "shadow" })]);
    expect(swapped.mods.evals).toBe("shadow");
    expect(tuneStepsLeft(b3, swapped)).toBe(2);
    expect(tuneCarried(b3, [])).toEqual({});
  });
  it("Kuro's assist sets its own choice in place of yours (it ignores the safety bar)", () => {
    const b = d2().board!;
    let s = stepBoard(b, freshBoard(b), { t: "mod", id: "gate", path: "every" });
    s = stepBoard(b, s, { t: "assistFill" });
    expect(s.mods).toEqual(b.tune!.assist);
    expect(s.assists).toBe(1);
    expect(tuneDims(b, s).safe).toBeLessThan(b.tune!.reach - 10);
  });
  it("the night's judgement counts the bars further than the slack under the line as wrong slots", () => {
    const b = d2().board!;
    expect(tuneShort(b, DAY2_BEST)).toEqual([]); // 55 ≥ 50: perfect
    expect(tuneShort(b, b.tune!.assist).length).toBeGreaterThan(0); // Kuro's choice: safety low
    const printed = (choice: Choice): GameEvent[] => [...set(2, choice), { kind: "task", day: 2, flag: "task_d2_1", mode: "self", slots: {}, assists: 0 } as GameEvent, { kind: "give", day: 2, deliverableId: "d2-vivi-page" } as GameEvent];
    expect(boardJudgement(2, printed(DAY2_BEST))?.verdict).toBe("perfect");
    expect(boardJudgement(2, printed({ cadence: "nightly", selfedit: "config", params: "auto", front: "export" }))?.verdict).not.toBe("perfect");
    expect(boardJudgement(2, printed({ compute: "canned", ingest: "magic" }))?.verdict).toBe("wrong");
  });
  it("the preview's query carries the choices, the bars, the base, the line and the steps left", () => {
    const b = d3().board!;
    const carried = { ...DAY2_BEST, ingest: "manual" };
    const s = boardState(b, 3, "task1", set(2, carried));
    const src = ideSrc(b, s, [], null, carried);
    expect(src).toContain("/docs/player/day-03-train.html?theme=light&pane=preview&c=0&mods=cadence:nightly,ingest:manual,gate:sample,evals:frozen,observe:logs,front:export&dims=");
    expect(src).toContain("&base=auto:60,safe:55,hands:55,gain:70");
    expect(src).toContain("&reach=80&promise=100&left=2");
    expect(src).not.toContain("done=1");
    expect(ideSrc(b, s, [{ t: "print" }], null, carried)).toContain("&done=1");
    // the foreshadowing: opened again from day 4 the page is told the day (and reads 100 everywhere); not before
    expect(ideSrc(b, s, [{ t: "print" }], null, carried, 3)).not.toContain("haunt");
    expect(ideSrc(b, s, [{ t: "print" }], null, carried, 4)).toContain("&haunt=4");
    expect(ideSrc(b, s, [{ t: "print" }], null, carried, 11)).toContain("&haunt=11");
  });
  it("the transcript: a path's own beat (else the module's), `unmod` on a clear, `steps` as the budget runs out, `reach` as the bars clear the line; a choice that did not take says nothing", () => {
    const b2 = d2().board!;
    const ons = ideTranscript(b2, [{ t: "mod", id: "selfedit", path: "config" }, { t: "mod", id: "selfedit", path: "config" }, { t: "mod", id: "gate", path: "every" }, { t: "mod", id: "gate", path: null }]).map((l) => l.on);
    expect(ons.filter((o) => o === "mod:selfedit:config")).toHaveLength(1);
    expect(ons).toContain("mod:gate:every");
    expect(ons).toContain("unmod:gate");
    const six = Object.entries({ ...DAY2_BEST, ingest: "manual" }).map(([id, path]) => ({ t: "mod", id, path }) as const);
    expect(ideTranscript(b2, six).map((l) => l.on)).toContain("steps");
    const b3 = d3().board!;
    const carried = { ...DAY2_BEST, ingest: "manual" };
    const day3 = [{ t: "mod", id: "ingest", path: "pull" }, { t: "mod", id: "compute", path: "cached" }, { t: "mod", id: "gate", path: "diff" }, { t: "mod", id: "rollout", path: "canary" }, { t: "mod", id: "evals", path: "shadow" }] as const;
    const lines = ideTranscript(b3, day3, carried).map((l) => l.on);
    expect(lines).toContain("mod:evals:shadow");
    expect(lines).toContain("reach");
    expect(lines.indexOf("reach")).toBeGreaterThan(lines.indexOf("mod:evals:shadow"));
  });
  it("a path with a source of its own waits for it (the diff-only approval for the v17 sent to Wang); her skin is off the menu until the first try to finish, when Kuro's line reveals it", () => {
    const b = d3().board!;
    const gate = b.tune!.mods.find((m) => m.id === "gate")!;
    const diff = gate.paths.find((p) => p.id === "diff")!;
    expect(pathFound(gate, diff, 3, [])).toBe(false);
    expect(pathFound(gate, diff, 3, [{ kind: "open", day: 3, target: "conv:boss" } as GameEvent])).toBe(true);
    const front = b.tune!.mods.find((m) => m.id === "front")!;
    const skin = front.paths.find((p) => p.id === "skin")!;
    expect(skin.after).toBe("try");
    let s = freshBoard(b);
    expect(pathOnMenu(skin, s)).toBe(false);
    expect(stepBoard(b, s, { t: "mod", id: "front", path: "skin" })).toBe(s); // not on the menu yet
    for (const [id, path] of Object.entries(DAY3_BEST)) s = stepBoard(b, s, { t: "mod", id, path });
    expect(canPrint(b, s)).toBe(true);
    expect(tuneNeedsTry(b, s)).toBe(true); // the first finish only reveals
    s = stepBoard(b, s, { t: "try" });
    expect(s.tried).toBe(true);
    expect(tuneNeedsTry(b, s)).toBe(false);
    expect(pathOnMenu(skin, s)).toBe(true);
    expect(stepBoard(b, s, { t: "mod", id: "front", path: "skin" }).mods.front).toBe("skin");
    // the transcript: the player's line, then Kuro's, once; day 2 has no try (no path waits for one)
    const ons = ideTranscript(b, [{ t: "try" }, { t: "try" }]).map((l) => l.on);
    expect(ons.filter((o) => o === "try")).toHaveLength(2); // two lines of the one beat
    expect(ideTranscript(b, []).some((l) => l.on === "open" && l.text.includes("皮子"))).toBe(false);
    expect(tuneNeedsTry(d2().board!, freshBoard(d2().board!))).toBe(false);
    // the finish words are the player's, per day
    expect(d2().board!.tune!.finish).toBe("今天先这样，我再想想");
    expect(b.tune!.finish).toBe("这已经是最好的程度了");
  });
  it("the loader: a tuning board has no slots and no cards, paths name dimensions and carry sub-actions, the assist names paths within the budget, beats name modules and paths", () => {
    const base = JSON.parse(JSON.stringify(d2()));
    const bad = (mut: (b: any) => void, msg: RegExp) => {
      const t = JSON.parse(JSON.stringify(base));
      mut(t.board);
      expect(() => parseTaskFile({ day: 2, tasks: [t] }, "t")).toThrow(msg);
    };
    expect(() => parseTaskFile({ day: 2, tasks: [base] }, "t")).not.toThrow();
    bad((b) => b.slots.push({ id: "r1", label: "x", answer: "c1" }), /no slots/);
    bad((b) => b.cards.push({ id: "c1", text: "x" }), /no cards/);
    bad((b) => (b.tune.mods[0].paths[0].delta.speed = 5), /not a dimension/);
    bad((b) => (b.tune.mods[0].paths[0].delta.auto = 0), /non-zero/);
    bad((b) => (b.tune.mods[0].paths[0].bullets = []), /non-empty/);
    bad((b) => (b.tune.assist = { cadence: "zzz" }), /not a path/);
    bad((b) => (b.tune.assist = Object.fromEntries(b.tune.mods.map((m: any) => [m.id, m.paths[0].id]))), /budget/);
    bad((b) => b.beats.push({ on: "mod:zzz", lines: [{ who: "kuro", text: "x" }] }), /not a module/);
    bad((b) => b.beats.push({ on: "mod:cadence:zzz", lines: [{ who: "kuro", text: "x" }] }), /not a path/);
    bad((b) => (b.tune.start = { auto: 20 }), /no start value/);
    bad((b) => (b.view = undefined), /needs view "ide"/);
  });
});
