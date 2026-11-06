// The dialogue box's queue: content sequences in order, one line at a time. A sequence may end
// in choices (a beat's branches, or the loan prompt) or in an action (lying down after the night).
// The box never makes text: every line is content.
import type { BeatName, Place, SayLine, Sequence } from "@state/days/table";
import { choiceOffered } from "@state/days/effects";
import { recogniseTable } from "@state/recognise";
import type { GameEvent } from "@state/events";
import { deliverableForHand, handNight } from "@state/days/board";
import { hasString, t } from "@world/i18n";
import type { State } from "@state/types.gen";

export type Ending =
  | { readonly kind: "none" }
  | { readonly kind: "beatChoices"; readonly day: number; readonly beat: BeatName }
  | { readonly kind: "loan" }
  | { readonly kind: "lieDown" }
  /** "Do you know what this is?" (recognise spec): the options in this run's order (content indexes). */
  | { readonly kind: "recognise"; readonly object: string; readonly order: readonly number[] }
  /** The bed, unlocked: 睡 / 再待会儿 (day-loop addition 2026-11-02). */
  | { readonly kind: "bedAsk" }
  /** Kuro's upgrade offer as a line in the box (dialogue spec): 升级 / 不了. */
  | { readonly kind: "kuroOffer"; readonly object: string; readonly decline: "offer" | "nag" | "final" }
  /** 要和克总聊聊吗？ — 聊聊 / 先不聊. */
  | { readonly kind: "kuroAsk" }
  /** Kuro has spoken; the player's box answers (chat: the questions and typing; work: only 好。). */
  | { readonly kind: "kuroTurn"; readonly mode: "chat" | "work" }
  /** Kuro is answering online (kuro-chat FR3): no player's box, no reading on, until it replies. */
  | { readonly kind: "kuroWait" }
  /** opening R2: the dream before day 1 has been read; the fade into day 1 follows. */
  | { readonly kind: "prologue" };

/** Endings that wait for a choice (Kuro's turn waits for the player's box). */
export const endsInChoice = (e: Ending): boolean =>
  e.kind === "beatChoices" || e.kind === "loan" || e.kind === "recognise" || e.kind === "kuroOffer" || e.kind === "kuroAsk" || e.kind === "bedAsk" || e.kind === "kuroTurn" || e.kind === "kuroWait";

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

/** A sequence (or its rest) holding back for its place: the item as queued, and the line it resumes at. */
export interface Parked {
  readonly item: Queued;
  readonly from: number;
}

export interface DialogueState {
  /** What can play now: `queue[0]` is on show, the rest follow it. */
  readonly queue: readonly Queued[];
  /** Index of the line showing in the first queued sequence. */
  readonly line: number;
  /** Which screen of that line (dialogue spec: paged, never scrolled); absent = 0. */
  readonly page?: number;
  /**
   * Sequences whose next line waits for its place (dialogue addition 2026-11-02), in queue order and
   * ahead of everything in `queue`. Session only: not events, dropped at lieDown.
   */
  readonly waiting?: readonly Parked[];
}

export const EMPTY_DIALOGUE: DialogueState = { queue: [], line: 0 };

/** A conversation with Kuro is under way (any of its items queued). */
export const talking = (d: DialogueState): boolean => d.queue.some((q) => q.voice === "kuro");
/** Kuro is the one in the box now: its body stands there, not in the HUD corner. */
export const kuroInBox = (d: DialogueState): boolean => d.queue[0]?.voice === "kuro";

/** The conversation ends: every Kuro item leaves; what else was queued stays. */
export function leaveKuro(d: DialogueState): DialogueState {
  if (!talking(d)) return d;
  const headGoes = d.queue[0]?.voice === "kuro";
  return { ...d, queue: d.queue.filter((q) => q.voice !== "kuro"), line: headGoes ? 0 : d.line, page: headGoes ? 0 : d.page };
}

/**
 * The object was put down before its "what is this" was answered: its question leaves the queue and
 * the waiting list (an answer already playing stays). It is asked again on the next pick-up, since
 * only an answer counts as asked (recognise FR1).
 */
export function dropQuestion(d: DialogueState, object: string): DialogueState {
  const isQ = (q: Queued) => q.ending.kind === "recognise" && q.ending.object === object;
  const queue = d.queue.filter((q) => !isQ(q));
  const waiting = d.waiting?.filter((p) => !isQ(p.item));
  if (queue.length === d.queue.length && waiting?.length === d.waiting?.length) return d;
  const headGoes = d.queue[0] !== undefined && isQ(d.queue[0]);
  const next: DialogueState = { ...d, queue, line: headGoes ? 0 : d.line, page: headGoes ? 0 : d.page };
  return waiting === undefined ? next : { ...next, waiting };
}

