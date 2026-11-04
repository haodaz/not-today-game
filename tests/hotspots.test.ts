// Room-scene navigation 2026-11-01: the camera as math, the boxes in world coordinates, picking by a
// ray, and the head turn's limits. Today's rectangles (shots.ts, desk.json) are the expected values
// for what the framings' fixed poses give.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CALIBRATION, HOTSPOTS } from "@world/room/splat/calibration";
import { basisOf, boxFromRect, boxRect, project, rayBox, rayThrough, STAGE_H, STAGE_W } from "@world/room/splat/geometry";
import { LOOK, NO_TURN, turnEased, turnForDrag, turned } from "@world/room/splat/head";
import { fixedRects, HOT_IDS, HOT_ORDER, hotIdsIn, hotRect, hotRects, hotViewOf, pickHot, type HotId, type HotView } from "@world/room/splat/hotspots";
import { POSES, type Pose } from "@world/room/splat/pose";
import { deskLayout } from "@world/room/desk";
import { DESK_SHOT, ROOM_SHOT, type Rect } from "@world/room/shots";

const near = (a: Rect, b: Rect, px = 3) => {
  expect(Math.abs(a.l - b.l), `l ${a.l} vs ${b.l}`).toBeLessThanOrEqual(px);
  expect(Math.abs(a.t - b.t), `t ${a.t} vs ${b.t}`).toBeLessThanOrEqual(px);
  expect(Math.abs(a.w - b.w), `w ${a.w} vs ${b.w}`).toBeLessThanOrEqual(px);
  expect(Math.abs(a.h - b.h), `h ${a.h} vs ${b.h}`).toBeLessThanOrEqual(px);
};
const centre = (r: Rect) => ({ x: r.l + r.w / 2, y: r.t + r.h / 2 });

describe("the camera as pure math", () => {
  it("the screen centre is straight ahead; right is +x at yaw 0; up is −y; a positive yaw turns right, a positive pitch looks down", () => {
    const p: Pose = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, fov: 50 };
    const at = (x: number, y: number, z: number) => project(p, { x, y, z })!;
    expect(at(0, 0, 10)).toMatchObject({ x: STAGE_W / 2, y: STAGE_H / 2 });
    expect(at(1, 0, 10).x).toBeGreaterThan(STAGE_W / 2);
    expect(at(0, -1, 10).y).toBeLessThan(STAGE_H / 2);
    expect(at(0, 1, 10).y).toBeGreaterThan(STAGE_H / 2);
    // Turning right moves the scene left; looking down moves it up.
    expect(project({ ...p, yaw: 0.1 }, { x: 0, y: 0, z: 10 })!.x).toBeLessThan(STAGE_W / 2);
    expect(project({ ...p, pitch: 0.1 }, { x: 0, y: 0, z: 10 })!.y).toBeLessThan(STAGE_H / 2);
    // Behind the camera is not on the stage.
    expect(project(p, { x: 0, y: 0, z: -3 })).toBeNull();
  });

  it("the vertical fov is the angle the stage's height spans; the aspect is 16:9", () => {
    const p: Pose = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, fov: 60 };
    const h = Math.tan((30 * Math.PI) / 180) * 10;
    expect(project(p, { x: 0, y: -h, z: 10 })!.y).toBeCloseTo(0, 6);
    expect(project(p, { x: h * (16 / 9), y: 0, z: 10 })!.x).toBeCloseTo(STAGE_W, 6);
  });

  it("property: a ray through a pixel projects back to that pixel, whatever the pose", () => {
    const pose = fc.record({
      pos: fc.record({ x: fc.double({ min: -10, max: 10, noNaN: true }), y: fc.double({ min: -3, max: 3, noNaN: true }), z: fc.double({ min: -10, max: 10, noNaN: true }) }),
      yaw: fc.double({ min: -3, max: 3, noNaN: true }),
      pitch: fc.double({ min: -0.5, max: 0.5, noNaN: true }),
      fov: fc.double({ min: 30, max: 70, noNaN: true }),
    });
    fc.assert(
      fc.property(pose, fc.double({ min: 0, max: STAGE_W, noNaN: true }), fc.double({ min: 0, max: STAGE_H, noNaN: true }), fc.double({ min: 1, max: 40, noNaN: true }), (p, px, py, t) => {
        const ray = rayThrough(p, px, py);
        const q = project(p, { x: ray.o.x + ray.d.x * t, y: ray.o.y + ray.d.y * t, z: ray.o.z + ray.d.z * t }, basisOf(p));
        expect(q).not.toBeNull();
        expect(q!.x).toBeCloseTo(px, 4);
        expect(q!.y).toBeCloseTo(py, 4);
      }),
    );
  });

  it("a box built from a rectangle at a depth projects back onto it (the ray hits it at that rectangle's centre)", () => {
    const rect = { l: 300, t: 200, w: 400, h: 250 };
    for (const id of ["room", "desk", "bed"] as const) {
      const box = boxFromRect(POSES[id], rect, 18);
      const back = boxRect(POSES[id], box)!;
      // The slab only turns about the up axis, so a tilted camera (床: 4° down) is a few px off.
      near(back, rect, 8);
      const hit = rayBox(rayThrough(POSES[id], 500, 325), box)!;
      expect(hit).toBeGreaterThan(17);
      expect(hit).toBeLessThan(19);
      expect(rayBox(rayThrough(POSES[id], 1200, 800), box)).toBeNull();
    }
  });
});

