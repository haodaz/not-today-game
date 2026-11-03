// desktop-ui "shared things must look like what they are" (2026-11-03): an optional `card` on a
// message is loaded strictly per type, the English twin check compares the card's structure (not its
// text), and each of the nine types renders its own markup in both apps (消息 WeChat, 工作台
// DingTalk). A message with no card still renders exactly as before.
import { describe, expect, it } from "vitest";
import { assertTwin, CARD_TYPES, parseDayFile, type Card } from "@state/replies/table";
import { renderBody } from "@world/desktop/messages/view";
import type { Body } from "@world/desktop/messages/bubbles";
import type { State } from "@state/types.gen";

const NAMES = { calledBy: "老大", bossCalls: "老板", nick: "囡囡", login: "u" } as unknown as State["names"];

/** A day file with one `boss` incoming line carrying `card`, for the strict loader. */
const dayWithCard = (card: unknown, extra: Record<string, unknown> = {}) => ({
  day: 3,
  recipients: { boss: { incoming: [{ t: "09:00", text: "一条分享", kind: "work", card, ...extra }] } },
});
const parse = (card: unknown, extra?: Record<string, unknown>) => () => parseDayFile(dayWithCard(card, extra), "day-03.json");
const cardOf = (card: unknown): Card => parseDayFile(dayWithCard(card), "day-03.json").recipients.get("boss")!.incoming[0]!.card!;

/** One well-formed example of every card type (the fields exactly as the addition lists). */
const SAMPLES: Record<(typeof CARD_TYPES)[number], Record<string, unknown>> = {
  article: { type: "article", account: "晚点 LatePost", title: "一篇文章", digest: "两行灰色的摘要", cover: "/msgs/covers/news.png" },
  video: { type: "video", account: "某视频号", title: "一个视频", cover: "/msgs/covers/short.png", duration: "0:45" },
  history: { type: "history", title: "群聊的聊天记录", lines: ["大姨：吃了吗", "二舅：在忙", "小姑：回家看看", "表弟：好的"] },
  link: { type: "link", title: "一个网页标题", site: "example.com", icon: "/msgs/covers/link.png" },
  image: { type: "image", src: "/msgs/photo.png", alt: "一张照片" },
  file: { type: "file", name: "合同终稿.pdf", size: "1.2 MB", ext: "pdf" },
  mini: { type: "mini", brand: "拼团", title: "帮我砍一刀", cover: "/msgs/covers/cat.png" },
  voice: { type: "voice", seconds: "41" },
  task: { type: "task", title: "审批：报销", fields: [["金额", "412.50"], ["事由", "打车"]], action: "去审批" },
};

describe("the loader accepts each card type and rejects unknown fields", () => {
  it.each(CARD_TYPES)("accepts a well-formed %s", (type) => {
    expect(parse(SAMPLES[type])).not.toThrow();
    expect(cardOf(SAMPLES[type]).type).toBe(type);
  });

  it("accepts a card with no cover (the neutral tile is a render concern)", () => {
    const { cover, ...noCover } = SAMPLES.article;
    expect(parse(noCover)).not.toThrow();
    expect((cardOf(noCover) as { cover?: string }).cover).toBeUndefined();
  });

  it("accepts an image with no src (a missing-asset placeholder)", () => {
    expect(parse({ type: "image", alt: "没有图" })).not.toThrow();
  });

  it("accepts forwarded: true beside a card", () => {
    expect(parse(SAMPLES.link, { forwarded: true })).not.toThrow();
  });

  it.each([
    ["an unknown card type", { type: "poll", title: "x" }, /unknown card type/],
    ["an unknown field on article", { ...SAMPLES.article, mood: "x" }, /unknown key "mood"/],
    ["an article missing its title", { type: "article", account: "x" }, /title/],
    ["a video missing its duration", { type: "video", account: "x", title: "y" }, /duration/],
    ["a history with no lines", { type: "history", title: "x", lines: [] }, /non-empty list/],
    ["a link missing its site", { type: "link", title: "x" }, /site/],
    ["an image missing its alt", { type: "image", src: "/x.png" }, /alt/],
    ["a file missing its ext", { type: "file", name: "x", size: "1 MB" }, /ext/],
    ["a mini missing its brand", { type: "mini", title: "x" }, /brand/],
    ["a task field that is not a pair", { type: "task", title: "x", fields: [["only"]] }, /\[label, value\]/],
    ["an unknown placeholder in a title", { type: "link", title: "{name}", site: "x" }, /placeholder/],
  ])("rejects %s", (_name, card, message) => {
    expect(parse(card)).toThrow(message);
  });

  it("rejects forwarded that is not true", () => {
    expect(parse(SAMPLES.link, { forwarded: false })).toThrow(/must be true/);
  });
});

