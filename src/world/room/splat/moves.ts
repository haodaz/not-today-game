// Which view changes the splat renders: every move between the posed framings, 房间 · 桌子 · 床
// (navigation 2026-11-01); 门 and 屏幕 have no pose and keep their CSS moves. Pure.
import { moveBetween, type CameraMove, type PoseId } from "./pose";

/**
 * Views whose moves the splat renders. 桌子's pose is calibrated to the tabletop still (desk_top.jpg),
 * so 房间 ↔ 桌子 can be a splat move that ends on the photo; 床 has no still: the splat is its picture.
 */
const POSED: Readonly<Record<string, PoseId>> = { room: "room", desk: "desk", bed: "bed" };

export function splatMoveFor(from: string, to: string): CameraMove | null {
  const a = POSED[from];
  const b = POSED[to];
  return a && b && a !== b ? moveBetween(a, b) : null;
}
