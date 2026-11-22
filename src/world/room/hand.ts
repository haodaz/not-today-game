// texture-pass R5: the gods' hands, nights 10–17. Each hand night has its own picture of the real desk
// at night with that night's god reaching out of the gap (public/night/hand_dNN.jpg) and, from night
// 11, a slight-motion clip over it (hand_dNN.mp4; night 10's clip was refused by the generator's
// filter, so it is the still alone). Night 18 is Kuro's own and has no god picture. Pure.
import { html, type SafeHtml } from "@world/html";

export interface HandMedia {
  readonly still: string;
  readonly clip: string | null;
}

export const HAND_NIGHTS = { first: 10, last: 17 } as const;

/** The night's hand picture, or null off the hand nights. */
export function handMedia(day: number): HandMedia | null {
  if (day < HAND_NIGHTS.first || day > HAND_NIGHTS.last) return null;
  return { still: `/night/hand_d${day}.jpg`, clip: day === 10 ? null : `/night/hand_d${day}.mp4` };
}

/**
 * The stage behind the dialogue box while the hand is out: the still, the clip over it (muted, loop)
 * when there is one. The gap's pink line (`.gap-glow`) is drawn after it, on top. Null off hand nights.
 */
export function handStage(day: number): SafeHtml | null {
  const m = handMedia(day);
  if (!m) return null;
  return html`<div class="hand-stage" data-night="${day}"><img src="${m.still}" alt="" draggable="false">${m.clip ? html`<video src="${m.clip}" poster="${m.still}" autoplay muted loop playsinline aria-hidden="true"></video>` : null}</div>`;
}
