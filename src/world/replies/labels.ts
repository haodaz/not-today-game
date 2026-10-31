// The strings key for a reply chip. The copy itself lives in content/strings/; nothing here is
// user-facing text.
import { FREE } from "@state/replies/resolve";
import { FAMILY, replyTable } from "@state/replies/table";
import { defaults } from "@state/variables";

/** Every word an object can lend, from the variable table. */
const objectWords: ReadonlySet<string> = new Set(
  Object.values(defaults().objectWords as Record<string, { word: string }>).map((lent) => lent.word),
);

/**
 * The family's own words: those on its menu on the first scripted day (eaten, busy, fine, unpaid
 * in the current data). Words the family gains later (e.g. what-llm) share the work menu's label.
 */
const familyWords: ReadonlySet<string> = new Set(
  [...(replyTable.get(Math.min(...replyTable.keys()))?.recipients.get(FAMILY)?.cells.keys() ?? [])].filter(
    (word) => !objectWords.has(word),
  ),
);

/** Shown for a struck-through chip that has no inner line of its own. */
export const GONE_HINT_KEY = "reply.hint.gone";

/**
 * `word.{word}` for a lent object word, `family.{word}` for the family's own words, `reply.{word}`
 * otherwise. Null for `free`: it is the input box.
 */
export function labelKey(recipient: string, word: string): string | null {
  if (word === FREE) return null;
  if (objectWords.has(word)) return `word.${word}`;
  if (recipient === FAMILY && familyWords.has(word)) return `family.${word}`;
  return `reply.${word}`;
}
