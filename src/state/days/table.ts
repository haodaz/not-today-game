/// <reference types="vite/client" />
// content/days/day-NN.json (Claude's): the day's beats, checklist items and delivery waiting.
// Read, checked strictly, frozen; no string is rewritten. Condition tokens are parsed here so a
// token the engine does not understand fails at import, not at play.
import { constants, membersOf } from "../variables";
import { parseKuroCloses, type KuroCloses } from "../closes";

export const LINE_KINDS = ["narration", "inner", "sfx", "speaker"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const BEAT_NAMES = ["boot", "box", "desk", "shutdown", "night"] as const;
export type BeatName = (typeof BEAT_NAMES)[number];

/**
 * Where a line belongs (dialogue addition 2026-11-02): the box holds it back until the player is
 * there. `screen` is any desktop app; `screen:<app>` the desktop with that app in front; `night`
 * the night. No `where` = play where the trigger happened.
 */
const BASE_PLACES = ["room", "desk", "door", "night", "screen", "screen:msgs", "screen:workbench", "screen:browser"] as const;
/**
 * The third level (dialogue addition 2026-11-02): `screen:msgs:<conversation>` plays only while that
 * conversation is the one open (in whichever app holds it), `screen:workbench:<page>` only while
 * 工作台 shows that page. No falling back a level.
 */
export const MSGS_THREADS = ["boss", "partner", "group", "xiaozhang", "laozhou", "family", "clan"] as const;
export const WORKBENCH_PLACES = ["home", "tasks", "docs", "code", "ledger", "tickets", "projects"] as const;
export type Place =
  | (typeof BASE_PLACES)[number]
  | `screen:msgs:${(typeof MSGS_THREADS)[number]}`
  | `screen:workbench:${(typeof WORKBENCH_PLACES)[number]}`;
export const PLACES: readonly Place[] = [
  ...BASE_PLACES,
  ...MSGS_THREADS.map((id) => `screen:msgs:${id}` as const),
  ...WORKBENCH_PLACES.map((p) => `screen:workbench:${p}` as const),
];

/** A backdrop is a photo under /room/dream/, a prop a cut-out under /room/props/ (dialogue addition 2026-11-02). */
export const BACKDROP_DIR = "/room/dream/";
export const PROP_DIR = "/room/props/";
export interface SayLine {
  readonly k: LineKind;
  readonly t: string;
  readonly sfx?: string;
  readonly who?: string;
  readonly where?: Place;
  /**
   * The photo the stage shows while this line is on, and until its sequence ends (full frame, under
   * the box). A later line without one keeps it.
   */
  readonly backdrop?: string;
  /**
   * A cut-out shown large in the centre of the stage until a later line changes it. `""` clears it
   * (a line that says nothing keeps the last one, like the backdrop).
   */
  readonly prop?: string;
}
/** When an item belongs (day-loop addition 2026-11-02): the day's work, or the evening after nightfall. */
export const ITEM_WHEN = ["day", "night"] as const;
export type ItemWhen = (typeof ITEM_WHEN)[number];

export interface ChoiceEffects {
  readonly flags?: readonly string[];
  readonly san?: number;
  readonly item_dream?: string;
  readonly item_lost?: string;
}

export interface Choice {
  readonly text: string;
  readonly effects?: ChoiceEffects;
  readonly cond_show?: { readonly has: string };
}

export interface Sequence {
  readonly say: readonly SayLine[];
  readonly choices?: readonly Choice[];
  /** The default `where` of its lines (a line's own wins). */
  readonly where?: Place;
}

/** A parsed condition (`unlock` / `done`). */
export type Token =
  | { readonly kind: "start" }
  | { readonly kind: "done"; readonly id: string }
  | { readonly kind: "flag"; readonly flag: string }
  | { readonly kind: "event"; readonly event: EventToken };

export type EventToken =
  | { readonly type: "boot" }
  | { readonly type: "openApp"; readonly app: string }
  | { readonly type: "order"; readonly meal: string }
  | { readonly type: "arrives"; readonly meal: string }
  | { readonly type: "pickup"; readonly meal: string }
  | { readonly type: "eat"; readonly meal: string }
  | { readonly type: "openBox" }
  | { readonly type: "reply"; readonly recipient: string }
  | { readonly type: "beat"; readonly beat: "desk" | "shutdown" }
  | { readonly type: "chat" }
  | { readonly type: "lieDown" }
  /** The loan prompt has been answered (world-state loan is no longer "none"). */
  | { readonly type: "loanDecided" };

export interface Item {
  readonly id: string;
  readonly text: string;
  readonly unlock: Token;
  readonly done: Token;
  /** The raw tokens, for messages and tests. */
  readonly unlockRaw: string;
  readonly doneRaw: string;
  readonly required: boolean;
  /** `day` (default) or `night`: the evening list, shown after nightfall. */
  readonly when: ItemWhen;
  readonly rewrite?: string;
  readonly sfx?: string;
  readonly self?: boolean;
  readonly origin?: "them";
  readonly locked?: "requiredPending";
  readonly onUnlock?: Sequence;
  readonly onDone?: Sequence;
  /** late-days FR4: Kuro closes this item's document (工作台 文档) when it is opened. */
  readonly kuroCloses?: true;
  readonly kuroClosesLine?: KuroCloses["kuroClosesLine"];
}

export interface DayFile {
  readonly day: number;
  readonly beats: Readonly<Partial<Record<BeatName, Sequence>>>;
  readonly items: readonly Item[];
  readonly delivery: { readonly minMinutes: number; readonly waitMinutes: number; readonly none: boolean };
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/days ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], where: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(where, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));
const MEALS = ["lunch", "dinner"];
const APPS = ["msgs", "workbench", "browser"];

