// Author 2026-11-20: the night of day 1 — dinner is taken in and eaten before the desk and the
// shutdown; the bed refuses with its own word for a meal not eaten and for a screen still on.
import { describe, expect, it } from "vitest";
import { dayFiles } from "@state/days/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { t } from "@world/i18n";
import { showing } from "@world/loop/dialogue";
import { loopActions } from "@world/room/game";
import { completeUntil } from "./complete-items";

const rig = () => {
  const store = createStore({ startDay: 1 });
  const ctx: ActionContext = { store, session: initialSession(DEFAULT_CLOCK, "left", "room"), rerender: () => {}, later: () => {}, now: () => 0 };
  const bed = () => {
    ctx.session.dialogue = { queue: [], line: 0 };
    loopActions["bed"]!(ctx, {} as DOMStringMap, null as never);
    return showing(ctx.session.dialogue, store.getState(), store.getEvents())?.line?.t ?? null;
  };
  return { store, ctx, bed };
};

describe("day 1's night order", () => {
  it("dinner → the door → the table → the desk → the shutdown → the bed, in the file", () => {
    const ids = dayFiles.get(1)!.items.filter((it) => it.when === "night").map((it) => it.id);
    expect(ids).toEqual(["dinner", "dpick", "deat", "desk", "shutdown", "chat", "bed"]); // chat is quiet: in the graph, not on the card
    const by = Object.fromEntries(dayFiles.get(1)!.items.map((it) => [it.id, it]));
    expect(by.chat!.quiet).toBe(true);
    expect(by.dpick!.unlock).toEqual({ kind: "event", event: { type: "arrives", meal: "dinner" } });
    expect(by.deat!.unlock).toEqual({ kind: "done", id: "dpick" });
    expect(by.desk!.unlock).toEqual({ kind: "done", id: "deat" });
    expect(by.deat!.required && by.dpick!.required).toBe(true);
  });

  it("the bed's word: the meal first, then the screen, then the generic line; Kuro's voice from day 2", () => {
    const { store, bed } = rig();
    completeUntil(store, "dinner");
    expect(bed()).toBe(t("room.bed.hungry")); // from nightfall on, dinner is what stands between you and the bed
    completeUntil(store, "deat");
    expect(bed()).toBe(t("room.bed.hungry"));
    completeUntil(store, "desk");
    expect(bed()).toBe(t("room.bed.screen"));
    completeUntil(store, "bed");
    expect(bed()).not.toBe(t("room.bed.screen"));
  });
});
