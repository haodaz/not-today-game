// tape-record R2 (2026-11-05): content/sleeptalk.json (Claude's) is what the walkman caught at the
// bedside: `{ _note, nights: { "<day>": { name, lines: string[] } } }`. content/en/sleeptalk.json is
// its twin: the same nights, the same number of lines; only the text differs. Read strictly,
// checked against each other, frozen. Both files are optional: no file means nothing was caught.
// A night's recording is the `record` event of that day; it shows the next morning (pure in the log).
import type { GameEvent } from "./events";
import { bilingualValues } from "./content-locale";

export interface SleepTalk {
  /** The file's name in 文件 → 下载. */
  readonly name: string;
  readonly lines: readonly string[];
  /** tape-reverse R2: the one line only playing the tape backwards brings out; absent = none. */
  readonly backwards?: string;
}

/** By night (the day the recording was made). */
export type SleepTalkTable = ReadonlyMap<number, SleepTalk>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const failer =
  (file: string) =>
  (where: string, problem: string): never => {
    throw new Error(`content/${file} ${where}: ${problem}`);
  };

/** One file, strict: unknown keys fail; a night is a day number ≥ 1 with a name and ≥ 1 line. */
export function parseSleeptalk(input: unknown, file = "sleeptalk.json"): SleepTalkTable {
  const fail = failer(file);
  if (!isRecord(input)) fail("", "not an object");
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "nights") fail("top level", `unknown key "${k}"`);
  if (raw._note !== undefined && typeof raw._note !== "string") fail("_note", "must be a string");
  if (!isRecord(raw.nights)) fail("nights", "must be an object");
  const out = new Map<number, SleepTalk>();
  for (const [key, v] of Object.entries(raw.nights as Record<string, unknown>)) {
    const w = `nights.${key}`;
    if (!/^[1-9]\d*$/.test(key)) fail(w, "must be a day number");
    if (!isRecord(v)) fail(w, "must be an object");
    const n = v as Record<string, unknown>;
    for (const k of Object.keys(n)) if (k !== "name" && k !== "lines" && k !== "backwards") fail(w, `unknown key "${k}"`);
    if (typeof n.name !== "string" || n.name === "") fail(`${w}.name`, "expected a non-empty string");
    if (!Array.isArray(n.lines) || n.lines.length === 0) fail(`${w}.lines`, "must be a non-empty list");
    (n.lines as unknown[]).forEach((l, i) => {
      if (typeof l !== "string" || l === "") fail(`${w}.lines[${i}]`, "expected a non-empty string");
    });
    if (n.backwards !== undefined && (typeof n.backwards !== "string" || n.backwards === "")) fail(`${w}.backwards`, "expected a non-empty string");
    out.set(Number(key), Object.freeze({ name: n.name as string, lines: Object.freeze([...(n.lines as string[])]), ...(n.backwards !== undefined ? { backwards: n.backwards as string } : {}) }));
  }
  return new Map([...out].sort(([a], [b]) => a - b));
}

/** The Chinese table, its name and lines read from the twin under lang=en. The twin must have the same nights and line counts. */
export function localiseSleeptalk(zh: SleepTalkTable, en: SleepTalkTable): SleepTalkTable {
  const fail = failer("en/sleeptalk.json");
  for (const n of zh.keys()) if (!en.has(n)) fail(`nights.${n}`, "missing (the Chinese has it)");
  for (const n of en.keys()) if (!zh.has(n)) fail(`nights.${n}`, "not in the Chinese");
  const out = new Map<number, SleepTalk>();
  for (const [n, z] of zh) {
    const e = en.get(n)!;
    if (e.lines.length !== z.lines.length) fail(`nights.${n}.lines`, `${e.lines.length} lines, the Chinese has ${z.lines.length}`);
    // tape-reverse R2: `backwards` in both or in neither.
    if ((z.backwards === undefined) !== (e.backwards === undefined)) fail(`nights.${n}.backwards`, z.backwards === undefined ? "not in the Chinese" : "missing (the Chinese has it)");
    out.set(n, Object.freeze(bilingualValues(z, { name: e.name, lines: e.lines, ...(e.backwards !== undefined ? { backwards: e.backwards } : {}) })));
  }
  return out;
}

/** Both files or neither; the Chinese without its twin fails (the twin is required, as for every content file). */
export function loadSleeptalk(zhRaw: unknown, enRaw: unknown): SleepTalkTable {
  if (zhRaw === undefined && enRaw === undefined) return new Map();
  if (zhRaw === undefined) throw new Error("content/en/sleeptalk.json: the Chinese content/sleeptalk.json is missing");
  if (enRaw === undefined) throw new Error("content/sleeptalk.json: its twin content/en/sleeptalk.json is missing");
  return localiseSleeptalk(parseSleeptalk(zhRaw), parseSleeptalk(enRaw, "en/sleeptalk.json"));
}

const zhFiles = import.meta.glob("../../content/sleeptalk.json", { eager: true, import: "default" });
const enFiles = import.meta.glob("../../content/en/sleeptalk.json", { eager: true, import: "default" });

/** What the walkman can catch, by night (empty until Claude writes the files). */
export const sleeptalkTable: SleepTalkTable = loadSleeptalk(Object.values(zhFiles)[0], Object.values(enFiles)[0]);

/** Recorded on this night (a `record` event of that day). */
export const recordedOn = (events: readonly GameEvent[], night: number): boolean => events.some((e) => e.kind === "record" && e.day === night);

/**
 * What was caught by `day`: every night before it with a recording and content for it, oldest
 * first. A recording made on night N is there from the morning of N + 1.
 */
export function caughtBy(events: readonly GameEvent[], day: number, table: SleepTalkTable = sleeptalkTable): readonly { readonly night: number; readonly talk: SleepTalk }[] {
  const out: { night: number; talk: SleepTalk }[] = [];
  for (const [night, talk] of table) if (night < day && recordedOn(events, night)) out.push({ night, talk });
  return out;
}

/** The file id of night N's recording in 下载. */
export const sleeptalkFileId = (night: number): string => `sleeptalk-${night}`;
