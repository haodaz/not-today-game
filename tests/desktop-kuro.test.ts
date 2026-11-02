import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { constants } from "@state/variables";
import { bodyState, BODY_STATES, FRAMES, renderBodySlot, type BodyInputs } from "@world/desktop/kuro/body";
import { kuroDays, offlineAnswer, parseKuroDay } from "@world/desktop/kuro/days";
import { hudKuro, renderKuro } from "@world/desktop/kuro/mini";
import { initialSession, type AppContext } from "@world/desktop/model";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";

const ctx = (over: Partial<AppContext> = {}, day = 1): AppContext => {
  const store = createStore({ startDay: day });
  return { state: store.getState(), events: [], startDay: day, session: initialSession({ beat: "boot", time: "09:03" }), night: false, nowMs: 0, ...over };
};

describe("kuro-days parser", () => {
  it("parses every day file: idiom and 3–4 starter questions", () => {
    expect([...kuroDays.keys()]).toEqual(Array.from({ length: constants.lastDay }, (_, i) => i + 1));
    for (const day of kuroDays.values()) {
      expect(day.idiom.length, `day ${day.day}`).toBeGreaterThan(0);
      expect(day.starters.length, `day ${day.day}`).toBeGreaterThanOrEqual(3);
      expect(day.starters.length, `day ${day.day}`).toBeLessThanOrEqual(4);
    }
  });

  it("reads the idiom as written and the table's columns", () => {
    const parsed = parseKuroDay(
      "# Day 2\n\n**Idiom of the day (constant):** Good to see you.\n\n## Starter questions\n\n| # | zh | en | hard |\n|---|---|---|---|\n| 1 | 你好？ | Hi? |  |\n| 2 | 你是谁？ | Who? | yes |\n\n## Never\n- x\n",
      "day-02.md",
    );
    expect(parsed).toEqual({
      day: 2,
      idiom: "Good to see you.",
      starters: [
        { n: 1, zh: "你好？", en: "Hi?", hard: false, minBucket: "low" },
        { n: 2, zh: "你是谁？", en: "Who?", hard: true, minBucket: "low" },
      ],
      answers: { q: new Map(), free: null },
    });
  });

  it("reads the offline answers strictly (dialogue spec); every day has a free-text answer", () => {
    const head = "# Day 3\n**Idiom of the day (constant):** Hi.\n## Starter questions\n| 1 | a | b | |\n| 2 | c | d | |\n";
    const parsed = parseKuroDay(`${head}## Offline answers (constants)\n\n- q1 → "One."\n- free text → "Go on."\n## Never\n- x\n`, "day-03.md");
    expect(parsed.answers.q).toEqual(new Map([[1, "One."]]));
    expect(parsed.answers.free).toBe("Go on.");
    expect(offlineAnswer(parsed, 1)).toBe("One.");
    expect(offlineAnswer(parsed, 2)).toBe("Go on."); // no answer to q2: the free one
    expect(offlineAnswer(parsed, null)).toBe("Go on.");
    expect(() => parseKuroDay(`${head}## Offline answers\n- q1: "One."\n`, "x")).toThrow(/unreadable/);
    expect(() => parseKuroDay(`${head}## Offline answers\n- q9 → "Nine."\n`, "x")).toThrow(/not a starter/);
    expect(() => parseKuroDay(`${head}## Offline answers\n- q1 → "A."\n- q1 → "B."\n`, "x")).toThrow(/two answers/);
    for (const day of kuroDays.values()) {
      expect(day.answers.free, `day ${day.day}`).not.toBeNull();
      for (const s of day.starters) expect(offlineAnswer(day, s.n).length, `day ${day.day} q${s.n}`).toBeGreaterThan(0);
    }
  });

  it("rejects a file without an idiom or starters", () => {
    expect(() => parseKuroDay("# Day 1\n## Starter questions\n| 1 | a | b | |\n", "x")).toThrow(/idiom/);
    expect(() => parseKuroDay("# Day 1\n**Idiom of the day (constant):** Hi.\n", "x")).toThrow(/starter/);
  });
});

describe("body state (U8)", () => {
  const none: BodyInputs = { night: false, taskRunning: false, saidPretty: false, moving: false, waiting: false };

  it("follows the precedence rest > busy > happy > crawl > think > idle", () => {
    expect(bodyState(none)).toBe("idle");
    expect(bodyState({ ...none, waiting: true })).toBe("think");
    expect(bodyState({ ...none, waiting: true, moving: true })).toBe("crawl");
    expect(bodyState({ ...none, moving: true, saidPretty: true })).toBe("happy");
    expect(bodyState({ ...none, saidPretty: true, taskRunning: true })).toBe("busy");
    expect(bodyState({ ...none, taskRunning: true, night: true })).toBe("rest");
  });

  it("property: night always rests", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (taskRunning, saidPretty, moving, waiting) => {
        return bodyState({ night: true, taskRunning, saidPretty, moving, waiting }) === "rest";
      }),
    );
  });

  it("has two distinct frames for every state and never takes clicks", () => {
    for (const state of BODY_STATES) {
      expect(FRAMES[state]).toHaveLength(2);
      expect(FRAMES[state][0]).not.toBe(FRAMES[state][1]);
    }
    expect(renderBodySlot("idle").value).toContain('aria-hidden="true"');
  });
});

describe("the status pill (dialogue FR2)", () => {
  it("shows its last line (the day's idiom), online, and today's turns; it takes no input", () => {
    const out = renderKuro(ctx()).value;
    expect(out).toContain('class="kpill" data-action="kuro-call"');
    expect(out).toContain(escapeHtml(kuroDays.get(1)!.idiom));
    expect(out).toContain(t("shell.kuro.online"));
    expect(out).toContain(t("kuro.turns", { n: 0 }));
    expect(out).not.toMatch(/<input|kuro-q|kuro-ask/);
  });

  it("after the last turn its line is the bedtime line", () => {
    const base = ctx();
    const out = renderKuro({ ...base, state: { ...base.state, chatTurnsToday: constants.chatTurnsPerDay } }).value;
    expect(out).toContain(escapeHtml(t("kuro.bedtime")));
    expect(out).toContain(t("kuro.turns", { n: constants.chatTurnsPerDay }));
  });

  // The body is the HUD's call button (day-loop correction); its state is the same function.
  it("at night: the night dot instead of online; Kuro rests", () => {
    const night = ctx({ night: true, session: initialSession({ beat: "night", time: "23:41" }) });
    const out = renderKuro(night).value;
    expect(out).toContain('class="kpill blink"');
    expect(out).toContain('class="dotl"');
    expect(out).not.toContain(t("shell.kuro.online"));
    expect(hudKuro(night).value).toContain('data-state="rest"');
  });

  it("thinks in the evening beat while turns are left, crawls while moving", () => {
    expect(hudKuro(ctx({ session: initialSession({ beat: "desk", time: "19:00" }) })).value).toContain('data-state="think"');
    const moving = ctx({ nowMs: 100 });
    moving.session.movingUntil = 500;
    expect(hudKuro(moving).value).toContain('data-state="crawl"');
  });

  it("the small window on the monitor no longer draws a body; the HUD button does", () => {
    expect(renderKuro(ctx()).value).not.toContain("data-kuro-slot");
    expect(hudKuro(ctx()).value).toContain('class="kpet" data-kuro-slot');
  });
});
