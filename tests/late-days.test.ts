// @vitest-environment happy-dom
// late-days FR2–FR6: red eyes and the maw from the late ring, Kuro closing pages it does not want
// read, and the browser's text tentacles (parameters and sampler; the canvas itself is not drawn).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "./fixtures/browser-day-16.json";
import { PAGE_ID, readingPageId } from "@state/closes";
import { parseDayFile, dayFiles } from "@state/days/table";
import { applyEvent, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import { ringOf } from "@state/stages";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { BEATS, isNight, type BeatClock } from "@world/desktop/beat";
import { parseBrowserPage, setBrowserPagesForTests } from "@world/desktop/browser/data";
import { bezier, coversHeadline, passMsOf, sampleGlyphs, tentacleCurve, tentacleParams, visibleSpan } from "@world/desktop/browser/tentacles";
import type { ActionContext } from "@world/desktop/controller";
import { KuroBodyElement, MAW_FRAMES } from "@world/desktop/kuro/body";
import { hudKuro, kuroBodyState, renderKuro } from "@world/desktop/kuro/mini";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { closerDelay, CLOSER_MAW_MS } from "@world/late/closer";
import { lateRing, overlayRing } from "@world/late/rings";
import { crawlKeyframes, crawlMs, CRAWL_MAX_MS, CRAWL_MIN_MS, edgePath, pathLength } from "@world/late/crawl";
import { loopActions, renderGame } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

afterEach(() => {
  setBrowserPagesForTests(null);
  setLocale("zh");
});

const DAY = { beat: "work", time: "10:00" } as BeatClock;
const NIGHT = { beat: "night", time: "23:41" } as BeatClock;

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
function ctxOf(store: Store, clock: BeatClock = DAY, view: Session["view"] = "desktop") {
  const timers: { ms: number; fn: () => void }[] = [];
  const session = initialSession(clock, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }) };
  return { ctx, timers, run: () => timers.shift()!.fn() };
}
const app = (ctx: ActionContext, night = false) => ({ state: ctx.store.getState(), events: ctx.store.getEvents(), startDay: 1, session: ctx.session, night, nowMs: 0 });
// Midday UTC, so the footer's date is the same in every timezone (as desktop-snapshots does).
const NOW_MS = Date.UTC(2026, 9, 31, 12);
const desktop = (ctx: ActionContext) => renderGame(ctx.store, ctx.session, NOW_MS).value;
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const firstLateDay = Array.from({ length: constants.lastDay }, (_, i) => i + 1).find(lateRing)!;

describe("the gates come from the cycle table", () => {
  it("late ring = door (days 16–18 today); overlay from wall, as the desktop presents it", () => {
    expect(firstLateDay).toBe(16);
    expect(ringOf(16)).toBe("door");
    for (let d = 1; d <= constants.lastDay; d++) expect(lateRing(d), `day ${d}`).toBe(ringOf(d) === "door");
    expect(overlayRing(9, "work")).toBeNull();
    expect(overlayRing(10, "work")).toBeNull(); // calm daytime looks like the first ring
    expect(overlayRing(10, "night")).toBe("wall");
    expect(overlayRing(13, "work")).toBe("room");
    expect(overlayRing(16, "work")).toBe("door");
  });
});