describe("the English twin check compares structure, not text", () => {
  const twin = (zhCard: unknown, enCard: unknown) => {
    const zh = parseDayFile(dayWithCard(zhCard), "day-03.json").recipients.get("boss")!;
    const en = parseDayFile(dayWithCard(enCard), "en/day-03.json").recipients.get("boss")!;
    return () => assertTwin(zh, en, "en/day-03.json boss");
  };

  it("passes when only the card's text differs", () => {
    expect(twin(SAMPLES.article, { type: "article", account: "LatePost", title: "An article", digest: "two grey lines", cover: "/msgs/covers/news.png" })).not.toThrow();
    expect(twin(SAMPLES.task, { type: "task", title: "Approval", fields: [["Amount", "412.50"], ["Reason", "Taxi"]], action: "Review" })).not.toThrow();
  });

  it("fails when the card type differs", () => {
    expect(twin(SAMPLES.article, SAMPLES.link)).toThrow(/card structure differs/);
  });
  it("fails when an optional key is present in only one language", () => {
    const { digest, ...noDigest } = SAMPLES.article;
    expect(twin(SAMPLES.article, noDigest)).toThrow(/card structure differs/);
  });
  it("fails when a cover/asset differs", () => {
    expect(twin(SAMPLES.article, { ...SAMPLES.article, cover: "/msgs/covers/other.png" })).toThrow(/card structure differs/);
  });
  it("fails when a history's line count differs", () => {
    expect(twin(SAMPLES.history, { type: "history", title: "t", lines: ["a", "b"] })).toThrow(/card structure differs/);
  });
  it("fails when a task's field count differs", () => {
    expect(twin(SAMPLES.task, { type: "task", title: "t", fields: [["a", "b"]], action: "x" })).toThrow(/card structure differs/);
  });
  it("fails when a card is present in only one language", () => {
    const zh = parseDayFile(dayWithCard(SAMPLES.link), "day-03.json").recipients.get("boss")!;
    const en = parseDayFile({ day: 3, recipients: { boss: { incoming: [{ t: "09:00", text: "x", kind: "work" }] } } }, "en/day-03.json").recipients.get("boss")!;
    expect(() => assertTwin(zh, en, "en/day-03.json boss")).toThrow(/card present in only one language/);
  });
});