describe("the boxes (calibration.ts) and today's rectangles", () => {
  it("room: the fixed 房间 pose gives back today's click areas", () => {
    const r = fixedRects("room");
    near(r.desk!, ROOM_SHOT.desk);
    near(r.tower!, ROOM_SHOT.tower);
    near(r.bed!, ROOM_SHOT.bed);
    near(r.monitorL!, ROOM_SHOT.monitors.left);
    near(r.monitorR!, ROOM_SHOT.monitors.right);
    near(r.box!, ROOM_SHOT.box);
    near(r.lamp!, ROOM_SHOT.lamp);
  });

  it("desk: the fixed 桌子 pose gives back the monitors' visible halves (desk.json) and the lamp, clipped to the stage", () => {
    const r = fixedRects("desk");
    near(r.monitorL!, DESK_SHOT.monitors.left, 5);
    near(r.monitorR!, DESK_SHOT.monitors.right, 5);
    near(r.lamp!, deskLayout.lamp, 5);
    // Nothing else is pointed at on the tabletop (the cutouts are their own buttons).
    expect(Object.keys(r).sort()).toEqual(["lamp", "monitorL", "monitorR"]);
  });

  it("the door is on the end wall: a sliver at the right edge of 房间, fully in view from 床", () => {
    const sliver = fixedRects("room").door!;
    expect(sliver.l).toBeGreaterThan(1500);
    expect(sliver.l + sliver.w).toBeCloseTo(STAGE_W, 6);
    expect(sliver.w).toBeLessThan(120);
    const full = fixedRects("bed").door!;
    expect(full.w).toBeGreaterThan(200);
    expect(full.l).toBeGreaterThan(0);
    expect(full.l + full.w).toBeLessThan(STAGE_W);
    expect(Object.keys(fixedRects("bed"))).toEqual(["door"]);
  });

  it("every box is well formed and the tables agree with the id list", () => {
    for (const view of Object.keys(HOTSPOTS) as HotView[]) {
      expect([...hotIdsIn(view)].sort()).toEqual(Object.keys(HOTSPOTS[view]).sort());
      expect([...HOT_ORDER[view]].sort()).toEqual([...hotIdsIn(view)].sort());
      for (const id of hotIdsIn(view)) {
        const b = (HOTSPOTS[view] as Record<string, (typeof HOTSPOTS)["room"]["desk"]>)[id]!;
        expect(b.size.every((s) => s > 0), `${view}.${id}`).toBe(true);
        expect(b.c.every(Number.isFinite)).toBe(true);
      }
    }
    for (const id of HOT_IDS) expect(["room", "desk", "bed"].some((v) => hotIdsIn(v as HotView).includes(id)), id).toBe(true);
  });

  it("the framings: the bed is f080's camera turned 50° toward the bed (pitch 4° down, fov 50); the desk is raised 2.0 over the old close pose", () => {
    expect(CALIBRATION.bed.pos).toEqual(CALIBRATION.room.pos);
    expect((POSES.bed.yaw * 180) / Math.PI).toBeCloseTo(50, 1);
    expect((POSES.bed.pitch * 180) / Math.PI).toBeCloseTo(4, 1);
    expect(POSES.bed.fov).toBe(50);
    expect(CALIBRATION.desk.pos[1]).toBe(-2);
    expect(CALIBRATION.desk.look[1] - CALIBRATION.desk.pos[1]).toBeCloseTo(-0.145, 6);
  });

  it("hotViewOf: the splat framings a view shows (床 and 窗 are facings with fixed rectangles now, room-turn R3)", () => {
    expect(["room", "desk", "bed", "window", "door", "desktop"].map(hotViewOf)).toEqual(["room", "desk", null, null, null, null]);
  });
});

