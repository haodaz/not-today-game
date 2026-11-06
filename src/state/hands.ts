// The old things in hand (objects-in-hand FR1, FR3, FR4): what content says about holding and using
// each object. Claude's data, read strictly and frozen:
//   content/objects.json   → per object: key hotspots, screen / solar / reset rects on the front or
//                            back image (fractions of the object's box), the tape's reels and
//                            recordings, the phone's SIM line;
//   content/dictionary.json → the pocket dictionary's whole vocabulary;
//   content/calculator.json → digit → letter upside down, the strings to find, the unasked numbers;
//   content/kid.json        → the pager's schedule (the child's numbers; never rewritten here);
//   content/pager-foreign.json → pages on the same line that are not the child's (optional).
// recognise.ts reads the question half of objects.json; this file reads the hand half.
import objectsRaw from "@content/objects.json";
import dictionaryRaw from "@content/dictionary.json";
import calculatorRaw from "@content/calculator.json";
import kidRaw from "@content/kid.json";
import { parseLine, type SayLine } from "./days/table";
import { parseWorks, type Works } from "./works";

/** A rectangle on the object's image, as fractions of its box (0..1). */
export interface Rect {
  readonly l: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
}
export interface KeySpot extends Rect {
  readonly id: string;
  /** The label printed on the key, where content gives one (the dictionary's grid). */
  readonly label?: string;
}
export interface Reel {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}
export interface Recording {
  readonly id: string;
  /** May be empty (a recording with no name on the label). */
  readonly title: string;
  /** Only after this dream night (a dream night's number), else null. */
  readonly after: number | null;
  readonly say: readonly SayLine[];
  /** tape-reverse R2: what plays in reverse (a sleep-talk night's `backwards`); absent = nothing on it backwards. */
  readonly backwards?: readonly SayLine[];
}
export interface HandEntry {
  readonly keys: readonly KeySpot[];
  readonly screen: Rect | null;
  /** Named spots on the back image (the chick's reset hole). */
  readonly back: Readonly<Record<string, Rect>>;
  /** The calculator's solar cell. */
  readonly solar: Rect | null;
  readonly reels: { readonly left: Reel; readonly right: Reel } | null;
  readonly recordings: readonly Recording[];
  /** The line on the phone's SIM. */
  readonly sim: string | null;
  /** The IC card's line seen against the light (optional; absent = nothing shows). */
  readonly light: string | null;
  /** objects-in-room R1: where it works (absent = anywhere). Not the iccard's `light` text above. */
  readonly works: Works | null;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
type Fail = (where: string, problem: string) => never;
const failer =
  (file: string): Fail =>
  (where, problem) => {
    throw new Error(`content/${file} ${where}: ${problem}`);
  };
function keysOf(v: Raw, allowed: readonly string[], w: string, fail: Fail): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(w, `unknown key "${k}"`);
}
const str = (v: unknown, w: string, fail: Fail): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const int = (v: unknown, w: string, fail: Fail): number => (Number.isInteger(v) ? (v as number) : fail(w, "expected an integer"));
const frac = (v: unknown, w: string, fail: Fail): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : fail(w, "expected a fraction 0..1"));
const EPS = 1e-9;

function rect(v: unknown, w: string, fail: Fail, extra: readonly string[] = []): Rect {
  if (!isRecord(v)) fail(w, "must be an object {l,t,w,h}");
  keysOf(v, ["l", "t", "w", "h", ...extra], w, fail);
  const r = { l: frac(v.l, `${w}.l`, fail), t: frac(v.t, `${w}.t`, fail), w: frac(v.w, `${w}.w`, fail), h: frac(v.h, `${w}.h`, fail) };
  if (r.w <= 0 || r.h <= 0) fail(w, "w and h must be greater than 0");
  if (r.l + r.w > 1 + EPS || r.t + r.h > 1 + EPS) fail(w, "must lie inside the object's box");
  return Object.freeze(r);
}

