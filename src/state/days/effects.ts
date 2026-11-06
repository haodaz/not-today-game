// The day-loop's events. Pure, clock-free.
//   step    a loop moment the world has no event for; changes nothing (the checklist reads it)
//   choose  a dialogue choice; applies the choice's effects
//   task    a work task done one of three ways (content/tasks), or ticked by itself ("auto")
import { withFlags } from "../flags";
import { condHolds } from "../replies/resolve";
import type { State } from "../types.gen";
import { handNight } from "./board";
import { constants, rangeOf } from "../variables";
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

/** SAN within its range (variables.json). */
export function clampSan(value: number): number {
  const [min, max] = rangeOf("san") ?? [null, null];
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

/** Assimilation within its range (0–100). Three-meters spec: it only ever goes up. */
export function clampAssimilation(value: number): number {
  const [min, max] = rangeOf("assimilation") ?? [0, 100];
  return Math.min(max ?? 100, Math.max(min ?? 0, value));
}

/** Raise assimilation by `n` (never below the current value, never past the max). */
export function raiseAssimilation(state: State, n: number): State {
  if (!n) return state;
  const next = clampAssimilation(state.assimilation + Math.max(0, n));
  return next > state.assimilation ? { ...state, assimilation: next } : state;
}

/** The choice `index` of beat `beat` on `day`, or undefined. */
export function choiceOf(day: number, beat: string, index: number): Choice | undefined {
  return dayFile(day)?.beats[beat as BeatName]?.choices?.[index];
}

/** Whether a choice is offered now: its cond_show holds. */
export function choiceOffered(choice: Choice, state: State): boolean {
  return condHolds(choice.cond_show, state);
}

export function applyChoose(state: State, event: { readonly day: number; readonly beat: string; readonly index: number }): State {
  const choice = choiceOf(event.day, event.beat, event.index);
  if (!choice) throw new Error(`choose: day ${event.day} ${event.beat} has no choice ${event.index}`);
  if (!choiceOffered(choice, state)) throw new Error(`choose: choice ${event.index} is not offered now`);
  const effects = choice.effects ?? {};
  let next = withFlags(state, effects.flags);
  // san comes from the choice in content.
  if (effects.san) next = { ...next, san: clampSan(next.san + effects.san) };
  // A hand night (days 10–17): the content's own shutdown choice gives the hand nothing; the night
  // is answered (the `give` event records a deliverable handed over instead).
  if (event.beat === "shutdown" && handNight(event.day)) {
    const key = String(event.day);
    if (next.raids[key]) throw new Error(`choose: the hand of night ${event.day} is already answered`);
    next = { ...next, raids: { ...next.raids, [key]: { gave: null } } };
  }
  return next;
}

export function applyTask(
  state: State,
  event: { readonly day: number; readonly flag: string; readonly mode: string; readonly missed?: true; readonly merge?: boolean; readonly marks?: readonly { readonly clause: number; readonly hit: boolean }[]; readonly slots?: Readonly<Record<string, string>>; readonly assists?: number },
): State {
  if (event.missed !== undefined && (event.missed !== true || event.mode !== "self")) throw new Error("task: missed is only for a self path");
  if (event.merge !== undefined && (typeof event.merge !== "boolean" || event.mode !== "self" || event.missed)) throw new Error("task: merge is only for a self path that found the conflict");
  if (event.marks !== undefined) {
    if (event.mode === "auto" || event.mode === "let") throw new Error("task: marks belong to a read mode (self / look)");
    if (!Array.isArray(event.marks) || !event.marks.every((m) => Number.isInteger(m.clause) && m.clause >= 0 && typeof m.hit === "boolean")) throw new Error("task: marks must be { clause, hit }");
  }
  if (event.mode !== "auto" && !(TASK_MODES as readonly string[]).includes(event.mode)) throw new Error(`task: unknown mode "${event.mode}"`);
  if (!taskFlags(event.day).includes(event.flag)) throw new Error(`task: "${event.flag}" is not a task of day ${event.day}`);
  const tree = taskByFlag(event.day, event.flag);
  // Work v2: a board task's `task` event carries slots + assists and only sets the done flag; its
  // SAN is the night's `boardJudge`, not a path's effect. `marks`/`missed`/`merge` never apply.
  if (tree?.board) {
    if (event.marks !== undefined || event.missed !== undefined || event.merge !== undefined) throw new Error("task: a board task has no marks/missed/merge");
    if (event.mode !== "self" && event.mode !== "let") throw new Error("task: a board task is done self or let");
    if (event.slots !== undefined && (typeof event.slots !== "object" || event.slots === null || Array.isArray(event.slots))) throw new Error("task: slots must be an object");
    if (event.assists !== undefined && !(Number.isInteger(event.assists) && event.assists >= 0)) throw new Error("task: assists must be an integer >= 0");
    // Assimilation (three-meters spec): + assists × assimAssist, + assimKuroCardKept per Kuro card
    // in the printed slots. Kuro's SAN judgement is the night's `boardJudge`, not here.
    const slots = event.slots ?? {};
    const kuroIds = new Set(tree.board.kuro.cards.map((c) => c.id));
    const kuroKept = Object.values(slots).filter((cardId) => kuroIds.has(cardId)).length;
    const gain = (event.assists ?? 0) * (constants.assimAssist as number) + kuroKept * (constants.assimKuroCardKept as number);
    return raiseAssimilation(withFlags(state, [event.flag]), gain);
  }
  if (event.slots !== undefined || event.assists !== undefined) throw new Error("task: slots/assists belong to a board task");
  if (event.mode === "auto" || !tree) {
    // Ticked by itself (or a task with no tree): only the done flag.
    return withFlags(state, [event.flag]);
  }
  const effects = tree[event.mode as TaskMode].effects;
  // The catch flags a surface earns: dropped when the read missed, or (with marks) when no listed
  // spot was hit. Marks are the general rule; `missed` is the conflict special case.
  const caughtFlags = (tree.doc ?? tree.code)?.catchFlags ?? [];
  const earned = event.marks === undefined ? !event.missed : event.marks.some((m) => m.hit);
  const drop = earned ? new Set<string>() : new Set(caughtFlags);
  let next = withFlags(state, [...(effects.flags ?? []).filter((f) => !drop.has(f)), event.flag]);
  if (effects.san) next = { ...next, san: clampSan(next.san + effects.san) };
  // Assimilation (three-meters spec): a path's `assimilation` raises it (clamped, never down).
  if (effects.assimilation) next = raiseAssimilation(next, effects.assimilation);
  if (effects.letItDoUnchecked) next = { ...next, letItDoUnchecked: next.letItDoUnchecked + effects.letItDoUnchecked };
  // effects.looked: the event (mode "look") is the record the rubric cites.
  return next;
}
