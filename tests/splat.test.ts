// @vitest-environment happy-dom
// room-scene (motion segment): poses, interpolation and the window clamp as pure functions; the
// collapse mix by ring; the kill switch; the fallback path with a fake scene; and no splat work in
// happy-dom (no WebGL, no three).
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { ringOf } from "@state/stages";
import { createStore } from "@state/store";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop } from "@world/desktop/controller";
import type { Session } from "@world/desktop/model";
import { BACKDROPS } from "@world/fit";
import { syncLoop } from "@world/loop/runtime";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { createMotion } from "@world/motion/dom";
import { MOTION } from "@world/motion/timing";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { hasWebGL, splatEnabled } from "@world/room/splat/gate";
import { splatForGame } from "@world/room/splat";
import { createSplatLayer, SPLAT_FADE_MS, type LoadScene, type SplatHooks, type SplatScene } from "@world/room/splat/layer";
import { COLLAPSE_MIX, collapseMix, splatLook } from "@world/room/splat/look";
import { splatMoveFor } from "@world/room/splat/moves";
import { angleDelta, clampPose, easeInOutCubic, lerpPose, lookOf, moveBetween, poseAt, poseFromLook, POSES, WINDOW_CLAMP, type Pose } from "@world/room/splat/pose";
import { CALIBRATION } from "@world/room/splat/calibration";
import { formatCalibration, framingOf, nudge, poseOfRow } from "@world/room/splat/calibrate";
import { calibrating } from "@world/room/splat";
import { CHOSEN, CROSSFADE_MS, viewMoveMs, walkMs } from "@world/motion/timing";
import { fitStage } from "@world/fit";

const deg = (r: number) => (r * 180) / Math.PI;
const near = (a: Pose, b: Pose, digits = 6) => {
  expect(a.pos.x).toBeCloseTo(b.pos.x, digits);
  expect(a.pos.y).toBeCloseTo(b.pos.y, digits);
  expect(a.pos.z).toBeCloseTo(b.pos.z, digits);
  expect(a.yaw).toBeCloseTo(b.yaw, digits);
  expect(a.pitch).toBeCloseTo(b.pitch, digits);
};

describe("poses (README) and interpolation", () => {
  it("the three framings come from calibration.ts: 房间 f080, 桌子 the tabletop pose, 床 f080 turned toward the bed", () => {
    for (const id of ["room", "desk", "bed"] as const) {
      const f = CALIBRATION[id];
      expect(POSES[id].pos).toEqual({ x: f.pos[0], y: f.pos[1], z: f.pos[2] });
      expect(POSES[id].fov).toBe(f.fov);
    }
    // lookOf goes back along the same direction; yaw is atan2(dx, dz) of the table's look.
    const back = poseFromLook(POSES.room.pos, lookOf(POSES.room));
    near(back, POSES.room);
    for (const id of ["room", "desk", "bed"] as const) {
      const f = CALIBRATION[id];
      expect(POSES[id].yaw).toBeCloseTo(Math.atan2(f.look[0] - f.pos[0], f.look[2] - f.pos[2]), 12);
    }
    // Window side is negative yaw: every framing faces away from it.
    for (const p of Object.values(POSES)) expect(deg(p.yaw)).toBeGreaterThan(0);
  });

  it("the fov interpolates along a move when both ends have one", () => {
    const a = { ...POSES.room, fov: 40 };
    const b = { ...POSES.desk, fov: 60 };
    expect(lerpPose(a, b, 0.5).fov).toBe(50);
    expect(lerpPose({ ...a, fov: undefined }, b, 0.5).fov).toBe(60);
  });

  it("lerpPose: the endpoints, the midpoint, the short arc", () => {
    near(lerpPose(POSES.room, POSES.desk, 0), POSES.room);
    near(lerpPose(POSES.room, POSES.desk, 1), POSES.desk);
    const mid = lerpPose(POSES.room, POSES.desk, 0.5);
    expect(mid.pos.x).toBeCloseTo((POSES.room.pos.x + POSES.desk.pos.x) / 2, 9);
    expect(mid.yaw).toBeCloseTo((POSES.room.yaw + POSES.desk.yaw) / 2, 9);
    // Across ±π it goes the short way.
    const a: Pose = { pos: POSES.room.pos, yaw: Math.PI - 0.1, pitch: 0 };
    const b: Pose = { pos: POSES.room.pos, yaw: -Math.PI + 0.1, pitch: 0 };
    expect(Math.abs(angleDelta(a.yaw, lerpPose(a, b, 0.5).yaw))).toBeCloseTo(0.1, 9);
  });

  it("easing: 0 → 0, 1 → 1, ½ → ½, monotone, clamped", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
    fc.assert(fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (x, y) => {
      if (x <= y) expect(easeInOutCubic(x)).toBeLessThanOrEqual(easeInOutCubic(y) + 1e-12);
    }));
  });
});

