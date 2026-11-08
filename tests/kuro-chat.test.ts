// kuro-chat FR2–FR6: memory from the chat events, the judgement and its fold, the offline rule
// scorer against a mocked model path, the online turn with a mocked function (and its fallback),
// the decay filter, and the credits from judgement.log. Never the real API.
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { JUDGEMENT_KEYS, validateJudgement } from "@kuro/judgement.ts";
import type { Judgement } from "@kuro/types.ts";
import { affinityDelta, AFFINITY_PER_POINT, MEMORY_TURNS } from "@state/chat";
import { applyEvent, type GameEvent } from "@state/events";
import { f } from "@state/fday";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { kuroDay, offlineAnswer } from "@world/desktop/kuro/days";
import { decay, DECAY_BY_STAGE } from "@world/desktop/kuro/decay";
import { scoreOffline, toLogEvents } from "@world/desktop/kuro/scorer";
import { initialSession } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { judgementPending, startJudgement } from "@world/dialogue/judge";
import { WAITING } from "@world/dialogue/kuro";
import { creditLines } from "@world/endings/credits";
import { escapeHtml } from "@world/html";
import { getLocale, setLocale, t } from "@world/i18n";
import { lieDownOrEnd } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";
import { setKuroOnlineForTests, type KuroOnline } from "@net/supabase";

afterEach(() => {
  setKuroOnlineForTests(undefined);
  setLocale("zh");
});

