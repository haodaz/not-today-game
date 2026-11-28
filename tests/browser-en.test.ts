// The newspaper in English (2026-11-28): the English build showed the Chinese paper until then.
import { afterEach, describe, expect, it } from "vitest";
import { browserPage, browserPages, browserPagesEn, checkBrowserTwins, weatherKind } from "@world/desktop/browser/data";
import { setLocale } from "@world/i18n";

afterEach(() => setLocale("zh"));
const cjk = /[一-鿿]/;

describe("the paper has an English twin", () => {
  it("eighteen days each, the same shape, and no Chinese left in the English one", () => {
    expect(browserPages.size).toBe(18);
    expect(browserPagesEn.size).toBe(18);
    expect(() => checkBrowserTwins(browserPages, browserPagesEn)).not.toThrow();
    for (const [day, p] of browserPagesEn) {
      const all = [p.site, p.weather, p.lead.h, ...p.lead.p, ...p.numbers.flatMap((n) => [n.v, n.l]), ...p.reading.flatMap((r) => [r.h, r.sec, r.when])].join(" ");
      expect(cjk.test(all), `day ${day}: ${all.match(cjk)?.[0] ?? ""}`).toBe(false);
    }
  });

  it("the page follows the language", () => {
    expect(browserPage(7)!.lead.h).toBe("助手开始叫你的名字，而你没有告诉过它");
    setLocale("en");
    expect(browserPage(7)!.lead.h).toBe("The assistant has started calling you by name, and you never told it");
    // day 10 is day 1 again in both; day 17 is one sentence and one number in both
    expect(browserPage(10)!.lead).toEqual(browserPage(1)!.lead);
    expect(browserPage(17)!.lead).toEqual({ h: "You look lovely today.", p: ["", ""] });
    expect(browserPage(17)!.numbers.map((n) => n.v)).toEqual(["555", "", ""]);
  });

  it("a twin that drifts is refused: a missing day, a blank filled in", () => {
    const short = new Map(browserPagesEn);
    short.delete(18);
    expect(() => checkBrowserTwins(browserPages, short)).toThrow(/has 17 days/);
    const filled = new Map(browserPagesEn);
    const d17 = browserPagesEn.get(17)!;
    filled.set(17, { ...d17, lead: { ...d17.lead, p: ["Something.", ""] } });
    expect(() => checkBrowserTwins(browserPages, filled)).toThrow(/shape differs/);
  });

  it("the header's weather is read from either language", () => {
    expect([weatherKind("阴，有雨"), weatherKind("Overcast, rain"), weatherKind("雾"), weatherKind("Fog"), weatherKind("晴"), weatherKind("Clear"), weatherKind("White"), weatherKind("")]).toEqual(["rain", "rain", "fog", "fog", "clear", "clear", null, null]);
  });

  it("the mug in the paper holds coffee (the cold-water line was removed from the game on 2026-11-09)", () => {
    expect(browserPages.get(9)!.reading.map((r) => r.h).join()).not.toContain("凉水");
  });
});
