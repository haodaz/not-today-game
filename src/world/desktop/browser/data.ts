/// <reference types="vite/client" />
// content/browser/day-NN.json (Claude's): one newspaper page per day. Read, checked, frozen.
// Every field may be an empty string; empty renders as empty (white). A reading entry may carry
// `kuroCloses` + `kuroClosesLine` (late-days FR4; src/state/closes.ts).
import { parseKuroCloses, type KuroCloses } from "@state/closes";
import { getLocale } from "@world/i18n";

export interface BrowserPage {
  readonly day: number;
  readonly site: string;
  readonly weather: string;
  readonly lead: { readonly h: string; readonly p: readonly string[] };
  readonly numbers: readonly { readonly v: string; readonly l: string; readonly dir: "up" | "down" | "" }[];
  readonly reading: readonly ReadingEntry[];
  readonly note?: string;
}

/** A 读者在读 entry; from the late ring it may be one Kuro closes (late-days FR4). */
export interface ReadingEntry extends Partial<KuroCloses> {
  readonly h: string;
  readonly sec: string;
  readonly when: string;
}

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/browser ${where}: ${problem}`);
}

function onlyKeys(value: Raw, keys: readonly string[], where: string): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(where, `unknown key "${key}"`);
  for (const key of keys) if (!OPTIONAL.has(key) && !(key in value)) fail(where, `missing "${key}"`);
}

/** Keys a file may leave out. */
const OPTIONAL = new Set(["note", "kuroCloses", "kuroClosesLine"]);

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
        onlyKeys(x, ["h", "sec", "when", "kuroCloses", "kuroClosesLine"], w);
        const closes = parseKuroCloses(x, (field, problem) => fail(`${w}.${field}`, problem));
        return Object.freeze({ h: str(x.h, `${w}.h`), sec: str(x.sec, `${w}.sec`), when: str(x.when, `${w}.when`), ...(closes ?? {}) });
      }),
    ),
    ...(raw.note !== undefined ? { note: str(raw.note, `${label}.note`) } : {}),
  });
}

const files = import.meta.glob("../../../../content/browser/day-*.json", { eager: true, import: "default" });
// The English paper (2026-11-28; until then the English build showed the Chinese one): content/browser/en/,
// written in script/tools/gen-browser-en.mjs, the same shape day for day.
const enFiles = import.meta.glob("../../../../content/browser/en/day-*.json", { eager: true, import: "default" });

function load(found: Record<string, unknown>, prefix: string): ReadonlyMap<number, BrowserPage> {
  const pages = new Map<number, BrowserPage>();
  for (const [path, raw] of Object.entries(found)) {
    const label = prefix + path.slice(path.lastIndexOf("/") + 1);
    const page = parseBrowserPage(raw, label);
    const fromName = Number(/day-(\d+)\.json$/.exec(label)?.[1]);
    if (page.day !== fromName) fail(label, `file name says day ${fromName}, content says ${page.day}`);
    pages.set(page.day, page);
  }
  return new Map([...pages].sort(([a], [b]) => a - b));
}

/**
 * The two papers are one paper: the same days, and on each day the same number of paragraphs, numbers
 * and reading entries, the same arrows, the same entries Kuro closes, and the same cells left blank
 * (a blank is part of the page: day 17 is one sentence and one number in both). Exported for tests.
 */
export function checkBrowserTwins(zh: ReadonlyMap<number, BrowserPage>, en: ReadonlyMap<number, BrowserPage>): void {
  const blank = (s: string): boolean => s === "";
  const shape = (p: BrowserPage): string =>
    JSON.stringify([blank(p.weather), blank(p.lead.h), p.lead.p.map(blank), p.numbers.map((n) => [blank(n.v), blank(n.l), n.dir]), p.reading.map((r) => [blank(r.h), blank(r.sec), blank(r.when), r.kuroCloses === true])]);
  if (zh.size !== en.size) fail("en/", `has ${String(en.size)} days, the Chinese has ${String(zh.size)}`);
  for (const [day, page] of zh) {
    const twin = en.get(day);
    if (!twin) fail("en/", `no day ${String(day)}`);
    if (shape(page) !== shape(twin)) fail(`en/day-${String(day).padStart(2, "0")}.json`, "its shape differs from the Chinese (paragraphs, numbers, arrows, reading entries, blanks, what Kuro closes)");
  }
}

export const browserPages: ReadonlyMap<number, BrowserPage> = load(files, "");
export const browserPagesEn: ReadonlyMap<number, BrowserPage> = load(enFiles, "en/");
checkBrowserTwins(browserPages, browserPagesEn);

/** Tests only: pages to read instead of content/browser (e.g. the late-days fixture). */
let override: ReadonlyMap<number, BrowserPage> | null = null;
export function setBrowserPagesForTests(pages: ReadonlyMap<number, BrowserPage> | null): void {
  override = pages;
}

/** The page for a day; the README says day 1 stands in until a day's page exists. */
export function browserPage(day: number): BrowserPage | undefined {
  const own = getLocale() === "en" ? browserPagesEn : browserPages;
  return (override ?? own).get(day) ?? own.get(day) ?? own.get(1);
}

export type WeatherKind = "rain" | "fog" | "clear";

/** The header's weather kind from the page's weather text (null when none matches). */
export function weatherKind(text: string): WeatherKind | null {
  const en = text.toLowerCase();
  if (text.includes("雨") || en.includes("rain")) return "rain";
  if (text.includes("雾") || en.includes("fog")) return "fog";
  if (text.includes("晴") || en.includes("clear")) return "clear";
  return null;
}
