// Sound ids from content (doorbell, pager-buzz, chick-beep, rain-loop, lamp-click, chain, lock…)
// map to public/sfx/<id>.mp3. A missing file is silent, never an error (FR3).

export const sfxUrl = (id: string): string => `/sfx/${encodeURIComponent(id)}.mp3`;

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
