// The append-only event log's vocabulary and the reducer that folds one event onto state.
// applyEvent is pure: it never mutates its input and never reads a clock. An event may read the
// state produced by earlier events; the only time it sees is its own recorded `day`.
import type { State } from "./types.gen";
import { applyChoose, applyStep, applyTask, type TaskEventMode } from "./days/effects";
import { applyDeclineUpgrade, applyUpgrade, type DeclineKind } from "./upgrades";
import { applyOrder, applyPickup, applyUseItem } from "./delivery/effects";
import type { Meal } from "./delivery/table";
import { applyEnding, type Ending } from "./endings";
import { applyRecognise } from "./recognise";
import { applyReplyEvent, knownRecipients } from "./replies/effects";
import { constants, membersOf } from "./variables";

/** The two reply choices world-state reacts to. "no" is the chick's word (objectWords.chick). */
export const LOAN_CHOICE_LEND = "lend";
export const LOAN_CHOICE_REFUSE = "no";

/** Every event carries the `day` counter value at the moment it was appended. */
export type GameEvent =
  | { kind: "openLayer"; day: number; objectId: string }
  /**
   * recognise spec: `option` is the index (content order) of the answer chosen to "do you know
   * what this is?"; the reducer reads right/wrong from content. Without it: world-state's plain form.
   */
  | { kind: "recognise"; day: number; objectId: string; option?: number }
  | { kind: "pressKey"; day: number; key: string }
  /**
   * `choice` is the word (or a prompt choice such as the loan's "lend"). `recipient` is set when
   * the word was sent in a conversation (replies spec); `text` holds what the player typed for the
   * `free` cell. Both are absent for prompt choices like the loan.
   */
  | { kind: "reply"; day: number; choice: string; recipient?: string; text?: string; t?: string }
  | { kind: "letItDo"; day: number; taskId: string }
  | { kind: "looked"; day: number; objectId: string }
  | { kind: "pokeReset"; day: number }
  | { kind: "lieDown"; day: number }
  | { kind: "sitUp"; day: number }
  | { kind: "handObject"; day: number; objectId: string }
  | { kind: "handLost"; day: number }
  | { kind: "handNothing"; day: number }
  // delivery spec (amendment 2026-10-31): `t` is the beat time the order was placed.
  | { kind: "order"; day: number; meal: Meal; shopId: string; itemId: string; t: string }
  | { kind: "pickup"; day: number; meal: Meal }
  | { kind: "useItem"; day: number; itemId: string; objectId: string }
  // desktop-ui spec (amendment 2026-10-31): opening the browser or a conversation, at beat time `t`.
  | { kind: "open"; day: number; target: string; t: string }
  // day-loop spec (amendment 2026-11-01).
  | { kind: "step"; day: number; name: string; t: string }
  | { kind: "choose"; day: number; beat: string; index: number }
  | { kind: "task"; day: number; flag: string; mode: TaskEventMode }
  // object-upgrade spec (2026-11-01): accepting / declining Kuro's offer.
  | { kind: "upgrade"; day: number; object: string }
  | { kind: "declineUpgrade"; day: number; object: string; decline: DeclineKind }
  // san-and-endings spec: the run ends, once (bad at a shutdown beat; survive / good on the last night).
  | { kind: "ending"; day: number; ending: Ending }
  // title-page spec: the answers to the title's questions, the run's first event (title page only).
  | { kind: "names"; day: number; names: State["names"] };

export type EventKind = GameEvent["kind"];

/** Exactly these kinds (world-state 12, delivery 3, desktop-ui 1, day-loop 3, object-upgrade 2, san-and-endings 1). Nothing else may be appended. */
export const eventKinds: readonly EventKind[] = [
  "openLayer",
  "recognise",
  "pressKey",
  "reply",
  "letItDo",
  "looked",
  "pokeReset",
  "lieDown",
  "sitUp",
  "handObject",
  "handLost",
  "handNothing",
  "order",
  "pickup",
  "useItem",
  "open",
  "step",
  "choose",
  "task",
  "upgrade",
  "declineUpgrade",
  "ending",
  "names",
];

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The things that can be opened: the browser, or a conversation `conv:<recipient>`. */
export function isOpenTarget(target: string): boolean {
  if (target === "browser") return true;
  const conv = /^conv:(.+)$/.exec(target);
  return conv !== null && knownRecipients.has(conv[1]!);
}

/** Opening a conversation counts as reading messages (`readCount`); the browser changes nothing. */
function applyOpen(state: State, event: Extract<GameEvent, { kind: "open" }>): State {
  if (!isOpenTarget(event.target)) throw new Error(`open: unknown target "${event.target}"`);
  if (!HHMM.test(event.t)) throw new Error(`open: time must be HH:MM, got "${event.t}"`);
  return event.target.startsWith("conv:") ? { ...state, readCount: state.readCount + 1 } : state;
}

/** An event as a caller builds it, before the store stamps the day. */
export type EventDraft = GameEvent extends infer E
  ? E extends GameEvent
    ? Omit<E, "day">
    : never
  : never;

