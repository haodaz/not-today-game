/// <reference types="vite/client" />
// content/days/day-NN.json (Claude's): the day's beats, checklist items and delivery waiting.
// Read, checked strictly, frozen; no string is rewritten. Condition tokens are parsed here so a
// token the engine does not understand fails at import, not at play.
import { constants } from "../variables";
import { parseKuroCloses, type KuroCloses } from "../closes";
import { bilingual, bilingualValues } from "../content-locale";

export const LINE_KINDS = ["narration", "inner", "sfx", "speaker"] as const;
export type LineKind = (typeof LINE_KINDS)[number];

// lying-view R6: `rise` (optional) is what is seen on getting up, once a day, after the first 起床.
export const BEAT_NAMES = ["boot", "rise", "turn", "box", "desk", "shutdown", "night"] as const;
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
}

export interface Choice {
  readonly text: string;
  readonly effects?: ChoiceEffects;
  readonly cond_show?: { readonly has: string };
  /** night-hand (author 2026-11-06): a shutdown choice's own next lines, right after the pick. */
  readonly say?: readonly SayLine[];
}

export interface Sequence {
  readonly say: readonly SayLine[];
  readonly choices?: readonly Choice[];
  /** The default `where` of its lines (a line's own wins). */
  readonly where?: Place;
  /** 2026-11-08 (heads and tails): after its last line is read the camera goes here by itself. */
  readonly then?: "desk" | "table" | "room";
  /** Lines said once the camera has arrived there (needs `then`). */
  readonly after?: readonly SayLine[];
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
  | { readonly type: "loanDecided" }
  /** The boss's call has ended (day-loop 2026-11-03): the synthetic call item is done, night falls. */
  | { readonly type: "callEnded" };

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

/** One line of the boss's call transcript (day-loop "the boss calls", 2026-11-03): who speaks, when. */
export interface CallLine {
  readonly who: "boss" | "me";
  readonly t: string;
}

/**
 * The boss's call (day-loop "the boss calls", 2026-11-03). At `at` the boss asks 「通个话」; after the
 * player's one reply, 30 game minutes pass, then the call runs to `length` (H:MM:SS or MM:SS) in
 * compressed time, filling in `lines` one at a time. When it ends, night falls and `task` — a
 * required night item like the others — joins the checklist. Optional; a day without it is unchanged.
 */
export interface Call {
  readonly at: string;
  readonly length: string;
  readonly lines: readonly CallLine[];
  readonly task: Item;
}

export interface DayFile {
  readonly day: number;
  readonly beats: Readonly<Partial<Record<BeatName, Sequence>>>;
  readonly items: readonly Item[];
  readonly delivery: { readonly minMinutes: number; readonly waitMinutes: number; readonly none: boolean };
  /** The boss's call this day, if content scripts one (day-loop 2026-11-03). */
  readonly call?: Call;
}

/** The synthetic required day item a call adds: nightfall waits for the call to end. */
export const CALL_ITEM_ID = "__call";

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
    case "callEnded":
      return { kind: "event", event: { type: "callEnded" } };
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
    ...(r.backdrop !== undefined ? { backdrop: parsePicture(r.backdrop, BACKDROP_DIR, `${w}.backdrop`, onFail, true) } : {}),
    ...(r.prop !== undefined ? { prop: parsePicture(r.prop, PROP_DIR, `${w}.prop`, onFail, true) } : {}),
  };
}

const line = (v: unknown, w: string): SayLine => parseLine(v, w, fail, true);

/** A choice's effects: flags and san (the old night-raid `item_dream` / `item_lost` are gone, 2026-11-06). */
function effects(v: unknown, w: string): ChoiceEffects {
  if (!isRecord(v)) fail(w, "effects must be an object");
  keys(v, ["flags", "san"], w);
  const out: Record<string, unknown> = {};
  if (v.flags !== undefined) {
    if (!Array.isArray(v.flags) || !v.flags.every((f) => typeof f === "string")) fail(`${w}.flags`, "must be a list of strings");
    out.flags = v.flags;
  }
  if (v.san !== undefined) {
    if (!Number.isInteger(v.san)) fail(`${w}.san`, "must be an integer");
    out.san = v.san;
  }
  return out as ChoiceEffects;
}

