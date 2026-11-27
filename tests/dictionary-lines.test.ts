// Ledger #128 (author 2026-11-27): on the pocket dictionary, a whole line of Kuro's can be looked up. Typed by hand, 查
// gives the word-by-word Chinese; 查 again gives what that Chinese reads back as. Beside the device a card says her line
// and lists what Kuro said (today's first).
import { describe, expect, it } from "vitest";
import { dictionaryTable, lineKey } from "@state/hands";
import { DICT_COLS, MAX_INPUT, dictionary, lookup, lookupBack, type DictionaryState } from "@world/objects/dictionary";
import { rowWidth } from "@world/objects/frame";
import { hasString } from "@world/i18n";
import { dictLinesCard } from "@world/room/devices";

const env = (day: number) => ({ t: 0, day, seed: "s", level: 1, upgraded: false }) as never;
const type = (s: DictionaryState, text: string, day = 6): DictionaryState => { for (const ch of text) s = dictionary.key(s, ch === " " ? "space" : ch.toUpperCase(), env(day)).state; return s; };
const open = (): DictionaryState => dictionary.key(dictionary.init(env(6)), "open", env(6)).state;

describe("a whole line on the dictionary", () => {
  it("every day has its line; each reading and back-reading fits two rows of sixteen cells; a line fits the input", () => {
    for (let d = 1; d <= 18; d++) {
      const l = dictionaryTable.lineOfDay.get(d);
      expect(l, `day ${d}`).toBeDefined();
      expect(l!.key.length).toBeLessThanOrEqual(MAX_INPUT);
      for (const row of [...l!.zh, ...l!.back]) expect(rowWidth(row), `${d}: ${row}`).toBeLessThanOrEqual(DICT_COLS);
    }
    expect(lineKey("You've been working so hard.")).toBe("youve been working so hard");
  });

  it("typed by hand: 查 gives the word-by-word Chinese, 查 again what it reads back as, a third press holds", () => {
    let s = type(open(), "youve been working so hard");
    expect(s.input).toBe("youve been working so hard");
    expect(dictionary.draw(s, env(6))).toMatchObject({ rows: ["youve been worki", "ng so hard"] });
    s = dictionary.key(s, "lookup", env(6)).state;
    expect(s.answer).toEqual(["你 已经 工作", "如此 硬"]);
    s = dictionary.key(s, "lookup", env(6)).state;
    expect(s.answer).toEqual(["you already work", "so stiff"]);
    expect(dictionary.key(s, "lookup", env(6)).state.answer).toEqual(["you already work", "so stiff"]);
  });

  it("a line reads back wrong on any day; single words keep their own rules", () => {
    expect(lookup("hope you slept well", 3)).toEqual(["希望 你 睡了", "井"]);
    expect(lookupBack("Hope you slept well.", 3)).toEqual(["hope you slept", "in the well"]);
    expect(lookup("today", 1)).toEqual(["today", "今天"]);
    expect(lookupBack("today", 1)).toEqual(["今天", "today"]);
    expect(lookupBack("today", 10)).toEqual(["今天", "not today"]);
  });

  it("the card beside the device: her line, today's line first, then the two days before; none while the first-use guide is up", () => {
    expect(hasString("dict.lines.title")).toBe(true);
    const card = String(dictLinesCard(7, false));
    expect(card).toContain("dict-lines");
    const at = (t: string) => card.indexOf(t);
    expect(at("Good to see you. Keep going.")).toBeGreaterThan(-1);
    expect(at("You've been working so hard.") > at("Good to see you. Keep going.") || at("You&#39;ve been working so hard.") > at("Good to see you. Keep going.")).toBe(true);
    expect(card).toContain("Take it one step at a time.");
    expect(card.match(/class=\"now\"/g)?.length).toBe(1);
    expect(dictLinesCard(7, true)).toBeNull();
  });
});
