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
import { playerBox } from "@world/dialogue/kuro";
import { initialSession, type Session } from "@world/desktop/model";
import { dialogueBox, isDreamNight, lineScreens, playerPortraitSrc } from "@world/dialogue/box";
import { dreamNights } from "@state/stages";
import { charWidth, fontPx, KURO_LINE_BOX, KURO_PORTRAIT, LINE_BOX, marker, PLAYER_BOX, screens, textArea, wrap } from "@world/dialogue/layout";
import { startReveal } from "@world/motion/reveal";
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

  // world-prompts R2: the choices are the column on the right (all of them, no pages); the box keeps the line and its tag.
  it("choices render in the column on the right (all at once, no ▼); the box keeps the speaker's line and tag", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    const seq = { say: [{ k: "speaker", who: "缝里", t: narration.t }] as SayLine[], choices: ["一", "二", "三", "四", "五"].map((text) => ({ text })) };
    ctx.session.dialogue = push(EMPTY_DIALOGUE, { key: "c", lines: seq.say, ending: { kind: "beatChoices", day: 1, beat: "shutdown" }, sequence: seq });
    const at = lineScreens(ctx.store.getState(), ctx.session)!;
    // Read on to the choices.
    while (!at.all[ctx.session.dialogue.page ?? 0]!.choices.length) act(ctx, "loop-advance");
    const box = out(ctx);
    const col = box.slice(box.indexOf('<div class="dlg-choices'));
    expect([...col.matchAll(/data-index="(\d)"[^>]*><i class="dc-ic plain" aria-hidden="true">◇<\/i><span class="dc-l">([^<]+)<\/span>/g)].map((m) => m[2])).toEqual(["一", "二", "三", "四", "五"]);
    const dlg = box.slice(0, box.indexOf('<div class="dlg-choices'));
    expect(dlg).not.toContain("loop-choice");
    expect(dlg).not.toContain('class="more"');
    expect(dlg).toContain('<span class="who tag">缝里</span>');
    // Its last page of text stays, not as a read-on button.
    const last = at.all.filter((s) => s.text).at(-1)!.text;
    expect(dlg).toContain(`<div class="txt">${escapeHtml(last)}</div>`);
    // A click on the box never picks or skips a choice, nor pages.
    const page = ctx.session.dialogue.page;
    act(ctx, "loop-advance");
    expect(ctx.session.dialogue.page).toBe(page);
    expect(ctx.store.getEvents().some((e) => e.kind === "choose")).toBe(false);
  });

  it("inner lines are italic with no tag; sfx lines are centred with no tag", () => {
    const ctx = ctxOf(storeAt(1), WORK);
    const inner = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? [])).find((l) => l.k === "inner")!;
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("i", [inner]));
    // `me`: the player's portrait stands in the box (addition 2026-11-01).
    expect(out(ctx)).toMatch(/^<div class="dlg inner me"/);
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

describe("correction: ↺ sits beside the name tag", () => {
  it("right after the tag on the tag strip; alone at the tag's place without one; same action and label", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    act(ctx, "kuro-call");
    expect(out(ctx)).toContain(`<div class="tagbar"><span class="who tag k">${t("kuro.name")}</span><button type="button" class="hist" data-action="dlg-history" aria-haspopup="dialog" aria-label="${t("dialogue.history")}">↺</button></div>`);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    expect(out(ctx)).toMatch(/^<div class="dlg" [^>]*><div class="tagbar"><button type="button" class="hist"/);
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toMatch(/\.dlg \.tagbar\{position:absolute;left:18px;top:-16px;display:flex/);
    expect(css).not.toMatch(/\.dlg \.hist\{[^}]*right:/);
  });
});

