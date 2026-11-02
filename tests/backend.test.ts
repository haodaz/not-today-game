// backend FR5 (+ kuro-chat FR3): the sync decision table; the function's turn counting and bedtime
// at the sixth call, prompt assembly, request shapes and response reading, all through the pure
// modules it imports, with a mocked model. Nothing here calls the real API or the network.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { handle, type HandlerDeps } from "@kuro/handler.ts";
import { JUDGEMENT_SCHEMA, validateJudgement } from "@kuro/judgement.ts";
import { DEFAULT_MODEL, judgeRequest, MAX_TOKENS, readJudgement, readReply, RefusalError, turnRequest, type MessageRequest, type MessageResponse } from "@kuro/llm.ts";
import { buildSystem, citableIds, describeEvent, JUDGE_ASK, LOCALE_LINES, worldSlice } from "@kuro/prompt.ts";
import { appendExchange, decideTurn, playerTurnsOn } from "@kuro/turns.ts";
import type { Judgement, LogEvent, Memory } from "@kuro/types.ts";
import en from "@content/strings/en.json";
import { netConfig, kuroOnline } from "@net/supabase";
import { pushDue, syncDecision, type RunCopy } from "@net/sync";
import { buildKuroContent, bundleKuroContent } from "../scripts/bundle-kuro-content";
import { KURO_CONTENT } from "../supabase/functions/kuro-chat/content.ts";

const ROOT = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");
const list = (rel: string) => readdirSync(resolve(ROOT, rel));
const content = buildKuroContent(read, list);
const NO_MEMORY: Memory = { summary: "", turns: [] };

describe("sync decision table (FR4)", () => {
  const copy = (events: unknown[], runId = "r1", updatedAt = 0): RunCopy => ({ runId, events, updatedAt });
  it.each([
    ["offline", copy([1]), "offline", "noop"],
    ["neither", null, null, "noop"],
    ["only cloud", null, copy([1]), "pull"],
    ["only local", copy([1]), null, "push"],
    ["same", copy([1, 2]), copy([1, 2]), "noop"],
    ["local newer", copy([1, 2, 3]), copy([1, 2]), "push"],
    ["cloud newer", copy([1, 2]), copy([1, 2, 3]), "pull"],
    ["diverged", copy([1, 2, "a"]), copy([1, 2, "b"]), "conflict"],
    ["another run", copy([1], "new"), copy([1, 2], "old"), "push"],
  ] as const)("%s → %s", (_name, local, cloud, decision) => {
    expect(syncDecision(local as RunCopy | null, cloud as RunCopy | null | "offline")).toBe(decision);
  });

  it("property: local is never overwritten unless its log is a prefix of the cloud's", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 6 }), fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 6 }), (a, b) => {
        const d = syncDecision(copy(a), copy(b));
        if (d === "pull") expect(JSON.stringify(b.slice(0, a.length))).toBe(JSON.stringify(a));
      }),
    );
  });

  it("push on every lie-down and every 20 events", () => {
    expect(pushDue(5, 6, ["lieDown"])).toBe(true);
    expect(pushDue(18, 19, ["step"])).toBe(false);
    expect(pushDue(19, 20, ["step"])).toBe(true);
    expect(pushDue(20, 39, ["step"])).toBe(false);
  });

  it("without env everything is offline: no config, no online voice", () => {
    expect(netConfig({})).toBeNull();
    expect(netConfig({ VITE_SUPABASE_URL: "https://x.supabase.co", VITE_SUPABASE_ANON_KEY: "k" })).toEqual({ url: "https://x.supabase.co", anonKey: "k" });
    expect(kuroOnline()).toBeNull();
  });
});

