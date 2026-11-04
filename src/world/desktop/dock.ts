// The decoy apps on the dock (desktop-ui addition 2026-11-02). content/dock.json is Claude's file:
// read, checked, frozen. The loader is strict so a new key is noticed instead of ignored. The
// decoys have no function: no events, no state. `dockFor(day)` is the pure view of the file.
import raw from "@content/dock.json";
import { getLocale, type Locale } from "@world/i18n";

/** A line in both languages; the file carries them inline (no strings keys). */
export interface Pair {
  readonly zh: string;
  readonly en: string;
}

export interface KuroLine {
  readonly from: number;
  readonly to: number;
  readonly text: Pair;
}

export interface DockApp {
  readonly id: string;
  readonly icon: string;
  readonly name: Pair;
  readonly window: Pair | null;
  readonly kuro: readonly KuroLine[];
  readonly gone: { readonly fromDay: number; readonly text: Pair } | null;
}

/** One decoy tile as it is on `day`, in one language. */
export interface DockEntry {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  /** The app is removed: the tile stays and opens the admin notice (in `window`). */
  readonly gone: boolean;
  /** The text of the small system window, or null if the click opens none. */
  readonly window: string | null;
  /** What Kuro says on a click today, or null (nothing matches, or the app is gone). */
  readonly kuro: string | null;
}

const REAL_APPS = ["msgs", "tingtalk", "workbench", "browser"];

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);

function fail(where: string, problem: string): never {
  throw new Error(`content/dock.json ${where}: ${problem}`);
}

function onlyKeys(v: Raw, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(v)) if (!allowed.includes(key)) fail(where, `unknown key "${key}"`);
}

function text(v: unknown, where: string): string {
  if (typeof v !== "string" || v.trim() === "") fail(where, "expected a non-empty string");
  return v as string;
}

function pair(v: unknown, where: string, extra: readonly string[] = []): Pair {
  if (!isRecord(v)) return fail(where, "expected { zh, en }");
  onlyKeys(v, ["zh", "en", ...extra], where);
  return { zh: text(v.zh, `${where}.zh`), en: text(v.en, `${where}.en`) };
}

function day(v: unknown, where: string): number {
  if (!Number.isInteger(v) || (v as number) < 1) fail(where, "expected a day number >= 1");
  return v as number;
}

function app(v: unknown, where: string): DockApp {
  if (!isRecord(v)) return fail(where, "an app must be an object");
  onlyKeys(v, ["id", "icon", "name", "window", "kuro", "gone"], where);
  const id = text(v.id, `${where}.id`);
  if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`${where}.id`, `"${id}" is not a lowercase id`);
  if (REAL_APPS.includes(id)) fail(`${where}.id`, `"${id}" is one of the real apps`);
  const icon = text(v.icon, `${where}.icon`);
  if (!/^\/os\/[a-z0-9-]+\.svg$/.test(icon)) fail(`${where}.icon`, `"${icon}" is not /os/<name>.svg`);

  const kuro: KuroLine[] = [];
  if (v.kuro !== undefined) {
    if (!Array.isArray(v.kuro) || v.kuro.length === 0) fail(`${where}.kuro`, "expected a non-empty list");
    (v.kuro as unknown[]).forEach((entry, i) => {
      const at = `${where}.kuro[${i}]`;
      if (!isRecord(entry)) return fail(at, "must be an object");
      const days = entry.days;
      if (!Array.isArray(days) || days.length !== 2) return fail(`${at}.days`, "expected [from, to]");
      const [from, to] = [day(days[0], `${at}.days[0]`), day(days[1], `${at}.days[1]`)];
      if (from > to) fail(`${at}.days`, `${from} is after ${to}`);
      kuro.push({ from, to, text: pair(entry, at, ["days"]) });
    });
  }

  let gone: DockApp["gone"] = null;
  if (v.gone !== undefined) {
    if (!isRecord(v.gone)) return fail(`${where}.gone`, "expected { fromDay, zh, en }");
    gone = { fromDay: day(v.gone.fromDay, `${where}.gone.fromDay`), text: pair(v.gone, `${where}.gone`, ["fromDay"]) };
  }

  const win = v.window === undefined ? null : pair(v.window, `${where}.window`);
  if (!win && kuro.length === 0 && !gone) fail(where, "does nothing: no window, no kuro line, not gone");
  return { id, icon, name: pair(v.name, `${where}.name`), window: win, kuro, gone };
}

/** Parses and checks a dock file. Pure; exported for tests. */
export function parseDock(input: unknown): readonly DockApp[] {
  if (!isRecord(input)) return fail("", "not an object");
  onlyKeys(input, ["_note", "apps"], "top level");
  if (!Array.isArray(input.apps)) return fail("apps", "must be a list");
  const apps = (input.apps as unknown[]).map((a, i) => app(a, `apps[${i}]`));
  if (new Set(apps.map((a) => a.id)).size !== apps.length) fail("apps", "duplicate id");
  return Object.freeze(apps);
}

export const dockApps: readonly DockApp[] = parseDock(raw);

/** The decoy tiles on `day`, in file order. A removed app keeps its tile and shows its notice. */
export function dockFor(day: number, locale: Locale = getLocale(), apps: readonly DockApp[] = dockApps): DockEntry[] {
  return apps.map((a): DockEntry => {
    const gone = a.gone !== null && a.gone.fromDay <= day;
    const line = gone ? undefined : a.kuro.find((k) => k.from <= day && day <= k.to);
    return {
      id: a.id,
      icon: a.icon,
      name: a.name[locale],
      gone,
      window: gone ? a.gone!.text[locale] : (a.window?.[locale] ?? null),
      kuro: line?.text[locale] ?? null,
    };
  });
}
