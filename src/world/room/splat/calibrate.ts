// `?splatcal=1` (dev only): line the splat up with the photos (room-scene correction 2026-11-01).
// The layer shows the current framing's pose still, with its photo at 50 % over it; these keys
// move the camera and print the table in calibration.ts's shape. Pure.
//   ← →  yaw   ↑ ↓  pitch   (0.1°, Shift 1°)
//   W S  forward / back   A D  left / right   R F  up / down   (0.02, Shift 0.2)
//   [ ]  field of view   (0.5°, Shift 5°)
import type { Framing } from "./calibration";
import { lookOf, poseFromLook, type Pose } from "./pose";

const DEG = Math.PI / 180;

/** The pose after one key, or null if the key isn't a calibration key. */
export function nudge(p: Pose, key: string, shift: boolean): Pose | null {
  const a = (shift ? 1 : 0.1) * DEG;
  const d = shift ? 0.2 : 0.02;
  const f = shift ? 5 : 0.5;
  // Horizontal forward and right (right = forward turned +90° about y).
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const move = (dx: number, dy: number, dz: number): Pose => ({ ...p, pos: { x: p.pos.x + dx, y: p.pos.y + dy, z: p.pos.z + dz } });
  switch (key.length === 1 ? key.toLowerCase() : key) {
    case "ArrowLeft":
      return { ...p, yaw: p.yaw - a };
    case "ArrowRight":
      return { ...p, yaw: p.yaw + a };
    case "ArrowUp":
      return { ...p, pitch: p.pitch + a };
    case "ArrowDown":
      return { ...p, pitch: p.pitch - a };
    case "w":
      return move(fx * d, 0, fz * d);
    case "s":
      return move(-fx * d, 0, -fz * d);
    case "d":
      return move(fz * d, 0, -fx * d);
    case "a":
      return move(-fz * d, 0, fx * d);
    // Up is (0,−1,0) in this capture.
    case "r":
      return move(0, -d, 0);
    case "f":
      return move(0, d, 0);
    case "[":
      return { ...p, fov: Math.max(10, (p.fov ?? 50) - f) };
    case "]":
      return { ...p, fov: Math.min(120, (p.fov ?? 50) + f) };
    default:
      return null;
  }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** A pose as a calibration.ts row (look 24 ahead; 3 decimals; fov 1 decimal). */
export function framingOf(p: Pose): Framing {
  const l = lookOf(p);
  return { pos: [r3(p.pos.x), r3(p.pos.y), r3(p.pos.z)], look: [r3(l.x), r3(l.y), r3(l.z)], fov: Math.round((p.fov ?? 50) * 10) / 10 };
}

/** The rows to paste into calibration.ts. */
export function formatCalibration(rows: Readonly<Record<string, Framing>>): string {
  return Object.entries(rows)
    .map(([id, f]) => `  ${id}: { pos: [${f.pos.join(", ")}], look: [${f.look.join(", ")}], fov: ${f.fov} },`)
    .join("\n");
}

/** Round trip: a row read back as a pose. */
export const poseOfRow = (f: Framing): Pose => ({ ...poseFromLook({ x: f.pos[0], y: f.pos[1], z: f.pos[2] }, { x: f.look[0], y: f.look[1], z: f.look[2] }), fov: f.fov });
