/// <reference types="vite/client" />
// content/kuro-days/day-NN.md (Claude's): the day's idiom (a constant, never generated) and the
// starter questions. Read as text, parsed strictly, never rewritten.
import { parseVariableParts, sameSet, sectionLines } from "@kuro/dayfile.ts";
import { parsePool, poolDay, type PoolEntry } from "@kuro/pool.ts";
import type { Bucket, LayeredAnswer, LockedLine } from "@kuro/types.ts";
import { contentLocale } from "@state/content-locale";
import poolText from "../../../../content/kuro-pool.md?raw";

/** The whole question pool (content/kuro-pool.md): every question of the run with its days and answers. */
export const kuroPool: readonly PoolEntry[] = Object.freeze(parsePool(poolText));

export interface StarterQuestion {
  readonly n: number;
  readonly zh: string;
  readonly en: string;
  readonly hard: boolean;
  /** The lowest bucket the question is shown to (kuro-chat 2026-11-02); low unless content says. */
  readonly minBucket: Bucket;
  /** A follow-up (2026-11-09): in the pool only after question `q` was asked today (`day` null) or on day `day`. */
  readonly after?: { readonly day: number | null; readonly q: number };
}

/** The constant answers used when there is no model (dialogue spec): by question, and to free text. */
export interface OfflineAnswers {
  readonly q: ReadonlyMap<number, string>;
  readonly free: string | null;
  /** `## Offline answers (zh)` (kuro-zh-answers R1): the same answers in Chinese, or null when absent. */
  readonly zh: { readonly q: ReadonlyMap<number, string>; readonly free: string | null } | null;
}

export interface KuroDay {
  readonly day: number;
  readonly idiom: string;
  readonly starters: readonly StarterQuestion[];
  readonly answers: OfflineAnswers;
  /** Every quoted line of `## Red-blue lines`, whatever unlocks it (kuro-zh-answers R4: the uncanny ones). */
  readonly redBlue: readonly string[];
  /** The deterministic core (2026-11-09): the red-blue lines by starter, and the three-tier answers (zh twin inside). */
  readonly locked: readonly LockedLine[];
  readonly layered: readonly LayeredAnswer[];
}

/** `## Red-blue lines`: the quoted text of each `- … → "…"` line (`- none` and prose skipped). */
function parseRedBlue(text: string): string[] {
  return (sectionLines(text, "Red-blue lines") ?? []).flatMap((raw) => {
    const m = /^- .*→ "(.+)"$/.exec(raw.trim());
    return m ? [m[1]!] : [];
  });
}

const IDIOM = /^\*\*Idiom of the day \(constant\):\*\*\s*(.+?)\s*$/m;

/** One section's `- qN → "…"` and `- free text → "…"` (strict: any other arrow line in the section fails). */
function parseAnswerLines(lines: readonly string[], label: string, zh: boolean): { q: Map<number, string>; free: string | null } {
  const tag = zh ? "zh offline answer" : "offline answer";
  const twoOf = zh ? "zh answers" : "answers";
  const q = new Map<number, string>();
  let free: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const m = /^- (?:q(\d+)|(free text)) → "(.*)"$/.exec(line);
    if (!m) throw new Error(`content/kuro-days ${label}: unreadable ${tag}: ${line}`);
    const answer = m[3]!;
    if (!answer.trim()) throw new Error(`content/kuro-days ${label}: an empty ${tag}`);
    if (m[2]) {
      if (free !== null) throw new Error(`content/kuro-days ${label}: two free-text ${twoOf}`);
      free = answer;
      continue;
    }
    const n = Number(m[1]);
    if (q.has(n)) throw new Error(`content/kuro-days ${label}: two ${twoOf} to q${n}`);
    q.set(n, answer);
  }
  return { q, free };
}

/** `## Offline answers` and its optional `(zh)` twin, which must answer the same questions (and free text if the English does). */
function parseAnswers(text: string, label: string): OfflineAnswers {
  const enLines = sectionLines(text, "Offline answers");
  const en = enLines === null ? { q: new Map<number, string>(), free: null } : parseAnswerLines(enLines, label, false);
  const zhLines = sectionLines(text, "Offline answers", true);
  if (zhLines === null) return { ...en, zh: null };
  const zh = parseAnswerLines(zhLines, label, true);
  const keys = (a: { q: Map<number, string>; free: string | null }) => [...[...a.q.keys()].map((n) => `q${n}`), ...(a.free !== null ? ["free text"] : [])];
  sameSet(label, "offline answers", keys(en), keys(zh));
  return { ...en, zh };
}

/**
 * Kuro's constant answer to starter `n` (or typed text when n is null): the question's, else the
 * free one, else the idiom. Under the zh content locale the `(zh)` twin's when the day has one
 * (kuro-zh-answers R2); English otherwise.
 */
export function offlineAnswer(day: KuroDay, n: number | null): string {
  const a = contentLocale() === "zh" && day.answers.zh ? day.answers.zh : day.answers;
  return (n !== null ? a.q.get(n) : undefined) ?? a.free ?? day.idiom;
}

/**
 * Parses one day file. Pure; exported for tests. The questions, red-blue lines and tiers come from
 * the pool for that day (2026-11-09) unless the file carries its own table (tests do).
 */
export function parseKuroDay(text: string, label: string, pool: readonly PoolEntry[] = kuroPool): KuroDay {
  const dayMatch = /^#\s*Day\s+(\d+)\s*$/m.exec(text);
  if (!dayMatch) throw new Error(`content/kuro-days ${label}: no "# Day N" heading`);
  const idiom = IDIOM.exec(text)?.[1];
  if (!idiom) throw new Error(`content/kuro-days ${label}: no idiom line`);

  // The starters (with minBucket), red-blue and layered parts: the same parser as the function's bundle.
  const own = parseVariableParts(text, label);
  const { starters, locked, layered } = own.starters.length ? own : poolDay(pool, Number(dayMatch[1]));
  const answers = parseAnswers(text, label);
  for (const n of answers.q.keys()) {
    if (!starters.some((s) => s.n === n)) throw new Error(`content/kuro-days ${label}: an offline answer to q${n}, which is not a starter`);
  }
  return Object.freeze({ day: Number(dayMatch[1]), idiom, starters: Object.freeze(starters), answers, redBlue: Object.freeze(parseRedBlue(text)), locked: Object.freeze(locked), layered: Object.freeze(layered) });
}

const files = import.meta.glob("../../../../content/kuro-days/day-*.md", { eager: true, query: "?raw", import: "default" });

export const kuroDays: ReadonlyMap<number, KuroDay> = (() => {
  const days = new Map<number, KuroDay>();
  for (const [path, text] of Object.entries(files)) {
    const label = path.slice(path.lastIndexOf("/") + 1);
    const day = parseKuroDay(text as string, label);
    const fromName = Number(/day-(\d+)\.md$/.exec(label)?.[1]);
    if (day.day !== fromName) throw new Error(`content/kuro-days ${label}: file name says day ${fromName}, heading says ${day.day}`);
    days.set(day.day, day);
  }
  return new Map([...days].sort(([a], [b]) => a - b));
})();

export function kuroDay(day: number): KuroDay | undefined {
  return kuroDays.get(day);
}
