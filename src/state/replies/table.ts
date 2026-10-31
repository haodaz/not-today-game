/// <reference types="vite/client" />
// Loads the reply tables in content/replies/ (Claude's files). They are read, checked, and frozen.
// No string is ever rewritten. The guard fails loudly on anything the engine does not
// understand, so a new schema feature in the content is noticed instead of silently ignored.
import familyFile from "@content/replies/family.json";
import { parseDuration } from "./duration";

export const STATUSES = ["reply", "read", "typing", "recalled", "silence", "gone"] as const;
export type Status = (typeof STATUSES)[number];

export const INCOMING_KINDS = ["work", "money", "private", "odd"] as const;
export type IncomingKind = (typeof INCOMING_KINDS)[number];

/** The placeholders filled at render time from `names`. Nothing else may appear in braces. */
export const PLACEHOLDERS = ["calledBy", "bossCalls", "nick", "login"] as const;

export const FAMILY = "family";

export interface Line {
  readonly who: string;
  readonly t: string;
  readonly text: string;
}

export interface Interrupt extends Line {
  readonly where: string;
}

export interface Condition {
  readonly has: string;
}

export interface Entry {
  readonly status: Status;
  readonly lines: readonly Line[];
  readonly readAfter?: string;
  readonly interrupt?: Interrupt;
  readonly effects?: { readonly san?: number; readonly flags?: readonly string[] };
  readonly inner?: string;
  readonly cond_show?: Condition;
  readonly note?: string;
}

export interface Incoming {
  readonly t: string;
  readonly text: string;
  readonly kind: IncomingKind;
  readonly cond_show?: Condition;
  readonly effects?: { readonly flags?: readonly string[] };
  readonly note?: string;
}

export interface RecipientTable {
  readonly incoming: readonly Incoming[];
  /** word -> entry, in table order. */
  readonly cells: ReadonlyMap<string, Entry>;
}

export interface DayTable {
  readonly day: number;
  /** recipient -> table, in table order; family last. */
  readonly recipients: ReadonlyMap<string, RecipientTable>;
}

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

class ContentError extends Error {
  constructor(where: string, problem: string) {
    super(`content/replies ${where}: ${problem}`);
  }
}

function onlyKeys(value: Raw, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new ContentError(where, `unknown key "${key}"`);
  }
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string") throw new ContentError(where, "expected a string");
  return value;
}

function time(value: unknown, where: string): string {
  const text = str(value, where);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new ContentError(where, `not an HH:MM time: "${text}"`);
  return text;
}

/** Every `{name}` in a text must be a known placeholder. */
function checkPlaceholders(text: string, where: string): void {
  for (const [, name] of text.matchAll(/\{([^{}]*)\}/g)) {
    if (!(PLACEHOLDERS as readonly string[]).includes(name!)) {
      throw new ContentError(where, `unknown placeholder "{${name}}"`);
    }
  }
}

function text(value: unknown, where: string): string {
  const out = str(value, where);
  checkPlaceholders(out, where);
  return out;
}

function condition(value: unknown, where: string): Condition {
  if (!isRecord(value)) throw new ContentError(where, "cond_show must be an object");
  onlyKeys(value, ["has"], where);
  return { has: str(value.has, `${where}.has`) };
}

function flags(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((flag) => typeof flag === "string")) {
    throw new ContentError(where, "flags must be a list of strings");
  }
  return value as string[];
}

function line(value: unknown, where: string): Line {
  if (!isRecord(value)) throw new ContentError(where, "a line must be an object");
  onlyKeys(value, ["who", "t", "text"], where);
  return { who: str(value.who, `${where}.who`), t: time(value.t, `${where}.t`), text: text(value.text, `${where}.text`) };
}

function entry(value: unknown, where: string): Entry {
  if (!isRecord(value)) throw new ContentError(where, "an entry must be an object");
  onlyKeys(value, ["status", "lines", "readAfter", "interrupt", "effects", "inner", "cond_show", "note"], where);
  const status = value.status as Status;
  if (!STATUSES.includes(status)) throw new ContentError(where, `unknown status "${String(value.status)}"`);
  if (!Array.isArray(value.lines)) throw new ContentError(where, "lines must be a list");
  const out: Record<string, unknown> = {
    status,
    lines: value.lines.map((item, i) => line(item, `${where}.lines[${i}]`)),
  };
  if (value.readAfter !== undefined) {
    const readAfter = str(value.readAfter, `${where}.readAfter`);
    if (!parseDuration(readAfter)) throw new ContentError(where, `unparsable readAfter "${readAfter}"`);
    out.readAfter = readAfter;
  }
  if (value.interrupt !== undefined) {
    const raw = value.interrupt;
    if (!isRecord(raw)) throw new ContentError(`${where}.interrupt`, "must be an object");
    onlyKeys(raw, ["who", "where", "t", "text"], `${where}.interrupt`);
    out.interrupt = { ...line({ who: raw.who, t: raw.t, text: raw.text }, `${where}.interrupt`), where: str(raw.where, `${where}.interrupt.where`) };
  }
  if (value.effects !== undefined) {
    const raw = value.effects;
    if (!isRecord(raw)) throw new ContentError(`${where}.effects`, "must be an object");
    onlyKeys(raw, ["san", "flags"], `${where}.effects`);
    const effects: Record<string, unknown> = {};
    if (raw.san !== undefined) {
      if (!Number.isInteger(raw.san)) throw new ContentError(`${where}.effects.san`, "must be an integer");
      effects.san = raw.san;
    }
    if (raw.flags !== undefined) effects.flags = flags(raw.flags, `${where}.effects.flags`);
    out.effects = effects;
  }
  if (value.inner !== undefined) out.inner = text(value.inner, `${where}.inner`);
  if (value.cond_show !== undefined) out.cond_show = condition(value.cond_show, `${where}.cond_show`);
  if (value.note !== undefined) out.note = str(value.note, `${where}.note`);
  return out as unknown as Entry;
}

