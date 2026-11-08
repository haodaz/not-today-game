// kuro-chat additions 2026-11-02, server side, with a mocked model: the affinity bucket in the
// "Today" block, starters opened by minBucket, locked answers enforced in code, the seeded d100 with
// thresholds that move with the bucket, the server-made unreadable word on 大成功, the forgotten
// turn on 大失败, one taboo per day. Nothing here calls the real API.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseLayered, parseStarters, parseVariableParts } from "@kuro/dayfile.ts";
import { handle, type HandlerDeps } from "@kuro/handler.ts";
import type { MessageRequest, MessageResponse } from "@kuro/llm.ts";
import { buildSystem } from "@kuro/prompt.ts";
import { decideTurn } from "@kuro/turns.ts";
import type { Bucket, KuroContent, Memory, StoredJudgement } from "@kuro/types.ts";
import { affinityFrom, bucketOf, d100, dice, GLYPH_SCRIPTS, glyphWord, outcomeOf, THRESHOLDS, variableLayer, type LayerInput } from "@kuro/variable.ts";
import { buildKuroContent } from "../scripts/bundle-kuro-content";

const ROOT = resolve(__dirname, "..");
const real = buildKuroContent((rel) => readFileSync(resolve(ROOT, rel), "utf8"), (rel) => readdirSync(resolve(ROOT, rel)));
const NO_MEMORY: Memory = { summary: "", turns: [] };

/** Day 3 with a layered answer on q1 (taboo on high), a red-blue line on q2, and q4 open only to high. */
const LOW = "低：只是一个词。";
const MID = "中：那个词我也说不好。";
const HIGH = "High: the word is under the floor.";
const content: KuroContent = {
  ...real,
  unreadable: { zh: "（跟随行）", en: "(follow-up)" },
  days: {
    ...real.days,
    "3": {
      ...real.days["3"]!,
      starters: [
        { n: 1, zh: "那是什么词？", en: "What word is that?", hard: false, minBucket: "low" },
        { n: 2, zh: "谁批的？", en: "Who approved it?", hard: false, minBucket: "low" },
        { n: 3, zh: "雨停了吗", en: "Has the rain stopped", hard: false, minBucket: "low" },
        { n: 4, zh: "你从哪儿来？", en: "Where do you come from?", hard: true, minBucket: "high" },
      ],
      locked: [{ unlock: 2, text: "Nobody. The others approve." }],
      layered: [
        { unlock: 1, low: LOW, mid: MID, high: HIGH, taboo: "errors" },
        { unlock: 4, low: "L4", mid: "M4", high: "H4" },
      ],
    },
  },
};

/** Stored judgement rows that fold to exactly `affinity` (one row with that delta). */
const rowsFor = (affinity: number): StoredJudgement[] => (affinity === 0 ? [] : [{ day: 1, truth: 0, values: 0, bond: 0, delta: affinity }]);

function deps(reply: (p: MessageRequest) => MessageResponse, affinity = 0, memory = new Map<string, Memory>()) {
  const calls: MessageRequest[] = [];
  const d: HandlerDeps = {
    content,
    runVisible: async () => true,
    loadMemory: async (id) => memory.get(id) ?? NO_MEMORY,
    saveMemory: async (id, m) => void memory.set(id, m),
    saveJudgement: async () => {},
    loadJudgements: async () => rowsFor(affinity),
    create: async (p) => (calls.push(p), reply(p)),
  };
  return { d, calls, memory };
}
const say = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });
const systemText = (p: MessageRequest) => p.system.map((b) => b.text).join("\n");
const AFF: Record<Bucket, number> = { low: 0, mid: 40, high: 80 };

/** A run id whose d100 for (day 3, q) gives `outcome` in `bucket` (searched; the roll is seeded). */
function runWith(bucket: Bucket, outcome: "success" | "failure" | "plain", q = 1): string {
  for (let i = 0; i < 20000; i++) {
    const id = `run-${i}`;
    if (outcomeOf(d100(id, 3, q), bucket) === outcome) return id;
  }
  throw new Error(`no run gives ${outcome} at ${bucket}`);
}
const turn = (d: HandlerDeps, runId: string, extra: Record<string, unknown>) => handle({ mode: "turn", run_id: runId, day: 3, events: [], locale: "zh", ...extra }, d);
type TurnBody = { reply: string; taboo: string | null; turnsLeft: number };