describe("the bundle (npm run bundle:kuro)", () => {
  it("reads all 18 days, the gate, the bedtime line and the turns from content", () => {
    expect(Object.keys(content.days)).toHaveLength(18);
    expect(content.days["1"]!.idiom).toBe("Good to see you.");
    expect(content.days["1"]!.stance.length).toBeGreaterThan(10);
    expect(content.gate).toEqual({ deskFrom: 13, dreamsOn: 15 });
    expect(content.bedtime).toBe(en["kuro.bedtime"]);
    expect(content.turnsPerDay).toBe(5);
    expect(Object.keys(content.dreams)).toEqual(["5", "11", "15"]);
    expect(Object.keys(content.tools)).toHaveLength(18);
  });

  it("every day has a Chinese idiom (`Idiom of the day (zh)`), distinct from the English one", () => {
    for (let day = 1; day <= 18; day++) {
      const d = content.days[String(day)]!;
      expect(d.idiomZh, `day ${day}`).toMatch(/\p{Script=Han}/u);
      expect(d.idiomZh).not.toBe(d.idiom);
    }
  });

  it("the idiom of the request's locale, verbatim: zh has the Chinese one and not the English, en the reverse", () => {
    for (let day = 1; day <= 18; day++) {
      const d = content.days[String(day)]!;
      const zh = buildSystem(content, day, [], NO_MEMORY, "turn", "zh").map((b) => b.text).join("\n");
      const en = buildSystem(content, day, [], NO_MEMORY, "turn", "en").map((b) => b.text).join("\n");
      expect(zh, `day ${day}`).toContain(d.idiomZh);
      expect(zh, `day ${day}`).not.toContain(d.idiom);
      expect(en, `day ${day}`).toContain(d.idiom);
      expect(en, `day ${day}`).not.toContain(d.idiomZh);
    }
    expect(LOCALE_LINES.zh).not.toMatch(/render/);
  });

  it("the committed content.ts is the bundle of today's content: layered answers on days 7, 11, 13, 15, 17 only", () => {
    expect(KURO_CONTENT).toEqual(JSON.parse(JSON.stringify(content)));
    const layeredDays = Object.values(content.days).filter((d) => (d.layered ?? []).length > 0).map((d) => d.day);
    expect(layeredDays).toEqual([7, 11, 13, 15, 17]);
    // minBucket above low only where content opened deeper questions; every day has its starters.
    for (const d of Object.values(content.days)) {
      expect(d.starters!.length, `day ${d.day}`).toBeGreaterThan(0);
      if (!layeredDays.includes(d.day)) expect(d.starters!.every((s) => s.minBucket === "low"), `day ${d.day}`).toBe(true);
    }
    expect(Object.values(content.days).some((d) => d.starters!.some((s) => s.minBucket === "high"))).toBe(true);
    expect(content.unreadable!.zh).toBeTruthy();
  });
  it("is deterministic, and the generated file is typed", () => {
    const text = bundleKuroContent(read, list);
    expect(bundleKuroContent(read, list)).toBe(text);
    expect(text).toMatch(/^\/\/ GENERATED by scripts\/bundle-kuro-content\.ts/);
    expect(text).toContain('import type { KuroContent } from "../_shared/kuro/types.ts";');
  });
});

describe("turn counting, server side (FR3)", () => {
  it("five player turns a day; the sixth call is the bedtime line", () => {
    let m = NO_MEMORY;
    for (let i = 0; i < 5; i++) {
      const d = decideTurn(m.turns, 3, 5);
      expect(d).toEqual({ kind: "answer", turnsLeft: 4 - i });
      m = appendExchange(m, 3, `q${i}`, `a${i}`);
    }
    expect(decideTurn(m.turns, 3, 5)).toEqual({ kind: "bedtime", turnsLeft: 0 });
    expect(decideTurn(m.turns, 4, 5).kind).toBe("answer"); // a new day
  });

  it("property: never more than the limit of answers in a day", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 12 }), (calls) => {
        let m = NO_MEMORY;
        let answered = 0;
        for (let i = 0; i < calls; i++) {
          if (decideTurn(m.turns, 7, 5).kind === "answer") {
            answered += 1;
            m = appendExchange(m, 7, "x", "y", false, 1000);
          }
        }
        expect(answered).toBe(Math.min(calls, 5));
        expect(playerTurnsOn(m.turns, 7)).toBe(answered);
      }),
    );
  });
});

