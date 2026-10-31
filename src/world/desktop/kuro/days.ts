/// <reference types="vite/client" />
// content/kuro-days/day-NN.md (Claude's): the day's idiom (a constant, never generated) and the
// starter questions. Read as text, parsed strictly, never rewritten.

export interface StarterQuestion {
  readonly n: number;
  readonly zh: string;
  readonly en: string;
  readonly hard: boolean;
}

export interface KuroDay {
  readonly day: number;
  readonly idiom: string;
  readonly starters: readonly StarterQuestion[];
}

const IDIOM = /^\*\*Idiom of the day \(constant\):\*\*\s*(.+?)\s*$/m;

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
  return Object.freeze({ day: Number(dayMatch[1]), idiom, starters: Object.freeze(starters) });
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
