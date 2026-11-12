// work spec (2026-11-02) "marking is the operation" and "two modes for every kind": marks and their
// pens, the two ways to mark (click a line / drag a span), the code surface, Kuro's reaction when
// caught, a kuro spot hidden from the diff, the units flow in 自己做, and the held dictionary's gloss.
// The loader is strict about marks/units/code; the task event records the marks and replays the same.
import "./specimen";
import { describe, expect, it, vi } from "vitest";

// Claude's unit chips and (for the gloss) a contract note on a dictionary word: the fixtures below
// carry the Chinese; the strings fall back to the literals only here, under content's own.
vi.mock("@content/strings/zh.json", async (importOriginal) => {
  const real = (await importOriginal<{ default: Record<string, string> }>()).default;
  return { default: { "wb.unit.wrong": "这里不对", "wb.unit.next": "下一段", ...real } };
});

import { parseTaskFile, type Task } from "@state/days/tasks";
import {
  LOOK_PENS,
  canMark,
  eventMarks,
  hitWorth,
  isHidden,
  pensFor,
  pensLeft,
  spotHit,
  type Mark,
} from "@world/desktop/workbench/marks";
import { applyEvent } from "@state/events";
import { createStore } from "@state/store";

// ——— fixtures: a document with marks + units, and a code file with a hidden kuro spot ———

/** A docs task whose done flag matches day-1 task1, with marks, a dictionary word, and units. */
const DOC = {
  day: 1,
  tasks: [
    {
      id: "t",
      title: "合同",
      app: "docs",
      done: "task_v17_done",
      start: { say: [{ k: "narration", t: "两版并排。" }], options: [{ mode: "self", goto: "self" }, { mode: "look", goto: "look" }, { mode: "let", goto: "let" }] },
      self: { say: [{ k: "narration", t: "你读。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_a"] } },
      look: { say: [{ k: "narration", t: "你扫了一眼。" }], kuro: [], effects: { flags: ["task_v17_done"], looked: true } },
      let: { say: [{ k: "narration", t: "你通过了。" }], kuro: [], effects: { flags: ["task_v17_done"], letItDoUnchecked: 1 } },
      doc: {
        left: ["Clause one is fine.", "Clause two says indemnity for all claims.", "Clause three is fine."],
        right: ["Clause one is fine.", "Clause two says indemnity for all claims.", "Clause three is fine."],
        conflict: [0, 2],
        catchFlags: ["caught_a"],
        units: [{ text: "Clause one is fine." }, { text: "Clause two says indemnity for all claims.", fix: "Clause two is now capped." }, { text: "Clause three is fine." }],
        marks: [
          { clause: 1, kind: "kuro", worth: 2, caught: "我以为你不会读到那里。", word: "indemnity", span: [16, 25] },
        ],
      },
    },
  ],
};

/** A code task (its own app "code") with two marks, one of them a hidden kuro spot. */
const CODE = {
  day: 1,
  tasks: [
    {
      id: "c",
      title: "diff",
      app: "code",
      done: "task_v17_done",
      start: { say: [{ k: "narration", t: "一段 diff。" }], options: [{ mode: "self", goto: "self" }, { mode: "look", goto: "look" }, { mode: "let", goto: "let" }] },
      self: { say: [{ k: "narration", t: "你读代码。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_code"] } },
      look: { say: [{ k: "narration", t: "你扫了一眼。" }], kuro: [], effects: { flags: ["task_v17_done"], looked: true } },
      let: { say: [{ k: "narration", t: "你通过了。" }], kuro: [], effects: { flags: ["task_v17_done"], letItDoUnchecked: 1 } },
      code: {
        lines: ["function pay(amount) {", "  return amount * rate;", "  log(secretKey);", "}"],
        catchFlags: ["caught_code"],
        marks: [
          { clause: 1, kind: "conflict", worth: 2 },
          { clause: 2, kind: "kuro", worth: 2, hidden: true, caught: "那一行不是你写的。" },
        ],
      },
    },
  ],
};

const docTask = (): Task => parseTaskFile(DOC, "fixture-doc").tasks[0]!;
const codeTask = (): Task => parseTaskFile(CODE, "fixture-code").tasks[0]!;