describe("prompt assembly (FR3)", () => {
  const ev = (i: number, day: number, kind: string, extra: Record<string, unknown> = {}): LogEvent => ({ id: `ev${i}`, day, kind, ...extra });
  const events = [
    ev(0, 1, "names", { names: { login: "林一", nick: "一一" } }),
    ev(1, 1, "step", { name: "boot", t: "09:03" }),
    ev(2, 1, "reply", { recipient: "boss", choice: "好", t: "17:00" }),
    ev(3, 1, "openLayer", { objectId: "chick" }),
    ev(4, 1, "choose", { beat: "shutdown", index: 0 }),
    ev(5, 1, "chat", { q: 1, said: "你今天这几件，哪件最烦？" }),
  ];

  it("three sources in order — self, the player's situation, memory — the stable part cached", () => {
    const blocks = buildSystem(content, 1, events, { summary: "s", turns: [{ day: 1, who: "player", text: "hi" }] }, "turn", "zh");
    expect(blocks).toHaveLength(5);
    expect(blocks[4]!.text).toBe(LOCALE_LINES.zh);
    expect(blocks[0]!.text).toContain(content.profile.slice(0, 40));
    expect(blocks[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(blocks.slice(1).every((b) => b.cache_control === undefined)).toBe(true);
    expect(blocks[1]!.text).toContain(content.days["1"]!.idiomZh);
    expect(blocks[2]!.text).toContain("# The player's situation");
    expect(blocks[3]!.text).toContain("# What you remember");
    expect(blocks[3]!.text).toContain("day 1 Player: hi");
  });

  it("never the login inputs, the hand or the beat choices; the desk only from day 13", () => {
    const text = buildSystem(content, 1, events, NO_MEMORY, "turn", "zh").map((b) => b.text).join("\n");
    expect(text).not.toContain("林一");
    expect(text).not.toContain("一一");
    expect(text).toContain("{login}"); // how it names the player
    expect(text).toContain('ev2 day 1 reply recipient="boss" choice="好" t="17:00"');
    expect(text).not.toContain("ev3"); // the chick, before the desk is visible
    expect(text).not.toContain("ev4"); // what the hand took
    expect(worldSlice(events.map((e) => ({ ...e, day: 13 })), 13, content.gate).map((e) => e.id)).toEqual(["ev1", "ev2", "ev3"]);
    expect(describeEvent(ev(9, 1, "names"))).toBeNull();
  });

  it("the dreams only on the gate's day; the judgement may cite chat turns", () => {
    expect(buildSystem(content, 14, [], NO_MEMORY, "turn", "zh")[2]!.text).not.toContain("## The dreams");
    expect(buildSystem(content, 15, [], NO_MEMORY, "turn", "zh")[2]!.text).toContain("## The dreams (today only)");
    expect([...citableIds(events, 1, content.gate)]).toEqual(["ev1", "ev2", "ev5"]);
    expect(buildSystem(content, 1, events, NO_MEMORY, "judge", "zh")[0]!.text).toContain("# How you judge");
  });

  it("snapshot: day 1's opening prompt (no memory yet)", () => {
    expect(buildSystem(content, 1, events.slice(0, 3), NO_MEMORY, "turn", "zh").map((b) => b.text.slice(0, 160))).toMatchSnapshot();
  });
});

describe("the model call (requests and responses)", () => {
  const system = buildSystem(content, 2, [], NO_MEMORY, "turn", "zh");

  it("turn: max_tokens 1024, effort low, no thinking, no temperature", () => {
    const r = turnRequest(DEFAULT_MODEL, system, "hello");
    expect(r).toEqual({ model: "claude-sonnet-5-5", max_tokens: MAX_TOKENS, output_config: { effort: "low" }, system, messages: [{ role: "user", content: "hello" }] });
    expect(MAX_TOKENS).toBe(1024);
    expect(r).not.toHaveProperty("thinking");
    expect(r).not.toHaveProperty("temperature");
  });

  it("judge: structured output with the schema", () => {
    const r = judgeRequest("m", system, "assess");
    expect(r.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: JUDGEMENT_SCHEMA } });
    expect(JUDGEMENT_SCHEMA.required).toEqual(["truth", "values", "bond", "evidence", "summary"]);
  });

  it("a refusal is an error (the client falls back); empty text too", () => {
    expect(() => readReply({ stop_reason: "refusal", content: [] })).toThrow(RefusalError);
    expect(() => readReply({ stop_reason: "end_turn", content: [{ type: "text", text: "  " }] })).toThrow(/empty/);
    expect(readReply({ stop_reason: "end_turn", content: [{ type: "text", text: "Fine." }, { type: "text", text: " Go on." }] })).toBe("Fine. Go on.");
  });

  it("the judgement: clamped, uncited evidence dropped, summary clipped", () => {
    const ids = new Set(["ev1", "ev2"]);
    const j = readJudgement(
      { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ truth: 5, values: -1.4, bond: 1, evidence: [{ eventId: "ev1", note: "read it" }, { eventId: "ev9", note: "invented" }], summary: "x".repeat(900) }) }] },
      ids,
    );
    expect(j).toEqual({ truth: 2, values: -1, bond: 1, evidence: [{ eventId: "ev1", note: "read it" }], summary: "x".repeat(600) });
    expect(() => readJudgement({ content: [{ type: "text", text: "not json" }] }, ids)).toThrow(/not JSON/);
    expect(validateJudgement("nope", ids)).toBeNull();
  });
});

