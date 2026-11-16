// run-diary (author 2026-11-16): the book by the bed is this run's diary, drawn as an open spread over
// src/state/diary.ts's pages — packed by a fixed line budget, every day on a new left page, the blank
// page last; turned by the spread's halves and the keys, never scrolled; opened on the last written
// day; on the shelf and in the bed / rise asks only once a day has been written.
import "./specimen";
import { describe, expect, it } from "vitest";
import { diary, diaryDays, type DiaryPage } from "@state/diary";
import type { EventDraft } from "@state/events";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { push, showing } from "@world/loop/dialogue";
import { clampSpread, DIARY_CHARS_PER_LINE, DIARY_PAGE_LINES, diaryBookPages, diaryOpenSpread, diaryReader, diarySpreads, diaryText } from "@world/room/collection";
import { renderRoom } from "@world/room/hud";
import { loopActions, loopKeys } from "@world/room/game";
import { weatherOf } from "@state/stages";

setLocale("zh");

const shutdown: EventDraft = { kind: "step", name: "beat:shutdown", t: "23:00" };
/** A run whose first `days` days are written (each shut down and slept through), on the next morning; `today` adds today's shutdown. */
function runOf(days: number, today = false): Store {
  const store = createStore({ startDay: 1 });
  for (let d = 0; d < days; d++) {
    store.appendEvent(shutdown);
    store.appendEvent({ kind: "lieDown" });
  }
  if (today) store.appendEvent(shutdown);
  return store;
}
function rig(store: Store, view: Session["view"] = "room") {
  const session = initialSession(DEFAULT_CLOCK, "left", view);
  session.collection = { ...session.collection, bookRead: true };
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const key = (k: string) => loopKeys(ctx, { key: k } as KeyboardEvent);
  const open = () => {
    act("book-open");
    for (let i = 0; i < 4 && !session.bookOpen; i++) act("loop-advance");
  };
  const out = () => renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
  return { ctx, session, act, key, open, out };
}
/** A long day: many chat lines, each about three printed lines (packs onto more than one page). */
const longDay = (day: number): DiaryPage => ({
  day,
  lines: [
    { key: "diary.head", args: { day } },
    { key: "diary.weather", args: { weather: { key: `weather.${weatherOf(day)}` } } },
    ...Array.from({ length: 12 }, (_, i) => ({ key: "diary.chat", args: { said: `第${i}句`.repeat(8), answer: "好。" } })),
    { key: "diary.end" },
  ],
});

