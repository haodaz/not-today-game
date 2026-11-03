/// <reference types="vite/client" />
// Loads the reply tables in content/replies/ (Claude's files). They are read, checked, and frozen.
// No string is ever rewritten. The guard fails loudly on anything the engine does not
// understand, so a new schema feature in the content is noticed instead of silently ignored.
import clanFile from "@content/replies/clan.json";
import familyFile from "@content/replies/family.json";
import { parseDuration } from "./duration";
import { replyLocale } from "./locale";

export const STATUSES = ["reply", "read", "typing", "recalled", "silence", "gone"] as const;
export type Status = (typeof STATUSES)[number];

export const INCOMING_KINDS = ["work", "money", "private", "odd", "deliverable"] as const;
export type IncomingKind = (typeof INCOMING_KINDS)[number];

/** The placeholders filled at render time from `names`. Nothing else may appear in braces. */
export const PLACEHOLDERS = ["calledBy", "bossCalls", "nick", "login"] as const;

export const FAMILY = "family";
/** The big family group 相亲相爱一家人 (`clan.json`), the second conversation in 家里. */
export const CLAN = "clan";
/** The 家里 conversations, each in its own file beside the day files, in menu order. */
export const FAMILY_GROUPS: readonly string[] = [FAMILY, CLAN];

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

/**
 * A shared thing on a message (desktop-ui "shared things must look like what they are", 2026-11-03):
 * an article, a video, a chat history, a link, an image, a file, a mini-program, a voice note or a
 * work task. The `text` beside it stays as the list preview and the fallback. 消息 draws it the
 * WeChat way, 工作台's message pane the DingTalk way, from this one shape.
 */