describe("FR2 red eyes", () => {
  it("snapshot: the HUD at day 15 vs day 16 (the eyes); the pill's face too", () => {
    const hud = (day: number) => {
      const { ctx } = ctxOf(storeAt(day), DAY, "room");
      const out = renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
      // The body's own markup: up to the end of the HUD corner's first item (the camera chips are gone).
      return /<div class="hud-kuro">.*?<\/button><\/div>/s.exec(out)![0];
    };
    const d15 = hud(15);
    const d16 = hud(16);
    expect(d15).not.toContain("data-red");
    expect(d16).toContain('data-kuro-slot data-state="idle" data-red="1"');
    expect({ d15, d16 }).toMatchSnapshot();
    const { ctx } = ctxOf(storeAt(16));
    expect(renderKuro(app(ctx)).value).toContain('src="/kuro/k3d_base_red.png"');
  });

  it("the body element reads data-red: the same pairs, `_red` files; the maw is never red", () => {
    const body = new KuroBodyElement(document);
    const slot = document.createElement("span");
    slot.dataset.state = "idle";
    slot.dataset.red = "1";
    body.attach(slot);
    expect([...body.element.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual(["/kuro/k3d_base_red.png", "/kuro/k3d_idle2_red.png"]);
    body.set("maw", true);
    expect([...body.element.querySelectorAll("img")].map((i) => i.getAttribute("src"))).toEqual(["/kuro/k3d_maw.png"]);
  });
});

describe("FR3 the maw", () => {
  it("three single frames, cut: the old look is gone at once, no second frame", () => {
    const body = new KuroBodyElement(document);
    body.set("idle");
    body.set("maw2");
    expect(body.element.children).toHaveLength(1);
    expect(body.element.firstElementChild!.className).toBe("layer cut");
    expect(MAW_FRAMES).toEqual({ maw: "k3d_maw", maw2: "k3d_maw2", maw3: "k3d_maw3" });
  });

  it("maw2 on a late night after holding up nothing; maw3 on the last night; maw while it closes", () => {
    const night = (day: number, raid?: { gave: string | null }) => {
      const store = storeAt(day);
      const { ctx } = ctxOf(store, NIGHT, "room");
      const state = raid ? { ...store.getState(), raids: { ...store.getState().raids, [String(day)]: raid } } : store.getState();
      return kuroBodyState({ ...app(ctx, true), state });
    };
    // The hand of night 16 answered with nothing given; with the deliverable handed over, no maw.
    expect(night(16, { gave: null })).toBe("maw2");
    expect(night(16, { gave: "d16-hand" })).toBe("rest");
    expect(night(16)).toBe("rest");
    expect(night(constants.lastDay)).toBe("maw3");
    const { ctx } = ctxOf(storeAt(16));
    ctx.session.kuroCloser = { pageId: "d16:reading:1", line: { zh: "x", en: "x" }, where: "browser", phase: "maw", token: 1 };
    expect(kuroBodyState(app(ctx))).toBe("maw");
  });

  it("property: no `_red` and no maw before the late ring (every day, beat, raid outcome, closer phase)", () => {
    const early = Array.from({ length: firstLateDay - 1 }, (_, i) => i + 1);
    fc.assert(
      fc.property(
        fc.constantFrom(...early),
        fc.constantFrom(...BEATS),
        fc.constantFrom(null, { gave: null }, { gave: "given" }),
        fc.constantFrom(null, "wait", "crawl", "maw"),
        (day, beat, raid, phase) => {
          const store = storeAt(day);
          const { ctx } = ctxOf(store, { beat, time: "12:00" } as BeatClock, "room");
          if (phase) ctx.session.kuroCloser = { pageId: `d${day}:reading:0`, line: { zh: "x", en: "x" }, where: "browser", phase: phase as "wait", token: 1 };
          const state = raid ? { ...store.getState(), raids: { [String(day)]: raid } } : store.getState();
          const a = { ...app(ctx, beat === "night"), state };
          expect(kuroBodyState(a)).not.toMatch(/^maw/);
          expect(hudKuro(a).value + renderKuro(a).value).not.toMatch(/_red|data-red/);
        },
      ),
      { numRuns: 120 },
    );
  });
});

describe("FR4 Kuro closes what it does not want you to read", () => {
  const page16 = parseBrowserPage(fixture, "fixtures/browser-day-16.json");
  const open16 = () => {
    setBrowserPagesForTests(new Map([[16, page16]]));
    const t = ctxOf(storeAt(16));
    t.ctx.session.leftApp = "browser";
    return t;
  };

  it("the loader reads the fixture; the two fields are strict", () => {
    expect(page16.reading[1]).toEqual({ h: "老周", sec: "", when: "今天", kuroCloses: true, kuroClosesLine: { zh: "这个不用看。", en: "You don’t need this one." } });
    expect(page16.reading[0]).not.toHaveProperty("kuroCloses");
    const bad = (patch: Record<string, unknown>) => {
      const raw = structuredClone(fixture) as any;
      Object.assign(raw.reading[0], patch);
      return () => parseBrowserPage(raw, "x");
    };
    expect(bad({ kuroClosesLine: { zh: "a", en: "b" } })).toThrow(/needs kuroCloses: true/);
    expect(bad({ kuroCloses: true })).toThrow(/needs a line/);
    expect(bad({ kuroCloses: false })).toThrow(/must be true/);
    expect(bad({ kuroCloses: true, kuroClosesLine: { zh: "a", en: "" } })).toThrow(/en: must be a non-empty/);
    expect(bad({ kuroCloses: true, kuroClosesLine: { zh: "a", en: "b", ja: "c" } })).toThrow(/unknown key "ja"/);
    // A day item may carry the same two.
    const day16 = structuredClone(dayFiles.get(16)!) as any;
    const raw = { day: 16, beats: {}, items: [{ id: "doc", text: "t", unlock: "start", done: "flag:x", required: false, kuroCloses: true, kuroClosesLine: { zh: "a", en: "b" } }], delivery: { minMinutes: 1, waitMinutes: 2 } };
    void day16;
    expect(parseDayFile(raw, "day-16.json").items[0]).toMatchObject({ kuroCloses: true, kuroClosesLine: { zh: "a", en: "b" } });
  });

  it("snapshot: open → 1.2 s → crawl to the × → maw 400 ms → closed, kuroClosed, its line in the box; nothing lost", () => {
    const { ctx, timers, run } = open16();
    act(ctx, "br-open", { i: "1" });
    const before = desktop(ctx);
    expect(before).toContain('<section class="br-page" data-page-id="d16:reading:1"');
    expect(before).not.toContain("kuro-closer");
    expect(timers[0]!.ms).toBe(1200);
    run();
    const crawling = desktop(ctx);
    expect(crawling).toContain('<span class="kpet kuro-closer" data-kuro-slot data-state="crawl" data-phase="crawl" data-red="1"');
    expect(crawling).toContain('<div class="hud-kuro away"></div>');
    expect((crawling.match(/data-kuro-slot/g) ?? []).length).toBe(1);
    expect(timers[0]!.ms).toBe(CRAWL_MAX_MS); // the maw waits for the longest trip: it has arrived
    run();
    expect(desktop(ctx)).toContain('data-state="maw" data-phase="maw"');
    expect(timers[0]!.ms).toBe(CLOSER_MAW_MS);
    run();
    expect(ctx.store.getEvents().at(-1)).toMatchObject({ kind: "kuroClosed", pageId: "d16:reading:1" });
    const after = desktop(ctx);
    expect(after).not.toContain("br-page");
    expect(after).toContain("这个不用看。");
    expect(after).toContain('<button type="button" class="read" data-action="br-open" data-i="1">老周'); // still there to reopen
    expect({ before, after }).toMatchSnapshot();
  });

  it("reopened, it comes again, each time 0.3 s sooner; in English its English line", () => {
    const { ctx, timers, run } = open16();
    setLocale("en");
    const waits: number[] = [];
    for (let n = 0; n < 5; n++) {
      ctx.session.dialogue = { queue: [], line: 0 };
      act(ctx, "br-open", { i: "1" });
      waits.push(timers[0]!.ms);
      run();
      run();
      run();
    }
    expect(waits).toEqual([1200, 900, 600, 300, 0]);
    expect(waits).toEqual([0, 1, 2, 3, 4].map(closerDelay));
    expect(ctx.session.dialogue.queue.at(-1)!.lines[0]!.t).toBe("You don’t need this one.");
    expect(ctx.store.getEvents().filter((e) => e.kind === "kuroClosed")).toHaveLength(5);
  });

  it("closing it yourself, or leaving the browser, calls it off; an entry without the flag is left alone", () => {
    const { ctx, timers, run } = open16();
    act(ctx, "br-open", { i: "1" });
    act(ctx, "br-close");
    run();
    expect(ctx.session.kuroCloser).toBeNull();
    act(ctx, "br-open", { i: "2" });
    act(ctx, "dock", { app: "msgs" });
    expect(ctx.session.browserRead).toBeNull();
    while (timers.length) run();
    expect(ctx.store.getEvents().some((e) => e.kind === "kuroClosed")).toBe(false);
    ctx.session.leftApp = "browser";
    act(ctx, "br-open", { i: "0" });
    expect(timers).toHaveLength(0);
  });

  it("it waits while it is speaking in the box (one body)", () => {
    const { ctx, timers, run } = open16();
    act(ctx, "br-open", { i: "1" });
    ctx.session.dialogue = { queue: [{ key: "kuro:16:x", lines: [{ k: "speaker", t: "…" }], ending: { kind: "none" }, voice: "kuro" }], line: 0 };
    run();
    expect(ctx.session.kuroCloser!.phase).toBe("wait");
    expect(timers[0]!.ms).toBe(500);
  });

  it("not before the late ring", () => {
    const early = parseBrowserPage({ ...structuredClone(fixture), day: 15 }, "x");
    setBrowserPagesForTests(new Map([[15, early]]));
    const { ctx, timers } = ctxOf(storeAt(15));
    ctx.session.leftApp = "browser";
    act(ctx, "br-open", { i: "1" });
    expect(timers).toHaveLength(0);
  });

  it("kuroClosed: d<day>:reading:<i> or d<day>:item:<id>, of its own day; it changes nothing", () => {
    expect(PAGE_ID.test(readingPageId(16, 1))).toBe(true);
    const s = f(16);
    expect(applyEvent(s, { kind: "kuroClosed", day: 16, pageId: "d16:reading:1" } as GameEvent)).toBe(s);
    expect(applyEvent(s, { kind: "kuroClosed", day: 16, pageId: "d16:item:task1" } as GameEvent)).toBe(s);
    expect(() => applyEvent(s, { kind: "kuroClosed", day: 16, pageId: "d15:reading:1" } as GameEvent)).toThrow(/not a page of day 16/);
    expect(() => applyEvent(s, { kind: "kuroClosed", day: 16, pageId: "reading:1" } as GameEvent)).toThrow(/pageId must look like/);
  });
});

describe("correction: Kuro crawls along edges, never in a straight line", () => {
  // A page window above-left of the HUD corner; the body (140 px) ends at its slot (0, 0).
  const box = { l: -600, t: 40, w: 640, h: 260 };
  const from = { x: 700, y: 620 };
  const path = edgePath(from, box, 140);

  it("bottom edge → right edge → top edge to the ×, each leg axis-aligned (no diagonal)", () => {
    const bottom = box.t + box.h + 70;
    const right = box.l + box.w + 70;
    expect(path[0]).toMatchObject({ x: 700, y: 620, at: 0 });
    expect(path.at(-1)).toMatchObject({ x: 0, y: 0, rot: 0, at: 1 });
    // After the drop onto the bottom edge, every leg runs along an edge or rounds a corner.
    const legs = path.slice(1).map((p, i) => [path[i + 1]!, path[i + 2]] as const).filter(([, b]) => b);
    for (const [a, b] of legs) {
      const along = Math.abs(a.x - b!.x) < 0.5 || Math.abs(a.y - b!.y) < 0.5;
      const corner = Math.abs(Math.abs(a.x - b!.x) - Math.abs(a.y - b!.y)) < 0.5; // the rounding
      expect(along || corner, `${JSON.stringify(a)} → ${JSON.stringify(b)}`).toBe(true);
    }
    expect(path.some((p) => p.y === bottom)).toBe(true);
    expect(path.some((p) => p.x === right)).toBe(true);
  });

  it("feet toward the edge: 180° under the bottom, 90° up the right, 0° on top; offsets by length", () => {
    // The corner is right of the page, so it drops straight onto the bottom-right corner.
    expect(path.map((p) => p.rot)).toEqual([0, 180, 90, 90, 0, 0]);
    // From below-left it first runs along the bottom edge.
    expect(edgePath({ x: -300, y: 620 }, box, 140).map((p) => p.rot)).toEqual([0, 180, 180, 90, 90, 0, 0]);
    const ats = path.map((p) => p.at);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    const frames = crawlKeyframes(path);
    expect(frames[0]).toEqual({ offset: 0, transform: "translate(700px, 620px) rotate(0deg)" });
    expect(frames.at(-1)).toEqual({ offset: 1, transform: "translate(0px, 0px) rotate(0deg)" });
  });

  it("constant speed: the trip's time is its length, clamped to 1.2–2.2 s", () => {
    expect(crawlMs(path)).toBe(Math.min(CRAWL_MAX_MS, Math.max(CRAWL_MIN_MS, Math.round(pathLength(path)))));
    expect(crawlMs(edgePath({ x: 10, y: 400 }, { l: -100, t: 40, w: 120, h: 80 }, 140))).toBe(CRAWL_MIN_MS);
    expect(crawlMs(edgePath({ x: 3000, y: 3000 }, box, 140))).toBe(CRAWL_MAX_MS);
  });

  it("the crawl frames step at ~6 fps while it crawls (CSS)", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain('.kpet.kuro-closer[data-phase="crawl"] .layer img.f2{animation:kuro-step 333ms steps(1,end) infinite}');
  });
});

describe("FR5 text tentacles", () => {
  const browser = (day: number, clock: BeatClock = DAY) => {
    const { ctx } = ctxOf(storeAt(day), clock);
    ctx.session.leftApp = "browser";
    return desktop(ctx);
  };
  const canvasOf = (out: string) => /<canvas class="br-tentacles"[^>]*><\/canvas>/.exec(out)?.[0] ?? null;

  it("snapshot: the overlay's parameters at ring wall / room / door", () => {
    const wall = canvasOf(browser(11));
    const room = canvasOf(browser(13));
    const door = canvasOf(browser(16));
    expect(wall).toContain('data-ring="wall" data-opacity="0.08" data-tentacles="2" data-glyphs="2400" data-pass="8000-20000"');
    expect(room).toContain('data-ring="room" data-opacity="0.18"');
    expect(door).toContain('data-ring="door" data-opacity="0.3"');
    expect({ wall, room, door }).toMatchSnapshot();
  });

  it("property: no overlay before ring wall, and never on 工作台 or 消息", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: constants.lastDay }), fc.constantFrom(...BEATS), fc.constantFrom("msgs", "workbench", "browser"), (day, beat, left) => {
        const { ctx } = ctxOf(storeAt(day), { beat, time: "12:00" } as BeatClock);
        ctx.session.leftApp = left as Session["leftApp"];
        const out = desktop(ctx);
        const has = out.includes("br-tentacles");
        // At night every app has closed its door (the night plate): no page, so no overlay.
        if (left !== "browser" || overlayRing(day, beat) === null || isNight({ beat, time: "12:00" } as BeatClock)) expect(has).toBe(false);
        else expect(has).toBe(true);
      }),
      { numRuns: 120 },
    );
  });

  it("the sampler: the page's own characters in reading order, whitespace dropped, cycled; none for an empty page", () => {
    expect(sampleGlyphs("你 今天\n真漂亮。", 9)).toEqual(["你", "今", "天", "真", "漂", "亮", "。", "你", "今"]);
    expect(sampleGlyphs("   ", 9)).toEqual([]);
    expect(sampleGlyphs("ab").length).toBe(2400);
  });

  it("the curves: seeded passes 8–20 s; each starts and ends off the page; the headline is never drawn over", () => {
    for (let i = 0; i < 8; i++) {
      const ms = passMsOf(i);
      expect(ms >= 8000 && ms <= 20000).toBe(true);
      expect(passMsOf(i)).toBe(ms);
      const c = tentacleCurve(i, 1000, 700);
      const a = bezier(c, 0);
      const b = bezier(c, 1);
      expect(a.x < 0 || a.x > 1000).toBe(true);
      expect(b.x < 0 || b.x > 1000).toBe(true);
    }
    expect(visibleSpan(0)).toEqual([0, 0]);
    expect(visibleSpan(0.999)[0]).toBeGreaterThan(0.99);
    const headline = { l: 100, t: 50, w: 300, h: 40 };
    expect(coversHeadline({ x: 150, y: 60 }, headline)).toBe(true);
    expect(coversHeadline({ x: 50, y: 60 }, headline)).toBe(false);
    expect(tentacleParams(null)).toBeNull();
    expect(tentacleParams("software")).toBeNull();
  });
});
