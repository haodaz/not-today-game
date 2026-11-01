// Which view changes the splat renders: 房间 ↔ 床 for the night beat once that framing exists
// (桌子, 门 and 屏幕 keep their CSS moves). Pure.
import { moveBetween, type CameraMove, type PoseId } from "./pose";

/**
 * Views (and future framings) whose moves the splat renders. 桌子 is the tabletop now (day-loop
 * correction 2026-11-01): 房间 ↔ 桌子 is the CSS push; the splat keeps 房间 ↔ 床 and the night.
 * 桌子's pose stays (the day-18 pull-out may start there).
 */
const POSED: Readonly<Record<string, PoseId>> = { room: "room", bed: "bed" };

export function splatMoveFor(from: string, to: string): CameraMove | null {
  const a = POSED[from];
  const b = POSED[to];
  return a && b && a !== b ? moveBetween(a, b) : null;
}
