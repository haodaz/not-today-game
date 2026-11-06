// The content quality gates (tech.md "Quality gates"), runnable from the shell and from the hooks.
//   node scripts/validate-content.ts                 both checks below
//   node scripts/validate-content.ts --days [files]  content/days/day-*.json (or the files given)
//   node scripts/validate-content.ts --strings       keys in zh.json missing from en.json
//   node scripts/validate-content.ts --objects       content/objects.json + en twin: 2–4 options, ≤ 1 right
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
const OBJECTS = join(ROOT, "content/objects.json");
const OBJECTS_EN = join(ROOT, "content/en/objects.json");

/** Every day has these beats. */
const CORE_BEATS = ["boot", "desk", "shutdown", "night"] as const;
/** `box` is the fifth: present exactly on the days an object arrives (stages.json objectsFoundOnDay). */
const ALL_BEATS = ["boot", "rise", "box", "desk", "shutdown", "night"];
/** lying-view R6: `rise` is optional (what is seen on getting up); any day may have it. */
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
    // The objects' days, and the hidden box's day (blind-box: its 邮单 has a box beat too).
    boxDays: new Set([...Object.values(found), stages.hiddenBoxDay].filter((d): d is number => typeof d === "number")),
  };
}

/** The day files' line kinds (src/state/days/table.ts LINE_KINDS). */
const LINE_KINDS = ["narration", "inner", "sfx", "speaker"];
/** The basic shape of one dialogue line: a known kind, a text, `who` on a speaker line. */
function lineProblems(l: unknown): string[] {
  if (!isRecord(l)) return ["a line must be an object"];
  const out: string[] = [];
  if (!LINE_KINDS.includes(l.k as string)) out.push(`unknown line kind ${JSON.stringify(l.k)} (${LINE_KINDS.join(", ")})`);
  if (typeof l.t !== "string" || l.t === "") out.push("t: expected a non-empty string");
  if (l.k === "speaker" && (typeof l.who !== "string" || l.who === "")) out.push("a speaker line needs `who`");
  return out;
}

/** An object's question has 2–4 options; `right` on at most one (recognise, author 2026-11-06). */
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 4;

/** Problems in content/objects.json or its English twin, as "where: what" lines. */
export function checkObjects(raw: unknown, label: string): string[] {
  const out: string[] = [];
  const say = (where: string, what: string) => out.push(`${label} ${where}: ${what}`);
  if (!isRecord(raw) || !isRecord(raw.objects)) return [`${label}: needs an "objects" object`];
  for (const [id, v] of Object.entries(raw.objects)) {
    const w = `objects.${id}`;
    if (!isRecord(v)) {
      say(w, "must be an object");
      continue;
    }
    if (!Array.isArray(v.options)) {
      say(`${w}.options`, "must be a list");
      continue;
    }
    if (v.options.length < OPTIONS_MIN || v.options.length > OPTIONS_MAX) say(`${w}.options`, `has ${v.options.length} options, must have ${OPTIONS_MIN}–${OPTIONS_MAX}`);
    const rights = v.options.filter((o) => isRecord(o) && o.right === true).length;
    if (rights > 1) say(`${w}.options`, `${rights} options are right, at most one may be`);
    v.options.forEach((o, i) => {
      if (!isRecord(o)) return say(`${w}.options[${i}]`, "must be an object");
      if (o.right !== undefined && typeof o.right !== "boolean") say(`${w}.options[${i}].right`, "must be true or false");
      if (o.say !== undefined && (!Array.isArray(o.say) || o.say.length === 0 || !o.say.every((s) => typeof s === "string" && s !== ""))) say(`${w}.options[${i}].say`, "must be a non-empty list of strings");
      if (o.inner !== undefined && o.say === undefined) say(`${w}.options[${i}].inner`, "needs the option's own say");
    });
  }
  return out;
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
    // lying-view R6: `rise` is lines only.
    if (beats.rise !== undefined) {
      if (!isRecord(beats.rise) || !Array.isArray(beats.rise.say)) say("beats.rise", "must be { say: [...] }");
      else for (const k of Object.keys(beats.rise)) if (k !== "say" && k !== "where") say(`beats.rise.${k}`, "not a key of a rise beat (say, where)");
    }
    const boxDay = t.boxDays.has(fromName);
    if (boxDay && beats.box === undefined) say("beats.box", `missing (an object arrives on day ${fromName})`);
    if (!boxDay && beats.box !== undefined) say("beats.box", `present, but no object arrives on day ${fromName}`);
  }

  // A choice's own lines (night-hand, author 2026-11-06): only on the shutdown beat's choices; a
  // non-empty list of lines (the loader's parseLine is the full authority).
  if (isRecord(beats)) {
    for (const [b, seq] of Object.entries(beats)) {
      if (!isRecord(seq) || !Array.isArray(seq.choices)) continue;
      seq.choices.forEach((c, i) => {
        if (!isRecord(c) || c.say === undefined) return;
        const p = `beats.${b}.choices[${i}].say`;
        if (b !== "shutdown") return say(p, "only a shutdown choice may have its own say");
        if (!Array.isArray(c.say) || c.say.length === 0) return say(p, "must be a non-empty list of lines");
        c.say.forEach((l, j) => {
          for (const problem of lineProblems(l)) say(`${p}[${j}]`, problem);
        });
      });
    }
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

function runObjects(): number {
  let problems = 0;
  for (const file of [OBJECTS, OBJECTS_EN]) {
    const found = checkObjects(readJson(file, "objects"), rel(file));
    for (const line of found) console.log(line);
    problems += found.length;
  }
  console.log(`objects: 2 files, ${problems} problem${problems === 1 ? "" : "s"}`);
  return problems;
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
  const unknown = flags.filter((f) => f !== "--days" && f !== "--strings" && f !== "--objects");
  if (unknown.length) {
    console.error(`unknown option ${unknown.join(", ")} (use --days [files], --strings, --objects)`);
    return 2;
  }
  const both = flags.length === 0;
  const days = both || flags.includes("--days");
  const strings = both || flags.includes("--strings");
  const objects = both || flags.includes("--objects");
  try {
    const t = loadTables();
    const dayProblems = days ? runDays(dayFilesFrom(files), t) : 0;
    const objectProblems = objects ? runObjects() : 0;
    const missing = strings ? runStrings(t) : 0;
    return dayProblems > 0 || objectProblems > 0 ? 1 : missing > 0 ? 3 : 0;
  } catch (e) {
    // Anything unexpected is "cannot run" too, so 1 always means a content problem.
    console.error(`cannot run: ${e instanceof CannotRun ? e.message : (e as Error).stack ?? String(e)}`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