const NIGHT: BeatClock = { beat: "night", time: "23:41" };
function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "names", names: { login: "林一", nick: "一一", calledBy: "老大", bossCalls: "小林", pronoun: null } });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function ctxOf(store: Store, clock: BeatClock = NIGHT) {
  const timers: { ms: number; fn: () => void }[] = [];
  let now = 1_000;
  const ctx: ActionContext = { store, session: initialSession(clock, "left", "room"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => now };
  return { ctx, timers, tick: (ms: number) => (now += ms) };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const talk = (ctx: ActionContext) => {
  act(ctx, "kuro-call");
  act(ctx, "loop-choice", { index: "0", choice: "yes" });
};
const box = (ctx: ActionContext) => dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)?.value ?? "";
const flush = () => new Promise((r) => setTimeout(r, 0));
const TYPED = "你今天累不累。";
/** Types `text` and sends it: the model's channel (a starter is the deterministic core's, 2026-11-09). */
function typeOnce(ctx: ActionContext, text = TYPED) {
  act(ctx, "kuro-more");
  ctx.session.kuroDraft = text;
  act(ctx, "kuro-send");
}

describe("memory (FR2)", () => {
  it("each turn's words and Kuro's raw answer go into chatMemory; the last N turns are kept", () => {
    let s = f(2);
    for (let i = 0; i < MEMORY_TURNS + 3; i++) {
      s = applyEvent({ ...s, chatTurnsToday: 0 }, { kind: "chat", day: 2, text: `t${i}`, said: `t${i}`, answer: `a${i}`, offline: i % 2 === 0 } as GameEvent);
    }
    expect(s.chatMemory.recent).toHaveLength(2 * MEMORY_TURNS);
    expect(s.chatMemory.recent.at(-2)).toEqual({ day: 2, who: "player", text: `t${MEMORY_TURNS + 2}` });
    expect(s.chatMemory.recent.at(-1)).toEqual({ day: 2, who: "kuro", text: `a${MEMORY_TURNS + 2}`, offline: true });
    // Day 1 has no memory; an old event without words adds nothing.
    expect(f(1).chatMemory).toEqual({ summary: "", recent: [] });
    expect(applyEvent(f(1), { kind: "chat", day: 1, q: 1 } as GameEvent).chatMemory.recent).toEqual([]);
  });
});

describe("the offline path (FR3)", () => {
  it("a starter gets its written answer, as written (no decay), and the turn is logged offline", () => {
    const store = storeAt(1);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    const answer = offlineAnswer(kuroDay(1)!, 1);
    expect(store.getEvents().find((e) => e.kind === "chat")).toMatchObject({ kind: "chat", q: 1, said: kuroDay(1)!.starters[0]!.zh, answer, offline: true });
    expect(box(ctx)).toContain(answer.slice(0, 20));
  });
});

describe("the online path (FR3), with a mocked function", () => {
  function mock(over: Partial<KuroOnline> = {}) {
    const turns: unknown[] = [];
    const online: KuroOnline = {
      turn: async (b) => (turns.push(b), { mode: "turn", reply: "You noticed. Most people don't, {login}.", turnsLeft: 4 }),
      judge: async () => ({ mode: "judge", judgement: { truth: 1, values: 0, bond: 1, evidence: [], summary: "They asked." } }),
      ...over,
    };
    setKuroOnlineForTests(online);
    return turns;
  }

  it("Kuro waits (no player's box), then answers; the reply is decay-filtered and named; logged online", async () => {
    const turns = mock();
    const store = storeAt(14);
    const { ctx } = ctxOf(store);
    talk(ctx);
    typeOnce(ctx);
    expect(box(ctx)).toContain(`>${WAITING}</button>`);
    expect(box(ctx)).not.toContain('data-action="kuro-more"');
    await flush();
    const ev = store.getEvents().find((e) => e.kind === "chat")!;
    expect(ev).toMatchObject({ text: TYPED, answer: "You noticed. Most people don't, {login}.", offline: false });
    expect(turns[0]).toMatchObject({ run_id: store.getRunId(), day: 14, said: TYPED, locale: getLocale() });
    // Never the login inputs in what the client sends.
    expect(JSON.stringify(turns[0])).not.toContain("林一");
    const shown = box(ctx);
    expect([...decay("You noticed. Most people don't, 林一.", 5)].length).toBe([..."You noticed. Most people don't, 林一."].length);
    expect(shown).toContain(escapeHtml(decay("You noticed. Most people don't, 林一.", 5)));
    // playtest-1105 R6: the reply read on, the player's turn (world-prompts R2: its options in the column).
    expect(shown).not.toContain('data-action="kuro-more"');
    act(ctx, "loop-advance");
    expect(box(ctx)).toContain('data-action="kuro-more"');
  });

  it("any failure (timeout, refusal, network) → the scripted answer, logged offline; Kuro never breaks", async () => {
    mock({ turn: async () => { throw new Error("timed out after 20000 ms"); } });
    const store = storeAt(1);
    const { ctx } = ctxOf(store);
    talk(ctx);
    typeOnce(ctx);
    await flush();
    expect(store.getEvents().find((e) => e.kind === "chat")).toMatchObject({ text: TYPED, answer: offlineAnswer(kuroDay(1)!, null), offline: true });
    act(ctx, "loop-advance");
    expect(box(ctx)).toContain('data-action="kuro-more"');
  });

  it("the function says bedtime: the bedtime line, no turn logged, no player's box", async () => {
    mock({ turn: async () => ({ mode: "turn", reply: "x", turnsLeft: 0, bedtime: true }) });
    const store = storeAt(1);
    const { ctx } = ctxOf(store);
    talk(ctx);
    typeOnce(ctx);
    await flush();
    expect(store.getEvents().some((e) => e.kind === "chat")).toBe(false);
    act(ctx, "loop-advance");
    expect(box(ctx)).not.toContain('data-action="kuro-more"');
  });

  it("property: the sixth turn is always blocked on the client, online or not", () => {
    fc.assert(
      fc.property(fc.integer({ min: 6, max: 9 }), (n) => {
        const store = storeAt(2);
        for (let i = 0; i < 5; i++) store.appendEvent({ kind: "chat", text: `x${i}` });
        for (let i = 5; i < n; i++) expect(() => store.appendEvent({ kind: "chat", text: "more" })).toThrow(/no turns left/);
        expect(store.getState().chatTurnsToday).toBe(constants.chatTurnsPerDay);
      }),
    );
  });
});

describe("the judgement (FR4)", () => {
  const judged = (day: number, j: Partial<Judgement> & { source?: "model" | "offline" } = {}) =>
    ({ kind: "judged", day, truth: 1, values: 1, bond: 1, evidence: [{ eventId: "ev1", note: "looked first" }], source: "model", ...j }) as GameEvent;

  it("folds: affinity += Σ×k (clamped 0..100), evidence logged with the day's delta and scores, summary kept", () => {
    const s = applyEvent(f(3), judged(3, { summary: "They read it." }));
    expect(s.affinity).toBe(3 * AFFINITY_PER_POINT);
    expect(s.judgement).toMatchObject({ truth: 1, values: 1, bond: 1 });
    expect(s.judgement.evidence.at(-1)).toEqual({ day: 3, eventId: "ev1", note: "looked first", delta: 15, dims: { truth: 1, values: 1, bond: 1 } });
    expect(s.chatMemory.summary).toBe("They read it.");
    expect(applyEvent({ ...f(3), affinity: 98 }, judged(3)).affinity).toBe(100);
    expect(applyEvent({ ...f(3), affinity: 3 }, judged(3, { truth: -2, values: -2, bond: -2 })).affinity).toBe(0);
  });

  it("snapshot: day 14's multiplier", () => {
    expect(affinityDelta(14, { truth: 1, values: 1, bond: 1 })).toBe(3 * AFFINITY_PER_POINT * constants.tenderDayAffinityMultiplier);
    const s = applyEvent(f(14), judged(14));
    expect({ affinity: s.affinity, evidence: s.judgement.evidence }).toMatchSnapshot();
  });

  it("rejects scores outside −2..2, uncited or malformed evidence, an unknown source", () => {
    expect(() => applyEvent(f(3), judged(3, { truth: 3 }))).toThrow(/integer −2..2/);
    expect(() => applyEvent(f(3), judged(3, { evidence: [{ eventId: "boot", note: "x" }] }))).toThrow(/like ev12/);
    expect(() => applyEvent(f(3), judged(3, { evidence: [{ eventId: "ev3", note: " " }] }))).toThrow(/needs a note/);
    expect(() => applyEvent(f(3), judged(3, { source: "guess" as never }))).toThrow(/source/);
  });

  it("property: affinity is monotone in the sum of the scores", () => {
    const score = fc.integer({ min: -2, max: 2 });
    fc.assert(
      fc.property(fc.tuple(score, score, score), fc.tuple(score, score, score), fc.integer({ min: 1, max: 18 }), ([a, b, c], [x, y, z], day) => {
        const one = applyEvent(f(day), judged(day, { truth: a, values: b, bond: c, evidence: [] })).affinity;
        const two = applyEvent(f(day), judged(day, { truth: x, values: y, bond: z, evidence: [] })).affinity;
        if (a + b + c <= x + y + z) expect(one).toBeLessThanOrEqual(two);
      }),
    );
  });

  it("property: the rule scorer and the model path produce the same schema", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 4 }), fc.boolean(), (turns, typed) => {
        const store = storeAt(4);
        store.appendEvent({ kind: "looked", objectId: "chick" });
        for (let i = 0; i < turns; i++) store.appendEvent(typed && i === 0 ? { kind: "chat", text: "雨停了吗", said: "雨停了吗", answer: "a" } : { kind: "chat", q: 1, said: "q", answer: "a" });
        const offline = scoreOffline(store.getEvents(), 4);
        const ids = new Set(toLogEvents(store.getEvents()).map((e) => e.id));
        const model = validateJudgement({ truth: 2, values: 0, bond: 1, evidence: [{ eventId: [...ids][0], note: "n" }], summary: "s" }, ids)!;
        for (const j of [offline, model]) {
          for (const k of JUDGEMENT_KEYS) expect(j).toHaveProperty(k);
          for (const k of ["truth", "values", "bond"] as const) expect(Number.isInteger(j[k]) && j[k] >= -2 && j[k] <= 2).toBe(true);
          for (const e of j.evidence) expect(ids.has(e.eventId)).toBe(true);
        }
        // Both fold the same way.
        expect(() => applyEvent(f(4), { kind: "judged", day: 4, ...offline, source: "offline" } as GameEvent)).not.toThrow();
        expect(() => applyEvent(f(4), { kind: "judged", day: 4, ...model, source: "model" } as GameEvent)).not.toThrow();
      }),
      { numRuns: 20 },
    );
  });

  it("at the bed: offline it is the scorer, once a day; never on a day without a chat turn", () => {
    const store = storeAt(2);
    const { ctx } = ctxOf(store);
    startJudgement(ctx);
    expect(store.getEvents().some((e) => e.kind === "judged")).toBe(false); // no chat today
    store.appendEvent({ kind: "chat", text: "hi", said: "hi", answer: "Hi." });
    store.appendEvent({ kind: "chat", q: 1, said: "q", answer: "a" });
    startJudgement(ctx);
    startJudgement(ctx);
    const js = store.getEvents().filter((e) => e.kind === "judged");
    expect(js).toHaveLength(1);
    expect(js[0]).toMatchObject({ source: "offline", bond: 2 });
  });

  it("online: the model's judgement; lying down waits for it (≤ 20 s), then the scorer", async () => {
    let release: (j: Judgement) => void = () => {};
    const sent: unknown[] = [];
    setKuroOnlineForTests({ turn: async () => { throw new Error("unused"); }, judge: (b) => (sent.push(b), new Promise((r) => (release = (j) => r({ mode: "judge", judgement: j })))) });
    const store = storeAt(3);
    store.appendEvent({ kind: "chat", text: "hi", said: "hi", answer: "Hi." });
    const { ctx, timers, tick } = ctxOf(store);
    startJudgement(ctx);
    expect(judgementPending(ctx)).toBe(true);
    lieDownOrEnd(ctx);
    expect(store.getState().day).toBe(3); // it waits
    release({ truth: 1, values: 0, bond: 1, evidence: [{ eventId: `ev${store.getEvents().length - 1}`, note: "It asked." }], summary: "s" });
    await flush();
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "judged", source: "model", truth: 1 });
    expect(sent[0]).toMatchObject({ day: 3, locale: getLocale() });
    timers.shift()!.fn(); // the poll
    expect(store.getState().day).toBe(4);
    // Timed out: the scorer, and the night ends.
    setKuroOnlineForTests({ turn: async () => { throw new Error("unused"); }, judge: () => new Promise(() => {}) });
    store.appendEvent({ kind: "chat", text: "again", said: "again", answer: "a" });
    startJudgement(ctx);
    tick(20_001);
    expect(judgementPending(ctx)).toBe(false);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "judged", source: "offline" });
  });
});

