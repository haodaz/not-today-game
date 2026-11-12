// objects-in-room (2026-11-04): some objects only work at a place in the room. Content has no `works`
// and no lock `face` yet (Claude adds them, R1/R5), so the R1 values are added here to a copy of
// content/objects.json and read by the real loader; the lock is the shell fixture's day-1 board with
// its object set to the calculator (and `face: window`), or as it is (the chick, no face).
import "./specimen";
import { describe, expect, it, vi } from "vitest";
import objectsRaw from "@content/objects.json";
import tasks01 from "@content/tasks/day-01.json";
import fixture from "../.kiro/specs/shell/board-shell.json";
import { parseHands } from "@state/hands";
import { parseObjects } from "@state/recognise";
import { parseTaskFile } from "@state/days/tasks";
import { worksAt, type Works } from "@state/works";

/** Claude's values from R1, as they will stand in content. */
const R1: Record<string, unknown> = {
  calculator: { at: ["window", "room"], light: "dayOrLamp", line: "obj.works.dark" },
  phone: { at: ["window"], signal: true, line: "obj.works.nosignal" },
  iccard: { at: ["room"], light: "lamp", line: "obj.works.nolamp" },
};
function withWorks(extra: Record<string, unknown> = R1): any {
  const raw = structuredClone(objectsRaw) as any;
  for (const [id, w] of Object.entries(extra)) raw.objects[id].works = w;
  return raw;
}

const mode = vi.hoisted(() => ({ lock: "face" as "face" | "plain" }));

vi.mock("@state/hands", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/hands")>();
  const raw = structuredClone((await import("@content/objects.json")).default) as any;
  raw.objects.calculator.works = { at: ["window", "room"], light: "dayOrLamp", line: "obj.works.dark" };
  raw.objects.phone.works = { at: ["window"], signal: true, line: "obj.works.nosignal" };
  raw.objects.iccard.works = { at: ["room"], light: "lamp", line: "obj.works.nolamp" };
  const table = real.parseHands(raw);
  return { ...real, handTable: table, handOf: (id: string) => table.get(id) ?? real.EMPTY_HAND };
});

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/shell/board-shell.json")).default as any;
  const d1 = (await import("@content/tasks/day-01.json")).default as any;
  const make = (lock: "face" | "plain") => {
    const raw = structuredClone(d1);
    raw.tasks = raw.tasks.map((t: any) => {
      if (t.id !== "task3") return t;
      const board = structuredClone(fx.board);
      if (lock === "face") board.given.lock = { ...board.given.lock, object: "calculator", face: "window" };
      return { id: t.id, title: t.title, app: t.app, done: t.done, board, deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) };
    });
    return real.parseTaskFile(raw, "day-01.json").tasks;
  };
  const variants = { face: make("face"), plain: make("plain") };
  const cur = () => variants[mode.lock];
  class Files extends Map<number, readonly any[]> {
    override get(day: number) {
      return day === 1 ? cur() : super.get(day);
    }
  }
  return {
    ...real,
    taskFiles: new Files(real.taskFiles),
    taskByFlag: (day: number, flag: string) => (day === 1 ? cur().find((t: any) => t.done === flag) : real.taskByFlag(day, flag)),
  };
});

import { createStore, type Store } from "@state/store";
import type { GameEvent } from "@state/events";
import type { ActionContext } from "@world/desktop/controller";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { handOf } from "@state/hands";

const works = (id: string) => parseHands(withWorks()).get(id)!.works as Works;
const at = (facing: "room" | "bed" | "door" | "window", day: boolean, lamp: boolean) => ({ facing, day, lamp });

