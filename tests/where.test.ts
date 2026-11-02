// dialogue addition 2026-11-02: a line waits for its place. The loader accepts `where` on lines and
// sequences and rejects anything outside the listed set; a line whose place is not the player's
// waits; order is kept inside a sequence; across sequences the first with a playable next line
// plays; waiting lines are dropped at lieDown and are never events.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { dayFiles, parseDayFile, parseLine, parsePlace, PLACES, type Place, type SayLine } from "@state/days/table";
import { parseTaskFile } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK, type BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { hereOf, settleSession } from "@world/dialogue/place";
import { dropWaiting, EMPTY_DIALOGUE, placeMatches, placedLines, push, settle, showing, type Here, type Queued } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";

const line = (t: string, where?: Place): SayLine => ({ k: "narration", t, ...(where ? { where } : {}) });
const item = (key: string, lines: SayLine[]): Queued => ({ key, lines, ending: { kind: "none" } });
const NIGHT: BeatClock = { beat: "night", time: "23:41" };

function ctxOf(store: Store, view: Session["view"] = "room", clock: BeatClock = DEFAULT_CLOCK) {
  const ctx: ActionContext = { store, session: initialSession(clock, "left", view), rerender: () => {}, later: () => {} };
  return ctx;
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const atDay = (day: number): Store => {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};
/** The text on show, or null when the box is closed. */
const onShow = (ctx: ActionContext): string | null => showing(ctx.session.dialogue, ctx.store.getState())?.line?.t ?? null;
const waitingKeys = (ctx: ActionContext) => (ctx.session.dialogue.waiting ?? []).map((w) => w.item.key);

describe("the loader", () => {
  const base = (extra: Record<string, unknown> = {}) => ({
    day: 3,
    beats: { boot: { say: [{ k: "narration", t: "a", ...extra }] } },
    items: [],
    delivery: { minMinutes: 1, waitMinutes: 2 },
  });

  it("accepts every listed place on a line", () => {
    expect(PLACES).toEqual([
      "room", "desk", "door", "night", "screen", "screen:msgs", "screen:workbench", "screen:browser",
      ...["boss", "partner", "group", "xiaozhang", "laozhou", "family", "clan"].map((id) => `screen:msgs:${id}`),
      ...["home", "tasks", "docs", "code", "ledger", "tickets", "projects"].map((p) => `screen:workbench:${p}`),
    ]);
    for (const where of PLACES) expect(parseDayFile(base({ where }), "day-03.json").beats.boot!.say[0]!.where, where).toBe(where);
  });

  it("accepts `where` on a sequence, in beats, onUnlock and onDone", () => {
    const raw = {
      day: 3,
      beats: { desk: { where: "desk", say: [{ k: "narration", t: "a" }] } },
      items: [{ id: "x", text: "t", unlock: "start", done: "flag:f", required: false, onUnlock: { where: "screen:msgs", say: [{ k: "inner", t: "b" }] }, onDone: { where: "room", say: [{ k: "inner", t: "c" }] } }],
      delivery: { minMinutes: 1, waitMinutes: 2 },
    };
    const file = parseDayFile(raw, "day-03.json");
    expect(file.beats.desk!.where).toBe("desk");
    expect(file.items[0]!.onUnlock!.where).toBe("screen:msgs");
    expect(file.items[0]!.onDone!.where).toBe("room");
  });

  it.each([
    ["an unknown place", "kitchen"],
    ["a screen app that is not one", "screen:mail"],
    ["a different case", "Room"],
    ["an empty string", ""],
    ["a number", 3],
    ["null", null],
    ["a list", ["room"]],
  ])("rejects %s on a line and on a sequence", (_name, where) => {
    expect(() => parseDayFile(base({ where }), "day-03.json")).toThrow(/unknown place/);
    const seq = { day: 3, beats: { boot: { where, say: [{ k: "narration", t: "a" }] } }, items: [], delivery: { minMinutes: 1, waitMinutes: 2 } };
    expect(() => parseDayFile(seq, "day-03.json")).toThrow(/unknown place/);
    const onDone = { day: 3, beats: {}, items: [{ id: "x", text: "t", unlock: "start", done: "flag:f", required: false, onDone: { where, say: [{ k: "narration", t: "a" }] } }], delivery: { minMinutes: 1, waitMinutes: 2 } };
    expect(() => parseDayFile(onDone, "day-03.json")).toThrow(/unknown place/);
  });

  it("task trees are not day files: their lines may not carry `where`", () => {
    expect(() => parseLine({ k: "narration", t: "a", where: "room" }, "x")).toThrow(/unknown key "where"/);
    expect(parsePlace("desk", "x")).toBe("desk");
    expect(() => parsePlace("nowhere", "x")).toThrow(/unknown place/);
    expect(parseTaskFile).toBeTypeOf("function");
  });

  it("every `where` in the real day files is a listed place, on a line or a sequence", () => {
    let seen = 0;
    for (const file of dayFiles.values()) {
      const seqs = [...Object.values(file.beats), ...file.items.flatMap((i) => [i.onUnlock, i.onDone])];
      for (const seq of seqs) {
        if (!seq) continue;
        for (const w of [seq.where, ...seq.say.map((l) => l.where)]) if (w !== undefined) (seen++, expect(PLACES).toContain(w));
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("a sequence's `where` is the default of its lines; a line's own wins; none stays none", () => {
    const seq = { say: [line("a"), line("b", "room")], where: "desk" as const };
    expect(placedLines(seq).map((l) => l.where)).toEqual(["desk", "room"]);
    const plain = { say: [line("a")] };
    expect(placedLines(plain)).toBe(plain.say);
  });
});

describe("matching", () => {
  const here = (view: Here["view"], app: string | null = null, night = false): Here => ({ view, app, night });
  it("room, desk and door match their view; screen any desktop app; screen:<app> that app in front; night the night", () => {
    const where = (w: Place, h: Here) => placeMatches(w, h);
    expect(where("room", here("room"))).toBe(true);
    expect(where("room", here("desk"))).toBe(false);
    expect(where("desk", here("desk"))).toBe(true);
    expect(where("desk", here("room"))).toBe(false);
    expect(where("door", here("door"))).toBe(true);
    expect(where("door", here("desktop", "msgs"))).toBe(false);
    for (const app of ["msgs", "workbench", "browser"]) {
      expect(where("screen", here("desktop", app))).toBe(true);
      expect(where(`screen:${app}` as Place, here("desktop", app))).toBe(true);
      for (const other of ["msgs", "workbench", "browser"].filter((a) => a !== app)) expect(where(`screen:${app}` as Place, here("desktop", other)), `${app} vs ${other}`).toBe(false);
      expect(where(`screen:${app}` as Place, here("room", null))).toBe(false);
    }
    expect(where("screen", here("room"))).toBe(false);
    expect(where("night", here("room", null, true))).toBe(true);
    expect(where("night", here("room", null, false))).toBe(false);
  });

  it("no `where` plays anywhere", () => {
    for (const view of ["room", "desk", "desktop", "door"] as const) expect(placeMatches(undefined, here(view, view === "desktop" ? "msgs" : null))).toBe(true);
  });

  it("the place comes from the session: either monitor's app in front, the chat overlay changes nothing", () => {
    const store = atDay(1);
    const left = ctxOf(store, "desktop");
    left.session.leftApp = "msgs";
    // 消息 in front: its open conversation (家里's 爸妈 by default) is the third level.
    expect(hereOf(left.session)).toEqual({ view: "desktop", app: "msgs", night: false, conversation: "family", page: null });
    left.session.focus = "right"; // the right monitor shows the other app
    expect(hereOf(left.session).app).toBe("workbench");
    left.session.leftApp = "workbench";
    expect(hereOf(left.session).app).toBe("msgs");
    expect(hereOf(ctxOf(store, "desk").session).app).toBeNull();
    expect(hereOf(ctxOf(store, "room", NIGHT).session).night).toBe(true);
  });
});

describe("settle (pure)", () => {
  const here = (view: Here["view"], app: string | null = null): Here => ({ view, app, night: false });

  it("no `where` anywhere gives the dialogue back unchanged", () => {
    let d = push(EMPTY_DIALOGUE, item("a", [line("1"), line("2")]));
    d = push(d, item("b", [line("3")]));
    for (const h of [here("room"), here("desk"), here("desktop", "msgs"), here("door")]) expect(settle(d, h)).toBe(d);
    expect(settle(EMPTY_DIALOGUE, here("room"))).toBe(EMPTY_DIALOGUE);
  });

  it("idempotent, and it never loses or duplicates a sequence", () => {
    const places = fc.constantFrom<Place | undefined>(undefined, "room", "desk", "door", "screen", "screen:msgs", "screen:workbench");
    const view = fc.constantFrom<Here>(here("room"), here("desk"), here("door"), here("desktop", "msgs"), here("desktop", "workbench"));
    fc.assert(
      fc.property(fc.array(fc.array(places, { minLength: 1, maxLength: 4 }), { maxLength: 5 }), fc.array(view, { minLength: 1, maxLength: 6 }), (seqs, route) => {
        let d = EMPTY_DIALOGUE;
        seqs.forEach((ws, i) => (d = push(d, item(`s${i}`, ws.map((w, j) => line(`s${i}l${j}`, w))))));
        for (const h of route) {
          d = settle(d, h);
          expect(settle(d, h)).toBe(d);
          const keys = [...d.queue.map((q) => q.key), ...(d.waiting ?? []).map((w) => w.item.key)].sort();
          expect(keys).toEqual(seqs.map((_, i) => `s${i}`).sort());
          // What is on show plays here.
          const q = d.queue[0];
          if (q) expect(placeMatches(q.lines[d.line]?.where, h)).toBe(true);
        }
      }),
    );
  });

  it("dropWaiting empties only the waiting list", () => {
    const d = settle(push(EMPTY_DIALOGUE, item("a", [line("1", "screen")])), here("room"));
    expect(d.waiting).toHaveLength(1);
    const dropped = dropWaiting(d);
    expect(dropped.waiting).toEqual([]);
    expect(dropWaiting(dropped)).toBe(dropped);
    expect(dropWaiting(EMPTY_DIALOGUE)).toBe(EMPTY_DIALOGUE);
  });

  it("a sequence already queued or waiting is not queued twice", () => {
    const a = item("a", [line("1", "screen")]);
    const d = settle(push(EMPTY_DIALOGUE, a), here("room"));
    expect(push(d, a)).toBe(d);
  });
});

describe("a sequence [desk, screen:msgs, room] plays one line per view, in order", () => {
  const seq = item("walk", [line("first, at the desk", "desk"), line("second, in 消息", "screen:msgs"), line("third, in the room", "room")]);

  it("while the player moves desk → screen(msgs) → room", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" }); // 屏幕 opens once the computer is on
    const ctx = ctxOf(store, "desk");
    ctx.session.leftApp = "msgs";
    ctx.session.dialogue = push(ctx.session.dialogue, seq);
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("first, at the desk");

    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull(); // the box closes at the end of the line; the next one waits
    expect(waitingKeys(ctx)).toEqual(["walk"]);
    expect(dialogueBox(store.getState(), store.getEvents(), ctx.session)).toBeNull();

    act(ctx, "view", { view: "desktop", screen: "left" });
    expect(onShow(ctx)).toBe("second, in 消息");
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull();

    act(ctx, "view", { view: "room" });
    expect(onShow(ctx)).toBe("third, in the room");
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull();
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(ctx.session.dialogue.waiting ?? []).toEqual([]);
  });

  it("order is kept: the second line cannot play before the first, wherever the player stands", () => {
    const store = atDay(1);
    const ctx = ctxOf(store, "desktop");
    ctx.session.leftApp = "msgs";
    ctx.session.dialogue = push(ctx.session.dialogue, seq);
    settleSession(ctx.session);
    expect(onShow(ctx)).toBeNull(); // the first line is for the desk; the second (here) must wait for it
    act(ctx, "view", { view: "room" });
    expect(onShow(ctx)).toBeNull();
    act(ctx, "view", { view: "desk" });
    expect(onShow(ctx)).toBe("first, at the desk");
  });

  it("a line on show is taken back when the player leaves its place, and resumes where it was", () => {
    const store = atDay(1);
    const ctx = ctxOf(store, "desk");
    ctx.session.dialogue = push(ctx.session.dialogue, seq);
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("first, at the desk");
    act(ctx, "view", { view: "room" });
    expect(onShow(ctx)).toBeNull();
    act(ctx, "view", { view: "desk" });
    expect(onShow(ctx)).toBe("first, at the desk");
  });

  it("a `screen:msgs` line does not play in screen(workbench), on either monitor", () => {
    const store = atDay(1);
    const ctx = ctxOf(store, "desktop");
    ctx.session.leftApp = "workbench";
    ctx.session.dialogue = push(ctx.session.dialogue, item("m", [line("about the messages", "screen:msgs")]));
    settleSession(ctx.session);
    expect(onShow(ctx)).toBeNull();
    // The left monitor has the workbench in front; the right one has 消息.
    act(ctx, "screen", { screen: "right" });
    expect(onShow(ctx)).toBe("about the messages");
    act(ctx, "screen", { screen: "left" });
    expect(onShow(ctx)).toBeNull();
    // And through the dock.
    act(ctx, "dock", { app: "msgs" });
    expect(onShow(ctx)).toBe("about the messages");
    act(ctx, "dock", { app: "browser" });
    expect(onShow(ctx)).toBeNull();
  });
});

describe("across sequences", () => {
  it("the first sequence whose next line plays here plays; the others keep waiting in queue order", () => {
    const store = atDay(1);
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" }); // 屏幕 opens once the computer is on
    const ctx = ctxOf(store, "room");
    const a = item("a", [line("a: screen", "screen")]);
    const b = item("b", [line("b: anywhere")]);
    const c = item("c", [line("c: screen too", "screen")]);
    const d = item("d", [line("d: room", "room")]);
    for (const q of [a, b, c, d]) ctx.session.dialogue = push(ctx.session.dialogue, q);
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("b: anywhere"); // a waits, b is the first that plays here
    expect(waitingKeys(ctx)).toEqual(["a"]);
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBe("d: room"); // c is skipped (screen), d plays in the room
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull();
    expect(waitingKeys(ctx)).toEqual(["a", "c"]);
    act(ctx, "view", { view: "desktop", screen: "left" });
    expect(onShow(ctx)).toBe("a: screen"); // queue order: a before c
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBe("c: screen too");
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull();
  });

  it("a waiting sequence does not push in front of a line being read", () => {
    const store = atDay(1);
    const ctx = ctxOf(store, "room");
    ctx.session.dialogue = push(ctx.session.dialogue, item("w", [line("waits for the screen", "screen")]));
    ctx.session.dialogue = push(ctx.session.dialogue, item("r", [line("room one"), line("room two")]));
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("room one");
    ctx.session.view = "desktop"; // the player walks into the screen mid-line
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("room one"); // it has no place of its own: it stays on show
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBe("room two");
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBe("waits for the screen");
  });

  it("Kuro's items and prompts (no `where`) play wherever the player is", () => {
    const store = atDay(1);
    const ctx = ctxOf(store, "room");
    ctx.session.dialogue = push(ctx.session.dialogue, item("w", [line("for the desk", "desk")]));
    ctx.session.dialogue = push(ctx.session.dialogue, { key: "k", lines: [{ k: "speaker", who: "Kuro", t: "hello" }], ending: { kind: "none" }, voice: "kuro" });
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("hello");
    expect(waitingKeys(ctx)).toEqual(["w"]);
  });
});

describe("waiting lines are not events and do not outlive the day", () => {
  it("parking and releasing append nothing to the log", () => {
    const store = atDay(3);
    const ctx = ctxOf(store, "room");
    const before = store.getEvents().length;
    ctx.session.dialogue = push(ctx.session.dialogue, item("w", [line("x", "screen")]));
    settleSession(ctx.session);
    act(ctx, "view", { view: "desktop", screen: "left" });
    const events = store.getEvents().slice(before).map((e) => e.kind);
    // The view change itself may log that you looked (`step openApp`); the waiting line logs nothing.
    expect(events.every((k) => k === "step" || k === "open")).toBe(true);
    expect(store.getEvents().some((e) => JSON.stringify(e).includes('"x"'))).toBe(false);
  });

  it("lines left waiting at lieDown are gone the next morning", () => {
    const store = atDay(2);
    const ctx = ctxOf(store, "room");
    syncLoop(ctx); // the day's memo
    ctx.session.dialogue = push(ctx.session.dialogue, item("never read", [line("a line for a screen the player never entered", "screen:browser")]));
    settleSession(ctx.session);
    expect(waitingKeys(ctx)).toEqual(["never read"]);
    store.appendEvent({ kind: "lieDown" });
    syncLoop(ctx);
    expect(store.getState().day).toBe(3);
    expect(ctx.session.dialogue.waiting ?? []).toEqual([]);
    act(ctx, "view", { view: "desktop", screen: "left" });
    ctx.session.leftApp = "browser";
    settleSession(ctx.session);
    expect(onShow(ctx)).not.toBe("a line for a screen the player never entered");
  });
});

describe("a real day: day 7 boot, the room line first, the 老板 line only after entering the screen", () => {
  function boot() {
    const store = atDay(7);
    const ctx = ctxOf(store, "room");
    syncLoop(ctx);
    act(ctx, "tower-power");
    syncLoop(ctx);
    return { store, ctx };
  }
  const box = (ctx: ActionContext) => dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)?.value ?? null;

  /** Into 屏幕, then 工作台's 消息 pane, where the boss's conversation is open by default. */
  const toBoss = (ctx: ActionContext) => {
    act(ctx, "view", { view: "desktop", screen: "left" });
    act(ctx, "dock", { app: "workbench" });
    act(ctx, "wb-nav", { page: "msgs" });
  };

  it("plays the first line in the room, then closes; the next two come with the boss's conversation", () => {
    const { ctx } = boot();
    const seq = dayFiles.get(7)!.beats.boot!;
    expect(seq.say.map((l) => l.where)).toEqual([undefined, "screen:msgs:boss", "screen"]);
    expect(onShow(ctx)).toBe(seq.say[0]!.t);
    const room = box(ctx);
    expect(room).toContain(seq.say[0]!.t);
    expect(room).not.toContain(seq.say[1]!.t);
    expect(room).toMatchSnapshot();

    act(ctx, "loop-advance");
    expect(box(ctx)).toBeNull(); // the 老板 line is not read before the screen is entered
    expect(waitingKeys(ctx)).toEqual(["d7:beat:boot"]);

    act(ctx, "view", { view: "desktop", screen: "left" });
    syncLoop(ctx);
    // 消息 (家里) is in front: the boss's line keeps waiting; no falling back to `screen:msgs`.
    expect(onShow(ctx)).toBeNull();
    act(ctx, "dock", { app: "workbench" });
    act(ctx, "wb-nav", { page: "msgs" });
    expect(onShow(ctx)).toBe(seq.say[1]!.t);
    const screen = box(ctx);
    expect(screen).toContain("老板");
    expect(screen).toMatchSnapshot();

    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBe(seq.say[2]!.t);
    act(ctx, "loop-advance");
    expect(onShow(ctx)).toBeNull();
    expect(ctx.session.dialogue.waiting ?? []).toEqual([]);
  });

  it("walking back out to the room mid-way takes the screen lines back; they are not lost", () => {
    const { ctx } = boot();
    const seq = dayFiles.get(7)!.beats.boot!;
    act(ctx, "loop-advance");
    toBoss(ctx);
    expect(onShow(ctx)).toBe(seq.say[1]!.t);
    act(ctx, "view", { view: "room" });
    expect(onShow(ctx)).toBeNull();
    // Back in, 工作台 still in front on its 消息 pane with the boss open.
    act(ctx, "view", { view: "desktop", screen: "left" });
    expect(onShow(ctx)).toBe(seq.say[1]!.t);
  });
});

describe("the third level: screen:msgs:<conversation>, screen:workbench:<page>", () => {
  const base = (where: unknown) => ({ day: 3, beats: { boot: { say: [{ k: "narration", t: "a", where }] } }, items: [], delivery: { minMinutes: 1, waitMinutes: 2 } });

  it("the loader accepts every listed third level and rejects any other", () => {
    for (const where of ["screen:msgs:boss", "screen:msgs:clan", "screen:workbench:docs", "screen:workbench:tasks", "screen:browser"]) {
      expect(parseDayFile(base(where), "day-03.json").beats.boot!.say[0]!.where).toBe(where);
    }
    for (const where of ["screen:msgs:mom", "screen:msgs:", "screen:workbench:msgs", "screen:workbench:Docs", "screen:browser:news", "screen:msgs:boss:x", "room:desk"]) {
      expect(() => parseDayFile(base(where), "day-03.json"), where).toThrow(/unknown place/);
    }
  });

  it("matches exactly, in whichever app holds the conversation; never one level up", () => {
    const h = (app: string, conversation: string | null, page: string | null = null): Here => ({ view: "desktop", app, night: false, conversation, page });
    expect(placeMatches("screen:msgs:boss", h("workbench", "boss", "msgs"))).toBe(true);
    expect(placeMatches("screen:msgs:clan", h("msgs", "clan"))).toBe(true);
    expect(placeMatches("screen:msgs:boss", h("msgs", "clan"))).toBe(false);
    expect(placeMatches("screen:msgs:boss", h("msgs", null))).toBe(false); // the 消息 list, 朋友圈
    expect(placeMatches("screen:msgs:boss", h("workbench", null, "home"))).toBe(false);
    expect(placeMatches("screen:msgs:boss", { view: "desk", app: null, night: false })).toBe(false);
    expect(placeMatches("screen:workbench:docs", h("workbench", null, "docs"))).toBe(true);
    expect(placeMatches("screen:workbench:docs", h("workbench", null, "home"))).toBe(false);
    expect(placeMatches("screen:workbench:docs", h("msgs", "family"))).toBe(false);
    // The second level still matches its app, whatever is open in it (and `screen:msgs` 工作台's 消息 pane too).
    expect(placeMatches("screen:msgs", h("msgs", "clan"))).toBe(true);
    expect(placeMatches("screen:msgs", h("workbench", "boss", "msgs"))).toBe(true);
    expect(placeMatches("screen:msgs", h("workbench", null, "docs"))).toBe(false);
    expect(placeMatches("screen:workbench", h("workbench", "boss", "msgs"))).toBe(true);
  });

  it("hereOf reads the open conversation and 工作台's page from the session", () => {
    const ctx = ctxOf(atDay(1), "desktop");
    ctx.session.leftApp = "workbench";
    expect(hereOf(ctx.session)).toMatchObject({ app: "workbench", page: "home", conversation: null });
    ctx.session.workbenchPage = "msgs";
    expect(hereOf(ctx.session)).toMatchObject({ app: "workbench", page: "msgs", conversation: "boss" });
    ctx.session.leftApp = "msgs";
    ctx.session.homeConversation = "clan";
    expect(hereOf(ctx.session)).toMatchObject({ app: "msgs", page: null, conversation: "clan" });
    ctx.session.homeConversation = "feed";
    expect(hereOf(ctx.session).conversation).toBeNull();
  });

  function onDesktop() {
    const store = atDay(1);
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    return ctxOf(store, "desktop");
  }

  it("a screen:msgs:boss line waits in screen:msgs:clan and plays on switching back", () => {
    const ctx = onDesktop();
    ctx.session.leftApp = "workbench";
    ctx.session.workbenchPage = "msgs";
    act(ctx, "conv", { conv: "boss" });
    ctx.session.dialogue = push(ctx.session.dialogue, item("b", [line("about the boss", "screen:msgs:boss")]));
    settleSession(ctx.session);
    expect(onShow(ctx)).toBe("about the boss");
    // To 消息's 相亲相爱一家人: the line is taken back and waits.
    act(ctx, "dock", { app: "msgs" });
    act(ctx, "conv", { conv: "clan" });
    expect(onShow(ctx)).toBeNull();
    expect(waitingKeys(ctx)).toEqual(["b"]);
    // Another work conversation is not the boss either.
    act(ctx, "dock", { app: "workbench" });
    act(ctx, "conv", { conv: "partner" });
    expect(onShow(ctx)).toBeNull();
    act(ctx, "conv", { conv: "boss" });
    expect(onShow(ctx)).toBe("about the boss");
  });

  it("a screen:workbench:docs line waits on 工作台's home and plays on 文档", () => {
    const ctx = onDesktop();
    act(ctx, "dock", { app: "workbench" });
    ctx.session.dialogue = push(ctx.session.dialogue, item("d", [line("in the document", "screen:workbench:docs")]));
    settleSession(ctx.session);
    expect(onShow(ctx)).toBeNull();
    act(ctx, "wb-nav", { page: "docs" });
    expect(onShow(ctx)).toBe("in the document");
    act(ctx, "wb-nav", { page: "home" });
    expect(onShow(ctx)).toBeNull();
  });

  it("every third-level `where` in the day files names a conversation or page that exists", () => {
    for (const file of dayFiles.values()) {
      const seqs = [...Object.values(file.beats), ...file.items.flatMap((i) => [i.onUnlock, i.onDone])];
      for (const seq of seqs) for (const l of seq?.say ?? []) if (l.where?.split(":").length === 3) expect(PLACES).toContain(l.where);
    }
  });
});
