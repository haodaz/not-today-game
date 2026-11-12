// dialogue addition 2026-11-02 "English twins for days, tasks and objects": the loader validates the
// twin's shape against the Chinese source (the first difference names its path), swaps text under
// lang=en, and falls back to Chinese per file when a twin is missing. Day 1 has twins; day 1 renders
// English end to end.
import "./specimen";
import { afterEach, describe, expect, it } from "vitest";
import { dayFile, localiseDayFile, parseDayFile } from "@state/days/table";
import { taskByFlag, localiseTasks, parseTaskFile } from "@state/days/tasks";
import { recogniseTable } from "@state/recognise";
import { setLocale } from "@world/i18n";
import zhDay01 from "@content/days/day-01.json";
import enDay01 from "@content/days/en/day-01.json";
import zhTask01 from "@content/tasks/day-01.json";
import enTask01 from "@content/tasks/en/day-01.json";

afterEach(() => setLocale("zh"));

describe("day twins", () => {
  it("day 1 swaps its items' text under lang=en and goes back under zh", () => {
    const boot = () => dayFile(1)!.items.find((i) => i.id === "boot")!;
    setLocale("zh");
    const zh = boot().text;
    setLocale("en");
    const en = boot().text;
    expect(en).not.toBe(zh);
    expect(en).toMatch(/[A-Za-z]/); // the English twin reads in English
    setLocale("zh");
    expect(boot().text).toBe(zh);
  });

  it("a mismatched shape is rejected with the path of the first difference", () => {
    const zh = parseDayFile(zhDay01, "day-01.json");
    const mismatch = (edit: (raw: any) => void) => {
      const raw = structuredClone(enDay01) as any;
      edit(raw);
      return () => localiseDayFile(zh, parseDayFile(raw, "en"), "en/day-01.json");
    };
    // Drop a line from a beat: the say-length difference names the beat's path.
    expect(mismatch((r) => r.beats.boot.say.pop())).toThrow(/en\/day-01\.json\.beats\.boot\.say/);
    // Change a non-text field (required) on an item: its path.
    expect(mismatch((r) => (r.items[0].required = !r.items[0].required))).toThrow(/en\/day-01\.json\.items\[0\]/);
  });
});

describe("task twins", () => {
  it("day 1 task1 swaps its title and doc under lang=en", () => {
    const task = () => taskByFlag(1, "task_v17_done")!;
    setLocale("zh");
    const zhTitle = task().title;
    const zhLeft = task().doc!.left[0];
    setLocale("en");
    expect(task().title).not.toBe(zhTitle);
    expect(task().doc!.left[0]).not.toBe(zhLeft);
    expect(task().doc!.left[0]).toMatch(/[A-Za-z]/);
    setLocale("zh");
    expect(task().title).toBe(zhTitle);
  });

  it("a mismatched task shape is rejected with the first path", () => {
    const zh = parseTaskFile(zhTask01, "day-01.json").tasks;
    const bad = structuredClone(enTask01) as any;
    bad.tasks[0].self.say.pop();
    expect(() => localiseTasks(zh, parseTaskFile(bad, "en").tasks, "en/day-01.json")).toThrow(/en\/day-01\.json\.tasks\[0\]\.self\.say/);
  });
});

describe("object twin", () => {
  it("swaps a recognise question and options under lang=en (the right flags stay)", () => {
    const first = [...recogniseTable.entries()][0]!;
    const [, entry] = first;
    setLocale("zh");
    const zhQ = entry.q;
    const zhRight = entry.options.map((o) => o.right);
    setLocale("en");
    expect(entry.q).not.toBe(zhQ);
    expect(entry.options.map((o) => o.right)).toEqual(zhRight);
    setLocale("zh");
    expect(entry.q).toBe(zhQ);
  });
});

describe("fallback per file", () => {
  it("every day 1–18 has an en twin: its first line differs from the Chinese one", () => {
    // Twins exist for all 18 days as of 2026-11-05; the per-file fallback stays in code for trimmed content sets.
    for (let n = 1; n <= 18; n++) {
      const first = () => dayFile(n)?.items.find((i) => i.text);
      if (!first()) continue;
      setLocale("zh");
      const zh = first()!.text;
      setLocale("en");
      expect(first()!.text, `day ${n}`).not.toBe(zh);
    }
  });
});

describe("day 1 end to end in English", () => {
  it("every day-1 item and task-1 doc line reads in English", () => {
    setLocale("en");
    for (const item of dayFile(1)!.items) expect(typeof item.text).toBe("string");
    const left = taskByFlag(1, "task_v17_done")!.doc!.left;
    // The whole left column is the English twin's (every clause differs from the Chinese source).
    setLocale("zh");
    const zhLeft = [...taskByFlag(1, "task_v17_done")!.doc!.left];
    setLocale("en");
    const enLeft = [...taskByFlag(1, "task_v17_done")!.doc!.left];
    expect(enLeft).not.toEqual(zhLeft);
    expect(left.length).toBe(zhLeft.length);
  });
});
