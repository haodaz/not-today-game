// Author's playtest 2026-11-25. #75: on day 1 「看看老王又说了些什么吧。」 is said as 汀汀 opens, before
// 老王's row is lit; the player clicks the lit row; then 老王's words are there and Kuro says the voice
// notes were turned into text.
import "./specimen";
import { describe, expect, it } from "vitest";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { shellActions } from "@world/desktop/controller";
import { messageActions } from "@world/desktop/messages/actions";
import { showing } from "@world/loop/dialogue";
import { guideNow } from "@world/loop/guide";
import { syncLoop } from "@world/loop/runtime";
import { settleSession } from "@world/dialogue/place";
import { loopActions } from "@world/room/game";
import { dayFiles } from "@state/days/table";
import { completeUntil } from "./complete-items";

describe("#75 day 1: the line before 老王's row is lit", () => {
  it("汀汀 opens → 「看看老王…」 → the row is lit → clicked → Kuro's line on the voice notes", () => {
    const store = createStore({ startDay: 1, patch: { fullness: 100 } as never });
    completeUntil(store, "msgs");
    const session = initialSession({ beat: "work", time: "09:00" }, "left", "desktop");
    session.onboard = "done";
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1_000 };
    const act = (name: string, data: Record<string, string> = {}) => (loopActions[name] ?? shellActions[name] ?? messageActions[name])!(ctx, data as DOMStringMap, null as never);
    const line = () => showing(session.dialogue, store.getState(), store.getEvents())?.line;
    const say = dayFiles.get(1)!.items.find((i) => i.id === "msgs")!.onDone!.say;
    syncLoop(ctx, 0);
    act("dock", { app: "tingtalk" });
    syncLoop(ctx, 0);
    settleSession(session);
    expect(line()?.t).toBe(say[0]!.t); // said in 汀汀, no conversation open yet
    expect(guideNow(store.getState(), store.getEvents(), session)).toBeNull(); // the box owns the screen meanwhile
    act("loop-advance");
    settleSession(session);
    expect(line()).toBeUndefined(); // the rest waits for 老王's thread
    expect(guideNow(store.getState(), store.getEvents(), session)).toMatchObject({ target: { kind: "conv", id: "boss" } });
    act("conv", { conv: "boss" });
    settleSession(session);
    expect(line()?.t).toBe(say[1]!.t);
    expect(say[1]!.who).toBe("kuro");
  });
});
