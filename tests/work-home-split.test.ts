// desktop-ui correction 2026-11-02 (evening): work in the work app, home in the home app. 工作台's
// 消息 pane holds boss / partner / group / xiaozhang / laozhou (DingTalk register); 消息 holds 家里
// and 朋友圈 (WeChat desktop look). The reply tables and events are untouched: only which app shows
// which conversation changes. Each dock tile counts its own unread.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { recipientsOn } from "@state/replies/resolve";
import { FAMILY_GROUPS } from "@state/replies/table";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { appOfThread, threadsIn, WORK_THREADS } from "@world/desktop/messages/threads";
import { renderMessages, renderWorkMessages, threadsUnread } from "@world/desktop/messages/view";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { hasString, t } from "@world/i18n";
import { messageActions } from "@world/desktop/messages/actions";
import type { ActionContext } from "@world/desktop/controller";

function storeAt(day: number): Store {
  const store = createStore({ startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
}
function ctxFor(store: Store, session: Session = initialSession({ beat: "work", time: "10:00" })): AppContext {
  return { state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: 0 };
}
const convsIn = (markup: string) => [...markup.matchAll(/data-conv="([^"]+)"[^>]*data-action="conv"|data-action="conv" data-conv="([^"]+)"/g)].map((m) => m[1] ?? m[2]!);

describe("which app shows which conversation", () => {
  it("property: on every day, each conversation appears in exactly one app", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: constants.lastDay }), (day) => {
        const store = storeAt(day);
        const work = new Set(convsIn(renderWorkMessages(ctxFor(store)).pane.value));
        const home = new Set(convsIn(renderMessages(ctxFor(store)).body.value));
        for (const id of recipientsOn(day)) expect(Number(work.has(id)) + Number(home.has(id)), `d${day} ${id}`).toBe(1);
        expect([...work].every((id) => recipientsOn(day).includes(id))).toBe(true);
        expect([...home].every((id) => recipientsOn(day).includes(id))).toBe(true);
      }),
      { numRuns: 18 },
    );
  });

  it("the family groups never appear in 工作台; the work ones never in 消息", () => {
    for (let day = 1; day <= constants.lastDay; day++) {
      const store = storeAt(day);
      const wb = renderWorkbench(ctxFor(store, Object.assign(initialSession({ beat: "work", time: "10:00" }), { workbenchPage: "msgs" as const }))).body.value;
      for (const id of FAMILY_GROUPS) expect(wb, `d${day} ${id}`).not.toContain(`data-conv="${id}"`);
      const home = renderMessages(ctxFor(store)).body.value;
      for (const id of WORK_THREADS) expect(home, `d${day} ${id}`).not.toContain(`data-conv="${id}"`);
    }
    expect(threadsIn("msgs", 1)).toEqual(["family", "clan"]);
    expect(threadsIn("workbench", 1)).toEqual(["boss", "partner", "group", "xiaozhang", "laozhou"]);
    expect(appOfThread("laozhou")).toBe("workbench");
  });

  it("the 消息 badge counts only the personal threads; 工作台's adds the work ones' unread", () => {
    for (const day of [1, 6, 13]) {
      const ctx = ctxFor(storeAt(day));
      expect(renderMessages(ctx).badge).toBe(threadsUnread(ctx, "msgs"));
      expect(renderWorkMessages(ctx).badge).toBe(threadsUnread(ctx, "workbench"));
    }
    // Day 1 at 10:00: the boss's voice note is unread, and it is not 消息's.
    const ctx = ctxFor(storeAt(1));
    expect(threadsUnread(ctx, "workbench")).toBeGreaterThan(0);
    const homeOnly = threadsUnread(ctx, "msgs");
    // The 消息 count does not move when a work conversation is opened.
    const store = storeAt(1);
    store.appendEvent({ kind: "open", target: "conv:boss", t: "10:00" });
    expect(renderMessages(ctxFor(store)).badge).toBe(homeOnly);
  });

  it("opening a row sets the conversation of the app that holds it", () => {
    const store = storeAt(1);
    const session = initialSession({ beat: "work", time: "10:00" });
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    messageActions.conv!(ctx, { conv: "clan" } as DOMStringMap, null as never);
    expect(session).toMatchObject({ homeConversation: "clan", conversation: "boss" });
    messageActions.conv!(ctx, { conv: "partner" } as DOMStringMap, null as never);
    expect(session).toMatchObject({ homeConversation: "clan", conversation: "partner" });
    messageActions.feed!(ctx, {} as DOMStringMap, null as never);
    expect(session.homeConversation).toBe("feed");
    // The events are the same as before the split: `open conv:<id>` for conversations, nothing for 朋友圈.
    expect(store.getEvents().filter((e) => e.kind === "open").map((e) => (e as { target: string }).target)).toEqual(["conv:clan", "conv:partner"]);
  });

  it("a reply bar sends to its own conversation (data-conv), never with the other app's chip", () => {
    const store = storeAt(1);
    const session = initialSession({ beat: "work", time: "10:00" });
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (_ms, fn) => fn() };
    messageActions.chip!(ctx, { word: "fine", conv: "clan" } as DOMStringMap, null as never);
    messageActions.send!(ctx, { conv: "clan" } as DOMStringMap, null as never);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "reply", recipient: "clan", choice: "fine" });
    // A word the family's menu does not have is not sent there.
    session.selected = "salary";
    const before = store.getEvents().length;
    messageActions.send!(ctx, { conv: "family" } as DOMStringMap, null as never);
    expect(store.getEvents()).toHaveLength(before);
  });
});