describe("the window clamp", () => {
  it("its bounds come from the allowed poses, which it leaves unchanged", () => {
    expect(WINDOW_CLAMP.yawMin).toBe(Math.min(POSES.room.yaw, POSES.desk.yaw, POSES.bed.yaw));
    expect(WINDOW_CLAMP.xMax).toBe(Math.max(POSES.room.pos.x, POSES.desk.pos.x, POSES.bed.pos.x));
    for (const p of Object.values(POSES)) expect(clampPose(p)).toBe(p);
  });

  it("never toward the window (yaw below yawMin) or past it (x above xMax); idempotent", () => {
    const pose = fc.record({
      pos: fc.record({ x: fc.double({ min: -20, max: 20, noNaN: true }), y: fc.double({ min: -2, max: 2, noNaN: true }), z: fc.double({ min: -20, max: 20, noNaN: true }) }),
      yaw: fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
      pitch: fc.double({ min: -1, max: 1, noNaN: true }),
    });
    fc.assert(fc.property(pose, (p) => {
      const c = clampPose(p);
      expect(c.yaw).toBeGreaterThanOrEqual(WINDOW_CLAMP.yawMin);
      expect(c.pos.x).toBeLessThanOrEqual(WINDOW_CLAMP.xMax);
      expect(clampPose(c)).toEqual(c);
      expect(c.pitch).toBe(p.pitch);
    }));
  });

  it("property: every pose on a move between allowed poses is already inside the clamp", () => {
    const ids = fc.constantFrom("room", "desk", "bed") as fc.Arbitrary<keyof typeof POSES>;
    fc.assert(fc.property(ids, ids, fc.double({ min: 0, max: 1, noNaN: true }), (a, b, t) => {
      const p = lerpPose(POSES[a], POSES[b], t);
      expect(clampPose(p)).toBe(p);
    }));
  });

  it("a scripted move may bypass it (clamp: null); the default pulls the same pose back", () => {
    const out: Pose = { pos: { x: 67, y: -29, z: -1 }, yaw: -2.5, pitch: 0.2 };
    const path = () => out;
    expect(poseAt({ from: POSES.room, to: POSES.room, path, clamp: null }, 1)).toBe(out);
    const pulled = poseAt({ from: POSES.room, to: POSES.room, path }, 1);
    expect(pulled.yaw).toBe(WINDOW_CLAMP.yawMin);
    expect(pulled.pos.x).toBe(WINDOW_CLAMP.xMax);
    // And a custom clamp is used as given.
    expect(poseAt({ from: POSES.room, to: POSES.desk, clamp: () => POSES.bed }, 0.3)).toBe(POSES.bed);
  });

  it("poseAt: eased, from the departing pose to the arriving one", () => {
    const m = moveBetween("room", "desk");
    near(poseAt(m, 0), POSES.room);
    near(poseAt(m, 1), POSES.desk);
    near(poseAt(m, 0.25), lerpPose(POSES.room, POSES.desk, easeInOutCubic(0.25)));
  });
});

