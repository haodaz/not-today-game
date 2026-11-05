// opening R2 (2026-11-04): content/prologue.json (Claude's) is the dream before day 1: `{ _note, say:
// Line[] }`, with the day beats' line shape (narration / speaker / inner, optional backdrop and prop;
// no `where`: it plays where it is shown). content/en/prologue.json is its twin: the same lines, the
// same kinds, speakers, backdrops and props; only the text differs. Read strictly, checked against
// each other, frozen. Nothing here is an event or state: it is played in the box and forgotten.
import zhRaw from "@content/prologue.json";
import enRaw from "@content/en/prologue.json";
import { bilingual } from "./content-locale";
import { parseLine, type SayLine } from "./days/table";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const failer =
  (file: string) =>
  (where: string, problem: string): never => {
    throw new Error(`content/${file} ${where}: ${problem}`);
  };

/** One file: `{ _note?, say }`, the lines strict (no `where`). */
export function parsePrologue(input: unknown, file = "prologue.json"): readonly SayLine[] {
  const fail = failer(file);
  if (!isRecord(input)) fail("", "not an object");
  const raw = input as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (k !== "_note" && k !== "say") fail("top level", `unknown key "${k}"`);
  if (raw._note !== undefined && typeof raw._note !== "string") fail("_note", "must be a string");
  if (!Array.isArray(raw.say) || raw.say.length === 0) fail("say", "must be a non-empty list");
  return Object.freeze(
    (raw.say as unknown[]).map((v, i) => {
      const line = parseLine(v, `say[${i}]`, fail, true);
      if (line.where !== undefined) fail(`say[${i}].where`, "the prologue plays where it is shown (no where)");
      return Object.freeze(line);
    }),
  );
}

/**
 * The Chinese lines, their text swapped to the English twin's under lang=en. The twin must match
 * line for line: the count, each kind, speaker (`who`), backdrop, prop and sfx.
 */
export function localisePrologue(zh: readonly SayLine[], en: readonly SayLine[]): readonly SayLine[] {
  const fail = failer("en/prologue.json");
  if (zh.length !== en.length) fail("say", `${en.length} lines, the Chinese has ${zh.length}`);
  return Object.freeze(
    zh.map((z, i) => {
      const e = en[i]!;
      const w = `say[${i}]`;
      if (z.k !== e.k) fail(w, `kind "${e.k}", the Chinese has "${z.k}"`);
      if (z.who !== e.who) fail(`${w}.who`, `speaker ${JSON.stringify(e.who)}, the Chinese has ${JSON.stringify(z.who)}`);
      if (z.backdrop !== e.backdrop) fail(`${w}.backdrop`, "differs from the Chinese");
      if (z.prop !== e.prop) fail(`${w}.prop`, "differs from the Chinese");
      if (z.sfx !== e.sfx) fail(`${w}.sfx`, "differs from the Chinese");
      return Object.freeze(bilingual(z, { t: e.t }));
    }),
  );
}

/** The prologue as the game plays it (both files checked at import). */
export const prologueLines: readonly SayLine[] = localisePrologue(parsePrologue(zhRaw), parsePrologue(enRaw, "en/prologue.json"));
