// scripts/validate-content.ts (tech.md quality gates): the checks the content hooks run.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import day1 from "@content/days/day-01.json";
import day9 from "@content/days/day-09.json";
import stages from "@content/stages.json";
import variables from "@content/variables.json";
import zh from "@content/strings/zh.json";
import { checkDay, main, missingEnglish } from "../scripts/validate-content";

let log: string[] = [];
beforeEach(() => {
  log = [];
  vi.spyOn(console, "log").mockImplementation((s: string) => void log.push(s));
  vi.spyOn(console, "error").mockImplementation((s: string) => void log.push(s));
});
afterEach(() => vi.restoreAllMocks());

const tables = {
  variables: new Set(Object.keys(variables).filter((k) => !k.startsWith("_"))),
  zh: zh as Record<string, string>,
  boxDays: new Set(Object.values(stages.objectsFoundOnDay as Record<string, number>)),
};
const clone = <T>(x: T): any => structuredClone(x);

describe("validate-content", () => {
  it("the content as it is: clean, exit 0", () => {
    expect(main([])).toBe(0);
    expect(log).toContain("days: 18 files, 0 problems");
    expect(log).toContain("strings: 0 keys missing from en.json");
    expect(main(["--days"])).toBe(0);
    expect(main(["--strings"])).toBe(0);
  });

  it("five beats: the four every day has, the box exactly on the days an object arrives", () => {
    const noNight = clone(day1);
    delete noNight.beats.night;
    expect(checkDay(noNight, "content/days/day-01.json", tables)).toEqual(["content/days/day-01.json beats.night: missing"]);
    const noBox = clone(day1);
    delete noBox.beats.box;
    expect(checkDay(noBox, "content/days/day-01.json", tables)).toEqual(["content/days/day-01.json beats.box: missing (an object arrives on day 1)"]);
    const extraBox = clone(day9);
    extraBox.beats.box = clone(day1).beats.box;
    expect(checkDay(extraBox, "content/days/day-09.json", tables)[0]).toMatch(/beats\.box: present, but no object arrives on day 9/);
    const odd = clone(day1);
    odd.beats.lunch = { say: [] };
    expect(checkDay(odd, "content/days/day-01.json", tables)[0]).toMatch(/beats\.lunch: not a beat/);
    expect(checkDay(clone(day1), "content/days/day-02.json", tables)[0]).toMatch(/day: is 1, the file name says 2/);
  });

  it("deltas: every effect changes a variable of content/variables.json; a `delta` names only its keys", () => {
    const bad = clone(day1);
    bad.beats.shutdown.choices = [{ text: "x", effects: { san: -1, mood: 2 } }];
    bad.beats.night.delta = { san: 1, courage: 1 };
    const found = checkDay(bad, "d.json", { ...tables, boxDays: new Set() });
    expect(found).toContain('d.json beats.shutdown.choices[0].effects.mood: not an effect (flags, san, item_dream, item_lost)');
    expect(found).toContain("d.json beats.night.delta.courage: not a key of content/variables.json");
    expect(found.some((l) => /delta\.san/.test(l))).toBe(false);
    const noDream = { ...tables, variables: new Set([...tables.variables].filter((v) => v !== "dream")) };
    const dream = clone(day1);
    dream.beats.shutdown.choices = [{ text: "x", effects: { item_dream: "chick" } }];
    expect(checkDay(dream, "content/days/day-01.json", noDream)).toContain('content/days/day-01.json beats.shutdown.choices[0].effects.item_dream: changes "dream", which content/variables.json does not have');
  });

  it("a referenced string key must be in zh.json", () => {
    const keyed = clone(day1);
    keyed.items[0].labelKey = "hud.today";
    expect(checkDay(keyed, "content/days/day-01.json", tables)).toEqual([]);
    keyed.items[0].labelKey = "hud.nope";
    expect(checkDay(keyed, "content/days/day-01.json", tables)).toEqual(['content/days/day-01.json items[0].labelKey: string key "hud.nope" is not in content/strings/zh.json']);
  });

  it("--strings lists zh keys missing from en.json (notes skipped)", () => {
    expect(missingEnglish({ _note: "x", "a.b": "甲", "c.d": "乙" }, { "a.b": "A" })).toEqual(["c.d"]);
  });

  it("exit codes: 1 for a day-file problem (named files), 2 when it cannot run", () => {
    const dir = mkdtempSync(join(tmpdir(), "nt-validate-"));
    const broken = join(dir, "day-01.json");
    const d = clone(day1);
    delete d.beats.boot;
    writeFileSync(broken, JSON.stringify(d));
    expect(main(["--days", broken])).toBe(1);
    expect(log.some((l) => /day-01\.json beats\.boot: missing/.test(l))).toBe(true);
    const garbled = join(dir, "day-02.json");
    writeFileSync(garbled, "{ nope");
    expect(main(["--days", garbled])).toBe(1);
    expect(main(["--days", join(dir, "day-09.json")])).toBe(2);
    expect(main(["--fix"])).toBe(2);
  });
});
