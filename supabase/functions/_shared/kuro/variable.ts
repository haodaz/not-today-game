// The variable layer (kuro-chat additions 2026-11-02). Kuro is never trained: every turn the server
// assembles one context object from (content, memory, stored judgements, the run's seed, day,
// locale) and the game changes only content and this object. Three parts:
//   locked — red-blue lines and layered answers, enforced in code, not only in the prompt;
//   dice   — from the seed (runId, day): a mood notch, a free-line allowance, the glyph script;
//            and per question the d100 with thresholds that move with the bucket;
//   scores — the affinity bucket, folded from the stored judgements as the ending folds them.
// Randomness lives here, never in the model; the model never sees the seed, the roll or the word.
// Pure. Imports carry `.ts` (Deno).
import type { Asked, Bucket, KuroContent, KuroDayContent, LayeredAnswer, Memory, StarterContent, StoredJudgement, Taboo, ChatLocale } from "./types.ts";

// ——— scores: the bucket ———

/** The bucket boundaries: low < 30 ≤ mid < threshold (60, the ending's) ≤ high. */
export const MID_FROM = 30;
export const DEFAULT_THRESHOLD = 60;
const ORDER: readonly Bucket[] = ["low", "mid", "high"];

export function bucketOf(affinity: number, threshold = DEFAULT_THRESHOLD): Bucket {
  return affinity >= threshold ? "high" : affinity >= MID_FROM ? "mid" : "low";
}

/** A starter with `minBucket` is open to this bucket and above. */
export const bucketAllows = (min: Bucket, bucket: Bucket): boolean => ORDER.indexOf(bucket) >= ORDER.indexOf(min);

/**
 * Affinity from the stored judgements, exactly as the client folds them: in day order, each day's
 * delta (as stored, else (truth + values + bond) × perPoint, × the multiplier on a tender day),
 * clamped to 0..100 at every step.
 */
export function affinityFrom(rows: readonly StoredJudgement[], a: NonNullable<KuroContent["affinity"]>): number {
  let affinity = 0;
  for (const r of [...rows].sort((x, y) => x.day - y.day)) {
    const base = (r.truth + r.values + r.bond) * a.perPoint;
    const delta = typeof r.delta === "number" ? r.delta : a.tenderDays.includes(r.day) ? base * a.tenderMultiplier : base;
    affinity = Math.min(100, Math.max(0, affinity + delta));
  }
  return affinity;
}

// ——— dice ———

