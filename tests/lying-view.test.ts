// lying-view (2026-11-06): R1 Kuro and the player as speakers in day files; R2–R4 the fifth view,
// `lying` (the ceiling, under 床): the day starts there, the bed after nightfall lies down first and
// asks from there, 再待会儿 keeps the player lying, Kuro can be called from the bed, 睡 starts the
// night from there.
import { afterEach, describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { dialogueBox, lineBoxModel, playerPortraitSrc } from "@world/dialogue/box";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, isChatItem, push, splitVoices, talking, type Queued } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { backTarget, loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { hasBack } from "@world/room/facings";
import { edgeLeads } from "@world/room/look";
import { parseDayFile, type DayFile } from "@state/days/table";
import dayOneRaw from "@content/days/day-01.json";
import { completeUntil } from "./complete-items";

const NIGHT: BeatClock = { beat: "night", time: "23:41" };
const LOGIN = "林一";

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: LOGIN, nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: "she" } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function rig(store: Store, view: Session["view"], clock: BeatClock = DEFAULT_CLOCK) {
  const timers: { ms: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const run = () => {
    while (timers.length) timers.splice(0).forEach((x) => x.fn());
  };
  const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: ctx.session }).value;
  const box = () => dialogueBox(store.getState(), store.getEvents(), ctx.session)?.value ?? "";
  const shown = () => lineBoxModel(store.getState(), store.getEvents(), ctx.session);
  return { ctx, session: ctx.session, act, run, room, box, shown };
}
const keys = (session: Session) => session.dialogue.queue.map((q) => q.key);

// ——— R1 ———

