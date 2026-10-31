// The content quality gates (tech.md "Quality gates"), runnable from the shell and from the hooks.
//   node scripts/validate-content.ts                 both checks below
//   node scripts/validate-content.ts --days [files]  content/days/day-*.json (or the files given)
//   node scripts/validate-content.ts --strings       keys in zh.json missing from en.json
// Exit codes: 0 clean · 1 a day file has a problem · 2 cannot run (bad arguments, or a table it
// reads is missing or unreadable) · 3 the days are clean but English keys are missing (a report:
// the game falls back to Chinese). The highest-priority code wins: 2, then 1, then 3.
// Read-only: it never writes content. The strict loaders (src/state/**) stay the authority at
// import time; this gives the same news earlier, file by file, without starting the game.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DAYS_DIR = join(ROOT, "content/days");
const VARIABLES = join(ROOT, "content/variables.json");
const STAGES = join(ROOT, "content/stages.json");
const ZH = join(ROOT, "content/strings/zh.json");
const EN = join(ROOT, "content/strings/en.json");

/** Every day has these beats. */
const CORE_BEATS = ["boot", "desk", "shutdown", "night"] as const;
/** `box` is the fifth: present exactly on the days an object arrives (stages.json objectsFoundOnDay). */
const ALL_BEATS = ["boot", "box", "desk", "shutdown", "night"];
/**
 * A choice's `effects` are the day files' deltas: each key changes one variable of
 * content/variables.json (the same keys the loader accepts, src/state/days/table.ts).
 */
const EFFECT_VARIABLE: Readonly<Record<string, string>> = { flags: "flags", san: "san", item_dream: "dream", item_lost: "lost" };
/** A field that names a string key (none in the day files today; checked when one appears). */
const STRING_KEY_FIELD = /^(key|stringKey|labelKey|[a-z]+Key)$/;

class CannotRun extends Error {}

