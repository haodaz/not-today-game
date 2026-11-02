// The splat's framings, as calibrated against the photos (room-scene correction 2026-11-01).
// `?splatcal=1` (dev only) shows each pose with its photo at 50 % over it and prints this table in
// this exact shape, so a calibration run is pasted back here.
// World coordinates as in public/room/README.md; up (0,−1,0); fov is vertical, in degrees.
//   room: f080 (README "中段"), calibrated against room.jpg.
//   desk: 桌子 is the tabletop from the chair (desk_top.jpg). Claude's 2026-11-01 pose was for the old
//         desk_close.jpg; the tabletop shot is the same camera raised 2.0 (y −2.0) and looking along the
//         same direction, which lines up with desk_top.jpg to a few px (checked 2026-11-02 at 50 % overlay).
//   bed:  床, the framing the bed is pointed at (navigation 2026-11-01). README's f159 (pos −6.312 0.068
//         4.090, look 9.106 0.167 12.600) renders as a smear in room_clean.splat: it is the far end of the
//         capture path and the v2 retrain has almost no views from there. The calibrated pose keeps f080's
//         camera and turns it 50° toward the bed (pitch 4° down, fov 50): the bed, its shelf, the desk's
//         right edge and the box are sharp. Judged by eye against the render (no photo of this framing).

export interface Framing {
  readonly pos: readonly [number, number, number];
  readonly look: readonly [number, number, number];
  readonly fov: number;
}

export const CALIBRATION = {
  room: { pos: [-3.127, -0.071, -0.872], look: [0.668, -0.119, 22.826], fov: 48.5 },
  desk: { pos: [-0.345, -2, 11.562], look: [2.013, -2.145, 35.446], fov: 40 },
  bed: { pos: [-3.127, -0.071, -0.872], look: [15.213, 1.603, 14.518], fov: 50 },
} as const satisfies Record<string, Framing>;

/**
 * The pickable things as boxes in world coordinates (navigation 2026-11-01): `c` the centre, `size`
 * the full width / height / depth, `yaw` the facing (radians) the box is turned to. Picking is a ray
 * through the camera against these, so they follow the camera and the head-turn.
 *
 * They are slabs derived from the stills' own rectangles: each was unprojected through its
 * framing's pose at a depth along the view, so that pose projects it back onto today's rectangle
 * (tests/hotspots.test.ts keeps those rectangles as the expected values). The two stills are not one
 * rigid scene (room.jpg and desk_top.jpg disagree about where the monitors are by up to ~350 px at
 * any depth), so each framing has its own set; the door is on the end wall opposite the window,
 * eyeballed in the 床 framing, where the splat has no views: about a 70 px sliver at the right edge
 * of 房间 and fully in view once the head is turned right.
 */
export interface HotBox {
  readonly c: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  readonly yaw: number;
}
const DOOR: HotBox = { c: [20.772, 2.487, 17.154], size: [8.083, 13.367, 0.1], yaw: 0.873 };
export const HOTSPOTS = {
  /** From the 房间 pose, at depths 26 desk, 25 monitors, 24 tower, 18 bed and box, 24.5 lamp. */
  room: {
    desk: { c: [-3.462, 0.007, 25.513], size: [21.446, 8.589, 0.1], yaw: 0.159 },
    monitorL: { c: [-6.563, -1.81, 24.993], size: [6.657, 4.029, 0.1], yaw: 0.159 },
    monitorR: { c: [0.047, -1.798, 23.935], size: [6.432, 3.904, 0.1], yaw: 0.159 },
    tower: { c: [-12.52, 6.644, 24.952], size: [1.874, 2.811, 0.1], yaw: 0.159 },
    bed: { c: [10.423, 4.929, 15.198], size: [7.153, 6.144, 0.1], yaw: 0.159 },
    box: { c: [5.157, 6.263, 16.044], size: [3.369, 3.478, 0.1], yaw: 0.159 },
    lamp: { c: [4.149, -0.537, 22.774], size: [2.33, 4.415, 0.1], yaw: 0.159 },
    door: DOOR,
  },
  /** From the 桌子 pose at depth 12: the monitors run up out of the frame (their visible lower halves are the rectangles). */
  desk: {
    monitorL: { c: [-2.839, -6.343, 23.84], size: [6.212, 5.047, 0.1], yaw: 0.098 },
    monitorR: { c: [3.633, -6.343, 23.202], size: [6.212, 5.047, 0.1], yaw: 0.098 },
    lamp: { c: [7.17, -4.441, 22.361], size: [2.046, 2.511, 0.1], yaw: 0.098 },
  },
  /** 床: only the door. */
  bed: { door: DOOR },
} as const satisfies Record<string, Record<string, HotBox>>;
