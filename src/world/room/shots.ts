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
 * The collection in 房间 (title-page FR4/FR8; author 2026-11-12: 「放床上吧」): the five ending
 * figures sit in a row on the bed's blanket by the headboard, one fixed place each, a little
 * larger toward the camera; the book lies on the headboard shelf (bedside-book). The chair region is for the title's
 * one-pixel cut (FR7).
 */
export const ROOM_COLLECTION = {
  figures: {
    bad: { l: 1255, t: 594, w: 34, h: 62 },
    survive: { l: 1300, t: 608, w: 46, h: 48 },
    // 回到未来（或许是最后一次）: the carton with the puppy on it (ending matrix 2026-11-13)
    warm: { l: 1356, t: 596, w: 54, h: 62 },
    good: { l: 1420, t: 600, w: 42, h: 58 },
    // 温柔的世界: the little bed under a glass dome
    collapse: { l: 1472, t: 584, w: 44, h: 74 },
  },
  // bedside-book: the stack of two books on the headboard shelf (image 1430–1690 × 640–700).
  book: { l: 1120, t: 500, w: 200, h: 50 },
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
/**
 * 床, the bed wall (room-turn R3, Claude measured on public/room/shots/bed.jpg fitted to the stage):
 * the bed (lie down) and the parcel box between the bed head and the desk (its box action is
 * 房间's: turning left to 房间 first).
 */
export const BED_SHOT: { readonly bed: Rect; readonly box: Rect } = {
  bed: { l: 500, t: 490, w: 817, h: 410 },
  box: { l: 236, t: 616, w: 261, h: 237 },
};

/**
 * 窗, the big window wall (room-turn R3, on public/room/shots/window.jpg): the little meal table
 * under the window, and where the meal that `deskMeal` picks sits on it. The still shows a takeout
 * box already; a clean still comes later, the rect stays.
 */
export const WINDOW_SHOT: { readonly mealTable: Rect; readonly meal: Rect; readonly desk: Rect } = {
  mealTable: { l: 565, t: 600, w: 225, h: 300 },
  // 2026-11-08 (author): the desk and its screens show at the right of this wall too; like the bed on
  // two walls, they can be used from here (window.jpg x 1040–1664, y 340–900, cover-fitted).
  desk: { l: 1010, t: 330, w: 590, h: 540 },
  // playtest-1105 R5: the tabletop is stage x 567–788, y 614–684 (window.jpg x 592–820, y 633–705,
  // cover-fitted); the meal's bottom now sits on its middle, centred on it (it was 10 px high, 10 px left).
  meal: { l: 617, t: 578, w: 120, h: 88 },
};

/**
 * 窗's table up close (playtest-1105 R5): window.jpg itself pushed in 3× (no close-up still yet),
 * the tabletop's centre (image ≈706, 660) at the stage's centre. room.css draws it with TABLE_ZOOM;
 * the meal sits large on the top, its bottom on the middle of the boards.
 */
export const TABLE_ZOOM = { k: 3, x: Math.round(800 - 706 * 3), y: Math.round(450 - 660 * 3) } as const;
export const TABLE_SHOT: { readonly meal: Rect } = {
  meal: { l: 600, t: 170, w: 400, h: 300 },
};

/** The flat facings' things to point at, in tab order (fixed rectangles, no splat box). */
export type FlatHotId = "bed" | "box" | "mealTable" | "desk";
export const FLAT_HOTS: Readonly<Record<"bed" | "window", readonly { readonly id: FlatHotId; readonly rect: Rect }[]>> = {
  bed: [
    { id: "box", rect: BED_SHOT.box },
    { id: "bed", rect: BED_SHOT.bed },
  ],
  window: [
    { id: "mealTable", rect: WINDOW_SHOT.mealTable },
    { id: "desk", rect: WINDOW_SHOT.desk },
  ],
};
export const isFlatFacing = (view: string): view is "bed" | "window" => view === "bed" || view === "window";

/**
 * A rectangle given as fractions of a backdrop (x0–x1 / y0–y1), in stage px: the backdrop is
 * `w × h` and drawn `cover` and centred on the 1600×900 stage (room.css).
 */
export function fracRect(img: { readonly w: number; readonly h: number }, x0: number, x1: number, y0: number, y1: number): Rect {
  const k = Math.max(1600 / img.w, 900 / img.h);
  const ox = (1600 - img.w * k) / 2;
  const oy = (900 - img.h * k) / 2;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { l: r(ox + x0 * img.w * k), t: r(oy + y0 * img.h * k), w: r((x1 - x0) * img.w * k), h: r((y1 - y0) * img.h * k) };
}

/** The door wall (door_wall.png, 2048×1152) and the window wall (shots/window.jpg, 1664×928). */
export const DOOR_WALL = { w: 2048, h: 1152 } as const;
export const WINDOW_WALL = { w: 1664, h: 928 } as const;

/**
 * playtest-1105 R4: the things in the room to touch, as fractions of the facing's backdrop. On 门 the
 * lock (chain + handle) sits over the door leaf, so a click there is the lock.
 */
export type LookSpot = { readonly look: "coat" | "bag" | "door" | "lock"; readonly rect: Rect };
export const LOOK_SPOTS: Readonly<Record<"door" | "window", readonly LookSpot[]>> = {
  door: [
    { look: "coat", rect: fracRect(DOOR_WALL, 0.33, 0.42, 0.17, 0.65) },
    { look: "door", rect: fracRect(DOOR_WALL, 0.48, 0.69, 0.02, 0.95) },
    { look: "lock", rect: fracRect(DOOR_WALL, 0.64, 0.7, 0.31, 0.53) },
    { look: "bag", rect: fracRect(DOOR_WALL, 0.69, 0.8, 0.79, 1.0) },
  ],
  window: [
    { look: "bag", rect: fracRect(WINDOW_WALL, 0.16, 0.245, 0.74, 0.95) },
    { look: "door", rect: fracRect(WINDOW_WALL, 0.0, 0.13, 0.0, 0.97) },
  ],
};

export const rectStyle = (r: Rect): string => `left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px`;