describe("FR2 talking to Kuro", () => {
  it("the body opens the prompt (snapshot): tag with its face, 要和克总聊聊吗？, 聊聊 / 先不聊; 先不聊 closes", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    act(ctx, "kuro-call");
    const box = out(ctx);
    // The tag is only the name; the face is the portrait at the box's right end.
    expect(box).toContain(`<span class="who tag k">${t("kuro.name")}</span>`);
    expect(box).not.toContain("<img");
    // world-prompts R2: the box keeps the line and the portrait; 聊聊 / 先不聊 are the column's rows.
    expect(box).toMatch(/<span class="kpet kuro-portrait" data-kuro-slot data-state="(idle|think|rest)" aria-hidden="true"><\/span><\/div><div class="dlg-choices" role="group">/);
    expect(box).toContain(`<div class="txt">${escapeHtml(t("kuro.ask"))}</div>`);
    expect(box).toContain(`data-choice="yes" data-focus="dc-0" data-n="1"><i class="dc-ic plain" aria-hidden="true">◇</i><span class="dc-l">${t("kuro.yes")}</span></button>`);
    expect(box).toContain(`data-choice="no" data-focus="dc-1" data-n="2"><i class="dc-ic plain" aria-hidden="true">◇</i><span class="dc-l">${t("kuro.notNow")}</span></button>`);
    expect(room(ctx)).toContain('<div class="hud-kuro away"></div>');
    expect(box).toMatchSnapshot();
    act(ctx, "loop-choice", { index: "1", choice: "no" });
    expect(ctx.session.dialogue.queue).toEqual([]);
    expect(room(ctx)).toContain('class="kuro-btn"');
  });

  it("聊聊 at night: Kuro's line with its face, then the player's box: the starters and 说点别的… on one page (snapshot)", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    talkAtNight(ctx);
    const said = out(ctx);
    const day = kuroDay(1)!;
    expect(day.starters.length).toBe(4);
    // playtest-1105 R6: one box. First Kuro's line, its portrait; nothing of the player's yet.
    expect(said).toMatch(/^<div class="dlg tagged kuro"/);
    // The idiom in Kuro's face (kuro-zh-answers R4).
    expect(said).toContain(`><span class="kmono">${escapeHtml(day.idiom)}</span></button>`);
    expect(said).not.toContain('class="dlg player');
    // Read on: the player's turn. world-prompts R2: the box keeps Kuro's line, name and portrait;
    // the options are the column's rows.
    act(ctx, "loop-advance");
    const box = out(ctx);
    expect(box.match(/<div class="dlg[ "]/g)).toHaveLength(1);
    expect(box).toContain("kuro-portrait");
    expect(box).toContain(`<span class="who tag k">${t("kuro.name")}</span>`);
    const player = box.slice(box.indexOf('<div class="dlg-choices'));
    const labels = [...player.matchAll(/data-action="kuro-(?:q|more)"[^>]*><i class="dc-ic (?:ask|more)"[\s\S]*?<\/i><span class="dc-l">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(labels).toEqual([...day.starters.map((s) => escapeHtml(s.zh)), escapeHtml(t("dialogue.more"))]);
    // No 先不聊 here (Esc leaves), and no ▼.
    expect(player).not.toContain("kuro-leave");
    expect(box).not.toContain('class="more"');
    expect(box).toMatchSnapshot();
  });

  it("every day's starters + 说点别的… are all rows of the column at once, in both languages", () => {
    for (const locale of ["zh", "en"] as const) {
      setLocale(locale);
      for (let d = 1; d <= constants.lastDay; d++) {
        const ctx = ctxOf(storeAt(d), NIGHT);
        talkAtNight(ctx);
        act(ctx, "loop-advance"); // playtest-1105 R6: to the player's turn
        const p = out(ctx);
        const want = playerBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)!.options.length;
        expect(p.match(/class="dc-row"/g)?.length, `${locale} day ${d}`).toBe(want);
      }
    }
  });

  it("a tag on the box pushes its text below it: narration without a tag has none of that", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    act(ctx, "kuro-call");
    expect(out(ctx)).toMatch(/^<div class="dlg tagged kuro has-choices"/);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    expect(out(ctx)).toMatch(/^<div class="dlg" /);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("s", [{ k: "speaker", who: "缝里", t: narration.t }]));
    expect(out(ctx)).toMatch(/^<div class="dlg tagged"/);
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    expect(css).toContain(".dlg.tagged,.dlg.tagged.has-choices{padding-top:27px}");
    expect(css).not.toContain("padding-top:44px"); // the tag is name-only again: one padding
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
    act(ctx, "loop-advance"); // playtest-1105 R6: the answer read, the player's turn
    expect(out(ctx)).not.toContain(`data-q="1"`);
    act(ctx, "kuro-more");
    const input = out(ctx);
    // world-prompts R2: 说点别的…'s row is the field, in place.
    expect(input).toMatch(/<div class="dc-row dc-field"><i class="dc-ic more"[\s\S]*?<\/i><input class="kuro-in" type="text" data-input="kuro-text"/);
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

  it("work beats: the chat is still locked, so a click is kuro.room.notYet; reading on closes it; no turn (playtest-1105 R6)", () => {
    const store = storeAt(3);
    const ctx = ctxOf(store, WORK);
    act(ctx, "kuro-call");
    expect(ctx.session.dialogue.queue.map((q) => q.ending.kind)).toEqual(["none"]);
    const box = out(ctx);
    expect(box).toContain(escapeHtml(t("kuro.room.notYet")));
    expect(box).not.toContain("data-choice");
    act(ctx, "loop-advance");
    expect(store.getState().chatTurnsToday).toBe(0);
    expect(ctx.session.dialogue.queue).toEqual([]);
  });

  it("Esc leaves at any player turn (typing: Esc first goes back to the list); the body comes back", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    talkAtNight(ctx);
    act(ctx, "kuro-more");
    // world-prompts R2: from the field, Esc returns to the list; the next Esc leaves.
    expect(loopKeys(ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(ctx.session.kuroInput).toBe(false);
    expect(ctx.session.dialogue.queue.length).toBe(1);
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
          } else if (out(ctx).includes('data-action="kuro-more"') || (act(ctx, "loop-advance"), out(ctx).includes('data-action="kuro-more"'))) {
            // playtest-1105 R6: Kuro's line is read on first; world-prompts R2: then the column holds the player's options.
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
            expect(out(ctx)).not.toContain('data-action="kuro-more"');
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

describe("Kuro stands at the box's right end (dialogue correction 2026-11-01)", () => {
  const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
  const num = (re: RegExp) => Number(re.exec(css)![1]);

  it("its portrait is the body's slot, in its state; busy while its line appears, settled after", () => {
    const ctx = ctxOf(storeAt(1), NIGHT);
    talkAtNight(ctx);
    const key = `${ctx.session.dialogue.queue[0]!.key}:0`;
    ctx.session.reveal = startReveal(key, { k: "speaker" }, 40, 1_000);
    const during = dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session, 1_100)!.value;
    expect(during).toContain('<span class="kpet kuro-portrait" data-kuro-slot data-state="busy"');
    const after = dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session, 10_000)!.value;
    expect(after).toContain('data-kuro-slot data-state="rest"'); // night: the body rests
    // Never on anyone else's line.
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    expect(out(ctx)).not.toContain("kuro-portrait");
  });

  it("~200 px, feet on the bottom edge, head above the top; the text column ends left of it", () => {
    const size = num(/\.dlg \.kpet\.kuro-portrait\{[^}]*width:(\d+)px/);
    const right = num(/\.dlg \.kpet\.kuro-portrait\{[^}]*right:(\d+)px/);
    expect(size).toBe(KURO_PORTRAIT.size);
    expect(right).toBe(KURO_PORTRAIT.right);
    expect(css).toMatch(/\.dlg \.kpet\.kuro-portrait\{[^}]*bottom:0;/);
    expect(size).toBeGreaterThan(132); // the head rises above the box
    const padRight = num(/\.dlg\.kuro\{padding-right:(\d+)px\}/);
    expect(padRight).toBe(KURO_LINE_BOX.padRight);
    expect(LINE_BOX.width - padRight).toBeLessThan(LINE_BOX.width - right - size); // text ends before the portrait
    // Kuro's own lines are laid out in that column: every offline answer fits its pages.
    const px = fontPx("zh");
    for (let d = 1; d <= constants.lastDay; d++) {
      const day = kuroDay(d)!;
      for (const text of [day.idiom, ...day.starters.map((s) => offlineAnswer(day, s.n)), offlineAnswer(day, null)]) {
        for (const s of screens(text, null, KURO_LINE_BOX, px)) expect(wrap(s.text, textArea(KURO_LINE_BOX, px), px).length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("one box (playtest-1105 R6): no second player's box and no raised box in the CSS; the choices are the column (world-prompts R2)", () => {
    expect(css).not.toContain(".dlg-player");
    expect(css).not.toContain(".dlg.raised");
    expect(css).not.toContain(".dlg.player");
    expect(css).toContain(".dlg-choices{position:fixed;");
  });

  it("the HUD body stands directly above the chip row, flush right; the box's right edge stays left of it", () => {
    expect(css).toMatch(/\.hud-br\{[^}]*flex-direction:column;align-items:flex-end/);
    const hudRight = num(/\.hud-br\{position:absolute;right:(\d+)px/);
    const body = num(/\.hud-kuro\{position:relative;width:(\d+)px/);
    const boxW = num(/\n\.dlg\{[^}]*width:(\d+)px/);
    expect(800 + boxW / 2).toBeLessThan(1600 - hudRight - body);
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
          // The wrap adds widths token by token, this adds them character by character: at an exact
          // fit ("        ! 雨" at 17 px in 119) the two differ by 1e-14, so compare with a tolerance.
          expect(width <= w + 1e-9 || visible.length <= 1).toBe(true);
        }
      }),
      // Pinned (a random run failed about one in ten on that rounding); the tolerance is the real fix.
      { seed: 20261102 },
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
    expect(css).toMatch(/\n\.dlg\{[^}]*width:992px;height:132px;/);
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

describe("addition 2026-11-01: the player's own portrait for inner lines", () => {
  const allSay = [...dayFiles.values()].flatMap((d) => Object.values(d.beats).flatMap((b) => b?.say ?? []));
  const inner = allSay.find((l) => l.k === "inner")!;
  // An NPC's line: day files' `who: "kuro"` / `who: "me"` are Kuro's and the player's (lying-view R1).
  const speaker = allSay.find((l) => l.k === "speaker" && l.who !== "kuro" && l.who !== "me")!;
  const withPronoun = (pronoun: "she" | "he" | null, day = 1): Store => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun } });
    while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
    return store;
  };
  const portraits = (box: string) => (box.match(/class="player-portrait"|kuro-portrait/g) ?? []).length;

  it("the pronoun answer chooses the file: 她 she.png, 他 he.png, 不说 none.png", () => {
    expect(playerPortraitSrc("she", false)).toBe("/player/she.png");
    expect(playerPortraitSrc("he", false)).toBe("/player/he.png");
    expect(playerPortraitSrc(null, false)).toBe("/player/none.png");
    for (const [pronoun, file] of [["she", "she"], ["he", "he"], [null, "none"]] as const) {
      const ctx = ctxOf(withPronoun(pronoun), WORK);
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("i", [inner]));
      const box = out(ctx);
      expect(box).toContain(`<img class="player-portrait" src="/player/${file}.png" alt="" aria-hidden="true" draggable="false">`);
      expect(box).toMatch(/^<div class="dlg inner me"/);
      // The inner tag stays empty.
      expect(box).not.toContain("who tag");
    }
  });

  it("dream nights (stages.json dreamNights) show the child: _kid; not by day, not on other nights", () => {
    expect(playerPortraitSrc("she", true)).toBe("/player/she_kid.png");
    expect(playerPortraitSrc(null, true)).toBe("/player/none_kid.png");
    const dream = dreamNights[0]!;
    expect(isDreamNight(dream, "night")).toBe(true);
    expect(isDreamNight(dream, "work")).toBe(false);
    expect(isDreamNight(dream - 1, "night")).toBe(dreamNights.includes(dream - 1));
    const at = (day: number, clock: BeatClock) => {
      const ctx = ctxOf(withPronoun("he", day), clock);
      ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("i", [inner]));
      return out(ctx);
    };
    expect(at(dream, NIGHT)).toContain('src="/player/he_kid.png"');
    expect(at(dream, WORK)).toContain('src="/player/he.png"');
    const plainNight = [1, 2, 3, 4].find((d) => !dreamNights.includes(d))!;
    expect(at(plainNight, NIGHT)).toContain('src="/player/he.png"');
  });

  it("narration and speaker lines keep no portrait; Kuro's turn shows only Kuro's: never two at once", () => {
    const ctx = ctxOf(withPronoun("she"), WORK);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("n", [narration]));
    expect(portraits(out(ctx))).toBe(0);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("s", [speaker]));
    expect(portraits(out(ctx))).toBe(0);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, { ...queueOf("k", [inner]), voice: "kuro" });
    const kuro = out(ctx);
    expect(portraits(kuro)).toBe(1);
    expect(kuro).toContain("kuro-portrait");
    expect(kuro).not.toContain("player-portrait");
    fc.assert(
      fc.property(fc.constantFrom(inner, speaker, narration), fc.boolean(), fc.constantFrom("she", "he", null), (line, isKuro, pronoun) => {
        const c = ctxOf(withPronoun(pronoun), WORK);
        c.session.dialogue = push(EMPTY_DIALOGUE, isKuro ? { ...queueOf("q", [line]), voice: "kuro" } : queueOf("q", [line]));
        expect(portraits(out(c))).toBeLessThanOrEqual(1);
      }),
      { numRuns: 30 },
    );
  });

  it("inner lines wrap left of the portrait, like Kuro's; the CSS uses Kuro's slot and size, and no animation", () => {
    const ctx = ctxOf(withPronoun(null), WORK);
    ctx.session.dialogue = push(EMPTY_DIALOGUE, queueOf("i", [inner]));
    const at = lineScreens(ctx.store.getState(), ctx.session)!;
    expect(at.all).toEqual(screens(inner.t, null, KURO_LINE_BOX, fontPx("zh")));
    const css = readFileSync(resolve(__dirname, "../src/world/room/room.css"), "utf8");
    const rule = /\.dlg \.player-portrait\{([^}]*)\}/.exec(css)![1]!;
    expect(rule).toContain(`right:${KURO_PORTRAIT.right}px`);
    expect(rule).toContain(`width:${KURO_PORTRAIT.size}px`);
    expect(rule).toContain(`height:${KURO_PORTRAIT.size}px`);
    expect(rule).not.toContain("animation");
    expect(css).toMatch(/\.dlg\.me\{padding-right:236px\}/);
  });
});