/** Parses one condition token. Exported for tests. */
export function parseToken(raw: string, where: string): Token {
  if (raw === "start") return { kind: "start" };
  const [head, ...rest] = raw.split(":");
  const arg = rest.join(":");
  if (head === "done" && arg) return { kind: "done", id: arg };
  if (head === "flag" && arg) return { kind: "flag", flag: arg };
  if (head !== "event") fail(where, `unknown condition "${raw}"`);
  const [type, a, b] = rest;
  const meal = (m: string | undefined) => (m && MEALS.includes(m) ? m : fail(where, `unknown meal in "${raw}"`));
  switch (type) {
    case "boot":
      return { kind: "event", event: { type: "boot" } };
    case "openApp":
      return { kind: "event", event: { type: "openApp", app: a && APPS.includes(a) ? a : fail(where, `unknown app in "${raw}"`) } };
    case "order":
      return { kind: "event", event: { type: "order", meal: meal(a) } };
    case "delivery":
      if (a !== "arrives") fail(where, `unknown delivery event "${raw}"`);
      return { kind: "event", event: { type: "arrives", meal: meal(b) } };
    case "pickup":
      return { kind: "event", event: { type: "pickup", meal: meal(a) } };
    case "eat":
      return { kind: "event", event: { type: "eat", meal: meal(a) } };
    case "openBox":
      return { kind: "event", event: { type: "openBox" } };
    case "reply":
      return { kind: "event", event: { type: "reply", recipient: a ? a : fail(where, `no recipient in "${raw}"`) } };
    case "beat":
      if (a !== "desk" && a !== "shutdown") fail(where, `unknown beat in "${raw}"`);
      return { kind: "event", event: { type: "beat", beat: a } };
    case "chat":
      return { kind: "event", event: { type: "chat" } };
    case "lieDown":
      return { kind: "event", event: { type: "lieDown" } };
    case "loan":
      if (a !== "decided") fail(where, `unknown loan event "${raw}"`);
      return { kind: "event", event: { type: "loanDecided" } };
    default:
      return fail(where, `unknown event "${raw}"`);
  }
}