describe("R1 · where an object works (the rule)", () => {
  it("calculator: daylight at 窗, the lamp at 房间; nowhere else", () => {
    const w = works("calculator");
    expect(worksAt(w, false, at("window", true, false))).toBe(true);
    expect(worksAt(w, false, at("bed", true, false))).toBe(false);
    expect(worksAt(w, false, at("door", true, true))).toBe(false);
    expect(worksAt(w, false, at("room", false, true))).toBe(true);
    expect(worksAt(w, false, at("room", false, false))).toBe(false);
    // Daylight is the window's; the lamp is the desk's.
    expect(worksAt(w, false, at("window", false, true))).toBe(false);
    expect(worksAt(w, false, at("room", true, false))).toBe(false);
  });
  it("phone: only at 窗; iccard: only at 房间 with the lamp on", () => {
    const phone = works("phone");
    const iccard = works("iccard");
    expect(worksAt(phone, false, at("window", false, false))).toBe(true);
    for (const f of ["room", "bed", "door"] as const) expect(worksAt(phone, false, at(f, true, true)), f).toBe(false);
    expect(worksAt(iccard, false, at("room", true, true))).toBe(true);
    expect(worksAt(iccard, false, at("room", true, false))).toBe(false);
    expect(worksAt(iccard, false, at("window", true, true))).toBe(false);
  });
  it("an upgraded object, or one with no rule, works everywhere", () => {
    for (const id of ["calculator", "phone", "iccard"]) {
      for (const f of ["room", "bed", "door", "window"] as const) {
        for (const [d, l] of [[true, true], [true, false], [false, true], [false, false]] as const) expect(worksAt(works(id), true, at(f, d, l))).toBe(true);
      }
    }
    expect(worksAt(null, false, at("bed", false, false))).toBe(true);
  });
});

describe("R1 / R3 · the loaders", () => {
  it("objects.json: `works` reads as R1; the other objects have none; recognise accepts the key", () => {
    const hands = parseHands(withWorks());
    expect(hands.get("calculator")!.works).toEqual({ at: ["window", "room"], light: "dayOrLamp", line: "obj.works.dark" });
    expect(hands.get("phone")!.works).toEqual({ at: ["window"], signal: true, line: "obj.works.nosignal" });
    expect(hands.get("iccard")!.works).toEqual({ at: ["room"], light: "lamp", line: "obj.works.nolamp" });
    for (const id of ["chick", "pager", "tape", "dictionary"]) expect(hands.get(id)!.works, id).toBeNull();
    expect(() => parseObjects(withWorks())).not.toThrow();
    // Each R1 line is a real string.
    for (const w of Object.values(R1)) expect(t((w as Works).line)).not.toMatch(/^⟦/);
  });
  it("objects.json: rejects a bad `works`", () => {
    const bad = (w: unknown) => () => parseHands(withWorks({ calculator: w }));
    expect(bad({ at: ["window"], line: "x", extra: 1 })).toThrow(/works: unknown key "extra"/);
    expect(bad({ at: [], line: "x" })).toThrow(/works\.at: must be a non-empty list/);
    expect(bad({ at: ["kitchen"], line: "x" })).toThrow(/"kitchen" is not a facing/);
    expect(bad({ at: ["room", "room"], line: "x" })).toThrow(/duplicate facing "room"/);
    expect(bad({ at: ["room"], light: "moon", line: "x" })).toThrow(/works\.light: must be one of day, lamp, dayOrLamp/);
    expect(bad({ at: ["window"], signal: false, line: "x" })).toThrow(/works\.signal: must be true/);
    expect(bad({ at: ["room"], signal: true, line: "x" })).toThrow(/`at` must include window/);
    expect(bad({ at: ["room"] })).toThrow(/works\.line: must be a string key/);
  });
  it("tasks: a lock's `face` only with an object (no from), and only a facing", () => {
    const parse = (lock: (l: any) => any) => () => {
      const raw = structuredClone(tasks01) as any;
      raw.tasks = raw.tasks.map((x: any) => (x.id === "task3" ? { id: x.id, title: x.title, app: x.app, done: x.done, board: { ...structuredClone(fixture.board), given: { ...fixture.board.given, lock: lock(structuredClone(fixture.board.given.lock)) } }, deliverable: fixture.deliverable, judge: fixture.judge } : x));
      return parseTaskFile(raw, "day-01.json").tasks.find((x) => x.id === "task3")!.board!.given.lock!;
    };
    expect(parse((l) => ({ ...l, face: "window" }))().face).toBe("window");
    expect(parse((l) => l)().face).toBeUndefined();
    expect(parse((l) => ({ ...l, face: "kitchen" }))).toThrow(/lock\.face: "kitchen" is not a facing/);
    expect(parse((l) => ({ ...l, face: "window", from: { open: "browser" } }))).toThrow(/only an object lock/);
    expect(parse(({ object: _o, ...l }) => ({ ...l, from: { open: "browser" }, face: "room" }))).toThrow(/only an object lock/);
  });
});