/** `choiceSay`: its choices may carry their own `say` (the shutdown beat only; author 2026-11-06). */
function sequence(v: unknown, w: string, allowChoices: boolean, choiceSay = false): Sequence {
  if (!isRecord(v)) fail(w, "a sequence must be an object");
  keys(v, allowChoices ? ["say", "choices", "where", "then", "after"] : ["say", "where", "then", "after"], w);
  if (!Array.isArray(v.say)) fail(`${w}.say`, "must be a list");
  const say = v.say.map((x, i) => line(x, `${w}.say[${i}]`));
  if (v.then !== undefined && v.then !== "desk" && v.then !== "table" && v.then !== "room") fail(`${w}.then`, 'must be "desk", "table" or "room"');
  if (v.after !== undefined && v.then === undefined) fail(`${w}.after`, "needs then");
  if (v.after !== undefined && !Array.isArray(v.after)) fail(`${w}.after`, "must be a list");
  const after = Array.isArray(v.after) ? v.after.map((x, i) => line(x, `${w}.after[${i}]`)) : undefined;
  const where = { ...(v.where !== undefined ? { where: parsePlace(v.where, `${w}.where`) } : {}), ...(v.then !== undefined ? { then: v.then as "desk" | "table" | "room" } : {}), ...(after !== undefined ? { after } : {}) };
  if (v.choices === undefined) return { say, ...where };
  if (!Array.isArray(v.choices) || v.choices.length === 0) fail(`${w}.choices`, "must be a non-empty list");
  const choices = v.choices.map((c, i): Choice => {
    const cw = `${w}.choices[${i}]`;
    if (!isRecord(c)) fail(cw, "a choice must be an object");
    // `goto` is in the requirements but no day uses it; reject until there is a target to go to.
    keys(c, choiceSay ? ["text", "effects", "cond_show", "say"] : ["text", "effects", "cond_show"], cw);
    let say: SayLine[] | undefined;
    if (c.say !== undefined) {
      if (!Array.isArray(c.say) || c.say.length === 0) fail(`${cw}.say`, "must be a non-empty list");
      say = c.say.map((x, j) => line(x, `${cw}.say[${j}]`));
    }
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
      ...(say ? { say } : {}),
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

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A call length: H:MM:SS or MM:SS (e.g. 30:00, 1:12:00). */
const CALL_LEN = /^(?:\d+:)?[0-5]?\d:[0-5]\d$/;

/** Parses the day's optional boss call (day-loop 2026-11-03). Its `task` is a required night item. */
function call(v: unknown, w: string): Call {
  if (!isRecord(v)) fail(w, "a call must be an object");
  keys(v, ["at", "length", "lines", "task"], w);
  const atTime = str(v.at, `${w}.at`);
  if (!HHMM.test(atTime)) fail(`${w}.at`, "must be HH:MM");
  const length = str(v.length, `${w}.length`);
  if (!CALL_LEN.test(length)) fail(`${w}.length`, "must be H:MM:SS or MM:SS");
  if (!Array.isArray(v.lines) || v.lines.length === 0) fail(`${w}.lines`, "must be a non-empty list");
  const lines = v.lines.map((l, i): CallLine => {
    const lw = `${w}.lines[${i}]`;
    if (!isRecord(l)) fail(lw, "a line must be an object");
    keys(l, ["who", "t"], lw);
    if (l.who !== "boss" && l.who !== "me") fail(`${lw}.who`, 'must be "boss" or "me"');
    const t = str(l.t, `${lw}.t`);
    if (!HHMM.test(t)) fail(`${lw}.t`, "must be HH:MM");
    return { who: l.who, t };
  });
  const task = item(v.task, `${w}.task`);
  if (task.when !== "night") fail(`${w}.task`, 'the call\'s task is a night item (when: "night")');
  if (!task.required) fail(`${w}.task`, "the call's task is required");
  return { at: atTime, length, lines, task };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** The synthetic required day item a call adds: nightfall waits until the call has ended. */
function callGateItem(): Item {
  return {
    id: CALL_ITEM_ID,
    text: "",
    unlock: { kind: "start" },
    done: { kind: "event", event: { type: "callEnded" } },
    unlockRaw: "start",
    doneRaw: "event:callEnded",
    required: true,
    when: "day",
  };
}

/** Parses one day file. Pure; exported for tests. */
export function parseDayFile(raw: unknown, label: string): DayFile {
  if (!isRecord(raw)) fail(label, "not an object");
  keys(raw, ["day", "_note", "beats", "items", "delivery", "call"], label);
  if (!Number.isInteger(raw.day) || (raw.day as number) < 1) fail(label, "day must be an integer >= 1");
  if (!isRecord(raw.beats)) fail(`${label}.beats`, "must be an object");
  keys(raw.beats, BEAT_NAMES, `${label}.beats`);
  const beats: Partial<Record<BeatName, Sequence>> = {};
  for (const name of BEAT_NAMES) {
    // `rise` is lines only (lying-view R6: `{ say: [...] }`), no choices; so is `turn` (the first look at the desk after rising, author 2026-11-10).
    if (raw.beats[name] !== undefined) beats[name] = sequence(raw.beats[name], `${label}.beats.${name}`, name !== "rise" && name !== "turn", name === "shutdown");
  }
  if (!Array.isArray(raw.items)) fail(`${label}.items`, "must be a list");
  const authored = raw.items.map((x, i) => item(x, `${label}.items[${i}]`));
  // The boss's call (day-loop 2026-11-03): its gate is a required day item (nightfall waits for the
  // call to end), its task a required night item; both flow through the ordinary checklist.
  const callData = raw.call !== undefined ? call(raw.call, `${label}.call`) : undefined;
  const items = callData ? [callGateItem(), ...authored, callData.task] : authored;
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
  return deepFreeze({ day: raw.day as number, beats, items, delivery, ...(callData ? { call: callData } : {}) });
}

// ——— English twins (dialogue addition 2026-11-02) ———
// content/days/en/day-NN.json has the same shape and, line for line, the same ids, counts and
// non-text fields; only the text (`t`, `who` on a speaker line, `Item.text`, `Item.rewrite`, a
// choice's `text`) differs. Validated against the zh source; the first difference names its path.

/** The text fields of a SayLine that an English twin may differ on; the rest must match. */
function assertLineTwin(zh: SayLine, en: SayLine, w: string): void {
  if (zh.k !== en.k) fail(w, `kind "${en.k}", the Chinese has "${zh.k}"`);
  if (zh.where !== en.where) fail(w, `where differs from the Chinese`);
  if (zh.sfx !== en.sfx) fail(w, `sfx differs from the Chinese`);
  if (zh.backdrop !== en.backdrop) fail(w, `backdrop differs from the Chinese`);
  if (zh.prop !== en.prop) fail(w, `prop differs from the Chinese`);
}
function localiseLine(zh: SayLine, en: SayLine, w: string): SayLine {
  assertLineTwin(zh, en, w);
  // `who` on a speaker line is a display name (localisable); `t` is the text.
  return bilingual(zh, { t: en.t, ...(zh.who !== undefined ? { who: en.who } : {}) });
}
function localiseSeq(zh: Sequence | undefined, en: Sequence | undefined, w: string): Sequence | undefined {
  if (zh === undefined && en === undefined) return undefined;
  if (zh === undefined || en === undefined) fail(w, `sequence present in only one language`);
  if (zh.say.length !== en.say.length) fail(`${w}.say`, `${en.say.length} lines, the Chinese has ${zh.say.length}`);
  if (zh.then !== en.then) fail(`${w}.then`, "differs from the Chinese");
  if ((zh.after?.length ?? 0) !== (en.after?.length ?? 0)) fail(`${w}.after`, `${en.after?.length ?? 0} lines, the Chinese has ${zh.after?.length ?? 0}`);
  const after = zh.after?.map((z, i) => localiseLine(z, en.after![i]!, `${w}.after[${i}]`));
  const say = zh.say.map((z, i) => localiseLine(z, en.say[i]!, `${w}.say[${i}]`));
  if ((zh.choices?.length ?? 0) !== (en.choices?.length ?? 0)) fail(`${w}.choices`, `choice count differs from the Chinese`);
  const choices = zh.choices?.map((z, i) => {
    const e = en.choices![i]!;
    if (!same(z.effects, e.effects) || !same(z.cond_show, e.cond_show)) fail(`${w}.choices[${i}]`, `effects or condition differ from the Chinese`);
    // A choice's own lines: line for line, as a sequence's.
    const cw = `${w}.choices[${i}].say`;
    if ((z.say?.length ?? 0) !== (e.say?.length ?? 0)) fail(cw, `${e.say?.length ?? 0} lines, the Chinese has ${z.say?.length ?? 0}`);
    const say = z.say?.map((l, j) => localiseLine(l, e.say![j]!, `${cw}[${j}]`));
    const out = bilingual(z, { text: e.text });
    return say ? bilingualValues(out, { say }) : out;
  });
  return { say, ...(choices ? { choices } : {}), ...(zh.where !== undefined ? { where: zh.where } : {}) , ...(after !== undefined ? { after } : {}) };
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The zh day file with its text localised by the en twin. Throws at the first structural difference. */
export function localiseDayFile(zh: DayFile, en: DayFile, label: string): DayFile {
  const beats: Partial<Record<BeatName, Sequence>> = {};
  for (const name of BEAT_NAMES) {
    const seq = localiseSeq(zh.beats[name], en.beats[name], `${label}.beats.${name}`);
    if (seq) beats[name] = seq;
  }
  if (zh.items.length !== en.items.length) fail(label, `${en.items.length} items, the Chinese has ${zh.items.length}`);
  const items = zh.items.map((z, i) => {
    const e = en.items[i]!;
    const w = `${label}.items[${i}]`;
    if (z.id !== e.id) fail(w, `id "${e.id}", the Chinese has "${z.id}"`);
    if (z.unlockRaw !== e.unlockRaw || z.doneRaw !== e.doneRaw || z.when !== e.when || z.required !== e.required) fail(w, `a non-text field differs from the Chinese`);
    // The onUnlock / onDone sequences are localised first, then `bilingual` wraps the text fields.
    // (Never spread a bilingual object: spreading invokes its getters and flattens them to values.)
    const withSeq = {
      ...z,
      ...(z.onUnlock ? { onUnlock: localiseSeq(z.onUnlock, e.onUnlock, `${w}.onUnlock`)! } : {}),
      ...(z.onDone ? { onDone: localiseSeq(z.onDone, e.onDone, `${w}.onDone`)! } : {}),
    };
    return bilingual(withSeq, { text: e.text, ...(z.rewrite !== undefined ? { rewrite: e.rewrite } : {}) });
  });
  // The call's transcript (who/time) carries no translatable text; its task is localised with the
  // rest of the items, so point the carried call at that localised task.
  const call = zh.call ? { ...zh.call, task: items.find((it) => it.id === zh.call!.task.id)! } : undefined;
  return { day: zh.day, beats, items, delivery: zh.delivery, ...(call ? { call } : {}) };
}

const files = import.meta.glob("../../../content/days/day-*.json", { eager: true, import: "default" });
const enFiles = import.meta.glob("../../../content/days/en/day-*.json", { eager: true, import: "default" });

export const dayFiles: ReadonlyMap<number, DayFile> = (() => {
  const twins = new Map(Object.entries(enFiles).map(([p, raw]) => [p.slice(p.lastIndexOf("/") + 1), raw]));
  const out = new Map<number, DayFile>();
  for (const [path, raw] of Object.entries(files)) {
    const label = path.slice(path.lastIndexOf("/") + 1);
    const file = parseDayFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (file.day !== fromName) fail(label, `file name says day ${fromName}, content says ${file.day}`);
    // A twin, if one exists, is validated and merged (its text shows under lang=en); else Chinese stays.
    const enRaw = twins.get(label);
    out.set(file.day, enRaw === undefined ? file : deepFreeze(localiseDayFile(file, parseDayFile(enRaw, `en/${label}`), `en/${label}`)));
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