/** A `where`: one of PLACES, nothing else. Exported for tests. */
export function parsePlace(v: unknown, w: string, onFail: (where: string, problem: string) => never = fail): Place {
  return (PLACES as readonly unknown[]).includes(v)
    ? (v as Place)
    : onFail(w, `unknown place ${JSON.stringify(v)} (one of ${BASE_PLACES.join(", ")}, screen:msgs:<${MSGS_THREADS.join("|")}>, screen:workbench:<${WORKBENCH_PLACES.join("|")}>)`);
}

/** A path under `dir` made of plain file-name characters, one level deep: `/room/dream/classroom.jpg`. */
function parsePicture(v: unknown, dir: string, w: string, onFail: (where: string, problem: string) => never, allowEmpty = false): string {
  if (allowEmpty && v === "") return "";
  if (typeof v !== "string" || !new RegExp(`^${dir.replace(/\//g, "\\/")}[A-Za-z0-9_-]+\\.(?:jpg|png)$`).test(v)) {
    return onFail(w, `expected a path ${allowEmpty ? '("" clears) ' : ""}under ${dir} (a .jpg or .png), got ${JSON.stringify(v)}`);
  }
  return v;
}
/**
 * Parses one dialogue line (shared with content/tasks). `onFail` names the file family. Only the
 * day files' lines may carry `where`, `backdrop` and `prop` (`withWhere`); a task tree's may not.
 */
export function parseLine(v: unknown, w: string, onFail: (where: string, problem: string) => never = fail, withWhere = false): SayLine {
  if (!isRecord(v)) onFail(w, "a line must be an object");
  const r = v as Raw;
  const allowed = withWhere ? ["k", "t", "sfx", "who", "where", "backdrop", "prop"] : ["k", "t", "sfx", "who"];
  for (const k of Object.keys(r)) if (!allowed.includes(k)) onFail(w, `unknown key "${k}"`);
  const k = r.k as LineKind;
  if (!LINE_KINDS.includes(k)) onFail(w, `unknown line kind "${String(r.k)}"`);
  if (k === "speaker" && r.who === undefined) onFail(w, "a speaker line needs `who`");
  const s = (x: unknown, where: string) => (typeof x === "string" && x !== "" ? x : onFail(where, "expected a non-empty string"));
  return {
    k,
    t: s(r.t, `${w}.t`),
    ...(r.sfx !== undefined ? { sfx: s(r.sfx, `${w}.sfx`) } : {}),
    ...(r.who !== undefined ? { who: s(r.who, `${w}.who`) } : {}),
    ...(r.where !== undefined ? { where: parsePlace(r.where, `${w}.where`, onFail) } : {}),
    ...(r.backdrop !== undefined ? { backdrop: parsePicture(r.backdrop, BACKDROP_DIR, `${w}.backdrop`, onFail) } : {}),
    ...(r.prop !== undefined ? { prop: parsePicture(r.prop, PROP_DIR, `${w}.prop`, onFail, true) } : {}),
  };
}

const line = (v: unknown, w: string): SayLine => parseLine(v, w, fail, true);

const objectIds = (): readonly string[] => membersOf("found") ?? [];

function effects(v: unknown, w: string): ChoiceEffects {
  if (!isRecord(v)) fail(w, "effects must be an object");
  keys(v, ["flags", "san", "item_dream", "item_lost"], w);
  const out: Record<string, unknown> = {};
  if (v.flags !== undefined) {
    if (!Array.isArray(v.flags) || !v.flags.every((f) => typeof f === "string")) fail(`${w}.flags`, "must be a list of strings");
    out.flags = v.flags;
  }
  if (v.san !== undefined) {
    if (!Number.isInteger(v.san)) fail(`${w}.san`, "must be an integer");
    out.san = v.san;
  }
  if (v.item_dream !== undefined) {
    const object = str(v.item_dream, `${w}.item_dream`);
    if (!objectIds().includes(object)) fail(`${w}.item_dream`, `unknown object "${object}"`);
    out.item_dream = object;
  }
  if (v.item_lost !== undefined) {
    // Handed to the hand: the loan row, or one of the objects.
    const lost = str(v.item_lost, `${w}.item_lost`);
    if (lost !== "loan" && !objectIds().includes(lost)) fail(`${w}.item_lost`, `unknown thing "${lost}"`);
    out.item_lost = lost;
  }
  return out as ChoiceEffects;
}