describe("which moves, and the look by ring", () => {
  it("the splat carries 房间 ↔ 桌子; the other facings (床, 门, 窗: stills you turn to, room-turn) and 屏幕 keep the CSS", () => {
    for (const [a, b] of [["room", "desk"], ["desk", "room"]] as const) expect(splatMoveFor(a, b), `${a}→${b}`).not.toBeNull();
    for (const [a, b] of [["room", "bed"], ["bed", "room"], ["desk", "bed"], ["room", "window"], ["room", "door"], ["door", "room"], ["desk", "desktop"], ["desktop", "room"], ["room", "room"], ["bed", "door"]] as const) expect(splatMoveFor(a, b), `${a}→${b}`).toBeNull();
  });

  it("the mix by ring: 0 before ring room, room 40 %, door 100 %", () => {
    expect(COLLAPSE_MIX).toEqual({ room: 0.4, door: 1 });
    for (let day = 1; day <= 18; day++) {
      const ring = ringOf(day);
      expect(collapseMix(day), `day ${day} (${ring})`).toBe(ring === "room" ? 0.4 : ring === "door" ? 1 : 0);
    }
    expect(collapseMix(13)).toBe(0.4);
    expect(collapseMix(12)).toBe(0);
    expect(collapseMix(18)).toBe(1);
  });

  it("night: the gap light white before ring wall, pink from it; none by day", () => {
    expect(splatLook(2, "night")).toEqual({ night: true, gap: "white", mix: 0 });
    expect(splatLook(10, "night").gap).toBe("pink");
    expect(splatLook(16, "night")).toEqual({ night: true, gap: "pink", mix: 1 });
    expect(splatLook(16, "work")).toEqual({ night: false, gap: "none", mix: 1 });
  });
});

describe("the kill switch", () => {
  it("dark by default (decision 2026-11-02): on only with ?splat=1 in a dev build, with WebGL, without reduced motion", () => {
    const on = { webgl: true, reducedMotion: false, dev: true };
    expect(splatEnabled({ ...on, search: "" })).toBe(false);
    expect(splatEnabled({ ...on, search: "?day=4" })).toBe(false);
    expect(splatEnabled({ ...on, search: "?splat=0" })).toBe(false);
    expect(splatEnabled({ ...on, search: "?splat=true" })).toBe(false);
    expect(splatEnabled({ ...on, search: "?day=3&splat=1" })).toBe(true);
    // Production never loads it, even when asked.
    expect(splatEnabled({ ...on, search: "?splat=1", dev: false })).toBe(false);
    expect(splatEnabled({ ...on, search: "?splat=1", webgl: false })).toBe(false);
    expect(splatEnabled({ ...on, search: "?splat=1", reducedMotion: true })).toBe(false);
  });
  it("no splat work in happy-dom: no WebGL, so the game gets no layer and nothing is loaded", () => {
    expect(hasWebGL(document)).toBe(false);
    let loads = 0;
    expect(splatForGame(window, async () => (loads++, fakeScene().scene))).toBeUndefined();
    expect(loads).toBe(0);
  });
});

// ——— the layer with a fake scene ———

function fakeScene() {
  const poses: Pose[] = [];
  const mixes: number[] = [];
  let disposed = 0;
  const canvases = [document.createElement("canvas"), document.createElement("canvas")] as [HTMLCanvasElement, HTMLCanvasElement];
  const host = document.createElement("div");
  host.append(...canvases);
  const scene: SplatScene = {
    host,
    canvases,
    ensureCollapsed: () => Promise.resolve(),
    setSize: () => {},
    render: (p, mix) => void (poses.push(p), mixes.push(mix)),
    dispose: () => void disposed++,
  };
  return { scene, poses, mixes, disposed: () => disposed };
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});

