// Strings: zh.json is the source language, en.json the localisation. A key missing from both
// renders as ⟦key⟧ (visible on purpose) and is recorded, so a test can list what content lacks.
import en from "@content/strings/en.json";
import zh from "@content/strings/zh.json";
import { setReplyLocale } from "@state/replies/locale";
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
  // The reply tables show their English twin (content/replies/en/) under the same switch.
  setReplyLocale(next);
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
