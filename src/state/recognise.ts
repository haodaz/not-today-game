// content/objects.json (Claude's): "do you know what this is?" (recognise spec). Each object that
// comes out of the box is asked once on its day, with 2–4 options, at most one right; a wrong answer
// can be tried again on a later day when the object is picked up from the desk bar (once per day).
// Options are ways of answering (author 2026-11-06): one may carry its own continuation (`say`, then
// `inner`), played instead of the object's shared `right` / `wrong` block. With no right option the
// question is not a test: any pick counts as recognised.
// Read, checked strictly, frozen. The reducer derives right/wrong from content, never from the UI.
import raw from "@content/objects.json";
import enRaw from "@content/en/objects.json";
import { objectsFoundOnDay } from "./stages";
import { bilingualValues } from "./content-locale";
import type { GameEvent } from "./events";
import { hasEvidence, judge, type JudgementDelta } from "./judgement";
import { HAND_FIELDS } from "./hands";
import { shuffled } from "./seed";
import type { State } from "./types.gen";
import { membersOf } from "./variables";

export interface RecogniseOption {
  readonly t: string;
  /** Content's `right`, false when absent. */
  readonly right: boolean;
  /** This option's own continuation (narration lines), played instead of the shared block. */
  readonly say?: readonly string[];
  /** Its inner line after `say` (only with `say`). */
  readonly inner?: string;
}

export interface Answer {
  readonly say: readonly string[];
  readonly inner: string;
}

export interface RecogniseEntry {
  readonly day: number;
  readonly q: string;
  readonly options: readonly RecogniseOption[];
  /** The shared blocks: present when an option without its own `say` falls back to them. */
  readonly right?: Answer;
  readonly wrong?: Answer;
}

/** A right answer is truth +1 evidence; a wrong one is not negative (FR2). */
export const RIGHT_DELTA: JudgementDelta = { truth: 1 };
/** An object has 2–4 options (author 2026-11-06; it was exactly 3). */
export const OPTION_MIN = 2;
export const OPTION_MAX = 4;

/** The question is a test: one of its options is right. Without one, any pick counts. */
export const isTest = (options: readonly Pick<RecogniseOption, "right">[]): boolean => options.some((o) => o.right);
/** Picking option `i` counts as recognised: it is the right one, or the question is no test. */
const optionCounts = (options: readonly Pick<RecogniseOption, "right">[], i: number): boolean => options[i]?.right === true || (i >= 0 && i < options.length && !isTest(options));
/** The shared block an option without its own `say` falls back to. */
const fallbackOf = (options: readonly Pick<RecogniseOption, "right">[], i: number): "right" | "wrong" => (optionCounts(options, i) ? "right" : "wrong");

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
function fail(where: string, problem: string): never {
  throw new Error(`content/objects.json ${where}: ${problem}`);
}
function keys(v: Raw, allowed: readonly string[], w: string): void {
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(w, `unknown key "${k}"`);
}
const str = (v: unknown, w: string): string => (typeof v === "string" && v !== "" ? v : fail(w, "expected a non-empty string"));

function answer(v: unknown, w: string): Answer {
  if (!isRecord(v)) fail(w, "must be an object");
  keys(v, ["say", "inner"], w);
  if (!Array.isArray(v.say) || v.say.length === 0) fail(`${w}.say`, "must be a non-empty list");
  return Object.freeze({ say: Object.freeze(v.say.map((s, i) => str(s, `${w}.say[${i}]`))), inner: str(v.inner, `${w}.inner`) });
}

/** One option: { t, right?, say?, inner? }; `inner` only with `say`. */
function option(o: unknown, w: string): RecogniseOption {
  if (!isRecord(o)) fail(w, "must be an object");
  keys(o, ["t", "right", "say", "inner"], w);
  if (o.right !== undefined && typeof o.right !== "boolean") fail(`${w}.right`, "must be true or false");
  const t = str(o.t, `${w}.t`);
  if (o.say === undefined) {
    if (o.inner !== undefined) fail(`${w}.inner`, "needs the option's own say");
    return Object.freeze({ t, right: o.right === true });
  }
  if (!Array.isArray(o.say) || o.say.length === 0) fail(`${w}.say`, "must be a non-empty list");
  const say = Object.freeze(o.say.map((s, i) => str(s, `${w}.say[${i}]`)));
  return Object.freeze({ t, right: o.right === true, say, ...(o.inner !== undefined ? { inner: str(o.inner, `${w}.inner`) } : {}) });
}

