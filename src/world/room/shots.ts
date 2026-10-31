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
  /** Kuro's small window glowing on the right monitor: click to call it (day-loop amendment). */
  readonly kuro: Rect;
  /** The gap between the two monitors (where the hand comes from at night). */
  readonly gap: Rect;
}

/** 房间: the wide shot. Clicking the desk (with its monitors) goes to 桌子. */
export const ROOM_SHOT: Shot & { readonly desk: Rect } = {
  monitors: {
    left: { l: 368, t: 302, w: 266, h: 161 },
    right: { l: 640, t: 305, w: 257, h: 156 },
  },
  kuro: { l: 805, t: 410, w: 86, h: 45 },
  gap: { l: 633, t: 302, w: 8, h: 161 },
  desk: { l: 215, t: 290, w: 824, h: 330 },
};

/** 桌子: the desk close-up. Clicking a monitor goes to 屏幕 on that side. */
export const DESK_SHOT: Shot = {
  monitors: {
    left: { l: 307, t: 272, w: 330, h: 201 },
    right: { l: 643, t: 276, w: 322, h: 193 },
  },
  kuro: { l: 850, t: 400, w: 105, h: 62 },
  gap: { l: 636, t: 272, w: 8, h: 201 },
};

export const rectStyle = (r: Rect): string => `left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px`;
