import { describe, expect, it } from "vitest";
import { f } from "@state/fday";
import { replyTable, type Entry } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { lineTiming, planGoneClick, planReply, RECALL_MS, TYPING_MS, type ReplyInput } from "@world/replies/plan";

const objectFor = (word: string) => Object.entries(f(1).objectWords).find(([, lent]) => lent.word === word)![0];
const found = (day: number, ...words: string[]): State => ({
  ...f(day),
  found: words.map(objectFor) as State["found"],
});
const cell = (day: number, recipient: string, word: string) => replyTable.get(day)!.recipients.get(recipient)!.cells.get(word)!;
const plan = (over: Partial<ReplyInput> & Pick<ReplyInput, "day" | "recipient" | "word">) =>
  planReply({ state: f(over.day), now: "09:00", ...over });
const types = (p: ReturnType<typeof planReply>) => p.steps.map((s) => s.action.type);

/** The first cell matching `test`, scanning every day and recipient. */
function findCell(test: (entry: Entry) => boolean) {
  for (const [day, table] of replyTable) {
    for (const [recipient, { cells }] of table.recipients) {
      for (const [word, entry] of cells) if (test(entry)) return { day, recipient, word, entry };
    }
  }
  throw new Error("no such cell in content");
}

describe("lineTiming", () => {
  it("delivers a past or current line at once, a later one at its beat time", () => {
    expect(lineTiming("09:14", "10:00")).toEqual({ kind: "now" });
    expect(lineTiming("09:14", "09:14")).toEqual({ kind: "now" });
    expect(lineTiming("09:14", "09:00")).toEqual({ kind: "atBeat", t: "09:14" });
  });
});