/**
 * Parses the table: every object out of the box has one entry, on its box day, with 2–4 options and
 * at most one right. The shared `right` / `wrong` blocks are needed exactly when an option without
 * its own `say` falls back to them (a pick that counts → right, else wrong); otherwise optional.
 */
export function parseObjects(input: unknown, foundOnDay: Readonly<Record<string, number>> = objectsFoundOnDay): ReadonlyMap<string, RecogniseEntry> {
  if (!isRecord(input)) fail("", "not an object");
  keys(input, ["_note", "objects"], "top level");
  if (!isRecord(input.objects)) fail("objects", "must be an object");
  const known = membersOf("found") ?? [];
  const out = new Map<string, RecogniseEntry>();
  for (const [id, v] of Object.entries(input.objects)) {
    const w = `objects.${id}`;
    if (!known.includes(id)) fail(w, "not an object in variables.json found");
    if (!isRecord(v)) fail(w, "must be an object");
    // The hand half of an entry (keys, screen, back, …) is read by hands.ts.
    keys(v, ["day", "q", "options", "right", "wrong", ...HAND_FIELDS], w);
    if (v.day !== foundOnDay[id]) fail(`${w}.day`, `must be its box day ${foundOnDay[id]} (stages.json objectsFoundOnDay)`);
    if (!Array.isArray(v.options) || v.options.length < OPTION_MIN || v.options.length > OPTION_MAX) fail(`${w}.options`, `must have ${OPTION_MIN}–${OPTION_MAX} options`);
    const options = v.options.map((o, i) => option(o, `${w}.options[${i}]`));
    if (options.filter((o) => o.right).length > 1) fail(`${w}.options`, "may have at most one right option");
    const needs = new Set(options.flatMap((o, i) => (o.say ? [] : [fallbackOf(options, i)])));
    const block = (k: "right" | "wrong"): Answer | undefined => {
      if (v[k] !== undefined) return answer(v[k], `${w}.${k}`);
      if (needs.has(k)) fail(`${w}.${k}`, `missing: an option without its own say falls back to it`);
      return undefined;
    };
    const right = block("right");
    const wrong = block("wrong");
    out.set(id, Object.freeze({ day: v.day as number, q: str(v.q, `${w}.q`), options: Object.freeze(options), ...(right ? { right } : {}), ...(wrong ? { wrong } : {}) }));
  }
  for (const id of Object.keys(foundOnDay)) if (!out.has(id)) fail("objects", `"${id}" comes out of the box but has no question`);
  return out;
}

// ——— English twin (dialogue addition 2026-11-02) ———
// content/en/objects.json has the same objects, the same `day` and the same option `right` flags;
// only the text differs (`q`, each option's `t`, the right/wrong `say` and `inner`). The reducer
// reads the `right` flags, not text, so the swap is display-only. First difference names its path.
function localiseAnswer(zh: Answer | undefined, en: Answer | undefined, w: string): Answer | undefined {
  if (!zh || !en) {
    if (zh || en) fail(w, `${en ? "present" : "missing"}, unlike the Chinese`);
    return undefined;
  }
  if (zh.say.length !== en.say.length) fail(`${w}.say`, `${en.say.length} lines, the Chinese has ${zh.say.length}`);
  return bilingualValues(zh, { say: en.say, inner: en.inner });
}
/** An option's own continuation in English: the same shape (say's length, inner or not) as the Chinese. */
function localiseOption(zo: RecogniseOption, eo: RecogniseOption, w: string): RecogniseOption {
  if (zo.right !== eo.right) fail(`${w}.right`, "the right flag differs from the Chinese");
  if ((zo.say === undefined) !== (eo.say === undefined)) fail(`${w}.say`, `${eo.say ? "present" : "missing"}, unlike the Chinese`);
  if (zo.say && eo.say && zo.say.length !== eo.say.length) fail(`${w}.say`, `${eo.say.length} lines, the Chinese has ${zo.say.length}`);
  if ((zo.inner === undefined) !== (eo.inner === undefined)) fail(`${w}.inner`, `${eo.inner ? "present" : "missing"}, unlike the Chinese`);
  return bilingualValues(zo, { t: eo.t, say: eo.say, inner: eo.inner });
}
function localiseObjects(zh: ReadonlyMap<string, RecogniseEntry>, en: ReadonlyMap<string, RecogniseEntry>): ReadonlyMap<string, RecogniseEntry> {
  if (!objKeysEqual(zh, en)) fail("en/objects.json", `objects [${[...en.keys()]}] differ from the Chinese [${[...zh.keys()]}]`);
  const out = new Map<string, RecogniseEntry>();
  for (const [id, z] of zh) {
    const e = en.get(id)!;
    const w = `en/objects.json ${id}`;
    if (z.day !== e.day) fail(`${w}.day`, `day ${e.day}, the Chinese has ${z.day}`);
    if (z.options.length !== e.options.length) fail(`${w}.options`, "option count differs from the Chinese");
    const options = z.options.map((zo, i) => localiseOption(zo, e.options[i]!, `${w}.options[${i}]`));
    out.set(id, bilingualValues(z, { q: e.q, options, right: localiseAnswer(z.right, e.right, `${w}.right`), wrong: localiseAnswer(z.wrong, e.wrong, `${w}.wrong`) }));
  }
  return out;
}
const objKeysEqual = (a: ReadonlyMap<string, unknown>, b: ReadonlyMap<string, unknown>): boolean =>
  a.size === b.size && [...a.keys()].every((k) => b.has(k));

