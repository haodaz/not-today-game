// The splat's framings, as calibrated against the photos (room-scene correction 2026-11-01).
// `?splatcal=1` (dev only) shows each pose with its photo at 50 % over it and prints this table in
// this exact shape, so a calibration run is pasted back here.
// World coordinates as in public/room/README.md; up (0,−1,0); fov is vertical, in degrees.
//   room: f080 (README "中段"), calibrated against room.jpg.
//   desk: from the README's close-desk pose 凑近桌面, calibrated against desk_close.jpg.
//   bed:  f159 (README "最右"), not yet calibrated (no 床 framing exists).
// Status: room and desk calibrated by Claude with ?splatcal=1 (2026-11-01).

export interface Framing {
  readonly pos: readonly [number, number, number];
  readonly look: readonly [number, number, number];
  readonly fov: number;
}

export const CALIBRATION = {
  room: { pos: [-3.127, -0.071, -0.872], look: [0.668, -0.119, 22.826], fov: 48.5 },
  desk: { pos: [-0.345, 0, 11.562], look: [2.013, -0.145, 35.446], fov: 40 },
  bed: { pos: [-6.312, 0.068, 4.09], look: [9.106, 0.167, 12.6], fov: 50 },
} as const satisfies Record<string, Framing>;
