// The question pool (author 2026-11-09: 「一定要有个总的池子看所有问题，从第一天到第几天有效」).
// One file, content/kuro-pool.md, holds every question Kuro can be asked in the run: a fixed id, the
// days it is in the pool (from–to), the words in both languages, the gate (bucket, follow-up), and
// either the three tiers (zh + en) or a red-blue locked line. A question whose answer has changed
// in kind is another entry with another id. The per-day files keep only the day's idiom, stance,
// free line and notes. Pure; no Deno, no Node. Imports carry `.ts` (Deno).
//
//   ## 104 · 你叫什么？克总是我们给你起的。
//   - en: What's your name? Kuro is what we call you.
//   - days: 1–3            (a single day: `days: 4`)
//   - hard: yes            (optional)
//   - bucket: mid          (optional: low | mid | high; low when absent)
//   - after: 102           (optional: in the pool only once question 102 was asked, on any day)
//   - taboo: blur          (optional: the high tier's)
//   - locked: "…"          (a red-blue line, said as written; or:)
//   - tiers: low: "…" | mid: "…" | high: "…"
//   - tiers (zh): low: "…" | mid: "…" | high: "…"
import type { Bucket, LayeredAnswer, LockedLine, StarterContent, Taboo } from "./types.ts";
import { BUCKETS, TABOOS } from "./dayfile.ts";

export interface PoolEntry {
  readonly id: number;
  readonly zh: string;
  readonly en: string;
  readonly from: number;
  readonly to: number;
  readonly hard: boolean;
  readonly minBucket: Bucket;
  readonly after?: number;
  readonly taboo?: Taboo;
  readonly locked?: string;
  readonly tiers?: { readonly low: string; readonly mid: string; readonly high: string };
  readonly tiersZh?: { readonly low: string; readonly mid: string; readonly high: string };
}

function fail(id: number | string, problem: string): never {
  throw new Error(`content/kuro-pool.md ${id}: ${problem}`);
}

const TIERS = /^low: "(.+?)" \| mid: "(.+?)" \| high: "(.+?)"$/;

/** Parses the pool strictly: every `## <id> · <zh>` heading opens an entry; its `- key: value` lines fill it. */
export function parsePool(text: string): PoolEntry[] {
  const out: PoolEntry[] = [];
  let cur: Record<string, string> | null = null;
  let curId = 0;
  const flush = () => {
    if (!cur) return;
    const c = cur;
    const id = curId;
    if (!c.en) fail(id, "no en line");
    const d = /^(\d+)(?:\s*[–-]\s*(\d+))?$/.exec(c.days ?? "");
    if (!d) fail(id, `days must be A–B or A, got "${c.days ?? ""}"`);
    const from = Number(d[1]);
    const to = d[2] !== undefined ? Number(d[2]) : from;
    if (from < 1 || to < from) fail(id, `bad days ${from}–${to}`);
    const bucket = (c.bucket ?? "low") as Bucket;
    if (!BUCKETS.includes(bucket)) fail(id, `bucket must be low, mid or high, got "${c.bucket}"`);
    const taboo = c.taboo as Taboo | undefined;
    if (taboo !== undefined && !TABOOS.includes(taboo)) fail(id, `unknown taboo "${taboo}"`);
    const hasTiers = c.tiers !== undefined;
    const hasLocked = c.locked !== undefined;
    if (hasTiers === hasLocked) fail(id, "exactly one of tiers / locked");
    if (hasLocked && c["tiers (zh)"] !== undefined) fail(id, "a locked line has no zh tiers (it stays English)");
    if (taboo && !hasTiers) fail(id, "a taboo needs tiers");
    let tiers: PoolEntry["tiers"];
    let tiersZh: PoolEntry["tiersZh"];
    if (hasTiers) {
      const m = TIERS.exec(c.tiers!);
      if (!m) fail(id, `unreadable tiers: ${c.tiers}`);
      tiers = { low: m[1]!, mid: m[2]!, high: m[3]! };
      if (c["tiers (zh)"] !== undefined) {
        const z = TIERS.exec(c["tiers (zh)"]!);
        if (!z) fail(id, `unreadable zh tiers: ${c["tiers (zh)"]}`);
        tiersZh = { low: z[1]!, mid: z[2]!, high: z[3]! };
      }
    }
    let locked: string | undefined;
    if (hasLocked) {
      const m = /^"(.+)"$/.exec(c.locked!);
      if (!m) fail(id, `locked must be a quoted line: ${c.locked}`);
      locked = m[1]!;
    }
    const after = c.after !== undefined ? Number(c.after) : undefined;
    if (after !== undefined && !(Number.isInteger(after) && after > 0)) fail(id, `after must be an id, got "${c.after}"`);
    if (out.some((e) => e.id === id)) fail(id, "two entries with this id");
    out.push({
      id,
      zh: c.zh!,
      en: c.en,
      from,
      to,
      hard: (c.hard ?? "no").toLowerCase() === "yes",
      minBucket: bucket,
      ...(after !== undefined ? { after } : {}),
      ...(taboo ? { taboo } : {}),
      ...(locked !== undefined ? { locked } : {}),
      ...(tiers ? { tiers } : {}),
      ...(tiersZh ? { tiersZh } : {}),
    });
    cur = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const h = /^## (\d+) · (.+)$/.exec(line);
    if (h) {
      flush();
      curId = Number(h[1]);
      cur = { zh: h[2]!.trim() };
      continue;
    }
    if (!cur) continue;
    const kv = /^- ([a-z]+(?: \(zh\))?): (.*)$/.exec(line.trim());
    if (!kv) {
      if (line.trim().startsWith("- ")) fail(curId, `unreadable line: ${line.trim()}`);
      continue;
    }
    if (cur[kv[1]!] !== undefined) fail(curId, `two "${kv[1]}" lines`);
    cur[kv[1]!] = kv[2]!.trim();
  }
  flush();
  // A follow-up names an entry that exists and is not itself.
  for (const e of out) if (e.after !== undefined && (e.after === e.id || !out.some((o) => o.id === e.after))) fail(e.id, `after ${e.after}, which is not another entry`);
  return out;
}

/** The entries in the pool on `day`. */
export const poolOn = (pool: readonly PoolEntry[], day: number): PoolEntry[] => pool.filter((e) => e.from <= day && day <= e.to);

/** The day's parts as the variable layer reads them (the id is the starter's number). */
export function poolDay(pool: readonly PoolEntry[], day: number): { starters: StarterContent[]; locked: LockedLine[]; layered: LayeredAnswer[] } {
  const on = poolOn(pool, day);
  return {
    starters: on.map((e) => ({ n: e.id, zh: e.zh, en: e.en, hard: e.hard, minBucket: e.minBucket, ...(e.after !== undefined ? { after: { day: null, q: e.after } } : {}) })),
    locked: on.flatMap((e) => (e.locked !== undefined ? [{ unlock: e.id, text: e.locked }] : [])),
    layered: on.flatMap((e) => (e.tiers ? [{ unlock: e.id, ...e.tiers, ...(e.taboo ? { taboo: e.taboo } : {}), ...(e.tiersZh ? { zh: e.tiersZh } : {}) }] : [])),
  };
}
