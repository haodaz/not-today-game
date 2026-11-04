// Where things are in the two still shots, in stage px (1600×900), until room-scene brings 3D.
// Both shots are 2048×1152 (16:9), drawn with background-size: cover, so stage = image × 0.78125
// with no crop. Measured by hand on public/room/shots/room.jpg and desk_close.jpg (2026-10-31).
// The camera push (motion) and the click areas (HUD) read the same numbers.

import { deskGap, deskLayout } from "./desk";

export interface Rect {
  readonly l: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
}

export const centre = (r: Rect) => ({ x: r.l + r.w / 2, y: r.t + r.h / 2 });

export interface Shot {
  readonly monitors: { readonly left: Rect; readonly right: Rect };
  /** The gap between the two monitors (where the hand comes from at night). */
  readonly gap: Rect;
}

/**
 * The world's actuators (day-loop correction 2026-11-01: the checklist only watches). Measured on
 * the same photos (image px × 0.78125): the computer tower under the desk's left end (its front,
 * where the power button is), in both shots; the bed at the right of 房间, right of the parcel box.
 */
export interface Actuators {
  readonly tower: Rect;
}

/** 房间: the wide shot. Clicking the desk (with its monitors) goes to 桌子. */
export const ROOM_SHOT: Shot & Actuators & { readonly desk: Rect; readonly bed: Rect; readonly box: Rect; readonly lamp: Rect } = {
  monitors: {
    left: { l: 368, t: 302, w: 266, h: 161 },
    right: { l: 640, t: 305, w: 257, h: 156 },
  },
  gap: { l: 633, t: 302, w: 8, h: 161 },
  desk: { l: 215, t: 290, w: 824, h: 330 },
  // Image 262–362 × 862–1012: the tower's front face, below the desk top, left of the chair.
  tower: { l: 205, t: 673, w: 78, h: 117 },
  // Image 1540–2048 × 715–1152: the blanket and the bed's foot, clear of the box at its left.
  bed: { l: 1203, t: 559, w: 397, h: 341 },
  // Image 1295–1535 × 905–1152: the cardboard box on the floor by the bed (it opens at 桌子).
  box: { l: 1012, t: 707, w: 187, h: 193 },
  // Image 1145–1265 × 440–665: the desk lamp, shade to base.
  lamp: { l: 893, t: 343, w: 95, h: 180 },
};

/**
 * The collection on the 房间 desk (title-page FR4/FR8), provisional until the cutouts arrive:
 * the three ending figures stand at the desk's left end by the window, one fixed place each; the
 * book lies left of the keyboard. The chair region is for the title's one-pixel cut (FR7).
 */
export const ROOM_COLLECTION = {
  figures: {
    bad: { l: 236, t: 490, w: 26, h: 48 },
    survive: { l: 268, t: 500, w: 30, h: 38 },
    good: { l: 304, t: 498, w: 26, h: 40 },
    // 崩坏的世界 (three-meters spec): its own place on the desk, right of the good figure.
    collapse: { l: 338, t: 496, w: 26, h: 42 },
  },
  book: { l: 452, t: 500, w: 36, h: 26 },
  chair: { l: 341, t: 543, w: 393, h: 357 },
} as const;

/**
 * 桌子: the tabletop from the chair (day-loop correction 2026-11-01), from content/desk.json. The
 * monitors are their visible lower halves (clicking one goes to 屏幕 on that side); the gap is
 * between them. The tower is under the desk, out of this frame: it is only in 房间.
 */
export const DESK_SHOT: Shot = {
  monitors: deskLayout.monitors,
  gap: deskGap(deskLayout),
};

/**
 * 门 (2026-11-02: the door is actions on the door): the things the door beat's steps happen on, in
 * stage px, measured on public/room/door_wall.png (2048 wide, × 0.78125; door_chain.png agrees
 * within ~10 px). The chain and latch (open to the chain); the bag on the floor by the frame (reach);
 * the chain and the knob (close and chain).
 */
export const DOOR_SHOT: { readonly chain: Rect; readonly bag: Rect; readonly close: Rect } = {
  // Image 1306–1434 × 358–550: the brass latch and the hanging chain.
  chain: { l: 1020, t: 280, w: 100, h: 150 },
  // Image 1423–1638 × 906–1144: the paper bag by the frame.
  bag: { l: 1112, t: 708, w: 168, h: 186 },
  // Image 1306–1434 × 358–627: the chain down to the knob.
  close: { l: 1020, t: 280, w: 100, h: 210 },
};
export const rectStyle = (r: Rect): string => `left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px`;