export function push(d: DialogueState, q: Queued): DialogueState {
  if (q.lines.length === 0 && q.ending.kind === "none") return d;
  // Not twice, whether it is playing, queued or waiting for its place.
  if (d.queue.some((x) => x.key === q.key) || (d.waiting ?? []).some((x) => x.item.key === q.key)) return d;
  return { ...d, queue: [...d.queue, q] };
}

/** A day sequence's lines with the sequence's `where` as the default of those without their own. */
export function placedLines(seq: Sequence): readonly SayLine[] {
  const where = seq.where;
  return where === undefined ? seq.say : seq.say.map((l) => (l.where === undefined ? { ...l, where } : l));
}

// ——— a line brings its backdrop and prop (dialogue addition / correction 2026-11-02) ———

/** What the stage shows behind the box: a photo under /room/dream/ and a cut-out under /room/props/. */
export interface Scene {
  readonly backdrop: string | null;
  readonly prop: string | null;
}
export const NO_SCENE: Scene = { backdrop: null, prop: null };

/**
 * The scene of the sequence on show: the latest `backdrop` among its lines so far, and the latest
 * `prop` (`""` clears it). Derived, never stored: when the sequence ends (the queue head changes or
 * empties) the stage goes back to its own still. Pure.
 */
export function sceneOf(d: DialogueState): Scene {
  const q = d.queue[0];
  if (!q) return NO_SCENE;
  let backdrop: string | null = null;
  let prop: string | null = null;
  for (const l of q.lines.slice(0, Math.min(d.line, q.lines.length - 1) + 1)) {
    if (l.backdrop !== undefined) backdrop = l.backdrop;
    if (l.prop !== undefined) prop = l.prop === "" ? null : l.prop;
  }
  return backdrop === null && prop === null ? NO_SCENE : { backdrop, prop };
}

// ——— a line waits for its place (dialogue addition 2026-11-02) ———

/** Where the player is: the view, the app in front on the desktop, and whether it is night. */
export interface Here {
  readonly view: "room" | "desk" | "desktop" | "door";
  /** The app in front on the monitor being shown (desktop only). */
  readonly app: string | null;
  readonly night: boolean;
  /**
   * The conversation open in front (third level, dialogue addition 2026-11-02): 消息's, or 工作台's
   * when its 消息 pane is the page. Null elsewhere (朋友圈, another page, another app). Absent = null.
   */
  readonly conversation?: string | null;
  /** 工作台's page when 工作台 is in front (`msgs` is its 消息 pane); absent = null. */
  readonly page?: string | null;
}

/**
 * Does a line with this `where` play here? No `where`: anywhere. `screen` matches any desktop app.
 * `screen:msgs` matches a messages surface in front: 消息, or 工作台's 消息 pane (the work
 * conversations moved there; the content's `screen:msgs` lines are about them). `screen:workbench`
 * and `screen:browser` match that app in front (any page). The third level matches only exactly:
 * `screen:msgs:<id>` while that conversation is open in whichever app holds it,
 * `screen:workbench:<page>` while 工作台 shows that page; never one level up. The others their
 * view; `night` the night.
 */
export function placeMatches(where: Place | undefined, here: Here): boolean {
  switch (where) {
    case undefined:
      return true;
    case "room":
    case "desk":
    case "door":
      return here.view === where;
    case "night":
      return here.night;
    case "screen":
      return here.view === "desktop";
    case "screen:msgs":
      // A messages surface in front: Hi信, or 听听 (the work conversations, tingtalk 2026-11-04).
      return here.view === "desktop" && (here.app === "msgs" || here.app === "tingtalk");
    case "screen:workbench":
    case "screen:browser":
      return here.view === "desktop" && here.app === where.slice("screen:".length);
    default: {
      if (here.view !== "desktop") return false;
      const [, app, sub] = where.split(":");
      if (app === "msgs") return (here.conversation ?? null) === sub;
      return here.app === "workbench" && (here.page ?? null) === sub;
    }
  }
}

/** Can this item play from `line` here? An item with no lines (a prompt) always can. */
const playsFrom = (q: Queued, line: number, here: Here): boolean => q.lines.length === 0 || placeMatches(q.lines[Math.min(line, q.lines.length - 1)]?.where, here);

/**
 * Brings the queue in line with where the player is. Pure; idempotent.
 *  - A line on show whose place the player has left is taken back (it resumes where it was).
 *  - Order is kept inside a sequence: its next line is the only one that counts.
 *  - With nothing on show, the first sequence (waiting ones first, then queued ones, in order)
 *    whose next line plays here comes forward; the others keep waiting in order.
 * No `where` anywhere gives `d` back unchanged.
 */