// ——— in the room ———

function rig(store: Store, view: Session["view"], clock = DEFAULT_CLOCK) {
  let now = 1_000_000;
  const timers: [number, () => void][] = [];
  const session = initialSession(clock, "right", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push([now + ms, fn]), now: () => now };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  /** Time passes until nothing is waiting (a two-leg way, the lift after it). */
  const settle = () => {
    for (let i = 0; i < 20 && timers.length; i++) {
      now = Math.max(now, ...timers.map(([at]) => at));
      for (const [at, fn] of timers.splice(0).sort((a, b) => a[0] - b[0])) if (at <= now) fn();
    }
  };
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session, nowMs: 1 }).value;
  return { ctx, session, act, settle, room };
}
const NIGHT = { beat: "night" as const, time: "23:10" };
const found = (day: number, ids: readonly string[]) => {
  const store = createStore({ startDay: day });
  for (const id of ids) {
    store.appendEvent({ kind: "openLayer", objectId: id });
    // Known, so no question is asked on lifting (the phone has none).
    if (id !== "phone") store.appendEvent({ kind: "recognise", objectId: id });
  }
  return store;
};
const useAts = (events: readonly GameEvent[]) => events.filter((e) => e.kind === "useAt").map((e) => (e.kind === "useAt" ? [e.objectId, e.facing, e.ok] : null));

