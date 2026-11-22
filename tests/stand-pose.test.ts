// texture-pass R2: standing portraits with poses, the assimilated default and the idle loops.
import { describe, expect, it } from "vitest";
import { EMPTY_DIALOGUE, push, sceneOf } from "@world/loop/dialogue";
import { npcData, npcIdle, npcStandFor, parseNpc } from "@world/npc";
import { parseLine } from "@state/days/table";

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

// player-stands (2026-11-22): the player's own figure by a `me` pose, in their look.
describe("sceneOf with the player's pose", () => {
  it("stands at the side with an NPC (lit on the player's lines), alone over the room, until the sequence or a new backdrop", () => {
    const d = seq([
      { k: "narration", t: "a", backdrop: BD, me: "stand" },
      { k: "speaker", who: "boss", t: "b" },
      { k: "inner", t: "c", me: "cross" },
      { k: "narration", t: "e", backdrop: "/room/dream/table.jpg" },
      { k: "narration", t: "f", me: "" },
    ]);
    expect(sceneOf({ ...d, line: 0 }, 1, "she")).toMatchObject({ me: "/player/looks/she_stand.webp", meIdle: "/anim/looks/she_stand.webm", meSpeaking: true });
    expect(sceneOf({ ...d, line: 0 }, 1, "she").stand).toBeUndefined();
    expect(sceneOf({ ...d, line: 1 }, 1, "cap")).toMatchObject({ stand: "/npc/stand/boss.webp", me: "/player/looks/cap_stand.webp", meSpeaking: false });
    expect(sceneOf({ ...d, line: 2 }, 1, "cap")).toMatchObject({ stand: "/npc/stand/boss.webp", me: "/player/looks/cap_cross.webp", meSpeaking: true });
    expect(sceneOf({ ...d, line: 3 }, 1, "cap").me).toBeUndefined(); // a new backdrop sends the player off
    expect(sceneOf({ ...d, line: 1 }, 1).me).toBeUndefined(); // no look, no figure
    const room = seq([{ k: "narration", t: "x" }, { k: "inner", t: "y", me: "tired" }, { k: "narration", t: "z", me: "" }]);
    expect(sceneOf({ ...room, line: 0 }, 3, "he")).toEqual({ backdrop: null, prop: null });
    expect(sceneOf({ ...room, line: 1 }, 3, "he")).toEqual({ backdrop: null, prop: null, me: "/player/looks/he_tired.webp", meIdle: "/anim/looks/he_tired.webm", meSpeaking: true });
    expect(sceneOf({ ...room, line: 2 }, 3, "he").me).toBeUndefined();
  });
  it("the parser takes a known pose or an empty string only, and the twins must agree", () => {
    expect(parseLine({ k: "inner", t: "a", me: "tired" }, "x", undefined, true).me).toBe("tired");
    expect(parseLine({ k: "inner", t: "a", me: "" }, "x", undefined, true).me).toBe("");
    expect(() => parseLine({ k: "inner", t: "a", me: "fly" }, "x", undefined, true)).toThrow(/not a player pose/);
    expect(() => parseLine({ k: "inner", t: "a", me: "tired" }, "x")).toThrow(/unknown key "me"/);
  });
});
