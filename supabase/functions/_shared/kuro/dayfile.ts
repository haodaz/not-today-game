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

/** A `## <title…>` section's lines (heading excluded), or null when there is none. */
function sectionLines(text: string, title: string): string[] | null {
  const start = text.indexOf(`## ${title}`);
  if (start < 0) return null;
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  return (end < 0 ? rest : rest.slice(0, end)).split("\n").slice(1);
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

/** All three, with the cross-checks: every unlock names a starter; one layered answer per question. */
export function parseVariableParts(text: string, label: string): { starters: StarterContent[]; locked: LockedLine[]; layered: LayeredAnswer[] } {
  const starters = parseStarters(text, label);
  const locked = parseLockedLines(text, label);
  const layered = parseLayered(text, label);
  const known = new Set(starters.map((s) => s.n));
  for (const l of [...locked, ...layered]) if (!known.has(l.unlock)) fail(label, `an unlock on q${l.unlock}, which is not a starter`);
  if (new Set(layered.map((l) => l.unlock)).size !== layered.length) fail(label, "two layered answers for one question");
  return { starters, locked, layered };
}
