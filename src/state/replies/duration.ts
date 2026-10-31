// Parses the reply tables' `readAfter` values: "3s", "40s", "2min", "1h", "1d".
// Seconds, minutes and hours are real-time milliseconds. "1d" means "at the next boot".

export type Duration = { kind: "ms"; ms: number } | { kind: "nextBoot" };

const UNIT_MS = { s: 1_000, min: 60_000, h: 3_600_000 } as const;

/** Returns null for anything that is not one of the forms above. */
export function parseDuration(text: string): Duration | null {
  const match = /^(\d+)(s|min|h|d)$/.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] as keyof typeof UNIT_MS | "d";
  if (unit === "d") return amount === 1 ? { kind: "nextBoot" } : null;
  return { kind: "ms", ms: amount * UNIT_MS[unit] };
}
