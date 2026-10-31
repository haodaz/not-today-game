// @vitest-environment happy-dom
// dialogue spec FR3: the box (paging, choices in the box, tags, history), talking to Kuro as an
// NPC conversation (the prompt, the player's box, five turns and the bedtime line), the `chat`
// event, and the width-table properties. Mock: design/chrome/dialogue.html.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { dayFiles, type SayLine } from "@state/days/table";
import { applyEvent, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { kuroDay, offlineAnswer } from "@world/desktop/kuro/days";
import { initialSession, type Session } from "@world/desktop/model";
import { dialogueBox, lineScreens } from "@world/dialogue/box";
import { charWidth, fontPx, LINE_BOX, marker, PLAYER_BOX, screens, textArea, wrap } from "@world/dialogue/layout";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { EMPTY_DIALOGUE, push, type Queued } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions, loopKeys } from "@world/room/game";
import { renderRoom } from "@world/room/hud";

afterEach(() => setLocale("zh"));

const none = {} as DOMStringMap;
const NIGHT: BeatClock = { beat: "night", time: "23:41" };
const WORK: BeatClock = { beat: "work", time: "10:00" };

function ctxOf(store: Store, clock: BeatClock = NIGHT, view: Session["view"] = "room"): ActionContext {
  return { store, session: initialSession(clock, "left", view), rerender: () => {}, later: () => {} };
}
/** A run with a player's name, at `day`. */
function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: null } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
const out = (ctx: ActionContext) => dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)?.value ?? "";
const room = (ctx: ActionContext) => renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session }).value;
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const queueOf = (key: string, lines: readonly SayLine[], ending: Queued["ending"] = { kind: "none" }): Queued => ({ key, lines, ending });

/** Real content lines (test data only): the first narration of day 1, and day 1's night joined into one long line. */
const day1 = dayFiles.get(1)!;
const narration = day1.beats.boot!.say.find((l) => l.k === "narration")!;
const longLine: SayLine = { k: "narration", t: Object.values(day1.beats).flatMap((b) => b?.say ?? []).map((l) => l.t).join("") };

/** Talk at night up to the player's box (聊聊). */
function talkAtNight(ctx: ActionContext): void {
  act(ctx, "kuro-call");
  act(ctx, "loop-choice", { index: "0", choice: "yes" });
}

