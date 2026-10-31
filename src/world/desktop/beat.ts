// Time of day for the desktop (design U1). The day engine is not written yet; until it is, the
// desktop holds this small clock as session state (never game state). Time is story time, HH:MM.

export const BEATS = ["boot", "work", "afternoon", "desk", "night"] as const;
export type Beat = (typeof BEATS)[number];

export interface BeatClock {
  readonly beat: Beat;
  readonly time: string;
}

/** The mock's first screen: day 1, morning, 09:03. */
export const DEFAULT_CLOCK: BeatClock = { beat: "boot", time: "09:03" };

/** How long a line due later in the day takes to arrive on screen, in real milliseconds. */
export const BEAT_STEP_MS = 1_200;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(text: string): boolean {
  return HHMM.test(text);
}

/** Debug params beside `?day=N`: `?beat=night&t=23:41`. Invalid values are ignored. */
export function parseBeatParams(search: string, base: BeatClock = DEFAULT_CLOCK): BeatClock {
  const params = new URLSearchParams(search);
  const beat = params.get("beat");
  const time = params.get("t");
  return {
    beat: beat && (BEATS as readonly string[]).includes(beat) ? (beat as Beat) : base.beat,
    time: time && isTime(time) ? time : base.time,
  };
}

/** Moves the clock forward to `time` (never back). */
export function advanceTo(clock: BeatClock, time: string): BeatClock {
  return time > clock.time ? { ...clock, time } : clock;
}

export const isNight = (clock: BeatClock): boolean => clock.beat === "night";

export const beatLabelKey = (beat: Beat): string => `shell.beat.${beat}`;

/** The workbench greeting for the time of day. */
export function greetingKey(beat: Beat): string {
  if (beat === "boot" || beat === "work") return "wb.hello.morning";
  if (beat === "afternoon") return "wb.hello.afternoon";
  return "wb.hello.evening";
}
