// Which view changes the splat renders: 房间 ↔ 桌子 (navigation 2026-11-01). The other facings
// (床, 门, 窗; room-turn 2026-11-04) are stills you turn to, and 屏幕 has no pose: CSS moves. Pure.
import { moveBetween, type CameraMove, type PoseId } from "./pose";

/**
 * Views whose moves the splat renders. 桌子's pose is calibrated to the tabletop still (desk_top.jpg),
 * so 房间 ↔ 桌子 can be a splat move that ends on the photo. 床 is a facing with its own still now
 * (bed.jpg): with `?splat=1` it simply has no splat.
 */
const POSED: Readonly<Record<string, PoseId>> = { room: "room", desk: "desk" };

export function splatMoveFor(from: string, to: string): CameraMove | null {
  const a = POSED[from];
  const b = POSED[to];
  return a && b && a !== b ? moveBetween(a, b) : null;
}
