// The deterministic core (author 2026-11-09): a starter is answered on the client from content and
// the run's seed — the bucket's tier, the d100 with the bucket's thresholds, the taboo — with no
// function call, online or not. Follow-ups (`after`) enter the pool only after their question; the
// same question asked six times gets the worn-down answer from content/kuro-repeat.md.
import { afterEach, describe, expect, it } from "vitest";
import { d100, outcomeOf, starterOpen, THRESHOLDS } from "@kuro/variable.ts";
import { parseStarters } from "@kuro/dayfile.ts";
import { parseRepeat, REPEAT_AT, repeatAnswer, timesAsked } from "@kuro/repeat.ts";
import type { Bucket } from "@kuro/types.ts";
import { createStore, type Store } from "@state/store";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { kuroDay, kuroDays, offlineAnswer, parseKuroDay } from "@world/desktop/kuro/days";
import { openStarters } from "@world/dialogue/kuro";
const openStartersOf = (store: Store, ctx: ActionContext) => openStarters(store.getState(), store.getEvents());
import { repeatEntries } from "@world/desktop/kuro/repeat";
import { initialSession } from "@world/desktop/model";
import { coreAnswer } from "@world/dialogue/core";
import { bucketNow, PAGE, playerBox, starterPages } from "@world/dialogue/kuro";
import { bleedingToday } from "@world/dialogue/taboo";
import { hasString, setLocale, t } from "@world/i18n";
import { loopActions } from "@world/room/game";
import { setKuroOnlineForTests, type KuroOnline } from "@net/supabase";

afterEach(() => {
  setKuroOnlineForTests(undefined);
  setLocale("zh");
});

