/// <reference types="vite/client" />
// content/tasks/day-NN.json (Claude's): the workbench's hand-written work-task trees. Each task:
// `start` (narration + the three options) and three paths self / look / let, each with `say`
// (dialogue box), `kuro` (small window, English constants) and `effects`. No LLM. Read, checked
// strictly, frozen; no string is rewritten.
import { parseLine, type SayLine } from "./table";
import { bilingual, bilingualValues } from "../content-locale";

export const PATHS = ["self", "look", "let"] as const;
export type PathMode = (typeof PATHS)[number];
export const APPS = ["docs", "ledger", "code"] as const;

export interface TaskEffects {
  readonly flags?: readonly string[];
  readonly san?: number;
  /** How far this path moves assimilation (three-meters spec): added, clamped 0–100, never down. */
  readonly assimilation?: number;
  /** The player looked at what it did (the event itself is the record). */
  readonly looked?: boolean;
  readonly letItDoUnchecked?: number;
}

export interface TaskPath {
  readonly say: readonly SayLine[];
  readonly kuro: readonly string[];
  readonly effects: TaskEffects;
}

/** What a mark may be about (work spec "marking is the operation"): the conflict, Kuro's touch, or an odd thing. */
export const MARK_KINDS = ["conflict", "kuro", "odd"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

/**
 * A markable spot on a surface (work spec 2026-11-02). `clause` is the clause/line/row index; an
 * optional `span` is a character range inside it (for the drag-a-span rule). `worth` is 1 or 2.
 * `caught` is the line Kuro's window shows when a `kuro` spot is marked. `hidden` keeps a `kuro`
 * spot out of 看一眼's diff (found only by reading, day 7+). `word` lists a word the dictionary
 * glosses when held over it. Which catch flag a hit sets: the surface's `catchFlags` (doc), by index.
 */
export interface TaskMark {
  readonly clause: number;
  readonly span?: readonly [number, number];
  readonly kind: MarkKind;
  readonly worth: 1 | 2;
  readonly caught?: string;
  readonly hidden?: true;
  readonly word?: string;
}

/** One unit Kuro hands over in 自己做 (work spec "two modes"): its text, and the fix if 「这里不对」 is said. */
export interface TaskUnit {
  readonly text: string;
  readonly fix?: string;
}

/**
 * The document surface (work FR1, docs): two versions side by side, the two clauses that
 * contradict each other (0-based), the flags only a real read sets, and Kuro's touch when it does
 * the work (absent: it is simply right that time; FR2). `marks` (optional) lists the markable spots;
 * `units` (optional) is what 自己做 hands over one at a time.
 */
export interface TaskDoc {
  readonly left: readonly string[];
  readonly right: readonly string[];
  readonly conflict: readonly [number, number];
  readonly catchFlags: readonly string[];
  readonly kuroEdit?: { readonly clause: number; readonly text: string };
  readonly marks?: readonly TaskMark[];
  readonly units?: readonly TaskUnit[];
}

/** The ledger surface (work FR1, ledger): the rows, the columns, the one cell to change and its value, Kuro's tidy. */
export interface TaskLedger {
  readonly rows: readonly (readonly (string | number)[])[];
  readonly columns: readonly string[];
  readonly target: readonly [number, number];
  readonly value: string | number;
  readonly kuroTidy?: { readonly col: number; readonly how: string };
  readonly marks?: readonly TaskMark[];
  readonly units?: readonly TaskUnit[];
}

/**
 * The code surface (work spec "code surface" 2026-11-02): a monospace file view with line numbers.
 * Marks are by line; the same pen rules as the document.
 */
export interface TaskCode {
  readonly lines: readonly string[];
  readonly catchFlags: readonly string[];
  readonly marks?: readonly TaskMark[];
  readonly units?: readonly TaskUnit[];
}

/**
 * Work v2 (2026-11-03): a task may carry a board (several steps assembled into a result), a
 * deliverable (what lands on the desk) and a judge (one SAN change a night). The only board kind is
 * a table: rows with a given column (optionally locked behind an old object) and one slot each, a
 * tray of cards, and Kuro's own fill/cards/unlock. All shapes are in `.kiro/specs/work-v2/`.
 */
/**
 * A board's lock. It has an `object` (the old object that shows the code; object-bar R3), a `from`
 * (day-graph addition 2026-11-04: the code is in a file / conversation / the call, the card-source
 * shape), or both — never neither. With `from`, the code chips are offered only once that source has
 * been opened today; `hint` says where to look while it has not.
 */
export interface BoardLock {
  readonly object?: string;
  readonly from?: CardFrom;
  readonly hint?: string;
  readonly codes: readonly string[];
  readonly answer: string;
}
export interface BoardGiven {
  readonly lock?: BoardLock;
  readonly rows: Readonly<Record<string, string>>;
}
export interface BoardSlot {
  readonly id: string;
  readonly label: string;
  readonly answer: string;
}
/**
 * Where a card's material comes from (day-graph 2026-11-03), one of: a file in the 文件 app or a
 * deliverable page (`file`), a conversation (`conv`), or today's boss call (`call: true`). Absent =
 * available from the start. A card is found when its source has been opened / the call ended today.
 */
export type CardFrom = { readonly file: string } | { readonly conv: string } | { readonly call: true } | { readonly meeting: true };
export interface BoardCard {
  readonly id: string;
  readonly text: string;
  /** Where the card's material comes from (day-graph); absent = available from the start. */
  readonly from?: CardFrom;
  /** Shown in the card's place while it is not yet found (twinned like other board text). */
  readonly hint?: string;
}
export interface BoardKuro {
  readonly fill: Readonly<Record<string, string>>;
  readonly cards: readonly BoardCard[];
  readonly unlock: string;
}
/** How a board is drawn (ide R1, meeting R1): the table (default), the IDE view, or the meeting. */
export const BOARD_VIEWS = ["table", "ide", "meeting"] as const;
/** One tile of the meeting (meeting R1): its name label and an optional image (a path under `/`). */
export interface MeetingPerson {
  readonly id: string;
  readonly name: string;
  readonly tile?: string;
}
/** One subtitle of the meeting (meeting R1): its time, who says it, the text, and the card it reveals. */
export interface MeetingLine {
  readonly t: string;
  readonly who: string;
  readonly text: string;
  readonly card?: string;
}
export const MEETING_LAYOUTS = ["grid", "seats"] as const;
export const MEETING_SEATS = ["circle", "triangle"] as const;
export type MeetingSeat = (typeof MEETING_SEATS)[number];
/** The meeting view's content (meeting R1): the tiles, the subtitles, and how the slots are drawn. */
export interface BoardMeeting {
  readonly people: readonly MeetingPerson[];
  readonly lines: readonly MeetingLine[];
  readonly layout: (typeof MEETING_LAYOUTS)[number];
  /** With `layout: "seats"`: each slot's seat. */
  readonly seats?: Readonly<Record<string, MeetingSeat>>;
}
export type BoardView = (typeof BOARD_VIEWS)[number];
/** The IDE view's preview (ide R1): the deliverable's URL, and the page index (`c`) of each slot. */
export interface BoardIde {
  readonly src: string;
  readonly pages: Readonly<Record<string, number>>;
  /** shell R4: each slot's page as a code file (its name, its lines; one line holds `{{slot}}`). */
  readonly files?: Readonly<Record<string, IdeFile>>;
}
/** One IDE page's code (shell R4). */
export interface IdeFile {
  readonly name: string;
  readonly code: readonly string[];
}
/** One line of a beat: who says it (Kuro or the player) and the text (twinned in the en file). */
export interface BoardBeatLine {
  readonly who: "kuro" | "me";
  readonly text: string;
}
/**
 * A beat of the IDE transcript (ide R1/R4): what it is shown on — `open`, `fill:<slot>`,
 * `fill:<slot>:<card>`, `kuro`, `unlock`, `print`, `send` — and its lines.
 */
export interface BoardBeat {
  readonly on: string;
  readonly lines: readonly BoardBeatLine[];
}
export interface TaskBoard {
  readonly kind: "table";
  readonly title: string;
  readonly columns: readonly string[];
  readonly given: BoardGiven;
  readonly slots: readonly BoardSlot[];
  readonly cards: readonly BoardCard[];
  readonly kuro: BoardKuro;
  /** ide R1: `"ide"` draws the IDE view; absent = the table. */
  readonly view?: BoardView;
  /** ide R1: the preview (only with `view: "ide"`). */
  readonly ide?: BoardIde;
  /** ide R1: Kuro's transcript beats. */
  readonly beats?: readonly BoardBeat[];
  /** meeting R1: the meeting (only with `view: "meeting"`). */
  readonly meeting?: BoardMeeting;
}
/** Who a deliverable goes to (work v2 addition 2026-11-03 night); absent = `"hand"`. */
export const DELIVERABLE_TO = ["boss", "partner", "group", "workbench", "hand"] as const;
export type DeliverableTo = (typeof DELIVERABLE_TO)[number];
export interface TaskDeliverable {
  readonly id: string;
  readonly label: string;
  readonly img?: string;
  /**
   * Who receives it. A person (`boss` / `partner` / `group`) or `workbench` is sent on screen by a
   * `board.send.<to>` button; `hand` (the default) lands on the desk and is given at night.
   */
  readonly to?: DeliverableTo;
}
export interface TaskJudge {
  readonly perfect: number;
  readonly flawed: number;
  readonly wrong: number;
  readonly wrongAt: number;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly app: (typeof APPS)[number];
  /** The flag that ticks the day's checklist item. */
  readonly done: string;
  /**
   * The reply tree. A board task (work v2) has no real tree; it carries inert empty placeholders so
   * every reader keeps its shape. Code that handles board tasks branches on `board` first.
   */
  readonly start: { readonly say: readonly SayLine[]; readonly options: readonly { readonly mode: PathMode; readonly goto: PathMode }[] };
  readonly self: TaskPath;
  readonly look: TaskPath;
  readonly let: TaskPath;
  /** The working surface, when content has one for this task (else the plain thread). */
  readonly doc?: TaskDoc;
  readonly ledger?: TaskLedger;
  readonly code?: TaskCode;
  /** Work v2: a board task (its own surface); when present, the three-path tree is unused. */
  readonly board?: TaskBoard;
  readonly deliverable?: TaskDeliverable;
  readonly judge?: TaskJudge;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/tasks ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const mode = (v: unknown, w: string): PathMode => ((PATHS as readonly unknown[]).includes(v) ? (v as PathMode) : fail(w, `must be one of ${PATHS.join(", ")}`));

function lines(v: unknown, w: string): SayLine[] {
  if (!Array.isArray(v)) fail(w, "must be a list");
  return v.map((x, i) => parseLine(x, `${w}[${i}]`, (where, problem) => fail(where, problem)));
}

function path(v: unknown, w: string): TaskPath {
  if (!isRecord(v)) fail(w, "a path must be an object");
  keys(v, ["say", "kuro", "effects"], w);
  if (!Array.isArray(v.kuro) || !v.kuro.every((k) => typeof k === "string" && k !== "")) fail(`${w}.kuro`, "must be a list of strings");
  const e = v.effects;
  if (!isRecord(e)) fail(`${w}.effects`, "must be an object");
  keys(e, ["flags", "san", "assimilation", "looked", "letItDoUnchecked"], `${w}.effects`);
  if (e.flags !== undefined && (!Array.isArray(e.flags) || !e.flags.every((f) => typeof f === "string"))) fail(`${w}.effects.flags`, "must be a list of strings");
  if (e.san !== undefined && !Number.isInteger(e.san)) fail(`${w}.effects.san`, "must be an integer");
  if (e.assimilation !== undefined && !(Number.isInteger(e.assimilation) && (e.assimilation as number) >= 0)) fail(`${w}.effects.assimilation`, "must be an integer >= 0");
  if (e.looked !== undefined && typeof e.looked !== "boolean") fail(`${w}.effects.looked`, "must be true or false");
  if (e.letItDoUnchecked !== undefined && !(Number.isInteger(e.letItDoUnchecked) && (e.letItDoUnchecked as number) >= 0)) {
    fail(`${w}.effects.letItDoUnchecked`, "must be an integer >= 0");
  }
  return { say: lines(v.say, `${w}.say`), kuro: v.kuro as string[], effects: e as TaskEffects };
}

const index = (v: unknown, n: number, w: string): number => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : fail(w, `must be an index from 0 to ${n - 1}`));
const strings = (v: unknown, w: string): string[] => (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && x !== "") ? (v as string[]) : fail(w, "must be a non-empty list of non-empty strings"));

