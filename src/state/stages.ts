// Reads content/stages.json (Claude's file). Every function here is a pure lookup over the
// table. Stage values, rings and day lists are never written as literals in code.
import stages from "@content/stages.json";

interface Cycle {
  days: number[];
  ring: string;
  replaced: string | null;
}

const byDay = stages.byDay as Record<string, number>;
const nightBeats = stages.nightBeat as Record<string, string>;

/** Cycles in day order, without the `_note` key. */
const cycles: Cycle[] = Object.entries(stages.cycles as Record<string, unknown>)
  .filter(([id]) => !id.startsWith("_"))
  .map(([, cycle]) => cycle as Cycle)
  .sort((a, b) => Math.min(...a.days) - Math.min(...b.days));

function assertDay(day: number): void {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError(`day must be an integer >= 1, got ${day}`);
  }
}

/** Mechanical stage for a day. After the last tabled day this is `afterDay18`. */
export function stageOf(day: number): number {
  assertDay(day);
  return byDay[String(day)] ?? stages.afterDay18;
}

/** The cycle (three-day block) containing `day`; after the last cycle, the last cycle. */
export function cycleOf(day: number): Cycle {
  assertDay(day);
  const found = cycles.find((cycle) => cycle.days.includes(day));
  if (found) return found;
  const last = cycles[cycles.length - 1];
  if (last && day > Math.max(...last.days)) return last;
  throw new Error(`stages.json: day ${day} is not in any cycle`);
}

/** How far the daytime corruption has spread on this day (derived, not a state variable). */
export function ringOf(day: number): string {
  return cycleOf(day).ring;
}

/** Daytime presentation only is rendered as stage 0 on these days. */
export function isCalmDaytime(day: number): boolean {
  return stages.calmDaytime.days.includes(day);
}

/** The day the new world is kindest while the room collapses. */
export function isTenderDay(day: number): boolean {
  return day === stages.tenderDay.day;
}

/** The kind of night beat for a day, or null past the last tabled night. */
export function nightBeatOf(day: number): string | null {
  assertDay(day);
  return nightBeats[String(day)] ?? null;
}

/** The nights on which a dream plays. */
export const dreamNights: readonly number[] = stages.dreamNights.nights;

// ——— weather (day-loop addition 2026-11-02: it does not rain every day) ———

/** The kinds content may give a day (`weather.byDay`); strings `weather.<kind>`. */
export const WEATHERS = ["rain", "overcast", "fog", "clear", "stopped", "white"] as const;
export type Weather = (typeof WEATHERS)[number];
const weatherByDay: Readonly<Record<string, Weather>> = (() => {
  const raw = (stages as { weather?: { byDay?: Record<string, unknown> } }).weather?.byDay;
  if (!raw || typeof raw !== "object") throw new Error("stages.json weather.byDay: missing");
  const out: Record<string, Weather> = {};
  for (const [day, w] of Object.entries(raw)) {
    if (!/^[1-9]\d*$/.test(day)) throw new Error(`stages.json weather.byDay: "${day}" is not a day`);
    if (!(WEATHERS as readonly unknown[]).includes(w)) throw new Error(`stages.json weather.byDay.${day}: unknown weather "${String(w)}"`);
    out[day] = w as Weather;
  }
  for (const day of Object.keys(byDay)) if (!(day in out)) throw new Error(`stages.json weather.byDay: day ${day} has no weather`);
  return out;
})();
/** The day's weather (after the last day: the last day's). */
export function weatherOf(day: number): Weather {
  const days = Object.keys(weatherByDay).map(Number);
  return weatherByDay[String(day)] ?? weatherByDay[String(Math.max(...days))]!;
}
