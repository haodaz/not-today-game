// Which language the content tables (days, tasks, objects) show their text in (dialogue addition
// 2026-11-02: English twins). Display only, exactly like replies/locale.ts: an English twin has the
// same shape as the Chinese source (checked at load), so nothing the state derives depends on this.
// world/i18n's setLocale sets it; state code never reads it except through a bilingual field.
export type ContentLocale = "zh" | "en";

let current: ContentLocale = "zh";

export const contentLocale = (): ContentLocale => current;

export function setContentLocale(next: ContentLocale): void {
  current = next;
}

/**
 * A copy of `zh` whose listed text keys read the English twin's text under `lang=en`, the Chinese
 * otherwise. A key whose English value is undefined stays Chinese (a per-field fall-back). The
 * object keeps every other field as-is. Used by the day, task and object loaders.
 */
export function bilingual<T extends object>(zh: T, en: Partial<Record<keyof T, string>>): T {
  const out = { ...zh } as Record<string, unknown>;
  for (const key of Object.keys(en)) {
    const enText = en[key as keyof T];
    if (enText === undefined) continue;
    const zhText = out[key];
    Object.defineProperty(out, key, { enumerable: true, get: () => (current === "en" ? enText : zhText) });
  }
  return out as T;
}

/**
 * Like `bilingual`, but each listed key is a whole value (a string, a string[], or a nested
 * structure) that is swapped for the English one under `lang=en`. For fields the twin may localise
 * that are not plain strings (a doc's clause array, a ledger's rows).
 */
export function bilingualValues<T extends object>(zh: T, en: Partial<Record<keyof T, unknown>>): T {
  const out = { ...zh } as Record<string, unknown>;
  for (const key of Object.keys(en)) {
    const enVal = en[key as keyof T];
    if (enVal === undefined) continue;
    const zhVal = out[key];
    Object.defineProperty(out, key, { enumerable: true, get: () => (current === "en" ? enVal : zhVal) });
  }
  return out as T;
}
