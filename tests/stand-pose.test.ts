// texture-pass R2: standing portraits with poses, the assimilated default and the idle loops.
import { describe, expect, it } from "vitest";
import { EMPTY_DIALOGUE, push, sceneOf } from "@world/loop/dialogue";
import { npcData, npcIdle, npcStandFor, parseNpc } from "@world/npc";

const BD = "/room/dream/office.jpg";
const seq = (lines: Parameters<typeof push>[1]["lines"]) => push(EMPTY_DIALOGUE, { key: "t", lines, ending: { kind: "none" } });

describe("npc.json poses", () => {
  it("lists real files for the standing NPCs and keeps the loader strict", () => {
    expect(npcData.npcs.boss?.poses).toContain("p1");
    expect(npcData.npcs.boss?.poses).toContain("assim");
    expect(npcData.npcs.boss?.idle).toBe(true);
    expect(npcData.assimFrom).toBe(13);
    expect(() => parseNpc({ npcs: { a: { name: "n", portrait: "p", avatar: "a", poses: ["p1"] } }, silhouettes: [] })).toThrow(/poses/);
    expect(() => parseNpc({ npcs: {}, silhouettes: [], assimFrom: "soon" })).toThrow(/assimFrom/);
  });
  it("resolves a pose, falls back to the plain stand, and stands assimilated from assimFrom", () => {
    expect(npcStandFor("boss", "p2", 1)).toBe("/npc/stand/boss_p2.webp");
    expect(npcStandFor("boss", "dance", 1)).toBe("/npc/stand/boss.webp");
    expect(npcStandFor("boss", undefined, 1)).toBe("/npc/stand/boss.webp");
    expect(npcStandFor("boss", undefined, 13)).toBe("/npc/stand/boss_assim.webp");
    expect(npcStandFor("boss", "laugh", 13)).toBe("/npc/stand/boss_laugh.webp");
    expect(npcStandFor("teacher", undefined, 13)).toBe("/npc/stand/teacher.webp"); // no assim drawn
    expect(npcStandFor("member", "p1", 1)).toBeNull();
    expect(npcIdle("boss")).toBe("/anim/stand/boss_idle.webm");
    expect(npcIdle("同桌")).toBeNull();
  });
});

describe("sceneOf with poses", () => {
  it("a pose holds for the NPC until the next pose or a new backdrop; the idle loop only on the plain stand", () => {
    const d = seq([
      { k: "narration", t: "a", backdrop: BD },
      { k: "speaker", who: "boss", t: "b", pose: "p2" },
      { k: "narration", t: "c" },
      { k: "speaker", who: "boss", t: "d" },
      { k: "narration", t: "e", backdrop: "/room/dream/table.jpg" },
      { k: "speaker", who: "boss", t: "f" },
    ]);
    expect(sceneOf({ ...d, line: 1 }, 1).stand).toBe("/npc/stand/boss_p2.webp");
    expect(sceneOf({ ...d, line: 1 }, 1).standIdle).toBeUndefined();
    expect(sceneOf({ ...d, line: 3 }, 1).stand).toBe("/npc/stand/boss_p2.webp");
    expect(sceneOf({ ...d, line: 5 }, 1).stand).toBe("/npc/stand/boss.webp");
    expect(sceneOf({ ...d, line: 5 }, 1).standIdle).toBe("/anim/stand/boss_idle.webm");
  });
  it("the assimilated default from day 13, and two-up keeps each person's pose", () => {
    const d = seq([
      { k: "narration", t: "a", backdrop: BD },
      { k: "speaker", who: "partner", t: "b", pose: "angry" },
      { k: "speaker", who: "boss", t: "c" },
    ]);
    const s = sceneOf({ ...d, line: 2 }, 13);
    expect(s.stand).toBe("/npc/stand/boss_assim.webp");
    expect(s.other).toBe("/npc/stand/partner_angry.webp");
    expect(s.standIdle).toBeUndefined();
    expect(sceneOf({ ...d, line: 2 }, 1).stand).toBe("/npc/stand/boss.webp");
  });
});