describe("picking is a ray against the boxes", () => {
  const pick = (view: HotView, p: { x: number; y: number }, pose: Pose = POSES[view], allowed?: (id: HotId) => boolean) => pickHot(pose, view, p.x, p.y, allowed);

  it("房间: the centre of each thing picks it; the monitors win over the desk behind them, the lamp too", () => {
    const rects = fixedRects("room");
    for (const id of ["tower", "monitorL", "monitorR", "lamp", "box", "bed"] as const) expect(pick("room", centre(rects[id]!)), id).toBe(id);
    // The desk's own surface, outside the monitors and the lamp.
    expect(pick("room", { x: 700, y: 590 })).toBe("desk");
    expect(pick("room", { x: 250, y: 540 })).toBe("desk");
  });

  it("房间: the wall, the window and the floor are nothing; the door is the sliver above the bed", () => {
    expect(pick("room", { x: 600, y: 120 })).toBeNull();
    expect(pick("room", { x: 80, y: 300 })).toBeNull();
    expect(pick("room", { x: 800, y: 880 })).toBeNull();
    expect(pick("room", { x: 1585, y: 350 })).toBe("door");
    // Below the sliver's top the bed is nearer.
    expect(pick("room", { x: 1585, y: 700 })).toBe("bed");
  });

  it("桌子: each monitor, the lamp; the keyboard and the desk are nothing (they are the cutouts' and the photo's)", () => {
    expect(pick("desk", { x: 420, y: 120 })).toBe("monitorL");
    expect(pick("desk", { x: 1090, y: 120 })).toBe("monitorR");
    expect(pick("desk", centre(fixedRects("desk").lamp!))).toBe("lamp");
    expect(pick("desk", { x: 700, y: 520 })).toBeNull();
    expect(pick("desk", { x: 400, y: 800 })).toBeNull();
  });

  it("床: only the door", () => {
    expect(pick("bed", centre(fixedRects("bed").door!))).toBe("door");
    expect(pick("bed", { x: 300, y: 500 })).toBeNull();
  });

  it("what is not allowed is not picked: the tower only while the computer is off", () => {
    const c = centre(fixedRects("room").tower!);
    expect(pick("room", c, POSES.room, () => true)).toBe("tower");
    expect(pick("room", c, POSES.room, (id) => id !== "tower")).toBeNull();
  });

  it("a rectangle and a ray agree where the box faces the camera: every pixel of a thing's rectangle picks it (or what stands in front)", () => {
    const view: HotView = "room";
    for (const id of ["bed", "box", "tower"] as const) {
      const r = fixedRects(view)[id]!;
      for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]] as const) expect(pick(view, { x: r.l + r.w * fx, y: r.t + r.h * fy }), `${id} ${fx},${fy}`).toBe(id);
    }
  });

  it("the hotspots follow the camera: turning the head right moves them left, and the same pixel then picks something else", () => {
    const turnedRight = turned(POSES.room, { yaw: LOOK.yaw, pitch: 0 });
    const before = hotRect(POSES.room, "room", "bed")!;
    const after = hotRect(turnedRight, "room", "bed")!;
    expect(after.l).toBeLessThan(before.l - 100);
    // The bed's old centre is now where the wall is; its new centre picks it.
    expect(pickHot(turnedRight, "room", centre(after).x, centre(after).y)).toBe("bed");
    expect(pickHot(turnedRight, "room", centre(before).x, centre(before).y)).not.toBe("bed");
    // And the door, a sliver at rest, comes into view.
    expect(hotRect(turnedRight, "room", "door")!.w).toBeGreaterThan(hotRect(POSES.room, "room", "door")!.w * 3);
  });

  it("property: turning about the camera moves a thing by the same angle whatever its depth; rects stay on the stage", () => {
    fc.assert(
      fc.property(fc.double({ min: -LOOK.yaw, max: LOOK.yaw, noNaN: true }), fc.double({ min: -LOOK.pitch, max: LOOK.pitch, noNaN: true }), fc.constantFrom<HotView>("room", "desk"), (yaw, pitch, view) => {
        const rects = hotRects(turned(POSES[view], { yaw, pitch }), view);
        for (const r of Object.values(rects)) {
          expect(r.l).toBeGreaterThanOrEqual(0);
          expect(r.t).toBeGreaterThanOrEqual(0);
          expect(r.l + r.w).toBeLessThanOrEqual(STAGE_W + 1e-6);
          expect(r.t + r.h).toBeLessThanOrEqual(STAGE_H + 1e-6);
        }
      }),
    );
  });

  it("property: the pick is deterministic and always one of the framing's ids (or nothing)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: STAGE_W, noNaN: true }), fc.double({ min: 0, max: STAGE_H, noNaN: true }), fc.constantFrom<HotView>("room", "desk", "bed"), (x, y, view) => {
        const a = pickHot(POSES[view], view, x, y);
        expect(pickHot(POSES[view], view, x, y)).toBe(a);
        if (a !== null) expect(hotIdsIn(view)).toContain(a);
      }),
    );
  });
});

