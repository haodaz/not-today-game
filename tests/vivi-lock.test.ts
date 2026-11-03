// desktop-ui addition 2026-11-02 "Vivi's deliverable locks the screen until opened". No content uses
// kind:"deliverable" yet, so the loader shape is tested directly and the lock with a fixture day
// table. The lock engages on the posted message, refuses screen switches with the `vivi.lock` line,
// lifts on the `open file:<doc>` event, allows 回房间, and survives a reload (derived from the log).
import { describe, expect, it } from "vitest";
import { parseDayFile } from "@state/replies/table";
import { isOpenTarget, openedFileId } from "@state/events";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { postedDeliverables, viviLock } from "@world/desktop/vivi";
import { loopActions } from "@world/room/game";
import { f } from "@state/fday";
import { t } from "@world/i18n";

/** A day table whose 全员群 posts a deliverable at 09:30 carrying doc "vivi-plan-1". */
const table = parseDayFile(
  {
    day: 1,
    recipients: {
      group: { incoming: [{ t: "09:30", text: "[方案] 洞察引擎 v0.1", kind: "deliverable", doc: "vivi-plan-1" }] },
    },
  },
  "fixture",
);

describe("the loader: kind deliverable carries a doc; no other kind may", () => {
  it("accepts a deliverable with a doc", () => {
    const incoming = table.recipients.get("group")!.incoming[0]!;
    expect(incoming.kind).toBe("deliverable");
    expect(incoming.doc).toBe("vivi-plan-1");
  });
  it("rejects a doc on a non-deliverable, and a deliverable without a doc", () => {
    const base = { day: 1, recipients: { group: { incoming: [{ t: "09:30", text: "x", kind: "work", doc: "y" }] } } };
    expect(() => parseDayFile(base, "x")).toThrow(/only a deliverable may carry "doc"/);
    const noDoc = { day: 1, recipients: { group: { incoming: [{ t: "09:30", text: "x", kind: "deliverable" }] } } };
    expect(() => parseDayFile(noDoc, "x")).toThrow(/doc/);
  });
});

describe("the open target file:<id>", () => {
  it("is an open target; its id reads back", () => {
    expect(isOpenTarget("file:vivi-plan-1")).toBe(true);
    expect(openedFileId("file:vivi-plan-1")).toBe("vivi-plan-1");
    expect(openedFileId("browser")).toBeNull();
    expect(isOpenTarget("file:")).toBe(false);
  });
});

describe("the lock derived from the log", () => {
  const state = f(1);
  it("engages when the deliverable is posted and lifts once its doc is opened", () => {
    expect(postedDeliverables(state, "09:00", table)).toEqual([]); // before its time
    expect(postedDeliverables(state, "09:30", table)).toEqual(["vivi-plan-1"]);
    expect(viviLock(state, [], "09:30", table)).toBe("vivi-plan-1");
    const opened = [{ kind: "open", day: 1, target: "file:vivi-plan-1", t: "09:31" }] as const;
    expect(viviLock(state, opened, "09:30", table)).toBeNull();
  });
});

function ctxOf(store: Store, view: Session["view"] = "desktop"): ActionContext & { session: Session; renders: number } {
  const session = initialSession({ beat: "work", time: "09:30" }, "left", view);
  const ctx = { store, session, renders: 0, rerender() {}, later: () => {}, now: () => 0 } as unknown as ActionContext & { session: Session; renders: number };
  return ctx;
}
import { afterEach } from "vitest";
import { setViviLockForTests } from "@world/desktop/vivi";

afterEach(() => setViviLockForTests(undefined));

describe("the screen switches are refused while locked", () => {
  const box = (ctx: ActionContext) => ctx.session.dialogue.queue.map((q) => q.lines.map((l) => l.t).join("")).join("|");

  it("refuses dock / screen / wb-nav / feed / conv with the vivi.lock line; a refused switch logs and changes nothing", () => {
    setViviLockForTests("vivi-plan-1");
    for (const [name, data] of [["dock", { app: "browser" }], ["screen", { screen: "right" }], ["wb-nav", { page: "docs" }], ["feed", {}], ["conv", { conv: "boss" }]] as const) {
      const store = createStore({ startDay: 1 });
      const ctx = ctxOf(store);
      const before = store.getEvents().length;
      loopActions[name]!(ctx, data as DOMStringMap, null as never);
      expect(box(ctx), `${name} shows the lock line`).toContain(t("vivi.lock"));
      expect(store.getEvents().length, `${name} logs nothing`).toBe(before);
      expect(ctx.session.leftApp, `${name} did not switch app`).toBe("msgs");
      expect(ctx.session.workbenchPage, `${name} did not switch page`).toBe("home");
    }
  });

  it("allows 回房间 while locked (the lock is about the screen, not the room)", () => {
    setViviLockForTests("vivi-plan-1");
    const ctx = ctxOf(createStore({ startDay: 1 }));
    loopActions["view"]!(ctx, { view: "room" } as DOMStringMap, null as never);
    expect(ctx.session.view).toBe("room");
  });

  it("lifts once the doc is opened (survives reload: it is read from the log)", () => {
    setViviLockForTests("vivi-plan-1");
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "open", target: "file:vivi-plan-1", t: "09:31" });
    const ctx = ctxOf(store);
    loopActions["dock"]!(ctx, { app: "browser" } as DOMStringMap, null as never);
    expect(ctx.session.leftApp).toBe("browser");
  });
});
