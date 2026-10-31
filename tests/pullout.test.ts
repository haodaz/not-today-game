// @vitest-environment happy-dom
// room-scene addition 2026-11-01: the day-18 pull-out. The timeline as a pure function (t → camera,
// island size, dark alpha); the three ending cuts; the photo fallback; the splat path with a fake
// scene. Nothing here touches WebGL or three.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { applyEvent, type EventDraft, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import { createStore, type Store } from "@state/store";
import type { State } from "@state/types.gen";
import { constants, membersOf } from "@state/variables";
import { blockableNights } from "@state/nights";
import { desktopActions } from "@world/desktop/actions";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { mountDesktop, type ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { endingNext, startEnding } from "@world/endings/flow";
import { DARK_ASSETS, DARK_INNER, darkSprites, EYE_COUNT, renderPullOut, TENTACLE_COUNT } from "@world/endings/pullout";
import { createPullDriver } from "@world/endings/pullout-dom";
import { renderEnding } from "@world/endings/view";
import { BACKDROPS } from "@world/fit";
import { syncLoop } from "@world/loop/runtime";
import { createMotion } from "@world/motion/dom";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { createSplatLayer, type SplatHooks, type SplatScene } from "@world/room/splat/layer";
import { clampPose, lookOf, POSES, WINDOW_CLAMP, type Pose } from "@world/room/splat/pose";
import { DARK_MS, easeInCubic, PULL_CUT_MS, PULL_END, PULL_MS, pullFrom, pullMove, pullOutAt, ROOM_CENTRE } from "@world/room/splat/pullout";

const LAST = constants.lastDay as number;
const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the timeline (pure): t → camera, island, dark", () => {
  it("starts at the framing, ends at ≈ (67, −29, −1) looking at the room", () => {
    for (const from of ["room", "desk"] as const) {
      const a = pullOutAt(0, from);
      expect(dist(a.camera.pos, POSES[from].pos)).toBeCloseTo(0, 9);
      expect(a.camera.yaw).toBeCloseTo(POSES[from].yaw, 6);
      expect(a.island).toBe(1);
      expect(a.dark).toBe(0);
      const z = pullOutAt(PULL_MS, from);
      expect(z.camera.pos).toEqual(PULL_END);
      // Looking at the room's centre: the look point lies on the ray to it.
      const l = lookOf(z.camera, dist(PULL_END, ROOM_CENTRE));
      expect(dist(l, ROOM_CENTRE)).toBeLessThan(1e-6);
      expect(z.dark).toBe(1);
      expect(z.island).toBeCloseTo(dist(POSES[from].pos, ROOM_CENTRE) / dist(PULL_END, ROOM_CENTRE), 9);
      expect(z.island).toBeLessThan(0.15);
      expect(z.camera.fov).toBe(POSES[from].fov);
    }
  });

  it("ease-in: slow away from the room (an eighth of the way at half time)", () => {
    const half = pullOutAt(PULL_MS / 2, "room").camera.pos;
    const frac = dist(half, POSES.room.pos) / dist(PULL_END, POSES.room.pos);
    expect(frac).toBeCloseTo(easeInCubic(0.5), 9);
    expect(easeInCubic(0.5)).toBe(0.125);
  });

  it("the dark is 0 until the last 3 s, then rises to 1", () => {
    expect(DARK_MS).toBe(3000);
    expect(pullOutAt(PULL_MS - DARK_MS, "desk").dark).toBe(0);
    expect(pullOutAt(PULL_MS - DARK_MS / 2, "desk").dark).toBeCloseTo(0.5, 9);
  });

  it("property: the island only shrinks and the dark only grows, both within 0 … 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: PULL_MS }), fc.integer({ min: 0, max: PULL_MS }), fc.constantFrom("room", "desk"), (a, b, from) => {
        const [x, y] = a <= b ? [a, b] : [b, a];
        const fx = pullOutAt(x, from);
        const fy = pullOutAt(y, from);
        expect(fy.island).toBeLessThanOrEqual(fx.island + 1e-12);
        expect(fy.dark).toBeGreaterThanOrEqual(fx.dark);
        for (const v of [fx.island, fx.dark]) expect(v >= 0 && v <= 1).toBe(true);
      }),
    );
  });

  it("a scripted move: the clamp is bypassed (it leaves the window bounds), the player's moves still clamp", () => {
    expect(pullMove("desk").clamp).toBeNull();
    const far = pullOutAt(PULL_MS, "desk").camera;
    expect(far.pos.x).toBeGreaterThan(WINDOW_CLAMP.xMax);
    expect(clampPose(far)).not.toEqual(far);
  });

  it("pullFrom: the view's framing, 屏幕 → 桌子, the door → 房间", () => {
    expect([pullFrom("room"), pullFrom("desk"), pullFrom("desktop"), pullFrom("door")]).toEqual(["room", "desk", "desk", "room"]);
  });
});

