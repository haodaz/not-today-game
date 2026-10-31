// The day-loop's events. Pure, clock-free.
//   step    a loop moment the world has no event for; changes nothing (the checklist reads it)
//   choose  a dialogue choice; applies the choice's effects
//   task    a work task done one of three ways (content/tasks), or ticked by itself ("auto")
import { withFlags } from "../flags";
import { condHolds } from "../replies/resolve";
import type { State } from "../types.gen";
import { constants, membersOf, rangeOf } from "../variables";
import { dayFile, taskFlags, type BeatName, type Choice } from "./table";
import { taskByFlag } from "./tasks";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const STEP = /^(boot|openApp:(msgs|workbench|browser)|eat:(lunch|dinner)|beat:(desk|shutdown)|delivery:arrives:(lunch|dinner)|chat:any)$/;

/** The three ways the player can do a work task (the workbench modes). */
export const TASK_MODES = ["self", "look", "let"] as const;
export type TaskMode = (typeof TASK_MODES)[number];
/** A task event's mode: one of the player's three, or "auto" (the item ticked itself). */
export type TaskEventMode = TaskMode | "auto";

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
export function choiceOf(day: number, beat: string, index: number): Choice | undefined {
  return dayFile(day)?.beats[beat as BeatName]?.choices?.[index];
}

/**
 * Whether a choice is offered now: its cond_show holds, and it does not hold up an object that
 * has been upgraded (object-upgrade FR2: the hand does not want it; nothing says why).
 */
export function choiceOffered(choice: Choice, state: State): boolean {
  if (!condHolds(choice.cond_show, state)) return false;
  const object = choice.effects?.item_dream ?? choice.effects?.item_lost;
  return !(object && state.upgraded[object] === true);
}

export function applyChoose(state: State, event: { readonly day: number; readonly beat: string; readonly index: number }): State {
  const choice = choiceOf(event.day, event.beat, event.index);
  if (!choice) throw new Error(`choose: day ${event.day} ${event.beat} has no choice ${event.index}`);
  if (!choiceOffered(choice, state)) throw new Error(`choose: choice ${event.index} is not offered now`);
  const effects = choice.effects ?? {};
  let next = withFlags(state, effects.flags);
  if (effects.san) next = { ...next, san: clampSan(next.san + effects.san) };
  if (effects.item_dream) {
    // "hand object => 3 days" (variables.json): the object is in dream state until then.
    next = { ...next, dream: { ...next.dream, [effects.item_dream]: { until: event.day + constants.dreamDays } } };
  }
  if (effects.item_lost && !next.lost.includes(effects.item_lost)) {
    // Handed to the hand: lost until the day-17 bag brings it back (delivery applyPickup).
    next = { ...next, lost: [...next.lost, effects.item_lost] };
  }
  return next;
}

/** What `item_lost` may name: the loan row or one of the objects. */
export function isLosable(id: string): boolean {
  return id === "loan" || (membersOf("found") ?? []).includes(id);
}

export function applyTask(state: State, event: { readonly day: number; readonly flag: string; readonly mode: string }): State {
  if (event.mode !== "auto" && !(TASK_MODES as readonly string[]).includes(event.mode)) throw new Error(`task: unknown mode "${event.mode}"`);
  if (!taskFlags(event.day).includes(event.flag)) throw new Error(`task: "${event.flag}" is not a task of day ${event.day}`);
  const tree = taskByFlag(event.day, event.flag);
  if (event.mode === "auto" || !tree) {
    // Ticked by itself (or a task with no tree): only the done flag.
    return withFlags(state, [event.flag]);
  }
  const effects = tree[event.mode as TaskMode].effects;
  let next = withFlags(state, [...(effects.flags ?? []), event.flag]);
  if (effects.san) next = { ...next, san: clampSan(next.san + effects.san) };
  if (effects.letItDoUnchecked) next = { ...next, letItDoUnchecked: next.letItDoUnchecked + effects.letItDoUnchecked };
  // effects.looked: the event (mode "look") is the record the rubric cites.
  return next;
}
