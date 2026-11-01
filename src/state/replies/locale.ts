// Which language the reply tables' text is shown in (replies addition 2026-11-01: English reply
// tables). Display only: an English twin has exactly the zh table's days, words, statuses, times and
// effects (checked at load), so nothing the state derives from the tables depends on this.
// world/i18n's setLocale sets it; state code never reads it except through a table's `text` / `inner`.
export type ReplyLocale = "zh" | "en";

let current: ReplyLocale = "zh";

export const replyLocale = (): ReplyLocale => current;

export function setReplyLocale(next: ReplyLocale): void {
  current = next;
}
