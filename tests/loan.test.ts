import { describe, expect, it } from "vitest";
import { LOAN_CHOICE_LEND, LOAN_CHOICE_REFUSE, type EventDraft } from "@state/events";
import { f } from "@state/fday";
import { constants } from "@state/variables";
import { lieDowns, play } from "./helpers";

const { loanReplyDay, repayDay, loanAmount } = constants;
const startBalance = f(1).balance;
const reply = (choice: string): EventDraft => ({ kind: "reply", choice });

/** Lie down until the counter reads loanReplyDay, reply, then lie down until `untilDay`. */
function loanRun(choice: string, untilDay: number) {
  return play(1, [
    ...lieDowns(loanReplyDay - 1),
    reply(choice),
    ...lieDowns(untilDay - loanReplyDay),
  ]);
}

describe("loan: lend", () => {
  it("is lent from the reply until the day before repayDay, and balance drops by loanAmount", () => {
    for (let day = loanReplyDay; day < repayDay; day++) {
      const state = loanRun(LOAN_CHOICE_LEND, day);
      expect(state.day, `day ${day}`).toBe(day);
      expect(state.loan, `loan on day ${day}`).toBe("lent");
      expect(state.balance, `balance on day ${day}`).toBe(startBalance - loanAmount);
    }
  });

  it("is repaid from repayDay on, and balance is restored", () => {
    for (const day of [repayDay, repayDay + 1, constants.lastDay, constants.lastDay + 5]) {
      const state = loanRun(LOAN_CHOICE_LEND, day);
      expect(state.loan, `loan on day ${day}`).toBe("repaid");
      expect(state.balance, `balance on day ${day}`).toBe(startBalance);
    }
  });

  it("repayment is not an event: the log holds only the reply and the lieDowns", () => {
    // Repaid state comes from the day counter alone, with no extra event appended.
    const drafts: EventDraft[] = [...lieDowns(loanReplyDay - 1), reply(LOAN_CHOICE_LEND), ...lieDowns(repayDay - loanReplyDay)];
    expect(drafts.filter((d) => d.kind !== "lieDown")).toHaveLength(1);
    expect(play(1, drafts).loan).toBe("repaid");
  });
});

describe("loan: refuse", () => {
  it("is refused for all later days and balance is unchanged", () => {
    for (const day of [loanReplyDay, repayDay - 1, repayDay, repayDay + 1, constants.lastDay + 3]) {
      const state = loanRun(LOAN_CHOICE_REFUSE, day);
      expect(state.loan, `loan on day ${day}`).toBe("refused");
      expect(state.balance, `balance on day ${day}`).toBe(startBalance);
    }
  });
});

describe("loan: none", () => {
  it("stays none with no reply at all, on every day", () => {
    for (let day = 1; day <= constants.lastDay + 2; day++) {
      const state = play(1, lieDowns(day - 1));
      expect(state.loan, `day ${day}`).toBe("none");
      expect(state.balance).toBe(startBalance);
    }
  });

  it("ignores a lend reply on the wrong day", () => {
    const early = play(1, [...lieDowns(loanReplyDay - 2), reply(LOAN_CHOICE_LEND)]);
    const late = play(1, [...lieDowns(loanReplyDay), reply(LOAN_CHOICE_LEND)]);
    expect(early.loan).toBe("none");
    expect(late.loan).toBe("none");
  });

  it("ignores any other choice on the loan day", () => {
    expect(loanRun("fine", loanReplyDay).loan).toBe("none");
    expect(loanRun("", loanReplyDay).loan).toBe("none");
  });

  it("the first loan reply wins", () => {
    const lendThenRefuse = play(1, [...lieDowns(loanReplyDay - 1), reply(LOAN_CHOICE_LEND), reply(LOAN_CHOICE_REFUSE)]);
    const refuseThenLend = play(1, [...lieDowns(loanReplyDay - 1), reply(LOAN_CHOICE_REFUSE), reply(LOAN_CHOICE_LEND)]);
    expect(lendThenRefuse.loan).toBe("lent");
    expect(refuseThenLend.loan).toBe("refused");
  });

  it("the ?day=N debug jump with no log has no loan", () => {
    expect(f(repayDay).loan).toBe("none");
    expect(f(repayDay).balance).toBe(startBalance);
  });
});