describe("R1 · Kuro and the player as speakers in a day file", () => {
  it("day 1's boot: Kuro (its tag, portrait, box), the player (their name, portrait), Kuro again, then the narration", () => {
    const r = rig(storeAt(1), "lying");
    syncLoop(r.ctx, 0);
    const boot = dayFiles.get(1)!.beats.boot!.say;
    expect(boot.slice(0, 3).map((l) => l.who)).toEqual(["kuro", "me", "kuro"]);
    // One click per line, in order; the first three in their own voices.
    const seen: { text: string; tag: unknown; kuro: boolean; me: string | null }[] = [];
    for (let i = 0; i < boot.length; i++) {
      const m = r.shown()!;
      seen.push({ text: m.text, tag: m.tag, kuro: m.portrait !== null, me: m.playerPortrait });
      r.act("loop-advance");
    }
    expect(seen.map((s) => s.text)).toEqual(boot.map((l) => l.t));
    expect(seen[0]).toMatchObject({ tag: { kind: "kuro" }, kuro: true, me: null });
    expect(seen[1]).toMatchObject({ tag: { kind: "who", text: LOGIN }, kuro: false, me: playerPortraitSrc("she", false) });
    expect(seen[2]).toMatchObject({ tag: { kind: "kuro" }, kuro: true, me: null });
    if (seen[3]) expect(seen[3].kuro).toBe(false); // the rain moved to `rise` (author 2026-11-07): boot may be Kuro / me / Kuro only
    if (seen[3]) expect(seen[3].tag).not.toEqual({ kind: "kuro" });
  });

  it("the box markup: kuro.name and Kuro's slot for Kuro's line; the player's name and portrait for theirs, never an NPC's", () => {
    const r = rig(storeAt(1), "lying");
    syncLoop(r.ctx, 0);
    const kuro = r.box();
    expect(kuro).toContain(`<span class="who tag k">${t("kuro.name")}</span>`);
    expect(kuro).toContain("kuro-portrait");
    r.act("loop-advance");
    const me = r.box();
    expect(me).toContain(`<span class="who tag">${LOGIN}</span>`);
    expect(me).toContain('class="player-portrait"');
    expect(me).not.toContain("npc-portrait");
    expect(me).not.toContain("kuro-portrait");
  });

  it("a mixed sequence is split: only Kuro's runs carry its voice; keys `<key>#n`, the last keeps the key, the ending and the choices", () => {
    const seq = { say: [{ k: "narration" as const, t: "a" }], choices: [{ text: "x" }] };
    const q: Queued = {
      key: "d3:beat:shutdown",
      lines: [
        { k: "narration", t: "a" },
        { k: "speaker", who: "kuro", t: "b" },
        { k: "speaker", who: "kuro", t: "c", backdrop: "/room/dream/x.jpg" },
        { k: "speaker", who: "me", t: "d" },
        { k: "inner", t: "e" },
      ],
      ending: { kind: "beatChoices", day: 3, beat: "shutdown" },
      sequence: seq,
    };
    const parts = splitVoices(q);
    expect(parts.map((p) => [p.key, p.lines.map((l) => l.t).join(""), p.voice ?? null, p.ending.kind])).toEqual([
      ["d3:beat:shutdown#1", "a", null, "none"],
      ["d3:beat:shutdown#2", "bc", "kuro", "none"],
      ["d3:beat:shutdown", "de", null, "beatChoices"],
    ]);
    expect(parts[2]!.sequence).toBe(seq);
    // The backdrop on from Kuro's run carries into the next piece (it lasts until the sequence ends).
    expect(parts[2]!.lines[0]!.backdrop).toBe("/room/dream/x.jpg");
    // Read in order, one click a line; pushed twice it is not queued twice.
    const r = rig(storeAt(3), "room", NIGHT);
    r.session.dialogue = push(push(EMPTY_DIALOGUE, q), q);
    expect(keys(r.session)).toEqual(["d3:beat:shutdown#1", "d3:beat:shutdown#2", "d3:beat:shutdown"]);
    const read: string[] = [];
    for (let i = 0; i < 5; i++) {
      read.push(r.shown()!.text);
      if (i < 4) r.act("loop-advance");
    }
    expect(read).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.shown()!.choices.map((c) => c.label)).toEqual(["x"]);
    // A sequence without Kuro's lines stays one item.
    expect(splitVoices({ key: "k", lines: [{ k: "narration", t: "z" }], ending: { kind: "none" } })).toHaveLength(1);
  });

  it("talking() / leaving Kuro's chat are about the chat items only: a beat's Kuro lines are not dropped", () => {
    const r = rig(storeAt(1), "lying", NIGHT);
    syncLoop(r.ctx, 0);
    const beat = keys(r.session);
    expect(talking(r.session.dialogue)).toBe(false);
    expect(r.session.dialogue.queue.some((q) => q.voice === "kuro" && !isChatItem(q))).toBe(true);
    r.act("kuro-call");
    expect(talking(r.session.dialogue)).toBe(true);
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(talking(r.session.dialogue)).toBe(false);
    // The day beat's remaining lines are still there, in order.
    expect(keys(r.session)).toEqual(beat);
  });
});

// ——— R2–R4 ———

describe("R2 · the ceiling, under 床", () => {
  it("reachable from 床; no back control (R6: getting up is an ask); the night photo after nightfall", () => {
    const store = storeAt(2);
    const r = rig(store, "bed");
    r.act("view", { view: "lying" });
    expect(r.session.view).toBe("lying");
    const out = r.room();
    expect(out).toMatch(/<div class="stage room lying-view"/);
    // No hotspots on the ceiling; Kuro's body is there (bottom-right) and the HUD.
    expect(out).not.toContain('class="shot-hit');
    expect(out).toContain('data-action="kuro-call"');
    expect(out).toContain('class="list"');
    // The back control (the bottom strip / the wheel's nav-back) does nothing here.
    r.act("nav-back");
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual([]);
    expect(hasBack("lying")).toBe(false);
    expect(edgeLeads("lying", "back")).toBe(false);
    expect(backTarget("lying")).toBeNull();
    // Esc asks instead; 起床 goes up to 床.
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual(["d2:rise:ask"]);
    r.act("loop-choice", { choice: "up" });
    expect(r.session.view).toBe("bed");
    // After nightfall, the ceiling at night.
    const night = rig(storeAt(2), "lying", { beat: "desk", time: "18:30" });
    expect(night.room()).toMatch(/<div class="stage room lying-view ceiling-night"/);
  });
});