function sequence(v: unknown, w: string, allowChoices: boolean): Sequence {
  if (!isRecord(v)) fail(w, "a sequence must be an object");
  keys(v, allowChoices ? ["say", "choices", "where"] : ["say", "where"], w);
  if (!Array.isArray(v.say)) fail(`${w}.say`, "must be a list");
  const say = v.say.map((x, i) => line(x, `${w}.say[${i}]`));
  const where = v.where !== undefined ? { where: parsePlace(v.where, `${w}.where`) } : {};
  if (v.choices === undefined) return { say, ...where };
  if (!Array.isArray(v.choices) || v.choices.length === 0) fail(`${w}.choices`, "must be a non-empty list");
  const choices = v.choices.map((c, i): Choice => {
    const cw = `${w}.choices[${i}]`;
    if (!isRecord(c)) fail(cw, "a choice must be an object");
    // `goto` is in the requirements but no day uses it; reject until there is a target to go to.
    keys(c, ["text", "effects", "cond_show"], cw);
    let cond: { has: string } | undefined;
    if (c.cond_show !== undefined) {
      if (!isRecord(c.cond_show)) fail(`${cw}.cond_show`, "must be an object");
      keys(c.cond_show, ["has"], `${cw}.cond_show`);
      cond = { has: str(c.cond_show.has, `${cw}.cond_show.has`) };
    }
    return {
      text: str(c.text, `${cw}.text`),
      ...(c.effects !== undefined ? { effects: effects(c.effects, `${cw}.effects`) } : {}),
      ...(cond ? { cond_show: cond } : {}),
    };
  });
  return { say, choices, ...where };
}