const NIGHT: BeatClock = { beat: "night", time: "23:41" };
function storeAt(day: number, runId?: string, affinity?: number): Store {
  const store = createStore({ startDay: 1, ...(runId ? { runId } : {}), ...(affinity !== undefined ? { patch: { affinity } } : {}) });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: null } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function ctxOf(store: Store) {
  const timers: { ms: number; fn: () => void }[] = [];
  let now = 1_000;
  const ctx: ActionContext = { store, session: initialSession(NIGHT, "left", "room"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => now };
  return { ctx, run: () => timers.splice(0).forEach((x) => x.fn()) };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const talk = (ctx: ActionContext) => {
  act(ctx, "kuro-call");
  act(ctx, "loop-choice", { index: "0", choice: "yes" });
};
const chats = (store: Store) => store.getEvents().filter((e) => e.kind === "chat");
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A run id whose d100 for (day, q) has the outcome at the bucket (found by search; the dice are a pure hash). */
function runWith(day: number, q: number, bucket: Bucket, want: "success" | "failure" | "plain"): string {
  for (let i = 0; i < 20_000; i++) {
    const id = `core-test-${i}`;
    if (outcomeOf(d100(id, day, q), bucket) === want) return id;
  }
  throw new Error(`no run found for ${want} at ${bucket}`);
}

/** Day 3's q1 carries a layered answer in both languages; its zh low tier. */
const D3 = kuroDay(3)!;
const Q1 = D3.layered.find((l) => l.unlock === 1)!;

describe("a starter is answered by the core, never the function", () => {
  it("online: the function is not called; the bucket's zh tier is said as written and logged offline", async () => {
    const bodies: unknown[] = [];
    const online: KuroOnline = { turn: async (b) => (bodies.push(b), { mode: "turn", reply: "model", turnsLeft: 4 }), judge: async () => ({ mode: "judge", judgement: { truth: 0, values: 0, bond: 0, evidence: [] } }) };
    setKuroOnlineForTests(online);
    const store = storeAt(3, runWith(3, 1, "low", "plain"));
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    await flush();
    expect(bodies).toHaveLength(0);
    expect(chats(store)[0]).toMatchObject({ q: 1, answer: Q1.zh!.low, offline: true });
    expect(chats(store)[0]!.taboo).toBeUndefined();
  });

  it("the tier follows the bucket: low, mid, high (from state.affinity, as the ending reads it)", () => {
    for (const [affinity, tier] of [[0, "low"], [30, "mid"], [60, "high"]] as const) {
      const store = storeAt(3, runWith(3, 1, tier, "plain"), affinity);
      expect(bucketNow(store.getState())).toBe(tier);
      const a = coreAnswer({ day: D3, runId: store.getRunId(), bucket: tier, q: 1, locale: "zh", events: store.getEvents(), followup: null })!;
      expect(a.answer).toBe(Q1.zh![tier]);
      expect(a.layered).toBe(true);
    }
    // The English line on an en turn.
    const a = coreAnswer({ day: D3, runId: "x", bucket: "mid", q: 1, locale: "en", events: [], followup: null })!;
    expect(a.answer).toBe(Q1.mid);
  });

  it("大成功: the tier, the unreadable word on its own line, the follow-up; blood (SAN −1, the hand bleeds)", async () => {
    const store = storeAt(3, runWith(3, 1, "low", "success"));
    const san = store.getState().san;
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    const ev = chats(store)[0]!;
    expect(ev.taboo).toBe("blood");
    const lines = ev.answer!.split("\n");
    expect(lines[0]).toBe(Q1.zh!.low);
    expect(lines[1]!.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]!.length).toBeLessThanOrEqual(5);
    if (hasString("kuro.unreadable")) expect(lines[2]).toBe(t("kuro.unreadable"));
    expect(store.getState().san).toBe(san - 1);
    expect(bleedingToday(store.getEvents(), 3)).toBe(true);
  });

  it("大失败: flicker — nothing shown or remembered, the turn spent; one taboo a day, then the plain tier", async () => {
    const store = storeAt(3, runWith(3, 1, "low", "failure"));
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    expect(chats(store)[0]).toMatchObject({ q: 1, taboo: "flicker", forgotten: true, answer: "" });
    expect(store.getState().chatMemory.recent).toEqual([]);
    expect(store.getState().chatTurnsToday).toBe(1);
    // The same day's second layered ask rolls but plays nothing more.
    const again = coreAnswer({ day: D3, runId: store.getRunId(), bucket: "low", q: 1, locale: "zh", events: store.getEvents(), followup: null })!;
    expect(again.taboo).toBeNull();
    expect(again.answer).toBe(Q1.zh!.low);
  });

  it("the thresholds move with the bucket; a 大成功 and a 大失败 both exist at every bucket", () => {
    expect(THRESHOLDS.low.failFrom).toBeGreaterThan(THRESHOLDS.high.success);
    for (const b of ["low", "mid", "high"] as const) {
      expect(() => runWith(3, 1, b, "success")).not.toThrow();
      expect(() => runWith(3, 1, b, "failure")).not.toThrow();
    }
  });

  it("a red-blue line is said as written and never rolls; a starter without a locked line gets its written answer", () => {
    // Day 3 q3 is a red-blue line (English, as content keeps the uncanny ones).
    const red = coreAnswer({ day: D3, runId: "x", bucket: "low", q: 3, locale: "zh", events: [], followup: null })!;
    expect(red.layered).toBe(false);
    expect(red.roll).toBeNull();
    expect(red.answer).toBe(D3.locked.find((l) => l.unlock === 3)!.text);
    // A starter with no locked line (a synthetic day): null → the caller's written answer.
    const bare = parseKuroDay("# Day 1\n**Idiom of the day (constant):** Hi.\n## Starter questions\n| 1 | 一 | one |  |\n## Offline answers\n- free text → \"Go on.\"\n## Never\n- x\n", "t");
    expect(coreAnswer({ day: bare, runId: "x", bucket: "low", q: 1, locale: "zh", events: [], followup: null })).toBeNull();
    expect(offlineAnswer(bare, 1)).toBe("Go on.");
  });

  it("every real day's layered answers can be reached by the core at every bucket", () => {
    for (const day of kuroDays.values()) {
      for (const l of day.layered) {
        const open = day.starters.find((s) => s.n === l.unlock)!;
        for (const b of ["low", "mid", "high"] as const) {
          if (!starterOpen(open, b, [], day.day)) continue;
          const a = coreAnswer({ day, runId: runWith(day.day, l.unlock, b, "plain"), bucket: b, q: l.unlock, locale: "zh", events: [], followup: null })!;
          expect(a.answer).toBe(l.zh ? l.zh[b] : l[b]);
        }
      }
    }
  });
});

describe("follow-ups (追问)", () => {
  const md = `# Day 3\n**Idiom of the day (constant):** Hi.\n## Starter questions\n| # | zh | en | hard | minBucket | after |\n|---|---|---|---|---|---|\n| 1 | 一 | one |  |  |  |\n| 2 | 二 | two |  |  | q1 |\n| 3 | 三 | three |  | mid | d2.q4 |\n`;
  it("the parser reads after: qN (today) and dD.qN (that day); a same-day follow-up must name another starter", () => {
    const s = parseStarters(md, "t");
    expect(s[0]!.after).toBeUndefined();
    expect(s[1]!.after).toEqual({ day: null, q: 1 });
    expect(s[2]!.after).toEqual({ day: 2, q: 4 });
    expect(() => parseStarters(md.replace("| q1 |", "| q9 |"), "t")).toThrow(/after q9/);
    expect(() => parseStarters(md.replace("| q1 |", "| after: q2 |"), "t")).toThrow(/after q2/);
    expect(() => parseStarters(md.replace("| q1 |", "| soon |"), "t")).toThrow(/after must be/);
  });

  it("a follow-up is in the pool only after its question was asked — today, or on the day it names", () => {
    const [, today, earlier] = parseStarters(md, "t");
    expect(starterOpen(today!, "low", [], 3)).toBe(false);
    expect(starterOpen(today!, "low", [{ day: 2, q: 1 }], 3)).toBe(false);
    expect(starterOpen(today!, "low", [{ day: 3, q: 1 }], 3)).toBe(true);
    expect(starterOpen(earlier!, "mid", [{ day: 3, q: 4 }], 3)).toBe(false);
    expect(starterOpen(earlier!, "mid", [{ day: 2, q: 4 }], 3)).toBe(true);
    expect(starterOpen(earlier!, "low", [{ day: 2, q: 4 }], 3)).toBe(false);
  });

  it("every real follow-up names a starter that exists on its day", () => {
    for (const day of kuroDays.values()) {
      for (const s of day.starters) {
        if (!s.after) continue;
        const on = s.after.day === null ? day : kuroDay(s.after.day);
        expect(on?.starters.some((x) => x.n === s.after!.q), `day ${day.day} q${s.n} after d${s.after.day ?? day.day}.q${s.after.q}`).toBe(true);
      }
    }
  });

  it("the player's box hides a follow-up until its question is asked (a real day, if it has one)", () => {
    const day = [...kuroDays.values()].find((d) => d.starters.some((s) => s.after?.day === null));
    if (!day) return;
    const follow = day.starters.find((s) => s.after?.day === null)!;
    const store = storeAt(day.day);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "loop-advance");
    const labels = () => playerBox(store.getState(), store.getEvents(), ctx.session)!.options.map((o) => o.q);
    expect(labels()).not.toContain(follow.n);
    act(ctx, "kuro-q", { q: String(follow.after!.q) });
    act(ctx, "loop-advance");
    expect(labels()).toContain(follow.n);
  });
});

