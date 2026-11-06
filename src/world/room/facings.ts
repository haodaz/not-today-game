// The room is four walls you turn between (room-turn 2026-11-04): 房间 (the desk wall), 床, 门 and
// 窗, in that order turning right. Every facing is top level: none has a way "back", and each leads to
// the next by a turn. 桌子 and 屏幕 stay levels under 房间. Pure: names, order, the shortest way.

export const FACINGS = ["room", "bed", "door", "window"] as const;
export type Facing = (typeof FACINGS)[number];
export type TurnDir = "left" | "right";

export const isFacing = (view: string): view is Facing => (FACINGS as readonly string[]).includes(view);

/** The facing a 90° turn that way arrives at. */
export function turnedTo(from: Facing, dir: TurnDir): Facing {
  const i = FACINGS.indexOf(from);
  return FACINGS[(i + (dir === "right" ? 1 : FACINGS.length - 1)) % FACINGS.length]!;
}

/**
 * The shortest way from one facing to another, as turns: none, one either way, or two to the right
 * when the target is the opposite wall (room-turn R2: "two facings away is two turns, toward the right").
 */
export function turnsBetween(from: Facing, to: Facing): TurnDir[] {
  if (from === to) return [];
  if (turnedTo(from, "right") === to) return ["right"];
  if (turnedTo(from, "left") === to) return ["left"];
  return ["right", "right"];
}

/** The levels under 房间 have a way back (屏幕 → 桌子 → 房间); the facings have none. */
export const hasBack = (view: string): boolean => view === "desk" || view === "desktop" || view === "table";

/** The left and right share of the stage that is a turn edge, on every facing. */
export const TURN_EDGE = 0.08;
