// The three things without a screen (objects-in-hand FR3.2, 3.4, 3.8):
//   the IC card — turned, its back shows the strip and one pinch mark per use (one more from day 13,
//     not yours); against the light (the pointer in the top zone while using) it is 60 % see-through,
//     with the coil and content's line;
//   the phone — flip open, flip closed; the power key does nothing; closing it on day 18 the cracked
//     corner lights for one frame; the back has content's SIM line;
//   the textbook — a page turn; the back cover's empty cell takes content's pencilled score once a run.
import { NO_FRAME } from "./frame";
import { step, type Program } from "./program";

/** From this day the card has one pinch mark the player did not make. */
export const EXTRA_PINCH_FROM_DAY = 13;
export const pinchMarks = (uses: number, day: number): number => uses + (day >= EXTRA_PINCH_FROM_DAY ? 1 : 0);
/** How see-through the card is against the light. */
export const CARD_TRANSLUCENT = 0.6;

export interface CardState {
  readonly flips: number;
}
export const iccard: Program<CardState> = {
  id: "iccard",
  channel: null,
  keySound: null,
  init: () => ({ flips: 0 }),
  key: (s, key) => (key === "flip" ? step({ flips: s.flips + 1 }, { sound: "plastic-flip" }) : step(s)),
  draw: () => NO_FRAME,
};

/** The cracked corner lights for one frame when the phone is closed on this day. */
export const CRACK_DAY = 18;
export const CRACK_FLASH_MS = 60;
export interface PhoneState {
  readonly open: boolean;
  readonly crackAt: number | null;
}
export const phone: Program<PhoneState> = {
  id: "phone",
  channel: null,
  keySound: null,
  init: () => ({ open: false, crackAt: null }),
  key(s, key, env) {
    if (key === "flip") {
      const open = !s.open;
      return step({ open, crackAt: !open && env.day === CRACK_DAY ? env.t : s.crackAt }, { sound: "plastic-flip" });
    }
    // The power key: it does not need to turn on.
    return step(s);
  },
  draw: () => NO_FRAME,
};
export const crackLit = (s: PhoneState, t: number): boolean => s.crackAt !== null && t - s.crackAt >= 0 && t - s.crackAt < CRACK_FLASH_MS;

/** The pencil takes this long to write the score. */
export const PENCIL_MS = 1_500;
export interface TextbookState {
  readonly page: number;
  /** When the score was written (this session), or null. */
  readonly writtenAt: number | null;
}
export const textbook: Program<TextbookState> = {
  id: "textbook",
  channel: null,
  keySound: null,
  init: () => ({ page: 0, writtenAt: null }),
  key(s, key, env) {
    if (key === "flip") return step({ ...s, page: s.page + 1 }, { sound: "page-turn" });
    // Once: a second click on the written cell does nothing (the hand layer keeps it once a run).
    if (key === "cell" && s.writtenAt === null) return step({ ...s, writtenAt: env.t });
    return step(s);
  },
  draw: () => NO_FRAME,
};
/** How much of the score is written at t (0..1). */
export const pencilShown = (s: TextbookState, t: number): number => (s.writtenAt === null ? 0 : Math.max(0, Math.min(1, (t - s.writtenAt) / PENCIL_MS)));
