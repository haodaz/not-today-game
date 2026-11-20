// bedside-book (author 2026-11-13): the book on the headboard shelf, read lying down (the bed and rise
// asks' 看书) or standing (the shelf book); its URL from the player's names and the days lived; the
// first-time lines once per profile; the ask again after closing.
import { describe, expect, it } from "vitest";
import { createProfileWriter } from "@state/saves";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { BED_OPTIONS, BED_RECORD_OPTIONS, push, RISE_OPTIONS } from "@world/loop/dialogue";
import { bookUrl, daysLived, EMPTY_COLLECTION, titleBookDays } from "@world/room/collection";
import { loopActions } from "@world/room/game";
import { readCollection } from "../src/ui/collection";
import { memoryStorage } from "@state/slot";

setLocale("zh");

const names: State["names"] = { login: "林 晚", nick: "小晚", calledBy: "老大", bossCalls: "小林", pronoun: "she", portrait: "p1" };

describe("the choices", () => {
  it("the bed, the bed with the recorder, and the rise ask each end with 看书", () => {
    for (const opts of [BED_OPTIONS, BED_RECORD_OPTIONS, RISE_OPTIONS]) {
      const last = opts[opts.length - 1]!;
      expect(last).toMatchObject({ choice: "read", labelKey: "room.book.read", index: opts.length - 1 });
      expect(t(last.labelKey!)).toBe("看书");
    }
    // 睡 / 起 keep their places (the replay driver picks them by text)
    expect(BED_OPTIONS.map((o) => o.choice)).toEqual(["sleep", "stay", "read"]);
    expect(RISE_OPTIONS.map((o) => o.choice)).toEqual(["up", "stay", "read"]);
  });
});

describe("the reader's URL", () => {
  it("the names, 她 / 他, the days, embed; empty fields left out", () => {
    expect(bookUrl(names, 3)).toBe(`/gamebook/index.html?name=${encodeURIComponent("林 晚")}&nick=${encodeURIComponent("小晚")}&call=${encodeURIComponent("老大")}&boss=${encodeURIComponent("小林")}&ta=${encodeURIComponent("她")}&days=3&embed=1`);
    expect(bookUrl({ ...names, pronoun: "he" }, 0)).toContain(`ta=${encodeURIComponent("他")}`);
    expect(bookUrl({ ...names, pronoun: null }, 0)).toContain(`ta=${encodeURIComponent("他")}`);
    const bare = bookUrl({ login: "", nick: "  ", calledBy: "", bossCalls: "", pronoun: null }, 1);
    expect(bare).toBe(`/gamebook/index.html?ta=${encodeURIComponent("他")}&days=1&embed=1`);
  });
  it("days lived: today counts once its shutdown beat happened; the title gives 18 after a finished run, else 0", () => {
    const store = createStore({ startDay: 1 });
    expect(daysLived(store.getState(), store.getEvents())).toBe(0);
    store.appendEvent({ kind: "step", name: "beat:shutdown", t: "23:00" });
    expect(daysLived(store.getState(), store.getEvents())).toBe(1);
    store.appendEvent({ kind: "lieDown" });
    // the morning of day 2: day 1 is there, day 2 is not yet
    expect(daysLived(store.getState(), store.getEvents())).toBe(1);
    expect(titleBookDays(EMPTY_COLLECTION)).toBe(0);
    expect(titleBookDays({ finishedRuns: 1 })).toBe(18);
  });
});

describe("reading", () => {
  const rig = (bookRead = false) => {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "lying");
    session.collection = { ...EMPTY_COLLECTION, ...(bookRead ? { bookRead: true } : {}) };
    let marked = 0;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0, bookRead: () => void marked++ };
    const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
    const readOn = () => {
      for (let i = 0; i < 6 && session.dialogue.queue.length && !session.bookOpen; i++) act("loop-advance");
    };
    const lines = () => session.dialogue.queue.flatMap((q) => q.lines.map((l) => l.t));
    return { store, session, act, readOn, lines, marked: () => marked };
  };
  const bedAsk = (day = 1) => ({ key: `d${day}:bed:ask`, lines: [{ k: "inner" as const, t: t("room.bed.confirm") }], ending: { kind: "bedAsk" as const } });

  it("the first time: the take line, then the player's own line, then the reader; the profile flag set once; the mutter on the first close; the bed ask again", () => {
    const r = rig();
    r.session.dialogue = push(r.session.dialogue, bedAsk());
    r.act("loop-choice", { choice: "read" });
    expect(r.lines()).toEqual([t("room.book.take"), t("room.book.first")]);
    expect(r.session.dialogue.queue[0]!.lines[1]).toMatchObject({ k: "speaker", who: "me" });
    expect(r.session.bookOpen).toBe(false);
    r.readOn();
    expect(r.session.bookOpen).toBe(true);
    expect(r.marked()).toBe(1);
    expect(r.session.collection.bookRead).toBe(true);
    r.act("book-close");
    expect(r.session.bookOpen).toBe(false);
    expect(r.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["none", "bedAsk"]);
    expect(r.session.dialogue.queue[0]!.lines.map((l) => l.t)).toEqual([t("room.book.after")]);
    // the second time: no first line, no mutter; the profile is not told again
    r.act("loop-advance");
    r.act("loop-choice", { choice: "read" });
    expect(r.lines()).toEqual([t("room.book.take")]);
    r.readOn();
    expect(r.session.bookOpen).toBe(true);
    r.act("book-close");
    expect(r.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["bedAsk"]);
    expect(r.marked()).toBe(1);
  });

  it("a profile that has read before: no first-time lines; from the rise ask the rise ask comes back; the shelf book asks nothing after", () => {
    const r = rig(true);
    r.session.dialogue = push(r.session.dialogue, { key: "d1:rise:ask", lines: [{ k: "inner", t: t("room.rise.ask") }], ending: { kind: "riseAsk" } });
    r.act("loop-choice", { choice: "read" });
    expect(r.lines()).toEqual([t("room.book.take")]);
    r.readOn();
    r.act("book-close");
    expect(r.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["riseAsk"]);
    expect(r.marked()).toBe(0);
    const s = rig(true);
    s.session.view = "room";
    s.act("book-open");
    s.readOn();
    expect(s.session.bookOpen).toBe(true);
    s.act("book-close");
    expect(s.session.dialogue.queue).toHaveLength(0);
  });

  it("the profile keeps it across runs (readCollection)", () => {
    const storage = memoryStorage();
    const w = createProfileWriter(storage);
    expect(readCollection(storage).bookRead).toBeUndefined();
    w.recordBookRead();
    w.recordBookRead();
    expect(readCollection(storage).bookRead).toBe(true);
  });
});
