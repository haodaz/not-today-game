// Sound ids from content (doorbell, pager-buzz, chick-beep, rain-loop, lamp-click, chain, lock…)
// map to public/sfx/<id>.mp3. A missing file is silent, never an error (FR3).

export const sfxUrl = (id: string): string => `/sfx/${encodeURIComponent(id)}.mp3`;

export function playSfx(id: string, muted: boolean): void {
  if (muted || typeof Audio === "undefined") return;
  try {
    const audio = new Audio(sfxUrl(id));
    audio.addEventListener("error", () => {});
    void audio.play().catch(() => {});
  } catch {
    /* no sound is fine */
  }
}
