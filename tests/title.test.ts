import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import titleFile from "@content/title.json";
import { applyEvent, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import { readProfile } from "@state/profile-read";
import { createProfileWriter } from "@state/saves";
import { memoryStorage } from "@state/slot";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { EMPTY_COLLECTION, type Collection } from "@world/room/collection";
import { renderRoom } from "@world/room/hud";
import { loopActions, loopKeys } from "@world/room/game";
import { readCollection } from "../src/ui/collection";
import { arrived, cardOpen, canStart, diceOptions, initialTitle, NO_ANSWERS, QUESTIONS, rowsShown, toMenu, toNames, toQuestions, withAnswer, withPronoun, type Answers, type TitleModel } from "../src/ui/title/model";
import { idleDelay, pickIdle } from "../src/ui/title/mount";
import { parseTitle, titleTable } from "../src/ui/title/table";
import { renderTitle } from "../src/ui/title/view";

afterEach(() => setLocale("zh"));

const collected = (finishedRuns: number, endings: Partial<Collection["endings"]> = {}): Collection => {
  const e = { bad: 0, survive: 0, good: 0, collapse: 0, ...endings };
  return { finishedRuns, endings: e, objects: [], kurogotchi: e.good >= 1, photos: [] };
};
const page = (m: TitleModel) => renderTitle(m).value;
const restart = /restart|loop-restart|新游戏.*继续|data-action="[^"]*reset/;

