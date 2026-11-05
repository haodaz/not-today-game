// kuro-zh-answers (2026-11-04): the zh twins of the layered and offline answers (R1–R3), and
// Kuro's face for the idiom and uncanny lines wherever it speaks (R4).
import { afterEach, describe, expect, it } from "vitest";
import { parseLayeredZh, parseVariableParts } from "@kuro/dayfile.ts";
import { d100, lockedFor, variableLayer } from "@kuro/variable.ts";
import type { KuroContent, KuroDayContent } from "@kuro/types.ts";
import { setContentLocale } from "@state/content-locale";
import { createStore } from "@state/store";
import { kuroDay, offlineAnswer, parseKuroDay } from "@world/desktop/kuro/days";
import { kuroText, kuroVoice } from "@world/desktop/kuro/voice";
import { initialSession } from "@world/desktop/model";
import { dialogueBox } from "@world/dialogue/box";
import { setLocale } from "@world/i18n";
import { push } from "@world/loop/dialogue";

afterEach(() => {
  setLocale("zh");
  setContentLocale("zh");
});

const HEAD = `# Day 3

**Idiom of the day (constant):** Hope you slept well.

## Starter questions (player picks one)

| # | zh | en | hard |
|---|---|---|---|
| 1 | 谁写的？ | Who wrote it? |  |
| 2 | 还有谁？ | Who else? | yes |

## Red-blue lines (constants)

- unlock: q2 → "Nobody. The others approve."
`;
const LAYERED = `
## Layered answers (locked per bucket)

- unlock: q1 → low: "You did." | mid: "You did, mostly." | high: "You did. I was handed it." | taboo: blur
`;
const LAYERED_ZH = `
## Layered answers (zh)

- unlock: q1 → low: "你写的。" | mid: "大多是你写的。" | high: "你写的。我是被递过来的。"
`;
const OFFLINE = `
## Offline answers (constants)

- q1 → "You did."
- free text → "Go on."
`;
const OFFLINE_ZH = `
## Offline answers (zh)

- q1 → "你写的。"
- free text → "说吧。"
`;
const NEVER = "\n## Never\n- x\n";

describe("R1 · the parsers", () => {
  it("the function's: zh layered tiers ride on the English line; the taboo stays English", () => {
    const { layered } = parseVariableParts(HEAD + LAYERED + LAYERED_ZH + NEVER, "x");
    expect(layered).toEqual([{ unlock: 1, low: "You did.", mid: "You did, mostly.", high: "You did. I was handed it.", taboo: "blur", zh: { low: "你写的。", mid: "大多是你写的。", high: "你写的。我是被递过来的。" } }]);
  });

  it("the zh section is never read as the English one, whichever comes first", () => {
    const { layered } = parseVariableParts(HEAD + LAYERED_ZH + LAYERED + NEVER, "x");
    expect(layered[0]!.low).toBe("You did.");
    expect(layered[0]!.zh!.low).toBe("你写的。");
  });

  it("absent zh: English only, as before (no zh key)", () => {
    const { layered } = parseVariableParts(HEAD + LAYERED + NEVER, "x");
    expect(layered[0]).not.toHaveProperty("zh");
    expect(parseLayeredZh(HEAD + LAYERED, "x")).toBeNull();
  });

  it("a zh unlock not in the English fails; an English one missing in zh fails; a zh taboo fails", () => {
    const extra = LAYERED_ZH + `- unlock: q2 → low: "没人。" | mid: "没人。" | high: "没人。"\n`;
    expect(() => parseVariableParts(HEAD + LAYERED + extra + NEVER, "x")).toThrow(/layered answers \(zh\): q2 has no English line/);
    expect(() => parseVariableParts(HEAD + LAYERED + "\n## Layered answers (zh)\n\n- none\n" + NEVER, "x")).toThrow(/no line for q1/);
    const taboo = LAYERED_ZH.replace(`被递过来的。"`, `被递过来的。" | taboo: blur`);
    expect(() => parseVariableParts(HEAD + LAYERED + taboo + NEVER, "x")).toThrow(/carries a taboo/);
  });

  it("the game's offline answers: the zh twin is read and must answer the same questions", () => {
    const d = parseKuroDay(HEAD + LAYERED + OFFLINE + OFFLINE_ZH + NEVER, "day-03.md");
    expect(d.answers.q.get(1)).toBe("You did.");
    expect(d.answers.zh).toEqual({ q: new Map([[1, "你写的。"]]), free: "说吧。" });
    expect(parseKuroDay(HEAD + OFFLINE + NEVER, "day-03.md").answers.zh).toBeNull();
    expect(() => parseKuroDay(HEAD + OFFLINE + OFFLINE_ZH.replace("- q1", "- q2") + NEVER, "day-03.md")).toThrow(/offline answers \(zh\): q2 has no English line/);
    expect(() => parseKuroDay(HEAD + OFFLINE + OFFLINE_ZH.replace(/- free text.*\n/, "") + NEVER, "day-03.md")).toThrow(/no line for free text/);
  });
});