/** The dictionary's grid: `cols × rows` keys over a rect, labels row by row. */
function grid(v: unknown, w: string, fail: Fail): KeySpot[] {
  if (!isRecord(v)) fail(w, "must be an object");
  keysOf(v, ["cols", "rows", "l", "t", "w", "h", "labels"], w, fail);
  const cols = int(v.cols, `${w}.cols`, fail);
  const rows = int(v.rows, `${w}.rows`, fail);
  if (cols < 1 || rows < 1) fail(w, "cols and rows must be at least 1");
  const box = rect({ l: v.l, t: v.t, w: v.w, h: v.h }, w, fail);
  if (!Array.isArray(v.labels) || v.labels.length !== cols * rows) fail(`${w}.labels`, `must list exactly cols × rows = ${cols * rows} labels`);
  const cw = box.w / cols;
  const ch = box.h / rows;
  return v.labels.map((label, i) => {
    const id = str(label, `${w}.labels[${i}]`, fail);
    return Object.freeze({ id, label: id, l: box.l + (i % cols) * cw, t: box.t + Math.floor(i / cols) * ch, w: cw, h: ch });
  });
}

function keyList(v: unknown, w: string, fail: Fail): KeySpot[] {
  if (Array.isArray(v)) {
    return v.map((k, i) => {
      if (!isRecord(k)) fail(`${w}[${i}]`, "must be an object {id,l,t,w,h}");
      return Object.freeze({ id: str(k.id, `${w}[${i}].id`, fail), ...rect(k, `${w}[${i}]`, fail, ["id"]) });
    });
  }
  if (!isRecord(v)) fail(w, "must be a list of {id,l,t,w,h} or {grid, power}");
  keysOf(v, ["grid", "power"], w, fail);
  if (v.grid === undefined) fail(`${w}.grid`, "is required");
  const out = grid(v.grid, `${w}.grid`, fail);
  if (v.power !== undefined) out.push(Object.freeze({ id: "power", ...rect(v.power, `${w}.power`, fail) }));
  return out;
}

function reel(v: unknown, w: string, fail: Fail): Reel {
  if (!isRecord(v)) fail(w, "must be an object {cx,cy,r}");
  keysOf(v, ["cx", "cy", "r"], w, fail);
  const r = { cx: frac(v.cx, `${w}.cx`, fail), cy: frac(v.cy, `${w}.cy`, fail), r: frac(v.r, `${w}.r`, fail) };
  if (r.r <= 0) fail(`${w}.r`, "must be greater than 0");
  return Object.freeze(r);
}

function recordings(v: unknown, w: string, fail: Fail): Recording[] {
  if (!Array.isArray(v) || v.length === 0) fail(w, "must be a non-empty list");
  const ids = new Set<string>();
  return v.map((r, i) => {
    const rw = `${w}[${i}]`;
    if (!isRecord(r)) fail(rw, "must be an object");
    keysOf(r, ["id", "title", "after", "say"], rw, fail);
    const id = str(r.id, `${rw}.id`, fail);
    if (ids.has(id)) fail(`${rw}.id`, `duplicate recording "${id}"`);
    ids.add(id);
    if (typeof r.title !== "string") fail(`${rw}.title`, "must be a string (may be empty)");
    let after: number | null = null;
    if (r.after !== undefined) {
      // A day, as content gives it (2026-11-06: no longer checked against the dream nights).
      after = int(r.after, `${rw}.after`, fail);
      if (after < 1) fail(`${rw}.after`, "must be a day ≥ 1");
    }
    if (!Array.isArray(r.say) || r.say.length === 0) fail(`${rw}.say`, "must be a non-empty list");
    const say = r.say.map((l, j) => {
      const lw = `${rw}.say[${j}]`;
      // A recording's line: who speaks and an optional backdrop; no place, no prop.
      if (isRecord(l) && (l.where !== undefined || l.prop !== undefined)) fail(lw, `unknown key "${l.where !== undefined ? "where" : "prop"}"`);
      return parseLine(l, lw, fail, true);
    });
    return Object.freeze({ id, title: r.title as string, after, say: Object.freeze(say) });
  });
}

