// The sixth time (author 2026-11-09): the same question asked six times in one run — picked from
// the pool or typed, on any days, counted by its text — gets a different answer: Kuro worn down by
// the player's persistence, giving in without ever becoming humble. The answers live in one
// run-wide file, content/kuro-repeat.md, because the sixth ask can fall on any day:
//   - "zh question" / "en question" → "en answer" | zh: "zh answer"
// Pure. Imports carry `.ts` (Deno).
import type { ChatLocale } from "./types.ts";

/** The ask that gets the worn-down answer. */
export const REPEAT_AT = 6;

export interface RepeatEntry {
  readonly zh: string;
  readonly en: string | null;
  readonly answer: string;
  readonly answerZh: string | null;
}

/** How a question is compared: no spaces, no punctuation, no case (as the layer compares starters). */
export const norm = (s: string): string => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

const LINE = /^- "(.+?)"(?:\s*\/\s*"(.+?)")?\s*→\s*"(.+?)"(?:\s*\|\s*zh:\s*"(.+?)")?\s*$/u;

/** Parses content/kuro-repeat.md strictly: every `- ` line is an entry; anything else is prose. */
export function parseRepeat(text: string, label = "kuro-repeat.md"): RepeatEntry[] {
  const out: RepeatEntry[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const m = LINE.exec(line);
    if (!m) throw new Error(`content/${label}: unreadable entry: ${line}`);
    const entry = { zh: m[1]!, en: m[2] ?? null, answer: m[3]!, answerZh: m[4] ?? null };
    if (out.some((e) => norm(e.zh) === norm(entry.zh))) throw new Error(`content/${label}: two entries for 「${entry.zh}」`);
    out.push(entry);
  }
  return out;
}

/** The entry whose question (either language) is `said`. */
export function repeatEntry(entries: readonly RepeatEntry[], said: string): RepeatEntry | null {
  const n = norm(said);
  return entries.find((e) => norm(e.zh) === n || (e.en !== null && norm(e.en) === n)) ?? null;
}

/** How many times `said` (by text, either language of its entry) was asked before, from the log's chat events. */
export function timesAsked(entries: readonly RepeatEntry[], events: readonly { readonly kind: string; readonly said?: unknown }[], said: string): number {
  const e = repeatEntry(entries, said);
  const keys = e ? [norm(e.zh), ...(e.en !== null ? [norm(e.en)] : [])] : [norm(said)];
  return events.filter((x) => x.kind === "chat" && typeof x.said === "string" && keys.includes(norm(x.said))).length;
}

/**
 * The worn-down answer when this ask is the sixth (or a later one) of its question, in the
 * reader's language (zh falls back to the English line); else null.
 */
export function repeatAnswer(entries: readonly RepeatEntry[], events: readonly { readonly kind: string; readonly said?: unknown }[], said: string, locale: ChatLocale): string | null {
  const e = repeatEntry(entries, said);
  if (!e || timesAsked(entries, events, said) + 1 < REPEAT_AT) return null;
  return locale === "zh" && e.answerZh !== null ? e.answerZh : e.answer;
}
