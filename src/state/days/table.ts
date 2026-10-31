/// <reference types="vite/client" />
// content/days/day-NN.json (Claude's): the day's beats, checklist items and delivery waiting.
// Read, checked strictly, frozen; no string is rewritten. Condition tokens are parsed here so a
// token the engine does not understand fails at import, not at play.
import { constants, membersOf } from "../variables";

export const LINE_KINDS = ["narration", "inner", "sfx", "speaker"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export const BEAT_NAMES = ["boot", "box", "desk", "shutdown", "night"] as const;
export type BeatName = (typeof BEAT_NAMES)[number];

export interface SayLine {
  readonly k: LineKind;
  readonly t: string;
  readonly sfx?: string;
  readonly who?: string;
}

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
  readonly rewrite?: string;
  readonly sfx?: string;
  readonly self?: boolean;
  readonly origin?: "them";
  readonly locked?: "requiredPending";
  readonly onUnlock?: Sequence;
  readonly onDone?: Sequence;
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

/** Parses one dialogue line (shared with content/tasks). `onFail` names the file family. */
export function parseLine(v: unknown, w: string, onFail: (where: string, problem: string) => never = fail): SayLine {
  if (!isRecord(v)) onFail(w, "a line must be an object");
  const r = v as Raw;
  for (const k of Object.keys(r)) if (!["k", "t", "sfx", "who"].includes(k)) onFail(w, `unknown key "${k}"`);
  const k = r.k as LineKind;
  if (!LINE_KINDS.includes(k)) onFail(w, `unknown line kind "${String(r.k)}"`);
  if (k === "speaker" && r.who === undefined) onFail(w, "a speaker line needs `who`");
  const s = (x: unknown, where: string) => (typeof x === "string" && x !== "" ? x : onFail(where, "expected a non-empty string"));
  return {
    k,
    t: s(r.t, `${w}.t`),
    ...(r.sfx !== undefined ? { sfx: s(r.sfx, `${w}.sfx`) } : {}),
    ...(r.who !== undefined ? { who: s(r.who, `${w}.who`) } : {}),
  };
}

const line = (v: unknown, w: string): SayLine => parseLine(v, w);

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
  keys(v, allowChoices ? ["say", "choices"] : ["say"], w);
  if (!Array.isArray(v.say)) fail(`${w}.say`, "must be a list");
  const say = v.say.map((x, i) => line(x, `${w}.say[${i}]`));
  if (v.choices === undefined) return { say };
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
  return { say, choices };
}

function item(v: unknown, w: string): Item {
  if (!isRecord(v)) fail(w, "an item must be an object");
  keys(v, ["id", "text", "unlock", "done", "required", "rewrite", "sfx", "self", "origin", "locked", "onUnlock", "onDone"], w);
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
    ...(v.rewrite !== undefined ? { rewrite: str(v.rewrite, `${w}.rewrite`) } : {}),
    ...(v.sfx !== undefined ? { sfx: str(v.sfx, `${w}.sfx`) } : {}),
    ...(v.self === true ? { self: true } : {}),
    ...(v.origin === "them" ? { origin: "them" as const } : {}),
    ...(v.locked === "requiredPending" ? { locked: "requiredPending" as const } : {}),
    ...(v.onUnlock !== undefined ? { onUnlock: sequence(v.onUnlock, `${w}.onUnlock`, false) } : {}),
    ...(v.onDone !== undefined ? { onDone: sequence(v.onDone, `${w}.onDone`, false) } : {}),
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
