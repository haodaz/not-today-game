// content/objects.json (Claude's): "do you know what this is?" (recognise spec). Each object that
// comes out of the box is asked once on its day, three options, one right; a wrong answer can be
// tried again on a later day when the object is picked up from the desk bar (once per day).
// Read, checked strictly, frozen. The reducer derives right/wrong from content, never from the UI.
import raw from "@content/objects.json";
import stagesFile from "@content/stages.json";
import type { GameEvent } from "./events";
import { hasEvidence, judge, type JudgementDelta } from "./judgement";
import { HAND_FIELDS } from "./hands";
import { shuffled } from "./seed";
import type { State } from "./types.gen";
import { membersOf } from "./variables";

export interface RecogniseOption {
  readonly t: string;
  readonly right: boolean;
}

export interface Answer {
  readonly say: readonly string[];
  readonly inner: string;
}

export interface RecogniseEntry {
  readonly day: number;
  readonly q: string;
  readonly options: readonly RecogniseOption[];
  readonly right: Answer;
  readonly wrong: Answer;
}

/** A right answer is truth +1 evidence; a wrong one is not negative (FR2). */
export const RIGHT_DELTA: JudgementDelta = { truth: 1 };
export const OPTION_COUNT = 3;

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

/** Parses the table: every object out of the box has one entry, on its box day, with one right option of three. */
export function parseObjects(input: unknown, foundOnDay: Readonly<Record<string, number>> = stagesFile.objectsFoundOnDay): ReadonlyMap<string, RecogniseEntry> {
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
    if (!Array.isArray(v.options) || v.options.length !== OPTION_COUNT) fail(`${w}.options`, `must have exactly ${OPTION_COUNT} options`);
    const options = v.options.map((o, i) => {
      if (!isRecord(o)) fail(`${w}.options[${i}]`, "must be an object");
      keys(o, ["t", "right"], `${w}.options[${i}]`);
      if (typeof o.right !== "boolean") fail(`${w}.options[${i}].right`, "must be true or false");
      return Object.freeze({ t: str(o.t, `${w}.options[${i}].t`), right: o.right });
    });
    if (options.filter((o) => o.right).length !== 1) fail(`${w}.options`, "must have exactly one right option");
    out.set(id, Object.freeze({ day: v.day as number, q: str(v.q, `${w}.q`), options: Object.freeze(options), right: answer(v.right, `${w}.right`), wrong: answer(v.wrong, `${w}.wrong`) }));
  }
  for (const id of Object.keys(foundOnDay)) if (!out.has(id)) fail("objects", `"${id}" comes out of the box but has no question`);
  return out;
}

export const recogniseTable = parseObjects(raw);

/** The option order for this run: shuffled once, seeded by the run id, so replay is stable (FR1). */
export const optionOrder = (runId: string, object: string): number[] => shuffled(`recognise:${runId}:${object}`, OPTION_COUNT);

type RecogniseEvent = Extract<GameEvent, { kind: "recognise" }>;
const isRecognise = (e: GameEvent): e is RecogniseEvent => e.kind === "recognise";

/** Whether this answer was the right one (an event without `option` is the world-state form: right). */
export function wasRight(e: Pick<RecogniseEvent, "objectId" | "option">): boolean {
  if (e.option === undefined) return true;
  return recogniseTable.get(e.objectId)?.options[e.option]?.right === true;
}

/**
 * Knows what it is: recognised in state, or (for the box things that are not one of the six, such
 * as the textbook) answered right in the log.
 */
export function knows(object: string, state: State, events: readonly GameEvent[]): boolean {
  return (state.recognised as string[]).includes(object) || events.some((e) => isRecognise(e) && e.objectId === object && wasRight(e));
}

/** Already asked about `object` on `day` (once per day, right or wrong). */
export const askedOn = (events: readonly GameEvent[], day: number, object: string): boolean =>
  events.some((e) => isRecognise(e) && e.day === day && e.objectId === object);

/**
 * The reducer. With an `option` (the question): the object must be in the table and found; a
 * wrong option changes nothing; a right one adds it to `recognised` (if it is one of the six) and
 * logs truth +1 once. Without one: world-state's plain form, which recognises it.
 */
export function applyRecognise(state: State, event: RecogniseEvent, plain: (state: State) => State): State {
  if (event.option === undefined) return plain(state);
  const entry = recogniseTable.get(event.objectId);
  if (!entry) throw new Error(`recognise: "${event.objectId}" has no question`);
  if (!Number.isInteger(event.option) || event.option < 0 || event.option >= entry.options.length) {
    throw new Error(`recognise: "${event.objectId}" has no option ${event.option}`);
  }
  if (!(state.found as string[]).includes(event.objectId)) throw new Error(`recognise: "${event.objectId}" has not been found`);
  if (!entry.options[event.option]!.right) return state;
  const counts = (membersOf("recognised") ?? []).includes(event.objectId);
  const next = counts ? plain(state) : state;
  const id = `recognise:${event.objectId}`;
  return hasEvidence(next, id) ? next : judge(next, RIGHT_DELTA, event.day, id, entry.options[event.option]!.t);
}
