// desktop-ui 2026-11-02 blocker: a deliverable message is a clickable card in the message panes;
// clicking it opens its page in the browser frame and logs `open file:<doc>`. This click is allowed
// while the Vivi lock is on (it is the way out): posted deliverable → lock → click → page shown,
// open logged, lock lifted, the download appears in 文件. Content has no deliverable yet, so the
// message card is tested through the transcript bubble + renderBody, and the flow with a lock hook.
import { afterEach, describe, expect, it } from "vitest";
import { parseDayFile } from "@state/replies/table";
import { deliverablePage } from "@state/files";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderFiles } from "@world/desktop/files/view";
import { renderBrowser } from "@world/desktop/browser/view";
import { setViviLockForTests, viviLock } from "@world/desktop/vivi";
import { renderBody } from "@world/desktop/messages/view";
import { loopActions } from "@world/room/game";
import { f } from "@state/fday";

afterEach(() => setViviLockForTests(undefined));

const DOC = "vivi-plan-1";
const PAGE = "/docs/vivi/plan-1-insight.html";

describe("the doc → page mapping comes from files.json", () => {
  it("the download whose afterOpen is the doc id gives its html page", () => {
    expect(deliverablePage(DOC)).toBe(PAGE);
    expect(deliverablePage("nope")).toBeNull();
  });
});

describe("a deliverable renders as a clickable card carrying its doc", () => {
  it("the loader accepts the deliverable, and renderBody makes it a button in both registers", () => {
    const table = parseDayFile({ day: 1, recipients: { group: { incoming: [{ t: "09:30", text: "[方案] 洞察引擎 v0.1", kind: "deliverable", doc: DOC }] } } }, "fixture");
    const incoming = table.recipients.get("group")!.incoming[0]!;
    expect(incoming.kind).toBe("deliverable");
    expect(incoming.doc).toBe(DOC);
    const names = f(1).names;
    for (const register of ["wx", "ding"] as const) {
      const markup = renderBody({ type: "deliverable", raw: incoming.text, doc: DOC }, names, register).value;
      expect(markup).toContain(`data-action="open-deliverable" data-doc="${DOC}"`);
      expect(markup).toContain("洞察引擎 v0.1");
    }
  });
});

function ctxOf(store: Store): ActionContext & { session: Session } {
  const session = initialSession({ beat: "work", time: "09:31" }, "left", "desktop");
  session.leftApp = "msgs";
  return { store, session, rerender() {}, later: () => {}, now: () => 0 };
}
const app = (ctx: ActionContext & { session: Session }): AppContext => ({ state: ctx.store.getState(), events: ctx.store.getEvents(), startDay: 1, session: ctx.session, night: false, nowMs: 0 });

describe("clicking the bubble opens the page, logs the open, lifts the lock, shows the download", () => {
  it("the whole flow, with the lock forced on", () => {
    setViviLockForTests(DOC);
    const store = createStore({ startDay: 4 });
    const ctx = ctxOf(store);
    // Locked before the click: every screen switch would be refused (viviLock returns the doc).
    expect(viviLock(store.getState(), store.getEvents(), "09:31")).toBe(DOC);

    loopActions["open-deliverable"]!(ctx, { doc: DOC } as DOMStringMap, null as never);

    // The browser is in front, showing the page in its frame.
    expect(ctx.session.leftApp).toBe("browser");
    expect(ctx.session.browserDoc).toBe(PAGE);
    expect(renderBrowser(app(ctx)).body.value).toContain(`src="${PAGE}"`);

    // The open event is logged with the doc id.
    expect(store.getEvents().filter((e) => e.kind === "open" && e.target === `file:${DOC}`)).toHaveLength(1);

    // The lock lifts (the forced lock still lifts once its doc is opened).
    expect(viviLock(store.getState(), store.getEvents(), "09:31")).toBeNull();

    // The download now appears in 文件 (its afterOpen is satisfied).
    ctx.session.filesApp = { which: "files", tab: "downloads", open: null };
    expect(renderFiles(app(ctx))!.value).toContain("洞察引擎_方案_v0.1.html");

    // A second click logs no second open (opened once).
    loopActions["open-deliverable"]!(ctx, { doc: DOC } as DOMStringMap, null as never);
    expect(store.getEvents().filter((e) => e.kind === "open" && e.target === `file:${DOC}`)).toHaveLength(1);

    // Closing the frame goes back to the news page.
    loopActions["br-doc-close"]!(ctx, {} as DOMStringMap, null as never);
    expect(ctx.session.browserDoc).toBeNull();
    expect(renderBrowser(app(ctx)).body.value).not.toContain(`src="${PAGE}"`);
  });

});
