// kuro-chat taboo addition 2026-11-02, client side, with a mocked function: each of the four
// consequences from a reply with the field; the flicker leaves no history and no memory turn but
// spends the turn; one taboo per day; no taboo without the field. Also: the starters the bucket
// allows, and the starter's number sent with the turn.
import { afterEach, describe, expect, it } from "vitest";
import type { Taboo } from "@kuro/types.ts";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { kuroDay, parseKuroDay } from "@world/desktop/kuro/days";
import { initialSession } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { historyEntries } from "@world/dialogue/history";
import { bucketNow, playerBox } from "@world/dialogue/kuro";
import { BLUR_MS, bleedingToday, ERRORS, errorCount, errorDialogs, tabooLayer } from "@world/dialogue/taboo";
import { hasString, keysWith, setLocale, t } from "@world/i18n";
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
function ctxOf(store: Store) {
  const timers: { ms: number; fn: () => void }[] = [];
  let now = 1_000;
  const ctx: ActionContext = { store, session: initialSession(NIGHT, "left", "room"), rerender: () => {}, later: (ms, fn) => void timers.push({ ms, fn }), now: () => now };
  const run = () => timers.splice(0).forEach((x) => x.fn());
  return { ctx, timers, run, tick: (ms: number) => (now += ms), now: () => now };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const talk = (ctx: ActionContext) => {
  act(ctx, "kuro-call");
  act(ctx, "loop-choice", { index: "0", choice: "yes" });
};
const box = (ctx: ActionContext) => dialogueBox(ctx.store.getState(), ctx.store.getEvents(), ctx.session)?.value ?? "";
const flush = () => new Promise((r) => setTimeout(r, 0));
const REPLY = "That is all I can say.";

function mock(taboo: Taboo | null | undefined, reply = REPLY) {
  const bodies: Record<string, unknown>[] = [];
  const online: KuroOnline = {
    turn: async (b) => (bodies.push(b as never), { mode: "turn", reply, turnsLeft: 4, ...(taboo !== undefined ? { taboo } : {}) }),
    judge: async () => ({ mode: "judge", judgement: { truth: 0, values: 0, bond: 0, evidence: [] } }),
  };
  setKuroOnlineForTests(online);
  return bodies;
}
async function askOnce(day: number, taboo: Taboo | null | undefined, q = "1") {
  const bodies = mock(taboo);
  const store = storeAt(day);
  const h = ctxOf(store);
  talk(h.ctx);
  act(h.ctx, "kuro-q", { q });
  await flush();
  return { store, bodies, ...h };
}
const chats = (store: Store) => store.getEvents().filter((e) => e.kind === "chat");

describe("the turn carries the starter's number", () => {
  it("a picked starter sends q; typed text does not", async () => {
    const { bodies } = await askOnce(3, null);
    expect(bodies[0]).toMatchObject({ q: 1 });
  });
});

describe("the four consequences", () => {
  it("no taboo without the field (null, or a function that sends none)", async () => {
    for (const taboo of [null, undefined]) {
      const { store, ctx } = await askOnce(3, taboo);
      expect(chats(store)[0]!.taboo).toBeUndefined();
      expect(store.getState().san).toBe(createStore({ startDay: 1 }).getState().san);
      expect(tabooLayer(ctx.session, store.getRunId(), 3, 2_000)).toBeNull();
    }
  });

  it("blood: the reply shows, then the narration line (when strings have it); the hand bleeds for the day; SAN −1", async () => {
    const before = storeAt(3).getState().san;
    const { store, ctx } = await askOnce(3, "blood");
    expect(store.getState().san).toBe(before - 1);
    expect(chats(store)[0]).toMatchObject({ taboo: "blood" });
    expect(bleedingToday(store.getEvents(), 3)).toBe(true);
    const head = ctx.session.dialogue.queue[0]!;
    expect(head.lines[0]!.t).toBe(REPLY);
    if (hasString("kuro.taboo.blood")) expect(head.lines[1]).toEqual({ k: "narration", t: t("kuro.taboo.blood") });
    else expect(head.lines).toHaveLength(1);
    // The next day the hand is clean again.
    store.appendEvent({ kind: "lieDown" });
    expect(bleedingToday(store.getEvents(), store.getState().day)).toBe(false);
  });

  it("blur: 20 s on the stage (under the box), then clears; the next turn is allowed", async () => {
    const { store, ctx, now } = await askOnce(3, "blur");
    const at = now();
    expect(tabooLayer(ctx.session, store.getRunId(), 3, at)!.value).toContain('class="taboo-blur"');
    expect(tabooLayer(ctx.session, store.getRunId(), 3, at + BLUR_MS - 1)!.value).toContain("taboo-blur");
    expect(tabooLayer(ctx.session, store.getRunId(), 3, at + BLUR_MS)).toBeNull();
    // playtest-1105 R6: the reply read on, the same box is the player's turn.
    act(ctx, "loop-advance");
    expect(playerBox(store.getState(), store.getEvents(), ctx.session)).not.toBeNull();
  });

  it("flicker: one white frame; no reply shown, no history, no memory; the turn is spent", async () => {
    const { store, ctx, now } = await askOnce(3, "flicker");
    const said = kuroDay(3)!.starters[0]!.zh;
    expect(chats(store)).toEqual([expect.objectContaining({ kind: "chat", q: 1, forgotten: true, taboo: "flicker", answer: "" })]);
    expect(store.getState().chatTurnsToday).toBe(1);
    expect(store.getState().chatMemory.recent).toEqual([]);
    expect(box(ctx)).not.toContain(REPLY);
    expect(JSON.stringify(historyEntries(ctx.session, store.getState()))).not.toContain(said);
    expect(JSON.stringify(historyEntries(ctx.session, store.getState()))).not.toContain(REPLY);
    expect(tabooLayer(ctx.session, store.getRunId(), 3, now())!.value).toContain('class="taboo-flash"');
    expect(tabooLayer(ctx.session, store.getRunId(), 3, now() + 20)).toBeNull();
    // What it said before the question is back, and the player's box with it (four turns left).
    expect(box(ctx)).toContain(kuroDay(3)!.idiom);
  });

  it("errors: the reply shows, then 8–20 seeded dialogs, each needing a click; the chat is closed for the day", async () => {
    const { store, ctx, run } = await askOnce(3, "errors");
    expect(box(ctx)).toContain(REPLY);
    run(); // the cascade follows the reply
    const n = errorCount(store.getRunId(), 3);
    expect(n).toBeGreaterThanOrEqual(ERRORS[0]);
    expect(n).toBeLessThanOrEqual(ERRORS[1]);
    expect(errorCount(store.getRunId(), 3)).toBe(n);
    const layer = () => tabooLayer(ctx.session, store.getRunId(), 3, 0)?.value ?? "";
    expect(layer().match(/class="err-dlg"/g)).toHaveLength(n);
    const titles = errorDialogs(store.getRunId(), 3).map((d) => d.title);
    if (keysWith("error.").length) for (const title of titles) expect(keysWith("error.").map((k) => t(k))).toContain(title);
    else expect(titles.every((x) => x === null)).toBe(true);
    for (let i = 0; i < n; i++) act(ctx, "taboo-error-ok");
    expect(layer()).toBe("");
    // Closed for the rest of the day: no player's box; asking again gives the bedtime line.
    expect(playerBox(store.getState(), store.getEvents(), ctx.session)).toBeNull();
    act(ctx, "loop-advance");
    talk(ctx);
    expect(playerBox(store.getState(), store.getEvents(), ctx.session)).toBeNull();
  });

  it("one taboo per day: a second taboo the same day plays nothing", async () => {
    const bodiesFirst = mock("blur");
    const store = storeAt(3);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    await flush();
    expect(bodiesFirst).toHaveLength(1);
    mock("blood");
    const san = store.getState().san;
    act(ctx, "kuro-q", { q: "2" });
    await flush();
    expect(chats(store).map((e) => e.taboo)).toEqual(["blur", undefined]);
    expect(store.getState().san).toBe(san);
  });

  it("an offline answer never carries a taboo", async () => {
    setKuroOnlineForTests(undefined);
    const store = storeAt(3);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "kuro-q", { q: "1" });
    expect(chats(store)[0]!.taboo).toBeUndefined();
  });
});