// ——— the flow: the three ending cuts ———

function storeOver(initial: State): Store {
  let state = initial;
  const events: GameEvent[] = [];
  return {
    getState: () => state,
    getEvents: () => events,
    getStartDay: () => initial.day,
    getRunId: () => "run-test",
    appendEvent(draft: EventDraft) {
      const e = { ...draft, day: state.day } as GameEvent;
      state = applyEvent(state, e);
      events.push(e);
      return state;
    },
    subscribe: () => () => {},
  };
}

function ctxAt(state: State, ending: "bad" | "survive" | "good", nowMs = 1000) {
  const store = storeOver(state);
  store.appendEvent({ kind: "ending", ending });
  const timers: { ms: number; fn: () => void }[] = [];
  let now = nowMs;
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "desk"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => now };
  return { ctx, timers, at: (ms: number) => void (now = ms) };
}

/** Everything the good ending asks for, on the last day (as in tests/endings.test.ts). */
const goodLast = (): State => {
  const base = f(LAST);
  const six = membersOf("recognised")! as string[];
  return {
    ...base,
    flags: [...base.flags, "shook_hand"],
    found: [...new Set([...base.found, ...six])] as State["found"],
    recognised: [...six] as State["recognised"],
    raids: Object.fromEntries(blockableNights.map((d) => [String(d), { blockedWith: "chick", gave: null }])),
    affinity: constants.affinityThreshold as number,
    letItDoUnchecked: 0,
  };
};

describe("the three ending cuts", () => {
  it("good cuts at 2 s (the dark never shows), bad and survive hold the full 6 s", () => {
    expect(PULL_CUT_MS).toEqual({ good: 2000, bad: PULL_MS, survive: PULL_MS });
    expect(pullOutAt(PULL_CUT_MS.good, "desk").dark).toBe(0);
    expect(pullOutAt(PULL_CUT_MS.bad, "desk").dark).toBe(1);
  });

  it.each([
    ["survive", () => f(LAST), "credits"],
    ["bad", () => ({ ...f(LAST), san: 0 }), "you"],
    ["good", goodLast, "credits"],
  ] as const)("%s on night 18: the pull-out first, no page, clicks do nothing; at its cut the ending card", (ending, state, first) => {
    const { ctx, timers } = ctxAt(state(), ending);
    startEnding(ctx);
    expect(ctx.session.pullOut).toMatchObject({ ending, from: "desk", startMs: 1000, cutMs: PULL_CUT_MS[ending] });
    expect(ctx.session.endingPage).toBeNull();
    endingNext(ctx);
    expect(ctx.session.endingPage).toBeNull();
    // A second start (syncLoop runs after every change) does not restart it.
    startEnding(ctx);
    expect(timers).toHaveLength(1);
    expect(timers[0]!.ms).toBe(PULL_CUT_MS[ending]);
    timers.shift()!.fn();
    expect(ctx.session.pullOut).toBeNull();
    expect(ctx.session.endingPage?.phase).toBe(first);
  });

  it("before the last day there is no pull-out (a SAN-0 bad ending on day 3 goes straight to its page)", () => {
    const { ctx, timers } = ctxAt({ ...f(3), san: 0 }, "bad");
    startEnding(ctx);
    expect(ctx.session.pullOut).toBeNull();
    expect(ctx.session.endingPage?.phase).toBe("you");
    expect(timers).toHaveLength(0);
  });

  it("while it plays, renderEnding shows the pull-out page, not a card", () => {
    const { ctx } = ctxAt(f(LAST), "survive");
    startEnding(ctx);
    const out = renderEnding({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session, startDay: 1, nowMs: 1000 }).value;
    expect(out).toMatch(/^<div class="stage ending-page pullout-page" data-ending="survive" data-from="desk"/);
    expect(out).not.toContain("credits");
  });
});

