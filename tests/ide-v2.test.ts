// ide v2 (2026-11-08): merge v16/v17, pull the latest data, snapshot — on day 1's board as it was before
// the compare redesign (author 2026-11-11), kept as tests/fixtures/board-ide-v2.json; day 3 is real.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/board-ide-v2.json";
import { canFetch, canPrint, freshBoard, mergesLeft, stepBoard, trayCards, type BoardState } from "@state/days/board";
import { ideSrc, ideTranscript } from "@state/days/ide";
import { parseTaskFile, taskByFlag, type TaskBoard } from "@state/days/tasks";

describe("ide v2: merge v16/v17, pull the latest data, snapshot (2026-11-08)", () => {
  const task1 = () => parseTaskFile({ day: 1, tasks: [structuredClone(fixture)] }, "fixture").tasks[0]!;
  const fillAll = (b: TaskBoard, s: BoardState) => b.slots.reduce((acc, sl) => stepBoard(b, acc, { t: "fill", slot: sl.id, card: sl.answer }), s);
  it("day 1's board carries three differing pages and an API; a merge keeps a side; a fetch happens once", () => {
    const b = task1().board!;
    expect(Object.keys(b.ide!.diff!)).toEqual(["r1", "r2", "r5"]);
    expect(b.ide!.api!.live).toBe("./api.js");
    let s = freshBoard(b);
    expect(mergesLeft(b, s)).toEqual(["r1", "r2", "r5"]);
    s = stepBoard(b, s, { t: "merge", slot: "r1", keep: "v16" });
    expect(s.merged).toEqual({ r1: "v16" });
    s = stepBoard(b, s, { t: "merge", slot: "r3", keep: "v17" }); // no difference on r3: ignored
    expect(s.merged).toEqual({ r1: "v16" });
    s = stepBoard(b, s, { t: "fetch" });
    expect(s.fetched).toBe(true);
    expect(stepBoard(b, s, { t: "fetch" })).toEqual(s);
  });
  it("打快照 waits for every page merged, every slot filled and the data pulled; 拉最新数据 for the first two", () => {
    const b = task1().board!;
    let s = fillAll(b, freshBoard(b));
    expect(canPrint(b, s)).toBe(false);
    expect(canFetch(b, s)).toBe(false);
    for (const id of ["r1", "r2", "r5"]) s = stepBoard(b, s, { t: "merge", slot: id, keep: "v17" });
    expect(canFetch(b, s)).toBe(true);
    expect(canPrint(b, s)).toBe(false);
    s = stepBoard(b, s, { t: "fetch" });
    expect(canPrint(b, s)).toBe(true);
  });
  it("the preview's query says which data it shows, and the snapshot once printed", () => {
    const b = task1().board!;
    let s = freshBoard(b);
    expect(ideSrc(b, s, [])).toContain("&data=live");
    s = stepBoard(b, s, { t: "fetch" });
    expect(ideSrc(b, s, [])).toContain("&data=fetched");
    expect(ideSrc(b, s, [])).not.toContain("snap=1");
    expect(ideSrc(b, s, [{ t: "print" }])).toContain("&data=fetched&snap=1");
  });
  it("the transcript: a page's merge beat by the side kept, `merge` once all three are merged, `fetch` once", () => {
    const b = task1().board!;
    const ons = (ops: Parameters<typeof ideTranscript>[1]) => ideTranscript(b, ops).filter((l) => !l.args).map((l) => l.on);
    // ide talk (2026-11-10): the open beat is three lines, a merge beat one remark (the choice / execution lines carry `args`)
    expect(ons([{ t: "merge", slot: "r1", keep: "v17" }])).toEqual(["open", "open", "merge:r1:v17"]);
    const all = ons([{ t: "merge", slot: "r1", keep: "v17" }, { t: "merge", slot: "r2", keep: "v16" }, { t: "merge", slot: "r5", keep: "v17" }, { t: "fetch" }, { t: "fetch" }]);
    expect(all.filter((o) => o === "merge")).toHaveLength(1);
    expect(all.filter((o) => o === "fetch")).toHaveLength(1); // the fetch beat is one remark now; a second fetch adds nothing
    expect(all.indexOf("merge")).toBeGreaterThan(all.indexOf("merge:r5:v17"));
  });
  it("the loader rejects a difference on the slot's own line, a bad line number, and a merge beat with a bad side", () => {
    const base = JSON.parse(JSON.stringify(task1()));
    const bad = (mut: (b: any) => void, msg: RegExp) => {
      const t = JSON.parse(JSON.stringify(base));
      mut(t.board);
      expect(() => parseTaskFile({ day: 1, tasks: [t] }, "t")).toThrow(msg);
    };
    bad((b) => (b.ide.diff.r1.line = 7), /slot's own line/);
    bad((b) => (b.ide.diff.r1.line = 99), /lines/);
    bad((b) => b.beats.push({ on: "merge:r1:v18", lines: [{ who: "kuro", text: "x" }] }), /merge:<slot>:<v16\|v17>/);
  });
});

describe("ide v2, day 3: the memo and the directions (2026-11-08)", () => {
  const task3 = () => taskByFlag(3, "task_d3_3")!;
  it("day 3's board: every card is a direction for one page, three per page and two for the references (照旧 / 换新的, compare 2026-11-12); none in the tray", () => {
    const b = task3().board!;
    expect(b.cards.every((c) => c.slot !== undefined && c.from === undefined)).toBe(true);
    for (const id of ["r1", "r2", "r3", "r4", "r5"]) expect(b.cards.filter((c) => c.slot === id)).toHaveLength(3);
    expect(b.cards.filter((c) => c.slot === "r6")).toHaveLength(2);
    expect(mergesLeft(b, freshBoard(b))).toEqual([]);
    expect(trayCards(b, freshBoard(b), 3, [], task3().id)).toEqual([]);
  });
  it("a direction fills only its page; the full reversal is the page's answer", () => {
    const b = task3().board!;
    let s = freshBoard(b);
    s = stepBoard(b, s, { t: "fill", slot: "r2", card: "o1c" }); // r1's direction on r2: ignored
    expect(s.slots).toEqual({});
    s = stepBoard(b, s, { t: "fill", slot: "r1", card: "o1c" });
    expect(s.slots).toEqual({ r1: "o1c" });
    expect(b.slots.find((sl) => sl.id === "r1")!.answer).toBe("o1c");
    expect(b.slots.find((sl) => sl.id === "r6")!.answer).toBe("o6");
  });
  it("the loader rejects a direction naming a missing slot, and one with a source", () => {
    const base = JSON.parse(JSON.stringify(task3()));
    const bad = (mut: (b: any) => void, msg: RegExp) => {
      const t = JSON.parse(JSON.stringify(base));
      mut(t.board);
      expect(() => parseTaskFile({ day: 3, tasks: [t] }, "t")).toThrow(msg);
    };
    bad((b) => (b.cards[0].slot = "r9"), /not a slot/);
    bad((b) => (b.cards[0].from = { conv: "boss" }), /no source/);
  });
});