describe("the pages", () => {
  it("a line prints its { key } arguments first, strings and numbers as they are", () => {
    expect(diaryText({ key: "diary.head", args: { day: 3 } })).toBe(t("diary.head", { day: 3 }));
    expect(diaryText({ key: "diary.weather", args: { weather: { key: "weather.rain" } } })).toBe(t("diary.weather", { weather: t("weather.rain") }));
    expect(diaryText({ key: "diary.end" })).toBe(t("diary.end"));
  });

  it("a day: the head as a heading, the weather under it, the rest as paragraphs; the blank page last; no days, no pages", () => {
    const store = runOf(0, true);
    const pages = diaryBookPages(diary(store.getState(), store.getEvents()));
    expect(pages).toHaveLength(2);
    expect(pages[0]!.day).toBe(1);
    expect(pages[0]!.blocks[0]).toEqual({ kind: "head", text: t("diary.head", { day: 1 }) });
    expect(pages[0]!.blocks[1]!.kind).toBe("weather");
    expect(pages[0]!.blocks.slice(2).every((b) => b.kind === "p")).toBe(true);
    expect(pages[0]!.blocks.at(-1)!.text).toBe(t("diary.end"));
    expect(pages[1]).toEqual({ day: null, blocks: [{ kind: "blank", text: t("diary.blank") }] });
    expect(diaryBookPages([])).toEqual([]);
    expect(diaryReader([], 0)).toBeNull();
  });

  it("a day longer than one page packs onto two (≤ the budget each, ceil(chars / 28) a paragraph); every day starts on a left page", () => {
    const pages = diaryBookPages([longDay(1), longDay(2)]);
    const cost = (b: { kind: string; text: string }) => (b.kind === "head" ? 2 : Math.max(1, Math.ceil(Array.from(b.text).length / DIARY_CHARS_PER_LINE)));
    const of1 = pages.filter((p) => p.day === 1);
    expect(of1.length).toBeGreaterThanOrEqual(2);
    for (const p of pages) if (p.blocks.length > 1) expect(p.blocks.reduce((s, b) => s + cost(b), 0)).toBeLessThanOrEqual(DIARY_PAGE_LINES);
    const first2 = pages.findIndex((p) => p.day === 2);
    expect(first2 % 2).toBe(0); // a left page
    if (of1.length % 2 === 1) expect(pages[first2 - 1]).toEqual({ day: null, blocks: [] }); // the filler
    expect(pages.at(-1)!.blocks[0]!.kind).toBe("blank");
    // the order of a day's lines is kept across its pages
    const texts = of1.flatMap((p) => p.blocks.map((b) => b.text));
    expect(texts[0]).toBe(t("diary.head", { day: 1 }));
    expect(texts.at(-1)).toBe(t("diary.end"));
  });

  it("the reader's markup: the spread, the page numbers in the outer corners, the halves, the close chip; nothing scrolls", () => {
    const pages = diaryBookPages([longDay(1), longDay(2)]);
    const out = diaryReader(pages, 0)!.value;
    expect(out).toMatch(/^<div class="book-reader diary" role="dialog" aria-modal="true"/);
    expect(out).toContain('<div class="bk-dim"></div>');
    expect(out).toContain(`data-spread="0" data-spreads="${diarySpreads(pages)}"`);
    expect(out).toContain(`<h3 class="bk-head">${t("diary.head", { day: 1 })}</h3>`);
    expect(out).toContain('<p class="bk-weather">');
    expect(out).toContain('<span class="bk-no">1</span>');
    expect(out).toContain('<span class="bk-no">2</span>');
    expect(out).toContain('class="bk-turn prev" data-action="book-turn" data-by="-1" tabindex="-1" aria-hidden="true" disabled');
    expect(out).toMatch(/class="bk-turn next" data-action="book-turn" data-by="1" tabindex="-1" aria-hidden="true"><\/button>/);
    expect(out).toContain('data-action="book-close"');
    expect(out).not.toContain("<iframe");
    const last = diaryReader(pages, 99)!.value;
    expect(last).toContain(`data-spread="${diarySpreads(pages) - 1}"`);
    expect(last).toContain(`<p class="bk-blank">${t("diary.blank")}</p>`);
    expect(last).toMatch(/class="bk-turn next"[^>]* disabled/);
    expect(diaryReader(pages, 1)!.value).toMatchSnapshot();
  });

  it("the CSS: a ~1180 × 760 spread, the pages overflow: hidden, 17 px at line-height 1.9", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toMatch(/\.book-reader\.diary \.bk-spread\{[^}]*width:1180px;height:760px/);
    expect(css).toMatch(/\.book-reader\.diary \.bk-page\{[^}]*overflow:hidden[^}]*font-size:17px;line-height:1\.9/);
    expect(css).toMatch(/\.book-reader\.diary \.bk-body\{[^}]*overflow:hidden/);
  });
});