// ——— the fallback: the photo island and the dark layer ———

describe("the photo fallback (splat off): same timeline over black, same dark", () => {
  const model = (nowMs: number, from: "room" | "desk" = "desk") => {
    const session = initialSession(DEFAULT_CLOCK, "left", from);
    session.pullOut = { ending: "survive", from, startMs: 0, cutMs: PULL_MS };
    return { state: f(LAST), events: [], session, startDay: 1, nowMs };
  };
  const vars = (out: string) => {
    const m = /style="--island:([\d.]+);--dark:([\d.]+)"/.exec(out)!;
    return { island: Number(m[1]), dark: Number(m[2]) };
  };

  it("the page carries the timeline's island and dark at render time; the island is the framing's photo", () => {
    for (const ms of [0, 1500, 3000, 4500, 6000]) {
      const v = vars(renderPullOut(model(ms)).value);
      const f0 = pullOutAt(ms, "desk");
      expect(v.island).toBeCloseTo(f0.island, 4);
      expect(v.dark).toBeCloseTo(f0.dark, 4);
    }
    expect(renderPullOut(model(0, "room")).value).toContain(`class="pull-island" style="background-image:url(${BACKDROPS.room})"`);
    expect(renderPullOut(model(0)).value).toContain(`class="pull-dark" style="background-image:url(${DARK_ASSETS.tile})"`);
  });

  it("the sprites: three eyes and the tentacles, dense at the edges, none near the room; out of sync", () => {
    const s = darkSprites();
    expect(s.filter((x) => x.kind === "eye")).toHaveLength(EYE_COUNT);
    expect(s.filter((x) => x.kind === "tentacle")).toHaveLength(TENTACLE_COUNT);
    expect(new Set(s.filter((x) => x.kind === "eye").map((x) => x.src))).toEqual(new Set(DARK_ASSETS.eyes));
    for (const x of s) expect(x.r).toBeGreaterThanOrEqual(DARK_INNER);
    // Denser toward the edges: more sprites in the outer half of the band than the inner.
    const mid = (DARK_INNER + 1.1) / 2;
    expect(s.filter((x) => x.r >= mid).length).toBeGreaterThan(s.filter((x) => x.r < mid).length);
    // Out of sync: no two eyes share a period and phase.
    const eyes = s.filter((x) => x.kind === "eye").map((x) => `${x.period}/${x.phase}`);
    expect(new Set(eyes).size).toBe(eyes.length);
    expect(darkSprites()).toEqual(s);
    // The final island sits well inside the empty centre (the mask clears √2 × its half size).
    expect(pullOutAt(PULL_MS, "desk").island * Math.SQRT2).toBeLessThan(DARK_INNER);
  });

  it("the driver writes the frame every tick from the same clock", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    session.pullOut = { ending: "bad", from: "desk", startMs: 0, cutMs: PULL_MS };
    let now = 0;
    root.innerHTML = renderPullOut({ state: f(LAST), events: [], session, startDay: 1, nowMs: 0 }).value;
    const queue: (() => void)[] = [];
    const ctx = { session, now: () => now } as unknown as ActionContext;
    const driver = createPullDriver((fn) => (queue.push(fn), queue.length), () => {})(root, ctx);
    driver.after();
    now = 4500;
    queue.shift()!();
    const page = root.querySelector<HTMLElement>(".pullout-page")!;
    expect(Number(page.style.getPropertyValue("--island"))).toBeCloseTo(pullOutAt(4500, "desk").island, 4);
    expect(Number(page.style.getPropertyValue("--dark"))).toBeCloseTo(0.5, 4);
    session.pullOut = null;
    queue.shift()!();
    expect(queue).toHaveLength(0);
    driver.destroy();
    root.remove();
  });
});

