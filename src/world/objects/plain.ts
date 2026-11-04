// The three things without a screen (objects-in-hand FR3.2, 3.4, 3.8):
//   the IC card — turned, its back shows the strip and one pinch mark per use (one more from day 13,
//     not yours); against the light (the pointer in the top zone while using) it is 60 % see-through,
//     with the coil and content's line;
//   the phone — flip open, flip closed; the power key does nothing; closing it on day 18 the cracked
//     corner lights for one frame; the back has content's SIM line;
//   the instant camera (camera R8) — the shutter shoots and a sheet ejects; the flash slider; the
//     back's counter of sheets left (seven segments).
import { Bits, drawSegLine, finer, NO_FRAME, SEG_PITCH, type Frame } from "./frame";
import { step, type ObjectEnv, type Out, type Program } from "./program";
import { hasString, t } from "@world/i18n";
import { NO_PRESS, upgradedHi } from "./taken";

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

/**
 * camera R8 (2026-11-04; R8 wins over R1–R7): the instant camera. `shutter` takes a photo: a sheet
 * ejects (the `camera-shutter` sound has the whirr in it) and the 120 ms white flash. Pointed at the
 * room it uses a sheet of the pack (`env.sheets`, from the log); at 0 it clicks and nothing comes
 * out (「胶卷用完了。」). Pointed at the screen (`env.onScreen`) it is unlimited. `flash` is the
 * small slider, toggled left / right. No wind wheel. The photo event is the caller's to append (a
 * program writes no world event): `cameraShot` tells it a shot happened. The back's counter of
 * sheets left is this program's frame (two seven-segment cells, the calculator's code).
 */
export const CAMERA_FLASH_MS = 120;
/** The back counter: two seven-segment cells. */
export const CAM_CELLS = 2;
export const CAM_W = CAM_CELLS * SEG_PITCH + 2;
export const CAM_H = 11;
export interface CameraState {
  /** The flash slider is on (to the right). */
  readonly flash: boolean;
  /** When the last sheet ejected (session ms), or null. */
  readonly ejectAt: number | null;
}
const cameraLine = (env: ObjectEnv, key: string): Out[] => (hasString(key) ? [{ say: { key: `d${env.day}:${key}`, lines: [{ k: "inner", t: t(key) }] } }] : []);
export function drawCamera(_s: CameraState, env: ObjectEnv): Frame {
  // Upgraded: the new world's smooth screen, as every upgraded device (R9).
  if (env.upgraded) return upgradedHi(env, NO_PRESS, { lines: [String(Math.max(0, env.sheets ?? 0))] });
  const b = new Bits(CAM_W, CAM_H);
  drawSegLine(b, 1, 1, String(Math.max(0, Math.min(99, env.sheets ?? 0))).padStart(CAM_CELLS, "0"), CAM_CELLS);
  const f = finer(b, env.level);
  return { kind: "pixels", w: f.w, h: f.h, bits: f.bits, ink: 1 };
}
export const camera: Program<CameraState> = {
  id: "camera",
  channel: { w: CAM_W, h: CAM_H },
  keySound: null,
  init: () => ({ flash: false, ejectAt: null }),
  key(s, key, env) {
    if (key === "flash") return step({ ...s, flash: !s.flash });
    if (key === "shutter") {
      if (!env.onScreen && (env.sheets ?? 0) <= 0) return step(s, ...cameraLine(env, "camera.empty"));
      return step({ ...s, ejectAt: env.t }, { sound: "camera-shutter" });
    }
    return step(s);
  },
  draw: drawCamera,
};
/** The press from `before` to `after` took a shot (the caller logs the `photo`). */
export const cameraShot = (before: CameraState | null, after: CameraState): boolean => after.ejectAt !== null && after.ejectAt !== (before?.ejectAt ?? null);
/** The white flash is up at `t`. */
export const cameraFlashing = (s: CameraState | null, t: number): boolean => !!s && s.ejectAt !== null && t >= s.ejectAt && t - s.ejectAt < CAMERA_FLASH_MS;