function item(v: unknown, w: string): Item {
  if (!isRecord(v)) fail(w, "an item must be an object");
  keys(v, ["id", "text", "unlock", "done", "required", "when", "rewrite", "sfx", "self", "origin", "locked", "onUnlock", "onDone", "kuroCloses", "kuroClosesLine"], w);
  if (v.when !== undefined && !(ITEM_WHEN as readonly unknown[]).includes(v.when)) fail(`${w}.when`, `must be one of ${ITEM_WHEN.map((x) => `"${x}"`).join(", ")}`);
  // late-days FR4: Kuro may close this item's document when it is opened.
  const closes = parseKuroCloses(v, (field, problem) => fail(`${w}.${field}`, problem));
  if (typeof v.required !== "boolean") fail(`${w}.required`, "must be true or false");
  if (v.origin !== undefined && v.origin !== "them") fail(`${w}.origin`, `must be "them"`);
  if (v.locked !== undefined && v.locked !== "requiredPending") fail(`${w}.locked`, `must be "requiredPending"`);
  if (v.self !== undefined && typeof v.self !== "boolean") fail(`${w}.self`, "must be true or false");
  const unlockRaw = str(v.unlock, `${w}.unlock`);
  const doneRaw = str(v.done, `${w}.done`);
  return {
    id: str(v.id, `${w}.id`),
    text: str(v.text, `${w}.text`),
    unlock: parseToken(unlockRaw, `${w}.unlock`),
    done: parseToken(doneRaw, `${w}.done`),
    unlockRaw,
    doneRaw,
    required: v.required,
    when: (v.when as ItemWhen | undefined) ?? "day",
    ...(v.rewrite !== undefined ? { rewrite: str(v.rewrite, `${w}.rewrite`) } : {}),
    ...(v.sfx !== undefined ? { sfx: str(v.sfx, `${w}.sfx`) } : {}),
    ...(v.self === true ? { self: true } : {}),
    ...(v.origin === "them" ? { origin: "them" as const } : {}),
    ...(v.locked === "requiredPending" ? { locked: "requiredPending" as const } : {}),
    ...(v.onUnlock !== undefined ? { onUnlock: sequence(v.onUnlock, `${w}.onUnlock`, false) } : {}),
    ...(v.onDone !== undefined ? { onDone: sequence(v.onDone, `${w}.onDone`, false) } : {}),
    ...(closes ?? {}),
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Parses one day file. Pure; exported for tests. */
export function parseDayFile(raw: unknown, label: string): DayFile {
  if (!isRecord(raw)) fail(label, "not an object");
  keys(raw, ["day", "_note", "beats", "items", "delivery"], label);
  if (!Number.isInteger(raw.day) || (raw.day as number) < 1) fail(label, "day must be an integer >= 1");
  if (!isRecord(raw.beats)) fail(`${label}.beats`, "must be an object");
  keys(raw.beats, BEAT_NAMES, `${label}.beats`);
  const beats: Partial<Record<BeatName, Sequence>> = {};
  for (const name of BEAT_NAMES) {
    if (raw.beats[name] !== undefined) beats[name] = sequence(raw.beats[name], `${label}.beats.${name}`, true);
  }
  if (!Array.isArray(raw.items)) fail(`${label}.items`, "must be a list");
  const items = raw.items.map((x, i) => item(x, `${label}.items[${i}]`));
  const ids = new Set<string>();
  for (const it of items) {
    if (ids.has(it.id)) fail(label, `duplicate item id "${it.id}"`);
    ids.add(it.id);
  }
  for (const it of items) {
    for (const tok of [it.unlock, it.done]) {
      if (tok.kind === "done" && !ids.has(tok.id)) fail(`${label} ${it.id}`, `refers to unknown item "${tok.id}"`);
    }
  }
  if (!isRecord(raw.delivery)) fail(`${label}.delivery`, "must be an object");
  keys(raw.delivery, ["minMinutes", "waitMinutes", "none"], `${label}.delivery`);
  const minutes = (v: unknown, w: string) => (typeof v === "number" && v >= 0 ? v : fail(w, "must be a number >= 0"));
  const delivery = {
    minMinutes: minutes(raw.delivery.minMinutes, `${label}.delivery.minMinutes`),
    waitMinutes: minutes(raw.delivery.waitMinutes, `${label}.delivery.waitMinutes`),
    none: raw.delivery.none === true,
  };
  if (!delivery.none && delivery.waitMinutes < delivery.minMinutes) fail(`${label}.delivery`, "waitMinutes is below minMinutes");
  return deepFreeze({ day: raw.day as number, beats, items, delivery });
}

const files = import.meta.glob("../../../content/days/day-*.json", { eager: true, import: "default" });

export const dayFiles: ReadonlyMap<number, DayFile> = (() => {
  const out = new Map<number, DayFile>();
  for (const [path, raw] of Object.entries(files)) {
    const label = path.slice(path.lastIndexOf("/") + 1);
    const file = parseDayFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (file.day !== fromName) fail(label, `file name says day ${fromName}, content says ${file.day}`);
    out.set(file.day, file);
  }
  return new Map([...out].sort(([a], [b]) => a - b));
})();

export function dayFile(day: number): DayFile | undefined {
  return dayFiles.get(day);
}

/** Every flag an item's `done` names on `day` (the work tasks a `task` event may set). */
export function taskFlags(day: number): string[] {
  return (dayFile(day)?.items ?? []).flatMap((it) => (it.done.kind === "flag" ? [it.done.flag] : []));
}

void constants;