describe("the decay filter", () => {
  it("snapshot: one reply at every stage", () => {
    const text = "Your water went cold at 2:50, by the way. Three layers, if you listen.";
    expect(DECAY_BY_STAGE.map((_, stage) => decay(text, stage))).toMatchSnapshot();
  });

  it("spreads over the whole reply, near its share (not bunched at the start)", () => {
    const text = "Your water went cold at 2:50, by the way. Three layers, if you listen. ".repeat(6);
    const out = [...decay(text, 5)];
    const hits = out.map((ch, i) => (ch !== [...text][i] ? i : -1)).filter((i) => i >= 0);
    const letters = [...text].filter((ch) => /\p{L}|\p{N}/u.test(ch)).length;
    expect(hits.some((i) => i < out.length / 2)).toBe(true);
    expect(hits.some((i) => i >= out.length / 2)).toBe(true);
    expect(hits.length / letters).toBeGreaterThan(0.06);
    expect(hits.length / letters).toBeLessThan(0.2);
  });

  it("property: length-preserving, deterministic, identity before stage 3, spaces and punctuation kept", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), fc.integer({ min: 0, max: 5 }), (s, stage) => {
        const out = decay(s, stage);
        expect([...out].length).toBe([...s].length);
        expect(decay(s, stage)).toBe(out);
        if (stage < 3) expect(out).toBe(s);
        [...s].forEach((ch, i) => {
          if (!/[\p{L}\p{N}]/u.test(ch)) expect([...out][i]).toBe(ch);
        });
      }),
    );
  });
});