/** One markable spot: `clause` is in 0..count-1; `span` (if any) is a character range; worth 1 or 2. */
function mark(v: unknown, w: string, count: number, textOf: (clause: number) => string): TaskMark {
  if (!isRecord(v)) fail(w, "a mark must be an object");
  keys(v, ["clause", "span", "kind", "worth", "caught", "hidden", "word"], w);
  const clause = index(v.clause, count, `${w}.clause`);
  if (!(MARK_KINDS as readonly unknown[]).includes(v.kind)) fail(`${w}.kind`, `must be one of ${MARK_KINDS.join(", ")}`);
  if (v.worth !== 1 && v.worth !== 2) fail(`${w}.worth`, "must be 1 or 2");
  let span: readonly [number, number] | undefined;
  if (v.span !== undefined) {
    const len = textOf(clause).length;
    if (!Array.isArray(v.span) || v.span.length !== 2) fail(`${w}.span`, "must be [start, end]");
    const [a, b] = [v.span[0], v.span[1]];
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b <= a || b > len) fail(`${w}.span`, `must be 0 <= start < end <= ${len}`);
    span = [a as number, b as number];
  }
  if (v.hidden !== undefined && v.hidden !== true) fail(`${w}.hidden`, "must be true");
  if (v.hidden && v.kind !== "kuro") fail(`${w}.hidden`, "only a kuro spot may be hidden");
  return {
    clause,
    kind: v.kind as MarkKind,
    worth: v.worth,
    ...(span ? { span } : {}),
    ...(v.caught !== undefined ? { caught: str(v.caught, `${w}.caught`) } : {}),
    ...(v.hidden ? { hidden: true as const } : {}),
    ...(v.word !== undefined ? { word: str(v.word, `${w}.word`) } : {}),
  };
}

