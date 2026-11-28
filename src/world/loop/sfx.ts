// Sound ids from content (doorbell, pager-buzz, chick-beep, rain-loop, lamp-click, chain, lock…)
// map to public/sfx/<id>.mp3. A missing file is silent, never an error (FR3).
import { isCalmDaytime } from "@state/stages";

export const sfxUrl = (id: string): string => `/sfx/${encodeURIComponent(id)}.mp3`;

/**
 * The doorbell goes out of tune with the days (author 2026-11-28: 「第四天开始，逐渐变了调的门铃」):
 * the same file, played lower and slower, in the steps the voice notes take (content/voice.json).
 * Half-tones down: days 1–3 none, 4–6 one, 7–9 two, 11–12 three, 13–15 five, 16–17 seven, 18 an
 * octave. A calm daytime day (day 10) rings true.
 */
const DOORBELL_DOWN: readonly (readonly [fromDay: number, halfTones: number])[] = [[18, 12], [16, 7], [13, 5], [11, 3], [7, 2], [4, 1]];
export function doorbellRate(day: number): number {
  if (isCalmDaytime(day)) return 1;
  const down = DOORBELL_DOWN.find(([from]) => day >= from)?.[1] ?? 0;
  return Math.round(2 ** (-down / 12) * 1000) / 1000;
}

/** What the day does to a one-shot before it plays: only the doorbell today. */
export function dayTune(id: string, day: number): SfxOptions {
  const rate = id === "doorbell" ? doorbellRate(day) : 1;
  return rate === 1 ? {} : { rate };
}

/** A one-shot's playback: `rate` shifts the pitch (2^(1/12) is a half-tone up), `volume` 0..1. */
export interface SfxOptions {
  readonly rate?: number;
  readonly volume?: number;
}
export function playSfx(id: string, muted: boolean, opts: SfxOptions = {}): void {
  if (muted || typeof Audio === "undefined") return;
  try {
    const audio = new Audio(sfxUrl(id));
    if (opts.rate !== undefined && opts.rate > 0) {
      audio.playbackRate = opts.rate;
      // The pitch moves with the rate (a beep a half-tone higher, a squeal).
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = false;
    }
    if (opts.volume !== undefined) audio.volume = Math.max(0, Math.min(1, opts.volume));
    audio.addEventListener("error", () => {});
    void audio.play().catch(() => {});
  } catch {
    /* no sound is fine */
  }
}