/** Which object may carry which hand field (keys, screen and back go on any). */
const ONLY_ON: Readonly<Record<string, string>> = { solar: "calculator", reels: "tape", recordings: "tape", sim: "phone", light: "iccard" };
/** The keys recognise.ts leaves to this file. */
export const HAND_FIELDS = ["keys", "screen", "back", "solar", "reels", "recordings", "sim", "light", "works"] as const;

export function parseHands(input: unknown): ReadonlyMap<string, HandEntry> {
  const fail: Fail = failer("objects.json");
  if (!isRecord(input) || !isRecord(input.objects)) fail("objects", "must be an object");
  const out = new Map<string, HandEntry>();
  for (const [id, v] of Object.entries(input.objects as Raw)) {
    const w = `objects.${id}`;
    if (!isRecord(v)) fail(w, "must be an object");
    for (const [field, owner] of Object.entries(ONLY_ON)) if (v[field] !== undefined && owner !== id) fail(`${w}.${field}`, `only the ${owner} has ${field}`);
    const keys = v.keys === undefined ? [] : keyList(v.keys, `${w}.keys`, fail);
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k.id)) fail(`${w}.keys`, `duplicate key "${k.id}"`);
      seen.add(k.id);
    }
    const back: Record<string, Rect> = {};
    if (v.back !== undefined) {
      if (!isRecord(v.back)) fail(`${w}.back`, "must be an object of named rects");
      for (const [name, r] of Object.entries(v.back)) back[name] = rect(r, `${w}.back.${name}`, fail);
    }
    let reels: HandEntry["reels"] = null;
    if (v.reels !== undefined) {
      if (!isRecord(v.reels)) fail(`${w}.reels`, "must be an object {left, right}");
      keysOf(v.reels, ["left", "right"], `${w}.reels`, fail);
      reels = Object.freeze({ left: reel(v.reels.left, `${w}.reels.left`, fail), right: reel(v.reels.right, `${w}.reels.right`, fail) });
    }
    out.set(
      id,
      Object.freeze({
        keys: Object.freeze(keys),
        screen: v.screen === undefined ? null : rect(v.screen, `${w}.screen`, fail),
        back: Object.freeze(back),
        solar: v.solar === undefined ? null : rect(v.solar, `${w}.solar`, fail),
        reels,
        recordings: v.recordings === undefined ? Object.freeze([]) : Object.freeze(recordings(v.recordings, `${w}.recordings`, fail)),
        sim: v.sim === undefined ? null : str(v.sim, `${w}.sim`, fail),
        light: v.light === undefined ? null : str(v.light, `${w}.light`, fail),
        works: v.works === undefined ? null : parseWorks(v.works, `${w}.works`, fail),
      }),
    );
  }
  return out;
}

export const EMPTY_HAND: HandEntry = Object.freeze({ keys: [], screen: null, back: {}, solar: null, reels: null, recordings: [], sim: null, light: null, works: null });
export const handTable: ReadonlyMap<string, HandEntry> = parseHands(objectsRaw);
export const handOf = (id: string): HandEntry => handTable.get(id) ?? EMPTY_HAND;

// ——— the dictionary ———

export interface Word {
  readonly w: string;
  readonly gloss: string;
  readonly extra: string | null;
  /** The line shown when the Wenquxing is held over this word in a contract (work spec 2026-11-02 "the dictionary verifies"). */
  readonly contractNote?: string;
}
export interface DictionaryTable {
  readonly extraFromDay: number;
  readonly words: ReadonlyMap<string, Word>;
}
/** A word fits row 1 of the screen: lower-case a–z, at most 16 letters. */
export const WORD_RE = /^[a-z]{1,16}$/;
export function parseDictionary(input: unknown): DictionaryTable {
  const fail: Fail = failer("dictionary.json");
  if (!isRecord(input)) fail("", "not an object");
  keysOf(input, ["_note", "extraFromDay", "words"], "top level", fail);
  const extraFromDay = int(input.extraFromDay, "extraFromDay", fail);
  if (extraFromDay < 1) fail("extraFromDay", "must be a day (1..)");
  if (!Array.isArray(input.words) || input.words.length === 0) fail("words", "must be a non-empty list");
  const words = new Map<string, Word>();
  input.words.forEach((v, i) => {
    const w = `words[${i}]`;
    if (!isRecord(v)) fail(w, "must be an object");
    keysOf(v, ["w", "gloss", "extra", "contractNote"], w, fail);
    const word = str(v.w, `${w}.w`, fail);
    if (!WORD_RE.test(word)) fail(`${w}.w`, "must be 1–16 lower-case letters a–z");
    if (words.has(word)) fail(`${w}.w`, `duplicate word "${word}"`);
    words.set(word, Object.freeze({ w: word, gloss: str(v.gloss, `${w}.gloss`, fail), extra: v.extra === undefined ? null : str(v.extra, `${w}.extra`, fail), ...(v.contractNote !== undefined ? { contractNote: str(v.contractNote, `${w}.contractNote`, fail) } : {}) }));
  });
  return Object.freeze({ extraFromDay, words });
}
export const dictionaryTable = parseDictionary(dictionaryRaw);