/** FNV-1a, 32 bit (the same as the game's src/state/seed.ts). */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: one number in [0, 1) for a seed. */
export function unit(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [min, max], fixed for `key`. */
export function roll(key: string, min: number, max: number): number {
  return min + Math.floor(unit(hash(key)) * (max - min + 1));
}

/**
 * The scripts the unreadable word is made from (the correction: one non-Latin, non-CJK script,
 * never mixed). Code-point ranges of letters only.
 */
export const GLYPH_SCRIPTS: readonly { readonly name: string; readonly from: number; readonly to: number }[] = [
  { name: "vai", from: 0xa500, to: 0xa60b },
  { name: "ogham", from: 0x1681, to: 0x169a },
  { name: "glagolitic", from: 0x2c00, to: 0x2c2e },
];

export interface Dice {
  /** 0–3: how many words it spends today (0 the fewest). */
  readonly mood: number;
  /** Whether it may add one sentence of its own today. */
  readonly freeLine: boolean;
  /** Which script the day's unreadable word would be made from. */
  readonly script: (typeof GLYPH_SCRIPTS)[number];
}

/** The day's dice from the run's seed. Same run, same day: the same values. */
export function dice(runId: string, day: number): Dice {
  return {
    mood: roll(`${runId}:${day}:mood`, 0, 3),
    freeLine: roll(`${runId}:${day}:free-line`, 0, 1) === 1,
    script: GLYPH_SCRIPTS[roll(`${runId}:${day}:script`, 0, GLYPH_SCRIPTS.length - 1)]!,
  };
}

/** The d100 before a locked layered answer: stable per (run, day, question). */
export const d100 = (runId: string, day: number, q: number): number => roll(`${runId}:${day}:q${q}:d100`, 1, 100);

/** The moving thresholds: 大成功 at or under `success`, 大失败 at or over `failFrom`. */
export const THRESHOLDS: Readonly<Record<Bucket, { readonly success: number; readonly failFrom: number }>> = {
  low: { success: 1, failFrom: 85 },
  mid: { success: 3, failFrom: 96 },
  high: { success: 8, failFrom: 100 },
};

export type Outcome = "success" | "failure" | "plain";

export function outcomeOf(r: number, bucket: Bucket): Outcome {
  const t = THRESHOLDS[bucket];
  return r <= t.success ? "success" : r >= t.failFrom ? "failure" : "plain";
}

/** The unreadable word: 3–5 letters of the day's script, seeded by (run, day, question). */
export function glyphWord(runId: string, day: number, q: number): string {
  const { script } = dice(runId, day);
  const n = roll(`${runId}:${day}:q${q}:len`, 3, 5);
  return Array.from({ length: n }, (_, i) => String.fromCodePoint(roll(`${runId}:${day}:q${q}:g${i}`, script.from, script.to))).join("");
}

// ——— locked ———

/** How a typed line is compared with a starter: no spaces, no punctuation, no case. */
const norm = (s: string): string => s.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");

/**
 * Whether the pool shows this starter: open to the bucket and, for a follow-up (`after`), its
 * question already asked — on any day when `day` is null (the pool's ids are global, 2026-11-09),
 * else on the day it names.
 */
export function starterOpen(s: StarterContent, bucket: Bucket, asked: readonly Asked[], _today: number): boolean {
  if (!bucketAllows(s.minBucket, bucket)) return false;
  if (!s.after) return true;
  const onDay = s.after.day;
  return asked.some((a) => a.q === s.after!.q && (onDay === null || a.day === onDay));
}

/** The questions asked so far, from the log's chat events (any day). */
export function askedFrom(events: readonly { readonly kind: string; readonly day: number; readonly q?: unknown }[]): Asked[] {
  return events.flatMap((e) => (e.kind === "chat" && typeof e.q === "number" ? [{ day: e.day, q: e.q }] : []));
}

/**
 * The starter this turn asks, if it is open: the client's `q`, else a typed line that is a
 * starter's text in either language. A closed starter unlocks nothing.
 */
export function openStarter(d: KuroDayContent | undefined, bucket: Bucket, q: number | null, said: string, asked: readonly Asked[] = [], today = d?.day ?? 0): StarterContent | null {
  const starters = d?.starters ?? [];
  const s = q !== null ? starters.find((x) => x.n === q) : starters.find((x) => norm(x.zh) === norm(said) || (x.en !== "" && norm(x.en) === norm(said)));
  return s && starterOpen(s, bucket, asked, today) ? s : null;
}

export interface Locked {
  readonly q: number;
  /** The locked text for this bucket, said verbatim. */
  readonly text: string;
  /** A layered answer (it rolls the d100); else a red-blue line (it does not). */
  readonly layered: boolean;
  /** The high tier's taboo, when this bucket is high. */
  readonly taboo?: Taboo;
}

/**
 * The locked text for the question and bucket. A zh turn says the zh layered tier when content has
 * one (kuro-zh-answers R2); the taboo is always the English line's. Red-blue lines stay English.
 */
export function lockedFor(d: KuroDayContent | undefined, q: number, bucket: Bucket, locale: ChatLocale = "en"): Locked | null {
  const layered: LayeredAnswer | undefined = d?.layered?.find((l) => l.unlock === q);
  const text = (l: LayeredAnswer) => (locale === "zh" && l.zh ? l.zh[bucket] : l[bucket]);
  if (layered) return { q, text: text(layered), layered: true, ...(bucket === "high" && layered.taboo ? { taboo: layered.taboo } : {}) };
  const red = d?.locked?.find((l) => l.unlock === q);
  return red ? { q, text: red.text, layered: false } : null;
}

/** A taboo already fired today (one per day). */
export const tabooToday = (m: Memory, day: number): boolean => m.turns.some((t) => t.day === day && t.taboo !== undefined);

// ——— the object ———

export interface LayerInput {
  readonly content: KuroContent;
  readonly day: number;
  readonly locale: ChatLocale;
  readonly runId: string;
  readonly memory: Memory;
  /** From the stored judgements (`affinityFrom`). */
  readonly affinity: number;
  /** The starter number the client sent, if the player picked one. */
  readonly q: number | null;
  readonly said: string;
  /** The questions asked so far (`askedFrom(events)`): a follow-up unlocks only after its question. */
  readonly asked?: readonly Asked[];
}

export interface Layer {
  readonly bucket: Bucket;
  readonly dice: Dice;
  readonly locked: Locked | null;
  /** The d100, only before a layered answer. */
  readonly roll: number | null;
  readonly outcome: Outcome | null;
  /** What the client plays; null almost always. */
  readonly taboo: Taboo | null;
  /** 大成功: the server-made word (never shown to the model). */
  readonly glyph: string | null;
  /** 大成功: the locked follow-up in the reply's locale (null when content has none). */
  readonly followup: string | null;
}

/** The whole object for one turn. Pure in its input. */
export function variableLayer(i: LayerInput): Layer {
  const bucket = bucketOf(i.affinity, i.content.affinity?.threshold ?? DEFAULT_THRESHOLD);
  const dayDice = dice(i.runId, i.day);
  const d = i.content.days[String(i.day)];
  const starter = openStarter(d, bucket, i.q, i.said, i.asked ?? [], i.day);
  const locked = starter ? lockedFor(d, starter.n, bucket, i.locale) : null;
  const none = { bucket, dice: dayDice, locked, roll: null, outcome: null, taboo: null, glyph: null, followup: null };
  if (!locked || !locked.layered) return none;
  const r = d100(i.runId, i.day, locked.q);
  // One taboo per day: after it fires, later rolls that day return the plain locked line.
  if (tabooToday(i.memory, i.day)) return { ...none, roll: r, outcome: "plain" };
  const outcome = outcomeOf(r, bucket);
  if (outcome === "success") {
    const followup = i.content.unreadable?.[i.locale] ?? null;
    return { ...none, roll: r, outcome, taboo: "blood", glyph: glyphWord(i.runId, i.day, locked.q), followup };
  }
  if (outcome === "failure") return { ...none, roll: r, outcome, taboo: "flicker" };
  return { ...none, roll: r, outcome, taboo: locked.taboo ?? null };
}

/**
 * The model's reply with the locked text enforced: it must begin with the locked text verbatim
 * (then whatever it continues with stays); a reply that omits or alters it is the locked text alone.
 */
export function enforceLocked(reply: string, locked: Locked): { text: string; rest: string } {
  const r = reply.trimStart();
  if (!r.startsWith(locked.text)) return { text: locked.text, rest: "" };
  return { text: locked.text, rest: r.slice(locked.text.length) };
}

/** What the player reads: the locked text, on 大成功 the word and the follow-up as their own lines, then the rest. */
export function composeReply(layer: Layer, enforced: { text: string; rest: string }): string {
  const lines = [enforced.text];
  if (layer.glyph) lines.push(layer.glyph);
  if (layer.glyph && layer.followup) lines.push(layer.followup);
  const head = lines.join("\n");
  const rest = enforced.rest.trim();
  return rest ? `${head}${layer.glyph ? "\n" : enforced.rest.startsWith("\n") ? "\n" : " "}${rest}` : head;
}

/** The "Today" block's lines the layer adds (the model sees derived values only). */
export function layerLines(layer: Layer): string[] {
  const out = [
    `Your opinion of this player: ${layer.bucket}`,
    `Mood notch today: ${layer.dice.mood} of 3 (0: spend the fewest words; 3: the most)`,
    `Free line today: ${layer.dice.freeLine ? "yes" : "no"} (whether you may add one sentence of your own beyond what you are asked)`,
  ];
  if (layer.locked) out.push(`Locked line for this turn: begin your reply with exactly this text, unchanged and in its own language, then continue in your own words if you like: «${layer.locked.text}»`);
  return out;
}