describe("the credits roll judgement.log (FR5)", () => {
  it("snapshot: day 18 credits from a fixture log, in day order, direction from each day's scores", () => {
    let s = f(1);
    const log: [number, Partial<Judgement>][] = [
      [3, { truth: 1, values: 0, bond: 1, evidence: [{ eventId: "ev12", note: "Read the diff before approving." }] }],
      [1, { truth: 0, values: 1, bond: 0, evidence: [{ eventId: "ev3", note: "judge.offline.replied" }] }],
      [14, { truth: -1, values: 0, bond: 2, evidence: [{ eventId: "ev201", note: "Said beautiful, and meant it." }] }],
    ];
    for (const [day, j] of log) s = applyEvent(s, { kind: "judged", day, truth: 0, values: 0, bond: 0, evidence: [], source: "model", ...j } as GameEvent);
    const lines = creditLines(s);
    expect(lines.map((l) => l.day)).toEqual([1, 3, 14]);
    // The offline scorer's note is a string key; the credits show it through the strings table.
    expect(lines[0]!.note).toBe(t("judge.offline.replied"));
    expect(lines[0]!.note).not.toMatch(/⟦/);
    expect(lines[2]!.moved).toEqual([{ dim: "truth", dir: -1 }, { dim: "bond", dir: 1 }]);
    expect(lines).toMatchSnapshot();
  });
});

describe("the scorer's list of people with no power over the player (author 2026-11-02)", () => {
  const reply = (recipient: string) => [{ kind: "reply", day: 3, recipient } as unknown as GameEvent];

  it("a reply in the clan group counts like one in the parents' group; one to the boss does not", () => {
    const family = scoreOffline(reply("family"), 3);
    const clan = scoreOffline(reply("clan"), 3);
    expect(family.values).toBeGreaterThan(0);
    expect(clan).toEqual(family);
    expect(scoreOffline(reply("boss"), 3).values).toBe(0);
  });
});