describe("R1 / R2 · using it at a place", () => {
  it("the calculator at 床 by day: faint, its keys do nothing, the line once; logged not ok", () => {
    const r = rig(found(9, ["calculator"]), "bed");
    r.session.hand.inLight = true;
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    expect(useAts(r.ctx.store.getEvents())).toEqual([["calculator", "bed", false]]);
    expect(r.session.dialogue.queue.filter((q) => q.key === "d9:works:calculator")).toHaveLength(1);
    expect(r.session.dialogue.queue.at(-1)!.lines).toEqual([{ k: "inner", t: t("obj.works.dark") }]);
    // gates R3: the device is not entered there; the calculator stays in the hand as it is.
    expect(r.session.hand.using).toBe(false);
    expect(r.session.holding).toBe("calculator");
    expect(r.room()).not.toContain("using focus");
    r.act("obj-key", { object: "calculator", key: "7" });
    expect(r.session.hand.keyDown).toBeNull();
    expect(r.session.hand.using).toBe(false);
  });

  it("the calculator at 窗 by day works: not faint, keys answer; logged ok", () => {
    const r = rig(found(9, ["calculator"]), "window");
    r.session.hand.inLight = true;
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    expect(useAts(r.ctx.store.getEvents())).toEqual([["calculator", "window", true]]);
    expect(r.session.dialogue.queue.some((q) => q.key.includes(":works:"))).toBe(false);
    expect(r.room()).not.toContain("faint");
    r.act("obj-key", { object: "calculator", key: "7" });
    expect(r.session.hand.keyDown?.key).toBe("7");
  });

  it("at 房间 by night it needs the lamp: on (the evening default) works, clicked off does not", () => {
    const r = rig(found(9, ["calculator"]), "room", NIGHT);
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    r.act("loop-put-down");
    r.act("loop-put-down");
    r.act("lamp");
    expect(r.session.lampOn).toBe(false);
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    expect(useAts(r.ctx.store.getEvents())).toEqual([
      ["calculator", "room", true],
      ["calculator", "room", false],
    ]);
  });

  it("useAt is logged once per object, facing and outcome a day; again the next day", () => {
    const store = found(9, ["calculator"]);
    const r = rig(store, "bed");
    for (let i = 0; i < 3; i++) {
      r.act("loop-hold", { object: "calculator" });
      r.act("obj-use");
      r.act("loop-put-down");
      r.act("loop-put-down");
    }
    expect(useAts(store.getEvents())).toEqual([["calculator", "bed", false]]);
    store.appendEvent({ kind: "lieDown" });
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    expect(store.getEvents().filter((e) => e.kind === "useAt").map((e) => e.day)).toEqual([9, 10]);
  });

  it("the phone works only at 窗, where its screen shows one bar; the iccard's under-layer needs the lamp at 房间", () => {
    const store = found(17, ["phone", "iccard"]);
    for (const [view, ok] of [["window", true], ["room", false], ["bed", false], ["door", false]] as const) {
      const r = rig(store, view);
      r.act("loop-hold", { object: "phone" });
      r.act("obj-use");
      expect(useAts(store.getEvents()).at(-1)).toEqual(["phone", view, ok]);
      expect(r.room().includes('<i class="signal" aria-hidden="true">'), view).toBe(ok);
    }
    const r = rig(store, "room");
    r.act("loop-hold", { object: "iccard" });
    r.act("obj-use");
    expect(useAts(store.getEvents()).at(-1)).toEqual(["iccard", "room", false]);
    expect(r.room()).not.toContain("against-light");
    expect(r.room()).not.toContain('class="coil"');
    r.act("loop-put-down");
    r.act("loop-put-down");
    r.act("lamp");
    r.act("loop-hold", { object: "iccard" });
    r.act("obj-use");
    expect(useAts(store.getEvents()).at(-1)).toEqual(["iccard", "room", true]);
    expect(r.room()).toContain('class="coil"');
    expect(r.room()).toContain(`<div class="against-light">${escapeHtml(handOf("iccard").light!)}</div>`);
  });

  it("an upgraded object ignores where it is", () => {
    const store = found(17, ["calculator"]);
    store.appendEvent({ kind: "upgrade", object: "calculator" });
    const r = rig(store, "bed", NIGHT);
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    expect(useAts(store.getEvents())).toEqual([["calculator", "bed", true]]);
    expect(r.room()).not.toContain("faint");
  });

  it("the event checks its object and facing", () => {
    const store = createStore({ startDay: 2 });
    expect(() => store.appendEvent({ kind: "useAt", objectId: "kettle", facing: "room", ok: true })).toThrow(/useAt: unknown object/);
    expect(() => store.appendEvent({ kind: "useAt", objectId: "phone", facing: "kitchen" as never, ok: true })).toThrow(/is not a facing/);
    expect(() => store.appendEvent({ kind: "useAt", objectId: "phone", facing: "room", ok: 1 as never })).toThrow(/ok must be true or false/);
  });
});

// ——— R3 · the lock names a place ———

const DONE = (tasks01 as any).tasks.find((x: any) => x.id === "task3").done as string;
function day1(objects: readonly string[]): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  for (const id of objects) store.appendEvent({ kind: "openLayer", objectId: id });
  for (const id of ["task1", "task2"]) {
    const flag = (tasks01 as any).tasks.find((x: any) => x.id === id).done as string;
    store.appendEvent({ kind: "task", flag, mode: "self" });
  }
  void DONE;
  return store;
}
function onTask(store: Store, clock: BeatClock = { beat: "work", time: "10:00" }) {
  const r = rig(store, "desktop", clock);
  r.session.rightApp = "workbench";
  r.act("wb-nav", { page: "task:task3" });
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session: r.session, night: false, nowMs: 0 });
  const page = () => renderWorkbench(app()).body.value;
  return { ...r, page };
}
const chips = (out: string) => [...out.matchAll(/data-action="board-code" data-code="([^"]+)"/g)].map((m) => m[1]);
/** lock-by-device R1: a calculator lock has no chips; once offered, the panel shows one status line
 *  and the code is read off the open device. */
