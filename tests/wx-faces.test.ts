// The faces of the people written by name in Hi信's groups (author 2026-11-28: 「家族群里的人们起码
// 有个微信头像吧，否则很难区分人」): the six relatives of 相亲相爱一家人 and the nine people of the
// three clients' project groups each have the picture they would have chosen, in both languages.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import npcFile from "@content/npc.json";
import { CLIENT_GROUPS } from "@state/replies/table";
import { aliasAvatar, npcData, npcIdOf, parseNpc, silhouetteFor } from "@world/npc";

const clone = () => JSON.parse(JSON.stringify(npcFile)) as Record<string, any>;
/** Every name written before a full-width colon in a conversation's lines, both languages, all days. */
function written(conversations: readonly string[]): Set<string> {
  const out = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (typeof o !== "object" || o === null) return;
    const text = (o as { text?: unknown }).text;
    if (typeof text === "string") {
      const i = text.indexOf("：");
      if (i > 0 && i <= 14) out.add(text.slice(0, i));
    }
    Object.values(o).forEach(walk);
  };
  for (const lang of ["", "en/"]) {
    walk(JSON.parse(fs.readFileSync(`content/replies/${lang}clan.json`, "utf8")));
    for (let d = 1; d <= 18; d++) {
      const day = JSON.parse(fs.readFileSync(`content/replies/${lang}day-${String(d).padStart(2, "0")}.json`, "utf8")) as { recipients: Record<string, unknown> };
      for (const id of conversations) if (id !== "clan") walk(day.recipients[id]);
    }
  }
  return out;
}

describe("the pictures people chose (npc.json faces)", () => {
  it("fifteen pictures, every file there, one picture per name", () => {
    const paths = new Set(Object.values(npcData.faces));
    expect(paths.size).toBe(15);
    for (const p of paths) expect(fs.existsSync(`public${p}`), p).toBe(true);
    expect(aliasAvatar("大姨")).toBe("/npc/wx/lotus.svg");
    expect(aliasAvatar("Big Aunt")).toBe("/npc/wx/lotus.svg");
    expect(aliasAvatar("刘处")).toBe(aliasAvatar("Director Liu"));
    // six relatives, six different pictures
    expect(new Set(["大姨", "二舅", "小姑", "堂姐", "表弟", "姥姥"].map(aliasAvatar)).size).toBe(6);
  });

  it("someone with no picture keeps a silhouette", () => {
    expect(aliasAvatar("同事甲")).toBe(silhouetteFor("同事甲"));
  });

  it("everyone written by name in the family group and the clients' groups has a picture or is an NPC", () => {
    const names = written(["clan", ...CLIENT_GROUPS]);
    expect(names.size).toBeGreaterThanOrEqual(27); // 6 + 9 people, most with a name in each language
    for (const name of names) {
      if (name === "member" || npcIdOf(name) !== null) continue;
      expect(Object.hasOwn(npcData.faces, name), `no picture for ${name}`).toBe(true);
    }
  });

  it("the loader refuses a name with two pictures, and an NPC id", () => {
    const twice = clone();
    twice.faces["/npc/wx/fu.svg"].push("大姨");
    expect(() => parseNpc(twice)).toThrow(/already has a picture/);
    const npc = clone();
    npc.faces["/npc/wx/fu.svg"].push("boss");
    expect(() => parseNpc(npc)).toThrow(/NPC id/);
    const none = clone();
    delete none.faces;
    expect(parseNpc(none).faces).toEqual({});
  });
});