describe("the loader accepts marks / units / code, strictly", () => {
  it("a document's marks and units parse; a code file's marks parse", () => {
    const d = docTask();
    expect(d.doc!.marks).toHaveLength(1);
    expect(d.doc!.marks![0]).toMatchObject({ clause: 1, kind: "kuro", worth: 2, word: "indemnity", span: [16, 25] });
    expect(d.doc!.units).toHaveLength(3);
    expect(d.doc!.units![1]).toEqual({ text: "Clause two says indemnity for all claims.", fix: "Clause two is now capped." });
    const c = codeTask();
    expect(c.code!.lines).toHaveLength(4);
    expect(c.code!.marks![1]).toMatchObject({ clause: 2, kind: "kuro", hidden: true });
  });

  const bad = (fixture: unknown, edit: (t: any) => void, msg: RegExp) => {
    const raw = structuredClone(fixture) as any;
    edit(raw);
    expect(() => parseTaskFile(raw, "fixture")).toThrow(msg);
  };
  it("rejects a mark clause out of range", () => bad(DOC, (r) => (r.tasks[0].doc.marks[0].clause = 99), /index/));
  it("rejects a mark worth other than 1 or 2", () => bad(DOC, (r) => (r.tasks[0].doc.marks[0].worth = 3), /worth/));
  it("rejects a span outside the clause", () => bad(DOC, (r) => (r.tasks[0].doc.marks[0].span = [0, 999]), /start < end/));
  it("rejects hidden on a non-kuro spot", () => bad(CODE, (r) => (r.tasks[0].code.marks[0].hidden = true), /only a kuro spot/));
  it("rejects a code file on a docs task", () =>
    bad(
      DOC,
      (r) => {
        const codeBlock = structuredClone((CODE.tasks[0] as any).code);
        codeBlock.catchFlags = ["caught_a"]; // a flag the DOC task's self path sets, so the app check is reached
        r.tasks[0].code = codeBlock;
      },
      /app "code"/,
    ));
  it("rejects an unknown mark key", () => bad(DOC, (r) => (r.tasks[0].doc.marks[0].extra = 1), /unknown key/));
  it("rejects an empty unit list", () => bad(DOC, (r) => (r.tasks[0].doc.units = []), /non-empty/));
});

describe("the pens (self unlimited, look three)", () => {
  it("self never runs out; look loses one per mark", () => {
    expect(pensFor("self")).toBe(Infinity);
    expect(pensLeft("self", 99)).toBe(Infinity);
    expect(canMark("self", 99)).toBe(true);
    expect(pensLeft("look", 0)).toBe(LOOK_PENS);
    expect(pensLeft("look", 2)).toBe(1);
    expect(pensLeft("look", 3)).toBe(0);
    expect(canMark("look", 3)).toBe(false);
  });
});

describe("spotHit and worth (the two ways to mark)", () => {
  const marks = docTask().doc!.marks!;
  it("a click on the listed clause hits; another clause misses", () => {
    expect(spotHit(marks, 1)).not.toBeNull();
    expect(spotHit(marks, 0)).toBeNull();
  });
  it("a span overlapping the spot's span hits; one beside it misses", () => {
    expect(spotHit(marks, 1, [15, 20])).not.toBeNull();
    expect(spotHit(marks, 1, [0, 5])).toBeNull();
  });
  it("a click credits full worth; a span credits half, rounded down, min 1", () => {
    const spot = marks[0]!;
    expect(hitWorth(spot)).toBe(2);
    expect(hitWorth(spot, [15, 20])).toBe(1);
    expect(hitWorth({ ...spot, worth: 1 }, [15, 20])).toBe(1);
  });
});

describe("hidden spots (day 7+)", () => {
  it("a hidden kuro spot reads as hidden; a plain one does not", () => {
    const [plain, hidden] = codeTask().code!.marks!;
    expect(isHidden(hidden!)).toBe(true);
    expect(isHidden(plain!)).toBe(false);
  });
});

describe("the task event records the marks and replays the same", () => {
  it("eventMarks keeps clause + hit, in order", () => {
    const made: Mark[] = [
      { clause: 1, hit: true, worth: 2 },
      { clause: 0, hit: false, worth: 0 },
    ];
    expect(eventMarks(made)).toEqual([{ clause: 1, hit: true }, { clause: 0, hit: false }]);
  });

  // Against the real day-1 task1 (its catch flag is caught_6_11, clause 10 is a conflict spot).
  it("a hit earns the catch flag; a miss drops it; replay is identical", () => {
    const s0 = createStore({ startDay: 1 }).getState();
    const withHit = applyEvent(s0, { kind: "task", day: 1, flag: "task_v17_done", mode: "self", marks: [{ clause: 10, hit: true }] });
    expect(withHit.flags).toContain("caught_6_11");
    const withMiss = applyEvent(s0, { kind: "task", day: 1, flag: "task_v17_done", mode: "self", marks: [{ clause: 0, hit: false }] });
    expect(withMiss.flags).not.toContain("caught_6_11");
    // Two stores fed the identical event give deep-equal state (replay idempotence).
    const one = createStore({ startDay: 1 });
    const two = createStore({ startDay: 1 });
    const mark = { kind: "task", flag: "task_v17_done", mode: "self", marks: [{ clause: 10, hit: true }] } as const;
    one.appendEvent(mark);
    two.appendEvent(mark);
    expect(one.getState().flags).toEqual(two.getState().flags);
    expect(one.getState().flags).toContain("caught_6_11");
  });

  it("the reducer refuses marks on a let / auto path", () => {
    const s = createStore({ startDay: 1 }).getState();
    expect(() => applyEvent(s, { kind: "task", day: 1, flag: "task_v17_done", mode: "let", marks: [{ clause: 0, hit: true }] })).toThrow(/read mode/);
  });
});
