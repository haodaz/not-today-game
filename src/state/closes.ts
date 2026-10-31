// "Kuro closes what it does not want you to read" (late-days FR4): the two optional content
// fields a browser reading entry or a day item may carry. One parser for both loaders. The line is
// content (Claude's); it is read as written, in zh and en.

export interface KuroCloses {
  readonly kuroCloses: true;
  readonly kuroClosesLine: { readonly zh: string; readonly en: string };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `kuroCloses: true` needs `kuroClosesLine: { zh, en }` (both non-empty), and the line is rejected
 * without it. Absent both: nothing. `fail(field, problem)` throws in the caller's words.
 */
export function parseKuroCloses(v: Record<string, unknown>, fail: (field: string, problem: string) => never): KuroCloses | null {
  const flag = v.kuroCloses;
  const line = v.kuroClosesLine;
  if (flag === undefined && line === undefined) return null;
  if (flag !== true) return fail("kuroCloses", line === undefined ? "must be true when present" : "kuroClosesLine needs kuroCloses: true");
  if (!isRecord(line)) return fail("kuroClosesLine", "kuroCloses needs a line { zh, en }");
  for (const k of Object.keys(line)) if (k !== "zh" && k !== "en") fail("kuroClosesLine", `unknown key "${k}"`);
  const zh = line.zh;
  const en = line.en;
  if (typeof zh !== "string" || !zh.trim()) fail("kuroClosesLine.zh", "must be a non-empty string");
  if (typeof en !== "string" || !en.trim()) fail("kuroClosesLine.en", "must be a non-empty string");
  return Object.freeze({ kuroCloses: true as const, kuroClosesLine: Object.freeze({ zh: zh as string, en: en as string }) });
}

/** The page ids `kuroClosed` carries: `d<day>:reading:<index>` (0-based) or `d<day>:item:<itemId>`. */
export const PAGE_ID = /^d(\d+):(reading:\d+|item:[A-Za-z0-9_-]+)$/;
export const readingPageId = (day: number, index: number): string => `d${day}:reading:${index}`;
export const itemPageId = (day: number, itemId: string): string => `d${day}:item:${itemId}`;
