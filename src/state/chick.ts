// chick-raising R1: the chick's four stats, derived from the log. A care is the existing `pressKey`
// event with key `chick:<icon>` (appended by src/world/objects/index.ts when the chick's program
// returns `{ care }`). At most CARES_PER_DAY count per day, in any mix; the rest add nothing.
import type { GameEvent } from "./events";

/** The four icons that raise a stat, and which. */
export const CARE_STAT = { meal: "hp", play: "spd", training: "atk", medicine: "def" } as const;
export type CareIcon = keyof typeof CARE_STAT;
export type ChickStat = (typeof CARE_STAT)[CareIcon];
export const CARE_ICONS = Object.keys(CARE_STAT) as readonly CareIcon[];
/** The status screen's order: 攻 防 血 敏. */
export const STAT_ORDER: readonly ChickStat[] = ["atk", "def", "hp", "spd"];
/** Cares that count in one day (author 2026-11-11: ten, any mix). */
export const CARES_PER_DAY = 10;
export const CARE_KEY_PREFIX = "chick:";

export const isCareIcon = (icon: string): icon is CareIcon => Object.prototype.hasOwnProperty.call(CARE_STAT, icon);
export const careKey = (icon: CareIcon): string => `${CARE_KEY_PREFIX}${icon}`;

export type ChickStats = Readonly<Record<ChickStat, number>>;
export interface ChickRaising extends ChickStats {
  /** Cares counted on `day` (0..CARES_PER_DAY). */
  readonly today: number;
}

/** The stats on `day`: every counted care up to and including that day; `today` is that day's count. */
export function chickStats(events: readonly GameEvent[], day: number): ChickRaising {
  const stats: Record<ChickStat, number> = { atk: 0, def: 0, hp: 0, spd: 0 };
  const perDay = new Map<number, number>();
  for (const e of events) {
    if (e.kind !== "pressKey" || e.day > day || !e.key.startsWith(CARE_KEY_PREFIX)) continue;
    const icon = e.key.slice(CARE_KEY_PREFIX.length);
    if (!isCareIcon(icon)) continue;
    const n = perDay.get(e.day) ?? 0;
    if (n >= CARES_PER_DAY) continue;
    perDay.set(e.day, n + 1);
    stats[CARE_STAT[icon]] += 1;
  }
  return { ...stats, today: perDay.get(day) ?? 0 };
}

// ——— chick-fights R1 (author 2026-11-27): feeding is what makes it strong ———

/** The days up to and including `day` on which the chick was given its meal at least once. Cumulative: it never goes down. */
export function chickFedDays(events: readonly GameEvent[], day: number): number {
  const days = new Set<number>();
  const meal = careKey("meal");
  for (const e of events) if (e.kind === "pressKey" && e.key === meal && e.day <= day) days.add(e.day);
  return days.size;
}

/** It was fed on `day`. */
export const chickFedOn = (events: readonly GameEvent[], day: number): boolean =>
  events.some((e) => e.kind === "pressKey" && e.day === day && e.key === careKey("meal"));

/** The chick's fights that ended on `day` (chick-fights R4): how many it won and how many it lost (a run counts as lost). */
export function chickFights(events: readonly GameEvent[], day: number): { readonly won: number; readonly lost: number } {
  let won = 0;
  let lost = 0;
  for (const e of events) {
    if (e.kind !== "boardStep" || e.day !== day || e.op.t !== "chick") continue;
    if (e.op.won) won += 1; else lost += 1;
  }
  return { won, lost };
}
