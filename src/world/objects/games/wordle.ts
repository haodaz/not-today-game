// Wordle (device-games 2, author 2026-11-13) on the 文曲星: a five-letter answer from
// content/wordle.json, six tries, any five letters accepted. Each letter is a hit (right place), near
// (in the word elsewhere) or miss, with the standard duplicate rule: hits first, then each other
// letter is near only while the answer still has an unmatched copy of it. Pure, no DOM.
import raw from "@content/wordle.json";
import { hash, unit } from "@state/seed";

export const WORDLE_LEN = 5;
export const WORDLE_TRIES = 6;
export type WordleMark = "hit" | "near" | "miss";

function parseAnswers(input: unknown): readonly string[] {
  const v = input as { answers?: unknown };
  if (!v || !Array.isArray(v.answers) || v.answers.length === 0) throw new Error("content/wordle.json: answers must be a non-empty list");
  for (const [i, w] of v.answers.entries()) if (typeof w !== "string" || !/^[a-z]{5}$/.test(w)) throw new Error(`content/wordle.json answers[${i}]: expected five lower-case letters`);
  return Object.freeze([...(v.answers as string[])]);
}
export const WORDLE_ANSWERS: readonly string[] = parseAnswers(raw);

/** The answer for a seed (a day): not random per open — the same seed, the same word. */
export const wordleAnswer = (seed: string, answers: readonly string[] = WORDLE_ANSWERS): string => answers[Math.floor(unit(hash(`${seed}:wordle`)) * answers.length)]!;

export interface WordleState {
  readonly answer: string;
  readonly rows: readonly { readonly word: string; readonly marks: readonly WordleMark[] }[];
  readonly won: boolean;
  readonly over: boolean;
}

export const newWordle = (answer: string): WordleState => ({ answer: answer.toLowerCase(), rows: [], won: false, over: false });

/** The marks of a guess against the answer (both lower case, five letters). */
export function markWordle(answer: string, word: string): WordleMark[] {
  const marks: WordleMark[] = Array(WORDLE_LEN).fill("miss");
  const left = new Map<string, number>();
  for (let i = 0; i < WORDLE_LEN; i++) {
    if (word[i] === answer[i]) marks[i] = "hit";
    else left.set(answer[i]!, (left.get(answer[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < WORDLE_LEN; i++) {
    if (marks[i] === "hit") continue;
    const n = left.get(word[i]!) ?? 0;
    if (n > 0) (marks[i] = "near"), left.set(word[i]!, n - 1);
  }
  return marks;
}

export const validWordle = (word: string): boolean => /^[a-z]{5}$/.test(word);

/** One guess: five letters, else (or after the end) nothing changes (`rejected`). */
export function guessWordle(s: WordleState, word0: string): { state: WordleState; marks: WordleMark[]; won: boolean; over: boolean; rejected: boolean } {
  const word = word0.toLowerCase();
  if (s.over || !validWordle(word)) return { state: s, marks: [], won: s.won, over: s.over, rejected: true };
  const marks = markWordle(s.answer, word);
  const won = marks.every((m) => m === "hit");
  const rows = [...s.rows, { word, marks }];
  const over = won || rows.length >= WORDLE_TRIES;
  return { state: { ...s, rows, won, over }, marks, won, over, rejected: false };
}

/** Each letter's best mark so far (hit over near over miss): the strip of letters used. */
export function letterMarks(s: Pick<WordleState, "rows">): Map<string, WordleMark> {
  const rank: Record<WordleMark, number> = { miss: 0, near: 1, hit: 2 };
  const out = new Map<string, WordleMark>();
  for (const r of s.rows) [...r.word].forEach((ch, i) => {
    const m = r.marks[i]!;
    const was = out.get(ch);
    if (!was || rank[m] > rank[was]) out.set(ch, m);
  });
  return out;
}
