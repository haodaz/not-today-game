// The splat's framings, as calibrated against the photos (room-scene correction 2026-11-01).
// `?splatcal=1` (dev only) shows each pose with its photo at 50 % over it and prints this table in
// this exact shape, so a calibration run is pasted back here.
// World coordinates as in public/room/README.md; up (0,−1,0); fov is vertical, in degrees.
//   room: f080 (README "中段", the default).
//   desk: the README's close-desk pose 凑近桌面, measured on room.splat (not f43, which is door.splat's).
//   bed:  f159 (README "最右"), for the night beat once that framing exists.
// Status: not yet calibrated in a browser. The FOV is provisional (see design S12).

export interface Framing {
  readonly pos: readonly [number, number, number];
  readonly look: readonly [number, number, number];
  readonly fov: number;
}

export const CALIBRATION = {
  room: { pos: [-3.127, -0.071, -0.872], look: [0.615, -0.118, 22.497], fov: 50 },
  desk: { pos: [-1.0, 0, 6.0], look: [0.6, -0.1, 22.5], fov: 50 },
  bed: { pos: [-6.312, 0.068, 4.09], look: [9.106, 0.167, 12.6], fov: 50 },
} as const satisfies Record<string, Framing>;