export const CARD_TYPES = ["article", "video", "history", "link", "image", "file", "mini", "voice", "task"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export type Card =
  | { readonly type: "article"; readonly account: string; readonly title: string; readonly digest?: string; readonly cover?: string }
  | { readonly type: "video"; readonly account: string; readonly title: string; readonly cover?: string; readonly duration: string; readonly titlePos?: "top" | "bottom" }
  | { readonly type: "history"; readonly title: string; readonly lines: readonly string[] }
  | { readonly type: "link"; readonly title: string; readonly site: string; readonly icon?: string }
  | { readonly type: "image"; readonly src?: string; readonly alt: string }
  | { readonly type: "file"; readonly name: string; readonly size: string; readonly ext: string }
  | { readonly type: "mini"; readonly brand: string; readonly title: string; readonly cover?: string }
  | { readonly type: "voice"; readonly seconds: string }
  | { readonly type: "task"; readonly title: string; readonly fields: readonly (readonly [string, string])[]; readonly action?: string };

export interface Incoming {
  readonly t: string;
  readonly text: string;
  readonly kind: IncomingKind;
  readonly cond_show?: Condition;
  readonly effects?: { readonly flags?: readonly string[] };
  readonly note?: string;
  /**
   * A `deliverable` carries the id of the document it posts (desktop-ui 2026-11-02): the browser
   * opens it, 屏幕 is locked until the player has opened it once (the `open file:<doc>` event).
   */
  readonly doc?: string;
  /** A shared thing drawn as its own card (desktop-ui 2026-11-03); the text stays as the preview. */
  readonly card?: Card;
  /** A forwarded message shows a small 「转发」 label above its card. */
  readonly forwarded?: true;
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

/** A list of non-empty strings (the chat-history lines). */
function strList(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new ContentError(where, "must be a non-empty list of strings");
  return value.map((v, i) => str(v, `${where}[${i}]`));
}

/** The allowed keys of each card type (strict per the addition; `type` is always present). */
const CARD_KEYS: Record<CardType, readonly string[]> = {
  article: ["type", "account", "title", "digest", "cover"],
  video: ["type", "account", "title", "cover", "duration", "titlePos"],
  history: ["type", "title", "lines"],
  link: ["type", "title", "site", "icon"],
  image: ["type", "src", "alt"],
  file: ["type", "name", "size", "ext"],
  mini: ["type", "brand", "title", "cover"],
  voice: ["type", "seconds"],
  task: ["type", "title", "fields", "action"],
};

/** One card on a message, checked strictly by its `type` (desktop-ui 2026-11-03). */
function card(value: unknown, where: string): Card {
  if (!isRecord(value)) throw new ContentError(where, "a card must be an object");
  const type = value.type as CardType;
  if (!CARD_TYPES.includes(type)) throw new ContentError(where, `unknown card type "${String(value.type)}"`);
  onlyKeys(value, CARD_KEYS[type], where);
  switch (type) {
    case "article":
      return {
        type,
        account: text(value.account, `${where}.account`),
        title: text(value.title, `${where}.title`),
        ...(value.digest !== undefined ? { digest: text(value.digest, `${where}.digest`) } : {}),
        ...(value.cover !== undefined ? { cover: str(value.cover, `${where}.cover`) } : {}),
      };
    case "video": {
      let titlePos: "top" | "bottom" | undefined;
      if (value.titlePos !== undefined) {
        if (value.titlePos !== "top" && value.titlePos !== "bottom") throw new ContentError(`${where}.titlePos`, 'must be "top" or "bottom"');
        titlePos = value.titlePos;
      }
      return {
        type,
        account: text(value.account, `${where}.account`),
        title: text(value.title, `${where}.title`),
        ...(value.cover !== undefined ? { cover: str(value.cover, `${where}.cover`) } : {}),
        duration: str(value.duration, `${where}.duration`),
        ...(titlePos !== undefined ? { titlePos } : {}),
      };
    }
    case "history":
      return { type, title: text(value.title, `${where}.title`), lines: strList(value.lines, `${where}.lines`).map((l, i) => text(l, `${where}.lines[${i}]`)) };
    case "link":
      return {
        type,
        title: text(value.title, `${where}.title`),
        site: text(value.site, `${where}.site`),
        ...(value.icon !== undefined ? { icon: str(value.icon, `${where}.icon`) } : {}),
      };
    case "image":
      return { type, ...(value.src !== undefined ? { src: str(value.src, `${where}.src`) } : {}), alt: text(value.alt, `${where}.alt`) };
    case "file":
      return { type, name: text(value.name, `${where}.name`), size: str(value.size, `${where}.size`), ext: str(value.ext, `${where}.ext`) };
    case "mini":
      return {
        type,
        brand: text(value.brand, `${where}.brand`),
        title: text(value.title, `${where}.title`),
        ...(value.cover !== undefined ? { cover: str(value.cover, `${where}.cover`) } : {}),
      };
    case "voice":
      return { type, seconds: str(value.seconds, `${where}.seconds`) };
    case "task": {
      if (!Array.isArray(value.fields)) throw new ContentError(`${where}.fields`, "must be a list of [label, value] pairs");
      const fields = value.fields.map((pair, i) => {
        if (!Array.isArray(pair) || pair.length !== 2) throw new ContentError(`${where}.fields[${i}]`, "must be [label, value]");
        return [text(pair[0], `${where}.fields[${i}][0]`), text(pair[1], `${where}.fields[${i}][1]`)] as const;
      });
      return { type, title: text(value.title, `${where}.title`), fields, ...(value.action !== undefined ? { action: text(value.action, `${where}.action`) } : {}) };
    }
  }
}

function incoming(value: unknown, where: string): Incoming {
  if (!isRecord(value)) throw new ContentError(where, "an incoming item must be an object");
  onlyKeys(value, ["t", "text", "kind", "cond_show", "effects", "note", "doc", "card", "forwarded"], where);
  const kind = value.kind as IncomingKind;
  if (!INCOMING_KINDS.includes(kind)) throw new ContentError(where, `unknown kind "${String(value.kind)}"`);
  const out: Record<string, unknown> = { t: time(value.t, `${where}.t`), text: text(value.text, `${where}.text`), kind };
  // A deliverable carries the doc it posts; no other kind may (desktop-ui 2026-11-02).
  if (kind === "deliverable") out.doc = str(value.doc, `${where}.doc`);
  else if (value.doc !== undefined) throw new ContentError(where, `only a deliverable may carry "doc"`);
  if (value.card !== undefined) out.card = card(value.card, `${where}.card`);
  if (value.forwarded !== undefined) {
    if (value.forwarded !== true) throw new ContentError(`${where}.forwarded`, "must be true");
    out.forwarded = true;
  }
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
    if (FAMILY_GROUPS.includes(name)) throw new ContentError(label, `${name} lives in ${name}.json`);
    recipients.set(name, recipientTable(value, `${label} ${name}`));
  }
  return { day: raw.day as number, recipients };
}

/**
 * Parses a 家里 group file (`family.json`, `clan.json`: the same shape, `{ _note, days: { "1": {
 * incoming, <word>: entry } } }`) into day -> table. `label` names the file in errors. Pure;
 * exported for tests.
 */
export function parseFamilyFile(raw: unknown, id: string = FAMILY, label: string = `${id}.json`): Map<number, RecipientTable> {
  if (!isRecord(raw) || !isRecord(raw.days)) throw new ContentError(label, "expected { days: {...} }");
  onlyKeys(raw, ["_note", "days"], label);
  const out = new Map<number, RecipientTable>();
  for (const [key, value] of Object.entries(raw.days)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 1) throw new ContentError(label, `bad day key "${key}"`);
    out.set(day, recipientTable(value, `${label} day ${day}`));
  }
  return out;
}