// ——— in the game: the fallback mount and the splat path ———

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.innerHTML = "";
});
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fakeScene() {
  const poses: Pose[] = [];
  const canvases = [document.createElement("canvas"), document.createElement("canvas")] as [HTMLCanvasElement, HTMLCanvasElement];
  const host = document.createElement("div");
  host.append(...canvases);
  const scene: SplatScene = { host, canvases, ensureCollapsed: () => Promise.resolve(), setSize: () => {}, render: (p) => void poses.push(p), dispose: () => {} };
  return { scene, poses };
}

function mountLast(withSplat: SplatScene | null) {
  const root = document.createElement("div");
  root.id = "app";
  document.body.appendChild(root);
  const store = createStore({ startDay: LAST });
  let hooks: SplatHooks | null = null;
  const layer = withSplat ? createSplatLayer({ load: async () => withSplat, idle: (fn) => fn() }) : null;
  const m = mountDesktop(root, {
    store,
    clock: DEFAULT_CLOCK,
    view: "desk",
    render: renderGame,
    actions: { ...desktopActions, ...loopActions },
    onChange: (ctx) => syncLoop(ctx),
    onKey: loopKeys,
    motion: createMotion,
    splat: layer ? (r, ctx) => (hooks = layer(r, ctx)) : undefined,
    pull: createPullDriver(),
  });
  destroy = m.destroy;
  return { root, store, session: m.session, hooks: () => hooks };
}

describe("in the game", () => {
  it("splat off: the photo island over black, the dark layer, no splat, a black letterbox", async () => {
    const { root, store, session } = mountLast(null);
    await frame();
    store.appendEvent({ kind: "ending", ending: "survive" });
    await frame();
    expect(session.pullOut).not.toBeNull();
    const page = root.querySelector<HTMLElement>(":scope > .pullout-page")!;
    expect(page).not.toBeNull();
    expect(page.querySelector(".pull-island")).not.toBeNull();
    expect(page.querySelectorAll(".pull-dark img").length).toBe(EYE_COUNT + TENTACLE_COUNT);
    expect(root.classList.contains("splat-pull")).toBe(false);
    expect(root.querySelector('[class*="splat"]')).toBeNull();
    expect(root.style.getPropertyValue("--letterbox")).toBe("none");
    await wait(60);
    // The driver writes the frame on the live page.
    const live = root.querySelector<HTMLElement>(":scope > .pullout-page")!;
    const island = Number(live.style.getPropertyValue("--island"));
    expect(island).toBeGreaterThan(0);
    expect(island).toBeLessThanOrEqual(1);
  });

  it("splat on: a scripted move along the timeline, clamp bypassed, the photo island steps aside; it leaves at the cut", async () => {
    const fake = fakeScene();
    const { root, store, session, hooks } = mountLast(fake.scene);
    await frame();
    await wait(0);
    expect(hooks()!.status()).toBe("ready");
    // Which ending doesn't matter to the layer; survive is due on a plain last day.
    store.appendEvent({ kind: "ending", ending: "survive" });
    await frame();
    const layer = root.querySelector<HTMLElement>(":scope > .splat-layer");
    expect(layer).not.toBeNull();
    expect(layer!.nextElementSibling!.classList.contains("pullout-page")).toBe(true);
    expect(root.classList.contains("splat-pull")).toBe(true);
    await wait(80);
    await frame();
    const p = fake.poses.at(-1)!;
    const elapsed = Date.now() - session.pullOut!.startMs;
    // On the timeline (within a frame or two of now).
    const lo = pullOutAt(Math.max(0, elapsed - 120), "desk").camera.pos;
    const hi = pullOutAt(elapsed + 20, "desk").camera.pos;
    expect(p.pos.x).toBeGreaterThanOrEqual(Math.min(lo.x, hi.x) - 1e-9);
    expect(p.pos.x).toBeLessThanOrEqual(Math.max(lo.x, hi.x) + 1e-9);
    // The cut (simulated): the session drops the pull-out; the layer leaves with it.
    session.pullOut = null;
    await frame();
    await frame();
    expect(root.querySelector(".splat-layer")).toBeNull();
    expect(root.classList.contains("splat-pull")).toBe(false);
  });
});