describe("planReply", () => {
  it("reply: the player's own line, then the lines with their own times", () => {
    const p = plan({ day: 1, recipient: "boss", word: "fine" });
    expect(types(p)).toEqual(["own", "deliver"]);
    expect(p.steps[0]!.action).toEqual({ type: "own", conversation: "boss", word: "fine", labelKey: "reply.boss.fine" });
    expect(p.steps[1]).toEqual({
      at: { kind: "atBeat", t: cell(1, "boss", "fine").lines[0]!.t },
      action: { type: "deliver", conversation: "boss", line: cell(1, "boss", "fine").lines[0], badge: false, placement: "received", noReadReceipt: false },
    });
    expect(p.inner).toBe(cell(1, "boss", "fine").inner);
    expect(plan({ day: 1, recipient: "boss", word: "fine", now: "12:00" }).steps[1]!.at).toEqual({ kind: "now" });
  });

  it("read: 已读 after readAfter, then the interrupt in the other conversation", () => {
    const p = plan({ day: 1, recipient: "boss", word: "salary" });
    expect(types(p)).toEqual(["own", "readReceipt", "deliver"]);
    expect(p.steps[1]!.at).toEqual({ kind: "afterMs", ms: 3_000 });
    const interrupt = cell(1, "boss", "salary").interrupt!;
    expect(p.steps[2]!.action).toMatchObject({ type: "deliver", conversation: interrupt.where, line: { t: interrupt.t, text: interrupt.text } });
  });

  it("read with 1d: 已读 at the next boot", () => {
    const c = findCell((e) => e.readAfter === "1d");
    const p = planReply({ day: c.day, recipient: c.recipient, word: c.word, state: found(c.day, ...Object.values(f(1).objectWords).map((w) => w.word as string)), now: "09:00" });
    expect(p.steps.find((s) => s.action.type === "readReceipt")!.at).toEqual({ kind: "nextBoot" });
  });

  it("read with no readAfter: 已读 at once", () => {
    expect(cell(1, "group", "salary").readAfter).toBeUndefined();
    expect(plan({ day: 1, recipient: "group", word: "salary" }).steps[1]!.at).toEqual({ kind: "now" });
  });

  it("an interrupt into another conversation badges it", () => {
    const p = plan({ day: 1, recipient: "boss", word: "whatever" });
    const last = p.steps.at(-1)!.action;
    expect(last).toMatchObject({ type: "deliver", conversation: "group", badge: true });
  });

  it("typing: 正在输入, then nothing, after 4–8 s", () => {
    const p = plan({ day: 2, recipient: "partner", word: "salary" });
    expect(cell(2, "partner", "salary").status).toBe("typing");
    expect(p.steps.map((s) => s.action)).toEqual([
      expect.objectContaining({ type: "own" }),
      { type: "typing", conversation: "partner", on: true },
      { type: "typing", conversation: "partner", on: false },
    ]);
    const off = p.steps[2]!.at as { kind: "afterMs"; ms: number };
    expect(off.ms).toBeGreaterThanOrEqual(TYPING_MS[0]);
    expect(off.ms).toBeLessThanOrEqual(TYPING_MS[1]);
  });

  it("recalled: the lines arrive, then are recalled after 2–5 s", () => {
    const p = planReply({ day: 5, recipient: "partner", word: "no", state: found(5, "no"), now: "09:00" });
    expect(types(p)).toEqual(["own", "deliver", "recall"]);
    const recall = p.steps[2]!;
    expect(recall.action).toEqual({ type: "recall", conversation: "partner", count: cell(5, "partner", "no").lines.length });
    const ms = (recall.at as { ms: number }).ms;
    expect(ms).toBeGreaterThanOrEqual(RECALL_MS[0]);
    expect(ms).toBeLessThanOrEqual(RECALL_MS[1]);
  });

  it("silence: sent, and no receipt at all", () => {
    const p = planReply({ day: 7, recipient: "partner", word: "im-going-in", state: found(7, "im-going-in"), now: "09:00" });
    expect(types(p)).toEqual(["own"]);
    expect(p.inner).toBe(cell(7, "partner", "im-going-in").inner);
  });

  it("deregistered: nothing is sent, the input closes, the inner line shows", () => {
    const p = planReply({ day: 13, recipient: "xiaozhang", word: "fine", state: f(13), now: "09:00" });
    expect(p.steps).toEqual([{ at: { kind: "now" }, action: { type: "disableInput", conversation: "xiaozhang" } }]);
    expect(p.inner).toBe(cell(13, "xiaozhang", "fine").inner);
  });

  it("free text is carried on the player's own line", () => {
    const p = plan({ day: 1, recipient: "group", word: "free", text: "你们好" });
    expect(p.steps[0]!.action).toEqual({ type: "own", conversation: "group", word: "free", labelKey: null, text: "你们好" });
  });

  it("keeps placeholders raw", () => {
    const p = plan({ day: 1, recipient: "xiaozhang", word: "fine" });
    const delivered = p.steps.find((s) => s.action.type === "deliver")!.action as { line: { text: string } };
    expect(delivered.line.text).toContain("{calledBy}");
  });

  it("is deterministic", () => {
    const input = { day: 2, recipient: "partner", word: "salary", state: f(2), now: "09:00" };
    expect(planReply(input)).toEqual(planReply(input));
  });

  it("a gone word gives the gone-click plan; a word off the menu throws", () => {
    expect(plan({ day: 10, recipient: "boss", word: "whatever" })).toEqual(planGoneClick(10, "boss", "whatever", f(10)));
    expect(() => plan({ day: 5, recipient: "boss", word: "no" })).toThrow(/not on/);
    expect(() => plan({ day: 1, recipient: "boss", word: "fine", now: "9:00" })).toThrow(/HH:MM/);
  });
});

describe("planGoneClick", () => {
  it("shows the cell's inner line and sends nothing", () => {
    expect(planGoneClick(10, "boss", "whatever", f(10))).toEqual({
      steps: [],
      inner: cell(10, "boss", "whatever").inner,
      hintKey: null,
    });
  });

  it("falls back to the gone hint when the cell has no inner line", () => {
    expect(planGoneClick(13, "xiaozhang", "salary", f(13))).toEqual({ steps: [], inner: null, hintKey: "reply.hint.gone" });
  });

  it("throws for a word that is not gone", () => {
    expect(() => planGoneClick(1, "boss", "fine", f(1))).toThrow(/not gone/);
  });
});