describe("pages of five", () => {
  const q = (n: number) => ({ n, zh: `问${n}`, en: `q${n}`, hard: false, minBucket: "low" as const });
  it("a pool of five or fewer is one page; a larger one is cut into pages of five in order", () => {
    expect(PAGE).toBe(5);
    expect(starterPages([q(1), q(2), q(3)])).toEqual([[q(1), q(2), q(3)]]);
    const big = Array.from({ length: 12 }, (_, i) => q(i + 1));
    const pages = starterPages(big);
    expect(pages.map((p) => p.map((s) => s.n))).toEqual([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12]]);
  });
  it("in the box: five questions and 说点别的… when the pool is larger; 说点别的… turns the page and wraps; a smaller pool has no such row", () => {
    const day = [...kuroDays.values()].find((d) => d.starters.filter((s) => s.minBucket === "low" && !s.after).length > PAGE);
    const store = storeAt(day ? day.day : 1);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "loop-advance");
    const opts = () => playerBox(store.getState(), store.getEvents(), ctx.session)!.options;
    if (!day) {
      expect(opts().every((o) => o.action === "kuro-q")).toBe(true);
      return;
    }
    const first = opts();
    expect(first.filter((o) => o.action === "kuro-q")).toHaveLength(PAGE);
    expect(first.at(-1)).toMatchObject({ action: "kuro-page", label: t("dialogue.more") });
    expect(first.some((o) => o.action === "kuro-more")).toBe(false);
    act(ctx, "kuro-page");
    const second = opts();
    expect(second.map((o) => o.q).join()).not.toBe(first.map((o) => o.q).join());
    const n = starterPages(openStartersOf(store, ctx)).length;
    for (let i = 1; i < n; i++) act(ctx, "kuro-page");
    expect(opts().map((o) => o.q)).toEqual(first.map((o) => o.q));
  });
  it("a follow-up comes first on the first page, tagged (追问)", () => {
    const day = [...kuroDays.values()].find((d) => d.starters.some((s) => s.after?.day === null));
    if (!day) return;
    const follow = day.starters.find((s) => s.after?.day === null)!;
    const store = storeAt(day.day);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "loop-advance");
    act(ctx, "kuro-q", { q: String(follow.after!.q) });
    act(ctx, "loop-advance");
    const first = playerBox(store.getState(), store.getEvents(), ctx.session)!.options[0]!;
    expect(first.q).toBe(follow.n);
    expect(first.label.startsWith(t("kuro.followUp"))).toBe(true);
  });
});