describe("opening and turning", () => {
  it("opens on the last written day's first spread; bookSpread is in the session", () => {
    const store = runOf(3);
    const pages = diaryBookPages(diary(store.getState(), store.getEvents()));
    const r = rig(store);
    r.session.bookSpread = 0;
    r.open();
    expect(r.session.bookOpen).toBe(true);
    expect(r.session.bookSpread).toBe(diaryOpenSpread(pages));
    expect(pages[2 * r.session.bookSpread]!.day).toBe(3);
    expect(r.out()).toContain(`data-spread="${r.session.bookSpread}"`);
    expect(r.out()).toContain(`<h3 class="bk-head">${t("diary.head", { day: 3 })}</h3>`);
  });

  it("forward and back by the halves and the keys; no wrap at either end; Esc closes", () => {
    const store = runOf(3);
    const pages = diaryBookPages(diary(store.getState(), store.getEvents()));
    const last = diarySpreads(pages) - 1;
    const r = rig(store);
    r.open();
    r.session.bookSpread = 0;
    r.act("book-turn", { by: "-1" });
    expect(r.session.bookSpread).toBe(0); // no wrap back
    r.act("book-turn", { by: "1" });
    expect(r.session.bookSpread).toBe(1);
    expect(r.key("ArrowLeft")).toBe(true);
    expect(r.session.bookSpread).toBe(0);
    for (const k of ["ArrowRight", " ", "PageDown"]) {
      const was = r.session.bookSpread;
      expect(r.key(k)).toBe(true);
      expect(r.session.bookSpread, k).toBe(Math.min(last, was + 1));
    }
    r.session.bookSpread = last;
    r.key("ArrowRight");
    r.act("book-turn", { by: "1" });
    expect(r.session.bookSpread).toBe(last); // no wrap forward
    r.key("PageUp");
    expect(r.session.bookSpread).toBe(Math.max(0, last - 1));
    // the keys stay in the book: the room does not turn, the view stays
    expect(r.session.view).toBe("room");
    expect(clampSpread(pages, -5)).toBe(0);
    expect(clampSpread(pages, 1e9)).toBe(last);
    expect(r.key("Escape")).toBe(true);
    expect(r.session.bookOpen).toBe(false);
    // closed: a turn does nothing
    r.act("book-turn", { by: "1" });
    expect(r.session.bookOpen).toBe(false);
  });

  it("lying in bed the arrows turn the pages, not the rise ask", () => {
    const store = runOf(0, true);
    const r = rig(store, "lying");
    r.session.dialogue = push(r.session.dialogue, { key: "d1:bed:ask", lines: [{ k: "inner", t: t("room.bed.confirm") }], ending: { kind: "bedAsk" } });
    r.act("loop-choice", { choice: "read" });
    for (let i = 0; i < 4 && !r.session.bookOpen; i++) r.act("loop-advance");
    expect(r.session.bookOpen).toBe(true);
    r.key("ArrowLeft");
    r.key("ArrowRight");
    expect(r.session.dialogue.queue.some((q) => q.ending.kind === "riseAsk")).toBe(false);
  });
});

describe("when there is a book", () => {
  const ask = (ending: { kind: "bedAsk" } | { kind: "riseAsk" }) => ({ key: "d:ask", lines: [{ k: "inner" as const, t: "x" }], ending });
  const choicesOf = (store: Store, ending: { kind: "bedAsk" } | { kind: "riseAsk" }) =>
    showing(push({ queue: [], line: 0 } as never, ask(ending)), store.getState(), store.getEvents())!.choices!.map((c) => c.choice);

  it("day 1's morning (zero days): no shelf book, no 看书 in the bed or rise ask, and 看书 / book-open do nothing", () => {
    const store = runOf(0);
    expect(diaryDays(store.getState(), store.getEvents())).toBe(0);
    const r = rig(store);
    expect(r.out()).not.toContain('class="shelf-book"');
    expect(choicesOf(store, { kind: "bedAsk" })).not.toContain("read");
    expect(choicesOf(store, { kind: "riseAsk" })).not.toContain("read");
    expect(choicesOf(store, { kind: "bedAsk" })).toEqual(["sleep", "stay"]);
    r.act("book-open");
    expect(r.session.book).toBeNull();
    r.session.dialogue = push(r.session.dialogue, ask({ kind: "bedAsk" }));
    r.act("loop-choice", { choice: "read" });
    expect(r.session.book).toBeNull();
  });

  it("day 1's bed ask (after the shutdown, one day): the shelf book and 看书 in both asks", () => {
    const store = runOf(0, true);
    expect(diaryDays(store.getState(), store.getEvents())).toBe(1);
    expect(rig(store).out()).toContain('class="shelf-book" data-action="book-open"');
    expect(choicesOf(store, { kind: "bedAsk" })).toEqual(["sleep", "stay", "read"]);
    expect(choicesOf(store, { kind: "riseAsk" })).toEqual(["up", "stay", "read"]);
    const r = rig(store);
    r.open();
    expect(r.session.bookOpen).toBe(true);
  });
});