describe("工作台's 消息 pane (DingTalk register)", () => {
  it("Vivi's role line sits under the name in the head; the rail has 消息 / 工作台 / 文档 / 审批 / 通讯录", () => {
    const store = storeAt(1);
    const session = initialSession({ beat: "work", time: "10:00" });
    session.workbenchPage = "msgs";
    session.conversation = "partner";
    const out = renderWorkbench(ctxFor(store, session)).body.value;
    expect(out).toContain(`<div class="head"><b>${t("msgs.partner")}</b> <small>${t("msgs.partner.role")}</small></div>`);
    for (const key of ["wb.nav.msgs", "wb.nav.home", "wb.nav.docs", "wb.nav.approvals", "wb.nav.contacts"]) expect(out, key).toContain(t(key));
    expect(out).toContain('class="ri on" data-action="wb-nav" data-page="msgs"');
  });

  it("the player's own messages carry 已读 or 未读; the boss's voice its DING (when strings have the words)", () => {
    const store = storeAt(1);
    store.appendEvent({ kind: "reply", choice: "salary", recipient: "boss", t: "09:03" });
    const session = initialSession({ beat: "work", time: "12:00" });
    const out = renderWorkMessages(ctxFor(store, session)).pane.value;
    expect(out).toMatch(/<div class="rcpt read">已读<\/div>|<div class="rcpt unread">/);
    expect(out).not.toContain('<div class="read">');
    if (hasString("wb.msgs.ding")) expect(out).toContain('<span class="ding">');
    else expect(out).not.toContain('class="ding"');
  });
});

describe("snapshots", () => {
  for (const day of [1, 13]) {
    it(`day ${day}: 工作台·消息 and 消息`, () => {
      const store = storeAt(day);
      const wbSession = initialSession({ beat: "work", time: "10:00" });
      wbSession.workbenchPage = "msgs";
      const work = renderWorkbench(ctxFor(store, wbSession)).body.value;
      const home = renderMessages(ctxFor(store)).body.value;
      const clan = renderMessages(ctxFor(store, Object.assign(initialSession({ beat: "work", time: "10:00" }), { homeConversation: "clan" }))).body.value;
      expect({ work, home, clan }).toMatchSnapshot();
    });
  }
});