// ——— the calculator ———

export interface Find {
  readonly keys: string;
  readonly reads: string;
}
export interface CalculatorTable {
  /** Digit → the letter it reads as upside down. */
  readonly upsideDown: Readonly<Record<string, string>>;
  readonly finds: readonly Find[];
  readonly unaskedFromDay: number;
  readonly unasked: readonly string[];
}
const DIGITS = "0123456789";
/** What a display reads upside down: the digits in reverse order, each by the table; the point stays a point. */
export function readUpsideDown(display: string, table: Readonly<Record<string, string>>): string {
  return [...display].reverse().map((c) => (c === "." ? "." : (table[c] ?? c))).join("");
}
export function parseCalculator(input: unknown): CalculatorTable {
  const fail: Fail = failer("calculator.json");
  if (!isRecord(input)) fail("", "not an object");
  keysOf(input, ["_note", "upsideDown", "finds", "unaskedFromDay", "unasked"], "top level", fail);
  if (!isRecord(input.upsideDown)) fail("upsideDown", "must map every digit 0–9 to a letter");
  keysOf(input.upsideDown, [...DIGITS], "upsideDown", fail);
  const upsideDown: Record<string, string> = {};
  for (const d of DIGITS) {
    const c = str(input.upsideDown[d], `upsideDown.${d}`, fail);
    if ([...c].length !== 1) fail(`upsideDown.${d}`, "must be one character");
    upsideDown[d] = c;
  }
  if (!Array.isArray(input.finds) || input.finds.length === 0) fail("finds", "must be a non-empty list");
  const finds = input.finds.map((v, i) => {
    const w = `finds[${i}]`;
    if (!isRecord(v)) fail(w, "must be an object");
    keysOf(v, ["keys", "reads", "from"], w, fail);
    const keys = str(v.keys, `${w}.keys`, fail);
    if (!/^[0-9]+(\.[0-9]+)?$/.test(keys) || keys.replace(".", "").length > 8) fail(`${w}.keys`, "must be a number of at most 8 digits");
    const reads = str(v.reads, `${w}.reads`, fail);
    if (v.from !== undefined) str(v.from, `${w}.from`, fail);
    // A calculator's point sits beside a digit: the reading is checked without it.
    const read = readUpsideDown(keys, upsideDown).replace(/\./g, "");
    if (read !== reads.replace(/\./g, "")) fail(`${w}.reads`, `"${keys}" reads "${read}" upside down, not "${reads}"`);
    return Object.freeze({ keys, reads });
  });
  const unaskedFromDay = int(input.unaskedFromDay, "unaskedFromDay", fail);
  if (!Array.isArray(input.unasked) || input.unasked.length === 0) fail("unasked", "must be a non-empty list");
  const unasked = input.unasked.map((u, i) => {
    const s = str(u, `unasked[${i}]`, fail);
    if (!finds.some((f) => f.keys === s)) fail(`unasked[${i}]`, `"${s}" is not one of the finds`);
    return s;
  });
  return Object.freeze({ upsideDown: Object.freeze(upsideDown), finds: Object.freeze(finds), unaskedFromDay, unasked: Object.freeze(unasked) });
}
export const calculatorTable = parseCalculator(calculatorRaw);

// ——— the pager's schedule (content/kid.json) ———

