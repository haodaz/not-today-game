import { describe, expect, it } from "vitest";
import fixture from "./fixtures/workbench-day.json";
import { createStore } from "@state/store";
import { ringOf } from "@state/stages";
import { browserPages } from "@world/desktop/browser/data";
import { footerDate, renderBrowser } from "@world/desktop/browser/view";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type WorkbenchPage } from "@world/desktop/model";
import { RINGS } from "@world/desktop/rings";
import { workbenchActions } from "@world/desktop/workbench/actions";
import { parseWorkbenchDay, workbenchDays } from "@world/desktop/workbench/data";
import { CHANGELOG_COLLAPSE_DAY, renderWorkbench } from "@world/desktop/workbench/view";
import { escapeHtml } from "@world/html";
import { threadsUnread } from "@world/desktop/messages/view";
import { t } from "@world/i18n";

const NOW_MS = Date.UTC(2026, 9, 31, 12);
const days = new Map([[1, parseWorkbenchDay(fixture, "fixture")]]);

function ctx(day: number, page: WorkbenchPage = "home"): AppContext {
  const store = createStore({ startDay: day });
  const session = initialSession({ beat: "work", time: "10:00" });
  session.workbenchPage = page;
  return { state: store.getState(), events: [], startDay: day, session, night: false, nowMs: NOW_MS };
}

describe("workbench data", () => {
  it("has no content yet; the guard accepts the proposed schema and rejects unknown keys", () => {
    expect(workbenchDays.size).toBe(0);
    expect(() => parseWorkbenchDay(fixture, "f")).not.toThrow();
    expect(() => parseWorkbenchDay({ ...fixture, extra: 1 }, "f")).toThrow(/unknown key "extra"/);
    expect(() => parseWorkbenchDay({ day: 1, doing: [{ title: "a", status: "b", tone: "loud" }] }, "f")).toThrow(/tone/);
  });
});

describe("workbench home", () => {
  it("without day data shows the structure from strings and the store's numbers", () => {
    const c = ctx(1);
    const out = renderWorkbench(c).body.value;
    for (const key of ["wb.title", "wb.search", "wb.nav.home", "wb.hello.morning", "wb.ask.ph", "wb.scope", "wb.card.ledger", "wb.common", "wb.continue"]) {
      expect(out, key).toContain(escapeHtml(t(key)));
    }
    // The choice is a reply (work 2026-11-02): no mode toolbar under the input.
    expect(out).not.toContain("wb-mode");
    expect(out).not.toContain(escapeHtml(t("wb.mode.look")));
    expect(out).toContain(`<div class="big">${c.state.overdueDays}<small>`);
  });

  it("with day data fills cards, sidebar jobs and the docs tag; the badge counts the jobs and the work conversations' unread", () => {
    const c = ctx(1);
    const result = renderWorkbench(c, days);
    // The work conversations moved into 工作台 (desktop-ui 2026-11-02, evening): their unread count here.
    expect(result.badge).toBe(fixture.doing.length + threadsUnread(c, "workbench"));
    expect(threadsUnread(c, "workbench")).toBeGreaterThan(0);
    expect(result.body.value).toContain('<span class="tag">v2</span>');
    expect(result.body.value).toContain('<span class="r">status one</span>');
    expect(result.body.value).toContain('<em class="g">status two</em>');
  });

  it("the changelog collapses to one line from the first day of the second ring (U5)", () => {
    expect(ringOf(CHANGELOG_COLLAPSE_DAY)).toBe(RINGS[1]);
    expect(ringOf(CHANGELOG_COLLAPSE_DAY - 1)).toBe(RINGS[0]);
    const late = new Map([[CHANGELOG_COLLAPSE_DAY, { ...days.get(1)!, day: CHANGELOG_COLLAPSE_DAY }]]);
    const out = renderWorkbench(ctx(CHANGELOG_COLLAPSE_DAY, "code"), late).body.value;
    expect(out).toContain('<p class="line"></p>');
    expect(out).not.toContain("change two");
  });
});

describe("workbench inner pages", () => {
  it("文档: two columns with the player's and Kuro's marks, and Kuro's +/− counts", () => {
    const out = renderWorkbench(ctx(1, "docs"), days).body.value;
    expect(out).toContain('class="cl y"');
    expect(out).toContain('class="cl add"');
    expect(out).toContain(">+1</span>");
    expect(out).toContain(">−1</span>");
    for (const key of ["wb.docs.side", "wb.docs.look", "wb.docs.merge"]) expect(out).toContain(escapeHtml(t(key)));
  });

  it("账本: the overdue cell is the store's yesterday → today; your salary row is marked; names filled", () => {
    const c = ctx(1, "ledger");
    const out = renderWorkbench(c, days).body.value;
    expect(out).toContain(`<td class="n red">${c.state.overdueDays - 1} → ${c.state.overdueDays}</td>`);
    expect(out).toContain('<tr class="me">');
    expect(out).toContain(c.state.names.calledBy);
    expect(out).toContain(escapeHtml(t("wb.ledger.model.note")));
  });

  it("代码: code with token classes and the changelog before the collapse day", () => {
    const out = renderWorkbench(ctx(1, "code"), days).body.value;
    expect(out).toContain('<span class="kw">export</span>');
    expect(out).toContain('<span class="c">// note</span>');
    expect(out).toContain("change two");
  });

  it("wb-nav switches pages and ignores unknown ones", () => {
    const store = createStore();
    const session = initialSession({ beat: "work", time: "10:00" });
    const actx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    workbenchActions["wb-nav"]!(actx, { page: "ledger" } as DOMStringMap, null as never);
    expect(session.workbenchPage).toBe("ledger");
    workbenchActions["wb-nav"]!(actx, { page: "attic" } as DOMStringMap, null as never);
    expect(session.workbenchPage).toBe("ledger");
  });
});

describe("browser", () => {
  it("renders the day's page in the newspaper layout, with the URL bar and today's date", () => {
    const c = ctx(1);
    const { body, bar } = renderBrowser(c);
    const page = browserPages.get(1)!;
    expect(bar.value).toContain(escapeHtml(page.site));
    expect(body.value).toContain(escapeHtml(page.lead.h));
    expect(body.value).toContain('class="num down"');
    expect(body.value).toContain(escapeHtml(t("browser.reading")));
    expect(body.value).toContain(footerDate(NOW_MS));
  });

  it("empty fields render empty", () => {
    const blank = [...browserPages.values()].find((p) => p.numbers.some((n) => n.v === ""))!;
    const out = renderBrowser(ctx(blank.day)).body.value;
    expect(out).toContain('<div class="num"><b></b><small></small></div>');
  });

  it("the dock logs opening the browser", async () => {
    const { shellActions } = await import("@world/desktop/controller");
    const store = createStore();
    const session = initialSession({ beat: "work", time: "10:00" });
    shellActions.dock!({ store, session, rerender: () => {}, later: () => {} }, { app: "browser" } as DOMStringMap, null as never);
    expect(session.leftApp).toBe("browser");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "open", target: "browser", t: "10:00" });
  });
});