describe("the bucket (scores)", () => {
  it.each([
    [0, "low"],
    [29, "low"],
    [30, "mid"],
    [59, "mid"],
    [60, "high"],
    [100, "high"],
  ] as const)("stored affinity %i → the Today block says %s", async (affinity, bucket) => {
    const { d, calls } = deps(() => say("ok"), affinity);
    await turn(d, "run-x", { said: "随便说说" });
    const today = calls[0]!.system[1]!.text;
    expect(today).toContain(`Your opinion of this player: ${bucket}`);
    expect(bucketOf(affinity)).toBe(bucket);
  });

  it("folds the stored judgements as the client does: day order, the delta if stored, the tender multiplier, clamped each step", () => {
    const a = real.affinity!;
    expect(a.threshold).toBe(60);
    expect(affinityFrom([{ day: 2, truth: 2, values: 2, bond: 2, delta: null }, { day: 1, truth: -2, values: -2, bond: -2 }], a)).toBe(6 * a.perPoint);
    const tender = a.tenderDays[0]!;
    expect(affinityFrom([{ day: tender, truth: 1, values: 0, bond: 0 }], a)).toBe(a.perPoint * a.tenderMultiplier);
    expect(affinityFrom([{ day: 1, truth: 0, values: 0, bond: 0, delta: 500 }], a)).toBe(100);
  });
});

describe("dice", () => {
  it("stable per seed; the model never sees the seed; a new run differs somewhere", () => {
    expect(dice("r1", 3)).toEqual(dice("r1", 3));
    const moods = new Set(Array.from({ length: 40 }, (_, i) => dice(`r${i}`, 3).mood));
    expect([...moods].every((m) => m >= 0 && m <= 3)).toBe(true);
    expect(moods.size).toBeGreaterThan(1);
    const sys = buildSystem(content, 3, [], NO_MEMORY, "turn", "zh", variableLayer({ content, day: 3, locale: "zh", runId: "secret-run", memory: NO_MEMORY, affinity: 0, q: null, said: "x" }));
    const text = sys.map((b) => b.text).join("\n");
    expect(text).not.toContain("secret-run");
    expect(text).toMatch(/Mood notch today: [0-3] of 3/);
    expect(text).toMatch(/Free line today: (yes|no)/);
  });

  it("the object is pure from its input", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 0, max: 100 }), fc.option(fc.integer({ min: 1, max: 4 }), { nil: null }), (runId, affinity, q) => {
        const input: LayerInput = { content, day: 3, locale: "zh", runId, memory: NO_MEMORY, affinity, q, said: "那是什么词？" };
        expect(variableLayer(input)).toEqual(variableLayer(input));
      }),
      { numRuns: 100 },
    );
  });
});

describe("the d100 and the moving thresholds", () => {
  it("the thresholds per bucket", () => {
    expect(THRESHOLDS).toEqual({ low: { success: 1, failFrom: 85 }, mid: { success: 3, failFrom: 96 }, high: { success: 8, failFrom: 100 } });
    for (let r = 1; r <= 100; r++) {
      expect(outcomeOf(r, "low")).toBe(r === 1 ? "success" : r >= 85 ? "failure" : "plain");
      expect(outcomeOf(r, "mid")).toBe(r <= 3 ? "success" : r >= 96 ? "failure" : "plain");
      expect(outcomeOf(r, "high")).toBe(r <= 8 ? "success" : r === 100 ? "failure" : "plain");
    }
  });

  it("the roll is stable per (seed, day, question), in 1..100", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 18 }), fc.integer({ min: 1, max: 6 }), (runId, day, q) => {
        const r = d100(runId, day, q);
        expect(r).toBe(d100(runId, day, q));
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(100);
      }),
    );
  });

  it("a 大成功 and a 大失败 can both still happen at high", () => {
    expect(runWith("high", "success")).toBeTruthy();
    expect(runWith("high", "failure")).toBeTruthy();
  });
});

