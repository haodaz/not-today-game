// Motion timings (polish spec, design/hud/motion.md). One source: motion.css reads these as CSS
// variables (applyMotionVars), never literal durations. MOTION is motion.md; CHOSEN is what
// motion.md does not say (design P2), kept apart so the two are never confused.
import { isFacing, turnsBetween } from "@world/room/facings";

/** A turn's slide is eased in and out (room-turn R2), unlike the ease-out of everything else. */
export const TURN_EASE = "cubic-bezier(.65,0,.35,1)";

/** motion.md: short, ease-out. */
export const EASE = "cubic-bezier(.2,.8,.2,1)";
/** motion.md: an exit is 30% faster than its entry. */
export const EXIT_FACTOR = 0.7;
export const exitOf = (entryMs: number): number => Math.round(entryMs * EXIT_FACTOR);

/** Every number in design/hud/motion.md, in ms unless named otherwise. */
export const MOTION = {
  /** Room dims to 55% when the phone or an object is picked up. */
  dim: 200,
  dimTo: 0.55,
  /** The item rises from its desk-bar slot to the centre, tilted 3°. */
  lift: 320,
  /** Objects only: the phone is held straight (PHONE_TILT_DEG, author 2026-10-31). */
  tiltDeg: -3,
  /** The phone's screen lights up: one white flash. */
  flash: 120,
  /** Put down: back along the same path; the room brightens. */
  putDown: 220,
  /** Checklist: the box fills, then a line through; 400ms later it folds into 已做 N 件. */
  tickFill: 80,
  tickHold: 400,
  /** A new checklist item fades in and moves down 6px. */
  itemIn: 240,
  itemShiftPx: 6,
  /** Dialogue: the box fades in; 18ms a character; inner lines 1.5× slower; sound 400ms first. */
  dlgIn: 160,
  perChar: 18,
  innerSlow: 1.5,
  soundLead: 400,
  /** Choices: bottom to top, 60ms apart, 160ms each. */
  choice: 160,
  choiceGap: 60,
  /** Doorbell: the sound; 400ms later the checklist line; 300ms after that the dialogue. */
  bellToList: 400,
  listToDialogue: 300,
  /** Room ↔ desktop camera; reversed on the way back. */
  view: 400,
  /** Left ↔ right monitor push. */
  screen: 240,
  /** Kuro's body: state crossfade, bob period and height, crawl along the edge; night blink. */
  kuroFade: 300,
  bob: 3000,
  bobPx: 3,
  crawl: 1200,
  blink: 2000,
  /** Shutdown: each monitor darkens, right first, 150ms apart. */
  shutdown: 600,
  shutdownGap: 150,
  /** Lying down: rise a little, then black; the last line holds 1.5s. */
  sleep: 800,
  lastLineHold: 1500,
} as const;

/** Values motion.md does not give (design P2). */
export const CHOSEN = {
  strike: 160,
  doorStep: MOTION.itemIn,
  doorImage: MOTION.view,
  doorView: MOTION.view,
  kuroLine: 240,
  wake: MOTION.sleep,
  sleepRisePx: 24,
  chosenHold: MOTION.choice,
  /** Walking, not switching (room-scene 2026-11-02): a move takes as long as the path. 房间 ↔ 桌子. */
  roomDesk: 900,
  /** A 90° turn between two facings (room-turn R2): a horizontal slide. */
  turn: 450,
  /** Each of the two turns when the target is the opposite wall (back to back, toward the right). */
  turnFast: 300,
  /** 桌子 ↔ 屏幕: leaning in. */
  deskScreen: 500,
  /** 使用 flip: the face turns over in-place (objects-in-hand 2026-11-03). */
  flip: 320,
  /** The head bob of a walk: the whole still moves this far, two steps per move. */
  walkBobPx: 4,
  /** A line's backdrop crossfades in, and the stage fades back to its still after the sequence (dialogue 2026-11-02). */
  backdropFade: 1200,
  /** A line's prop fades in over the backdrop. */
  propIn: 300,
} as const;
/** Every move between stills ends in this crossfade (the no-warp correction): the walk comes before it. */
export const CROSSFADE_MS = MOTION.view;
/**
 * How long a view change takes, by the length of the path: 房间 ↔ 桌子 900, 桌子 ↔ 屏幕 500 ms;
 * 房间 ↔ 屏幕 goes by the desk (900). Between two facings it is a turn (room-turn R2): 450 ms to the
 * next wall, two 300 ms turns to the opposite one. Anything else the plain crossfade. `camera` is
 * kept for callers and no longer changes it.
 */
