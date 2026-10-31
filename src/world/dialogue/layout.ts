// The box's pages (dialogue FR1): a line longer than three rows is paged, never scrolled; choices
// fill a box of four rows. Pure. The width table is a monospace fallback that errs wide, so a page
// measured here never needs a fourth row in the browser (the box also clips, as a guard).
import type { Locale } from "@world/i18n";

export interface BoxGeom {
  /** Outer width in stage px. */
  readonly width: number;
  /** Horizontal padding, each side. */
  readonly padX: number;
  /** Text rows per screen. */
  readonly rows: number;
  /** Choice rows per screen, and choices per screen. */
  readonly choiceRows: number;
  readonly maxChoices: number;
}

/** The line box: about 62 % of the 1600 px stage, three rows (mock design/chrome/dialogue.html). */
export const LINE_BOX: BoxGeom = { width: 992, padX: 30, rows: 3, choiceRows: 4, maxChoices: 4 };
/** The player's box, rising from the right edge. */
export const PLAYER_BOX: BoxGeom = { width: 560, padX: 30, rows: 3, choiceRows: 4, maxChoices: 4 };
/** A choice's ◆ indent. */
export const CHOICE_INDENT = 20;
/** A choice is at most two rows (clamped). */
export const CHOICE_MAX_ROWS = 2;

/** Body size: 18 px (zh) / 17 px (en). */
export const fontPx = (locale: Locale): number => (locale === "en" ? 17 : 18);

/** Full-width: CJK, kana, hangul, full-width forms, CJK punctuation, and the dashes/quotes CJK fonts set wide. */
const WIDE = /[\u1100-\u115f\u2014\u2018\u2019\u201c\u201d\u2026\u2e80-\u303f\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|[\ud800-\udbff]/;

/** One character's advance in px: 1 em wide, 0.6 em otherwise. */
export function charWidth(ch: string, px: number): number {
  return WIDE.test(ch) ? px : 0.6 * px;
}

export function textWidth(text: string, px: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch, px);
  return w;
}

/** The text's tokens: a wide character alone, or a run of narrow non-spaces; each with its trailing spaces. */
function tokens(text: string): string[] {
  const out: string[] = [];
  const re = /(?:[\u1100-\u115f\u2014\u2018\u2019\u201c\u201d\u2026\u2e80-\u303f\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]|[\ud800-\udbff][\udc00-\udfff]|[^\s\u1100-\u115f\u2014\u2018\u2019\u201c\u201d\u2026\u2e80-\u303f\u3040-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6\ud800-\udfff]+|\s+)/g;
  for (const m of text.matchAll(re)) out.push(m[0]);
  // Spaces join the token before them, so a line keeps its trailing space.
  const joined: string[] = [];
  for (const t of out) {
    if (/^\s+$/.test(t) && joined.length) joined[joined.length - 1] += t;
    else joined.push(t);
  }
  return joined;
}

/**
 * The visual lines of `text` at `maxWidth` px: greedy; CJK breaks anywhere, Latin at spaces; a
 * word longer than the line is cut. `\n` is a hard break. The lines concatenated give the text.
 */
export function wrap(text: string, maxWidth: number, px: number): string[] {
  const lines: string[] = [];
  for (const [i, para] of text.split("\n").entries()) {
    const nl = i < text.split("\n").length - 1 ? "\n" : "";
    let line = "";
    let w = 0;
    const push = () => {
      lines.push(line);
      line = "";
      w = 0;
    };
    for (const tok of tokens(para)) {
      const word = tok.trimEnd();
      const ww = textWidth(word, px);
      if (line && w + ww > maxWidth) push();
      if (ww > maxWidth) {
        // A word longer than the line: cut it by characters.
        for (const ch of tok) {
          const cw = /\s/.test(ch) ? 0 : charWidth(ch, px);
          if (line && w + cw > maxWidth) push();
          line += ch;
          w += /\s/.test(ch) ? charWidth(" ", px) : cw;
        }
        continue;
      }
      line += tok;
      w += textWidth(tok, px);
    }
    if (line || lines.length === 0 || para === "") lines.push(line);
    if (nl) lines[lines.length - 1] += nl;
  }
  return lines;
}

/** The text area of a box, less one em of slack (the browser's punctuation rules may push a character on). */
export function textArea(geom: BoxGeom, px: number): number {
  return geom.width - 2 * geom.padX - px;
}

/** One screen of the box: a page of text (possibly empty) and the choices on it (indexes). */
export interface Screen {
  readonly text: string;
  readonly rows: number;
  readonly choices: readonly number[];
  readonly choiceRows: number;
}

/** How many rows a choice takes: 1 or 2 (clamped). */
export function choiceRows(label: string, geom: BoxGeom, px: number): number {
  return Math.min(CHOICE_MAX_ROWS, Math.max(1, wrap(label, textArea(geom, px) - CHOICE_INDENT, px).length));
}

/**
 * The screens for one line and its choices (FR1): text pages of ≤ `rows` rows, then choice pages
 * of ≤ `maxChoices` choices and ≤ `choiceRows` rows. The first choice page shares the last text
 * page when their rows add up to ≤ `rows` (a one-row prompt over two choices).
 */
export function screens(text: string | null, choices: readonly string[] | null, geom: BoxGeom, px: number): Screen[] {
  const out: Screen[] = [];
  const lines = text ? wrap(text, textArea(geom, px), px) : [];
  for (let i = 0; i < lines.length; i += geom.rows) {
    const page = lines.slice(i, i + geom.rows);
    out.push({ text: page.join(""), rows: page.length, choices: [], choiceRows: 0 });
  }
  const pages: { choices: number[]; rows: number }[] = [];
  if (choices && choices.length) {
    let cur = { choices: [] as number[], rows: 0 };
    choices.forEach((label, index) => {
      const r = choiceRows(label, geom, px);
      if (cur.choices.length && (cur.choices.length >= geom.maxChoices || cur.rows + r > geom.choiceRows)) {
        pages.push(cur);
        cur = { choices: [], rows: 0 };
      }
      cur.choices.push(index);
      cur.rows += r;
    });
    pages.push(cur);
  }
  const last = out[out.length - 1];
  if (last && pages[0] && last.rows + pages[0].rows <= geom.rows) {
    out[out.length - 1] = { ...last, choices: pages[0].choices, choiceRows: pages[0].rows };
    pages.shift();
  }
  for (const p of pages) out.push({ text: "", rows: 0, choices: p.choices, choiceRows: p.rows });
  if (out.length === 0) out.push({ text: "", rows: 0, choices: [], choiceRows: 0 });
  return out;
}

/** The screens that hold choices (the ▼ there cycles through them). */
export const choiceScreens = (all: readonly Screen[]): number[] => all.flatMap((s, i) => (s.choices.length ? [i] : []));

/**
 * The marker at the box's bottom right: ▼ when more of the line follows (or more choice pages),
 * ▶ on the line's last text screen, nothing on a lone choice screen.
 */
export function marker(all: readonly Screen[], i: number): "more" | "next" | null {
  const s = all[i];
  if (!s) return null;
  if (s.choices.length) return choiceScreens(all).length > 1 ? "more" : null;
  return i < all.length - 1 ? "more" : "next";
}

/** Where ▼ goes from screen `i`: the next screen, or from the last choice page back to the first. */
export function nextScreen(all: readonly Screen[], i: number): number {
  if (i < all.length - 1) return i + 1;
  const cs = choiceScreens(all);
  return cs.length > 1 && all[i]?.choices.length ? cs[0]! : i;
}
