// The dialogue box's queue: content sequences in order, one line at a time. A sequence may end
// in choices (a beat's branches, or the loan prompt) or in an action (lying down after the night).
// The box never makes text: every line is content.
import type { BeatName, SayLine, Sequence } from "@state/days/table";
import { choiceOffered } from "@state/days/effects";
import type { State } from "@state/types.gen";

export type Ending =
  | { readonly kind: "none" }
  | { readonly kind: "beatChoices"; readonly day: number; readonly beat: BeatName }
  | { readonly kind: "loan" }
  | { readonly kind: "lieDown" };

export interface Queued {
  /** Where it came from (for tests and to avoid queueing the same thing twice). */
  readonly key: string;
  readonly lines: readonly SayLine[];
  readonly ending: Ending;
  /** The sequence, so choices can be read with their cond_show. */
  readonly sequence?: Sequence;
}

export interface DialogueState {
  readonly queue: readonly Queued[];
  /** Index of the line showing in the first queued sequence. */
  readonly line: number;
}

export const EMPTY_DIALOGUE: DialogueState = { queue: [], line: 0 };

export function push(d: DialogueState, q: Queued): DialogueState {
  if (q.lines.length === 0 && q.ending.kind === "none") return d;
  if (d.queue.some((x) => x.key === q.key)) return d;
  return { ...d, queue: [...d.queue, q] };
}

export interface ChoiceOption {
  readonly index: number;
  readonly text: string | null;
  /** For the loan prompt: the reply choice and its label key. */
  readonly choice?: string;
  readonly labelKey?: string;
}

export interface Showing {
  readonly line: SayLine | null;
  /** Choices once the last line has been read (or at once, if there are no lines). */
  readonly choices: readonly ChoiceOption[] | null;
  readonly more: boolean;
}

/** The two loan replies (world-state LOAN_CHOICE_*). "no" is the chick's word. */
export const LOAN_OPTIONS: readonly ChoiceOption[] = [
  { index: 0, text: null, choice: "lend", labelKey: "loop.loan.lend" },
  { index: 1, text: null, choice: "no", labelKey: "loop.loan.refuse" },
];

function options(q: Queued, state: State): ChoiceOption[] | null {
  if (q.ending.kind === "loan") return [...LOAN_OPTIONS];
  if (q.ending.kind !== "beatChoices") return null;
  return (q.sequence?.choices ?? [])
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => choiceOffered(c, state))
    .map(({ c, index }) => ({ index, text: c.text }));
}

/** What the box shows now, or null when it is closed. */
export function showing(d: DialogueState, state: State): Showing | null {
  const q = d.queue[0];
  if (!q) return null;
  const atEnd = d.line >= q.lines.length - 1;
  const line = q.lines[Math.min(d.line, q.lines.length - 1)] ?? null;
  const choices = atEnd ? options(q, state) : null;
  return { line, choices, more: !atEnd || (choices === null && d.queue.length > 1) };
}

/**
 * The next line. At the end of a sequence with choices nothing happens (a choice must be made);
 * at the end of a plain sequence the next one starts. Returns the ending that was reached, if any.
 */
export function advance(d: DialogueState): { dialogue: DialogueState; ended: Ending | null } {
  const q = d.queue[0];
  if (!q) return { dialogue: d, ended: null };
  if (d.line < q.lines.length - 1) return { dialogue: { ...d, line: d.line + 1 }, ended: null };
  if (q.ending.kind === "beatChoices" || q.ending.kind === "loan") return { dialogue: d, ended: null };
  return { dialogue: { queue: d.queue.slice(1), line: 0 }, ended: q.ending };
}

/** After a choice: the sequence is over. */
export function finishChoice(d: DialogueState): DialogueState {
  return d.queue.length ? { queue: d.queue.slice(1), line: 0 } : d;
}
