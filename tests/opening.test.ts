// opening R1–R4 (2026-11-04): the shipping label after 开始, the prologue played in the box over
// the dream backdrops, the fade into day 1, and 跳过 only once a run has been finished.
import { afterEach, describe, expect, it } from "vitest";
import zhRaw from "@content/prologue.json";
import enRaw from "@content/en/prologue.json";
import { localisePrologue, parsePrologue, prologueLines } from "@state/prologue";
import { createStore } from "@state/store";
import { EMPTY_COLLECTION } from "@world/room/collection";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { setLocale } from "@world/i18n";
import { push } from "@world/loop/dialogue";
import { silhouetteFor } from "@world/npc";
import { PROLOGUE_FADE_MS, PROLOGUE_KEY, startPrologue } from "@world/opening";
import { loopActions, renderGame } from "@world/room/game";
import { initialTitle, QUESTIONS } from "../src/ui/title/model";
import { renderTitle } from "../src/ui/title/view";
import { mountTitle, OPENING } from "../src/ui/title/mount";

afterEach(() => setLocale("zh"));

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe("the prologue loader (R2)", () => {
  it("both files load and match; the game's lines are the Chinese, English under lang=en", () => {
    const zh = parsePrologue(zhRaw);
    const en = parsePrologue(enRaw, "en/prologue.json");
    expect(zh.length).toBeGreaterThan(0);
    expect(prologueLines).toHaveLength(zh.length);
    expect(prologueLines[0]!.backdrop).toBe(zh[0]!.backdrop);
    expect(localisePrologue(zh, en).map((l) => l.who)).toEqual(zh.map((l) => l.who));
  });

  it("unknown keys, a where, and a wrong shape fail", () => {
    expect(() => parsePrologue({ ...clone(zhRaw), extra: 1 })).toThrow(/top level: unknown key "extra"/);
    const bad = clone(zhRaw) as { say: Record<string, unknown>[] };
    bad.say[0]!.mood = "x";
    expect(() => parsePrologue(bad)).toThrow(/say\[0\]/);
    const where = clone(zhRaw) as { say: Record<string, unknown>[] };
    where.say[0]!.where = "desk";
    expect(() => parsePrologue(where)).toThrow(/say\[0\]/);
    expect(() => parsePrologue({ say: [] })).toThrow(/say: must be a non-empty list/);
    expect(() => parsePrologue([])).toThrow(/not an object/);
  });

  it("the twin must match the count, kinds, speakers and backdrops", () => {
    const zh = parsePrologue(zhRaw);
    const en = parsePrologue(enRaw, "en/prologue.json");
    expect(() => localisePrologue(zh, en.slice(1))).toThrow(/content\/en\/prologue\.json say: /);
    const i = zh.findIndex((l) => l.k === "speaker");
    expect(i).toBeGreaterThanOrEqual(0);
    const who = en.map((l, j) => (j === i ? { ...l, who: "someone" } : l));
    expect(() => localisePrologue(zh, who)).toThrow(new RegExp(`say\\[${i}\\]\\.who`));
    const bd = en.map((l, j) => (j === 0 ? { ...l, backdrop: "/room/dream/office.jpg?x" } : l));
    expect(() => localisePrologue(zh, bd)).toThrow(/say\[0\]\.backdrop/);
    const kind = en.map((l, j) => (j === 0 ? { ...l, k: "inner" as const } : l));
    expect(() => localisePrologue(zh, kind)).toThrow(/say\[0\]: kind/);
  });
});

