// settle-polish 1: on the approval-chain day each stamped rank carries its place (`--i`) so the stamps
// come down from the bottom rank up; under reduced motion the flow is `.af.reduced` (no animation).
import "./specimen";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { taskByFlag } from "@state/days/tasks";
import { freshBoard, stepBoard } from "@state/days/board";
import { settleSheet } from "@world/desktop/workbench/settle-sheet";

const day13 = () => taskByFlag(13, "task_d13_work")!;

describe("settle-polish 1 · the approval flow's stamps", () => {
  it("each done step has style=\"--i:<n>\" in rank order, the others none; reduced motion adds .reduced", () => {
    const task = day13();
    const b = task.board!;
    let s = { ...freshBoard(b), unlocked: true };
    for (const slot of b.slots) s = stepBoard(b, s, { t: "fill", slot: slot.id, card: slot.answer });
    s = stepBoard(b, s, { t: "approve" });
    const state = createStore({ startDay: 13 }).getState();
    const out = settleSheet(state, task, b, s, null).value;
    const steps = [...out.matchAll(/<li class="af-step ([a-z]+)[^"]*"( style="--i:(\d+)")?>/g)];
    expect(steps).toHaveLength(b.stack!.ranks.length);
    const done = steps.filter((m) => m[1] === "done");
    expect(done.length).toBeGreaterThan(1);
    done.forEach((m, n) => expect(m[3]).toBe(String(n)));
    for (const m of steps.filter((x) => x[1] !== "done")) expect(m[2]).toBeUndefined();
    expect(out).toContain('<aside class="af">');
    expect(settleSheet(state, task, b, s, null, new Set(), null, true).value).toContain('<aside class="af reduced">');
  });
});