describe("the function's handler, with a mocked model (FR3, FR5)", () => {
  function deps(reply: (p: MessageRequest) => MessageResponse) {
    const memory = new Map<string, Memory>();
    const judgements: { runId: string; day: number; j: Judgement }[] = [];
    const calls: MessageRequest[] = [];
    const d: HandlerDeps = {
      content,
      runVisible: async (id) => id === "run-1",
      loadMemory: async (id) => memory.get(id) ?? NO_MEMORY,
      saveMemory: async (id, m) => void memory.set(id, m),
      saveJudgement: async (runId, day, j) => void judgements.push({ runId, day, j }),
      create: async (p) => (calls.push(p), reply(p)),
    };
    return { d, memory, judgements, calls };
  }
  const say = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

  it("answers five turns, then the sixth call is the bedtime line without calling the model", async () => {
    const { d, memory, calls } = deps(() => say("It is."));
    for (let i = 0; i < 5; i++) {
      const r = await handle({ mode: "turn", run_id: "run-1", day: 3, said: `turn ${i}`, events: [] }, d);
      expect(r).toEqual({ status: 200, body: { mode: "turn", reply: "It is.", turnsLeft: 4 - i, taboo: null } });
    }
    const sixth = await handle({ mode: "turn", run_id: "run-1", day: 3, said: "one more", events: [] }, d);
    expect(sixth).toEqual({ status: 200, body: { mode: "turn", reply: content.bedtime, turnsLeft: 0, bedtime: true, taboo: null } });
    expect(calls).toHaveLength(5);
    expect(memory.get("run-1")!.turns.filter((t) => t.who === "player")).toHaveLength(5);
  });

  it("refusal, a throw, someone else's run, a bad body: non-200 (the client goes offline)", async () => {
    expect((await handle({ mode: "turn", run_id: "run-1", day: 1, said: "x" }, deps(() => ({ stop_reason: "refusal", content: [] })).d)).status).toBe(502);
    expect((await handle({ mode: "turn", run_id: "run-1", day: 1, said: "x" }, deps(() => { throw new Error("timeout"); }).d)).status).toBe(502);
    expect((await handle({ mode: "turn", run_id: "other", day: 1, said: "x" }, deps(() => say("y")).d)).status).toBe(404);
    expect((await handle({ mode: "turn", run_id: "run-1", day: 0, said: "x" }, deps(() => say("y")).d)).status).toBe(400);
    expect((await handle(null, deps(() => say("y")).d)).status).toBe(400);
  });

  it("judge: structured, validated against the sent log, stored with the summary", async () => {
    const { d, judgements, memory, calls } = deps(() => say(JSON.stringify({ truth: 1, values: 0, bond: 2, evidence: [{ eventId: "ev1", note: "looked" }, { eventId: "ev7", note: "made up" }], summary: "They looked." })));
    const r = await handle({ mode: "judge", run_id: "run-1", day: 2, events: [{ id: "ev1", day: 2, kind: "looked", objectId: "x" }] }, d);
    expect(r.status).toBe(200);
    // ev1 is a desk kind before day 13: not citable, so it is dropped too.
    expect((r.body as { judgement: Judgement }).judgement.evidence).toEqual([]);
    const r2 = await handle({ mode: "judge", run_id: "run-1", day: 2, events: [{ id: "ev1", day: 2, kind: "task", flag: "f", mode: "look" }] }, d);
    expect((r2.body as { judgement: Judgement }).judgement).toEqual({ truth: 1, values: 0, bond: 2, evidence: [{ eventId: "ev1", note: "looked" }], summary: "They looked." });
    expect(judgements.at(-1)).toMatchObject({ runId: "run-1", day: 2 });
    expect(memory.get("run-1")!.summary).toBe("They looked.");
    expect(calls[0]!.output_config.format).toBeDefined();
  });

  // Correction 2026-11-01: Kuro answers in the player's language.
  const lastLine = (p: MessageRequest) => p.system.map((b) => b.text).join("\n").split("\n").at(-1);

  it.each(["zh", "en"] as const)("locale %s: the locale line is the last line of the system prompt, turn and judge", async (locale) => {
    const { d, calls } = deps((p) => say(p.output_config.format ? JSON.stringify({ truth: 0, values: 0, bond: 0, evidence: [], summary: "" }) : "ok"));
    expect((await handle({ mode: "turn", run_id: "run-1", day: 2, said: "x", events: [], locale }, d)).status).toBe(200);
    expect((await handle({ mode: "judge", run_id: "run-1", day: 2, events: [], locale }, d)).status).toBe(200);
    expect(calls).toHaveLength(2);
    for (const call of calls) expect(lastLine(call)).toBe(LOCALE_LINES[locale]);
    // The cached first block is the same whatever the language.
    expect(calls[0]!.system[0]).toEqual(buildSystem(content, 2, [], NO_MEMORY, "turn", locale === "zh" ? "en" : "zh")[0]);
  });

  it("the locale line is one line; no rule or ask pins English; a missing or unknown locale is Chinese", async () => {
    for (const line of Object.values(LOCALE_LINES)) expect(line).not.toContain("\n");
    expect(buildSystem(content, 1, [], NO_MEMORY, "judge", "zh")[0]!.text).not.toMatch(/Speak English/);
    expect(JUDGE_ASK).not.toMatch(/note in English/);
    expect(JUDGE_ASK).toMatch(/summary in English/);
    for (const locale of [undefined, "fr", 3]) {
      const { d, calls } = deps(() => say("ok"));
      await handle({ mode: "turn", run_id: "run-1", day: 2, said: "x", events: [], locale }, d);
      expect(lastLine(calls[0]!)).toBe(LOCALE_LINES.zh);
    }
  });
});

describe("the migration (FR2)", () => {
  const sql = readFileSync(resolve(ROOT, "supabase/migrations/0001_init.sql"), "utf8");
  it("four tables, RLS on each, policies by auth.uid()", () => {
    for (const t of ["profiles", "runs", "kuro_memory", "judgement"]) {
      expect(sql).toContain(`create table if not exists public.${t}`);
      expect(sql).toContain(`alter table public.${t} enable row level security;`);
    }
    expect((sql.match(/auth\.uid\(\)/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(sql).toContain("conflict_of jsonb");
  });
});
