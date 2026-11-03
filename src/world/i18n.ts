// Strings: zh.json is the source language, en.json the localisation. A key missing from both
// renders as ⟦key⟧ (visible on purpose) and is recorded, so a test can list what content lacks.
import en from "@content/strings/en.json";
import zh from "@content/strings/zh.json";
import { setReplyLocale } from "@state/replies/locale";
import { setContentLocale } from "@state/content-locale";
import { html, type SafeHtml } from "./html";

export type Locale = "zh" | "en";

const tables: Record<Locale, Record<string, string>> = {
  zh: zh as Record<string, string>,
  en: en as Record<string, string>,
};

let locale: Locale = "zh";
const missing = new Set<string>();

export function setLocale(next: Locale): void {
  locale = next;
  // The reply tables and the content tables (days/tasks/objects) show their English twins under the
  // same switch.
  setReplyLocale(next);
  setContentLocale(next);
}

/** The cross-run language choice (title-page FR6): a localStorage key, outside the run save. */
const LANG_KEY = "nt_lang";

/** `s` is a locale, else undefined. */
function asLocale(s: string | null | undefined): Locale | undefined {
  return s === "zh" || s === "en" ? s : undefined;
}

/**
 * Remember the language across runs (title-page FR6): write it to localStorage under `nt_lang`, so
 * the next boot opens in the same language. Storage may be absent or throw (private mode); a failure
 * is silent — the choice just is not remembered.
 */
export function persistLocale(next: Locale, storage?: Pick<Storage, "setItem">): void {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  try {
    store?.setItem(LANG_KEY, next);
  } catch {
    // Storage disabled or full: the choice is not remembered, which is fine.
  }
}

/** The language `nt_lang` last held, or undefined. Storage access is wrapped (it may throw). */
export function storedLocale(storage?: Pick<Storage, "getItem">): Locale | undefined {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  try {
    return asLocale(store?.getItem(LANG_KEY));
  } catch {
    return undefined;
  }
}

/**
 * The language a boot opens in (title-page FR6): `?lang=` wins (a shared link's choice), then the
 * remembered `nt_lang`, then English (the README default). `search` is the URL query.
 */
export function initialLocale(search: string, storage?: Pick<Storage, "getItem">): Locale {
  const fromUrl = asLocale(new URLSearchParams(search).get("lang"));
  return fromUrl ?? storedLocale(storage) ?? "en";
}

/** A string in one particular locale (no fallback to the other), or undefined. */
export function stringIn(l: Locale, key: string): string | undefined {
  return key.startsWith("_") ? undefined : tables[l][key];
}

export function getLocale(): Locale {
  return locale;
}

function lookup(key: string): string | undefined {
  if (key.startsWith("_")) return undefined;
  // The chosen locale first; English falls back to Chinese, Chinese to English.
  return tables[locale][key] ?? tables[locale === "zh" ? "en" : "zh"][key];
}

function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function hasString(key: string): boolean {
  return lookup(key) !== undefined;
}

/** Every key under `prefix` (either locale), sorted: for families like `error.*` that content grows. */
export function keysWith(prefix: string): string[] {
  return [...new Set([...Object.keys(tables.zh), ...Object.keys(tables.en)])].filter((k) => k.startsWith(prefix)).sort();
}

/** Plain text (for attributes). Missing keys come back as ⟦key⟧. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const text = lookup(key);
  if (text === undefined) {
    missing.add(key);
    return `⟦${key}⟧`;
  }
  return fill(text, vars);
}

/** Markup for element content: a missing key is wrapped so it shows as missing. */
export function tr(key: string, vars?: Record<string, string | number>): SafeHtml {
  const text = lookup(key);
  if (text === undefined) {
    missing.add(key);
    return html`<span class="missing" data-missing="${key}">⟦${key}⟧</span>`;
  }
  return html`${fill(text, vars)}`;
}

/** Every key asked for that neither table has, since the last reset. */
export function missingKeys(): string[] {
  return [...missing].sort();
}

export function resetMissing(): void {
  missing.clear();
}
