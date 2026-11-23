// texture-pass R2: standing portraits with poses, the assimilated default and the idle loops.
import { describe, expect, it } from "vitest";
import { EMPTY_DIALOGUE, push, sceneOf, splitVoices } from "@world/loop/dialogue";
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
  it("stands alone with its loop; never beside a standing NPC or on another person's line; off at a new backdrop or `\"\"`", () => {
    const d = seq([
      { k: "narration", t: "a", backdrop: BD, me: "stand" },
      { k: "speaker", who: "boss", t: "b" },
      { k: "inner", t: "c", me: "cross" },
      { k: "narration", t: "e", backdrop: "/room/dream/table.jpg", me: "tired" },
      { k: "narration", t: "f", me: "" },
    ]);
    expect(sceneOf({ ...d, line: 0 }, 1, "she")).toMatchObject({ me: "/player/looks/she_stand.webp", meIdle: "/anim/looks/she_stand.webm" });
    expect(sceneOf({ ...d, line: 0 }, 1, "she").stand).toBeUndefined();
    expect(sceneOf({ ...d, line: 1 }, 1, "cap")).toMatchObject({ stand: "/npc/stand/boss.webp" });
    expect(sceneOf({ ...d, line: 1 }, 1, "cap").me).toBeUndefined(); // the boss stands: no player figure
    expect(sceneOf({ ...d, line: 2 }, 1, "cap").me).toBeUndefined(); // he keeps standing through the player's line
    expect(sceneOf({ ...d, line: 3 }, 1, "cap")).toMatchObject({ me: "/player/looks/cap_tired.webp" }); // new backdrop, alone again
    expect(sceneOf({ ...d, line: 4 }, 1, "cap").me).toBeUndefined();
    expect(sceneOf({ ...d, line: 0 }, 1).me).toBeUndefined(); // no look, no figure
    const room = seq([{ k: "narration", t: "x" }, { k: "inner", t: "y", me: "tired" }, { k: "speaker", who: "laozhou", t: "z" }, { k: "inner", t: "k" }]);
    expect(sceneOf({ ...room, line: 0 }, 3, "he")).toEqual({ backdrop: null, prop: null });
    expect(sceneOf({ ...room, line: 1 }, 3, "he")).toEqual({ backdrop: null, prop: null, me: "/player/looks/he_tired.webp", meIdle: "/anim/looks/he_tired.webm" });
    expect(sceneOf({ ...room, line: 2 }, 3, "he").me).toBeUndefined(); // another person's line in the room
    expect(sceneOf({ ...room, line: 3 }, 3, "he").me).toBe("/player/looks/he_tired.webp"); // back on the player's own line
    // Kuro's lines are their own piece (splitVoices): the pose carries into the player's next piece, not Kuro's
    const pieces = splitVoices({ key: "d3:call", lines: [{ k: "speaker", who: "kuro", t: "你还没吃饭呢。", me: "tired" }, { k: "speaker", who: "me", t: "好，吃了再睡。" }], ending: { kind: "none" } });
    expect(pieces.map((p) => p.lines[0]?.me)).toEqual(["tired", "tired"]);
    expect(sceneOf({ queue: [pieces[0]!], line: 0 }, 3, "he").me).toBeUndefined();
    expect(sceneOf({ queue: [pieces[1]!], line: 0 }, 3, "he").me).toBe("/player/looks/he_tired.webp");
  });
  it("the parser takes a known pose or an empty string only, and the twins must agree", () => {
    expect(parseLine({ k: "inner", t: "a", me: "tired" }, "x", undefined, true).me).toBe("tired");
    expect(parseLine({ k: "inner", t: "a", me: "" }, "x", undefined, true).me).toBe("");
    expect(() => parseLine({ k: "inner", t: "a", me: "fly" }, "x", undefined, true)).toThrow(/not a player pose/);
    expect(() => parseLine({ k: "inner", t: "a", me: "tired" }, "x")).toThrow(/unknown key "me"/);
  });
});
