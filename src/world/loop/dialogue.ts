// The dialogue box's queue: content sequences in order, one line at a time. A sequence may end
// in choices (a beat's branches, or the loan prompt) or in an action (lying down after the night).
// The box never makes text: every line is content.
import type { BeatName, SayLine, Sequence } from "@state/days/table";
import { choiceOffered } from "@state/days/effects";
import { recogniseTable } from "@state/recognise";
import type { State } from "@state/types.gen";

export type Ending =
  | { readonly kind: "none" }
  | { readonly kind: "beatChoices"; readonly day: number; readonly beat: BeatName }
  | { readonly kind: "loan" }
  | { readonly kind: "lieDown" }
  /** "Do you know what this is?" (recognise spec): the options in this run's order (content indexes). */
  | { readonly kind: "recognise"; readonly object: string; readonly order: readonly number[] }
  /** Kuro's upgrade offer as a line in the box (dialogue spec): 升级 / 不了. */
  | { readonly kind: "kuroOffer"; readonly object: string; readonly decline: "offer" | "nag" | "final" }
  /** 要和克总聊聊吗？ — 聊聊 / 先不聊. */
  | { readonly kind: "kuroAsk" }
  /** Kuro has spoken; the player's box answers (chat: the questions and typing; work: only 好。). */
  | { readonly kind: "kuroTurn"; readonly mode: "chat" | "work" };

/** Endings that wait for a choice (Kuro's turn waits for the player's box). */
export const endsInChoice = (e: Ending): boolean =>
  e.kind === "beatChoices" || e.kind === "loan" || e.kind === "recognise" || e.kind === "kuroOffer" || e.kind === "kuroAsk" || e.kind === "kuroTurn";

export interface Queued {
  /** Where it came from (for tests and to avoid queueing the same thing twice). */
  readonly key: string;
  readonly lines: readonly SayLine[];
  readonly ending: Ending;
  /** The sequence, so choices can be read with their cond_show. */
  readonly sequence?: Sequence;
  /** Kuro's lines (dialogue spec): its avatar in the tag; Esc ends every one of them. */
  readonly voice?: "kuro";
}

export interface DialogueState {
  readonly queue: readonly Queued[];
  /** Index of the line showing in the first queued sequence. */
  readonly line: number;
  /** Which screen of that line (dialogue spec: paged, never scrolled); absent = 0. */
  readonly page?: number;
}

export const EMPTY_DIALOGUE: DialogueState = { queue: [], line: 0 };

/** A conversation with Kuro is under way (any of its items queued). */
export const talking = (d: DialogueState): boolean => d.queue.some((q) => q.voice === "kuro");

/** The conversation ends: every Kuro item leaves; what else was queued stays. */
export function leaveKuro(d: DialogueState): DialogueState {
  if (!talking(d)) return d;
  const headGoes = d.queue[0]?.voice === "kuro";
  return { queue: d.queue.filter((q) => q.voice !== "kuro"), line: headGoes ? 0 : d.line, page: headGoes ? 0 : d.page };
}

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

/** Kuro's prompt and offer choices: strings, never content. */
export const KURO_ASK_OPTIONS: readonly ChoiceOption[] = [
  { index: 0, text: null, choice: "yes", labelKey: "kuro.yes" },
  { index: 1, text: null, choice: "no", labelKey: "kuro.notNow" },
];
export const KURO_OFFER_OPTIONS: readonly ChoiceOption[] = [
  { index: 0, text: null, choice: "yes", labelKey: "upgrade.yes" },
  { index: 1, text: null, choice: "no", labelKey: "upgrade.no" },
];

function options(q: Queued, state: State): ChoiceOption[] | null {
  if (q.ending.kind === "loan") return [...LOAN_OPTIONS];
  if (q.ending.kind === "kuroAsk") return [...KURO_ASK_OPTIONS];
  if (q.ending.kind === "kuroOffer") return [...KURO_OFFER_OPTIONS];
  if (q.ending.kind === "recognise") {
    // No hints: the same look for every option; the order is the run's, not content's.
    const entry = recogniseTable.get(q.ending.object);
    return entry ? q.ending.order.map((i) => ({ index: i, text: entry.options[i]!.t })) : null;
  }
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
 * The next screen, then the next line (dialogue spec: a long line is paged). `screens` is how
 * many screens the line on show has (layout.ts); 1 when unknown. At the end of a sequence with
 * choices nothing happens (a choice must be made); at the end of a plain sequence the next one
 * starts. Returns the ending that was reached, if any.
 */
export function advance(d: DialogueState, screens = 1): { dialogue: DialogueState; ended: Ending | null } {
  const q = d.queue[0];
  if (!q) return { dialogue: d, ended: null };
  const page = d.page ?? 0;
  if (page < screens - 1) return { dialogue: { ...d, page: page + 1 }, ended: null };
  if (d.line < q.lines.length - 1) return { dialogue: { queue: d.queue, line: d.line + 1, page: 0 }, ended: null };
  if (endsInChoice(q.ending)) return { dialogue: d, ended: null };
  return { dialogue: { queue: d.queue.slice(1), line: 0, page: 0 }, ended: q.ending };
}

/** After a choice: the sequence is over. */
export function finishChoice(d: DialogueState): DialogueState {
  return d.queue.length ? { queue: d.queue.slice(1), line: 0, page: 0 } : d;
}

/** Kuro's next turn takes the place of the one just answered. */
export function replaceHead(d: DialogueState, next: readonly Queued[]): DialogueState {
  return { queue: [...next, ...d.queue.slice(1)], line: 0, page: 0 };
}