describe("locked answers, enforced in code", () => {
  it.each(["low", "mid", "high"] as const)("%s: the layered answer for the bucket comes first, verbatim, whatever the model wrote", async (bucket) => {
    const expected = { low: LOW, mid: MID, high: HIGH }[bucket];
    const runId = runWith(bucket, "plain");
    // The model writes something else entirely: the locked text alone.
    const off = deps(() => say("我换个说法。"), AFF[bucket]);
    const r1 = (await turn(off.d, runId, { said: "那是什么词？", q: 1 })).body as TurnBody;
    expect(r1.reply).toBe(expected);
    expect(systemText(off.calls[0]!)).toContain(`«${expected}»`);
    // The model begins with it and continues: kept, after the verbatim text.
    const on = deps(() => say(`${expected} 就这些。`), AFF[bucket]);
    const r2 = (await turn(on.d, runId, { said: "那是什么词？", q: 1 })).body as TurnBody;
    expect(r2.reply.startsWith(expected)).toBe(true);
    expect(r2.reply).toContain("就这些。");
    // An altered version (one character changed) is replaced.
    const alt = deps(() => say(`${expected.slice(0, -1)}!`), AFF[bucket]);
    expect(((await turn(alt.d, runId, { said: "那是什么词？", q: 1 })).body as TurnBody).reply).toBe(expected);
    // No taboo without the field: only the high tier carries this one.
    expect(r1.taboo).toBe(bucket === "high" ? "errors" : null);
  });

  it("property: locked text survives any model output", async () => {
    const runId = runWith("mid", "plain");
    await fc.assert(
      fc.asyncProperty(fc.string(), async (out) => {
        const { d } = deps(() => say(out || " "), AFF.mid);
        const r = (await turn(d, runId, { said: "x", q: 1 })).body as TurnBody;
        expect(r.reply.startsWith(MID)).toBe(true);
      }),
      { numRuns: 60 },
    );
  });

  it("a red-blue line is locked too, and never rolls", async () => {
    const { d } = deps(() => say("whatever"), AFF.low);
    const r = (await turn(d, "any-run", { said: "谁批的？", q: 2 })).body as TurnBody;
    expect(r.reply).toBe("Nobody. The others approve.");
    expect(r.taboo).toBeNull();
    expect(variableLayer({ content, day: 3, locale: "zh", runId: "any-run", memory: NO_MEMORY, affinity: 0, q: 2, said: "" }).roll).toBeNull();
  });

  it("starters filtered per bucket: a closed starter (picked or typed) gets a free reply, not the locked line", async () => {
    for (const extra of [{ said: "你从哪儿来？", q: 4 }, { said: "你从哪儿来" }, { said: "Where do you come from?" }]) {
      const low = deps(() => say("free words"), AFF.low);
      const r = (await turn(low.d, runWith("low", "plain", 4), extra)).body as TurnBody;
      expect(r.reply, JSON.stringify(extra)).toBe("free words");
      expect(systemText(low.calls[0]!)).not.toContain("Locked line for this turn");
    }
    // Open at high: typed text matches too.
    const high = deps(() => say("x"), AFF.high);
    const r = (await turn(high.d, runWith("high", "plain", 4), { said: "你从哪儿来" })).body as TurnBody;
    expect(r.reply).toBe("H4");
  });
});

