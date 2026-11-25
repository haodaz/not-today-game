// Every day's checklist walked the way a player must (audit 2026-11-25): an item once unlocked; a work
// task (flag:task_*) only while fullness >= needWork on a day with meals; eating adds `meal`, each
// task costs `work`, morning is `wake`. A day that cannot reach its last required item is a deadlock
// (e.g. three tasks before dinner unlocks: 50 → 30 → 10, and dinner waits on the third).
import { describe, expect, it } from "vitest";
import { dayFiles, type Item } from "@state/days/table";
import { dayHasMeals, hungerNumbers } from "@state/hunger";

function walk(day: number): { stuck: string[]; trace: string[] } {
  const h = hungerNumbers();
  const items = dayFiles.get(day)!.items;
  const done = new Set<string>();
  let full = h.wake;
  const trace: string[] = [];
  const orderOf = (meal: string) => items.find((x) => x.done.kind === "event" && x.done.event.type === "order" && x.done.event.meal === meal)?.id;
  const unlocked = (i: Item): boolean => {
    const u = i.unlock;
    if (u.kind === "done") return done.has(u.id);
    if (u.kind === "event" && u.event.type === "arrives") { const o = orderOf(u.event.meal); return o !== undefined && done.has(o); }
    return true;
  };
  for (let moved = true; moved; ) {
    moved = false;
    for (const i of items) {
      if (done.has(i.id) || !unlocked(i)) continue;
      const task = i.done.kind === "flag" && i.done.flag.startsWith("task_");
      if (task && dayHasMeals(day) && full < h.needWork) continue;
      done.add(i.id);
      if (i.done.kind === "event" && i.done.event.type === "eat") full = Math.min(100, full + h.meal);
      if (task) full = Math.max(0, full - h.work);
      trace.push(`${i.id}(${full})`);
      moved = true;
      break;
    }
  }
  return { stuck: items.filter((i) => i.required && !done.has(i.id)).map((i) => i.id), trace };
}

describe("every day can be finished under the fullness rule", () => {
  // Known deadlocks found by the 2026-11-25 audit (old board-less tasks stacked on the day's game).
  // Fixing a day removes it from this list; a new deadlock anywhere fails the test.
  const KNOWN: readonly number[] = [7, 11, 12, 13];
  it("only the known days deadlock", () => {
    const stuck = [...dayFiles.keys()].filter((d) => walk(d).stuck.length > 0).sort((a, b) => a - b);
    expect(stuck).toEqual(KNOWN);
  });
  it("the first work of every day with meals opens only after lunch", () => {
    for (const [day, f] of dayFiles) {
      if (!dayHasMeals(day)) continue;
      const first = f.items.find((i) => i.done.kind === "flag" && i.done.flag.startsWith("task_") && i.unlock.kind === "done" && i.unlock.id === "msgs");
      expect(first?.id, `day ${day}`).toBeUndefined();
    }
  });
});
