// The deterministic core of Kuro's chat (author 2026-11-09, after her life-simulator: "是不是 ai 来
// 执行是 side"). A starter question is answered here, on the client, from content and the run's
// seed — never by the model:
//   the bucket (low / mid / high, from state.affinity as the ending reads it) picks the tier of a
//   layered answer; a red-blue line is said as written; before a layered answer the d100 is rolled
//   from (run, day, question) with the bucket's thresholds (kuro-chat 2026-11-02): 大成功 adds the
//   unreadable word and its follow-up and bleeds; 大失败 forgets the reply (flicker); otherwise the
//   tier's own taboo, if the high tier carries one. One taboo a day: after it, the plain line.
// The same module the function uses (@kuro/variable.ts), so online and offline roll the same dice.
// A starter without a locked line falls back to its written answer (the caller's); typed text is
// the model's channel (or the day's free line).
import { askedFrom, d100, glyphWord, lockedFor, openStarter, outcomeOf } from "@kuro/variable.ts";
import type { Bucket, ChatLocale, KuroDayContent, Taboo } from "@kuro/types.ts";
import type { GameEvent } from "@state/events";
import type { KuroDay } from "@world/desktop/kuro/days";
import { tabooUsedToday } from "./taboo";

/**
 * The guarantee (borrowed from the author's life simulator, 2026-11-09: 「到窗口最后一年必出」):
 * from this day, a run that has never had a taboo gets one on its first layered ask — the tier's own
 * when it carries one, else a blur. A judge who plays once still sees the price of a generous answer.
 */
export const PITY_FROM = 10;

/** The run has had a taboo on any day. */
export const tabooEver = (events: readonly GameEvent[]): boolean => events.some((e) => e.kind === "chat" && e.taboo !== undefined);

export interface CoreAnswer {
  /** What Kuro says, as written (on 大成功 the word and the follow-up are their own lines); "" on a flicker. */
  readonly answer: string;
  readonly taboo: Taboo | null;
  /** A layered answer (rolled) or a red-blue line (not). */
  readonly layered: boolean;
  /** The d100, only before a layered answer. */
  readonly roll: number | null;
}

/** The day's content as the shared layer reads it (the prose fields are the function's only). */
function dayContent(day: KuroDay): KuroDayContent {
  return { day: day.day, idiom: day.idiom, idiomZh: "", stance: "", recall: "", mayReveal: "", never: "", starters: day.starters, locked: day.locked, layered: day.layered };
}

export interface CoreInput {
  readonly day: KuroDay;
  readonly runId: string;
  readonly bucket: Bucket;
  readonly q: number;
  readonly locale: ChatLocale;
  readonly events: readonly GameEvent[];
  /** The locked follow-up after the unreadable word (strings `kuro.unreadable`), or null when content has none. */
  readonly followup: string | null;
}

/**
 * The core's answer to starter `q`, or null when the day has no locked line for it (or the
 * starter is closed to this bucket): then the caller says the written answer.
 */
export function coreAnswer(i: CoreInput): CoreAnswer | null {
  const d = dayContent(i.day);
  const starter = openStarter(d, i.bucket, i.q, "", askedFrom(i.events), i.day.day);
  if (!starter) return null;
  const locked = lockedFor(d, starter.n, i.bucket, i.locale);
  if (!locked) return null;
  if (!locked.layered) return { answer: locked.text, taboo: null, layered: false, roll: null };
  const roll = d100(i.runId, i.day.day, locked.q);
  if (tabooUsedToday(i.events, i.day.day)) return { answer: locked.text, taboo: null, layered: true, roll };
  if (i.day.day >= PITY_FROM && !tabooEver(i.events)) return { answer: locked.text, taboo: locked.taboo ?? "blur", layered: true, roll };
  const outcome = outcomeOf(roll, i.bucket);
  if (outcome === "failure") return { answer: "", taboo: "flicker", layered: true, roll };
  if (outcome === "success") {
    const lines = [locked.text, glyphWord(i.runId, i.day.day, locked.q), ...(i.followup ? [i.followup] : [])];
    return { answer: lines.join("\n"), taboo: "blood", layered: true, roll };
  }
  return { answer: locked.text, taboo: locked.taboo ?? null, layered: true, roll };
}