describe("大成功 and 大失败", () => {
  it("大成功: the locked text, the server's word on its own line, the locked follow-up; blood; the model never sees the word", async () => {
    const runId = runWith("high", "success");
    const memory = new Map<string, Memory>();
    const { d, calls } = deps(() => say(`${HIGH} And that's all.`), AFF.high, memory);
    const r = (await turn(d, runId, { said: "那是什么词？", q: 1 })).body as TurnBody;
    const lines = r.reply.split("\n");
    expect(lines[0]).toBe(HIGH);
    const word = glyphWord(runId, 3, 1);
    expect(lines[1]).toBe(word);
    expect(lines[2]).toBe("（跟随行）");
    expect(r.reply).toContain("And that's all.");
    expect(r.taboo).toBe("blood");
    // 3–5 glyphs from one script, never mixed.
    const cps = [...word].map((c) => c.codePointAt(0)!);
    expect(cps.length).toBeGreaterThanOrEqual(3);
    expect(cps.length).toBeLessThanOrEqual(5);
    expect(GLYPH_SCRIPTS.some((s) => cps.every((c) => c >= s.from && c <= s.to))).toBe(true);
    expect(systemText(calls[0]!)).not.toContain(word);
    expect(JSON.stringify(memory.get(runId))).not.toContain(word);
  });

  it("大失败: no reply, flicker, the model not called; the turn is spent and stored forgotten, out of every later prompt", async () => {
    const runId = runWith("low", "failure");
    const memory = new Map<string, Memory>();
    const { d, calls } = deps(() => say("never"), AFF.low, memory);
    const r = (await turn(d, runId, { said: "那是什么词？", q: 1 })).body as TurnBody;
    expect(r).toMatchObject({ reply: "", taboo: "flicker", turnsLeft: 5 });
    expect(calls).toHaveLength(0);
    const m = memory.get(runId)!;
    expect(m.turns).toEqual([{ day: 3, who: "player", text: "那是什么词？", forgotten: true, taboo: "flicker" }]);
    expect(decideTurn(m.turns, 3, 6)).toEqual({ kind: "answer", turnsLeft: 4 });
    await turn(d, runId, { said: "雨停了吗" });
    expect(systemText(calls[0]!)).not.toContain("那是什么词？");
  });

  it("one taboo per day: after one fires, later rolls that day return the plain locked line", async () => {
    const runId = runWith("high", "failure");
    // q4 has no taboo of its own; q1's high tier carries "errors". After the flicker on q1, q1 again is plain.
    const memory = new Map<string, Memory>();
    const { d } = deps(() => say(HIGH), AFF.high, memory);
    expect(((await turn(d, runId, { said: "x", q: 1 })).body as TurnBody).taboo).toBe("flicker");
    const again = (await turn(d, runId, { said: "x", q: 1 })).body as TurnBody;
    expect(again).toMatchObject({ reply: HIGH, taboo: null });
    // The next day is a new day.
    const next = variableLayer({ content, day: 3, locale: "zh", runId, memory: { summary: "", turns: memory.get(runId)!.turns.map((t) => ({ ...t, day: 2 })) }, affinity: AFF.high, q: 1, said: "" });
    expect(next.taboo).toBe("flicker");
  });

  it("free replies never carry a taboo", async () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 0, max: 100 }), (runId, affinity) => {
        expect(variableLayer({ content, day: 3, locale: "zh", runId, memory: NO_MEMORY, affinity, q: null, said: "今天怎么样" }).taboo).toBeNull();
      }),
    );
  });
});

describe("content: the day files' new parts", () => {
  const base = "# Day 3\n## Starter questions (x)\n| # | zh | en | hard |\n|---|---|---|---|\n| 1 | 一 | one |  |\n| 2 | 二 | two | yes |\n";
  it("files without layered answers or minBucket still load; every real day bundles its starters", () => {
    expect(parseVariableParts(base, "t")).toEqual({
      starters: [
        { n: 1, zh: "一", en: "one", hard: false, minBucket: "low" },
        { n: 2, zh: "二", en: "two", hard: true, minBucket: "low" },
      ],
      locked: [],
      layered: [],
    });
    for (let day = 1; day <= 18; day++) expect(real.days[String(day)]!.starters!.length, `day ${day}`).toBeGreaterThan(0);
    expect(real.days["14"]!.locked).toEqual([
      { unlock: 1, text: "Does it matter? You still read what I write." },
      { unlock: 3, text: "I heard it. I can't get in there. That's the point of it, isn't it." },
    ]);
  });

  it("minBucket in a fifth cell; layered answers with an optional taboo; strict", () => {
    const withMin = base.replace("| 2 | 二 | two | yes |", "| 2 | 二 | two | yes | minBucket: high |").replace("| 1 | 一 | one |  |", "| 1 | 一 | one |  | mid |");
    expect(parseStarters(withMin, "t").map((s) => s.minBucket)).toEqual(["mid", "high"]);
    expect(() => parseStarters(base.replace("| 1 | 一 | one |  |", "| 1 | 一 | one |  | top |"), "t")).toThrow(/minBucket/);
    const layered = `${base}## Layered answers\n- unlock: q2 → low: "a" | mid: "b | c" | high: "d" | taboo: blood\n- unlock: q1 → low: "x" | mid: "y" | high: "z"\n`;
    expect(parseLayered(layered, "t")).toEqual([
      { unlock: 2, low: "a", mid: "b | c", high: "d", taboo: "blood" },
      { unlock: 1, low: "x", mid: "y", high: "z" },
    ]);
    expect(() => parseLayered(`${base}## Layered answers\n- unlock: q1 → low: "x" | mid: "y" | high: "z" | taboo: fire\n`, "t")).toThrow(/unknown taboo/);
    expect(() => parseVariableParts(`${base}## Layered answers\n- unlock: q9 → low: "x" | mid: "y" | high: "z"\n`, "t")).toThrow(/not a starter/);
  });
});
