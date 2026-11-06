// playtest-1105 (2026-11-05): the author's first real play. One describe per requirement.
import { describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { shellActions, type ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { loadPlacement, PLACE_KEY } from "@world/desktop/placement";
import { APPS } from "@world/desktop/shell";
import { loopActions, renderGame } from "@world/room/game";

function booted(day = 1): Store {
  const store = createStore({ startDay: day });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  return store;
}
function rig(store: Store, view: Session["view"] = "room", clock: BeatClock = DEFAULT_CLOCK) {
  const session = initialSession(clock, "left", view);
  const timers: (() => void)[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (_ms, fn) => void timers.push(fn), now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name])!(ctx, data as DOMStringMap, null as never);
  const out = () => renderGame(store, session, 0).value;
  return { store, session, ctx, act, out, timers };
}

describe("R1 · a new player can see the computer", () => {
  it("the run's first time at the computer: the bare desktop, the dock up, the onboarding card once", () => {
    const r = rig(booted());
    r.session.onboard = "no"; // as mountDesktop starts a run
    r.act("view", { view: "desktop", screen: "left" });
    expect([r.session.leftApp, r.session.rightApp]).toEqual([null, null]);
    const out = r.out();
    expect(out).not.toContain('class="win');
    expect(out).toContain('<div class="dock">');
    expect(out).toContain('class="onboard"');
    // One row per dock app, in dock order, a 28 px icon each; one button.
    const rows = [...out.matchAll(/<li><img src="\/os\/([a-z]+)\.svg" alt="" width="28" height="28"/g)].map((m) => m[1]);
    expect(rows).toEqual(["tingtalk", "workbench", "msgs", "browser", "files"]);
    expect(out.match(/data-action="onboard-ok"/g)).toHaveLength(1);
    // A click outside the card does nothing: the dim has no action.
    expect(out).toContain('<div class="onboard-dim"></div>');
    r.act("onboard-ok");
    expect(r.session.onboard).toBe("done");
    expect(r.out()).not.toContain('class="onboard"');
    // Back in the room and in again: no card, and the windows the player opens stay.
    r.act("view", { view: "room" });
    r.act("dock", { app: "tingtalk" });
    r.act("view", { view: "desktop", screen: "right" });
    expect(r.session.rightApp).toBe("tingtalk");
    expect(r.out()).not.toContain('class="onboard"');
  });

  it("工作台 opens as a window; the green light makes it full screen (the dock hides, peeks) and back", () => {
    const r = rig(booted(), "desktop");
    r.act("dock", { app: "workbench" });
    let out = r.out();
    expect(out).toMatch(/<div class="win wb" data-win="workbench" style="left:24px;top:54px;width:1392px;height:760px"><div class="bar app-top"/);
    expect(out).toContain('<div class="dock">');
    // The sidebar toggle is in the window's top bar.
    expect(out).toMatch(/<div class="bar app-top"[^>]*>.*data-action="wb-sidebar"/s);
    r.act("win-full", { app: "workbench" });
    out = r.out();
    expect(out).toContain('<div class="win wb full" data-win="workbench">');
    expect(out).toContain('<div class="dock auto">');
    r.act("win-full", { app: "workbench" });
    expect(r.out()).toContain('<div class="win wb" data-win="workbench" style=');
  });

  it("the onboarding state is remembered with the run's placement; a placement saved before it means seen", () => {
    const storage = new Map<string, string>();
    const s = { getItem: (k: string) => storage.get(k) ?? null };
    storage.set(PLACE_KEY, JSON.stringify({ runId: "r", place: { msgs: "left", tingtalk: "right", workbench: "left", browser: "left" }, stack: [], leftApp: null, rightApp: null }));
    expect(loadPlacement(s, "r", APPS)!.onboard).toBe("done");
    storage.set(PLACE_KEY, JSON.stringify({ runId: "r", place: {}, stack: [], leftApp: null, rightApp: null, onboard: "due" }));
    expect(loadPlacement(s, "r", APPS)!.onboard).toBe("due");
  });
});

describe("R2 · dialogue owns the screen", () => {
  it("a one-line fragment: a clear mask over everything that reads on; under it no hotspot answers", async () => {
    const { push } = await import("@world/loop/dialogue");
    const r = rig(booted());
    r.session.dialogue = push(r.session.dialogue, { key: "t", lines: [{ k: "inner", t: "一句。" }], ending: { kind: "none" } });
    const out = r.out();
    // The mask is the layer's first child, under the box, over the whole screen; it reads on.
    expect(out).toContain('<div class="dlg-layer"><div class="story-mask clear" data-action="loop-advance" aria-hidden="true"></div><div class="dlg');
    const css = (await import("node:fs")).readFileSync(new URL("../src/world/room/room.css", import.meta.url), "utf8");
    expect(css).toContain(".dlg-layer .story-mask{position:fixed;inset:0;");
    expect(css).toContain(".dlg-layer .story-mask.clear{background:transparent}");
    r.act("loop-advance");
    expect(r.session.dialogue.queue).toEqual([]);
    expect(r.out()).not.toContain("story-mask");
  });

  it("at a choice the mask only holds the screen (no read-on); the choice is the click", async () => {
    const { push } = await import("@world/loop/dialogue");
    const r = rig(booted());
    r.session.dialogue = push(r.session.dialogue, { key: "c", lines: [{ k: "inner", t: "睡吗？" }], ending: { kind: "bedAsk" } });
    const out = r.out();
    expect(out).toContain('<div class="story-mask clear waits" aria-hidden="true"></div>');
    expect(out).toContain('data-action="loop-choice"');
  });
});

describe("R3 · the day's opening, and powering on", () => {
  it("the day's boot beat plays on waking in the room (every day), before anything is done; not on power-on", async () => {
    const { syncLoop } = await import("@world/loop/runtime");
    const { dayFiles } = await import("@state/days/table");
    for (const day of [1, 4, 9, 18]) {
      const store = createStore({ startDay: day });
      const r = rig(store, "room");
      syncLoop(r.ctx, 0);
      if (dayFiles.get(day)!.beats.boot) expect(r.session.dialogue.queue.map((q) => q.key), `day ${day}`).toEqual([`d${day}:beat:boot`]);
    }
    // After lie down the next morning wakes with its own.
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room");
    syncLoop(r.ctx, 0);
    store.appendEvent({ kind: "lieDown" });
    syncLoop(r.ctx, 0);
    expect(r.session.dialogue.queue.map((q) => q.key)).toContain("d2:beat:boot");
  });

  it("the tower says room.boot.on (narration) then room.boot.hint (inner); the screens are lit from then on", async () => {
    const { syncLoop } = await import("@world/loop/runtime");
    const { EMPTY_DIALOGUE } = await import("@world/loop/dialogue");
    const { t } = await import("@world/i18n");
    const store = createStore({ startDay: 1 });
    const r = rig(store, "room");
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    expect(r.out()).not.toContain("monitor-lit");
    r.act("tower-power");
    syncLoop(r.ctx, 0);
    expect(r.session.dialogue.queue.map((q) => q.key)).toEqual(["d1:power-on"]);
    expect(r.session.dialogue.queue[0]!.lines).toEqual([
      { k: "narration", t: t("room.boot.on") },
      { k: "inner", t: t("room.boot.hint") },
    ]);
    expect(r.out().match(/class="monitor-lit (left|right)"/g)).toHaveLength(2);
  });

  it("a new run's dream comes before the waking lines", async () => {
    const { syncLoop } = await import("@world/loop/runtime");
    const { startPrologue, PROLOGUE_KEY } = await import("@world/opening");
    const r = rig(createStore({ startDay: 1 }), "desk");
    syncLoop(r.ctx, 0);
    startPrologue(r.session);
    expect(r.session.dialogue.queue.map((q) => q.key)).toEqual([PROLOGUE_KEY, "d1:beat:boot"]);
  });
});

describe("R4 · things to touch in the room", () => {
  it("the loader: both files read, the twin checked (same keys, same line counts), unknown keys fail", async () => {
    const zh = (await import("@content/room-looks.json")).default;
    const en = (await import("@content/en/room-looks.json")).default;
    const { LOOK_KEYS, localiseRoomLooks, parseRoomLooks, roomLooks } = await import("@state/room-looks");
    for (const k of LOOK_KEYS) expect(roomLooks[k].length, k).toBe((zh as any).looks[k].length);
    const clone = (v: unknown): any => JSON.parse(JSON.stringify(v));
    expect(() => parseRoomLooks({ ...clone(zh), extra: 1 })).toThrow(/top level: unknown key "extra"/);
    const more = clone(zh);
    more.looks.window = ["x"];
    expect(() => parseRoomLooks(more)).toThrow(/looks: unknown key "window"/);
    const missing = clone(zh);
    delete missing.looks.lock;
    expect(() => parseRoomLooks(missing)).toThrow(/looks\.lock: must be a non-empty list/);
    const short = clone(en);
    short.looks.coat.pop();
    expect(() => localiseRoomLooks(parseRoomLooks(zh), parseRoomLooks(short, "en/room-looks.json"))).toThrow(/content\/en\/room-looks\.json looks\.coat: \d+ lines, the Chinese has \d+/);
    // The content locale picks the text.
    const { setContentLocale } = await import("@state/content-locale");
    setContentLocale("en");
    expect(roomLooks.coat[0]).toBe((en as any).looks.coat[0]);
    setContentLocale("zh");
    expect(roomLooks.coat[0]).toBe((zh as any).looks.coat[0]);
  });

  it("the spots sit at the spec's fractions of each backdrop (门: the lock over the door leaf)", async () => {
    const { LOOK_SPOTS } = await import("@world/room/shots");
    const door = Object.fromEntries(LOOK_SPOTS.door.map((s) => [s.look, s.rect]));
    expect(door.coat).toEqual({ l: 528, t: 153, w: 144, h: 432 });
    expect(door.lock).toEqual({ l: 1024, t: 279, w: 96, h: 198 });
    expect(door.door).toEqual({ l: 768, t: 18, w: 336, h: 837 });
    expect(door.bag).toEqual({ l: 1104, t: 711, w: 176, h: 189 });
    // The lock comes after the door leaf (on top of it).
    expect(LOOK_SPOTS.door.map((s) => s.look).indexOf("lock")).toBeGreaterThan(LOOK_SPOTS.door.map((s) => s.look).indexOf("door"));
    expect(LOOK_SPOTS.window.map((s) => s.look)).toEqual(["bag", "door"]);
  });

  it("a click says one of the thing's lines as an inner line, never the same twice in a row; nothing is logged", async () => {
    const { roomLooks } = await import("@state/room-looks");
    const r = rig(booted(), "door");
    expect(r.out()).toContain('data-action="room-look" data-look="coat"');
    const events = r.store.getEvents().length;
    let last: string | null = null;
    for (let i = 0; i < 40; i++) {
      r.act("room-look", { look: "lock" });
      const q = r.session.dialogue.queue.at(-1)!;
      expect(q.lines).toHaveLength(1);
      expect(q.lines[0]!.k).toBe("inner");
      const t = q.lines[0]!.t;
      expect(roomLooks.lock).toContain(t);
      expect(t).not.toBe(last);
      last = t;
    }
    expect(r.store.getEvents()).toHaveLength(events);
    const w = rig(booted(), "window");
    expect(w.out()).toContain('data-action="room-look" data-look="bag"');
  });

  it("nextLook never repeats the last index and covers every other one", async () => {
    const { nextLook } = await import("@state/room-looks");
    const lines = ["a", "b", "c", "d", "e"];
    for (let last = 0; last < 5; last++) {
      const seen = new Set<number>();
      for (let i = 0; i < 100; i++) seen.add(nextLook(lines, last, i / 100));
      expect(seen.has(last)).toBe(false);
      expect(seen.size).toBe(4);
    }
    expect(nextLook(["only"], 0, 0.5)).toBe(0);
  });
});
