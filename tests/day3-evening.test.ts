// Day 3's evening (author 2026-11-08): the dinner waits for the night's work (the call's task); until
// then eating says room.eat.later and logs nothing; after the task it is eaten.
import { describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { initialSession, type Session } from "@world/desktop/model";
import { loopActions } from "@world/room/game";
import type { ActionContext } from "@world/desktop/controller";
import { t } from "@world/i18n";

function day3(): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < 3) store.appendEvent({ kind: "lieDown" });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "order", meal: "dinner", shopId: "huangmenji", itemId: "hmj", t: "18:30" });
  store.appendEvent({ kind: "step", name: "delivery:arrives:dinner", t: "19:00" });
  store.appendEvent({ kind: "pickup", meal: "dinner" });
  return store;
}
function rig(store: Store, view: Session["view"]) {
  const session = initialSession({ beat: "desk", time: "19:10" }, "left", view);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
  return { ctx, session, act: (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never) };
}

describe("day 3: the dinner waits for the night's work", () => {
  it("before the call's task is done, eating at the table only says room.eat.later; after it, the dinner is eaten", () => {
    const store = day3();
    const r = rig(store, "table");
    r.act("loop-eat", { meal: "dinner" });
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "eat:dinner")).toBe(false);
    expect(r.session.dialogue.queue[0]?.lines[0]?.t).toBe(t("room.eat.later"));
    store.appendEvent({ kind: "task", flag: "task_d3_3", mode: "self", slots: { r1: "o1c", r2: "o2c", r3: "o3c", r4: "o4c", r5: "o5c", r6: "o6" }, assists: 0 });
    const r2 = rig(store, "table");
    r2.act("loop-eat", { meal: "dinner" });
    expect(store.getEvents().some((e) => e.kind === "step" && e.name === "eat:dinner")).toBe(true);
  });
});