describe("FR1 the box: snapshots", () => {
  it("a narration line: one screen, ▶, the ↺ chip, no tag", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    const box = out(ctx);
    expect(box).toContain('class="dlg" data-screen="1/1"');
    expect(box).toContain('data-action="dlg-history"');
    expect(box).toContain('<span class="more" aria-hidden="true">▶</span>');
    expect(box).not.toContain('class="who tag');
    expect(box).toMatchSnapshot();
  });

  it("a paged line: ▼ on the first page, ▶ on the last; a click shows the next page, never scrolls", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("long", [longLine, narration]));
    const at = lineScreens(ctx.store.getState(), ctx.session)!;
    expect(at.all.length).toBeGreaterThanOrEqual(2);
    const first = out(ctx);
    expect(first).toContain(`data-screen="1/${at.all.length}"`);
    expect(first).toContain(">▼</span>");
    expect(first).toMatchSnapshot();
    for (let i = 1; i < at.all.length; i++) act(ctx, "loop-advance");
    expect(ctx.session.dialogue).toMatchObject({ line: 0, page: at.all.length - 1 });
    const last = out(ctx);
    expect(last).toContain(">▶</span>");
    expect(last).toMatchSnapshot();
    // The pages are the line, in order, nothing lost or repeated.
    expect(at.all.map((s) => s.text).join("")).toBe(longLine.t);
    act(ctx, "loop-advance");
    expect(ctx.session.dialogue).toMatchObject({ line: 1, page: 0 });
    // Leaving the line put it in today's history.
    expect(ctx.session.dlgLog.map((e) => e.text)).toEqual([longLine.t]);
  });

  it("choices render in the box (◆ by CSS), one page of at most four; a speaker's line carries its tag", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    const seq = { say: [{ k: "speaker", who: "缝里", t: narration.t }] as SayLine[], choices: ["一", "二", "三", "四", "五"].map((text) => ({ text })) };
    ctx.session.dialogue = push(EMPTY_DIALOGUE, { key: "c", lines: seq.say, ending: { kind: "beatChoices", day: 1, beat: "shutdown" }, sequence: seq });
    const at = lineScreens(ctx.store.getState(), ctx.session)!;
    const choiceScreens = at.all.filter((s) => s.choices.length);
    expect(choiceScreens.map((s) => s.choices.length)).toEqual([4, 1]);
    // Read on to the first page of choices.
    while (!at.all[ctx.session.dialogue.page ?? 0]!.choices.length) act(ctx, "loop-advance");
    const box = out(ctx);
    expect(box).toContain('<div class="choices"><button type="button" data-action="loop-choice" data-index="0">一</button>');
    expect(box).toContain('<button type="button" class="more" data-action="loop-advance">▼</button>');
    expect(box).toMatchSnapshot();
    // ▼ cycles through the pages of choices; a click never picks one.
    const page = ctx.session.dialogue.page;
    act(ctx, "loop-advance");
    expect(out(ctx)).toContain('data-index="4">五</button>');
    act(ctx, "loop-advance");
    expect(ctx.session.dialogue.page).toBe(page);
    expect(ctx.store.getEvents().some((e) => e.kind === "choose")).toBe(false);
    // The tag is the speaker's (content).
    ctx.session.dialogue = { ...ctx.session.dialogue, page: 0 };
    expect(out(ctx)).toContain('<span class="who tag">缝里</span>');
  });

  it("inner lines are italic with no tag; sfx lines are centred with no tag", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    const inner = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? [])).find((l) => l.k === "inner")!;
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("i", [inner]));
    expect(out(ctx)).toMatch(/^<div class="dlg inner"/);
    expect(out(ctx)).not.toContain("who tag");
    const sfx = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? [])).find((l) => l.k === "sfx")!;
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("s", [sfx]));
    expect(out(ctx)).toMatch(/^<div class="dlg sfx"/);
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toMatch(/\.dlg\.inner \.txt\{font-style:italic\}/);
    expect(css).toMatch(/\.dlg\.sfx \.txt\{text-align:center/);
  });

  it("history: ↺ opens today's lines and choices, tagged; a click outside, 关闭 or Esc closes; a new day clears it", () => {
    const store = storeAt(1);
    const ctx = ctxOf(store, NIGHT);
    talkAtNight(ctx);
    act(ctx, "dlg-history");
    const box = out(ctx);
    expect(box).toContain('<section class="dlg-hist" role="dialog" aria-modal="true"');
    expect(box).toContain(`<b>${t("kuro.name")}</b><span>${escapeHtml(t("kuro.ask"))}</span>`);
    expect(box).toContain(`<li class="h-it k-player"><b>林一</b><span>${t("kuro.yes")}</span></li>`);
    expect(box).toContain('data-action="dlg-history-close"');
    expect(box).toMatchSnapshot();
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.historyOpen).toBe(false);
    // Esc closed only the history: the conversation is still there.
    expect(ctx.session.dialogue.queue.length).toBe(1);
    // A new day: the history is gone.
    syncLoop(ctx);
    store.appendEvent({ kind: "lieDown" });
    syncLoop(ctx);
    expect(ctx.session.dlgLog).toEqual([]);
  });
});

