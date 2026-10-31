// What the player can say to whom, and what a word means right now. Pure lookups over the reply
// tables and the current state; no clock, no strings of its own.
import type { State } from "../types.gen";
import { defaults } from "../variables";
import { dayTable, type Condition, type Entry, type Status } from "./table";

/** The cell for whatever the player types into the input box. */
export const FREE = "free";

/**
 * D5: a recipient is deregistered once its marker flag is set. The data has no structured field
 * for this; the flags are the ones the content sets on the day the account goes.
 * TODO(Claude): a `deregistered` field in content would let this table go.
 */
export const DEREGISTERED_BY_FLAG: Readonly<Record<string, string>> = {
  xiaozhang: "xz_left",
  laozhou: "lz_gone",
};

/** The loan value `cond_show: {has: "lent"}` refers to, and the loan states that count as lent. */
const LENT = "lent";
const LENT_STATES: readonly State["loan"][] = ["lent", "repaid"];

/** The menu the run starts with. Only these words can be shrunk away by `state.replyOptions` (D2). */
const startingReplyOptions: readonly string[] = (defaults().replyOptions as string[]) ?? [];

/** Shown when an entry's `cond_show` does not hold: the README's neutral "read, no reply" (D4). */
const NEUTRAL: Entry = Object.freeze({ status: "read", lines: Object.freeze([]) }) as Entry;

/**
 * D4: `{has: X}` holds if X is in `flags`, or if X is "lent" and the player lent the money
 * (loan "lent" or, from repayDay, "repaid").
 */
export function condHolds(cond: Condition | undefined, state: State): boolean {
  if (!cond) return true;
  if (state.flags.includes(cond.has)) return true;
  return cond.has === LENT && LENT_STATES.includes(state.loan);
}

/** The object that lends `word`, if it is an object word. */
export function objectOfWord(word: string, state: State): string | undefined {
  return Object.entries(state.objectWords).find(([, lent]) => lent.word === word)?.[0];
}

export type ObjectWordState = "notObjectWord" | "hidden" | "available" | "used";

/**
 * D3: an object word is on the menu only once its object has been found, and only until it has
 * been used once.
 */
export function objectWordState(word: string, state: State): ObjectWordState {
  const object = objectOfWord(word, state);
  if (object === undefined) return "notObjectWord";
  if (!(state.found as string[]).includes(object)) return "hidden";
  return state.objectWords[object]!.used ? "used" : "available";
}

export function isDeregistered(recipient: string, state: State): boolean {
  const flag = DEREGISTERED_BY_FLAG[recipient];
  return flag !== undefined && state.flags.includes(flag);
}

/** D2: a starting menu word that `state.replyOptions` no longer holds. */
function isShrunk(word: string, state: State): boolean {
  return startingReplyOptions.includes(word) && !(state.replyOptions as string[]).includes(word);
}

export type GoneReason = "content" | "shrunk" | "used";

export type Resolution =
  | { readonly status: "gone"; readonly inner: string | null; readonly reason: GoneReason }
  | {
      readonly status: Exclude<Status, "gone">;
      readonly entry: Entry;
      readonly deregistered: boolean;
      /** False when `cond_show` failed and the neutral entry stands in. */
      readonly conditionMet: boolean;
    };

/**
 * What `word` means for `recipient` on `day`, given the state so far. Null when the word is not
 * on that menu at all (no cell that day, or an object word whose object has not been found).
 */
export function resolve(day: number, recipient: string, word: string, state: State): Resolution | null {
  const cell = dayTable(day)?.recipients.get(recipient)?.cells.get(word);
  if (!cell) return null;

  const objectWord = objectWordState(word, state);
  if (objectWord === "hidden") return null;

  const inner = cell.inner ? cell.inner : null;
  if (cell.status === "gone") return { status: "gone", inner, reason: "content" };
  if (objectWord === "used") return { status: "gone", inner: null, reason: "used" };
  if (isShrunk(word, state)) return { status: "gone", inner: null, reason: "shrunk" };

  const deregistered = isDeregistered(recipient, state);
  if (!condHolds(cell.cond_show, state)) {
    return { status: NEUTRAL.status as Exclude<Status, "gone">, entry: NEUTRAL, deregistered, conditionMet: false };
  }
  return { status: cell.status, entry: cell, deregistered, conditionMet: true };
}

export type WordKind = "base" | "object" | "free";

export interface MenuItem {
  readonly word: string;
  readonly kind: WordKind;
  readonly gone: boolean;
}

/** The words the player sees for `recipient` on `day`, in table order. Empty past the last day. */
export function menu(day: number, recipient: string, state: State): MenuItem[] {
  const cells = dayTable(day)?.recipients.get(recipient)?.cells;
  if (!cells) return [];
  const items: MenuItem[] = [];
  for (const word of cells.keys()) {
    const resolution = resolve(day, recipient, word, state);
    if (!resolution) continue;
    const kind: WordKind =
      word === FREE ? "free" : objectWordState(word, state) === "notObjectWord" ? "base" : "object";
    items.push({ word, kind, gone: resolution.status === "gone" });
  }
  return items;
}

/** The conversations that exist on `day`, in table order. */
export function recipientsOn(day: number): string[] {
  return [...(dayTable(day)?.recipients.keys() ?? [])];
}
