/// <reference types="vite/client" />
// content/kuro-days/day-NN.md (Claude's): the day's idiom (a constant, never generated) and the
// starter questions. Read as text, parsed strictly, never rewritten.

export interface StarterQuestion {
  readonly n: number;
  readonly zh: string;
  readonly en: string;
  readonly hard: boolean;
}

/** The constant answers used when there is no model (dialogue spec): by question, and to free text. */
export interface OfflineAnswers {
  readonly q: ReadonlyMap<number, string>;
  readonly free: string | null;
}

export interface KuroDay {
  readonly day: number;
  readonly idiom: string;
  readonly starters: readonly StarterQuestion[];
  readonly answers: OfflineAnswers;
}

const IDIOM = /^\*\*Idiom of the day \(constant\):\*\*\s*(.+?)\s*$/m;

/** The text of a `## <title>` section up to the next `## `, or null. */
function section(text: string, title: string): string | null {
  const start = text.indexOf(`## ${title}`);
  if (start < 0) return null;
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  return end < 0 ? rest : rest.slice(0, end);
}

/** `- qN → "…"` and `- free text → "…"` (strict: any other arrow line in the section fails). */
function parseAnswers(text: string, label: string): OfflineAnswers {
  const body = section(text, "Offline answers");
  const q = new Map<number, string>();
  let free: string | null = null;
  if (body === null) return { q, free };
  for (const raw of body.split("\n").slice(1)) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const m = /^- (?:q(\d+)|(free text)) → "(.*)"$/.exec(line);
    if (!m) throw new Error(`content/kuro-days ${label}: unreadable offline answer: ${line}`);
    const answer = m[3]!;
    if (!answer.trim()) throw new Error(`content/kuro-days ${label}: an empty offline answer`);
    if (m[2]) {
      if (free !== null) throw new Error(`content/kuro-days ${label}: two free-text answers`);
      free = answer;
      continue;
    }
    const n = Number(m[1]);
    if (q.has(n)) throw new Error(`content/kuro-days ${label}: two answers to q${n}`);
    q.set(n, answer);
  }
  return { q, free };
}

/** Kuro's constant answer to starter `n` (or typed text when n is null): the question's, else the free one, else the idiom. */
export function offlineAnswer(day: KuroDay, n: number | null): string {
  return (n !== null ? day.answers.q.get(n) : undefined) ?? day.answers.free ?? day.idiom;
}

/** Parses one day file. Pure; exported for tests. */
export function parseKuroDay(text: string, label: string): KuroDay {
  const dayMatch = /^#\s*Day\s+(\d+)\s*$/m.exec(text);
  if (!dayMatch) throw new Error(`content/kuro-days ${label}: no "# Day N" heading`);
  const idiom = IDIOM.exec(text)?.[1];
  if (!idiom) throw new Error(`content/kuro-days ${label}: no idiom line`);

  const start = text.indexOf("## Starter questions");
  if (start < 0) throw new Error(`content/kuro-days ${label}: no starter questions section`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  const section = end < 0 ? rest : rest.slice(0, end);
  const starters: StarterQuestion[] = [];
  for (const line of section.split("\n")) {
    const cells = /^\|\s*(\d+)\s*\|(.*)\|\s*$/.exec(line.trim());
    if (!cells) continue;
    const [zh = "", en = "", hard = ""] = cells[2]!.split("|").map((c) => c.trim());
    if (!zh) throw new Error(`content/kuro-days ${label}: starter ${cells[1]} has no zh text`);
    starters.push({ n: Number(cells[1]), zh, en, hard: hard.toLowerCase() === "yes" });
  }
  if (!starters.length) throw new Error(`content/kuro-days ${label}: no starter questions`);
  const answers = parseAnswers(text, label);
  for (const n of answers.q.keys()) {
    if (!starters.some((s) => s.n === n)) throw new Error(`content/kuro-days ${label}: an offline answer to q${n}, which is not a starter`);
  }
  return Object.freeze({ day: Number(dayMatch[1]), idiom, starters: Object.freeze(starters), answers });
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