describe("each type renders its own markup in both apps", () => {
  const shared = (card: Card, forwarded = false): Body => ({ type: "shared", card, raw: "一条分享", forwarded });
  const wx = (card: Card, f = false) => renderBody(shared(card, f), NAMES, "wx").value;
  const ding = (card: Card, f = false) => renderBody(shared(card, f), NAMES, "ding").value;

  it("every type has its own class in WeChat and in DingTalk", () => {
    for (const type of CARD_TYPES) {
      const card = cardOf(SAMPLES[type]);
      expect(wx(card), `wx ${type}`).toContain(`sc-${type}`);
      expect(ding(card), `ding ${type}`).toContain(`sc-${type}`);
      expect(wx(card)).toContain("sc-" + type + " wx");
      expect(ding(card)).toContain("sc-" + type + " ding");
    }
  });

  it("an article shows its title, digest and account; a card without a cover uses a neutral tile", () => {
    const { cover, ...noCover } = SAMPLES.article;
    const out = wx(cardOf(noCover));
    expect(out).toContain("一篇文章");
    expect(out).toContain("两行灰色的摘要");
    expect(out).toContain("晚点 LatePost");
    expect(out).toContain("cover sq tile t-article");
    expect(out).not.toContain("<img"); // no cover image, but not an empty box either
  });

  it("an image with a src shows the picture; without a src, a grey placeholder with the alt text", () => {
    expect(wx(cardOf(SAMPLES.image))).toContain('<img class="c-image" src="/msgs/photo.png"');
    const ph = wx(cardOf({ type: "image", alt: "没有图" }));
    expect(ph).toContain("c-image ph");
    expect(ph).toContain("没有图");
  });

  it("a file's badge carries the extension and a type class; a video has a play circle and duration", () => {
    const file = wx(cardOf(SAMPLES.file));
    expect(file).toContain("fico x-pdf");
    expect(file).toContain("PDF");
    const video = wx(cardOf(SAMPLES.video));
    expect(video).toContain('class="play"');
    expect(video).toContain("0:45");
  });

  // desktop-ui addition 2026-11-03: the video card's title sits on the cover.
  describe("the video card's title sits on the cover", () => {
    it("the title is an overlay on the cover (not a line under it); the Channels mark and account sit on the bottom edge", () => {
      for (const register of ["wx", "ding"] as const) {
        const out = (register === "wx" ? wx : ding)(cardOf(SAMPLES.video));
        // The title is inside .c-video (the cover frame), carried by .v-title, not a .c-under row.
        const cover = out.slice(out.indexOf('class="c-video"'), out.lastIndexOf("</div>"));
        expect(cover, register).toContain("v-title");
        expect(cover, register).toContain("一个视频");
        expect(out, register).not.toContain("c-under");
        // The Channels mark and the account are along the bottom edge, with the duration.
        expect(out, register).toContain("ch-mark");
        expect(out, register).toContain("某视频号");
        expect(out, register).toContain('class="dur">0:45');
      }
    });

    it("default position is bottom; top when content asks for it", () => {
      expect(wx(cardOf(SAMPLES.video))).toContain('class="v-title bottom"');
      const top = cardOf({ ...SAMPLES.video, titlePos: "top" });
      expect(top.type === "video" && top.titlePos).toBe("top");
      expect(wx(top)).toContain('class="v-title top"');
    });

    it("duration is omitted when content gives none", () => {
      // duration is required by the loader, so render straight from a Card with an empty duration.
      const card: Card = { type: "video", account: "某视频号", title: "无时长", cover: "/c.png", duration: "" };
      expect(wx(card)).not.toContain('class="dur"');
    });

    it("loader: titlePos is strict, and the twin check treats it as structural", () => {
      expect(parse({ ...SAMPLES.video, titlePos: "middle" })).toThrow(/"top" or "bottom"/);
      const zh = parseDayFile(dayWithCard({ ...SAMPLES.video, titlePos: "top" }), "day-03.json").recipients.get("boss")!;
      const enSame = parseDayFile(dayWithCard({ type: "video", account: "ch", title: "t", cover: "/msgs/covers/short.png", duration: "0:45", titlePos: "top" }), "en/day-03.json").recipients.get("boss")!;
      expect(() => assertTwin(zh, enSame, "en")).not.toThrow();
      const enDiff = parseDayFile(dayWithCard({ type: "video", account: "ch", title: "t", cover: "/msgs/covers/short.png", duration: "0:45", titlePos: "bottom" }), "en/day-03.json").recipients.get("boss")!;
      expect(() => assertTwin(zh, enDiff, "en")).toThrow(/card structure differs/);
    });

    it("snapshot: one card per titlePos, in both registers", () => {
      const snap: Record<string, { wx: string; ding: string }> = {};
      for (const pos of ["top", "bottom"] as const) {
        const card = cardOf({ ...SAMPLES.video, titlePos: pos });
        snap[pos] = { wx: wx(card), ding: ding(card) };
      }
      expect(snap).toMatchSnapshot();
    });
  });

  it("forwarded marks the card (and shows the 「转发」 tag when its string exists)", () => {
    const on = wx(cardOf(SAMPLES.link), true);
    const off = wx(cardOf(SAMPLES.link), false);
    // The structural marker is always there when forwarded; the 「转发」 text tag waits for the
    // string msgs.card.forwarded (Claude adds it), so nothing renders for it until then.
    expect(on).toContain("is-fwd");
    expect(off).not.toContain("is-fwd");
  });

  it("snapshot: every type in 消息 (WeChat) and 工作台 (DingTalk)", () => {
    const snap: Record<string, { wx: string; ding: string }> = {};
    for (const type of CARD_TYPES) {
      const card = cardOf(SAMPLES[type]);
      snap[type] = { wx: wx(card), ding: ding(card) };
    }
    expect(snap).toMatchSnapshot();
  });
});

describe("a message without a card renders as before", () => {
  it("a plain text body is a bubble; a bracket card is the old grey card", () => {
    expect(renderBody({ type: "text", text: "普通一句" }, NAMES, "wx").value).toBe('<div class="bub">普通一句</div>');
    expect(renderBody({ type: "card", raw: "[卡片] 一个转发" }, NAMES, "wx").value).toContain('class="card article"');
    expect(renderBody({ type: "card", raw: "[卡片] 一个转发" }, NAMES, "ding").value).toContain('class="card task"');
  });
});