describe("the shipping label (R1)", () => {
  const coll = initialTitle(null, EMPTY_COLLECTION);

  it("prints the typed name into 收件人 and leaves 寄件人 empty, over the box", () => {
    const out = renderTitle({ ...coll, opening: { name: "阿明", chars: 1, phase: "print" } }).value;
    expect(out).toContain('class="opening-scene phase-print" data-phase="print"');
    expect(out).toContain('class="opening-box"');
    expect(out).toContain('<span class="ol-k">收件人</span><span class="ol-v ol-name">阿</span>');
    expect(out).toContain('<span class="ol-k">寄件人</span><span class="ol-v ol-from"></span>');
    expect(renderTitle({ ...coll, opening: { name: "阿明", chars: 2, phase: "hold" } }).value).toContain('<span class="ol-v ol-name">阿明</span>');
    expect(renderTitle(coll).value).not.toContain("opening-scene");
  });

  it("mounted: 开始 prints one character at a time, sticks, holds, fades; then the game starts", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    // A virtual clock for the mount's timers.
    let now = 0;
    let seq = 0;
    const queue = new Map<number, { at: number; fn: () => void }>();
    const w = win as unknown as { setTimeout: unknown; clearTimeout: unknown };
    w.setTimeout = (fn: () => void, ms = 0) => (queue.set(++seq, { at: now + ms, fn }), seq);
    w.clearTimeout = (id: number) => void queue.delete(id);
    const runTo = (t: number) => {
      for (;;) {
        const next = [...queue].filter(([, q]) => q.at <= t).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        queue.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = t;
    };
    const root = win.document.createElement("div") as unknown as HTMLElement;
    win.document.body.appendChild(root as never);
    const sound = { muted: false, setMuted() {}, apply() {}, unlock() {}, onTuneEnd() {}, armGestures() {}, idle: async () => {}, destroy() {} } as never;
    const started: string[] = [];
    const title = mountTitle(root, { save: null, collection: EMPTY_COLLECTION, onContinue() {}, onStart: (n: { login: string }) => void started.push(n.login), random: () => 0.5, sound } as never);
    const click = (sel: string) => (root.querySelector(sel) as unknown as { dispatchEvent: (e: unknown) => void } | null)?.dispatchEvent(new win.MouseEvent("click", { bubbles: true }) as never);
    click('[data-action="title-new"]');
    runTo(now + 5_000);
    for (const q of QUESTIONS) {
      if (q === "pronoun") {
        click('[data-action="title-pronoun"][data-pronoun="none"]');
        continue;
      }
      const input = root.querySelector<HTMLInputElement>(`[data-input="title-${q}"]`)!;
      input.value = q === "login" ? "阿明" : "x";
      input.dispatchEvent(new win.Event("input", { bubbles: true }) as never);
    }
    click('[data-action="title-start"]');
    const t0 = now;
    const lead = Math.max(400, OPENING.columnMs);
    expect(title.model().opening).toBeNull();
    runTo(t0 + lead);
    expect(title.model().opening).toMatchObject({ name: "阿明", chars: 0, phase: "print" });
    runTo(t0 + lead + OPENING.charMs);
    expect(title.model().opening?.chars).toBe(1);
    expect(root.querySelector(".ol-name")?.textContent).toBe("阿");
    expect(root.querySelector(".ol-from")?.textContent).toBe("");
    runTo(t0 + lead + 3 * OPENING.charMs);
    expect(title.model().opening?.phase).toBe("stick");
    expect(root.querySelector(".ol-name")?.textContent).toBe("阿明");
    runTo(t0 + lead + 3 * OPENING.charMs + OPENING.stickMs);
    expect(title.model().opening?.phase).toBe("hold");
    runTo(t0 + lead + 3 * OPENING.charMs + OPENING.stickMs + OPENING.holdMs);
    expect(title.model().opening?.phase).toBe("fade");
    expect(started).toEqual([]);
    runTo(t0 + lead + 3 * OPENING.charMs + OPENING.stickMs + OPENING.holdMs + OPENING.fadeMs);
    expect(started).toEqual(["阿明"]);
    title.destroy();
  });
});

describe("the prologue in the game (R2)", () => {
  function setup(finishedRuns = 0) {
    const store = createStore({ startDay: 1 });
    const session = initialSession(DEFAULT_CLOCK, "left", "desk");
    session.collection = { ...EMPTY_COLLECTION, finishedRuns };
    let now = 0;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const out = () => renderGame(store, session, now).value;
    const act = (name: string) => loopActions[name]!(ctx, {} as DOMStringMap, null as never);
    const wait = (ms: number) => {
      now += ms;
      for (const t of timers.splice(0)) {
        if (t.at <= now) t.fn();
        else timers.push(t);
      }
    };
    return { store, session, ctx, out, act, wait };
  }

  it("plays on its own black page over the first backdrop; every line read fades into day 1's desk", () => {
    const g = setup();
    const events = g.store.getEvents().length;
    startPrologue(g.session);
    const first = g.out();
    expect(first).toContain('class="stage opening-page"');
    expect(first).toContain(prologueLines[0]!.backdrop!);
    expect(first).toContain(String(prologueLines[0]!.t));
    expect(first).not.toContain('data-action="opening-skip"');
    expect(first).not.toContain('data-view="desk"');
    for (let i = 0; i < 200 && g.session.opening === null; i++) g.act("loop-advance");
    expect(g.session.opening).not.toBeNull();
    expect(g.session.dialogue.queue.some((s) => s.key === PROLOGUE_KEY)).toBe(false);
    const fading = g.out();
    expect(fading).toContain("opening-page fading");
    expect(fading).toContain('class="opening-fade"');
    g.wait(PROLOGUE_FADE_MS - 1);
    expect(g.out()).toContain("opening-page");
    g.wait(1);
    expect(g.session.opening).toBeNull();
    const day1 = g.out();
    expect(day1).not.toContain("opening-page");
    expect(day1).toContain('data-view="desk"');
    expect(day1).toContain('data-day="1"');
    // No event, no state.
    expect(g.store.getEvents()).toHaveLength(events);
  });

  it("跳过 only once a run has been finished; it goes straight to the fade, then day 1", () => {
    const fresh = setup(0);
    startPrologue(fresh.session);
    fresh.act("opening-skip");
    expect(fresh.session.opening).toBeNull();
    expect(fresh.session.dialogue.queue[0]?.key).toBe(PROLOGUE_KEY);

    const again = setup(1);
    startPrologue(again.session);
    const page = again.out();
    expect(page).toContain('data-action="opening-skip"');
    expect(page).toContain(">跳过<");
    again.act("opening-skip");
    expect(again.session.dialogue.queue.some((s) => s.key === PROLOGUE_KEY)).toBe(false);
    expect(again.out()).toContain("opening-fade");
    expect(again.out()).not.toContain('data-action="opening-skip"');
    again.wait(PROLOGUE_FADE_MS);
    expect(again.out()).toContain('data-view="desk"');
  });

  it("a speaker not in npc.json gets a silhouette, only in the prologue", () => {
    const g = setup();
    g.session.dialogue = push(g.session.dialogue, { key: PROLOGUE_KEY, lines: [{ k: "speaker", who: "路人甲", t: "嗯。" }], ending: { kind: "prologue" } });
    const src = silhouetteFor("路人甲");
    expect(src).not.toBe("");
    expect(g.out()).toContain(src);
  });
});