function incoming(value: unknown, where: string): Incoming {
  if (!isRecord(value)) throw new ContentError(where, "an incoming item must be an object");
  onlyKeys(value, ["t", "text", "kind", "cond_show", "effects", "note"], where);
  const kind = value.kind as IncomingKind;
  if (!INCOMING_KINDS.includes(kind)) throw new ContentError(where, `unknown kind "${String(value.kind)}"`);
  const out: Record<string, unknown> = { t: time(value.t, `${where}.t`), text: text(value.text, `${where}.text`), kind };
  if (value.cond_show !== undefined) out.cond_show = condition(value.cond_show, `${where}.cond_show`);
  if (value.effects !== undefined) {
    const raw = value.effects;
    if (!isRecord(raw)) throw new ContentError(`${where}.effects`, "must be an object");
    // Incoming effects are applied by `derive` on every step, so they must be idempotent:
    // flags only, never a san delta.
    onlyKeys(raw, ["flags"], `${where}.effects`);
    out.effects = raw.flags === undefined ? {} : { flags: flags(raw.flags, `${where}.effects.flags`) };
  }
  if (value.note !== undefined) out.note = str(value.note, `${where}.note`);
  return out as unknown as Incoming;
}

function recipientTable(value: unknown, where: string): RecipientTable {
  if (!isRecord(value)) throw new ContentError(where, "a recipient must be an object");
  const items = value.incoming ?? [];
  if (!Array.isArray(items)) throw new ContentError(`${where}.incoming`, "must be a list");
  const cells = new Map<string, Entry>();
  for (const [word, cell] of Object.entries(value)) {
    if (word !== "incoming") cells.set(word, entry(cell, `${where}.${word}`));
  }
  return { incoming: items.map((item, i) => incoming(item, `${where}.incoming[${i}]`)), cells };
}

function checkInterrupts(table: DayTable): void {
  for (const [recipient, { cells }] of table.recipients) {
    for (const [word, cell] of cells) {
      if (cell.interrupt && !table.recipients.has(cell.interrupt.where)) {
        throw new ContentError(`day ${table.day} ${recipient}.${word}`, `interrupt goes to unknown conversation "${cell.interrupt.where}"`);
      }
    }
  }
}

/** Parses one `day-NN.json`. Pure; exported for tests. */
export function parseDayFile(raw: unknown, label: string): DayTable {
  if (!isRecord(raw)) throw new ContentError(label, "not an object");
  onlyKeys(raw, ["day", "recipients"], label);
  if (!Number.isInteger(raw.day) || (raw.day as number) < 1) throw new ContentError(label, "day must be an integer >= 1");
  if (!isRecord(raw.recipients)) throw new ContentError(label, "recipients must be an object");
  const recipients = new Map<string, RecipientTable>();
  for (const [name, value] of Object.entries(raw.recipients)) {
    if (name === FAMILY) throw new ContentError(label, "family lives in family.json");
    recipients.set(name, recipientTable(value, `${label} ${name}`));
  }
  return { day: raw.day as number, recipients };
}

/** Parses `family.json` into day -> family table. Pure; exported for tests. */
export function parseFamilyFile(raw: unknown): Map<number, RecipientTable> {
  if (!isRecord(raw) || !isRecord(raw.days)) throw new ContentError("family.json", "expected { days: {...} }");
  onlyKeys(raw, ["_note", "days"], "family.json");
  const out = new Map<number, RecipientTable>();
  for (const [key, value] of Object.entries(raw.days)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 1) throw new ContentError("family.json", `bad day key "${key}"`);
    out.set(day, recipientTable(value, `family.json day ${day}`));
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value instanceof Map) {
    for (const child of value.values()) deepFreeze(child);
    Object.freeze(value);
  } else if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Combines the day files and the family file into day -> DayTable. Pure; exported for tests. */
export function buildReplyTable(dayFiles: Record<string, unknown>, family: unknown): ReadonlyMap<number, DayTable> {
  const families = parseFamilyFile(family);
  const days = new Map<number, DayTable>();
  for (const [path, raw] of Object.entries(dayFiles)) {
    const label = path.slice(path.lastIndexOf("/") + 1);
    const table = parseDayFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (table.day !== fromName) throw new ContentError(label, `file name says day ${fromName}, content says ${table.day}`);
    if (days.has(table.day)) throw new ContentError(label, `day ${table.day} appears twice`);
    const familyTable = families.get(table.day);
    if (familyTable) (table.recipients as Map<string, RecipientTable>).set(FAMILY, familyTable);
    checkInterrupts(table);
    days.set(table.day, table);
  }
  for (const day of families.keys()) {
    if (!days.has(day)) throw new ContentError("family.json", `day ${day} has no day file`);
  }
  return deepFreeze(new Map([...days].sort(([a], [b]) => a - b)));
}

const dayFiles = import.meta.glob("../../../content/replies/day-*.json", { eager: true, import: "default" });

/** day -> recipient -> { incoming, cells }. Loaded and checked once, frozen. */
export const replyTable: ReadonlyMap<number, DayTable> = buildReplyTable(dayFiles, familyFile);

/** The table for a day, or undefined past the last scripted day. */
export function dayTable(day: number): DayTable | undefined {
  return replyTable.get(day);
}