function marks(v: unknown, w: string, count: number, textOf: (clause: number) => string): TaskMark[] {
  if (!Array.isArray(v)) fail(w, "must be a list");
  return v.map((m, i) => mark(m, `${w}[${i}]`, count, textOf));
}

/** A unit is a string (shorthand for `{ text }`) or `{ text, fix? }`. */
function unit(v: unknown, w: string): TaskUnit {
  if (typeof v === "string") return v !== "" ? { text: v } : fail(w, "expected a non-empty string");
  if (!isRecord(v)) fail(w, "a unit is a string or { text, fix? }");
  keys(v, ["text", "fix"], w);
  return { text: str(v.text, `${w}.text`), ...(v.fix !== undefined ? { fix: str(v.fix, `${w}.fix`) } : {}) };
}
function units(v: unknown, w: string): TaskUnit[] {
  if (!Array.isArray(v) || v.length === 0) fail(w, "must be a non-empty list");
  return v.map((u, i) => unit(u, `${w}[${i}]`));
}

function doc(v: unknown, w: string, selfFlags: readonly string[]): TaskDoc {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["left", "right", "conflict", "catchFlags", "kuroEdit", "marks", "units"], w);
  const left = strings(v.left, `${w}.left`);
  const right = strings(v.right, `${w}.right`);
  if (left.length !== right.length) fail(w, `left has ${left.length} clauses, right ${right.length}`);
  if (!Array.isArray(v.conflict) || v.conflict.length !== 2) fail(`${w}.conflict`, "must be two clause indexes");
  const conflict = [index(v.conflict[0], left.length, `${w}.conflict[0]`), index(v.conflict[1], left.length, `${w}.conflict[1]`)] as const;
  if (conflict[0] === conflict[1]) fail(`${w}.conflict`, "must be two different clauses");
  const catchFlags = strings(v.catchFlags, `${w}.catchFlags`);
  for (const f of catchFlags) if (!selfFlags.includes(f)) fail(`${w}.catchFlags`, `"${f}" is not set by the self path`);
  let kuroEdit: TaskDoc["kuroEdit"];
  if (v.kuroEdit !== undefined) {
    if (!isRecord(v.kuroEdit)) fail(`${w}.kuroEdit`, "must be an object");
    keys(v.kuroEdit, ["clause", "text"], `${w}.kuroEdit`);
    kuroEdit = { clause: index(v.kuroEdit.clause, left.length, `${w}.kuroEdit.clause`), text: str(v.kuroEdit.text, `${w}.kuroEdit.text`) };
  }
  // Marks index into the right column (what the player audits); spans measure against its text.
  const ms = v.marks !== undefined ? marks(v.marks, `${w}.marks`, right.length, (c) => right[c]!) : undefined;
  const us = v.units !== undefined ? units(v.units, `${w}.units`) : undefined;
  return { left, right, conflict, catchFlags, ...(kuroEdit ? { kuroEdit } : {}), ...(ms ? { marks: ms } : {}), ...(us ? { units: us } : {}) };
}

function code(v: unknown, w: string, selfFlags: readonly string[]): TaskCode {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["lines", "catchFlags", "marks", "units"], w);
  const lineList = strings(v.lines, `${w}.lines`);
  const catchFlags = strings(v.catchFlags, `${w}.catchFlags`);
  for (const f of catchFlags) if (!selfFlags.includes(f)) fail(`${w}.catchFlags`, `"${f}" is not set by the self path`);
  const ms = v.marks !== undefined ? marks(v.marks, `${w}.marks`, lineList.length, (c) => lineList[c]!) : undefined;
  const us = v.units !== undefined ? units(v.units, `${w}.units`) : undefined;
  return { lines: lineList, catchFlags, ...(ms ? { marks: ms } : {}), ...(us ? { units: us } : {}) };
}

function ledger(v: unknown, w: string): TaskLedger {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["rows", "columns", "target", "value", "kuroTidy"], w);
  const columns = strings(v.columns, `${w}.columns`);
  if (!Array.isArray(v.rows) || v.rows.length === 0) fail(`${w}.rows`, "must be a non-empty list");
  const rows = v.rows.map((r, i) => {
    if (!Array.isArray(r) || r.length !== columns.length) fail(`${w}.rows[${i}]`, `must have ${columns.length} cells`);
    if (!r.every((c) => typeof c === "string" || typeof c === "number")) fail(`${w}.rows[${i}]`, "cells must be text or numbers");
    return r as (string | number)[];
  });
  if (!Array.isArray(v.target) || v.target.length !== 2) fail(`${w}.target`, "must be [row, column]");
  const target = [index(v.target[0], rows.length, `${w}.target[0]`), index(v.target[1], columns.length, `${w}.target[1]`)] as const;
  if (typeof v.value !== "string" && typeof v.value !== "number") fail(`${w}.value`, "must be text or a number");
  let kuroTidy: TaskLedger["kuroTidy"];
  if (v.kuroTidy !== undefined) {
    if (!isRecord(v.kuroTidy)) fail(`${w}.kuroTidy`, "must be an object");
    keys(v.kuroTidy, ["col", "how"], `${w}.kuroTidy`);
    kuroTidy = { col: index(v.kuroTidy.col, columns.length, `${w}.kuroTidy.col`), how: str(v.kuroTidy.how, `${w}.kuroTidy.how`) };
  }
  return { rows, columns, target, value: v.value as string | number, ...(kuroTidy ? { kuroTidy } : {}) };
}

/** A tray/Kuro card: `{ id, text }`. */
function cardFrom(v: unknown, w: string): CardFrom {
  // Exactly one of file / conv / call (day-graph 2026-11-03) / meeting (meeting R1).
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["file", "conv", "call", "meeting"], w);
  const present = ["file", "conv", "call", "meeting"].filter((k) => v[k] !== undefined);
  if (present.length !== 1) fail(w, "must have exactly one of file / conv / call / meeting");
  if (v.file !== undefined) return { file: str(v.file, `${w}.file`) };
  if (v.conv !== undefined) return { conv: str(v.conv, `${w}.conv`) };
  if (v.meeting !== undefined) {
    if (v.meeting !== true) fail(`${w}.meeting`, "must be true");
    return { meeting: true };
  }
  if (v.call !== true) fail(`${w}.call`, "must be true");
  return { call: true };
}