function mount(opts: { load?: LoadScene; day?: number; view?: Session["view"]; size?: [number, number]; calibrate?: boolean; print?: (s: string) => void } = {}) {
  const root = document.createElement("div");
  root.id = "app";
  if (opts.size) {
    const [w, h] = opts.size;
    Object.defineProperty(root, "clientWidth", { get: () => w });
    Object.defineProperty(root, "clientHeight", { get: () => h });
  }
  document.body.appendChild(root);
  let hooks: SplatHooks | null = null;
  // The game's views have no splat move now (房间 ↔ 床 waits for 床); the layer's machinery is driven
  // through 房间 → 桌子 here with an injected move table, which the CSS push still carries.
  const moves = (a: string, b: string) => (a !== b && ["room", "desk"].includes(a) && ["room", "desk"].includes(b) ? moveBetween(a as "room" | "desk", b as "room" | "desk") : null);
  const layer = opts.load ? createSplatLayer({ load: opts.load, idle: (fn) => fn(), calibrate: opts.calibrate, print: opts.print, moves }) : null;
  const m = mountDesktop(root, {
    store: createStore({ startDay: opts.day ?? 1 }),
    clock: DEFAULT_CLOCK,
    view: opts.view ?? "room",
    render: renderGame,
    actions: { ...desktopActions, ...loopActions },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    motion: createMotion,
    splat: layer ? (r, ctx) => (hooks = layer(r, ctx)) : undefined,
  });
  // playtest-1105 R3 / R2: waking queues the boot beat and the box owns the screen; not this test's subject.
  m.session.dialogue = EMPTY_DIALOGUE;
  m.session.onboard = "done";
  destroy = m.destroy;
  return { root, session: m.session, hooks: () => hooks! };
}

/** To a view the way the game does it now: point at it (a proxy), or back out with Esc. */
async function go(root: HTMLElement, view: string): Promise<void> {
  if (view === "room") {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await frame();
    return;
  }
  const hot = root.querySelector<HTMLElement>(`[data-action="view"][data-view="${view}"]`);
  if (!hot) throw new Error(`nothing to point at for ${view}`);
  hot.click();
  await frame();
}

const splatNodes = (root: HTMLElement) => root.querySelectorAll('[class*="splat"]').length;
const rootClasses = (root: HTMLElement) => [...root.children].map((c) => c.className.replace(/\s*m-\S+/g, "")).sort();