/** Objects, Chinese text swapped to the English twin under lang=en (the twin is validated at load). */
export const recogniseTable: ReadonlyMap<string, RecogniseEntry> = localiseObjects(parseObjects(raw), parseObjects(enRaw));

/** The option order for this run: shuffled once, seeded by the run id, so replay is stable (FR1). */
// (An object's option count is its own: 2–4. Three options shuffle exactly as before.)
export const optionOrder = (runId: string, object: string): number[] => shuffled(`recognise:${runId}:${object}`, recogniseTable.get(object)?.options.length ?? 3);

type RecogniseEvent = Extract<GameEvent, { kind: "recognise" }>;
const isRecognise = (e: GameEvent): e is RecogniseEvent => e.kind === "recognise";

/**
 * Whether this answer counts as recognising it: the right option, or any option of a question that
 * is no test (no option right; author 2026-11-06). An event without `option` is world-state's plain
 * form: it counts.
 */
export function wasRight(e: Pick<RecogniseEvent, "objectId" | "option">): boolean {
  if (e.option === undefined) return true;
  const entry = recogniseTable.get(e.objectId);
  return entry !== undefined && optionCounts(entry.options, e.option);
}

/**
 * What plays after picking option `option` (author 2026-11-06): the option's own `say` (then its
 * `inner`, if any), else the object's shared block (`right` if the pick counts, else `wrong`).
 * The loader guarantees the block is there when it is needed.
 */
export function answerFor(object: string, option: number): { readonly say: readonly string[]; readonly inner?: string } {
  const entry = recogniseTable.get(object);
  if (!entry) throw new Error(`recognise: "${object}" has no question`);
  const o = entry.options[option];
  if (!o) throw new Error(`recognise: "${object}" has no option ${option}`);
  if (o.say) return o.inner === undefined ? { say: o.say } : { say: o.say, inner: o.inner };
  return entry[fallbackOf(entry.options, option)]!;
}

/**
 * Knows what it is: recognised in state, or (for a box thing outside variables.json's `recognised`
 * set, if any) answered in the log with a pick that counts.
 */
export function knows(object: string, state: State, events: readonly GameEvent[]): boolean {
  return (state.recognised as string[]).includes(object) || events.some((e) => isRecognise(e) && e.objectId === object && wasRight(e));
}

/** Already asked about `object` on `day` (once per day, right or wrong). */
export const askedOn = (events: readonly GameEvent[], day: number, object: string): boolean =>
  events.some((e) => isRecognise(e) && e.day === day && e.objectId === object);

/**
 * The reducer. With an `option` (the question): the object must be in the table and found; a
 * wrong option changes nothing; one that counts (the right one, or any pick of a question with no
 * right option) adds it to `recognised` (if the set lists it: all eight do) and logs truth +1 once. Without
 * one: world-state's plain form, which recognises it.
 */
export function applyRecognise(state: State, event: RecogniseEvent, plain: (state: State) => State): State {
  if (event.option === undefined) return plain(state);
  const entry = recogniseTable.get(event.objectId);
  if (!entry) throw new Error(`recognise: "${event.objectId}" has no question`);
  if (!Number.isInteger(event.option) || event.option < 0 || event.option >= entry.options.length) {
    throw new Error(`recognise: "${event.objectId}" has no option ${event.option}`);
  }
  if (!(state.found as string[]).includes(event.objectId)) throw new Error(`recognise: "${event.objectId}" has not been found`);
  if (!optionCounts(entry.options, event.option)) return state;
  const counts = (membersOf("recognised") ?? []).includes(event.objectId);
  const next = counts ? plain(state) : state;
  const id = `recognise:${event.objectId}`;
  return hasEvidence(next, id) ? next : judge(next, RIGHT_DELTA, event.day, id, entry.options[event.option]!.t);
}