/** A lock's source: as a card's, but never the meeting (its lines reveal cards, not codes). */
function lockFrom(v: unknown, w: string): CardFrom {
  const from = cardFrom(v, w);
  if (isMeetingFrom(from)) fail(w, "a lock cannot come from the meeting");
  return from;
}

/** A card or lock source is today's meeting (meeting R1). */
export const isMeetingFrom = (from: CardFrom | undefined): from is { readonly meeting: true } => from !== undefined && "meeting" in from;

function card(v: unknown, w: string): BoardCard {
  if (!isRecord(v)) fail(w, "a card must be an object");
  keys(v, ["id", "text", "from", "hint"], w);
  return {
    id: str(v.id, `${w}.id`),
    text: str(v.text, `${w}.text`),
    ...(v.from !== undefined ? { from: cardFrom(v.from, `${w}.from`) } : {}),
    ...(v.hint !== undefined ? { hint: str(v.hint, `${w}.hint`) } : {}),
  };
}

/**
 * The board (work v2): a table with a given column (optionally locked behind an old object), slots
 * that each take one card, a card tray, and Kuro's own fill / cards / unlock. Checked strictly: a
 * slot's answer must be a tray card; a kuro.fill card must be a tray card or a Kuro card; the lock's
 * answer must be one of its codes.
 */
function board(v: unknown, w: string): TaskBoard {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["kind", "title", "columns", "given", "slots", "cards", "kuro", "view", "ide", "beats", "meeting"], w);
  if (v.kind !== "table") fail(`${w}.kind`, 'must be "table"');
  // Column headers are display-only and may be blank (the label column has no header).
  if (!Array.isArray(v.columns) || v.columns.length === 0 || !v.columns.every((c) => typeof c === "string")) fail(`${w}.columns`, "must be a non-empty list of strings");
  const columns = v.columns as string[];
  // cards (the material tray).
  if (!Array.isArray(v.cards) || v.cards.length === 0) fail(`${w}.cards`, "must be a non-empty list");
  const cards = v.cards.map((c, i) => card(c, `${w}.cards[${i}]`));
  const cardIds = new Set<string>();
  for (const c of cards) {
    if (cardIds.has(c.id)) fail(`${w}.cards`, `duplicate card id "${c.id}"`);
    cardIds.add(c.id);
  }
  // slots.
  if (!Array.isArray(v.slots) || v.slots.length === 0) fail(`${w}.slots`, "must be a non-empty list");
  const slotIds = new Set<string>();
  const slots = v.slots.map((s, i) => {
    const sw = `${w}.slots[${i}]`;
    if (!isRecord(s)) fail(sw, "a slot must be an object");
    keys(s, ["id", "label", "answer"], sw);
    const id = str(s.id, `${sw}.id`);
    if (slotIds.has(id)) fail(`${w}.slots`, `duplicate slot id "${id}"`);
    slotIds.add(id);
    const answer = str(s.answer, `${sw}.answer`);
    if (!cardIds.has(answer)) fail(`${sw}.answer`, `"${answer}" is not a card`);
    return { id, label: str(s.label, `${sw}.label`), answer };
  });
  // given: a text per slot row, and an optional lock.
  if (!isRecord(v.given)) fail(`${w}.given`, "must be an object");
  keys(v.given, ["lock", "rows"], `${w}.given`);
  if (!isRecord(v.given.rows)) fail(`${w}.given.rows`, "must be an object");
  const rows: Record<string, string> = {};
  for (const [k, text] of Object.entries(v.given.rows)) {
    if (!slotIds.has(k)) fail(`${w}.given.rows`, `"${k}" is not a slot`);
    rows[k] = str(text, `${w}.given.rows.${k}`);
  }
  let lock: BoardLock | undefined;
  if (v.given.lock !== undefined) {
    const lw = `${w}.given.lock`;
    if (!isRecord(v.given.lock)) fail(lw, "must be an object");
    keys(v.given.lock, ["object", "from", "hint", "codes", "answer"], lw);
    // A lock has an object, a source, or both (day-graph addition 2026-11-04) — never neither.
    if (v.given.lock.object === undefined && v.given.lock.from === undefined) fail(lw, "must have an object or a from (or both)");
    const codes = strings(v.given.lock.codes, `${lw}.codes`);
    const answer = str(v.given.lock.answer, `${lw}.answer`);
    if (!codes.includes(answer)) fail(`${lw}.answer`, `"${answer}" is not one of the codes`);
    lock = {
      ...(v.given.lock.object !== undefined ? { object: str(v.given.lock.object, `${lw}.object`) } : {}),
      ...(v.given.lock.from !== undefined ? { from: lockFrom(v.given.lock.from, `${lw}.from`) } : {}),
      ...(v.given.lock.hint !== undefined ? { hint: str(v.given.lock.hint, `${lw}.hint`) } : {}),
      codes,
      answer,
    };
  }
  // kuro: its fill (slot → card), its own cards, and its lock answer.
  if (!isRecord(v.kuro)) fail(`${w}.kuro`, "must be an object");
  keys(v.kuro, ["fill", "cards", "unlock"], `${w}.kuro`);
  if (!Array.isArray(v.kuro.cards)) fail(`${w}.kuro.cards`, "must be a list");
  const kuroCards = v.kuro.cards.map((c, i) => card(c, `${w}.kuro.cards[${i}]`));
  const kuroCardIds = new Set(kuroCards.map((c) => c.id));
  for (const c of kuroCards) if (cardIds.has(c.id)) fail(`${w}.kuro.cards`, `"${c.id}" is already a tray card`);
  if (!isRecord(v.kuro.fill)) fail(`${w}.kuro.fill`, "must be an object");
  const fill: Record<string, string> = {};
  for (const [k, cid] of Object.entries(v.kuro.fill)) {
    if (!slotIds.has(k)) fail(`${w}.kuro.fill`, `"${k}" is not a slot`);
    const id = str(cid, `${w}.kuro.fill.${k}`);
    if (!cardIds.has(id) && !kuroCardIds.has(id)) fail(`${w}.kuro.fill.${k}`, `"${id}" is not a card or a Kuro card`);
    fill[k] = id;
  }
  const unlock = str(v.kuro.unlock, `${w}.kuro.unlock`);
  if (lock && !lock.codes.includes(unlock)) fail(`${w}.kuro.unlock`, `"${unlock}" is not one of the lock's codes`);
  // ide R1: the view, the preview, the transcript beats.
  let view: BoardView | undefined;
  if (v.view !== undefined) view = (BOARD_VIEWS as readonly unknown[]).includes(v.view) ? (v.view as BoardView) : fail(`${w}.view`, `must be one of ${BOARD_VIEWS.join(", ")}`);
  let ide: BoardIde | undefined;
  if (v.ide !== undefined) {
    if (view !== "ide") fail(`${w}.ide`, 'an ide needs view "ide"');
    ide = boardIde(v.ide, `${w}.ide`, slotIds);
  } else if (view === "ide") fail(`${w}.view`, 'view "ide" needs an ide');
  // meeting R1: the meeting, only with view "meeting"; its cards come from its lines.
  let meeting: BoardMeeting | undefined;
  if (v.meeting !== undefined) {
    if (view !== "meeting") fail(`${w}.meeting`, 'a meeting needs view "meeting"');
    meeting = boardMeeting(v.meeting, `${w}.meeting`, slotIds, cards);
  } else if (view === "meeting") fail(`${w}.view`, 'view "meeting" needs a meeting');
  for (const c of [...cards, ...kuroCards]) {
    if (!isMeetingFrom(c.from)) continue;
    if (!meeting) fail(`${w}.cards`, `"${c.id}" comes from a meeting, but the board has none`);
    if (!meeting.lines.some((l) => l.card === c.id)) fail(`${w}.cards`, `"${c.id}" comes from the meeting, but no line reveals it`);
  }
  const allCards = new Set([...cardIds, ...kuroCardIds]);
  const beats = v.beats !== undefined ? boardBeats(v.beats, `${w}.beats`, slotIds, allCards) : undefined;
  return {
    kind: "table",
    title: str(v.title, `${w}.title`),
    columns,
    given: { ...(lock ? { lock } : {}), rows },
    slots,
    cards,
    kuro: { fill, cards: kuroCards, unlock },
    ...(view !== undefined ? { view } : {}),
    ...(ide ? { ide } : {}),
    ...(beats ? { beats } : {}),
    ...(meeting ? { meeting } : {}),
  };
}