const readable = (out: string) => chips(out).length === 0 && out.includes("lock-status");

describe("R3 · a lock with a face", () => {
  it("from 屏幕, 用计算器看一眼 turns the head to 窗 and lifts the calculator; the reading waits for the use (no chips)", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store);
    expect(r.page()).toContain(escapeHtml(t("board.lock.useObject", { object: t("obj.name.calculator") })));
    r.act("board-lock");
    // Back to 房间 first, then the turn; the panel is open but holds no chips yet, only the way.
    expect(r.session.view).toBe("room");
    expect(r.session.holding).toBeNull();
    const before = r.page();
    expect(chips(before)).toEqual([]);
    expect(before).toContain(escapeHtml(t("board.lock.goTo", { face: t("hud.cam.window") })));
    expect(before).toContain('data-action="board-kuro-lock"');
    r.settle();
    expect(r.session.view).toBe("window");
    expect([r.session.holding, r.session.hand.using, r.session.objbarOpen]).toEqual(["calculator", true, false]);
    expect(useAts(store.getEvents())).toEqual([["calculator", "window", true]]);
    expect(readable(r.page())).toBe(true);
  });

  it("at night the window gives no light: lifted there, it does not work, and the chips stay hidden", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store, NIGHT);
    r.act("board-lock");
    r.settle();
    expect([r.session.view, r.session.holding]).toEqual(["window", "calculator"]);
    expect(useAts(store.getEvents())).toEqual([["calculator", "window", false]]);
    expect(chips(r.page())).toEqual([]);
    // A use that works at another place does not count: the lock names 窗.
    store.appendEvent({ kind: "useAt", objectId: "calculator", facing: "room", ok: true });
    expect(chips(r.page())).toEqual([]);
  });

  it("a lock without a face behaves as today: the 老物件栏 opens the object over 屏幕 and the chips are there", () => {
    mode.lock = "plain";
    const store = day1(["chick"]);
    const r = onTask(store);
    r.act("board-lock");
    expect(r.session.view).toBe("desktop");
    expect([r.session.holding, r.session.objbarOpen, r.session.boardLockOpen]).toEqual(["chick", true, true]);
    expect(chips(r.page())).toEqual(["0000", "1111"]);
    expect(useAts(store.getEvents())).toEqual([["chick", "room", true]]);
  });

  it("让它试 needs no place", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store);
    r.act("board-kuro-lock");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "assistUnlock" } });
    expect(r.session.view).toBe("desktop");
  });
});

// ——— R7 · back to the screen after the trip ———

