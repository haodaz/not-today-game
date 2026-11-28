// 朋友圈 / Moments (author 2026-11-28, ledger #189): posts from content/feed.json, zh + en twins,
// everyone who posts, likes or comments has a face; the column shows what has been posted so far.
import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import zhRaw from "@content/feed.json";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { checkFeedTwins, feedAt, feedFace, feedTable, hasFace, parseFeed } from "@world/desktop/messages/feed";
import { FEED } from "@world/desktop/messages/threads";
import { renderMessages } from "@world/desktop/messages/view";
import { initialSession } from "@world/desktop/model";
import { setLocale } from "@world/i18n";

afterEach(() => setLocale("zh"));
const clone = () => JSON.parse(JSON.stringify(zhRaw)) as { days: Record<string, any[]> };

describe("content/feed.json", () => {
  it("every day has posts, in both languages, by people with a face", () => {
    for (const lang of ["zh", "en"] as const) {
      for (let day = 1; day <= 18; day++) {
        const posts = feedTable[lang].get(day) ?? [];
        expect(posts.length, `${lang} day ${day}`).toBeGreaterThanOrEqual(1);
        for (const p of posts) for (const who of [p.who, ...p.likes, ...p.comments.map((c) => c.who)]) expect(hasFace(who), `${lang} day ${day}: ${who}`).toBe(true);
      }
    }
    expect(feedFace("大姨")).toBe("/npc/wx/lotus.jpg");
    expect(feedFace("boss")).toBe("/npc/boss_av.png");
    expect(feedFace("和光集团")).toBe("/npc/evenlight.svg");
  });

  it("every photograph is a picture in the game, the same one in both languages", () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 18; day++) {
      const zh = feedTable.zh.get(day) ?? [];
      const en = feedTable.en.get(day) ?? [];
      zh.forEach((p, i) => {
        expect(p.img !== undefined, `day ${day}: ${p.photo ?? "(no photograph)"}`).toBe(p.photo !== undefined);
        expect(en[i]!.img).toBe(p.img);
        if (p.img !== undefined) {
          expect(fs.existsSync(`public${p.img}`), p.img).toBe(true);
          seen.add(p.img);
        }
      });
    }
    expect(seen.size).toBe(35);
    // day 6: three clients, one sentence, one photograph
    expect(new Set((feedTable.zh.get(6) ?? []).slice(0, 3).map((p) => p.img)).size).toBe(1);
  });

  it("the loader is strict", () => {
    const unknown = clone(); unknown.days["1"]![0].mood = "x";
    expect(() => parseFeed(unknown)).toThrow(/unknown key "mood"/);
    const nobody = clone(); nobody.days["1"]![0].who = "路人";
    expect(() => parseFeed(nobody)).toThrow(/not an NPC id or a name with a picture/);
    const order = clone(); order.days["1"]![1].t = "06:00";
    expect(() => parseFeed(order)).toThrow(/time order/);
    const stray = clone(); stray.days["1"]![0].img = "/elsewhere/x.png";
    expect(() => parseFeed(stray)).toThrow(/must be \/msgs\/feed/);
    const twin = clone(); twin.days["1"]!.pop();
    expect(() => checkFeedTwins(parseFeed(twin), feedTable.zh)).toThrow(/does not match/);
  });

  it("shows what has been posted so far, the newest first", () => {
    expect(feedAt(1, "07:00", "zh")).toEqual([]);
    expect(feedAt(1, "12:10", "zh").map((p) => p.who)).toEqual(["孙姐", "小姑"]);
    const day3 = feedAt(3, "09:03", "zh");
    expect(day3.every((p) => p.day < 3)).toBe(true);
    expect(day3[0]).toMatchObject({ day: 2, who: "partner" });
    // day 6: the three clients post the same sentence with the same photograph
    const six = (feedTable.zh.get(6) ?? []).slice(0, 3);
    expect(new Set(six.map((p) => `${p.text}|${p.photo}`)).size).toBe(1);
    expect(new Set(six.map((p) => p.who)).size).toBe(3);
  });
});

describe("the 朋友圈 column in Hi信", () => {
  function render(day: number, time: string): string {
    const store = createStore({ startDay: day });
    const session = Object.assign(initialSession({ ...DEFAULT_CLOCK, time }, "left", "desktop"), { homeConversation: FEED });
    return renderMessages({ state: store.getState(), events: store.getEvents(), startDay: day, session, night: false, nowMs: 0 }).body.value;
  }

  it("draws each post: face, name, words, the photograph's caption, likes and comments", () => {
    const out = render(2, "23:00");
    expect(out.match(/<article class="fp"/g)).toHaveLength(6);
    expect(out).toContain('<b class="fp-who">二舅</b>');
    expect(out).toContain('src="/npc/wx/sunrise.jpg"');
    expect(out).toContain('<img class="fp-photo" src="/msgs/feed/hirelist.jpg" alt="一张录用名单，一个名字上画了红圈"');
    expect(out).toContain('<div class="fp-c"><b>大姨</b>：恭喜恭喜</div>');
    expect(out).toContain('<b class="fp-who">Vivi</b>'); // an NPC by its name
    expect(out).toContain('<div class="fp-likes"><b>老板</b></div>');
    // today's posts carry their time, yesterday's the day
    expect(out).toContain('<time class="fp-when">20:30</time>');
    expect(out).toContain('<time class="fp-when">昨天</time>');
  });

  it("Mum posts under her own name; the English build reads in English", () => {
    expect(render(16, "09:00")).toContain('<b class="fp-who">妈</b>');
    setLocale("en");
    const out = render(1, "23:00");
    expect(out).toContain('<b class="fp-who">Little Aunt</b>');
    expect(out).toContain("Braised pork in the canteen today.");
    expect(out).not.toMatch(/小姑|孙姐/);
  });
});
