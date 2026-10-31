// Where things are in the two still shots, in stage px (1600×900), until room-scene brings 3D.
// Both shots are 2048×1152 (16:9), drawn with background-size: cover, so stage = image × 0.78125
// with no crop. Measured by hand on public/room/shots/room.jpg and desk_close.jpg (2026-10-31).
// The camera push (motion) and the click areas (HUD) read the same numbers.

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
export const ROOM_SHOT: Shot & Actuators & { readonly desk: Rect; readonly bed: Rect } = {
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
  },
  book: { l: 452, t: 500, w: 36, h: 26 },
  chair: { l: 341, t: 543, w: 393, h: 357 },
} as const;

/** 桌子: the desk close-up. Clicking a monitor goes to 屏幕 on that side. */
export const DESK_SHOT: Shot & Actuators = {
  monitors: {
    left: { l: 307, t: 272, w: 330, h: 201 },
    right: { l: 643, t: 276, w: 322, h: 193 },
  },
  gap: { l: 636, t: 272, w: 8, h: 201 },
  // Image 130–240 × 975–1152: the tower's front, bottom left, under the desk.
  tower: { l: 102, t: 762, w: 86, h: 138 },
};

export const rectStyle = (r: Rect): string => `left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px`;
