// 换一件 (author 2026-11-16: 「门口的衣服平时点着交互，可以是"换一件"变成各种程序员格子衫。（3个颜色花样」;
// 2026-11-28: 「这两个都要」: the photo door wall and the code-built room).
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { klotskiRoomSrc } from "@world/desktop/workbench/klotski";
import { backdropFor } from "@world/fit";
import { t } from "@world/i18n";
import { COAT_OPTIONS, showing } from "@world/loop/dialogue";
import { COAT_KEY, readCoat, writeCoat } from "@world/room/coat";
import { loopActions } from "@world/room/game";

function ctxOf(): ActionContext {
  const store = createStore({ startDay: 1 });
  return { store, session: initialSession(DEFAULT_CLOCK, "left", "door"), rerender: () => {}, later: () => {} };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string>) => loopActions[name]!(ctx, data as DOMStringMap, null as never);

describe("换一件: the hook by the door", () => {
  it("the door wall is the same photograph with the garment changed; the files are there", () => {
    expect(backdropFor("door", true)).toBe("/room/door_wall.png");
    expect(backdropFor("door", true, 0)).toBe("/room/door_wall.png");
    for (const n of [1, 2, 3]) {
      expect(backdropFor("door", true, n)).toBe(`/room/door_wall_plaid${n}.jpg`);
      expect(fs.existsSync(`public/room/door_wall_plaid${n}.jpg`)).toBe(true);
    }
    expect(backdropFor("room", true, 2)).toBe("/room/shots/room.jpg"); // only the door wall shows the hook
  });

  it("clicking the garment says its line and asks: 换一件 / 就这件", () => {
    const ctx = ctxOf();
    act(ctx, "room-look", { look: "coat" });
    const q = ctx.session.dialogue.queue[0]!;
    expect(q.ending.kind).toBe("coatAsk");
    expect(showing(ctx.session.dialogue, ctx.store.getState(), ctx.store.getEvents())?.choices?.map((c) => t(c.labelKey!))).toEqual(["换一件", "就这件"]);
    expect(COAT_OPTIONS.map((c) => c.choice)).toEqual(["swap", "keep"]);
    // the other things in the room still only say their line
    const other = ctxOf();
    act(other, "room-look", { look: "bag" });
    expect(other.session.dialogue.queue[0]!.ending.kind).toBe("none");
  });

  it("换一件 goes round the four: three plaid shirts, then the jacket again; 就这件 changes nothing", () => {
    const ctx = ctxOf();
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      act(ctx, "room-look", { look: "coat" });
      act(ctx, "loop-choice", { choice: "swap" });
      seen.push(ctx.session.coat);
      const said = ctx.session.dialogue.queue.at(-1)!;
      expect(said.lines[0]!.t).toBe(t(`room.coat.swapped.${ctx.session.coat}`));
      ctx.session.dialogue = { ...ctx.session.dialogue, queue: [] };
    }
    expect(seen).toEqual([1, 2, 3, 0]);
    act(ctx, "room-look", { look: "coat" });
    act(ctx, "loop-choice", { choice: "keep" });
    expect(ctx.session.coat).toBe(0);
  });

  it("a shirt on the hook says its own line when looked at", () => {
    const ctx = ctxOf();
    ctx.session.coat = 2;
    act(ctx, "room-look", { look: "coat" });
    expect(ctx.session.dialogue.queue[0]!.lines[0]!.t).toBe("蓝绿格子衫。和上一件同一天买的，第二件半价。");
  });

  it("the browser remembers the garment, the run does not", () => {
    const box = new Map<string, string>();
    const storage = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
    expect(readCoat(storage)).toBe(0);
    writeCoat(3, storage);
    expect(box.get(COAT_KEY)).toBe("3");
    expect(readCoat(storage)).toBe(3);
    box.set(COAT_KEY, "9");
    expect(readCoat(storage)).toBe(0);
    expect(readCoat(null)).toBe(0);
  });

  it("the code-built room is told the garment: day 17's room at the door carries it in its address", () => {
    expect(klotskiRoomSrc(17)).not.toContain("coat");
    expect(klotskiRoomSrc(17, 2)).toContain("&coat=2");
    const room = fs.readFileSync("room3d/room.js", "utf8");
    expect(room).toContain("if (m.coat != null) setCoat(m.coat);");
    expect(room.match(/plaidTexture\("#/g)).toHaveLength(3);
  });
});
