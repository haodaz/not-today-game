// The parts of content/kuro-days/day-NN.md that the variable layer needs (kuro-chat additions
// 2026-11-02), parsed once for the bundler and the client: the starter questions with their
// optional `minBucket`, the red-blue locked lines, and the optional `## Layered answers`. Pure, no
// Deno, no Node. A file without the new parts parses exactly as before (no minBucket = low; no
// layered answers = none). Imports carry `.ts` (Deno).
import type { Bucket, LayeredAnswer, LockedLine, StarterContent, Taboo } from "./types.ts";

export const BUCKETS: readonly Bucket[] = ["low", "mid", "high"];
export const TABOOS: readonly Taboo[] = ["blood", "blur", "flicker", "errors"];

function fail(label: string, problem: string): never {
  throw new Error(`content/kuro-days ${label}: ${problem}`);
}

/**
 * A `## <title…>` section's lines (heading excluded), or null when there is none. The heading may
 * carry a note after the title (`## Offline answers (constants; …)`); `zh` picks the Chinese twin
 * (`## <title> (zh)…`) instead, and the plain lookup never matches the twin (kuro-zh-answers R1).
 */
export function sectionLines(text: string, title: string, zh = false): string[] | null {
  const lines = text.split("\n");
  const head = `## ${title}`;
  const start = lines.findIndex((l) => {
    if (!l.startsWith(head)) return false;
    const rest = l.slice(head.length);
    if (rest !== "" && !rest.startsWith(" ")) return false; // another title that begins the same
    return rest.trimStart().startsWith("(zh)") === zh;
  });
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines.slice(start + 1, end < 0 ? undefined : end);
}

/**
 * The starter table: `| # | zh | en | hard | minBucket |`; the fifth cell is optional and may be
 * blank, `low|mid|high`, or `minBucket: low|mid|high`.
 */
export function parseStarters(text: string, label: string): StarterContent[] {
  const lines = sectionLines(text, "Starter questions") ?? fail(label, "no starter questions section");
  const out: StarterContent[] = [];
  for (const raw of lines) {
    const cells = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(raw.trim());
    if (!cells) continue;
    const [zh = "", en = "", hard = "", min = ""] = cells[2]!.split("|").map((c) => c.trim());
    if (!zh) fail(label, `starter ${cells[1]} has no zh text`);
    const m = /^(?:minBucket:\s*)?(low|mid|high)?$/.exec(min);
    if (!m) fail(label, `starter ${cells[1]}: minBucket must be low, mid or high, got "${min}"`);
    out.push({ n: Number(cells[1]), zh, en, hard: hard.toLowerCase() === "yes", minBucket: (m[1] as Bucket | undefined) ?? "low" });
  }
  if (!out.length) fail(label, "no starter questions");
  return out;
}

/** `## Red-blue lines`: `- unlock: qN → "…"` (or `- none`). */
export function parseLockedLines(text: string, label: string): LockedLine[] {
  const out: LockedLine[] = [];
  for (const raw of sectionLines(text, "Red-blue lines") ?? []) {
    const line = raw.trim();
    if (!line.startsWith("- ") || line === "- none") continue;
    // Only a starter unlock (`qN`) is the turn's: others (after 「Beautiful」, the credits) unlock elsewhere.
    if (!/^- unlock: q\d+ →/.test(line)) continue;
    const m = /^- unlock: q(\d+) → "(.+)"$/.exec(line);
    if (!m) fail(label, `unreadable red-blue line: ${line}`);
    out.push({ unlock: Number(m[1]), text: m[2]! });
  }
  return out;
}

/** `## Layered answers`: `- unlock: qN → low: "…" | mid: "…" | high: "…"`, optionally `| taboo: blood|blur|flicker|errors`. */
export function parseLayered(text: string, label: string): LayeredAnswer[] {
  const out: LayeredAnswer[] = [];
  for (const raw of sectionLines(text, "Layered answers") ?? []) {
    const line = raw.trim();
    if (!line.startsWith("- ") || line === "- none") continue;
    const m = /^- unlock: q(\d+) → low: "(.+?)" \| mid: "(.+?)" \| high: "(.+?)"(?: \| taboo: (\w+))?$/.exec(line);
    if (!m) fail(label, `unreadable layered answer: ${line}`);
    const taboo = m[5];
    if (taboo !== undefined && !(TABOOS as readonly string[]).includes(taboo)) fail(label, `unknown taboo "${taboo}" (one of ${TABOOS.join(", ")})`);
    out.push({ unlock: Number(m[1]), low: m[2]!, mid: m[3]!, high: m[4]!, ...(taboo ? { taboo: taboo as Taboo } : {}) });
  }
  return out;
}

/** One zh layered line: the English form without a taboo. */
type LayeredZh = { readonly unlock: number; readonly low: string; readonly mid: string; readonly high: string };

/**
 * `## Layered answers (zh)` (kuro-zh-answers R1): `- unlock: qN → low: "…" | mid: "…" | high: "…"`;
 * the taboo stays on the English line, so a zh line carrying one fails. Null when there is no section.
 */
export function parseLayeredZh(text: string, label: string): LayeredZh[] | null {
  const lines = sectionLines(text, "Layered answers", true);
  if (lines === null) return null;
  const out: LayeredZh[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("- ") || line === "- none") continue;
    if (/ \| taboo: \w+$/.test(line)) fail(label, `a zh layered answer carries a taboo (it stays on the English line): ${line}`);
    const m = /^- unlock: q(\d+) → low: "(.+?)" \| mid: "(.+?)" \| high: "(.+?)"$/.exec(line);
    if (!m) fail(label, `unreadable zh layered answer: ${line}`);
    out.push({ unlock: Number(m[1]), low: m[2]!, mid: m[3]!, high: m[4]! });
  }
  return out;
}

/** The same set of question numbers, or fail naming the first difference. */
export function sameSet(label: string, what: string, en: readonly string[], zh: readonly string[]): void {
  const e = new Set(en);
  const z = new Set(zh);
  if (z.size !== zh.length) fail(label, `${what} (zh): two lines for one question`);
  for (const k of z) if (!e.has(k)) fail(label, `${what} (zh): ${k} has no English line`);
  for (const k of e) if (!z.has(k)) fail(label, `${what} (zh): no line for ${k}, which the English has`);
}

/**
 * All of it, with the cross-checks: every unlock names a starter; one layered answer per question;
 * a zh layered section has the English one's set of unlocks, and each zh tier rides on its line.
 */
export function parseVariableParts(text: string, label: string): { starters: StarterContent[]; locked: LockedLine[]; layered: LayeredAnswer[] } {
  const starters = parseStarters(text, label);
  const locked = parseLockedLines(text, label);
  const english = parseLayered(text, label);
  const known = new Set(starters.map((s) => s.n));
  for (const l of [...locked, ...english]) if (!known.has(l.unlock)) fail(label, `an unlock on q${l.unlock}, which is not a starter`);
  if (new Set(english.map((l) => l.unlock)).size !== english.length) fail(label, "two layered answers for one question");
  const zh = parseLayeredZh(text, label);
  if (zh === null) return { starters, locked, layered: english };
  sameSet(label, "layered answers", english.map((l) => `q${l.unlock}`), zh.map((l) => `q${l.unlock}`));
  const layered = english.map((l) => {
    const z = zh.find((x) => x.unlock === l.unlock)!;
    return { ...l, zh: { low: z.low, mid: z.mid, high: z.high } };
  });
  return { starters, locked, layered };
}
