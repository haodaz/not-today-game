// The day-loop's events (design L1/L2). Pure, clock-free.
//   step    a loop moment the world has no event for; changes nothing (the checklist reads it)
//   choose  a dialogue choice; applies the choice's effects
//   task    a work-task flag (stand-in for content/tasks/); "let" counts as let-it-do unchecked
import { withFlags } from "../flags";
import { condHolds } from "../replies/resolve";
import type { State } from "../types.gen";
import { constants, rangeOf } from "../variables";
import { dayFile, taskFlags, type BeatName } from "./table";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STEP = /^(boot|openApp:(msgs|workbench|browser)|eat:(lunch|dinner)|beat:(desk|shutdown)|delivery:arrives:(lunch|dinner)|chat:any)$/;

export const TASK_MODES = ["self", "look", "let"] as const;
export type TaskMode = (typeof TASK_MODES)[number];

export function isStepName(name: string): boolean {
  return STEP.test(name);
}

export function applyStep(state: State, event: { readonly name: string; readonly t: string }): State {
  if (!isStepName(event.name)) throw new Error(`step: unknown step "${event.name}"`);
  if (!HHMM.test(event.t)) throw new Error(`step: time must be HH:MM, got "${event.t}"`);
  return state;
}

function clampSan(value: number): number {
  const [min, max] = rangeOf("san") ?? [null, null];
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

/** The choice `index` of beat `beat` on `day`, or undefined. */
export function choiceOf(day: number, beat: string, index: number) {
  return dayFile(day)?.beats[beat as BeatName]?.choices?.[index];
}

export function applyChoose(state: State, event: { readonly day: number; readonly beat: string; readonly index: number }): State {
  const choice = choiceOf(event.day, event.beat, event.index);
  if (!choice) throw new Error(`choose: day ${event.day} ${event.beat} has no choice ${event.index}`);
  if (!condHolds(choice.cond_show, state)) throw new Error(`choose: choice ${event.index} is not offered now`);
  const effects = choice.effects ?? {};
  let next = withFlags(state, effects.flags);
  if (effects.san) next = { ...next, san: clampSan(next.san + effects.san) };
  if (effects.item_dream) {
    // "hand object => 3 days" (variables.json): the object is in dream state until then.
    next = { ...next, dream: { ...next.dream, [effects.item_dream]: { until: event.day + constants.dreamDays } } };
  }
  // effects.item_lost ("loan") has no variable to land in; the event itself is the record.
  return next;
}

export function applyTask(state: State, event: { readonly day: number; readonly flag: string; readonly mode: string }): State {
  if (!(TASK_MODES as readonly string[]).includes(event.mode)) throw new Error(`task: unknown mode "${event.mode}"`);
  if (!taskFlags(event.day).includes(event.flag)) throw new Error(`task: "${event.flag}" is not a task of day ${event.day}`);
  const next = withFlags(state, [event.flag]);
  return event.mode === "let" ? { ...next, letItDoUnchecked: next.letItDoUnchecked + 1 } : next;
}
