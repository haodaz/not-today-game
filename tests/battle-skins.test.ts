// texture-pass R4: per-day monsters in the work-game battle, the party2 object sprites in the boss fight.
import { describe, expect, it } from "vitest";
import { foeImage } from "@world/desktop/workbench/battle";
import { objectSprite } from "@world/endings/boss";

const task = { board: { stack: true } } as unknown as Parameters<typeof foeImage>[0];
describe("foeImage", () => {
  it("is the day's monster on days 4–18, the generic one otherwise", () => {
    expect(foeImage(task, 4)).toBe("/battle/mons/mon_d04.gb.png");
    expect(foeImage(task, 18)).toBe("/battle/mons/mon_d18.gb.png");
    expect(foeImage(task, 3)).toBe("/battle/mon-stamp.gb.png");
    expect(foeImage(task)).toBe("/battle/mon-stamp.gb.png");
    expect(foeImage({ board: {} } as never, 1)).toBe("/battle/mon-brief.gb.png");
  });
});
describe("objectSprite", () => {
  it("has a stance, a strike and a hurt frame; a throw or flip is a strike", () => {
    expect(objectSprite("chick")).toBe("/battle/party2/obj_chick_stance.png");
    expect(objectSprite("tape", "hurt")).toBe("/battle/party2/obj_tape_hurt.png");
    expect(objectSprite("phone", "throw")).toBe("/battle/party2/obj_phone_strike.png");
    expect(objectSprite("pager", "assim")).toBe("/battle/party2/obj_pager_assim.png");
  });
});
