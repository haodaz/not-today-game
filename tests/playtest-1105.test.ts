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
    // onboarding-steps R1: the single card is now coach marks (tests/onboarding-steps.test.ts).
    expect(out).toContain('<div class="coach" data-step="1" data-target="msgs">');
    expect(out).not.toContain('class="onboard');
    r.act("onboard-skip");
    expect(r.session.onboard).toBe("done");
    expect(r.out()).not.toContain('class="coach"');
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
    // guidance R15: the window fills the OS area under the 28 px top bar down to the dock.
    expect(out).toMatch(/<div class="win wb" data-win="workbench" style="left:0px;top:28px;width:1440px;height:800px"><div class="bar app-top"/);
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

/** The queue's keys with a split beat's pieces (`<key>#n`, lying-view R1) folded into its key. */
const beatKeys = (queue: readonly { key: string }[]): string[] => [...new Set(queue.map((q) => q.key.replace(/#\d+$/, "")))];

describe("R3 · the day's opening, and powering on", () => {
  it("the day's boot beat plays on waking in the room (every day), before anything is done; not on power-on", async () => {
    const { syncLoop } = await import("@world/loop/runtime");
    const { dayFiles } = await import("@state/days/table");
    for (const day of [1, 4, 9, 18]) {
      const store = createStore({ startDay: day });
      const r = rig(store, "room");
      syncLoop(r.ctx, 0);
      // lying-view R1: a beat with Kuro's lines is split into pieces `<key>#n`; it is still the one beat.
      if (dayFiles.get(day)!.beats.boot) expect(beatKeys(r.session.dialogue.queue), `day ${day}`).toEqual([`d${day}:beat:boot`]);
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
    expect(beatKeys(r.session.dialogue.queue)).toEqual([PROLOGUE_KEY, "d1:beat:boot"]);
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

describe("R5 · 窗's table, and its close view", () => {
  it("the table is empty until the meal is taken in; the meal then sits on the tabletop", async () => {
    const { completeUntil } = await import("./complete-items");
    const { WINDOW_SHOT } = await import("@world/room/shots");
    const empty = booted();
    expect(rig(empty, "window").out()).not.toContain("slot meal");
    const store = createStore({ startDay: 1 });
    completeUntil(store, "eat");
    expect(rig(store, "window").out()).toContain('data-at="meal"');
    // The tabletop in stage px is x 567–788, y 614–684: the meal is centred on it, its bottom on it.
    const m = WINDOW_SHOT.meal;
    expect(m.l + m.w / 2).toBeGreaterThan(567 + 60);
    expect(m.l + m.w / 2).toBeLessThan(788 - 60);
    expect(m.t + m.h).toBeGreaterThanOrEqual(614 + 20);
    expect(m.t + m.h).toBeLessThanOrEqual(684);
  });

  it("a click on the table leans in to it (view table); the meal is large there and eaten there; Esc and 退回 go back to 窗", async () => {
    const { completeUntil } = await import("./complete-items");
    const { EMPTY_DIALOGUE } = await import("@world/loop/dialogue");
    const { TABLE_SHOT, rectStyle } = await import("@world/room/shots");
    const { backTarget, wayLegs } = await import("@world/room/game");
    const { edgeLeads } = await import("@world/room/look");
    const store = createStore({ startDay: 1 });
    completeUntil(store, "eat");
    const r = rig(store, "window");
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("meal-table");
    expect(r.session.view).toBe("table");
    const out = r.out();
    expect(out).toContain('class="stage room table-view"');
    expect(out).toContain(`data-at="meal" style="${rectStyle(TABLE_SHOT.meal)}"><button type="button" class="slot meal" data-action="loop-eat" data-meal="lunch"`);
    // The table up close has no turn edges and no other hotspot; it has the way back.
    expect(out).not.toContain("table-hit");
    expect(edgeLeads("table", "back")).toBe(true);
    expect(edgeLeads("table", "left")).toBe(false);
    r.act("loop-eat", { meal: "lunch" });
    r.act("loop-choice", { choice: "eat" }); // author 2026-11-11: 现在吃吗？ first; eaten, the box is gone
    expect(store.getEvents().filter((e) => e.kind === "step" && e.name === "eat:lunch")).toHaveLength(1);
    expect(r.out()).not.toContain("slot meal");
    expect(backTarget("table")).toBe("window");
    r.act("nav-back");
    expect(r.session.view).toBe("window");
    // From elsewhere the way goes out to the facing first.
    expect(wayLegs("desk", "table")).toEqual(["room", "window", "table"]);
    expect(wayLegs("table", "window")).toEqual(["window"]);
    expect(wayLegs("desk", "window")).toEqual(["room", "window"]);
  });

  it("an empty table up close is only the table; the close view is the same still pushed in", async () => {
    const { EMPTY_DIALOGUE } = await import("@world/loop/dialogue");
    const r = rig(booted(), "window");
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("meal-table");
    expect(r.session.view).toBe("table");
    expect(r.out()).not.toContain("slot meal");
    const css = (await import("node:fs")).readFileSync(new URL("../src/world/room/room.css", import.meta.url), "utf8");
    expect(css).toContain(".room.table-view,.room.table-view.looking{background-image:url(/room/shots/window.jpg);background-size:4992px 2784px;background-position:-1318px -1530px}");
  });
});

describe("R6 · Kuro in the room: one box, and not only the idiom", () => {
  const boxes = (s: string) => s.match(/<div class="dlg[ "]/g)?.length ?? 0;

  it("by day the chat is locked: a click on Kuro is kuro.room.notYet in its own box, its portrait; reading on closes it", async () => {
    const { EMPTY_DIALOGUE } = await import("@world/loop/dialogue");
    const { t } = await import("@world/i18n");
    const { escapeHtml } = await import("@world/html");
    const r = rig(booted(), "room", { beat: "work", time: "10:00" });
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("kuro-call");
    const out = r.out();
    expect(boxes(out)).toBe(1);
    expect(out).toContain(escapeHtml(t("kuro.room.notYet")));
    expect(out).toContain("kuro-portrait");
    expect(out).not.toContain("data-choice");
    expect(out).toContain('<div class="hud-kuro talking">'); // author 2026-11-11: the corner keeps a still copy
    r.act("loop-advance");
    expect(r.session.dialogue.queue).toEqual([]);
    expect(r.store.getEvents().some((e) => e.kind === "chat")).toBe(false);
  });

  it("after the work: the idiom, then the same box is the player's turn (their portrait), then Kuro's answer (its portrait), never a second box", async () => {
    const { completeUntil } = await import("./complete-items");
    const { EMPTY_DIALOGUE } = await import("@world/loop/dialogue");
    const { kuroDay, offlineAnswer } = await import("@world/desktop/kuro/days");
    const { escapeHtml } = await import("@world/html");
    const store = createStore({ startDay: 1 });
    completeUntil(store, "chat");
    const r = rig(store, "room", { beat: "night", time: "23:41" });
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("kuro-call");
    expect(boxes(r.out())).toBe(1);
    r.act("loop-choice", { index: "0", choice: "yes" });
    const day = kuroDay(1)!;
    let out = r.out();
    expect(boxes(out)).toBe(1);
    expect(out).toContain("kuro-portrait");
    expect(out).not.toContain("player-portrait");
    r.act("loop-advance");
    out = r.out();
    expect(boxes(out)).toBe(1);
    // world-prompts R2 (supersedes R6's player box): the box keeps Kuro's line and portrait; the
    // player's options are the column on the right.
    expect(out).toContain("kuro-portrait");
    expect(out).toMatch(new RegExp(`data-action="kuro-q" data-q="101"[^>]*><i class="dc-ic ask"[\\s\\S]*?</i><span class="dc-l">${escapeHtml(day.starters[0]!.zh)}</span></button>`));
    r.act("kuro-q", { q: "101" });
    out = r.out();
    expect(boxes(out)).toBe(1);
    expect(out).toContain("kuro-portrait");
    // The core's tier (2026-11-09): day 1 q1's low tier, never the idiom.
    const tier = day.layered.find((l) => l.unlock === 101)!;
    const ev = r.store.getEvents().find((e) => e.kind === "chat")!;
    expect(ev).toMatchObject({ q: 101 });
    if (ev.kind === "chat" && ev.taboo !== "flicker") {
      expect(ev.answer!.startsWith(tier.zh!.low)).toBe(true);
      expect(ev.answer).not.toBe(day.idiom);
    }
    // Read on: the player's turn again; the asked question stays in the pool.
    r.act("loop-advance");
    expect(r.out()).toContain('data-action="kuro-q"');
    expect(r.out()).toContain('data-q="101"');
  });
});

describe("R7 · the day's work is one checklist line", () => {
  it("all task items (flag:task_*) are one line, checklist.work with {done}/{total}; the other items stay", async () => {
    const { checklist, loopContext } = await import("@world/loop/checklist");
    const { renderChecklist } = await import("@world/room/hud");
    const { dayFiles } = await import("@state/days/table");
    const { t } = await import("@world/i18n");
    const store = booted();
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:05" });
    store.appendEvent({ kind: "reply", choice: "fine", recipient: "boss", t: "09:05" }); // day 1: lunch unlocks after the reply (2026-11-08)
    const tasks = dayFiles.get(1)!.items.filter((it) => it.when === "day" && it.done.kind === "flag" && it.done.flag.startsWith("task_"));
    expect(tasks.length).toBeGreaterThan(1);
    const list = () => renderChecklist(checklist(loopContext(store.getState(), store.getEvents())!)).value;
    let out = list();
    expect(out).toContain(`data-id="work"><i></i>${t("checklist.work", { done: 0, total: tasks.length })}</div>`);
    for (const task of tasks) expect(out).not.toContain(task.text);
    // The other items keep their own lines.
    expect(out).toContain(dayFiles.get(1)!.items.find((it) => it.id === "lunch")!.text);
    store.appendEvent({ kind: "task", flag: (tasks[0]!.done as { flag: string }).flag, mode: "self" });
    out = list();
    expect(out.match(/data-id="work"/g)).toHaveLength(1);
    expect(out).toContain(t("checklist.work", { done: 1, total: tasks.length }));
    const before = checklist(loopContext(store.getState(), store.getEvents())!).doneCount;
    for (const task of tasks.slice(1)) store.appendEvent({ kind: "task", flag: (task.done as { flag: string }).flag, mode: "self" });
    const view = checklist(loopContext(store.getState(), store.getEvents())!);
    expect(view.lines.some((l) => l.id === "work")).toBe(false);
    // All done: the line folds into the done count as one thing.
    expect(view.doneCount).toBe(before + 1);
  });
});

describe("R8 · settings: restart this run, and (title) clear everything", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } };
  };

  it("restart clears only the run save; clearAll clears the run and the profile; language and mute stay", async () => {
    const { clearAll, createProfileWriter, createRunSlot, restartRun, RUN_KEY, PROFILE_KEY } = await import("@state/saves");
    for (const which of ["restart", "clearAll"] as const) {
      const { m, s } = memory();
      const run = createRunSlot(s);
      const profile = createProfileWriter(s);
      run.save(booted(3));
      run.save(booted(3)); // a backup exists too
      profile.recordEnding("bad");
      profile.recordObject("chick");
      m.set("nt_lang", "en");
      m.set("nt_muted", "1");
      const profileBefore = [...m].filter(([k]) => k.startsWith(PROFILE_KEY));
      if (which === "restart") restartRun(run);
      else clearAll(run, profile);
      expect(run.load()).toBeNull();
      expect([...m.keys()].filter((k) => k.startsWith(RUN_KEY))).toEqual([]);
      if (which === "restart") expect([...m].filter(([k]) => k.startsWith(PROFILE_KEY))).toEqual(profileBefore);
      else expect([...m.keys()].filter((k) => k.startsWith(PROFILE_KEY))).toEqual([]);
      expect(m.get("nt_lang")).toBe("en");
      expect(m.get("nt_muted")).toBe("1");
    }
  });

  it("in the game: 重新开始这一局 asks first (确定 · 取消); 取消 and Esc go back to the panel; no 清除全部 here", async () => {
    const { t } = await import("@world/i18n");
    const { escapeHtml } = await import("@world/html");
    const { loopKeys } = await import("@world/room/game");
    const r = rig(booted());
    r.act("settings-open");
    let out = r.out();
    expect(out).toContain(`data-action="settings-restart">${escapeHtml(t("settings.restart"))}</button>`);
    expect(out).not.toContain("settings-clear-all");
    r.act("settings-restart");
    out = r.out();
    expect(out).toContain(escapeHtml(t("settings.restartConfirm")));
    expect(out).toContain(`data-action="settings-confirm" data-what="restart">${escapeHtml(t("settings.confirm"))}</button>`);
    expect(out).toContain(`data-action="settings-confirm-cancel">${escapeHtml(t("settings.cancel"))}</button>`);
    r.act("settings-confirm-cancel");
    expect(r.session.settingsConfirm).toBeNull();
    expect(r.session.settingsOpen).toBe(true);
    r.act("settings-restart");
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect([r.session.settingsOpen, r.session.settingsConfirm]).toEqual([true, null]);
    // Nothing is cleared by the game itself: 确定 is the host's.
    expect(r.store.getEvents().length).toBeGreaterThan(0);
  });

  it("on the title: both, each with its own question; the strings exist in both languages", async () => {
    const { renderTitle } = await import("../src/ui/title/view");
    const { initialTitle } = await import("../src/ui/title/model");
    const { readCollection } = await import("../src/ui/collection");
    const { t } = await import("@world/i18n");
    const { escapeHtml } = await import("@world/html");
    const zh = (await import("@content/strings/zh.json")).default as Record<string, string>;
    const en = (await import("@content/strings/en.json")).default as Record<string, string>;
    for (const k of ["settings.restart", "settings.clearAll", "settings.restartConfirm", "settings.clearAllConfirm", "settings.confirm", "settings.cancel"]) {
      expect(zh[k], k).toBeTruthy();
      expect(en[k], k).toBeTruthy();
    }
    const m = { ...initialTitle({ day: 3 }, readCollection({ getItem: () => null, setItem: () => {}, removeItem: () => {} })), settingsOpen: true };
    const out = renderTitle(m).value;
    expect(out).toContain('data-action="settings-restart"');
    expect(out).toContain(`data-action="settings-clear-all">${escapeHtml(t("settings.clearAll"))}</button>`);
    expect(renderTitle({ ...m, settingsConfirm: "clearAll" }).value).toContain(escapeHtml(t("settings.clearAllConfirm")));
    expect(renderTitle({ ...m, settingsConfirm: "clearAll" }).value).toContain('data-what="clearAll"');
  });
});

describe("R9 · the title's music by finished runs", () => {
  it("finishedRuns 0: rain and the instrumental music-day, never the theme; after one: the sung theme in the language; the walkman keeps the theme", async () => {
    const { titlePlan, soundPlan } = await import("@world/sound/plan");
    const { soundTable, musicFiles } = await import("@world/sound/table");
    const before = titlePlan(0.12, { voice: "f", lang: "en", finishedRuns: 0 });
    expect(before.bed).toBe("rain");
    expect(before.music).not.toBe("theme");
    expect(soundTable.music[before.music!]!.src).toBe("music-day.mp3");
    for (const runs of [1, 3]) {
      const after = titlePlan(0.12, { voice: "f", lang: "en", finishedRuns: runs });
      expect(after.music).toBe("theme");
      expect(musicFiles(soundTable.music.theme!.src, after.voice, after.lang)[0]).toBe("theme_f_en.mp3");
    }
    expect(musicFiles(soundTable.music.theme!.src, "m", "zh")[0]).toBe("theme_m_zh.mp3");
    // The walkman in 老物件 is the theme whatever the count.
    const walkman = soundTable.musicAt.find((m) => m.when === "walkman")!;
    expect(walkman.id).toBe("theme");
    expect(typeof soundPlan).toBe("function");
  });

  it("the title page passes the profile's count", async () => {
    const src = (await import("node:fs")).readFileSync(new URL("../src/ui/title/mount.ts", import.meta.url), "utf8");
    expect(src).toContain("finishedRuns: deps.collection.finishedRuns");
  });
});

describe("R10 · bug 4: the room turn is twice as long, eased in and out", () => {
  it("650 → 1300 ms to the next wall; 2 × 400 → 2 × 800 ms to the opposite one; ease-in-out", async () => {
    const { CHOSEN, TURN_EASE, viewMoveMs } = await import("@world/motion/timing");
    const { turnsBetween } = await import("@world/room/facings");
    expect(CHOSEN.turn).toBe(1300);
    expect(CHOSEN.turnFast).toBe(800);
    expect(TURN_EASE).toBe("ease-in-out");
    const next = (["bed", "door", "window"] as const).find((f) => turnsBetween("room", f).length === 1)!;
    const opposite = (["bed", "door", "window"] as const).find((f) => turnsBetween("room", f).length === 2)!;
    expect(viewMoveMs("room", next)).toBe(1300);
    expect(viewMoveMs("room", opposite)).toBe(1600);
  });
});