describe("the layer: fallback, the move, the cross-fade", () => {
  it("before the scene is ready a move inserts nothing: the DOM is that of a mount without the layer", async () => {
    const pending = mount({ load: () => new Promise<SplatScene>(() => {}) });
    await frame();
    expect(pending.hooks().status()).toBe("loading");
    await go(pending.root, "desk");
    expect(splatNodes(pending.root)).toBe(0);
    const pendingShape = rootClasses(pending.root);
    destroy!();
    document.body.innerHTML = "";

    const plain = mount();
    await frame();
    await go(plain.root, "desk");
    expect(rootClasses(plain.root)).toEqual(pendingShape);
  });

  it("a load error leaves the layer off; moves keep the CSS push", async () => {
    const r = mount({ load: () => Promise.reject(new Error("no file")) });
    await frame();
    await wait(0);
    expect(r.hooks().status()).toBe("off");
    await go(r.root, "desk");
    expect(splatNodes(r.root)).toBe(0);
  });

  it("ready: 房间 → 桌子 renders the splat from the room pose toward the desk pose, behind the stage, then leaves", async () => {
    const fake = fakeScene();
    const r = mount({ load: async () => fake.scene, size: [2185, 1160] });
    await frame();
    await wait(0);
    expect(r.hooks().status()).toBe("ready");
    await go(r.root, "desk");
    const layer = r.root.querySelector<HTMLElement>(":scope > .splat-layer");
    expect(layer).not.toBeNull();
    // Right before the live stage, which holds its photo back meanwhile; the CSS push's copy is underneath.
    const stage = layer!.nextElementSibling as HTMLElement;
    expect(stage.classList.contains("stage")).toBe(true);
    expect(stage.classList.contains("m-nobg")).toBe(true);
    // Exactly the stage rectangle (fit.ts), the library's host inside it.
    const fit = fitStage(2185, 1160, 1600, 900);
    expect(parseFloat(layer!.style.left)).toBeCloseTo(fit.left, 3);
    expect(parseFloat(layer!.style.top)).toBeCloseTo(fit.top, 3);
    expect(layer!.style.width).toBe("1600px");
    expect(layer!.style.height).toBe("900px");
    expect(layer!.style.transform).toBe(`scale(${fit.scale})`);
    expect(parseFloat(layer!.style.left)).toBeCloseTo(parseFloat(stage.style.getPropertyValue("--stage-x")), 3);
    expect(fake.scene.host.parentElement).toBe(layer);
    for (const cls of ["splat-clean", "splat-collapsed", "splat-vignette", "splat-photo", "splat-night", "splat-gap", "splat-lamp"]) expect(layer!.querySelector(`.${cls}`), cls).not.toBeNull();
    expect(layer!.querySelector<HTMLElement>(".splat-photo")!.style.backgroundImage).toContain(BACKDROPS.desk);
    near(fake.poses[0]!, POSES.room, 3);
    expect(layer!.classList.contains("night")).toBe(false);

    // A re-render mid-move: the layer is put back before the new stage, still one.
    await wait(120);
    r.root.querySelector<HTMLElement>('[data-action="settings-open"]')!.click();
    await frame();
    expect(r.root.querySelectorAll(":scope > .splat-layer")).toHaveLength(1);
    expect(r.root.querySelector(":scope > .splat-layer")!.nextElementSibling!.classList.contains("stage")).toBe(true);

    // Still moving past the old 400 ms: the move and the CSS push under it last 900 ms.
    await wait(MOTION.view + 100 - 120);
    expect(r.root.querySelector(":scope > .splat-layer")).not.toBeNull();
    expect(r.root.querySelector(":scope > .stage:not(.m-ghost):not(.m-backdrop)")!.classList.contains("m-nobg")).toBe(true);
    expect(r.root.querySelector(":scope > .m-backdrop")).not.toBeNull();

    // After the move: gone; the last poses reached the desk; the photo had faded in.
    await wait(CHOSEN.roomDesk - MOTION.view + 300);
    expect(splatNodes(r.root)).toBe(0);
    near(fake.poses.at(-1)!, POSES.desk, 3);
    for (const p of fake.poses) expect(clampPose(p)).toEqual(p);
    expect(SPLAT_FADE_MS).toBe(200);
  });

  it("门 and 屏幕 never use it", async () => {
    const fake = fakeScene();
    const r = mount({ load: async () => fake.scene });
    await frame();
    await wait(0);
    await go(r.root, "door");
    expect(splatNodes(r.root)).toBe(0);
    expect(fake.poses).toHaveLength(0);
  });

  it("from ring room the collapsed splat is mixed in (day 16: 100 %)", async () => {
    const fake = fakeScene();
    const r = mount({ load: async () => fake.scene, day: 16 });
    await frame();
    await wait(0);
    await go(r.root, "desk");
    expect(r.root.querySelector(".splat-layer")).not.toBeNull();
    expect(fake.mixes[0]).toBe(1);
    await wait(CHOSEN.roomDesk + 300);
  });

  it("calibration (?splatcal=1, dev): the still pose with the photo at 50 %, keys tune it, P prints the table", async () => {
    const fake = fakeScene();
    const printed: string[] = [];
    const r = mount({ load: async () => fake.scene, calibrate: true, print: (s) => void printed.push(s) });
    await frame();
    await wait(0);
    await frame();
    await frame();
    expect(r.root.classList.contains("splat-cal")).toBe(true);
    const layer = r.root.querySelector<HTMLElement>(":scope > .splat-layer")!;
    expect(layer).not.toBeNull();
    expect(layer.querySelector<HTMLElement>(".splat-photo")!.style.opacity).toBe("0.5");
    expect(layer.querySelector<HTMLElement>(".splat-photo")!.style.backgroundImage).toContain(BACKDROPS.room);
    near(fake.poses.at(-1)!, POSES.room, 6);
    expect(r.root.querySelector(".splat-cal-readout")!.textContent).toContain("room: { pos:");
    // A key: the pose turns; the game never sees it.
    let gameSaw = 0;
    const onKey = () => void gameSaw++;
    window.addEventListener("keydown", onKey);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }));
    await frame();
    await frame();
    expect(fake.poses.at(-1)!.yaw).toBeCloseTo(POSES.room.yaw + Math.PI / 180, 6);
    expect(gameSaw).toBe(0);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p" }));
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain(formatCalibration({ desk: framingOf(POSES.desk) }));
    expect(r.hooks().calibration().room.look).not.toEqual(CALIBRATION.room.look);
    window.removeEventListener("keydown", onKey);
    destroy!();
    destroy = null;
    expect(document.querySelector(".splat-cal")).toBeNull();
  });
});

