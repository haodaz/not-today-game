// How the reply tables change state. Two paths, both pure and clock-free:
//   applyReplyEvent   a word the player sent in a conversation (one `reply` event with a recipient)
//   applyIncomingFlags  the messages that arrive whether or not the player answers; day-driven,
//                       called by derive, idempotent (flags are a set)
import type { State } from "../types.gen";
import { rangeOf } from "../variables";
import { condHolds, objectOfWord, objectWordState, resolve } from "./resolve";
import { replyTable } from "./table";

/** Every conversation that exists on any day. A reply to anything else is a corrupt log. */
const knownRecipients: ReadonlySet<string> = new Set(
  [...replyTable.values()].flatMap((table) => [...table.recipients.keys()]),
);

const lastTableDay = Math.max(0, ...replyTable.keys());

function withFlags(state: State, added: readonly string[]): State {
  const missing = added.filter((flag) => !state.flags.includes(flag));
  return missing.length ? { ...state, flags: [...state.flags, ...new Set(missing)] } : state;
}

function clampSan(value: number): number {
  const [min, max] = rangeOf("san") ?? [null, null];
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

export interface ReplySent {
  readonly day: number;
  readonly recipient: string;
  readonly choice: string;
}

/**
 * Applies a word sent to `recipient`. Resolves it against the state so far, on the day the event
 * was recorded. Nothing happens if nothing was sent: a word not on that day's menu, a `gone` word,
 * or a deregistered recipient (the message cannot go). Otherwise a lent object word is used up,
 * and the entry's `effects` apply: flags are added, `san` moves and is clamped to the table range.
 */
export function applyReplyEvent(state: State, event: ReplySent): State {
  if (!knownRecipients.has(event.recipient)) {
    throw new Error(`reply: unknown recipient "${event.recipient}"`);
  }
  const resolution = resolve(event.day, event.recipient, event.choice, state);
  if (!resolution || resolution.status === "gone" || resolution.deregistered) return state;

  let next = state;
  if (objectWordState(event.choice, next) === "available") {
    const object = objectOfWord(event.choice, next)!;
    next = { ...next, objectWords: { ...next.objectWords, [object]: { ...next.objectWords[object]!, used: true } } };
  }

  const effects = resolution.entry.effects;
  if (effects?.flags) next = withFlags(next, effects.flags);
  if (effects?.san) next = { ...next, san: clampSan(next.san + effects.san) };
  return next;
}

/**
 * Adds the flags of every incoming message for days 1..state.day whose condition holds.
 * Incoming messages arrive whether or not the player replies, so this is a function of the day
 * (like the loan repayment), not of an event. Idempotent.
 */
export function applyIncomingFlags(state: State): State {
  const added: string[] = [];
  for (let day = 1; day <= Math.min(state.day, lastTableDay); day++) {
    for (const { incoming } of replyTable.get(day)?.recipients.values() ?? []) {
      for (const item of incoming) {
        if (item.effects?.flags && condHolds(item.cond_show, state)) added.push(...item.effects.flags);
      }
    }
  }
  return withFlags(state, added);
}
