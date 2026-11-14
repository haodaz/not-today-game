// The pocket dictionary (objects-in-hand FR3.6): a clamshell, closed when lifted, opened by using it.
// A grey-green 2 × 16 dot matrix; English in, Chinese out, one word at a time (voices). Letters
// type into row 1; lookup shows content's gloss in row 2; from `extraFromDay` a word's `extra` is
// the line it should not have; an unknown word is 「未收录」 (strings). Upgraded: the whole gloss,
// smooth, and it is read out (a placeholder line in the box, until there is a voice).
import { dictionaryTable, type DictionaryTable } from "@state/hands";
import { t } from "@world/i18n";
import { Bits, drawDot, fitRow, type Frame } from "./frame";
import { step, type ObjectEnv, type Out, type Program } from "./program";
import { guessWordle, letterMarks, newWordle, wordleAnswer, WORDLE_LEN, WORDLE_TRIES, type WordleMark, type WordleState } from "./games/wordle";
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
  /** device-games 2: Wordle under way (the `game` key enters it; power leaves). Absent = the dictionary. */
  readonly game?: DictGame | null;
}

/** device-games 2: Wordle on the dot matrix. */
export interface DictGame {
  readonly wordle: WordleState;
  /** The letters typed for the next guess. */
  readonly input: string;
  /** When the game was lost (the answer scrolls once along the bottom line from then). */
  readonly lostAt: number | null;
}

/** The game's screen: the dot matrix at twice the cells' resolution (192 × 50, the same shape). */
export const WORDLE_W = DICT_COLS * 12;
export const WORDLE_H = 50;
/** A grid cell: 8 wide (a 5 × 7 letter and its margin), 8 tall. */
const GX = 2, GY = 1, PX = 8, PY = 8;
/** The right side: the letters used so far (two lines), and the bottom line where a lost answer scrolls. */
const SX = 46, SY = [1, 10] as const, SCROLL_Y = 41;
const STRIP_PER_ROW = 18;
/** How fast the lost answer scrolls (ms a pixel). */
export const WORDLE_SCROLL_MS = 25;

/** One letter at (x, y) with its mark: a hit is a lit block with the letter cut out, near is underlined with dots, a miss is plain. */
function markedLetter(b: Bits, x: number, y: number, ch: string, mark: WordleMark | null): void {
  drawDot(b, x + 1, y, ch.toUpperCase());
  if (mark === "hit") b.invert(x, y, PX - 1, PY);
  else if (mark === "near") for (let i = 0; i < PX - 1; i += 2) b.set(x + i, y + PY - 1);
}

export function drawWordle(g: DictGame, t: number): { w: number; h: number; bits: Uint8Array } {
  const b = new Bits(WORDLE_W, WORDLE_H);
  const w = g.wordle;
  for (let r = 0; r < WORDLE_TRIES; r++) {
    const row = w.rows[r];
    const typing = !row && r === w.rows.length && !w.over;
    for (let c = 0; c < WORDLE_LEN; c++) {
      const x = GX + c * PX, y = GY + r * PY;
      if (row) markedLetter(b, x, y, row.word[c]!, row.marks[c]!);
      else if (typing && g.input[c]) markedLetter(b, x, y, g.input[c]!, null);
      // an empty slot: one dot at its foot (the row being typed shows them all)
      else b.set(x + 3, y + PY - 1);
    }
  }
  // the letters used so far, in the alphabet's order, marked the same way
  const used = [...letterMarks(w)].sort((a, c) => (a[0] < c[0] ? -1 : 1));
  used.forEach(([ch, mark], i) => {
    const line = Math.floor(i / STRIP_PER_ROW);
    if (line < SY.length) markedLetter(b, SX + (i % STRIP_PER_ROW) * PX, SY[line]!, ch, mark);
  });
  // lost: the answer scrolls once along the bottom line, from the right edge, then stays
  if (w.over && !w.won && g.lostAt !== null) {
    const text = w.answer.toUpperCase();
    const span = WORDLE_W - SX;
    const travel = Math.floor(Math.max(0, t - g.lostAt) / WORDLE_SCROLL_MS);
    const x0 = Math.max(SX + 2, WORDLE_W - Math.min(travel, span));
    [...text].forEach((ch, i) => {
      const x = x0 + i * 6;
      if (x + 5 <= WORDLE_W) drawDot(b, x, SCROLL_Y, ch);
    });
  }
  return { w: b.w, h: b.h, bits: b.bits };
}

/** A key in Wordle. */
function gameKey(s: DictionaryState, g: DictGame, key: string, env: ObjectEnv): { state: DictionaryState; out: Out[] } {
  const at = (x: Partial<DictGame>, out: Out[] = []) => ({ state: { ...s, game: { ...g, ...x } }, out });
  // power leaves the mode (the dictionary as it was, on)
  if (key === "power") return { state: { ...s, game: null, input: "", answer: null, backed: false }, out: [] };
  if (g.wordle.over) return at({});
  if (LETTER.test(key)) return at({ input: (g.input + key.toLowerCase()).slice(0, WORDLE_LEN) });
  if (key === "back") return at({ input: g.input.slice(0, -1) });
  if (key === "lookup") {
    const r = guessWordle(g.wordle, g.input);
    if (r.rejected) return at({});
    // won: the little speaker beeps twice; lost: the answer scrolls along the bottom
    const beep: Out[] = r.won ? [{ sound: "key-press", rate: 2 }, { sound: "key-press", rate: 2, delay: 200 }] : [];
    return at({ wordle: r.state, input: "", lostAt: r.over && !r.won ? env.t : null }, beep);
  }
  return at({});
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
  if (s.game) return { kind: "pixels", ...drawWordle(s.game, env.t) };
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
    // device-games 2: `game` (the title's 玩一局) opens it on Wordle, the word of the seed (the day)
    if (key === "game") return env.upgraded ? step(s) : step({ ...s, open: true, on: true, input: "", answer: null, backed: false, game: { wordle: newWordle(wordleAnswer(`${env.seed}:${String(env.day)}`)), input: "", lostAt: null } });
    if (s.game && s.open && s.on) {
      const r = gameKey(s, s.game, key, env);
      return step(r.state, ...r.out);
    }
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
