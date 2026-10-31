// Which view changes the splat renders (room-scene scope 2026-11-01): 房间 ↔ 桌子, and 床 for the
// night beat once that framing exists. 门 and 屏幕 keep their CSS moves. Pure.
import { moveBetween, type CameraMove, type PoseId } from "./pose";

/** Views (and future framings) that have a pose in the splat. */
const POSED: Readonly<Record<string, PoseId>> = { room: "room", desk: "desk", bed: "bed" };

export function splatMoveFor(from: string, to: string): CameraMove | null {
  const a = POSED[from];
  const b = POSED[to];
  return a && b && a !== b ? moveBetween(a, b) : null;
}
