// dictionary-back (author 2026-11-10): 查 pressed again on an answer translates the Chinese back into
// English — the word itself before backFromDay, the word's `back` from then on; one mechanism in both
// builds (Chinese players read the first layer, English players press twice).
import { describe, expect, it } from "vitest";
import { dictionaryTable } from "@state/hands";
import { dictionary, lookup, lookupBack, type DictionaryState } from "@world/objects/dictionary";
import type { ObjectEnv } from "@world/objects/program";
import { t } from "@world/i18n";

const env = (over: Partial<ObjectEnv> = {}): ObjectEnv => ({ day: 4, level: 0, upgraded: false, taken: false, time: "09:30", t: 0, seed: "run:4:x", lit: 1, pager: [], uses: 0, ...over });
const type = (s: DictionaryState, keys: string[], e: ObjectEnv): DictionaryState => keys.reduce((acc, k) => dictionary.key(acc, k, e).state, s);

describe("the pocket dictionary's second press", () => {
  it("the table: backFromDay is a day; every `back` fits the 16-cell row; the idiom words carry one", () => {
    expect(dictionaryTable.backFromDay).toBe(10);
    for (const w of dictionaryTable.words.values()) if (w.back !== null) expect(w.back.length).toBeLessThanOrEqual(16);
    expect(dictionaryTable.words.get("today")!.back).toBe("not today");
    expect(dictionaryTable.words.get("again")!.back).toBeNull();
  });
  it("before day 10 the round trip is faithful: the Chinese, then the word itself; from day 10 the word's `back` comes back instead", () => {
    expect(lookupBack("today", 9)).toEqual([dictionaryTable.words.get("today")!.gloss, "today"]);
    expect(lookupBack("today", 10)).toEqual([dictionaryTable.words.get("today")!.gloss, "not today"]);
    expect(lookupBack("again", 18)).toEqual([dictionaryTable.words.get("again")!.gloss, "again"]); // no `back`: itself
    expect(lookupBack("zz", 18)).toEqual([t("dictionary.unknown"), "zz"]);
  });
  it("on the device: T,O,D,A,Y + 查 shows the Chinese; 查 again shows the Chinese and the English it comes back as; a third 查 holds; a letter starts over", () => {
    const e = env({ day: 12 });
    let s = type(dictionary.init(e), ["open", "T", "O", "D", "A", "Y", "lookup"], e);
    expect(s.answer).toEqual(lookup("today", 12));
    expect(s.backed).toBe(false);
    s = type(s, ["lookup"], e);
    expect(s.answer).toEqual(lookupBack("today", 12));
    expect(s.backed).toBe(true);
    const third = type(s, ["lookup"], e);
    expect([third.answer, third.backed]).toEqual([s.answer, true]);
    const again = type(s, ["K"], e);
    expect(again.answer).toBeNull();
    expect(again.backed).toBe(false);
    expect(again.input).toBe("k");
  });
  it("upgraded, the second press is read out too (a line in the box)", () => {
    const e = env({ day: 12, upgraded: true });
    const s = type(dictionary.init(e), ["open", "E", "Y", "E", "lookup"], e);
    const r = dictionary.key(s, "lookup", e);
    expect(r.state.answer).toEqual(lookupBack("eye", 12));
    expect(JSON.stringify(r.out)).toContain("d12:dictionary:eye:back");
  });
});
