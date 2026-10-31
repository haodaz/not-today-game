// f(startDay): the deterministic starting state for a day, and derive(): everything that is a
// function of the `day` counter alone. Constants and the stage table are read, never inlined.
import { applyUndeliveredMealFlags } from "./delivery/effects";
import { applyIncomingFlags } from "./replies/effects";
import { stageOf } from "./stages";
import type { State } from "./types.gen";
import { constants, defaults } from "./variables";

/**
 * Brings the day-driven fields in line with `state.day`:
 *   stage       = stages.json byDay[day] (afterDay18 past the table)
 *   overdueDays = constants.overdueBase + day
 *   loan        = "repaid" once day >= constants.repayDay, if it was "lent"; balance is given back.
 *   flags       += the flags of every incoming reply-table message for days 1..day.
 * Pure and idempotent: derive(derive(s)) equals derive(s). Reads no clock.
 */
export function derive(state: State): State {
  let next = state;

  const stage = stageOf(next.day);
  const overdueDays = constants.overdueBase + next.day;
  if (next.stage !== stage || next.overdueDays !== overdueDays) {
    next = { ...next, stage, overdueDays };
  }

  if (next.loan === "lent" && next.day >= constants.repayDay) {
    // The world returns the money. Adding it back (not resetting) keeps other balance changes.
    next = { ...next, loan: "repaid", balance: next.balance + constants.loanAmount };
  }

  // Messages that arrive whether or not the player answers (replies spec), and meals that never
  // come (delivery spec). Last, because their conditions may read the loan.
  return applyUndeliveredMealFlags(applyIncomingFlags(next));
}

/**
 * The starting state for `startDay`: every variable at its default, `day` set, day-driven fields
 * derived. A normal run starts at 1. The `?day=N` debug jump is `f(N)` with an empty log.
 */
export function f(startDay: number): State {
  if (!Number.isInteger(startDay) || startDay < 1) {
    throw new RangeError(`startDay must be an integer >= 1, got ${startDay}`);
  }
  return derive({ ...(defaults() as unknown as State), day: startDay });
}
