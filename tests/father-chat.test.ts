// Dad's own chat in Hi信 (author 2026-11-28: 「玩家没有他爹的微信吗，只有他妈妈么」 → 「爸爸单开聊天」).
import { describe, expect, it } from "vitest";
import { dayTable } from "@state/replies/table";
import { threadsIn } from "@world/desktop/messages/threads";
import { npcAvatar } from "@world/npc";
import { labelKey } from "@world/replies/labels";
import { t } from "@world/i18n";

const dad = (day: number) => dayTable(day)!.recipients.get("father")!;

describe("爸: a chat of his own", () => {
  it("is in Hi信 every day, between the parents' group and the relatives, with his face and name", () => {
    for (let day = 1; day <= 18; day++) expect(threadsIn("msgs", day).slice(0, 3), `day ${day}`).toEqual(["family", "father", "clan"]);
    expect(npcAvatar("father")).toBe("/npc/father_av.png");
    expect(t("msgs.father")).toBe("爸");
  });

  it("three replies, worded for him; a day may word one to fit", () => {
    expect([...dad(1).cells.keys()]).toEqual(["fine", "received", "thanks"]);
    expect(t(labelKey("father", "received")!)).toBe("知道了。");
    expect(t(labelKey("father", "thanks")!)).toBe("谢谢爸。");
    expect(t(labelKey("father", "thanks", 3)!)).toBe("去医院看看。");
    expect(t(labelKey("father", "thanks", 6)!)).toBe("它不会看病。");
  });

  it("follows the family's slope: day 10 is day 1 again, full stops from 11, silent on 14, 15 and 18", () => {
    const texts = (day: number) => dad(day).incoming.map((m) => m.text);
    expect(texts(1)).toEqual(["[转账] 2000 元", "别跟你妈说"]);
    expect(texts(10)).toEqual(texts(1));
    for (let day = 1; day <= 9; day++) for (const line of texts(day)) expect(line, `day ${day}`).not.toMatch(/。$/);
    for (const day of [11, 12, 13, 16, 17]) for (const line of texts(day)) expect(line, `day ${day}`).toMatch(/。$/);
    for (const day of [14, 15, 18]) expect(texts(day), `day ${day}`).toEqual([]);
    // he never answers on the silent days
    for (const day of [14, 15, 18]) for (const cell of dad(day).cells.values()) expect(cell.status).toBe("read");
  });
});
