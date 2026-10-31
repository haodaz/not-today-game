/// <reference types="vite/client" />
// content/tasks/day-NN.json (Claude's): the workbench's hand-written work-task trees. Each task:
// `start` (narration + the three options) and three paths self / look / let, each with `say`
// (dialogue box), `kuro` (small window, English constants) and `effects`. No LLM. Read, checked
// strictly, frozen; no string is rewritten.
import { parseLine, type SayLine } from "./table";

export const PATHS = ["self", "look", "let"] as const;
export type PathMode = (typeof PATHS)[number];
export const APPS = ["docs", "ledger", "code"] as const;

export interface TaskEffects {
  readonly flags?: readonly string[];
  readonly san?: number;
  /** The player looked at what it did (the event itself is the record). */
  readonly looked?: boolean;
  readonly letItDoUnchecked?: number;
}

export interface TaskPath {
  readonly say: readonly SayLine[];
  readonly kuro: readonly string[];
  readonly effects: TaskEffects;
}

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly app: (typeof APPS)[number];
  /** The flag that ticks the day's checklist item. */
  readonly done: string;
  readonly start: { readonly say: readonly SayLine[]; readonly options: readonly { readonly mode: PathMode; readonly goto: PathMode }[] };
  readonly self: TaskPath;
  readonly look: TaskPath;
  readonly let: TaskPath;
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
  keys(e, ["flags", "san", "looked", "letItDoUnchecked"], `${w}.effects`);
  if (e.flags !== undefined && (!Array.isArray(e.flags) || !e.flags.every((f) => typeof f === "string"))) fail(`${w}.effects.flags`, "must be a list of strings");
  if (e.san !== undefined && !Number.isInteger(e.san)) fail(`${w}.effects.san`, "must be an integer");
  if (e.looked !== undefined && typeof e.looked !== "boolean") fail(`${w}.effects.looked`, "must be true or false");
  if (e.letItDoUnchecked !== undefined && !(Number.isInteger(e.letItDoUnchecked) && (e.letItDoUnchecked as number) >= 0)) {
    fail(`${w}.effects.letItDoUnchecked`, "must be an integer >= 0");
  }
  return { say: lines(v.say, `${w}.say`), kuro: v.kuro as string[], effects: e as TaskEffects };
}

function task(v: unknown, w: string): Task {
  if (!isRecord(v)) fail(w, "a task must be an object");
  keys(v, ["id", "title", "app", "done", "start", ...PATHS], w);
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
  for (const m of PATHS) {
    if (!(out[m].effects.flags ?? []).includes(done)) fail(`${w}.${m}`, `effects do not set the done flag "${done}"`);
  }
  return out;
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

const files = import.meta.glob("../../../content/tasks/day-*.json", { eager: true, import: "default" });

export const taskFiles: ReadonlyMap<number, readonly Task[]> = (() => {
  const out = new Map<number, readonly Task[]>();
  for (const [p, raw] of Object.entries(files)) {
    const label = p.slice(p.lastIndexOf("/") + 1);
    const parsed = parseTaskFile(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (parsed.day !== fromName) fail(label, `file name says day ${fromName}, content says ${parsed.day}`);
    out.set(parsed.day, parsed.tasks);
  }
  return new Map([...out].sort(([a], [b]) => a - b));
})();

/** The task whose done flag is `flag` on `day`. */
export function taskByFlag(day: number, flag: string): Task | undefined {
  return taskFiles.get(day)?.find((t) => t.done === flag);
}