const MEETING_T = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The meeting (meeting R1): people (unique ids; a tile image under `/`), lines (a time, a person,
 * text, and a card that must be a tray card from the meeting), the layout, and with `seats` a seat
 * for every slot (and only for slots).
 */
function boardMeeting(v: unknown, w: string, slotIds: ReadonlySet<string>, cards: readonly BoardCard[]): BoardMeeting {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["people", "lines", "layout", "seats"], w);
  if (!Array.isArray(v.people) || v.people.length === 0) fail(`${w}.people`, "must be a non-empty list");
  const ids = new Set<string>();
  const people = v.people.map((p, i): MeetingPerson => {
    const pw = `${w}.people[${i}]`;
    if (!isRecord(p)) fail(pw, "a person must be an object");
    keys(p, ["id", "name", "tile"], pw);
    const id = str(p.id, `${pw}.id`);
    if (ids.has(id)) fail(`${w}.people`, `duplicate person id "${id}"`);
    ids.add(id);
    let tile: string | undefined;
    if (p.tile !== undefined) {
      tile = str(p.tile, `${pw}.tile`);
      if (!tile.startsWith("/")) fail(`${pw}.tile`, "expected a path under /");
    }
    return { id, name: str(p.name, `${pw}.name`), ...(tile !== undefined ? { tile } : {}) };
  });
  if (!Array.isArray(v.lines) || v.lines.length === 0) fail(`${w}.lines`, "must be a non-empty list");
  const lines = v.lines.map((l, i): MeetingLine => {
    const lw = `${w}.lines[${i}]`;
    if (!isRecord(l)) fail(lw, "a line must be an object");
    keys(l, ["t", "who", "text", "card"], lw);
    const t = str(l.t, `${lw}.t`);
    if (!MEETING_T.test(t)) fail(`${lw}.t`, "must be a time HH:MM");
    const who = str(l.who, `${lw}.who`);
    if (!ids.has(who)) fail(`${lw}.who`, `"${who}" is not a person`);
    let card: string | undefined;
    if (l.card !== undefined) {
      card = str(l.card, `${lw}.card`);
      const c = cards.find((x) => x.id === card);
      if (!c) fail(`${lw}.card`, `"${card}" is not a card`);
      if (!isMeetingFrom(c.from)) fail(`${lw}.card`, `"${card}" does not come from the meeting (from: { meeting: true })`);
    }
    return { t, who, text: str(l.text, `${lw}.text`), ...(card !== undefined ? { card } : {}) };
  });
  if (!(MEETING_LAYOUTS as readonly unknown[]).includes(v.layout)) fail(`${w}.layout`, `must be one of ${MEETING_LAYOUTS.join(", ")}`);
  const layout = v.layout as BoardMeeting["layout"];
  let seats: Record<string, MeetingSeat> | undefined;
  if (layout === "seats") {
    if (!isRecord(v.seats)) fail(`${w}.seats`, 'layout "seats" needs seats');
    seats = {};
    for (const [slot, seat] of Object.entries(v.seats)) {
      if (!slotIds.has(slot)) fail(`${w}.seats`, `"${slot}" is not a slot`);
      if (!(MEETING_SEATS as readonly unknown[]).includes(seat)) fail(`${w}.seats.${slot}`, `must be one of ${MEETING_SEATS.join(", ")}`);
      seats[slot] = seat as MeetingSeat;
    }
    for (const slot of slotIds) if (!(slot in seats)) fail(`${w}.seats`, `slot "${slot}" has no seat`);
  } else if (v.seats !== undefined) fail(`${w}.seats`, 'seats only with layout "seats"');
  return { people, lines, layout, ...(seats ? { seats } : {}) };
}

/** The IDE preview (ide R1): a deliverable under /docs/, and a page 0–99 per (known) slot. */
function boardIde(v: unknown, w: string, slotIds: ReadonlySet<string>): BoardIde {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["src", "pages", "files"], w);
  const src = str(v.src, `${w}.src`);
  if (!src.startsWith("/docs/")) fail(`${w}.src`, "expected a path under /docs/");
  if (!isRecord(v.pages)) fail(`${w}.pages`, "must be an object");
  const pages: Record<string, number> = {};
  for (const [slot, page] of Object.entries(v.pages)) {
    if (!slotIds.has(slot)) fail(`${w}.pages`, `"${slot}" is not a slot`);
    if (!Number.isInteger(page) || (page as number) < 0 || (page as number) > 99) fail(`${w}.pages.${slot}`, "must be an integer from 0 to 99");
    pages[slot] = page as number;
  }
  const files = v.files !== undefined ? ideFiles(v.files, `${w}.files`, slotIds) : undefined;
  return { src, pages, ...(files ? { files } : {}) };
}

