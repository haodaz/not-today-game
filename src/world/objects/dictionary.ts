// The pocket dictionary (objects-in-hand FR3.6): a clamshell, closed when lifted, opened by using it.
// A grey-green 2 × 16 dot matrix; English in, Chinese out, one word at a time (voices). Letters
// type into row 1; lookup shows content's gloss in row 2; from `extraFromDay` a word's `extra` is
// the line it should not have; an unknown word is 「未收录」 (strings). Upgraded: the whole gloss,
// smooth, and it is read out (a placeholder line in the box, until there is a voice).
import { dictionaryTable, type DictionaryTable } from "@state/hands";
import { t } from "@world/i18n";
import { fitRow, type Frame } from "./frame";
import { step, type ObjectEnv, type Program } from "./program";
import { NO_PRESS, pressed, upgradedHi, type KuroPress } from "./taken";

export const DICT_COLS = 16;
export const DICT_ROWS = 2;
const MAX_INPUT = 16;

export interface DictionaryState {
  readonly open: boolean;
  readonly on: boolean;
  readonly input: string;
  /** The answer to the last lookup: the two rows it shows, or null while typing. */
  readonly answer: readonly [string, string] | null;
  /** dictionary-back 2026-11-10: the answer is the second press (the Chinese translated back into English). */
  readonly backed: boolean;
  /** Kuro's press tracker (object-upgrade 2026-11-03). */
  readonly press: KuroPress;
}

/** The two rows for a lookup of `word` on `day`. */
export function lookup(word: string, day: number, table: DictionaryTable = dictionaryTable): [string, string] {
  const hit = table.words.get(word);
  if (!hit) return [word, t("dictionary.unknown")];
  // The second line it should not have: the gloss moves up, the extra comes in under it.
  if (hit.extra && day >= table.extraFromDay) return [hit.gloss, hit.extra];
  return [word, hit.gloss];
}

/**
 * The second press of 查 on an answer (author 2026-11-10, 「先翻译成中文，再点某个按钮中文翻译回英文」):
 * the Chinese in row 1, the English it comes back as in row 2 — the word itself until `backFromDay`
 * (a faithful round trip), then the word's `back`, which is not what went in. An unknown word comes
 * back as itself. Chinese players understand at the first layer; English players press twice.
 */
export function lookupBack(word: string, day: number, table: DictionaryTable = dictionaryTable): [string, string] {
  const hit = table.words.get(word);
  if (!hit) return [t("dictionary.unknown"), word];
  const back = hit.back !== null && day >= table.backFromDay ? hit.back : word;
  return [hit.gloss, back];
}

export function drawDictionary(s: DictionaryState, env: ObjectEnv): Frame {
  // The new world's screen, shut or not: never the dot matrix — and once Kuro has moved in, Kuro's
  // pose instead (a glimpse on loan, only Kuro once taken; object-upgrade 2026-11-03).
  if (env.upgraded) return upgradedHi(env, s.press, { lines: s.open && s.on ? (s.answer ?? [s.input, ""]).filter((r) => r !== "") : [] });
  if (!s.open || !s.on) return { kind: "cells", cols: DICT_COLS, rows: ["", ""], level: env.level };
  const rows = s.answer ?? [s.input, ""];
  return { kind: "cells", cols: DICT_COLS, rows: rows.map((r) => fitRow(r, DICT_COLS)), level: env.level };
}

const LETTER = /^[A-Z]$/;

export const dictionary: Program<DictionaryState> = {
  id: "dictionary",
  channel: { w: DICT_COLS, h: DICT_ROWS },
  keySound: { id: "key-press" },
  init: () => ({ open: false, on: false, input: "", answer: null, backed: false, press: NO_PRESS }),
  key(s, key, env) {
    // Every key bumps Kuro's press tracker (object-upgrade 2026-11-03).
    s = { ...s, press: pressed(s.press, env.t) };
    // Taken: Kuro answers only with talk; the dictionary's own keys do nothing (no lookup, no say).
    if (env.taken) return step(s);
    // Using the closed thing opens it (the loose hinge wobbles; the layer draws that), and it comes on.
    if (key === "open") return step(s.open ? s : { ...s, open: true, on: true });
    if (!s.open) return step(s);
    if (key === "power") return step({ ...s, on: !s.on, input: "", answer: null, backed: false }, { sound: "key-press", rate: 0.5 });
    if (!s.on) return step(s);
    if (LETTER.test(key)) return step({ ...s, input: s.answer ? key.toLowerCase() : (s.input + key.toLowerCase()).slice(0, MAX_INPUT), answer: null, backed: false });
    // The space bar (author: "文曲星不能没有空格"): one space, unless the input is empty, already ends
    // with a space, or an answer is showing.
    if (key === "space") {
      if (s.answer || !s.input || s.input.endsWith(" ")) return step(s);
      return step({ ...s, input: (s.input + " ").slice(0, MAX_INPUT) });
    }
    if (key === "back") return step({ ...s, input: s.answer ? s.input : s.input.slice(0, -1), answer: null, backed: false });
    if (key === "lookup") {
      // Look up the trimmed input (trailing/leading spaces from the space bar do not count).
      const word = s.input.trim();
      if (!word) return step(s);
      // 查 again on an answer: the Chinese translated back into English (a third press does nothing).
      if (s.answer && !s.backed) {
        const back = lookupBack(word, env.day);
        if (env.upgraded) return step({ ...s, answer: back, backed: true }, { say: { key: `d${env.day}:dictionary:${word}:back`, lines: [{ k: "sfx", t: back.join(" ") }] } });
        return step({ ...s, answer: back, backed: true });
      }
      if (s.answer) return step(s);
      const answer = lookup(word, env.day);
      // Upgraded, it also reads the answer out: a line in the box stands in for the voice.
      if (env.upgraded) return step({ ...s, answer, backed: false }, { say: { key: `d${env.day}:dictionary:${word}`, lines: [{ k: "sfx", t: answer.join(" ") }] } });
      return step({ ...s, answer, backed: false });
    }
    return step(s);
  },
  draw: drawDictionary,
};
