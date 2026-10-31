// Motion timings (polish spec, design/hud/motion.md). One source: motion.css reads these as CSS
// variables (applyMotionVars), never literal durations. MOTION is motion.md; CHOSEN is what
// motion.md does not say (design P2), kept apart so the two are never confused.

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
  /** 房间 ↔ 桌子: the splat move and the CSS push under it (room-scene correction 2026-11-01). */
  roomDesk: 900,
} as const;

/** How long a view change takes: 房间 ↔ 桌子 900 ms, other camera moves `MOTION.view`, the door `doorView`. */
export function viewMoveMs(from: string, to: string, camera: boolean): number {
  if (!camera) return CHOSEN.doorView;
  const pair = `${from}>${to}`;
  return pair === "room>desk" || pair === "desk>room" ? CHOSEN.roomDesk : MOTION.view;
}

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
