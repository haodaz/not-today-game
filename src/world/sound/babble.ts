// voice-babble R2 (2026-11-05): the babble of one voice note as a plan, pure. One short syllable per
// character of the note's 转文字 text (or round(sec × 4) of them when it has none), never a word:
// the vowel and the tone are a hash of the character, the pitch the day's and the speaker's with a
// seeded wobble, so the same note always sounds the same. The player (babble-player.ts) only
// schedules this on the audio clock.
import { hash } from "@state/seed";
import { rngOf } from "./player";
import { pitchOf, voiceDay, type VoiceTable } from "./voice-table";

export interface BabbleSyllable {
  /** Seconds from the start. */
  readonly at: number;
  readonly dur: number;
  /** The pitch glides linearly from hzStart to hzEnd over the syllable. */
  readonly hzStart: number;
  readonly hzEnd: number;
  readonly f1: number;
  readonly f2: number;
}

export interface BabblePlan {
  readonly syllables: readonly BabbleSyllable[];
  /** 0..1: the hiss level (the syllables play at 1 − hiss). */
  readonly hiss: number;
  /** Seconds; never more than the note's own length. */
  readonly length: number;
}

/** A pause, not a syllable. */
const PAUSE = new Set(["，", "。", "、", "！", "？", ",", ".", "!", "?", " ", "\n"]);
/** Each wobble is within ±12 %. */
const WOBBLE = 0.12;
/** en build: every third syllable is stressed. */
const STRESS = 1.08;
/** Day 18's hiss plays at most this long. */
const HISS_ONLY_MAX_S = 6;
/** A note without text has this many syllables a second. */
const SYLLABLES_PER_S = 4;

export function babblePlan(text: string | null, sec: number, who: string, day: number, table: VoiceTable, locale: "zh" | "en"): BabblePlan {
  const row = voiceDay(table, day);
  if (row.hiss >= 1) return { syllables: [], hiss: 1, length: Math.min(sec, HISS_ONLY_MAX_S) };
  // The characters: the text's, or placeholders (their code points are their index).
  const chars = text !== null && text !== "" ? Array.from(text) : Array.from({ length: Math.round(sec * SYLLABLES_PER_S) }, (_, i) => String.fromCodePoint(0x4e00 + i));
  const rng = rngOf(hash(`${text ?? `#${sec}`}|${day}|${who}`));
  const base = row.baseHz * pitchOf(table, who);
  const syllables: BabbleSyllable[] = [];
  let t = 0;
  let n = 0;
  for (const ch of chars) {
    if (PAUSE.has(ch)) {
      t += row.gap * 4;
      continue;
    }
    // The cap: a syllable that would run past the note's length is not played.
    if (t + row.syllable > sec) break;
    const cp = ch.codePointAt(0)!;
    const [f1, f2] = table.vowels[cp % table.vowels.length]!;
    const hz = base * (1 + (rng() * 2 - 1) * WOBBLE);
    let start = 1;
    let end = 1;
    if (locale === "zh") [start, end] = table.tones.zh[hash(String(cp)) % table.tones.zh.length]!;
    else if (n % 3 === 2) start = end = STRESS;
    syllables.push({ at: t, dur: row.syllable, hzStart: hz * start, hzEnd: hz * end, f1, f2 });
    t += row.syllable + row.gap;
    n += 1;
  }
  const last = syllables.at(-1);
  return { syllables, hiss: row.hiss, length: Math.min(sec, last ? last.at + last.dur : 0) };
}