/** The placeholder in a page's code where the slot's field is drawn (shell R4). */
export const SLOT_FIELD = "{{slot}}";

/**
 * The code of each IDE page (shell R4): a file for every slot (and only for slots), a non-empty
 * name, and exactly one code line holding `{{slot}}`.
 */
function ideFiles(v: unknown, w: string, slotIds: ReadonlySet<string>): Record<string, IdeFile> {
  if (!isRecord(v)) fail(w, "must be an object");
  const out: Record<string, IdeFile> = {};
  for (const [slot, f] of Object.entries(v)) {
    const fw = `${w}.${slot}`;
    if (!slotIds.has(slot)) fail(w, `"${slot}" is not a slot`);
    if (!isRecord(f)) fail(fw, "must be an object");
    keys(f, ["name", "code"], fw);
    const name = str(f.name, `${fw}.name`);
    if (!Array.isArray(f.code) || !f.code.every((l) => typeof l === "string")) fail(`${fw}.code`, "must be a list of strings");
    const code = f.code as string[];
    const fields = code.filter((l) => l.includes(SLOT_FIELD)).length;
    if (fields !== 1) fail(`${fw}.code`, `must have exactly one line with ${SLOT_FIELD} (has ${fields})`);
    out[slot] = { name, code };
  }
  for (const slot of slotIds) if (!(slot in out)) fail(w, `slot "${slot}" has no file`);
  return out;
}

/** The fixed beat names (ide R1); `fill:<slot>` and `fill:<slot>:<card>` are checked separately. */
const BEAT_ONS = ["open", "kuro", "unlock", "print", "send"] as const;

/** The transcript beats (ide R1): each `on` names a known beat and existing ids; each `on` once. */
function boardBeats(v: unknown, w: string, slotIds: ReadonlySet<string>, cardIds: ReadonlySet<string>): BoardBeat[] {
  if (!Array.isArray(v)) fail(w, "must be a list");
  const seen = new Set<string>();
  return v.map((b, i) => {
    const bw = `${w}[${i}]`;
    if (!isRecord(b)) fail(bw, "a beat must be an object");
    keys(b, ["on", "lines"], bw);
    const on = str(b.on, `${bw}.on`);
    const parts = on.split(":");
    if (parts[0] === "fill" && (parts.length === 2 || parts.length === 3)) {
      if (!slotIds.has(parts[1]!)) fail(`${bw}.on`, `"${parts[1]}" is not a slot`);
      if (parts.length === 3 && !cardIds.has(parts[2]!)) fail(`${bw}.on`, `"${parts[2]}" is not a card or a Kuro card`);
    } else if (!(BEAT_ONS as readonly string[]).includes(on)) {
      fail(`${bw}.on`, `must be one of ${BEAT_ONS.join(", ")}, fill:<slot> or fill:<slot>:<card>`);
    }
    if (seen.has(on)) fail(w, `duplicate beat "${on}"`);
    seen.add(on);
    if (!Array.isArray(b.lines) || b.lines.length === 0) fail(`${bw}.lines`, "must be a non-empty list");
    const lines = b.lines.map((l, j) => {
      const lw = `${bw}.lines[${j}]`;
      if (!isRecord(l)) fail(lw, "a line must be an object");
      keys(l, ["who", "text"], lw);
      if (l.who !== "kuro" && l.who !== "me") fail(`${lw}.who`, 'must be "kuro" or "me"');
      return { who: l.who as BoardBeatLine["who"], text: str(l.text, `${lw}.text`) };
    });
    return { on, lines };
  });
}

function deliverable(v: unknown, w: string): TaskDeliverable {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["id", "label", "img", "to"], w);
  const to = v.to !== undefined ? ((DELIVERABLE_TO as readonly unknown[]).includes(v.to) ? (v.to as DeliverableTo) : fail(`${w}.to`, `must be one of ${DELIVERABLE_TO.join(", ")}`)) : undefined;
  return { id: str(v.id, `${w}.id`), label: str(v.label, `${w}.label`), ...(v.img !== undefined ? { img: str(v.img, `${w}.img`) } : {}), ...(to !== undefined ? { to } : {}) };
}

function judge(v: unknown, w: string): TaskJudge {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["perfect", "flawed", "wrong", "wrongAt"], w);
  const delta = (x: unknown, k: string): number => (Number.isInteger(x) && (x as number) <= 0 ? (x as number) : fail(`${w}.${k}`, "must be an integer <= 0"));
  const wrongAt = Number.isInteger(v.wrongAt) && (v.wrongAt as number) >= 1 ? (v.wrongAt as number) : fail(`${w}.wrongAt`, "must be an integer >= 1");
  return { perfect: delta(v.perfect, "perfect"), flawed: delta(v.flawed, "flawed"), wrong: delta(v.wrong, "wrong"), wrongAt };
}

/** Inert empty placeholders for a board task's unused reply tree (work v2). */
const EMPTY_PATH: TaskPath = { say: [], kuro: [], effects: {} };

/** A board task (work v2): the board surface; the three-path tree is empty and unused. */
function boardTask(v: Raw, w: string): Task {
  if (!(APPS as readonly unknown[]).includes(v.app)) fail(`${w}.app`, `must be one of ${APPS.join(", ")}`);
  const done = str(v.done, `${w}.done`);
  return {
    id: str(v.id, `${w}.id`),
    title: str(v.title, `${w}.title`),
    app: v.app as Task["app"],
    done,
    start: { say: [], options: [] },
    self: EMPTY_PATH,
    look: EMPTY_PATH,
    let: EMPTY_PATH,
    board: board(v.board, `${w}.board`),
    ...(v.deliverable !== undefined ? { deliverable: deliverable(v.deliverable, `${w}.deliverable`) } : {}),
    ...(v.judge !== undefined ? { judge: judge(v.judge, `${w}.judge`) } : {}),
  };
}