describe("the head turn (head.ts)", () => {
  it("limits: ±15° of yaw, ±8° of pitch, 600 ms back", () => {
    expect(LOOK.yaw).toBeCloseTo((15 * Math.PI) / 180, 12);
    expect(LOOK.pitch).toBeCloseTo((8 * Math.PI) / 180, 12);
    expect(LOOK.easeMs).toBe(600);
  });

  it("a drag looks where the mouse goes (right turns right, up looks up) and stops at the limit", () => {
    expect(turnForDrag(100, 0).yaw).toBeGreaterThan(0);
    expect(turnForDrag(-100, 0).yaw).toBeLessThan(0);
    expect(turnForDrag(0, 60).pitch).toBeGreaterThan(0); // down is positive pitch in this world
    expect(turnForDrag(0, -60).pitch).toBeLessThan(0);
    expect(turnForDrag(1e6, 1e6)).toEqual({ yaw: LOOK.yaw, pitch: LOOK.pitch });
    expect(turnForDrag(-1e6, -1e6)).toEqual({ yaw: -LOOK.yaw, pitch: -LOOK.pitch });
    expect(turnForDrag(0, 0)).toEqual(NO_TURN);
    expect(turnForDrag(LOOK.yawPx, 0).yaw).toBeCloseTo(LOOK.yaw, 12);
  });

  it("property: the turn never leaves the limits and is monotone in the drag", () => {
    fc.assert(
      fc.property(fc.double({ min: -5000, max: 5000, noNaN: true }), fc.double({ min: -5000, max: 5000, noNaN: true }), fc.double({ min: 0, max: 500, noNaN: true }), (dx, dy, more) => {
        const a = turnForDrag(dx, dy);
        expect(Math.abs(a.yaw)).toBeLessThanOrEqual(LOOK.yaw + 1e-12);
        expect(Math.abs(a.pitch)).toBeLessThanOrEqual(LOOK.pitch + 1e-12);
        expect(turnForDrag(dx + more, dy).yaw).toBeGreaterThanOrEqual(a.yaw - 1e-12);
      }),
    );
  });

  it("easing back: the released turn at 0, nothing at 1, monotone in between, never past the start", () => {
    const from = { yaw: 0.2, pitch: -0.1 };
    expect(turnEased(from, 0)).toEqual(from);
    expect(turnEased(from, 1).yaw).toBeCloseTo(0, 12);
    expect(turnEased(from, 1).pitch).toBeCloseTo(0, 12);
    let last = Infinity;
    for (let i = 0; i <= 20; i++) {
      const t = turnEased(from, i / 20);
      expect(Math.abs(t.yaw)).toBeLessThanOrEqual(last + 1e-12);
      last = Math.abs(t.yaw);
      expect(Math.sign(t.pitch) <= 0).toBe(true);
    }
    expect(turnEased(from, 5).yaw).toBeCloseTo(0, 12);
    expect(turnEased(from, -5)).toEqual(from);
  });

  it("turned(): only yaw and pitch change; no walking; the fov stays; a turn past the limit is held at it", () => {
    const t = turned(POSES.desk, { yaw: 0.1, pitch: 0.05 });
    expect(t.pos).toBe(POSES.desk.pos);
    expect(t.fov).toBe(POSES.desk.fov);
    expect(t.yaw).toBeCloseTo(POSES.desk.yaw + 0.1, 12);
    expect(turned(POSES.room, NO_TURN)).toBe(POSES.room);
    expect(turned(POSES.room, { yaw: 3, pitch: 3 }).yaw).toBeCloseTo(POSES.room.yaw + LOOK.yaw, 12);
    expect(turned(POSES.room, { yaw: 3, pitch: 3 }).pitch).toBeCloseTo(POSES.room.pitch + LOOK.pitch, 12);
  });
});