describe("R7 · putting the object down after a lock's trip returns to 屏幕", () => {
  it("from 屏幕, 用计算器看一眼 → 窗, use, put down → back on 屏幕, the same monitor and task page, the reading status in front", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store);
    r.session.focus = "right";
    r.act("board-lock");
    r.settle();
    expect([r.session.view, r.session.holding, r.session.hand.using]).toEqual(["window", "calculator", true]);
    expect(r.session.lockTrip).toEqual({ focus: "right", page: "task:task3", day: null });
    // Somewhere on the way the page changed (the session list, say): the trip remembers its own.
    r.session.workbenchPage = "home";
    r.session.boardLockOpen = false;
    // The first put-down steps out of 使用; the second puts it down and goes back.
    r.act("loop-put-down");
    expect(r.session.view).toBe("window");
    expect(r.session.holding).toBe("calculator");
    r.act("loop-put-down");
    expect(r.session.holding).toBeNull();
    // The turn back to 房间 first (one move), then into 屏幕.
    expect(r.session.view).toBe("room");
    r.settle();
    expect(r.session.view).toBe("desktop");
    expect([r.session.focus, r.session.workbenchPage, r.session.boardLockOpen, r.session.lockTrip]).toEqual(["right", "task:task3", true, null]);
    expect(readable(r.page())).toBe(true);
  });

  it("picking the calculator up at 窗 by hand and putting it down stays at 窗", () => {
    const r = rig(found(9, ["calculator"]), "window");
    r.act("loop-hold", { object: "calculator" });
    r.act("obj-use");
    r.act("loop-put-down");
    r.act("loop-put-down");
    r.settle();
    expect([r.session.view, r.session.holding, r.session.lockTrip]).toEqual(["window", null, null]);
  });

  it("a lock without a face starts no trip (the 老物件栏 over 屏幕, as before)", () => {
    mode.lock = "plain";
    const store = day1(["chick"]);
    const r = onTask(store);
    r.act("board-lock");
    expect(r.session.lockTrip).toBeNull();
    r.act("objbar-close");
    expect(r.session.view).toBe("desktop");
  });

  it("a lock's trip that ends some other way leaves no return behind", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store);
    r.act("board-lock");
    r.settle();
    expect(r.session.lockTrip).not.toBeNull();
    // Any move ends it (here the view action, as a hotspot would).
    r.act("view", { view: "bed" });
    expect(r.session.lockTrip).toBeNull();
    r.settle();
    r.act("loop-hold", { object: "calculator" });
    r.act("loop-put-down");
    r.settle();
    expect(r.session.view).toBe("bed");
  });
});

// ——— R8 · no second trip ———

describe("R8 · once the object worked today, the lock opens in place", () => {
  it("trip, use, return, wrong code, reopen → no turn, no lift, the reading status shown", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    const r = onTask(store);
    r.act("board-lock");
    r.settle();
    expect(r.session.view).toBe("window");
    r.act("loop-put-down");
    r.act("loop-put-down");
    r.settle();
    expect([r.session.view, r.session.boardLockOpen]).toEqual(["desktop", true]);
    r.act("board-code", { code: "1111" });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "unlock", code: "1111" } });
    r.session.boardLockOpen = false;
    const uses = useAts(store.getEvents()).length;
    const cam = r.session.cam;
    r.act("board-lock");
    expect(r.session.cam).toBe(cam); // no camera move started
    r.settle();
    expect([r.session.view, r.session.holding, r.session.lockTrip]).toEqual(["desktop", null, null]);
    expect(r.session.boardLockOpen).toBe(true);
    expect(readable(r.page())).toBe(true);
    expect(useAts(store.getEvents())).toHaveLength(uses);
  });

  it("a working use that is not today's does not count: the first click trips", () => {
    mode.lock = "face";
    // Yesterday's use at 窗 (stamped with the day before) is in the log.
    const store = createStore({ startDay: 1, events: [{ kind: "useAt", day: 0, objectId: "calculator", facing: "window", ok: true }] });
    const today = day1(["chick", "calculator"]);
    for (const e of today.getEvents()) store.appendEvent(e);
    const r = onTask(store);
    r.act("board-lock");
    r.settle();
    expect([r.session.view, r.session.holding]).toEqual(["window", "calculator"]);
    expect(r.session.lockTrip).not.toBeNull();
  });

  it("a not-ok use today still trips (only a working one stops it)", () => {
    mode.lock = "face";
    const store = day1(["chick", "calculator"]);
    store.appendEvent({ kind: "useAt", objectId: "calculator", facing: "bed", ok: false });
    const r = onTask(store);
    r.act("board-lock");
    r.settle();
    expect(r.session.view).toBe("window");
  });
});
