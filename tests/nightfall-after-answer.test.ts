// Ledger #120③ (author 2026-11-27): when opening the box was the day's last thing, 「入夜了。」 came up between the object's
// question and its answer. What follows the answer now goes ahead of a nightfall line that is still waiting.
import { describe, expect, it } from "vitest";
import { EMPTY_DIALOGUE, push, pushBefore, type Queued } from "@world/loop/dialogue";

const line = (key: string): Queued => ({ key, lines: [{ k: "narration", t: key }], ending: { kind: "none" } });
const keys = (d: { queue: readonly Queued[] }) => d.queue.map((q) => q.key);

describe("a line that belongs before nightfall", () => {
  it("goes ahead of the waiting nightfall line; whatever came with it stays behind it", () => {
    let d = push(push(push(EMPTY_DIALOGUE, line("d3:recognise:pager")), line("d3:nightfall")), line("d3:hint:lamp"));
    d = pushBefore(d, line("d3:recognise:pager:answer"), "d3:nightfall");
    d = pushBefore(d, line("d3:tutor:pager"), "d3:nightfall");
    expect(keys(d)).toEqual(["d3:recognise:pager", "d3:recognise:pager:answer", "d3:tutor:pager", "d3:nightfall", "d3:hint:lamp"]);
  });
  it("nightfall first in line and not begun: still ahead of it; already being read: behind it", () => {
    const head = push(EMPTY_DIALOGUE, line("d3:nightfall"));
    expect(keys(pushBefore(head, line("a"), "d3:nightfall"))).toEqual(["a", "d3:nightfall"]);
    expect(keys(pushBefore({ ...head, line: 1 }, line("a"), "d3:nightfall"))).toEqual(["d3:nightfall", "a"]);
  });
  it("no nightfall waiting: a plain push; the same line is not queued twice", () => {
    const d = pushBefore(push(EMPTY_DIALOGUE, line("x")), line("a"), "d3:nightfall");
    expect(keys(d)).toEqual(["x", "a"]);
    expect(keys(pushBefore(d, line("a"), "d3:nightfall"))).toEqual(["x", "a"]);
  });
});
