import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { constants } from "@state/variables";
import { bodyState, BODY_STATES, FRAMES, renderBodySlot, type BodyInputs } from "@world/desktop/kuro/body";
import { kuroDays, parseKuroDay } from "@world/desktop/kuro/days";
import { renderKuro, renderKuroMini } from "@world/desktop/kuro/mini";
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
        { n: 1, zh: "你好？", en: "Hi?", hard: false },
        { n: 2, zh: "你是谁？", en: "Who?", hard: true },
      ],
    });
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

describe("small window", () => {
  it("shows the day's idiom, the starters, and the turn counter", () => {
    const out = renderKuroMini(ctx()).value;
    const day1 = kuroDays.get(1)!;
    expect(out).toContain(escapeHtml(day1.idiom));
    for (const q of day1.starters) expect(out).toContain(escapeHtml(q.zh));
    expect(out).toContain(t("kuro.turns", { n: 0 }));
    expect(out).not.toContain("blink");
  });

  it("after the last turn shows the bedtime line and closes the questions", () => {
    const base = ctx();
    const out = renderKuroMini({ ...base, state: { ...base.state, chatTurnsToday: constants.chatTurnsPerDay } }).value;
    expect(out).toContain(escapeHtml(t("kuro.bedtime")));
    expect(out).not.toContain(escapeHtml(kuroDays.get(1)!.idiom));
    expect(out.match(/disabled/g)?.length).toBe(kuroDays.get(1)!.starters.length);
  });

  it("glows at night; Kuro rests", () => {
    const night = ctx({ night: true, session: initialSession({ beat: "night", time: "23:41" }) });
    const out = renderKuro(night).value;
    expect(out).toContain("kmini blink");
    expect(out).toContain('data-state="rest"');
  });

  it("thinks in the evening beat while turns are left, crawls while moving", () => {
    expect(renderKuro(ctx({ session: initialSession({ beat: "desk", time: "19:00" }) })).value).toContain('data-state="think"');
    const moving = ctx({ nowMs: 100 });
    moving.session.movingUntil = 500;
    expect(renderKuro(moving).value).toContain('data-state="crawl"');
  });
});