/** Adds `objectId` to a set variable. Idempotent. Throws if the id is not in the table's list. */
function withMember(state: State, key: "found" | "recognised", objectId: string): State {
  if (!(membersOf(key) ?? []).includes(objectId)) {
    throw new Error(`${key}: unknown object "${objectId}"`);
  }
  const current: readonly string[] = state[key];
  if (current.includes(objectId)) return state;
  return { ...state, [key]: [...current, objectId] } as State;
}

/** The title page's answers (title-page T1): every field the variable table lists, of its type. */
function applyNames(state: State, event: Extract<GameEvent, { kind: "names" }>): State {
  const n = event.names as unknown as Record<string, unknown>;
  if (typeof n !== "object" || n === null) throw new Error("names: expected an object");
  const fields = Object.keys(state.names);
  for (const k of Object.keys(n)) if (!fields.includes(k)) throw new Error(`names: unknown field "${k}"`);
  for (const k of fields) {
    if (!(k in n)) throw new Error(`names: missing "${k}"`);
    if (k === "pronoun") {
      if (n.pronoun !== null && n.pronoun !== "she" && n.pronoun !== "he") throw new Error('names: pronoun must be "she", "he" or null');
    } else if (typeof n[k] !== "string") throw new Error(`names: "${k}" must be a string`);
  }
  return { ...state, names: { ...(n as State["names"]) } };
}

/**
 * The loan is decided by the reply recorded on `constants.loanReplyDay`. The first such reply
 * wins; later ones cannot change it. The repayment on `constants.repayDay` is not an event: it
 * is a day-driven change made by `derive` (fday.ts).
 *
 * Only a recipient-less reply (the loan prompt) counts. A word sent in a conversation never
 * decides the loan, even "no" on the loan day: the reply tables use it as an ordinary word.
 */
function applyLoanReply(state: State, event: Extract<GameEvent, { kind: "reply" }>): State {
  if (event.recipient !== undefined) return state;
  if (event.day !== constants.loanReplyDay || state.loan !== "none") return state;
  if (event.choice === LOAN_CHOICE_LEND) {
    return { ...state, loan: "lent", balance: state.balance - constants.loanAmount };
  }
  if (event.choice === LOAN_CHOICE_REFUSE) return { ...state, loan: "refused" };
  return state;
}

/**
 * Folds one event onto state and returns the new state.
 *
 * Reducers defined by world-state: openLayer -> found, recognise -> recognised,
 * pokeReset -> pokedReset, letItDo -> letItDoUnchecked, lieDown -> day + 1, and reply -> loan and
 * balance (loan choices only). Every other kind is a documented no-op for now and every other
 * field passes through untouched; their reducers belong to later specs (devices,
 * san-and-endings, night-hand, chat).
 */
export function applyEvent(state: State, event: GameEvent): State {
  // The run has ended (san-and-endings): it takes nothing more.
  if (state.ending !== "none") throw new Error(`${event.kind}: the run has ended (${state.ending})`);
  switch (event.kind) {
    case "ending":
      return applyEnding(state, event);
    case "names":
      return applyNames(state, event);
    case "openLayer":
      return withMember(state, "found", event.objectId);
    case "recognise":
      return applyRecognise(state, event, (s) => withMember(s, "recognised", event.objectId));
    case "pokeReset":
      // The reset hole is always pressable and never does anything else.
      return state.pokedReset ? state : { ...state, pokedReset: true };
    case "letItDo":
      return { ...state, letItDoUnchecked: state.letItDoUnchecked + 1 };
    case "lieDown":
      // The only thing that moves the day counter.
      return { ...state, day: state.day + 1 };
    case "open":
      return applyOpen(state, event);
    case "step":
      return applyStep(state, event);
    case "choose":
      return applyChoose(state, event);
    case "task":
      return applyTask(state, event);
    case "upgrade":
      return applyUpgrade(state, event);
    case "declineUpgrade":
      return applyDeclineUpgrade(state, event);
    case "reply":
      if (event.t !== undefined && !HHMM.test(event.t)) throw new Error(`reply: time must be HH:MM, got "${event.t}"`);
      // A word sent in a conversation plays the reply tables; a recipient-less reply is a prompt
      // choice such as the loan.
      return event.recipient === undefined
        ? applyLoanReply(state, event)
        : applyReplyEvent(state, { day: event.day, recipient: event.recipient, choice: event.choice });
    case "order":
      return applyOrder(state, event);
    case "pickup":
      return applyPickup(state, event);
    case "useItem":
      return applyUseItem(state, event);
    case "pressKey":
    case "looked":
    case "sitUp":
    case "handObject":
    case "handLost":
    case "handNothing":
      return state;
    default: {
      // Compile-time: adding a kind to GameEvent without handling it is a type error here.
      // Run-time: a corrupt save with an unknown kind fails loudly instead of being skipped.
      const unknownEvent: never = event;
      throw new Error(`unknown event kind: ${JSON.stringify(unknownEvent)}`);
    }
  }
}