describe("the sixth time", () => {
  const entries = parseRepeat(`- "你叫什么？" / "What's your name?" → "Fine." | zh: "好吧。"\n- "二" → "Two."\n`);
  it("parses the file strictly; the real file loads and names real questions", () => {
    expect(entries[0]).toEqual({ zh: "你叫什么？", en: "What's your name?", answer: "Fine.", answerZh: "好吧。" });
    expect(entries[1]).toEqual({ zh: "二", en: null, answer: "Two.", answerZh: null });
    expect(() => parseRepeat(`- 你叫什么 → "x"`)).toThrow(/unreadable/);
    expect(() => parseRepeat(`- "a" → "x"\n- "a" → "y"`)).toThrow(/two entries/);
    expect(repeatEntries.length).toBeGreaterThan(0);
    const all = [...kuroDays.values()].flatMap((d) => d.starters.map((s) => s.zh));
    for (const e of repeatEntries) expect(all, e.zh).toContain(e.zh);
  });

  it("counts the question by its text in either language across days; the sixth ask gets the worn-down line", () => {
    const ev = (said: string, day = 1) => ({ kind: "chat", day, said });
    const five = [ev("你叫什么？", 1), ev("What's your name?", 2), ev("你叫什么", 2), ev("你叫什么？", 4), ev("你叫什么？", 5)];
    expect(timesAsked(entries, five, "你叫什么？")).toBe(5);
    expect(repeatAnswer(entries, five.slice(0, 4), "你叫什么？", "zh")).toBeNull();
    expect(repeatAnswer(entries, five, "你叫什么？", "zh")).toBe("好吧。");
    expect(repeatAnswer(entries, five, "What's your name?", "en")).toBe("Fine.");
    expect(repeatAnswer(entries, five, "二", "zh")).toBeNull();
    expect(REPEAT_AT).toBe(6);
  });

  it("in the game: the sixth ask of day 1's name question, typed, is answered by the core and sent to no function", async () => {
    const bodies: unknown[] = [];
    setKuroOnlineForTests({ turn: async (b) => (bodies.push(b), { mode: "turn", reply: "model", turnsLeft: 4 }), judge: async () => ({ mode: "judge", judgement: { truth: 0, values: 0, bond: 0, evidence: [] } }) });
    const q4 = kuroDay(1)!.starters.find((s) => s.n === 4)!;
    const store = storeAt(1);
    for (let day = 1; day <= 5; day++) {
      store.appendEvent({ kind: "chat", text: q4.zh, said: q4.zh, answer: "…", offline: true });
      store.appendEvent({ kind: "lieDown" });
    }
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-more");
    ctx.session.kuroDraft = q4.zh;
    act(ctx, "kuro-send");
    await flush();
    expect(bodies).toHaveLength(0);
    const entry = repeatEntries.find((e) => e.zh === q4.zh)!;
    expect(chats(store).at(-1)).toMatchObject({ text: q4.zh, answer: entry.answerZh, offline: true });
    expect(chats(store).at(-1)!.taboo).toBeUndefined();
  });
});