describe("FR2 talking to Kuro", () => {
  it("the body opens the prompt (snapshot): tag with its face, 要和克总聊聊吗？, 聊聊 / 先不聊; 先不聊 closes", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    act(ctx, "kuro-call");
    const box = out(ctx);
    expect(box).toContain('<span class="who tag k"><img src="/kuro/k3d_base.png" alt="">');
    expect(box).toContain(`>${escapeHtml(t("kuro.ask"))}</button>`);
    expect(box).toContain(`data-choice="yes">${t("kuro.yes")}</button>`);
    expect(box).toContain(`data-choice="no">${t("kuro.notNow")}</button>`);
    expect(room(ctx)).toContain('<div class="hud-kuro away"></div>');
    expect(box).toMatchSnapshot();
    act(ctx, "loop-choice", { index: "1", choice: "no" });
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(room(ctx)).toContain('class="kuro-btn"');
  });

  it("聊聊 at night: Kuro's line with its face, then the player's box with the starters, 说点别的…, 先不聊 (snapshots)", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    talkAtNight(ctx);
    const box = out(ctx);
    const day = kuroDay(1)!;
    expect(box).toContain('class="dlg kuro raised"');
    expect(box).toContain(`>${escapeHtml(day.idiom)}</button>`);
    expect(box).toContain('<div class="dlg-player" data-mode="choices"');
    expect(box).toContain('<span class="who tag p">林一</span>');
    const labels = [...day.starters.map((s) => s.zh), t("dialogue.more"), t("kuro.notNow")];
    // Every option is on one of the player's pages (at most four a page).
    const all: string[] = [];
    for (let i = 0; i < 3; i++) {
      all.push(out(ctx));
      act(ctx, "kuro-page");
    }
    for (const l of labels) expect(all.join(""), l).toContain(`>${escapeHtml(l)}</button>`);
    expect(box).toMatchSnapshot();
  });

  it("a starter is a turn: a chat event, the offline answer, the question gone from the list; typing sends with Enter", () => {
    const store = storeAt(1);
    const ctx = ctxOf(store, NIGHT);
    talkAtNight(ctx);
    const day = kuroDay(1)!;
    act(ctx, "kuro-q", { q: "1" });
    expect(store.getEvents().at(-2)).toMatchObject({ kind: "chat", q: 1 });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "step", name: "chat:any" });
    expect(store.getState().chatTurnsToday).toBe(1);
    expect(out(ctx)).toContain(escapeHtml(offlineAnswer(day, 1)));
    expect(out(ctx)).not.toContain(`data-q="1"`);
    act(ctx, "kuro-more");
    const input = out(ctx);
    expect(input).toContain('<div class="dlg-player input" data-mode="input"><span class="who tag p">林一</span><input class="kuro-in" type="text" data-input="kuro-text"');
    expect(input).toMatchSnapshot();
    // Empty sends nothing.
    act(ctx, "kuro-send");
    expect(store.getState().chatTurnsToday).toBe(1);
    ctx.session.kuroDraft = "  雨停了吗  ";
    act(ctx, "kuro-send");
    expect(store.getEvents().filter((e) => e.kind === "chat").at(-1)).toMatchObject({ kind: "chat", text: "雨停了吗" });
    expect(out(ctx)).toContain(escapeHtml(offlineAnswer(day, null)));
    expect(ctx.session.kuroInput).toBe(false);
  });

  it("work beats: the same flow, its constant line, only 好。, no turn", () => {
    const store = storeAt(3);
    const ctx = ctxOf(store, WORK);
    talkAtNight(ctx);
    const box = out(ctx);
    expect(box).toContain(escapeHtml(kuroDay(3)!.idiom));
    expect([...box.matchAll(/class="dlg-player"[\s\S]*?<\/div><\/div>/g)][0]![0].match(/<button/g)!.length).toBe(1);
    expect(box).toContain(`data-action="kuro-leave">${t("dialogue.ok")}</button>`);
    act(ctx, "kuro-leave");
    expect(store.getState().chatTurnsToday).toBe(0);
    expect(ctx.session.dialogue.queue).toEqual([]);
  });

  it("Esc leaves at any player turn; the body comes back", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    talkAtNight(ctx);
    act(ctx, "kuro-more");
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(ctx.session.kuroInput).toBe(false);
    expect(room(ctx)).toContain('class="kuro-btn"');
  });

  it("property: five turns a day; the sixth attempt is the bedtime line and the player's box never renders again that day", () => {
    const step = fc.oneof(fc.constant("q" as const), fc.constant("text" as const), fc.constant("reopen" as const));
    fc.assert(
      fc.property(fc.array(step, { minLength: 6, maxLength: 14 }), (steps) => {
        const store = storeAt(2);
        const ctx = ctxOf(store, NIGHT);
        talkAtNight(ctx);
        let attempts = 0;
        let bed = false;
        for (const s of steps) {
          if (s === "reopen") {
            act(ctx, "kuro-leave");
            talkAtNight(ctx);
          } else if (out(ctx).includes("dlg-player")) {
            attempts += 1;
            const q = /data-action="kuro-q" data-q="(\d+)"/.exec(out(ctx))?.[1];
            if (s === "q" && q) act(ctx, "kuro-q", { q });
            else {
              act(ctx, "kuro-more");
              ctx.session.kuroDraft = "x";
              act(ctx, "kuro-send");
            }
          }
          if (attempts > constants.chatTurnsPerDay) bed = true;
          expect(store.getState().chatTurnsToday).toBe(Math.min(attempts, constants.chatTurnsPerDay));
          if (bed) {
            expect(out(ctx)).not.toContain("dlg-player");
            expect(ctx.session.kuroBedDay).toBe(2);
          }
        }
        if (bed) expect(out(ctx).includes(escapeHtml(t("kuro.bedtime"))) || ctx.session.dialogue.queue.length === 0).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it("the evening auto-open and the body both queue after what the box is saying", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    act(ctx, "kuro-call");
    expect(ctx.session.dialogue.queue.map((q) => q.key)).toEqual(["n", expect.stringMatching(/^kuro:1:/)]);
    expect(out(ctx)).not.toContain("dlg kuro");
  });
});

describe("the chat event", () => {
  it("one of q or text; counts a turn; a sixth is rejected; lying down starts again; replay gives the same", () => {
    const store = createStore({ startDay: 1 });
    expect(() => store.appendEvent({ kind: "chat" })).toThrow(/exactly one/);
    expect(() => store.appendEvent({ kind: "chat", q: 1, text: "x" })).toThrow(/exactly one/);
    expect(() => store.appendEvent({ kind: "chat", q: 0 })).toThrow(/question number/);
    expect(() => store.appendEvent({ kind: "chat", text: "  " })).toThrow(/characters/);
    for (let i = 0; i < constants.chatTurnsPerDay; i++) store.appendEvent(i % 2 ? { kind: "chat", text: "x" } : { kind: "chat", q: 1 });
    expect(store.getState().chatTurnsToday).toBe(constants.chatTurnsPerDay);
    expect(() => store.appendEvent({ kind: "chat", q: 2 })).toThrow(/no turns left/);
    store.appendEvent({ kind: "lieDown" });
    expect(store.getState().chatTurnsToday).toBe(0);
    store.appendEvent({ kind: "chat", q: 3 });
    const again = createStore({ startDay: 1, events: store.getEvents() });
    expect(again.getState()).toEqual(store.getState());
    expect(again.getState().chatTurnsToday).toBe(store.getEvents().filter((e) => e.kind === "chat" && e.day === store.getState().day).length);
    // The reducer alone: the same rule.
    expect(applyEvent({ ...f(1), chatTurnsToday: 2 }, { kind: "lieDown", day: 1 } as GameEvent).chatTurnsToday).toBe(0);
  });
});

describe("FR3 properties", () => {
  const text = fc.array(fc.oneof(fc.constantFrom("雨", "你", "。", "，", "…", "—", "“", "”"), fc.constantFrom("rain ", "the ", "receivable ", "a", "b", "  ", "x"), fc.string({ maxLength: 12 })), { maxLength: 120 }).map((a) => a.join(""));

  it("wrap: the lines give the text back; no line is wider than the area (unless one character is)", () => {
    fc.assert(
      fc.property(text, fc.constantFrom(17, 18), fc.integer({ min: 40, max: 932 }), (s, px, w) => {
        const lines = wrap(s, w, px);
        expect(lines.join("")).toBe(s);
        for (const l of lines) {
          const visible = [...l.trimEnd()];
          const width = visible.reduce((n, ch) => n + charWidth(ch, px), 0);
          expect(width <= w || visible.length <= 1).toBe(true);
        }
      }),
    );
  });

  it("every screen has ≤ 3 text rows, ≤ 4 choices in ≤ 4 rows; the marker is ▼ until the last text page", () => {
    fc.assert(
      fc.property(fc.option(text, { nil: null }), fc.option(fc.array(text, { maxLength: 9 }), { nil: null }), fc.constantFrom(LINE_BOX, PLAYER_BOX), (line, choices, geom) => {
        const all = screens(line, choices, geom, 18);
        expect(all.length).toBeGreaterThanOrEqual(1);
        all.forEach((s, i) => {
          expect(s.rows).toBeLessThanOrEqual(geom.rows);
          expect(s.choices.length).toBeLessThanOrEqual(geom.maxChoices);
          expect(s.choiceRows).toBeLessThanOrEqual(geom.choiceRows);
          if (s.text && s.choices.length) expect(s.rows + s.choiceRows).toBeLessThanOrEqual(geom.rows);
          if (!s.choices.length) expect(marker(all, i)).toBe(i < all.length - 1 ? "more" : "next");
        });
        expect(all.flatMap((s) => s.choices)).toEqual((choices ?? []).map((_, i) => i));
        expect(all.map((s) => s.text).join("")).toBe(line ?? "");
      }),
    );
  });

  it("happy-dom: on every screen of every content line the box has the same fixed size, and its text re-wraps to ≤ 3 lines", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toMatch(/\.dlg,\.dlg-player\{[^}]*width:992px;height:132px;/);
    const ctx = ctxOf(storeAt(1), WORK);
    const px = fontPx("zh");
    const lines = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? [])).concat([longLine]);
    const host = document.createElement("div");
    for (const [i, line] of lines.entries()) {
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf(`p${i}`, [line]));
      const n = lineScreens(ctx.store.getState(), ctx.session)!.all.length;
      for (let page = 0; page < n; page++) {
        ctx.session.dialogue = { ...ctx.session.dialogue, page };
        host.innerHTML = out(ctx);
        const box = host.querySelector<HTMLElement>(".dlg")!;
        expect(box.getAttribute("style"), "no inline size").toBeNull();
        expect(box.className).toMatch(/^dlg\b/);
        const txt = box.querySelector(".txt")!.textContent!;
        expect(wrap(txt, textArea(LINE_BOX, px), px).length, `${line.t.slice(0, 20)} p${page}`).toBeLessThanOrEqual(LINE_BOX.rows);
      }
    }
  });
});