export interface PagerMessage {
  readonly day: number;
  /** The child's string, exactly as content has it. */
  readonly text: string;
  readonly meaning: string;
  /** Arrives only after the player's first reply that day (content's `after`). */
  readonly afterReply: boolean;
  /**
   * pager-foreign R2: a page that is not the child's, on the same line (content/pager-foreign.json):
   * only its digits (its `meaning` is its text: no name, no decoding); it cannot be answered.
   */
  readonly foreign?: true;
}
export function parseKid(input: unknown): readonly PagerMessage[] {
  const fail: Fail = failer("kid.json");
  if (!isRecord(input)) fail("", "not an object");
  if (!Array.isArray(input.schedule)) fail("schedule", "must be a list");
  let last = 0;
  return Object.freeze(
    input.schedule.map((v, i) => {
      const w = `schedule[${i}]`;
      if (!isRecord(v)) fail(w, "must be an object");
      keysOf(v, ["day", "text", "read", "meaning", "note", "after"], w, fail);
      const day = int(v.day, `${w}.day`, fail);
      if (day <= last) fail(`${w}.day`, "days must rise, one message a day at most");
      last = day;
      if (v.after !== undefined) str(v.after, `${w}.after`, fail);
      return Object.freeze({ day, text: str(v.text, `${w}.text`, fail), meaning: str(v.meaning, `${w}.meaning`, fail), afterReply: v.after !== undefined });
    }),
  );
}
export const pagerSchedule = parseKid(kidRaw);

// ——— pages that are not the child's (content/pager-foreign.json; pager-foreign R1) ———

/** One foreign page: it arrives at `t` (the game clock, HH:MM) on its day. */
export interface ForeignPage {
  readonly day: number;
  readonly t: string;
  readonly text: string;
}
/** At most this many foreign pages a day. */
export const FOREIGN_PER_DAY = 6;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIGITS_SPACES = /^[0-9 ]+$/;

/** Strict: days 1–18, `t` HH:MM, digits and spaces only, at most six a day, sorted by day then t. */
export function parseForeign(input: unknown): readonly ForeignPage[] {
  const fail: Fail = failer("pager-foreign.json");
  if (!isRecord(input)) fail("", "not an object");
  keysOf(input, ["_note", "pages"], "top level", fail);
  if (input._note !== undefined && typeof input._note !== "string") fail("_note", "must be a string");
  if (!Array.isArray(input.pages)) fail("pages", "must be a list");
  const perDay = new Map<number, number>();
  let prev: ForeignPage | null = null;
  return Object.freeze(
    input.pages.map((v, i) => {
      const w = `pages[${i}]`;
      if (!isRecord(v)) fail(w, "must be an object {day, t, text}");
      keysOf(v, ["day", "t", "text"], w, fail);
      const day = int(v.day, `${w}.day`, fail);
      if (day < 1 || day > 18) fail(`${w}.day`, "must be a day 1–18");
      const t = str(v.t, `${w}.t`, fail);
      if (!HHMM.test(t)) fail(`${w}.t`, `must be HH:MM, got "${t}"`);
      const text = str(v.text, `${w}.text`, fail);
      if (!DIGITS_SPACES.test(text)) fail(`${w}.text`, `digits and spaces only, got "${text}"`);
      const n = (perDay.get(day) ?? 0) + 1;
      if (n > FOREIGN_PER_DAY) fail(`${w}.day`, `at most ${FOREIGN_PER_DAY} pages a day (day ${day})`);
      perDay.set(day, n);
      if (prev && (day < prev.day || (day === prev.day && t < prev.t))) fail(w, "pages must be sorted by day, then t");
      prev = Object.freeze({ day, t, text });
      return prev;
    }),
  );
}
// Optional until Claude writes it (as content/frames/chick.json): absent = no foreign pages.
const foreignFiles = import.meta.glob("../../content/pager-foreign.json", { eager: true, import: "default" });
const foreignRaw = Object.values(foreignFiles)[0];
export const pagerForeign: readonly ForeignPage[] = foreignRaw === undefined ? Object.freeze([]) : parseForeign(foreignRaw);