export function settle(d: DialogueState, here: Here): DialogueState {
  const head = d.queue[0];
  // A line on show stays while it plays here; waiting ones do not push in front of it.
  if (head && playsFrom(head, d.line, here)) return d;

  // In order: the waiting ones (all ahead of the queue), then the queue, the head from its line.
  const waiting = d.waiting ?? [];
  const queued: Parked[] = d.queue.map((item, i) => ({ item, from: i === 0 ? d.line : 0 }));
  const all = [...waiting, ...queued];
  const at = all.findIndex((p) => playsFrom(p.item, p.from, here));
  if (at < 0) return head ? { queue: [], line: 0, page: 0, waiting: all } : d;

  const picked = all[at]!;
  const after = all.slice(at + 1);
  return {
    queue: [picked.item, ...after.filter((p) => !waiting.includes(p)).map((p) => p.item)],
    line: picked.from,
    page: 0,
    // Whatever came before it, and the waiting ones after it, keep waiting in order.
    waiting: [...all.slice(0, at), ...after.filter((p) => waiting.includes(p))],
  };
}

/** Waiting lines are dropped (at lieDown: they never leak into the next day). */
export function dropWaiting(d: DialogueState): DialogueState {
  return d.waiting?.length ? { ...d, waiting: [] } : d;
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
export const BED_OPTIONS: readonly ChoiceOption[] = [
  { index: 0, text: null, choice: "sleep", labelKey: "room.bed.sleep" },
  { index: 1, text: null, choice: "stay", labelKey: "room.bed.stay" },
];
export const KURO_OFFER_OPTIONS: readonly ChoiceOption[] = [
  { index: 0, text: null, choice: "yes", labelKey: "upgrade.yes" },
  { index: 1, text: null, choice: "no", labelKey: "upgrade.no" },
];

/** The sentinel index of the synthetic 把…递给它 option (work v2); not a content choice. */
export const GIVE_INDEX = -1;
/** The sentinel index of the synthetic 不给。option (work v2 addition 2026-11-03 night). */
export const REFUSE_INDEX = -2;

function options(q: Queued, state: State, events?: readonly GameEvent[]): ChoiceOption[] | null {
  if (q.ending.kind === "loan") return [...LOAN_OPTIONS];
  if (q.ending.kind === "kuroAsk") return [...KURO_ASK_OPTIONS];
  if (q.ending.kind === "kuroOffer") return [...KURO_OFFER_OPTIONS];
  if (q.ending.kind === "bedAsk") return [...BED_OPTIONS];
  if (q.ending.kind === "recognise") {
    // No hints: the same look for every option; the order is the run's, not content's.
    const entry = recogniseTable.get(q.ending.object);
    return entry ? q.ending.order.map((i) => ({ index: i, text: entry.options[i]!.t })) : null;
  }
  if (q.ending.kind !== "beatChoices") return null;
  const content = (q.sequence?.choices ?? [])
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => choiceOffered(c, state))
    .map(({ c, index }) => ({ index, text: c.text }));
  // Work v2 (addition 2026-11-03 night): on a hand night (a raid night, or any night from day 10),
  // if a `hand` deliverable is on the desk, 把{label}递给它 is offered first, before the night's own
  // choices. It routes to a `give` event (choice "give"). On a hand night the content has no choices
  // (days 11, 12, 14, 15, 17), 不给。is added too (`hand.refuse`, choice "refuse" — it logs nothing;
  // the judgement will say wrong). On a raid night the content's own choices stay after the give.
  if (events && q.ending.beat === "shutdown" && handNight(state.day) && hasString("hand.give")) {
    const d = deliverableForHand(state.day, events);
    if (d) {
      const give = { index: GIVE_INDEX, text: t("hand.give", { label: d.label }), choice: "give" as const };
      const refuse = content.length === 0 && hasString("hand.refuse") ? [{ index: REFUSE_INDEX, text: t("hand.refuse"), choice: "refuse" as const }] : [];
      return [give, ...content, ...refuse];
    }
  }
  return content;
}

/** What the box shows now, or null when it is closed. `events` adds the give option (work v2). */
export function showing(d: DialogueState, state: State, events?: readonly GameEvent[]): Showing | null {
  const q = d.queue[0];
  if (!q) return null;
  const atEnd = d.line >= q.lines.length - 1;
  const line = q.lines[Math.min(d.line, q.lines.length - 1)] ?? null;
  const choices = atEnd ? options(q, state, events) : null;
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
  if (d.line < q.lines.length - 1) return { dialogue: { ...d, line: d.line + 1, page: 0 }, ended: null };
  if (endsInChoice(q.ending)) return { dialogue: d, ended: null };
  return { dialogue: { ...d, queue: d.queue.slice(1), line: 0, page: 0 }, ended: q.ending };
}

/** After a choice: the sequence is over. */
export function finishChoice(d: DialogueState): DialogueState {
  return d.queue.length ? { ...d, queue: d.queue.slice(1), line: 0, page: 0 } : d;
}

/** Kuro's next turn takes the place of the one just answered. */
export function replaceHead(d: DialogueState, next: readonly Queued[]): DialogueState {
  return { ...d, queue: [...next, ...d.queue.slice(1)], line: 0, page: 0 };
}
