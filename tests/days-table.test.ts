import { describe, expect, it } from "vitest";
import day01 from "@content/days/day-01.json";
import { dayFiles, parseDayFile, parseToken, type DayFile, type Token } from "@state/days/table";
import { constants } from "@state/variables";

const clone = () => structuredClone(day01) as any;

describe("day files", () => {
  it("has one checked file per day", () => {
    expect([...dayFiles.keys()]).toEqual(Array.from({ length: constants.lastDay }, (_, i) => i + 1));
  });

  it("is frozen and keeps the strings as written", () => {
    const d1 = dayFiles.get(1)!;
    expect(Object.isFrozen(d1.items[0])).toBe(true);
    expect(d1.beats.boot!.say[0]!.t).toBe(day01.beats.boot.say[0]!.t);
  });

  it.each([
    ["an unknown top-level key", (d: any) => (d.extra = 1), /unknown key "extra"/],
    ["an unknown line kind", (d: any) => (d.beats.boot.say[0].k = "shout"), /line kind/],
    ["a speaker without who", (d: any) => ((d.beats.boot.say[0].k = "speaker"), delete d.beats.boot.say[0].who), /needs `who`/],
    ["an unknown condition", (d: any) => (d.items[0].unlock = "whenever"), /unknown condition/],
    ["an unknown event", (d: any) => (d.items[0].done = "event:dance"), /unknown event/],
    ["a reference to a missing item", (d: any) => (d.items[1].unlock = "done:nope"), /unknown item "nope"/],
    ["a duplicate id", (d: any) => (d.items[1].id = "boot"), /duplicate item id/],
    ["a goto choice", (d: any) => (d.beats.shutdown.choices = [{ text: "x", goto: "y" }]), /unknown key "goto"/],
    ["an old night-raid effect (item_dream, removed 2026-11-06)", (d: any) => (d.beats.shutdown.choices = [{ text: "x", effects: { item_dream: "chick" } }]), /unknown key "item_dream"/],
    ["an old night-raid effect (item_lost, removed 2026-11-06)", (d: any) => (d.beats.shutdown.choices = [{ text: "x", effects: { item_lost: "loan" } }]), /unknown key "item_lost"/],
    ["waiting less than the minimum", (d: any) => (d.delivery.waitMinutes = 1), /below minMinutes/],
  ])("rejects %s", (_name, change, message) => {
    const d = clone();
    change(d);
    expect(() => parseDayFile(d, "day-01.json")).toThrow(message);
  });

  it("parses condition tokens", () => {
    expect(parseToken("start", "x")).toEqual({ kind: "start" });
    expect(parseToken("done:boot", "x")).toEqual({ kind: "done", id: "boot" });
    expect(parseToken("flag:task_v17_done", "x")).toEqual({ kind: "flag", flag: "task_v17_done" });
    expect(parseToken("event:delivery:arrives:lunch", "x")).toEqual({ kind: "event", event: { type: "arrives", meal: "lunch" } });
    expect(parseToken("event:reply:boss", "x")).toEqual({ kind: "event", event: { type: "reply", recipient: "boss" } });
    expect(() => parseToken("event:order:brunch", "x")).toThrow(/meal/);
  });
});

/**
 * FR5 property: the required items can be done in some order. Engine/player event tokens and
 * flags (work tasks) are satisfiable once their item is unlocked; an arrival token only after a
 * reachable order of that meal on a day with delivery; `done:` only after that item is done.
 */
function reachable(file: DayFile): { done: Set<string>; bedReachable: boolean } {
  const done = new Set<string>();
  const ordered = new Set<string>();
  const satisfied = (t: Token): boolean => {
    if (t.kind === "start" || t.kind === "flag") return true;
    if (t.kind === "done") return done.has(t.id);
    if (t.event.type === "arrives") return !file.delivery.none && ordered.has(t.event.meal);
    return true;
  };
  const bed = file.items.find((it) => it.done.kind === "event" && it.done.event.type === "lieDown");
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of file.items) {
      if (done.has(it.id) || it === bed) continue;
      if (satisfied(it.unlock) && satisfied(it.done)) {
        done.add(it.id);
        if (it.done.kind === "event" && it.done.event.type === "order") ordered.add(it.done.event.meal);
        changed = true;
      }
    }
  }
  const requiredDone = file.items.filter((it) => it.required && it !== bed).every((it) => done.has(it.id));
  return { done, bedReachable: !!bed && satisfied(bed.unlock) && requiredDone };
}

describe("FR5 property: every day's required items are orderable and the bed is reachable", () => {
  it.each([...dayFiles.values()].map((f) => [f.day, f] as const))("day %i", (_day, file) => {
    const { done, bedReachable } = reachable(file);
    const stuck = file.items.filter((it) => it.required && !done.has(it.id) && !(it.done.kind === "event" && it.done.event.type === "lieDown"));
    expect(stuck.map((it) => `${it.id} (unlock ${it.unlockRaw})`)).toEqual([]);
    expect(bedReachable).toBe(true);
  });
});
