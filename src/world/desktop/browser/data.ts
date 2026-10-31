/// <reference types="vite/client" />
// content/browser/day-NN.json (Claude's): one newspaper page per day. Read, checked, frozen.
// Every field may be an empty string; empty renders as empty (white).

export interface BrowserPage {
  readonly day: number;
  readonly site: string;
  readonly weather: string;
  readonly lead: { readonly h: string; readonly p: readonly string[] };
  readonly numbers: readonly { readonly v: string; readonly l: string; readonly dir: "up" | "down" | "" }[];
  readonly reading: readonly { readonly h: string; readonly sec: string; readonly when: string }[];
  readonly note?: string;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/browser ${where}: ${problem}`);
}

function onlyKeys(value: Raw, keys: readonly string[], where: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(where, `unknown key "${key}"`);
  for (const key of keys) if (key !== "note" && !(key in value)) fail(where, `missing "${key}"`);
}

const str = (v: unknown, where: string): string => (typeof v === "string" ? v : fail(where, "expected a string"));

function list<T>(v: unknown, where: string, item: (x: unknown, w: string) => T): T[] {
  if (!Array.isArray(v)) fail(where, "expected a list");
  return v.map((x, i) => item(x, `${where}[${i}]`));
}

/** Parses one day file. Pure; exported for tests. */
export function parseBrowserPage(raw: unknown, label: string): BrowserPage {
  if (!isRecord(raw)) fail(label, "not an object");
  onlyKeys(raw, ["day", "site", "weather", "lead", "numbers", "reading", "note"], label);
  if (!Number.isInteger(raw.day)) fail(label, "day must be an integer");
  if (!isRecord(raw.lead)) fail(`${label}.lead`, "must be an object");
  onlyKeys(raw.lead, ["h", "p"], `${label}.lead`);
  return Object.freeze({
    day: raw.day as number,
    site: str(raw.site, `${label}.site`),
    weather: str(raw.weather, `${label}.weather`),
    lead: Object.freeze({ h: str(raw.lead.h, `${label}.lead.h`), p: Object.freeze(list(raw.lead.p, `${label}.lead.p`, str)) }),
    numbers: Object.freeze(
      list(raw.numbers, `${label}.numbers`, (x, w) => {
        if (!isRecord(x)) fail(w, "must be an object");
        onlyKeys(x, ["v", "l", "dir"], w);
        const dir = str(x.dir, `${w}.dir`);
        if (!["up", "down", ""].includes(dir)) fail(w, `dir must be up, down or empty, got "${dir}"`);
        return Object.freeze({ v: str(x.v, `${w}.v`), l: str(x.l, `${w}.l`), dir: dir as "up" | "down" | "" });
      }),
    ),
    reading: Object.freeze(
      list(raw.reading, `${label}.reading`, (x, w) => {
        if (!isRecord(x)) fail(w, "must be an object");
        onlyKeys(x, ["h", "sec", "when"], w);
        return Object.freeze({ h: str(x.h, `${w}.h`), sec: str(x.sec, `${w}.sec`), when: str(x.when, `${w}.when`) });
      }),
    ),
    ...(raw.note !== undefined ? { note: str(raw.note, `${label}.note`) } : {}),
  });
}

const files = import.meta.glob("../../../../content/browser/day-*.json", { eager: true, import: "default" });

export const browserPages: ReadonlyMap<number, BrowserPage> = (() => {
  const pages = new Map<number, BrowserPage>();
  for (const [path, raw] of Object.entries(files)) {
    const label = path.slice(path.lastIndexOf("/") + 1);
    const page = parseBrowserPage(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (page.day !== fromName) fail(label, `file name says day ${fromName}, content says ${page.day}`);
    pages.set(page.day, page);
  }
  return new Map([...pages].sort(([a], [b]) => a - b));
})();

/** The page for a day; the README says day 1 stands in until a day's page exists. */
export function browserPage(day: number): BrowserPage | undefined {
  return browserPages.get(day) ?? browserPages.get(1);
}

export type WeatherKind = "rain" | "fog" | "clear";

/** The header's weather kind from the page's weather text (null when none matches). */
export function weatherKind(text: string): WeatherKind | null {
  if (text.includes("雨")) return "rain";
  if (text.includes("雾")) return "fog";
  if (text.includes("晴")) return "clear";
  return null;
}