describe("affinity opens questions", () => {
  const md = (min: string) => `# Day 3\n**Idiom of the day (constant):** Hi.\n## Starter questions\n| # | zh | en | hard | minBucket |\n|---|---|---|---|---|\n| 1 | 一 | one |  |  |\n| 2 | 二 | two |  | ${min} |\n`;
  it("the client's parser reads minBucket; a file without it is all low", () => {
    expect(parseKuroDay(md("high"), "t").starters.map((s) => s.minBucket)).toEqual(["low", "high"]);
    expect(parseKuroDay(md(""), "t").starters.map((s) => s.minBucket)).toEqual(["low", "low"]);
    for (const d of [1, 14, 18]) expect(kuroDay(d)!.starters.every((s) => ["low", "mid", "high"].includes(s.minBucket))).toBe(true);
  });

  it("the player's box offers only the starters the current bucket allows (from state.affinity, as the ending reads it)", () => {
    const store = storeAt(3);
    const { ctx } = ctxOf(store);
    talk(ctx);
    act(ctx, "loop-advance"); // playtest-1105 R6: its line read on, the player's turn
    const s = store.getState();
    expect(bucketNow(s)).toBe("low");
    expect(bucketNow({ ...s, affinity: 30 })).toBe("mid");
    expect(bucketNow({ ...s, affinity: constants.affinityThreshold as number })).toBe("high");
    const all = kuroDay(3)!.starters.filter((x) => x.minBucket === "low").length;
    expect(playerBox(s, store.getEvents(), ctx.session)!.options.filter((o) => o.action === "kuro-q")).toHaveLength(all);
  });
});
