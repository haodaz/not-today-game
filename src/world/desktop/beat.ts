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

/**
 * Debug params beside `?day=N`: `?beat=night&t=23:41`. Invalid values are ignored. (`&night=1` and
 * `&shutdown=1`, which preview a day's night or shutdown beat, are in world/loop/preview.ts.)
 */
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

/** `time` plus `minutes`, HH:MM, never past 23:59. */
export function plusMinutes(time: string, minutes: number): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const isNight = (clock: BeatClock): boolean => clock.beat === "night";
/** Evening is the `desk` beat on (night falls at 18:30, or earlier if the clock was); before it is day. */
export const isEvening = (clock: Pick<BeatClock, "beat">): boolean => clock.beat === "desk" || clock.beat === "night";

export const beatLabelKey = (beat: Beat): string => `shell.beat.${beat}`;

/**
 * The label next to the clock's time (plain-lines rule: time must hold — 「上午 12:02」 read wrong):
 * during the working beats the label follows the hour (上午 before 12:00, 中午 until 14:00, then
 * 下午); the other beats keep their own names.
 */
export function clockLabelKey(beat: Beat, time: string): string {
  if (beat !== "work" && beat !== "afternoon") return beatLabelKey(beat);
  if (time < "12:00") return "shell.beat.work";
  if (time < "14:00") return "shell.beat.noon";
  return "shell.beat.afternoon";
}

/**
 * guidance R6: the greeting follows the clock: before 12:00 早上好, before 18:00 下午好, then 晚上好
 * (12:04 is 下午好). `time` is the beat clock's HH:MM.
 */
export function greetingKeyAt(time: string): string {
  if (time < "12:00") return "wb.hello.morning";
  if (time < "18:00") return "wb.hello.afternoon";
  return "wb.hello.evening";
}

/** The workbench greeting for the time of day. */
export function greetingKey(beat: Beat): string {
  if (beat === "boot" || beat === "work") return "wb.hello.morning";
  if (beat === "afternoon") return "wb.hello.afternoon";
  return "wb.hello.evening";
}