export function viewMoveMs(from: string, to: string, _camera = true): number {
  if (from !== to && isFacing(from) && isFacing(to)) return turnsBetween(from, to).length === 1 ? CHOSEN.turn : 2 * CHOSEN.turnFast;
  const pair = [from, to].sort().join(">");
  switch (pair) {
    case "desk>room":
      return CHOSEN.roomDesk;
    case "desk>desktop":
      return CHOSEN.deskScreen;
    case "desktop>room":
      return CHOSEN.roomDesk;
    default:
      return CROSSFADE_MS;
  }
}
/** The walk before the crossfade (none for the shortest moves). */
export const walkMs = (from: string, to: string): number => Math.max(0, viewMoveMs(from, to) - CROSSFADE_MS);
/** The phone is never tilted (author 2026-10-31, overriding motion.md's 3° for the phone). */
export const PHONE_TILT_DEG = 0;

/** How far a shot pushes in toward what the camera goes to (the desk, a monitor). Where things are
 *  in the shots is world/room/shots.ts. */
export const ROOM_PUSH = 1.6;

/** Choice i of n: the bottom one first, then upward, `choiceGap` apart. */
export function choiceDelays(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (n - 1 - i) * MOTION.choiceGap);
}

/** The CSS variables motion.css uses. */
export function motionVars(): Record<string, string> {
  const ms = (n: number) => `${n}ms`;
  return {
    "--m-ease": EASE,
    /** Reduced motion: the end state at once. */
    "--m-none": "1ms",
    "--m-dim": ms(MOTION.dim),
    "--m-dim-to": String(MOTION.dimTo),
    "--m-lift": ms(MOTION.lift),
    "--m-tilt": `${MOTION.tiltDeg}deg`,
    "--m-phone-tilt": `${PHONE_TILT_DEG}deg`,
    "--m-flash": ms(MOTION.flash),
    "--m-put-down": ms(MOTION.putDown),
    "--m-tick-fill": ms(MOTION.tickFill),
    "--m-tick-hold": ms(MOTION.tickHold),
    "--m-strike": ms(CHOSEN.strike),
    "--m-item-in": ms(MOTION.itemIn),
    "--m-item-out": ms(exitOf(MOTION.itemIn)),
    "--m-item-shift": `${MOTION.itemShiftPx}px`,
    "--m-dlg-in": ms(MOTION.dlgIn),
    "--m-dlg-out": ms(exitOf(MOTION.dlgIn)),
    "--m-choice": ms(MOTION.choice),
    "--m-choice-out": ms(exitOf(MOTION.choice)),
    "--m-view": ms(MOTION.view),
    // 使用 focus: the object's face fills the stage with the same timing as 桌子 → 屏幕 (500 ms).
    "--m-use": ms(CHOSEN.deskScreen),
    // 使用 flip: the face turns over in-place (scaleX 1 → 0 → 1), the face swapping at 0.
    "--m-flip": ms(CHOSEN.flip),
    // The walk's bob as a plain number (motion.css multiplies it into px and into the cover).
    "--m-walk-bob-n": String(CHOSEN.walkBobPx),
    // A turn between facings (room-turn R2): one 450 ms slide, or two of 300 ms to the opposite wall.
    "--m-turn": ms(CHOSEN.turn),
    "--m-turn-fast": ms(CHOSEN.turnFast),
    "--m-turn-ease": TURN_EASE,
    "--m-screen": ms(MOTION.screen),
    "--m-kuro-fade": ms(MOTION.kuroFade),
    "--m-bob": ms(MOTION.bob),
    "--m-bob-px": `${MOTION.bobPx}px`,
    "--m-crawl": ms(MOTION.crawl),
    "--m-blink": ms(MOTION.blink),
    "--m-kuro-line": ms(CHOSEN.kuroLine),
    "--m-shutdown": ms(MOTION.shutdown),
    "--m-sleep": ms(MOTION.sleep),
    "--m-sleep-rise": `${-CHOSEN.sleepRisePx}px`,
    "--m-wake": ms(CHOSEN.wake),
    "--m-door-step": ms(CHOSEN.doorStep),
    "--m-door-step-out": ms(exitOf(CHOSEN.doorStep)),
    "--m-door-image": ms(CHOSEN.doorImage),
    "--m-door-image-out": ms(exitOf(CHOSEN.doorImage)),
  };
}

export function applyMotionVars(style: CSSStyleDeclaration): void {
  for (const [k, v] of Object.entries(motionVars())) style.setProperty(k, v);
}