// ——— English twins (replies addition 2026-11-01) ———
// content/replies/en/<same file name>.json has the same shape and, cell for cell, the same days,
// words, statuses, times and effects; only `text` and `inner` differ. Parsed by the same strict
// parser, then checked against the zh twin; anything else fails loudly.

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The structural fingerprint of a card: everything the twin check compares (the type, which optional
 * keys are present, the asset ids, and the counts). Text fields (title, digest, account, site, alt,
 * name, size, duration, seconds, brand, each line, each field's label/value, action) are left out so
 * they may differ between languages (desktop-ui 2026-11-03: "compares card structure and lets text
 * fields differ").
 */
function cardShape(c: Card): unknown {
  switch (c.type) {
    case "article":
      return { type: c.type, digest: c.digest !== undefined, cover: c.cover ?? null };
    case "video":
      return { type: c.type, cover: c.cover ?? null, titlePos: c.titlePos ?? null };
    case "history":
      return { type: c.type, lines: c.lines.length };
    case "link":
      return { type: c.type, icon: c.icon ?? null };
    case "image":
      return { type: c.type, src: c.src ?? null };
    case "file":
      return { type: c.type, ext: c.ext };
    case "mini":
      return { type: c.type, cover: c.cover ?? null };
    case "voice":
      return { type: c.type };
    case "task":
      return { type: c.type, fields: c.fields.length, action: c.action !== undefined };
  }
}

/** Two cards are structural twins (same type, same optional keys, same assets and counts). */
function cardTwin(zh: Card | undefined, en: Card | undefined, where: string): void {
  if ((zh === undefined) !== (en === undefined)) throw new ContentError(where, "card present in only one language");
  if (zh && en && !same(cardShape(zh), cardShape(en))) throw new ContentError(where, "card structure differs from the Chinese");
}

/** Throws unless `en` is the structural twin of `zh`. Exported for tests. */
export function assertTwin(zh: RecipientTable, en: RecipientTable, where: string): void {
  const zhWords = [...zh.cells.keys()];
  const enWords = [...en.cells.keys()];
  if (!same(zhWords, enWords)) throw new ContentError(where, `words differ from the Chinese: [${enWords}] vs [${zhWords}]`);
  if (zh.incoming.length !== en.incoming.length) {
    throw new ContentError(where, `${en.incoming.length} incoming lines, the Chinese has ${zh.incoming.length}`);
  }
  zh.incoming.forEach((z, i) => {
    const e = en.incoming[i]!;
    if (z.t !== e.t || z.kind !== e.kind || z.doc !== e.doc || z.forwarded !== e.forwarded || !same(z.effects, e.effects) || !same(z.cond_show, e.cond_show)) {
      throw new ContentError(`${where}.incoming[${i}]`, "time, kind, doc, effects or condition differ from the Chinese");
    }
    cardTwin(z.card, e.card, `${where}.incoming[${i}]`);
  });
  for (const [word, z] of zh.cells) {
    const e = en.cells.get(word)!;
    const at = `${where}.${word}`;
    if (z.status !== e.status) throw new ContentError(at, `status "${e.status}", the Chinese has "${z.status}"`);
    if (z.readAfter !== e.readAfter || !same(z.effects, e.effects) || !same(z.cond_show, e.cond_show)) {
      throw new ContentError(at, "readAfter, effects or condition differ from the Chinese");
    }
    if ((z.inner === undefined) !== (e.inner === undefined)) throw new ContentError(at, "inner present in only one language");
    if (z.lines.length !== e.lines.length) throw new ContentError(at, `${e.lines.length} lines, the Chinese has ${z.lines.length}`);
    z.lines.forEach((zl, i) => {
      const el = e.lines[i]!;
      if (zl.who !== el.who || zl.t !== el.t) throw new ContentError(`${at}.lines[${i}]`, "speaker or time differs from the Chinese");
    });
    if ((z.interrupt === undefined) !== (e.interrupt === undefined)) throw new ContentError(at, "interrupt present in only one language");
    if (z.interrupt && e.interrupt && (z.interrupt.who !== e.interrupt.who || z.interrupt.where !== e.interrupt.where || z.interrupt.t !== e.interrupt.t)) {
      throw new ContentError(`${at}.interrupt`, "speaker, conversation or time differs from the Chinese");
    }
  }
}

/** Asserts two day -> table maps are twins: the same days, then each day's table. */
export function assertTwinDays(zh: ReadonlyMap<number, RecipientTable>, en: ReadonlyMap<number, RecipientTable>, label: string): void {
  if (!same([...zh.keys()], [...en.keys()])) throw new ContentError(label, `days [${[...en.keys()]}] differ from the Chinese [${[...zh.keys()]}]`);
  for (const [day, z] of zh) assertTwin(z, en.get(day)!, `${label} day ${day}`);
}

/** An object whose `key` reads in the active reply locale: the English twin's text, else the Chinese. */
function bilingual<T extends object>(zh: T, en: Partial<Record<"text" | "inner", string>>): T {
  const out = { ...zh } as Record<string, unknown>;
  for (const [key, enText] of Object.entries(en)) {
    const zhText = out[key];
    Object.defineProperty(out, key, { enumerable: true, get: () => (replyLocale() === "en" ? enText : zhText) });
  }
  return out as T;
}

/** The zh table, whose `text` and `inner` read in English when the locale is English. Pure. */
export function localise(zh: RecipientTable, en: RecipientTable): RecipientTable {
  const cells = new Map<string, Entry>();
  for (const [word, z] of zh.cells) {
    const e = en.cells.get(word)!;
    const entryOut = bilingual(z, e.inner !== undefined ? { inner: e.inner } : {});
    cells.set(word, {
      ...entryOut,
      get inner() {
        return entryOut.inner;
      },
      lines: z.lines.map((line, i) => bilingual(line, { text: e.lines[i]!.text })),
      ...(z.interrupt && e.interrupt ? { interrupt: bilingual(z.interrupt, { text: e.interrupt.text }) } : {}),
    } as Entry);
  }
  return {
    incoming: zh.incoming.map((item, i) => {
      const e = en.incoming[i]!;
      const out = bilingual(item, { text: e.text }) as Incoming & { card?: Card };
      if (item.card && e.card) Object.defineProperty(out, "card", { enumerable: true, get: () => (replyLocale() === "en" ? e.card : item.card) });
      return out;
    }),
    cells,
  };
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

const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/**
 * Combines the day files and the 家里 group files into day -> DayTable. `clan` is optional (the
 * fixtures of older tests have only a family). `en` maps an English twin's file path to its raw
 * JSON (`en/family.json`, `en/clan.json`, `en/day-NN.json`): each is parsed strictly, checked
 * against its Chinese twin and merged so the active locale picks the text; a file with no twin
 * stays Chinese. Pure; exported for tests.
 */
export function buildReplyTable(
  dayFiles: Record<string, unknown>,
  family: unknown,
  clan?: unknown,
  en: Record<string, unknown> = {},
): ReadonlyMap<number, DayTable> {
  const twins = new Map(Object.entries(en).map(([path, raw]) => [baseName(path), raw]));
  const used = new Set<string>();
  /** The twin of `file`, parsed with `parse`, or undefined if it has none. */
  const twin = <T>(file: string, parse: (raw: unknown, label: string) => T): T | undefined => {
    if (!twins.has(file)) return undefined;
    used.add(file);
    return parse(twins.get(file), `en/${file}`);
  };

  // 家里: one file per group, each its own conversation on the days it has.
  const groups = new Map<string, Map<number, RecipientTable>>();
  for (const [id, raw] of [[FAMILY, family], [CLAN, clan]] as const) {
    if (raw === undefined) continue;
    const zh = parseFamilyFile(raw, id);
    const enMap = twin(`${id}.json`, (r, label) => parseFamilyFile(r, id, label));
    if (enMap) {
      assertTwinDays(zh, enMap, `en/${id}.json`);
      for (const [day, table] of zh) zh.set(day, localise(table, enMap.get(day)!));
    }
    groups.set(id, zh);
  }

  const days = new Map<number, DayTable>();
  for (const [path, raw] of Object.entries(dayFiles)) {
    const label = baseName(path);
    const table = parseDayFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (table.day !== fromName) throw new ContentError(label, `file name says day ${fromName}, content says ${table.day}`);
    if (days.has(table.day)) throw new ContentError(label, `day ${table.day} appears twice`);
    const enDay = twin(label, (r, l) => parseDayFile(r, l));
    if (enDay) {
      if (enDay.day !== table.day) throw new ContentError(`en/${label}`, `day ${enDay.day}, the Chinese has ${table.day}`);
      if (!same([...table.recipients.keys()], [...enDay.recipients.keys()])) {
        throw new ContentError(`en/${label}`, `conversations [${[...enDay.recipients.keys()]}] differ from the Chinese [${[...table.recipients.keys()]}]`);
      }
      for (const [name, z] of table.recipients) {
        assertTwin(z, enDay.recipients.get(name)!, `en/${label} ${name}`);
        (table.recipients as Map<string, RecipientTable>).set(name, localise(z, enDay.recipients.get(name)!));
      }
    }
    // The group conversations follow the day's own, family first.
    for (const [id, byDay] of groups) {
      const groupTable = byDay.get(table.day);
      if (groupTable) (table.recipients as Map<string, RecipientTable>).set(id, groupTable);
    }
    checkInterrupts(table);
    days.set(table.day, table);
  }
  for (const [id, byDay] of groups) {
    for (const day of byDay.keys()) if (!days.has(day)) throw new ContentError(`${id}.json`, `day ${day} has no day file`);
  }
  for (const file of twins.keys()) {
    if (!used.has(file)) throw new ContentError(`en/${file}`, "has no Chinese twin");
  }
  return deepFreeze(new Map([...days].sort(([a], [b]) => a - b)));
}

const dayFiles = import.meta.glob("../../../content/replies/day-*.json", { eager: true, import: "default" });
const enFiles = import.meta.glob("../../../content/replies/en/*.json", { eager: true, import: "default" });

/** day -> recipient -> { incoming, cells }. Loaded and checked once, frozen. */
export const replyTable: ReadonlyMap<number, DayTable> = buildReplyTable(dayFiles, familyFile, clanFile, enFiles);

/** The table for a day, or undefined past the last scripted day. */
export function dayTable(day: number): DayTable | undefined {
  return replyTable.get(day);
}
