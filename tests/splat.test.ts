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
import { createMotion } from "@world/motion/dom";
import { MOTION } from "@world/motion/timing";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { hasWebGL, splatEnabled } from "@world/room/splat/gate";
import { splatForGame } from "@world/room/splat";
import { createSplatLayer, SPLAT_FADE_MS, type LoadScene, type SplatHooks, type SplatScene } from "@world/room/splat/layer";
import { COLLAPSE_MIX, collapseMix, splatLook } from "@world/room/splat/look";
import { splatMoveFor } from "@world/room/splat/moves";
import { angleDelta, clampPose, easeInOutCubic, lerpPose, lookOf, poseAt, poseFromLook, POSES, WINDOW_CLAMP, type Pose } from "@world/room/splat/pose";

const deg = (r: number) => (r * 180) / Math.PI;
const near = (a: Pose, b: Pose, digits = 6) => {
  expect(a.pos.x).toBeCloseTo(b.pos.x, digits);
  expect(a.pos.y).toBeCloseTo(b.pos.y, digits);
  expect(a.pos.z).toBeCloseTo(b.pos.z, digits);
  expect(a.yaw).toBeCloseTo(b.yaw, digits);
  expect(a.pitch).toBeCloseTo(b.pitch, digits);
};

describe("poses (README) and interpolation", () => {
  it("the three frames: 房间 f080, 桌子 f43, 床 f159, as pos + look", () => {
    expect(POSES.room.pos).toEqual({ x: -3.127, y: -0.071, z: -0.872 });
    expect(POSES.desk.pos).toEqual({ x: 0.023, y: 0.053, z: 0.324 });
    expect(POSES.bed.pos).toEqual({ x: -6.312, y: 0.068, z: 4.09 });
    // lookOf goes back along the same direction.
    const back = poseFromLook(POSES.room.pos, lookOf(POSES.room));
    near(back, POSES.room);
    expect(deg(POSES.room.yaw)).toBeCloseTo(9.1, 1);
    expect(deg(POSES.desk.yaw)).toBeCloseTo(-6.35, 1);
    expect(deg(POSES.bed.yaw)).toBeCloseTo(61.1, 1);
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
    const m = splatMoveFor("room", "desk")!;
    near(poseAt(m, 0), POSES.room);
    near(poseAt(m, 1), POSES.desk);
    near(poseAt(m, 0.25), lerpPose(POSES.room, POSES.desk, easeInOutCubic(0.25)));
  });
});

describe("which moves, and the look by ring", () => {
  it("房间 ↔ 桌子 (and 床 when it exists); never 门 or 屏幕, never a view to itself", () => {
    expect(splatMoveFor("room", "desk")).not.toBeNull();
    expect(splatMoveFor("desk", "room")).not.toBeNull();
    expect(splatMoveFor("desk", "bed")).not.toBeNull();
    for (const [a, b] of [["room", "door"], ["door", "room"], ["desk", "desktop"], ["desktop", "room"], ["room", "room"]] as const) expect(splatMoveFor(a, b)).toBeNull();
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
  it("on unless ?splat=0, no WebGL, or reduced motion", () => {
    expect(splatEnabled({ search: "", webgl: true, reducedMotion: false })).toBe(true);
    expect(splatEnabled({ search: "?day=3&splat=1", webgl: true, reducedMotion: false })).toBe(true);
    expect(splatEnabled({ search: "?splat=0", webgl: true, reducedMotion: false })).toBe(false);
    expect(splatEnabled({ search: "?day=3&splat=0", webgl: true, reducedMotion: false })).toBe(false);
    expect(splatEnabled({ search: "", webgl: false, reducedMotion: false })).toBe(false);
    expect(splatEnabled({ search: "", webgl: true, reducedMotion: true })).toBe(false);
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
  const scene: SplatScene = {
    canvases: [document.createElement("canvas"), document.createElement("canvas")],
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

function mount(opts: { load?: LoadScene; day?: number; view?: Session["view"] } = {}) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  let hooks: SplatHooks | null = null;
  const layer = opts.load ? createSplatLayer({ load: opts.load, idle: (fn) => fn() }) : null;
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
  destroy = m.destroy;
  return { root, session: m.session, hooks: () => hooks! };
}

async function go(root: HTMLElement, view: string): Promise<void> {
  const chip = root.querySelector<HTMLElement>(`[data-action="view"][data-view="${view}"]`);
  if (!chip) throw new Error(`no chip for ${view}`);
  chip.click();
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
    const r = mount({ load: async () => fake.scene });
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
    expect(layer!.style.getPropertyValue("--scale")).toBe(stage.style.getPropertyValue("--scale"));
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

    // After the move: gone; the last poses reached the desk; the photo had faded in.
    await wait(MOTION.view + 300);
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
    await wait(MOTION.view + 300);
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