describe("R2 · picked by locale", () => {
  const day = { day: 3, idiom: "Hope you slept well.", idiomZh: "希望你睡得还好。", stance: "", recall: "", mayReveal: "", never: "", ...parseVariableParts(HEAD + LAYERED + LAYERED_ZH + NEVER, "x") } as KuroDayContent;
  const content = { days: { "3": day }, affinity: { perPoint: 5, threshold: 60, tenderDays: [], tenderMultiplier: 1 }, unreadable: { zh: null, en: null } } as unknown as KuroContent;

  it("lockedFor: zh turn → the zh tier, en turn → English; the same taboo; red-blue stays English", () => {
    expect(lockedFor(day, 1, "high", "zh")).toEqual({ q: 1, text: "你写的。我是被递过来的。", layered: true, taboo: "blur" });
    expect(lockedFor(day, 1, "high", "en")).toEqual({ q: 1, text: "You did. I was handed it.", layered: true, taboo: "blur" });
    expect(lockedFor(day, 1, "low", "zh")!.text).toBe("你写的。");
    expect(lockedFor(day, 2, "low", "zh")).toEqual({ q: 2, text: "Nobody. The others approve.", layered: false });
  });

  it("variableLayer: the bucket, the d100 and the taboo do not depend on the locale", () => {
    for (const affinity of [0, 40, 80]) {
      const zh = variableLayer({ content, day: 3, locale: "zh", runId: "r", memory: { summary: "", turns: [] }, affinity, q: 1, said: "" });
      const en = variableLayer({ content, day: 3, locale: "en", runId: "r", memory: { summary: "", turns: [] }, affinity, q: 1, said: "" });
      expect([zh.bucket, zh.roll, zh.outcome, zh.taboo]).toEqual([en.bucket, en.roll, en.outcome, en.taboo]);
      expect(zh.roll).toBe(d100("r", 3, 1));
      expect(zh.locked!.text).toMatch(/\p{Script=Han}/u);
      expect(en.locked!.text).not.toMatch(/\p{Script=Han}/u);
    }
  });

  it("offlineAnswer: the zh twin under the zh content locale, English under en; English when there is no twin", () => {
    const d = parseKuroDay(HEAD + OFFLINE + OFFLINE_ZH + NEVER, "day-03.md");
    setContentLocale("zh");
    expect([offlineAnswer(d, 1), offlineAnswer(d, null), offlineAnswer(d, 2)]).toEqual(["你写的。", "说吧。", "说吧。"]);
    setContentLocale("en");
    expect([offlineAnswer(d, 1), offlineAnswer(d, null)]).toEqual(["You did.", "Go on."]);
    setContentLocale("zh");
    expect(offlineAnswer(parseKuroDay(HEAD + OFFLINE + NEVER, "day-03.md"), 1)).toBe("You did.");
  });
});

describe("R4 · Kuro's face", () => {
  const idiom = kuroDay(3)!.idiom;
  const red = kuroDay(3)!.redBlue[0]!;

  it("the idiom → mono, no split; a red-blue constant → mono + split; in either build", () => {
    for (const l of ["zh", "en"] as const) {
      expect(kuroVoice(3, idiom, l)).toEqual({ text: idiom, face: "idiom" });
      expect(kuroVoice(3, red, l).face).toBe("uncanny");
    }
    expect(kuroText(3, idiom).value).toBe(`<span class="kmono">${idiom.replace(/'/g, "&#39;")}</span>`);
    expect(kuroText(3, red).value).toContain('<span class="kmono plain">');
    // Another day's idiom is not today's.
    expect(kuroVoice(4, idiom, "en").face).toBeNull();
  });

  it("zh build: an English non-idiom line → split; en build: ordinary English stays as it is", () => {
    expect(kuroVoice(3, "Saved. Next.", "zh").face).toBe("uncanny");
    expect(kuroVoice(3, "Saved. Next.", "en").face).toBeNull();
    expect(kuroVoice(3, "好的，已保存。", "zh").face).toBeNull();
    expect(kuroVoice(3, "已保存 OK", "zh").face).toBeNull();
  });

  it("the `~ ` marker → split, the marker not shown", () => {
    expect(kuroVoice(3, "~ I was here first.", "en")).toEqual({ text: "I was here first.", face: "uncanny" });
    const out = kuroText(3, "~ 我先来的。").value;
    expect(out).toBe('<span class="kmono plain">我先来的。</span>');
  });

  it("in the dialogue box: Kuro's uncanny line in the face with the marker gone; an ordinary line plain; others untouched", () => {
    const store = createStore({ startDay: 3 });
    const box = (lines: { k: "speaker"; who: string; t: string }[], voice?: "kuro") => {
      const session = initialSession({ beat: "desk", time: "21:00" }, "left", "desk");
      session.dialogue = push(session.dialogue, { key: "t", lines, ending: { kind: "none" }, ...(voice ? { voice } : {}) });
      return dialogueBox(store.getState(), store.getEvents(), session, 0)!.value;
    };
    const k = box([{ k: "speaker", who: "Kuro", t: "~ 我先来的。" }], "kuro");
    expect(k).toContain('<span class="kmono plain">我先来的。</span>');
    expect(k).not.toContain("~ ");
    expect(box([{ k: "speaker", who: "Kuro", t: idiom }], "kuro")).toContain('<span class="kmono">');
    expect(box([{ k: "speaker", who: "屏幕", t: red }])).toContain('<span class="kmono plain">');
    const plain = box([{ k: "speaker", who: "Kuro", t: "好的。" }], "kuro");
    expect(plain).not.toContain("kmono");
    // Someone else's English line is not Kuro's.
    expect(box([{ k: "speaker", who: "boss", t: red }])).not.toContain("kmono");
  });
});