function readJson(path: string, what: string): unknown {
  if (!existsSync(path)) throw new CannotRun(`${what}: ${path} does not exist`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new CannotRun(`${what}: ${path} is not valid JSON (${(e as Error).message})`);
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const rel = (p: string) => p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p;

interface Tables {
  readonly variables: ReadonlySet<string>;
  readonly zh: Readonly<Record<string, string>>;
  readonly boxDays: ReadonlySet<number>;
}

function loadTables(): Tables {
  const vars = readJson(VARIABLES, "variables");
  const stages = readJson(STAGES, "stages");
  const zh = readJson(ZH, "strings zh");
  if (!isRecord(vars) || !isRecord(stages) || !isRecord(zh)) throw new CannotRun("variables, stages and zh strings must be JSON objects");
  const found = stages.objectsFoundOnDay;
  if (!isRecord(found)) throw new CannotRun("stages.json: objectsFoundOnDay must be an object");
  return {
    variables: new Set(Object.keys(vars).filter((k) => !k.startsWith("_"))),
    zh: zh as Record<string, string>,
    boxDays: new Set(Object.values(found).filter((d): d is number => typeof d === "number")),
  };
}

/** Problems in one day file, as "where: what" lines. */
export function checkDay(raw: unknown, label: string, t: Tables): string[] {
  const out: string[] = [];
  const say = (where: string, what: string) => out.push(`${label}${where ? ` ${where}` : ""}: ${what}`);
  if (!isRecord(raw)) return [`${label}: not a JSON object`];
  const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
  if (raw.day !== fromName) say("day", `is ${JSON.stringify(raw.day)}, the file name says ${fromName}`);

  // Five beats: the four every day has, and the box exactly on the days an object arrives.
  const beats = raw.beats;
  if (!isRecord(beats)) say("beats", "missing or not an object");
  else {
    for (const b of CORE_BEATS) if (beats[b] === undefined) say(`beats.${b}`, "missing");
    for (const b of Object.keys(beats)) if (!ALL_BEATS.includes(b)) say(`beats.${b}`, `not a beat (${ALL_BEATS.join(", ")})`);
    const boxDay = t.boxDays.has(fromName);
    if (boxDay && beats.box === undefined) say("beats.box", `missing (an object arrives on day ${fromName})`);
    if (!boxDay && beats.box !== undefined) say("beats.box", `present, but no object arrives on day ${fromName}`);
  }

  // Deltas and string keys, anywhere in the file.
  const walk = (v: unknown, path: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (!isRecord(v)) return;
    for (const [k, x] of Object.entries(v)) {
      const p = path ? `${path}.${k}` : k;
      if (k === "effects" && isRecord(x)) {
        for (const e of Object.keys(x)) {
          const variable = EFFECT_VARIABLE[e];
          if (!variable) say(`${p}.${e}`, `not an effect (${Object.keys(EFFECT_VARIABLE).join(", ")})`);
          else if (!t.variables.has(variable)) say(`${p}.${e}`, `changes "${variable}", which content/variables.json does not have`);
        }
      }
      if (k === "delta" && isRecord(x)) {
        for (const d of Object.keys(x)) if (!t.variables.has(d)) say(`${p}.${d}`, "not a key of content/variables.json");
      }
      if (STRING_KEY_FIELD.test(k) && typeof x === "string" && !(x in t.zh)) say(p, `string key "${x}" is not in content/strings/zh.json`);
      walk(x, p);
    }
  };
  walk(raw, "");
  return out;
}

function dayFilesFrom(args: readonly string[]): string[] {
  if (args.length) {
    const files = args.map((a) => resolve(a));
    for (const f of files) if (!existsSync(f)) throw new CannotRun(`${f} does not exist`);
    return files;
  }
  if (!existsSync(DAYS_DIR)) throw new CannotRun(`${DAYS_DIR} does not exist`);
  return readdirSync(DAYS_DIR)
    .filter((f) => /^day-\d+\.json$/.test(f))
    .sort()
    .map((f) => join(DAYS_DIR, f));
}

function runDays(files: readonly string[], t: Tables): number {
  let problems = 0;
  for (const file of files) {
    const label = rel(file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      console.log(`${label}: cannot be read as JSON (${(e as Error).message})`);
      problems += 1;
      continue;
    }
    const found = checkDay(raw, label, t);
    for (const line of found) console.log(line);
    problems += found.length;
  }
  console.log(`days: ${files.length} file${files.length === 1 ? "" : "s"}, ${problems} problem${problems === 1 ? "" : "s"}`);
  return problems;
}

/** zh keys (not `_` notes) that en.json lacks. */
export function missingEnglish(zh: Record<string, unknown>, en: Record<string, unknown>): string[] {
  return Object.keys(zh).filter((k) => !k.startsWith("_") && !(k in en)).sort();
}

function runStrings(t: Tables): number {
  const en = readJson(EN, "strings en");
  if (!isRecord(en)) throw new CannotRun("en.json must be a JSON object");
  const missing = missingEnglish(t.zh, en);
  for (const k of missing) console.log(`content/strings/en.json: missing "${k}" (zh: ${JSON.stringify(t.zh[k])})`);
  console.log(`strings: ${missing.length} key${missing.length === 1 ? "" : "s"} missing from en.json`);
  return missing.length;
}

export function main(argv: readonly string[]): number {
  const flags = argv.filter((a) => a.startsWith("--"));
  const files = argv.filter((a) => !a.startsWith("--"));
  const unknown = flags.filter((f) => f !== "--days" && f !== "--strings");
  if (unknown.length) {
    console.error(`unknown option ${unknown.join(", ")} (use --days [files], --strings)`);
    return 2;
  }
  const both = flags.length === 0;
  const days = both || flags.includes("--days");
  const strings = both || flags.includes("--strings");
  try {
    const t = loadTables();
    const dayProblems = days ? runDays(dayFilesFrom(files), t) : 0;
    const missing = strings ? runStrings(t) : 0;
    return dayProblems > 0 ? 1 : missing > 0 ? 3 : 0;
  } catch (e) {
    // Anything unexpected is "cannot run" too, so 1 always means a content problem.
    console.error(`cannot run: ${e instanceof CannotRun ? e.message : (e as Error).stack ?? String(e)}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
