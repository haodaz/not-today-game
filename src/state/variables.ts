// Loads content/variables.json. The table is Claude's; this module only reads it.
// It provides the defaults, the engine constants and a validator. It never copies a value
// out of the table into code.
import table from "@content/variables.json";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Engine constants, read from `constants` in variables.json. Never hardcode these. */
export const constants = table.constants;

interface VariableEntry {
  type: string;
  range?: (number | null)[];
  values?: string[];
  of?: string[];
  fields?: Record<string, string>;
  default: Json;
}

const raw = table as unknown as Record<string, unknown>;

/** Names of every state variable, in table order. Nothing else exists. */
export const variableNames: readonly string[] = Object.keys(raw).filter(
  (key) => key !== "constants" && !key.startsWith("_"),
);

function entryOf(name: string): VariableEntry {
  const entry = raw[name] as VariableEntry | undefined;
  if (!entry || typeof entry.type !== "string" || !("default" in entry)) {
    throw new Error(`variables.json: variable "${name}" has no type or no default`);
  }
  return entry;
}

/** The allowed members of a `set`/`subset` variable (its `of` list), or undefined if it has none. */
export function membersOf(name: string): readonly string[] | undefined {
  return entryOf(name).of;
}

/** The declared `[min, max]` of a numeric variable (null = unbounded), or undefined if none. */
export function rangeOf(name: string): readonly [number | null, number | null] | undefined {
  const range = entryOf(name).range;
  return range ? [range[0] ?? null, range[1] ?? null] : undefined;
}

/** A fresh copy of every variable's default. Callers may mutate the result freely. */
export function defaults(): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const name of variableNames) {
    out[name] = structuredClone(entryOf(name).default);
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasDuplicates(list: unknown[]): boolean {
  return new Set(list.map((item) => JSON.stringify(item))).size !== list.length;
}

/** Returns a description of what is wrong with `value`, or null if it is valid. */
function problemWith(entry: VariableEntry, value: unknown): string | null {
  const head = entry.type.split("<")[0] ?? entry.type;
  switch (head) {
    case "int":
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "expected a finite number";
      if (head === "int" && !Number.isInteger(value)) return "expected an integer";
      const [min, max] = entry.range ?? [null, null];
      if (typeof min === "number" && value < min) return `below minimum ${min}`;
      if (typeof max === "number" && value > max) return `above maximum ${max}`;
      return null;
    }
    case "bool":
      return typeof value === "boolean" ? null : "expected a boolean";
    case "string|null":
      return value === null || typeof value === "string" ? null : "expected a string or null";
    case "enum":
      return typeof value === "string" && (entry.values ?? []).includes(value)
        ? null
        : `expected one of ${JSON.stringify(entry.values)}`;
    case "set":
    case "subset":
    case "list": {
      if (!Array.isArray(value)) return "expected an array";
      if (head !== "list" && hasDuplicates(value)) return "set contains duplicates";
      if (entry.of) {
        const bad = value.find((item) => !entry.of!.includes(item as string));
        if (bad !== undefined) return `member ${JSON.stringify(bad)} is not in the allowed set`;
      }
      return null;
    }
    case "map":
      return isPlainObject(value) ? null : "expected an object (map)";
    case "object": {
      if (!isPlainObject(value)) return "expected an object";
      for (const field of Object.keys(entry.fields ?? {})) {
        if (!(field in value)) return `missing field "${field}"`;
      }
      return null;
    }
    default:
      return `unknown variable type "${entry.type}" in variables.json`;
  }
}

/**
 * Checks every variable against its declared type and range, and rejects missing or unknown
 * variables. Throws an Error naming the offending key.
 */
export function validate(state: Record<string, unknown>): void {
  for (const key of Object.keys(state)) {
    if (!variableNames.includes(key)) {
      throw new Error(`state.${key}: not a variable in variables.json`);
    }
  }
  for (const name of variableNames) {
    if (!(name in state)) throw new Error(`state.${name}: missing`);
    const problem = problemWith(entryOf(name), state[name]);
    if (problem) throw new Error(`state.${name}: ${problem}`);
  }
}