describe("900 ms moves and calibration helpers", () => {
  it("walking: the move takes as long as the path, both ways (房间↔桌子 900, 桌子↔屏幕 500); a head turn between facings 650, two 400 ms turns to the opposite wall (room-turn correction 2026-11-04); the rest the 400 ms crossfade", () => {
    expect(CHOSEN.roomDesk).toBe(900);
    for (const [a, b, ms] of [["room", "desk", 900], ["desk", "desktop", 500], ["room", "desktop", 900], ["room", "bed", 650], ["bed", "door", 650], ["door", "window", 650], ["window", "room", 650], ["room", "door", 800], ["bed", "window", 800], ["desk", "door", MOTION.view]] as const) {
      expect(viewMoveMs(a, b), `${a} → ${b}`).toBe(ms);
      expect(viewMoveMs(b, a), `${b} → ${a}`).toBe(ms);
    }
    expect([CHOSEN.turn, CHOSEN.turnFast]).toEqual([650, 400]);
    expect(CROSSFADE_MS).toBe(400);
    expect(walkMs("room", "desk")).toBe(500);
  });

  it("calibration only with ?splatcal=1 in a dev build", () => {
    expect(calibrating("?splatcal=1", true)).toBe(true);
    expect(calibrating("?splatcal=1", false)).toBe(false);
    expect(calibrating("", true)).toBe(false);
    expect(calibrating("?splatcal=0", true)).toBe(false);
  });

  it("nudge: each key moves one axis; other keys are not calibration keys", () => {
    const p = POSES.desk;
    expect(nudge(p, "ArrowLeft", false)!.yaw).toBeCloseTo(p.yaw - (0.1 * Math.PI) / 180, 9);
    expect(nudge(p, "ArrowUp", true)!.pitch).toBeCloseTo(p.pitch + Math.PI / 180, 9);
    expect(nudge(p, "]", false)!.fov).toBe((p.fov ?? 50) + 0.5);
    expect(nudge(p, "[", true)!.fov).toBe((p.fov ?? 50) - 5);
    const w = nudge(p, "w", false)!;
    expect(Math.hypot(w.pos.x - p.pos.x, w.pos.z - p.pos.z)).toBeCloseTo(0.02, 9);
    expect(nudge(p, "R", false)!.pos.y).toBeCloseTo(p.pos.y - 0.02, 9);
    expect(nudge(p, "Escape", false)).toBeNull();
    expect(nudge(p, "x", false)).toBeNull();
  });

  it("the printed table round-trips: the shipped calibration prints as calibration.ts's rows", () => {
    for (const id of ["room", "desk", "bed"] as const) {
      const row = framingOf(poseOfRow(CALIBRATION[id]));
      expect(row.pos).toEqual([...CALIBRATION[id].pos]);
      expect(row.fov).toBe(CALIBRATION[id].fov);
      near(poseOfRow(row), POSES[id], 3);
    }
    const d = CALIBRATION.desk;
    expect(formatCalibration({ desk: framingOf(POSES.desk) })).toBe(`  desk: { pos: [${d.pos.join(", ")}], look: [${framingOf(POSES.desk).look.join(", ")}], fov: ${d.fov} },`);
  });

  it("destroy disposes the scene", async () => {
    const fake = fakeScene();
    mount({ load: async () => fake.scene });
    await frame();
    await wait(0);
    destroy!();
    destroy = null;
    expect(fake.disposed()).toBe(1);
  });
});
