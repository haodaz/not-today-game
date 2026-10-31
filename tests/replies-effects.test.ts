import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { EventDraft } from "@state/events";
import { f } from "@state/fday";
import { applyIncomingFlags, applyReplyEvent } from "@state/replies/effects";
import { DEREGISTERED_BY_FLAG, isDeregistered } from "@state/replies/resolve";
import { replyTable } from "@state/replies/table";
import type { State } from "@state/types.gen";
import { constants } from "@state/variables";
import { draftArb, lieDowns, play, stampLog } from "./helpers";
import { fold } from "@state/replay";

const objectFor = (word: string) => Object.entries(f(1).objectWords).find(([, lent]) => lent.word === word)![0];
const cell = (day: number, recipient: string, word: string) => replyTable.get(day)!.recipients.get(recipient)!.cells.get(word)!;
const say = (recipient: string, choice: string): EventDraft => ({ kind: "reply", choice, recipient });

describe("applyReplyEvent", () => {
  const chick = objectFor("no");
  const day5 = (over: Partial<State> = {}): State => ({ ...f(5), found: [chick] as State["found"], ...over });

  it("adds the entry's flags, moves san, and uses up the lent word", () => {
    const entry = cell(5, "group", "no");
    const after = applyReplyEvent(day5({ san: 50 }), { day: 5, recipient: "group", choice: "no" });
    for (const flag of entry.effects!.flags!) expect(after.flags).toContain(flag);
    expect(after.san).toBe(50 + entry.effects!.san!);
    expect(after.objectWords[chick]!.used).toBe(true);
  });

  it("clamps san to the variable table's range", () => {
    const after = applyReplyEvent(day5({ san: 100 }), { day: 5, recipient: "group", choice: "no" });
    expect(after.san).toBe(100);
  });

  it("a lent word is not consumed: it plays again for someone else, and `used` stays recorded", () => {
    const once = applyReplyEvent(day5({ san: 50 }), { day: 5, recipient: "group", choice: "no" });
    const twice = applyReplyEvent(once, { day: 5, recipient: "boss", choice: "no" });
    for (const flag of cell(5, "boss", "no").effects!.flags!) expect(twice.flags).toContain(flag);
    expect(twice.objectWords[chick]!.used).toBe(true);
  });

  it("a lent word whose object was handed to the hand sends nothing", () => {
    const lost = day5({ lost: [chick] });
    expect(applyReplyEvent(lost, { day: 5, recipient: "group", choice: "no" })).toBe(lost);
  });

  it("does nothing for a gone word, a word not on the menu, or an unfound object's word", () => {
    const d10 = f(10);
    expect(applyReplyEvent(d10, { day: 10, recipient: "boss", choice: "whatever" })).toBe(d10);
    expect(applyReplyEvent(d10, { day: 10, recipient: "boss", choice: "no-such-word" })).toBe(d10);
    const d5 = f(5);
    expect(applyReplyEvent(d5, { day: 5, recipient: "group", choice: "no" })).toBe(d5);
  });

  it("does nothing for a deregistered recipient: the message cannot go", () => {
    const d13 = { ...f(13), found: [objectFor("im-going-in")] as State["found"] };
    expect(isDeregistered("xiaozhang", d13)).toBe(true);
    const after = applyReplyEvent(d13, { day: 13, recipient: "xiaozhang", choice: "im-going-in" });
    expect(after).toBe(d13);
  });

  it("plain words with no effects change nothing", () => {
    const d1 = f(1);
    expect(applyReplyEvent(d1, { day: 1, recipient: "boss", choice: "fine" })).toBe(d1);
  });

  it("rejects a recipient that exists on no day", () => {
    expect(() => applyReplyEvent(f(1), { day: 1, recipient: "nobody", choice: "fine" })).toThrow(/unknown recipient/);
  });

  it("works through the event log", () => {
    const state = play(1, [
      { kind: "openLayer", objectId: chick },
      ...lieDowns(4),
      say("group", "no"),
      say("group", "whatever"),
    ]);
    expect(state.day).toBe(5);
    expect(state.flags).toContain(cell(5, "group", "no").effects!.flags![0]);
    expect(state.objectWords[chick]!.used).toBe(true);
    expect(state.loan).toBe("none");
  });

  it("day 1 group `whatever` sets its flag", () => {
    const flag = cell(1, "group", "whatever").effects!.flags![0]!;
    expect(play(1, [say("group", "whatever")]).flags).toContain(flag);
  });
});

describe("applyIncomingFlags", () => {
  /** The first day on which an incoming message carries a flag, and that flag. */
  const first = (() => {
    for (const [day, table] of replyTable) {
      for (const { incoming } of table.recipients.values()) {
        const item = incoming.find((i) => i.effects?.flags?.length && !i.cond_show);
        if (item) return { day, flag: item.effects!.flags![0]! };
      }
    }
    throw new Error("no incoming flags in content");
  })();

  it("adds a day's incoming flags from that day on, not before", () => {
    expect(f(first.day).flags).toContain(first.flag);
    if (first.day > 1) expect(f(first.day - 1).flags).not.toContain(first.flag);
    expect(f(constants.lastDay + 3).flags).toContain(first.flag);
  });

  it("deregisters xiaozhang on the day his account goes, from the content", () => {
    const flag = DEREGISTERED_BY_FLAG.xiaozhang!;
    const day = [...replyTable].find(([, t]) =>
      t.recipients.get("xiaozhang")!.incoming.some((i) => i.effects?.flags?.includes(flag)),
    )![0];
    expect(isDeregistered("xiaozhang", f(day))).toBe(true);
    expect(isDeregistered("xiaozhang", f(day - 1))).toBe(false);
  });

  it("arrives on the lieDown that starts the day, in the event log too", () => {
    const state = play(first.day - 1 || 1, first.day > 1 ? lieDowns(1) : []);
    expect(state.flags).toContain(first.flag);
  });

  it("is idempotent", () => {
    const once = applyIncomingFlags(f(15));
    expect(applyIncomingFlags(once)).toBe(once);
  });
});

describe("properties with conversation replies in the log", () => {
  it("replay is still idempotent", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), fc.array(draftArb, { maxLength: 120 }), (startDay, drafts) => {
        const log = stampLog(startDay, drafts);
        expect(fold(log, f(startDay))).toEqual(fold(log, f(startDay)));
      }),
    );
  });

  it("a conversation reply never decides the loan and never moves the day", () => {
    fc.assert(
      fc.property(fc.array(draftArb, { maxLength: 80 }), (drafts) => {
        const conversation = drafts.filter((d) => d.kind === "reply" && d.recipient !== undefined);
        const state = play(1, [...lieDowns(constants.loanReplyDay - 1), ...conversation]);
        expect(state.loan).toBe("none");
        expect(state.day).toBe(constants.loanReplyDay);
      }),
    );
  });

  it("san stays inside the table range and flags stay a set", () => {
    fc.assert(
      fc.property(fc.array(draftArb, { maxLength: 150 }), (drafts) => {
        const state = play(1, drafts);
        expect(state.san).toBeGreaterThanOrEqual(0);
        expect(state.san).toBeLessThanOrEqual(100);
        expect(new Set(state.flags).size).toBe(state.flags.length);
      }),
    );
  });
});
