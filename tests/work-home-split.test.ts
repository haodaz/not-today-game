// desktop-ui correction 2026-11-02 (evening), tingtalk 2026-11-04: three apps. 听听 / TingTalk holds
// boss / partner / group / xiaozhang / laozhou (DingTalk register, moved out of 工作台 unchanged);
// Hi信 / Hichat (the `msgs` app) holds 家里 and 朋友圈 (WeChat desktop look); 工作台 holds home and
// the task pages, no conversation. The reply tables and events are untouched: only which app shows
// which conversation changes. Each dock tile counts its own unread.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { recipientsOn } from "@state/replies/resolve";
import { FAMILY_GROUPS } from "@state/replies/table";
import { createStore, type Store } from "@state/store";
import { constants } from "@state/variables";
import { appOfThread, threadsIn, WORK_THREADS } from "@world/desktop/messages/threads";
import { renderMessages, renderTingTalk, renderWorkMessages, threadsUnread } from "@world/desktop/messages/view";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { hasString, t } from "@world/i18n";
import { messageActions } from "@world/desktop/messages/actions";
import type { ActionContext } from "@world/desktop/controller";
import { itemStates, loopContext } from "@world/loop/checklist";
import { loopActions } from "@world/room/game";

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
  it("property: on every day, each conversation appears in exactly one of 听听 and Hi信; none in 工作台", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: constants.lastDay }), (day) => {
        const store = storeAt(day);
        const work = new Set(convsIn(renderTingTalk(ctxFor(store)).body.value));
        const home = new Set(convsIn(renderMessages(ctxFor(store)).body.value));
        for (const id of recipientsOn(day)) expect(Number(work.has(id)) + Number(home.has(id)), `d${day} ${id}`).toBe(1);
        expect([...work].every((id) => recipientsOn(day).includes(id))).toBe(true);
        expect([...home].every((id) => recipientsOn(day).includes(id))).toBe(true);
        expect(convsIn(renderWorkbench(ctxFor(store)).body.value)).toEqual([]);
      }),
      { numRuns: 18 },
    );
  });

  it("the work threads only in 听听, the family only in Hi信", () => {
    for (let day = 1; day <= constants.lastDay; day++) {
      const store = storeAt(day);
      const tt = renderTingTalk(ctxFor(store)).body.value;
      for (const id of FAMILY_GROUPS) expect(tt, `d${day} ${id}`).not.toContain(`data-conv="${id}"`);
      const home = renderMessages(ctxFor(store)).body.value;
      for (const id of WORK_THREADS) expect(home, `d${day} ${id}`).not.toContain(`data-conv="${id}"`);
    }
    expect(threadsIn("msgs", 1)).toEqual(["family", "clan"]);
    expect(threadsIn("tingtalk", 1)).toEqual(["boss", "partner", "group", "xiaozhang", "laozhou"]);
    expect(appOfThread("laozhou")).toBe("tingtalk");
    expect(appOfThread("clan")).toBe("msgs");
  });

  it("each app counts its own: Hi信 the personal threads, 听听 the work ones, 工作台 none", () => {
    for (const day of [1, 6, 13]) {
      const ctx = ctxFor(storeAt(day));
      expect(renderMessages(ctx).badge).toBe(threadsUnread(ctx, "msgs"));
      expect(renderTingTalk(ctx).badge).toBe(threadsUnread(ctx, "tingtalk"));
    }
    // Day 1 at 10:00: the boss's voice note is unread, and it is not Hi信's.
    const ctx = ctxFor(storeAt(1));
    expect(threadsUnread(ctx, "tingtalk")).toBeGreaterThan(0);
    const homeOnly = threadsUnread(ctx, "msgs");
    // The Hi信 count does not move when a work conversation is opened.
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

describe("看一眼消息 is done by opening 听听 (the boss lives there)", () => {
  it("showing 听听 fires the openApp:msgs step once a day, so day 1's 「进屏幕，看一眼消息」 completes; 工作台 and Hi信 do not", () => {
    const store = storeAt(1);
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    const session = initialSession({ beat: "boot", time: "09:03" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    const steps = () => store.getEvents().filter((e) => e.kind === "step" && e.name === "openApp:msgs").length;
    loopActions["dock"]!(ctx, { app: "workbench" } as DOMStringMap, null as never);
    loopActions["dock"]!(ctx, { app: "msgs" } as DOMStringMap, null as never);
    expect(steps()).toBe(0);
    // 听听 is on the right monitor: the 右屏 toggle shows it.
    loopActions["screen"]!(ctx, { screen: "right" } as DOMStringMap, null as never);
    expect(steps()).toBe(1);
    loopActions["screen"]!(ctx, { screen: "left" } as DOMStringMap, null as never);
    loopActions["dock"]!(ctx, { app: "tingtalk" } as DOMStringMap, null as never);
    expect(session.focus).toBe("right");
    expect(steps()).toBe(1);
    const lc = loopContext(store.getState(), store.getEvents())!;
    const item = lc.file.items.find((i) => i.done.kind === "event" && i.done.event.type === "openApp" && i.done.event.app === "msgs")!;
    expect(itemStates(lc).get(item.id)!.done).toBe(true);
  });
});

describe("听听 (DingTalk register, as 工作台·消息 was)", () => {
  it("Vivi's role line sits under the name in the head; 工作台's rail has no 消息 item any more", () => {
    const store = storeAt(1);
    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:00" }); // guidance G3: a row clicked
    const session = initialSession({ beat: "work", time: "10:00" });
    session.conversation = "partner";
    const out = renderTingTalk(ctxFor(store, session)).body.value;
    expect(out).toContain(`<div class="head"><b>${t("msgs.partner")}</b> <small>${t("msgs.partner.role")}</small></div>`);
    session.wbSidebar = true; // shell R10: the section icons live in the overlay sidebar
    const wb = renderWorkbench(ctxFor(store, session)).body.value;
    for (const key of ["wb.nav.home", "wb.nav.docs", "wb.nav.approvals", "wb.nav.contacts"]) expect(wb, key).toContain(t(key));
    expect(wb).not.toContain('data-page="msgs"');
    expect(wb).not.toContain(t("wb.nav.msgs"));
  });

  it("the player's own messages carry 已读 or 未读; the boss's voice its DING (when strings have the words)", () => {
    const store = storeAt(1);
    store.appendEvent({ kind: "reply", choice: "salary", recipient: "boss", t: "09:03" });
    store.appendEvent({ kind: "open", target: "conv:boss", t: "09:04" }); // guidance G3: a row clicked
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
    it(`day ${day}: 听听 and Hi信`, () => {
      const store = storeAt(day);
      const work = renderTingTalk(ctxFor(store)).body.value;
      const home = renderMessages(ctxFor(store)).body.value;
      const clan = renderMessages(ctxFor(store, Object.assign(initialSession({ beat: "work", time: "10:00" }), { homeConversation: "clan" }))).body.value;
      expect({ work, home, clan }).toMatchSnapshot();
    });
  }
});