describe("R3 · waking there", () => {
  it("the day starts lying; the boot beat plays over the ceiling; the next day starts lying again", () => {
    const store = storeAt(1);
    const r = rig(store, "lying");
    syncLoop(r.ctx, 0);
    expect(r.session.view).toBe("lying");
    expect(r.room()).toMatch(/lying-view/);
    expect(keys(r.session).map((k) => k.replace(/#\d+$/, ""))).toContain("d1:beat:boot");
    expect(r.box()).toContain(dayFiles.get(1)!.beats.boot!.say[0]!.t);
    // The next morning: lying again, whatever the last view was.
    r.session.view = "desk";
    store.appendEvent({ kind: "lieDown" });
    syncLoop(r.ctx, 0);
    expect(r.session.view).toBe("lying");
  });
});

describe("R4 · lying down before sleeping; Kuro from the bed", () => {
  it("before nightfall the bed only says room.bed.notyet: no view change", () => {
    const r = rig(storeAt(1), "bed");
    r.act("bed");
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual(["d1:bed:notyet"]);
  });

  it("after nightfall the bed goes to `lying` first (from 床 at once, from 房间 via 床); the ask is asked there", () => {
    const store = storeAt(1);
    completeUntil(store, "bed", { all: true });
    const fromBed = rig(store, "bed");
    fromBed.act("bed");
    expect(fromBed.session.view).toBe("lying");
    expect(keys(fromBed.session)).toEqual(["d1:bed:ask"]);
    const fromRoom = rig(store, "room");
    fromRoom.act("bed");
    expect(fromRoom.session.view).toBe("bed");
    fromRoom.run();
    expect(fromRoom.session.view).toBe("lying");
    expect(keys(fromRoom.session)).toEqual(["d1:bed:ask"]);
  });

  it("locked (the night's items not done): room.bed.locked, said from where the player stands; no lying down (gates R1)", () => {
    const store = storeAt(1);
    completeUntil(store, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    const r = rig(store, "bed");
    r.act("bed");
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual(["d1:bed:locked"]);
  });

  it("再待会儿 keeps the player lying; Kuro can be called from the bed; closing the chat asks again and 睡 starts the night from there", () => {
    const store = storeAt(1);
    completeUntil(store, "bed", { all: true });
    const r = rig(store, "bed", NIGHT);
    r.act("bed");
    r.act("loop-choice", { choice: "stay" });
    expect(r.session.view).toBe("lying");
    expect(r.session.dialogue.queue).toEqual([]);
    // Kuro from the bed: the conversation opens; leaving it, still lying, and the bed asks again.
    r.act("kuro-call");
    expect(talking(r.session.dialogue)).toBe(true);
    r.act("kuro-leave");
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual(["d1:bed:ask"]);
    const before = store.getEvents().length;
    r.act("loop-choice", { choice: "sleep" });
    // The night begins at once, from the bed: no turn first.
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual(["d1:beat:night"]);
    for (let i = 0; i < dayFiles.get(1)!.beats.night!.say.length; i++) r.act("loop-advance");
    expect(store.getState().day).toBe(2);
    expect(store.getEvents().slice(before).some((e) => e.kind === "lieDown")).toBe(true);
  });

  it("the chat closing by Esc or by 先不聊 also asks again, once; never before nightfall, when locked, or off the bed", () => {
    const store = storeAt(1);
    completeUntil(store, "bed", { all: true });
    const esc = rig(store, "lying", NIGHT);
    esc.act("kuro-call");
    expect(loopKeys(esc.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(esc.session.view).toBe("lying");
    expect(keys(esc.session)).toEqual(["d1:bed:ask"]);
    const no = rig(store, "lying", NIGHT);
    no.act("kuro-call");
    no.act("loop-choice", { choice: "no" });
    expect(talking(no.session.dialogue)).toBe(false);
    expect(keys(no.session)).toEqual(["d1:bed:ask"]);
    // The ask already waiting behind the chat (the bed clicked while talking): not asked twice.
    const queued = rig(store, "lying", NIGHT);
    queued.act("kuro-call");
    queued.act("bed");
    expect(keys(queued.session).at(-1)).toBe("d1:bed:ask");
    queued.act("kuro-leave");
    expect(keys(queued.session)).toEqual(["d1:bed:ask"]);
    // Off the bed: nothing.
    const room = rig(store, "room", NIGHT);
    room.act("kuro-call");
    room.act("kuro-leave");
    expect(keys(room.session)).toEqual([]);
    // Before nightfall (lying in the morning): nothing.
    const morning = rig(storeAt(2), "lying");
    morning.act("kuro-call");
    morning.act("kuro-leave");
    expect(keys(morning.session)).toEqual([]);
    // Locked (the night's items not done): nothing.
    const locked = storeAt(1);
    completeUntil(locked, "dinner", { all: true, skip: ["dinner", "desk", "shutdown", "chat"] });
    const l = rig(locked, "lying", NIGHT);
    l.act("kuro-call");
    l.act("kuro-leave");
    expect(keys(l.session)).toEqual([]);
  });

  it("睡 given elsewhere lies down first: the night begins only once the player is on the bed", () => {
    const store = storeAt(1);
    completeUntil(store, "bed", { all: true });
    const r = rig(store, "room");
    r.act("sleep");
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual([]);
    r.run();
    expect(r.session.view).toBe("lying");
    expect(keys(r.session)).toEqual(["d1:beat:night"]);
  });
});

// ——— R6 ———

describe("R6 · getting up is an ask; the day's `rise` beat plays once after the first 起床", () => {
  const real = new Map(dayFiles);
  afterEach(() => {
    const m = dayFiles as Map<number, DayFile>;
    m.clear();
    for (const [k, v] of real) m.set(k, v);
  });
  /** Day 1 with a two-line `rise` beat (fixture lines, not content). */
  const withRise = () => {
    const d1 = real.get(1)!;
    (dayFiles as Map<number, DayFile>).set(1, { ...d1, beats: { ...d1.beats, rise: { say: [{ k: "narration", t: "rise-1" }, { k: "inner", t: "rise-2" }] } } });
  };

  it("the ask from Esc, ← / →, the back key: 要起来吗？ with 起床 / 再躺一会儿; 再躺一会儿 stays", () => {
    for (const key of ["Escape", "ArrowLeft", "ArrowRight", "Backspace"]) {
      const r = rig(storeAt(1), "lying");
      expect(loopKeys(r.ctx, { key } as KeyboardEvent), key).toBe(true);
      expect(r.session.view, key).toBe("lying");
      expect(keys(r.session), key).toEqual(["d1:rise:ask"]);
      const m = r.shown()!;
      expect(m.text).toBe(t("room.rise.ask"));
      expect(m.choices.map((c) => [c.choice, c.label])).toEqual([["up", t("room.rise.up")], ["stay", t("room.rise.stay")]]);
      // Asked twice, it is there once.
      loopKeys(r.ctx, { key } as KeyboardEvent);
      expect(keys(r.session)).toEqual(["d1:rise:ask"]);
      r.act("loop-choice", { choice: "stay" });
      expect(r.session.view).toBe("lying");
      expect(keys(r.session)).toEqual([]);
    }
  });

  it("the ask from a click on the ceiling (the `rise` action); not off the bed, not over Kuro's chat or a held thing", () => {
    const r = rig(storeAt(1), "lying");
    r.act("rise");
    expect(keys(r.session)).toEqual(["d1:rise:ask"]);
    const bed = rig(storeAt(1), "bed");
    bed.act("rise");
    expect(keys(bed.session)).toEqual([]);
    const chat = rig(storeAt(1), "lying", NIGHT);
    chat.act("kuro-call");
    const before = keys(chat.session);
    chat.act("rise");
    expect(keys(chat.session)).toEqual(before);
    const held = rig(storeAt(1), "lying");
    held.session.holding = "chick";
    held.act("rise");
    expect(keys(held.session)).toEqual([]);
  });

  it("while a line is up the ask waits behind it; it is not added behind the bed's own question", () => {
    const r = rig(storeAt(1), "lying");
    syncLoop(r.ctx, 0);
    const boot = keys(r.session);
    expect(boot.length).toBeGreaterThan(0);
    r.act("rise");
    expect(keys(r.session)).toEqual([...boot, "d1:rise:ask"]);
    const store = storeAt(1);
    completeUntil(store, "bed", { all: true });
    const night = rig(store, "bed", NIGHT);
    night.act("bed");
    expect(keys(night.session)).toEqual(["d1:bed:ask"]);
    night.act("rise");
    expect(keys(night.session)).toEqual(["d1:bed:ask"]);
    // 再待会儿, then getting up from there is the same 起床 ask.
    night.act("loop-choice", { choice: "stay" });
    night.act("rise");
    expect(keys(night.session)).toEqual(["d1:rise:ask"]);
    night.act("loop-choice", { choice: "up" });
    expect(night.session.view).toBe("bed");
  });

  it("起床 lands on 床 and plays `rise` there, once a day; a day without `rise` plays nothing", () => {
    withRise();
    const store = storeAt(1);
    const r = rig(store, "lying");
    // Waking: the boot beat (set aside here; the ask waits behind it, tested above).
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    r.act("rise");
    r.act("loop-choice", { choice: "up" });
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual(["d1:beat:rise"]);
    expect(r.shown()!.text).toBe("rise-1");
    r.act("loop-advance");
    expect(r.shown()!.text).toBe("rise-2");
    r.act("loop-advance");
    expect(keys(r.session)).toEqual([]);
    // Lying again and up again the same day: nothing.
    r.act("view", { view: "lying" });
    r.act("rise");
    r.act("loop-choice", { choice: "up" });
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual([]);
    // The next day plays its own (day 2 has one since the openings were split, content 2026-11-06).
    store.appendEvent({ kind: "lieDown" });
    syncLoop(r.ctx, 0);
    r.session.dialogue = EMPTY_DIALOGUE;
    expect(r.session.view).toBe("lying");
    r.act("rise");
    r.act("loop-choice", { choice: "up" });
    expect(r.session.view).toBe("bed");
    expect(keys(r.session)).toEqual(["d2:beat:rise"]);
  });

  it("the parser: a day file with `rise` parses, one without still does; `rise` with an unknown key fails", () => {
    const raw = structuredClone(dayOneRaw) as { beats: Record<string, unknown> };
    delete raw.beats.rise; // day 1 has one since the opening was split (content 2026-11-06)
    expect(parseDayFile(raw, "day-01.json").beats.rise).toBeUndefined();
    raw.beats.rise = { say: [{ k: "narration", t: "rise-1" }] };
    expect(parseDayFile(raw, "day-01.json").beats.rise!.say.map((l) => l.t)).toEqual(["rise-1"]);
    raw.beats.rise = { say: [{ k: "narration", t: "rise-1" }], choices: [{ text: "x" }] };
    expect(() => parseDayFile(raw, "day-01.json")).toThrow(/beats\.rise.*unknown key "choices"/);
    raw.beats.rise = { say: [{ k: "narration", t: "rise-1" }], foo: 1 };
    expect(() => parseDayFile(raw, "day-01.json")).toThrow(/beats\.rise.*unknown key "foo"/);
  });
});