describe("content/title.json", () => {
  it("is read strictly", () => {
    const raw = () => structuredClone(titleFile) as any;
    expect(() => parseTitle({ ...raw(), extra: 1 })).toThrow(/unknown key "extra"/);
    const badLayer = raw();
    badLayer.idle.events[0].layer = "ceiling";
    expect(() => parseTitle(badLayer)).toThrow(/must be one of/);
    const twice = raw();
    twice.idle.events[1].id = twice.idle.events[0].id;
    expect(() => parseTitle(twice)).toThrow(/appears twice/);
    const range = raw();
    range.idle.everyMs = [40000, 20000];
    expect(() => parseTitle(range)).toThrow(/min <= max/);
    expect(parseTitle({ ...raw(), dice: { zh: { nick: ["a", "b"] } } }).dice.zh.nick).toEqual(["a", "b"]);
    expect(() => parseTitle({ ...raw(), dice: { zh: { nick: [""] } } })).toThrow(/non-empty/);
    expect(() => parseTitle({ ...raw(), dice: ["a"] })).toThrow(/must be an object/);
    expect(() => parseTitle({ ...raw(), dice: { zh: { name: ["a"] } } })).toThrow(/unknown key/);
  });
  it("the 🎲 lists are per question: a name never rolls a form of address, family never rolls 老板", () => {
    const d = parseTitle(structuredClone(titleFile) as any).dice;
    for (const lang of ["zh", "en"] as const) for (const q of ["login", "nick", "bossCalls", "calledBy"] as const) expect(d[lang][q]?.length, `${lang}.${q}`).toBeGreaterThan(0);
    expect(d.zh.login).not.toContain("哥");
    expect(d.zh.nick).not.toContain("老板");
    for (const q of ["login", "nick", "bossCalls", "calledBy"] as const) for (const v of d.en[q]!) expect(v, `en.${q}`).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("the title page (FR1–FR3)", () => {
  it("snapshot: without a save — 新游戏 · 设置 · 制作", () => {
    const out = page(initialTitle(null, EMPTY_COLLECTION));
    const menu = [...out.matchAll(/<nav class="title-menu"[^>]*>(.*?)<\/nav>/g)][0]![1]!;
    expect([...menu.matchAll(/data-action="(title-[a-z]+)"/g)].map((m) => m[1])).toEqual(["title-new", "title-settings", "title-credits"]);
    expect(out).toContain("NOT TODAY");
    // The stage's screen class never borrows a child's rule (the nav is `.title-menu`).
    expect(out).toMatch(/^<div class="stage title-page screen-menu" data-screen="menu">/);
    for (const screen of ["questions", "credits"] as const) {
      expect(page({ ...initialTitle(null, EMPTY_COLLECTION), screen })).toMatch(new RegExp(`^<div class="stage title-page screen-${screen}[ "]`));
    }
    expect(out).toMatchSnapshot();
  });

  it("snapshot: with a save (day 7) — 继续 · 第 7 天, and no 新游戏", () => {
    const out = page(initialTitle({ day: 7 }, EMPTY_COLLECTION));
    expect(out).toContain('data-action="title-continue">继续 · 第 7 天</button>');
    expect(out).not.toContain('data-action="title-new"');
    expect(toQuestions(initialTitle({ day: 7 }, EMPTY_COLLECTION)).screen).toBe("menu");
    expect(out).toMatchSnapshot();
  });

  it("snapshot: the questions mid-way, then complete", () => {
    let m = arrived(toQuestions(initialTitle(null, EMPTY_COLLECTION)));
    m = withAnswer(withAnswer(m, "login", "林一"), "nick", "一一");
    const mid = page(m);
    expect((mid.match(/class="row[^"]*" data-q=/g) ?? []).length).toBe(3);
    expect(mid).toContain('data-action="title-start" disabled');
    expect(mid).toMatchSnapshot();
    m = withPronoun(withAnswer(withAnswer(m, "bossCalls", "小林"), "calledBy", "老大"), "none");
    const done = page(m);
    expect((done.match(/class="row[^"]*" data-q=/g) ?? []).length).toBe(5);
    expect(done).toContain('class="title-start ready" data-action="title-start">');
    expect(done).toMatchSnapshot();
  });

  it("settings opens the same panel as in game, without 返回首页; 制作 is a page with a back button", () => {
    const m = { ...initialTitle(null, EMPTY_COLLECTION), settingsOpen: true };
    const out = page(m);
    expect(out).toContain('class="settings" role="dialog"');
    expect(out).not.toContain('data-action="settings-home"');
    const credits = page({ ...initialTitle(null, EMPTY_COLLECTION), screen: "credits" });
    expect(credits).toContain('data-action="title-back"');
    expect(toMenu({ ...initialTitle(null, EMPTY_COLLECTION), screen: "credits" }).screen).toBe("menu");
  });

  it("the questions appear one at a time, each once the one above is answered; Esc goes back keeping them", () => {
    let a: Answers = NO_ANSWERS;
    expect(rowsShown(a)).toBe(1);
    a = { ...a, login: "  " };
    expect(rowsShown(a)).toBe(1); // blank is not an answer
    a = { ...a, login: "x" };
    expect(rowsShown(a)).toBe(2);
    const back = toMenu(withAnswer(toQuestions(initialTitle(null, EMPTY_COLLECTION)), "login", "x"));
    expect(back.screen).toBe("menu");
    expect(back.monitorsAwake).toBe(false);
    expect(back.answers.login).toBe("x");
  });

  it("property: 开始 is disabled until every question is answered", () => {
    const text = fc.oneof(fc.constant(""), fc.constant("  "), fc.string({ minLength: 1, maxLength: 6 }));
    fc.assert(
      fc.property(text, text, text, text, fc.constantFrom(null, "she", "he", "none"), (login, nick, bossCalls, calledBy, pronoun) => {
        const a: Answers = { login, nick, bossCalls, calledBy, pronoun: pronoun as Answers["pronoun"] };
        const all = [login, nick, bossCalls, calledBy].every((s) => s.trim() !== "") && pronoun !== null;
        expect(canStart(a)).toBe(all);
        const m = { ...arrived(toQuestions(initialTitle(null, EMPTY_COLLECTION))), answers: a };
        expect(page(m).includes('data-action="title-start" disabled')).toBe(!all);
      }),
    );
  });

  it("property: no element with a restart action exists in any title page", () => {
    fc.assert(
      fc.property(fc.option(fc.integer({ min: 1, max: 18 }), { nil: null }), fc.constantFrom("menu", "questions", "credits"), fc.boolean(), (day, screen, settingsOpen) => {
        const m: TitleModel = { ...initialTitle(day === null ? null : { day }, collected(2, { bad: 1, good: 1 })), screen: screen as TitleModel["screen"], settingsOpen };
        expect(page(m)).not.toMatch(restart);
      }),
    );
  });

  it("the 🎲 never invents a personal name: the neutral list, plus the name already given", () => {
    expect(diceOptions("login", { ...NO_ANSWERS }, [])).toEqual([]);
    expect(diceOptions("login", { ...NO_ANSWERS, login: "林一" }, ["老大"])).toEqual(["老大"]);
    expect(diceOptions("nick", { ...NO_ANSWERS, login: "林一" }, ["老大", "哥"])).toEqual(["老大", "哥", "林一"]);
    expect(diceOptions("bossCalls", { ...NO_ANSWERS, login: "老大" }, ["老大"])).toEqual(["老大"]);
  });

  it("the answers become names; 不说 is no pronoun; the names event sets them", () => {
    const names = toNames({ login: " 林一 ", nick: "一一", bossCalls: "小林", calledBy: "老大", pronoun: "none" });
    expect(names).toEqual({ login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: null });
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "names", names });
    expect(store.getState().names).toEqual(names);
    expect(() => applyEvent(f(1), { kind: "names", day: 1, names: { ...names, pronoun: "they" } } as unknown as GameEvent)).toThrow(/pronoun/);
    expect(() => applyEvent(f(1), { kind: "names", day: 1, names: { ...names, extra: "x" } } as unknown as GameEvent)).toThrow(/unknown field/);
  });

  it("新游戏 pushes to the desk first; the card opens on arrival; Esc pulls back (correction 2026-11-01)", () => {
    const base = initialTitle(null, EMPTY_COLLECTION);
    expect(page(base)).toContain('<img class="title-logo" src="/logo.svg" alt="NOT TODAY">');
    const pushing = toQuestions(base);
    expect(pushing).toMatchObject({ framing: "desk", moving: true, monitorsAwake: true });
    expect(cardOpen(pushing)).toBe(false);
    const during = page(pushing);
    expect(during).toContain('class="title-room cam-in"');
    expect(during).toContain('class="title-menu leaving"');
    expect(during).not.toContain("title-card");
    const at = arrived(pushing);
    const card = page(at);
    expect(card).toContain('class="title-room cam-desk"');
    expect(card).not.toContain("title-menu");
    expect(card).toContain('<section class="title-card title-q" role="dialog"');
    expect(card).toContain('<h2 id="title-card-h">这是谁的故事？</h2>');
    expect(card).toContain('aria-labelledby="title-card-h" data-focus="title-login"');
    expect((card.match(/data-action="title-start"/g) ?? []).length).toBe(1);
    const section = card.match(/<section class="title-card[\s\S]*<\/section>/)![0];
    expect(section.match(/<button/g)!.length).toBe(2); // the 🎲 and 开始
    const back = toMenu(at);
    expect(back).toMatchObject({ screen: "menu", framing: "room", moving: true, monitorsAwake: false });
    expect(page(back)).toContain('class="title-room cam-out"');
    expect(page(back)).toContain('class="title-menu arriving"');
    expect(toMenu({ ...base, screen: "credits" }).moving).toBe(false);
    expect(page({ ...at, starting: true })).not.toContain("title-card");
  });

  it("the questions are the five in order", () => {
    expect(QUESTIONS).toEqual(["login", "nick", "bossCalls", "calledBy", "pronoun"]);
  });
});

describe("the waiting room (FR7)", () => {
  it("never in the first 15 s; then every 20–40 s; one event from the fixed list", () => {
    const { firstQuietMs, everyMs } = titleTable.idle;
    fc.assert(
      fc.property(fc.double({ min: 0, max: 0.999999, noNaN: true }), (r) => {
        const first = idleDelay(() => r, true);
        expect(first).toBeGreaterThanOrEqual(firstQuietMs + everyMs[0]);
        const next = idleDelay(() => r, false);
        expect(next >= everyMs[0] && next <= everyMs[1]).toBe(true);
        expect(titleTable.idle.events).toContain(pickIdle(() => r));
      }),
    );
  });

  it("an idle event lights only its own layer; 新游戏 wakes both monitors; the push turns the lamp off", () => {
    const base = initialTitle(null, EMPTY_COLLECTION);
    const lit = page({ ...base, idle: { id: "gap_light", layer: "gap" } });
    expect(lit).toContain('class="idle gap on"');
    expect(lit).not.toContain('class="idle monitor right on"');
    const awake = page(toQuestions(base));
    expect(awake).toContain('class="idle monitor left on"');
    expect(awake).toContain('class="idle monitor right on"');
    expect(page({ ...toQuestions(base), starting: true })).toContain('class="idle lamp off"');
  });
});

describe("the collection (FR4, FR8)", () => {
  const ctxOf = (collection: Collection, view: "room" | "desk" = "room") => {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", view);
    session.collection = collection;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    return ctx;
  };
  const room = (ctx: ActionContext) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;

  it("snapshot: the room without and with the book", () => {
    const without = room(ctxOf(EMPTY_COLLECTION));
    expect(without).not.toContain("desk-book");
    expect(without).toMatchSnapshot();
    const withBook = room(ctxOf(collected(1, { survive: 1 })));
    expect(withBook).toContain('class="desk-book" data-action="book-open"');
    expect(withBook).toMatchSnapshot();
  });

  it("property: the book node exists iff finishedRuns ≥ 1 (and never on the title)", () => {
    fc.assert(
      fc.property(fc.nat(5), (n) => {
        expect(room(ctxOf(collected(n))).includes("desk-book")).toBe(n >= 1);
        expect(page(initialTitle(null, collected(n)))).not.toContain("desk-book");
      }),
    );
  });

  it("a figure per ending reached, in the title room and in 房间 (not at 桌子); its name is a chip", () => {
    const c = collected(2, { bad: 1, good: 3 });
    for (const out of [page(initialTitle(null, c)), room(ctxOf(c))]) {
      expect([...out.matchAll(/class="figure" tabindex="0" data-ending="(\w+)"/g)].map((m) => m[1])).toEqual(["bad", "good"]);
      expect(out).toContain('<span class="fig-chip" aria-hidden="true">第一日，改</span>');
      expect(out).not.toMatch(/data-ending="good"[^>]*>[^<]*\d/); // no counts
    }
    expect(room(ctxOf(c, "desk"))).not.toContain('class="figure"');
    expect(room(ctxOf(EMPTY_COLLECTION))).not.toContain("figures");
  });

  it("the book opens the reader full-screen with a close chip; Esc or the chip closes it", () => {
    const ctx = ctxOf(collected(1));
    loopActions["book-open"]!(ctx, {} as DOMStringMap, null as never);
    expect(room(ctx)).toContain(`<iframe src="${titleTable.book.reader}"`);
    expect(room(ctx)).toContain('data-action="book-close"');
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.bookOpen).toBe(false);
    const none = ctxOf(EMPTY_COLLECTION);
    loopActions["book-open"]!(none, {} as DOMStringMap, null as never);
    expect(none.session.bookOpen).toBe(false);
  });

  it("the profile keeps ending counts and finished runs; the collection reads them", () => {
    const storage = memoryStorage();
    expect(readCollection(storage)).toEqual(EMPTY_COLLECTION);
    const writer = createProfileWriter(storage);
    writer.increment("runs");
    writer.recordEnding("bad");
    writer.recordEnding("bad");
    writer.recordEnding("good");
    expect(readProfile(storage)).toEqual({ runs: 1, endings: { bad: 2, survive: 0, good: 1, collapse: 0 }, finishedRuns: 3 });
    expect(readCollection(storage)).toEqual(collected(3, { bad: 2, good: 1 }));
  });
});