function task(v: unknown, w: string): Task {
  if (!isRecord(v)) fail(w, "a task must be an object");
  keys(v, ["id", "title", "app", "done", "start", ...PATHS, "doc", "ledger", "code", "board", "deliverable", "judge"], w);
  // Work v2: a board task carries a board (and usually a deliverable + judge); its three-path tree
  // is optional and unused. A task without a board keeps the old required tree.
  if (v.board !== undefined) return boardTask(v, w);
  if (!(APPS as readonly unknown[]).includes(v.app)) fail(`${w}.app`, `must be one of ${APPS.join(", ")}`);
  if (!isRecord(v.start)) fail(`${w}.start`, "must be an object");
  keys(v.start, ["say", "options"], `${w}.start`);
  if (!Array.isArray(v.start.options) || v.start.options.length === 0) fail(`${w}.start.options`, "must be a non-empty list");
  const options = v.start.options.map((o, i) => {
    const ow = `${w}.start.options[${i}]`;
    if (!isRecord(o)) fail(ow, "must be an object");
    keys(o, ["mode", "goto"], ow);
    return { mode: mode(o.mode, `${ow}.mode`), goto: mode(o.goto, `${ow}.goto`) };
  });
  const done = str(v.done, `${w}.done`);
  const out = {
    id: str(v.id, `${w}.id`),
    title: str(v.title, `${w}.title`),
    app: v.app as Task["app"],
    done,
    start: { say: lines(v.start.say, `${w}.start.say`), options },
    self: path(v.self, `${w}.self`),
    look: path(v.look, `${w}.look`),
    let: path(v.let, `${w}.let`),
  };
  const selfFlags = out.self.effects.flags ?? [];
  const surface = {
    ...(v.doc !== undefined ? { doc: doc(v.doc, `${w}.doc`, selfFlags) } : {}),
    ...(v.ledger !== undefined ? { ledger: ledger(v.ledger, `${w}.ledger`) } : {}),
    ...(v.code !== undefined ? { code: code(v.code, `${w}.code`, selfFlags) } : {}),
  };
  if (surface.doc && out.app !== "docs") fail(`${w}.doc`, `a document belongs to app "docs", not "${out.app}"`);
  if (surface.ledger && out.app !== "ledger") fail(`${w}.ledger`, `a ledger belongs to app "ledger", not "${out.app}"`);
  if (surface.code && out.app !== "code") fail(`${w}.code`, `a code file belongs to app "code", not "${out.app}"`);
  for (const m of PATHS) {
    if (!(out[m].effects.flags ?? []).includes(done)) fail(`${w}.${m}`, `effects do not set the done flag "${done}"`);
  }
  return { ...out, ...surface };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Parses one day file. Pure; exported for tests. */
export function parseTaskFile(raw: unknown, label: string): { day: number; tasks: Task[] } {
  if (!isRecord(raw)) fail(label, "not an object");
  keys(raw, ["day", "_note", "tasks"], label);
  if (!Number.isInteger(raw.day) || (raw.day as number) < 1) fail(label, "day must be an integer >= 1");
  if (!Array.isArray(raw.tasks)) fail(`${label}.tasks`, "must be a list");
  const tasks = raw.tasks.map((t, i) => task(t, `${label}.tasks[${i}]`));
  const ids = new Set<string>();
  for (const t of tasks) {
    if (ids.has(t.id)) fail(label, `duplicate task id "${t.id}"`);
    ids.add(t.id);
  }
  return deepFreeze({ day: raw.day as number, tasks });
}

// ——— English twins (dialogue addition 2026-11-02) ———
// content/tasks/en/day-NN.json has the same shape; only text differs: `title`, each path's `say`
// lines, `doc.left`/`doc.right`/`kuroEdit.text`, `ledger.columns`/`ledger.rows`/`value`/`kuroTidy.how`.
// Kuro's `kuro` lines are English constants (the voices rule), never twinned. First difference wins.
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Marks: only `caught` text differs; clause/span/kind/worth/hidden/word must match. */
function localiseMarks(zh: readonly TaskMark[], en: readonly TaskMark[] | undefined, w: string): TaskMark[] {
  if ((en?.length ?? 0) !== zh.length) fail(w, `mark count differs from the Chinese`);
  return zh.map((z, i) => {
    const e = en![i]!;
    if (z.clause !== e.clause || z.kind !== e.kind || z.worth !== e.worth || z.hidden !== e.hidden || z.word !== e.word || !sameJson(z.span, e.span)) fail(`${w}[${i}]`, "a non-text mark field differs from the Chinese");
    return z.caught !== undefined ? bilingual(z, { caught: e.caught }) : z;
  });
}
/** Units: `text` and `fix` differ; the count must match. */
function localiseUnits(zh: readonly TaskUnit[], en: readonly TaskUnit[] | undefined, w: string): TaskUnit[] {
  if ((en?.length ?? 0) !== zh.length) fail(w, `unit count differs from the Chinese`);
  return zh.map((z, i) => {
    const e = en![i]!;
    if ((z.fix === undefined) !== (e.fix === undefined)) fail(`${w}[${i}]`, "fix present in only one language");
    return bilingual(z, { text: e.text, ...(z.fix !== undefined ? { fix: e.fix } : {}) });
  });
}

function localisePath(zh: TaskPath, en: TaskPath, w: string): TaskPath {
  if (zh.say.length !== en.say.length) fail(`${w}.say`, `${en.say.length} lines, the Chinese has ${zh.say.length}`);
  if (!sameJson(zh.effects, en.effects)) fail(`${w}.effects`, "effects differ from the Chinese");
  const say = zh.say.map((z, i) => {
    const e = en.say[i]!;
    if (z.k !== e.k || z.who !== e.who) fail(`${w}.say[${i}]`, "kind or speaker differs from the Chinese");
    return bilingual(z, { t: e.t });
  });
  // `kuro` stays Chinese-source English constants; `effects` already matched.
  return { ...zh, say };
}

function localiseTask(zh: Task, en: Task, w: string): Task {
  if (zh.id !== en.id) fail(w, `id "${en.id}", the Chinese has "${zh.id}"`);
  if (zh.app !== en.app || zh.done !== en.done) fail(w, "app or done flag differs from the Chinese");
  // Work v2: a board task's text twin (title, labels, cards) is swapped wholesale from the en board;
  // its shape must match. The tree twinning below does not apply.
  if (zh.board || en.board) {
    if (!zh.board || !en.board) fail(`${w}.board`, "board present in only one language");
    if (zh.board.slots.length !== en.board.slots.length || zh.board.cards.length !== en.board.cards.length) fail(`${w}.board`, "board shape differs from the Chinese");
    // ide R1: the view and the preview are shared; the beats differ only in their lines' text.
    // shell R4: the en `ide.files` carry their own names and code; only their keys must match.
    const ideShape = (b: TaskBoard) => (b.ide ? { src: b.ide.src, pages: b.ide.pages, files: b.ide.files ? Object.keys(b.ide.files).sort() : null } : null);
    if (zh.board.view !== en.board.view || !sameJson(ideShape(zh.board), ideShape(en.board))) fail(`${w}.board`, "view or ide differs from the Chinese");
    // meeting R1: the people's ids and tiles, the lines' times / speakers / cards, the layout and the
    // seats are shared; only the names and the line text differ.
    const meetingShape = (b: TaskBoard) =>
      b.meeting ? { people: b.meeting.people.map((p) => [p.id, p.tile ?? null]), lines: b.meeting.lines.map((l) => [l.t, l.who, l.card ?? null]), layout: b.meeting.layout, seats: b.meeting.seats ?? null } : null;
    if (!sameJson(meetingShape(zh.board), meetingShape(en.board))) fail(`${w}.board.meeting`, "meeting shape differs from the Chinese");
    const beatShape = (b: TaskBoard) => (b.beats ?? []).map((x) => ({ on: x.on, who: x.lines.map((l) => l.who) }));
    if (!sameJson(beatShape(zh.board), beatShape(en.board))) fail(`${w}.board.beats`, "beat shape differs from the Chinese");
    return bilingualValues(zh, { title: en.title, board: en.board, ...(zh.deliverable && en.deliverable ? { deliverable: en.deliverable } : {}) });
  }
  if (zh.start.say.length !== en.start.say.length || !sameJson(zh.start.options, en.start.options)) fail(`${w}.start`, "start shape differs from the Chinese");
  const start = { say: zh.start.say.map((z, i) => bilingual(z, { t: en.start.say[i]!.t })), options: zh.start.options };
  const paths = {
    self: localisePath(zh.self, en.self, `${w}.self`),
    look: localisePath(zh.look, en.look, `${w}.look`),
    let: localisePath(zh.let, en.let, `${w}.let`),
  };
  let doc = zh.doc;
  if (zh.doc || en.doc) {
    if (!zh.doc || !en.doc) fail(`${w}.doc`, "doc present in only one language");
    if (zh.doc.left.length !== en.doc.left.length || !sameJson(zh.doc.conflict, en.doc.conflict) || !sameJson(zh.doc.catchFlags, en.doc.catchFlags)) fail(`${w}.doc`, "doc shape differs from the Chinese");
    doc = bilingualValues(zh.doc, {
      left: en.doc.left,
      right: en.doc.right,
      ...(zh.doc.kuroEdit && en.doc.kuroEdit ? { kuroEdit: { clause: zh.doc.kuroEdit.clause, text: en.doc.kuroEdit.text } } : {}),
      ...(zh.doc.marks ? { marks: localiseMarks(zh.doc.marks, en.doc.marks, `${w}.doc.marks`) } : {}),
      ...(zh.doc.units ? { units: localiseUnits(zh.doc.units, en.doc.units, `${w}.doc.units`) } : {}),
    });
  }
  let ledger = zh.ledger;
  if (zh.ledger || en.ledger) {
    if (!zh.ledger || !en.ledger) fail(`${w}.ledger`, "ledger present in only one language");
    const zl = zh.ledger, el = en.ledger;
    if (zl.rows.length !== el.rows.length || zl.columns.length !== el.columns.length || !sameJson(zl.target, el.target)) fail(`${w}.ledger`, "ledger shape differs from the Chinese");
    ledger = bilingualValues(zl, {
      columns: el.columns,
      rows: el.rows,
      value: el.value,
      ...(zl.kuroTidy && el.kuroTidy ? { kuroTidy: { col: zl.kuroTidy.col, how: el.kuroTidy.how } } : {}),
      ...(zl.marks ? { marks: localiseMarks(zl.marks, el.marks, `${w}.ledger.marks`) } : {}),
      ...(zl.units ? { units: localiseUnits(zl.units, el.units, `${w}.ledger.units`) } : {}),
    });
  }
  let codeSurface = zh.code;
  if (zh.code || en.code) {
    if (!zh.code || !en.code) fail(`${w}.code`, "code present in only one language");
    if (zh.code.lines.length !== en.code.lines.length || !sameJson(zh.code.catchFlags, en.code.catchFlags)) fail(`${w}.code`, "code shape differs from the Chinese");
    codeSurface = bilingualValues(zh.code, {
      lines: en.code.lines,
      ...(zh.code.marks ? { marks: localiseMarks(zh.code.marks, en.code.marks, `${w}.code.marks`) } : {}),
      ...(zh.code.units ? { units: localiseUnits(zh.code.units, en.code.units, `${w}.code.units`) } : {}),
    });
  }
  const withText = { ...zh, start, ...paths, ...(doc ? { doc } : {}), ...(ledger ? { ledger } : {}), ...(codeSurface ? { code: codeSurface } : {}) };
  return bilingual(withText, { title: en.title });
}

/** The zh task list localised by the en twin. Throws at the first structural difference. */
export function localiseTasks(zh: readonly Task[], en: readonly Task[], label: string): Task[] {
  if (zh.length !== en.length) fail(label, `${en.length} tasks, the Chinese has ${zh.length}`);
  return zh.map((z, i) => localiseTask(z, en[i]!, `${label}.tasks[${i}]`));
}

const files = import.meta.glob("../../../content/tasks/day-*.json", { eager: true, import: "default" });
const enFiles = import.meta.glob("../../../content/tasks/en/day-*.json", { eager: true, import: "default" });

export const taskFiles: ReadonlyMap<number, readonly Task[]> = (() => {
  const twins = new Map(Object.entries(enFiles).map(([p, raw]) => [p.slice(p.lastIndexOf("/") + 1), raw]));
  const out = new Map<number, readonly Task[]>();
  for (const [p, raw] of Object.entries(files)) {
    const label = p.slice(p.lastIndexOf("/") + 1);
    const parsed = parseTaskFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (parsed.day !== fromName) fail(label, `file name says day ${fromName}, content says ${parsed.day}`);
    const enRaw = twins.get(label);
    const tasks = enRaw === undefined ? parsed.tasks : deepFreeze(localiseTasks(parsed.tasks, parseTaskFile(enRaw, `en/${label}`).tasks, `en/${label}`));
    out.set(parsed.day, tasks);
  }
  return new Map([...out].sort(([a], [b]) => a - b));
})();

/** The task whose done flag is `flag` on `day`. */
export function taskByFlag(day: number, flag: string): Task | undefined {
  return taskFiles.get(day)?.find((t) => t.done === flag);
}

/** The task of `day-NN:<taskId>`. */
export function taskByRef(dayTag: string, taskId: string): Task | undefined {
  const day = Number(/^day-(\d+)$/.exec(dayTag)?.[1]);
  return Number.isInteger(day) ? taskFiles.get(day)?.find((t) => t.id === taskId) : undefined;
}

/**
 * The clause lines a files `body.doc` reference points to (desktop-ui 2026-11-02): `day-01:task1:left`
 * → that task's document left column, `:right` → the right column; a bare `day-NN:task` → the ledger's
 * rows as text, so a read-only viewer can show it. Null when the reference resolves to nothing.
 */
export function docLines(ref: string): readonly string[] | null {
  const parts = ref.split(":");
  const [dayTag, taskId, side] = parts;
  if (!dayTag || !taskId) return null;
  const task = taskByRef(dayTag, taskId);
  if (!task) return null;
  if (side === "left" || side === "right") return task.doc ? task.doc[side] : null;
  if (side === undefined) {
    if (task.doc) return task.doc.left;
    if (task.ledger) return task.ledger.rows.map((r) => r.map((c) => String(c)).join("  "));
  }
  return null;
}
