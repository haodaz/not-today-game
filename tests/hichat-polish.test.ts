// @vitest-environment happy-dom
// hichat-polish (author 2026-11-28, #188–#198): four small things in Hi信. R1 Dad's 2,000 as a
// transfer card (pending on its day, returned from any later day; not clickable; [转账] in the list).
import "./specimen";
import { afterEach, describe, expect, it } from "vitest";
import { dayTable, parseDayFile } from "@state/replies/table";
import { createStore } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { previewOf } from "@world/desktop/messages/bubbles";
import { renderMessages } from "@world/desktop/messages/view";
import { initialSession } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";

afterEach(() => setLocale("zh"));

function render(day: number, conv: string, time = "23:00", patch: Record<string, unknown> = {}): string {
  const store = createStore({ startDay: day });
  const session = Object.assign(initialSession({ ...DEFAULT_CLOCK, time }, "left", "desktop"), { homeConversation: conv }, patch);
  return renderMessages({ state: store.getState(), events: store.getEvents(), startDay: day, session, night: false, nowMs: 0 }).body.value;
}
const dayWith = (card: unknown) => ({ day: 1, recipients: { boss: { incoming: [{ t: "09:00", text: "[转账]", kind: "private", card }] } } });

describe("R1 · a transfer card", () => {
  it("the loader takes { type, amount } with a two-decimal amount and nothing else", () => {
    expect(() => parseDayFile(dayWith({ type: "transfer", amount: "2000.00" }), "day-01.json")).not.toThrow();
    for (const bad of [{ type: "transfer", amount: "2000" }, { type: "transfer", amount: "2,000.00" }, { type: "transfer", amount: 2000 }, { type: "transfer", amount: "2000.00", note: "x" }, { type: "transfer" }])
      expect(() => parseDayFile(dayWith(bad), "day-01.json"), JSON.stringify(bad)).toThrow();
  });
  it("Dad's first line on days 1 and 10 carries the card in both languages; the text stays the fallback", () => {
    for (const day of [1, 10]) {
      const first = dayTable(day)!.recipients.get("father")!.incoming[0]!;
      expect(first.card).toEqual({ type: "transfer", amount: "2000.00" });
      expect(first.text).toBe("[转账] 2000 元");
    }
    for (let day = 2; day <= 18; day++) if (day !== 10) for (const m of dayTable(day)!.recipients.get("father")!.incoming) expect(m.card, `day ${day}`).toBeUndefined();
  });
  it("on its own day: orange, ¥2000.00, 转账给你, the footer; not a button", () => {
    const out = render(1, "father");
    expect(out).toContain('<div class="sc sc-transfer wx"><div class="c-transfer"><div class="tf-main"><svg class="tf-ico"');
    expect(out).toContain('<div class="tf-amt">¥2000.00</div><div class="tf-line">转账给你</div>');
    expect(out).toContain('<div class="tf-foot">喂信转账</div>');
    expect(out).not.toMatch(/sc-transfer[^>]*data-action/);
    expect(out).not.toMatch(/<button[^>]*class="sc sc-transfer/);
  });
  it("seen from a later day it is paler and returned", () => {
    const out = render(2, "father");
    expect(out).toContain('<div class="c-transfer returned">');
    expect(out).toContain(`<div class="tf-line">${t("card.transfer.returned")}</div>`);
    expect(out).not.toContain("转账给你");
  });
  it("the list previews it as [转账] (English: [Transfer]), as an image previews by its own text", () => {
    const card = dayTable(1)!.recipients.get("father")!.incoming[0]!.card!;
    const body = { type: "shared" as const, card, raw: "[转账] 2000 元", forwarded: false };
    expect(previewOf(body)).toBe("[转账]");
    setLocale("en");
    expect(previewOf(body)).toBe("[Transfer]");
    expect(render(1, "father")).toContain('<div class="tf-foot">Hichat Transfer</div>');
  });
});

// ——— R2 · a photograph opens large ———
import fs from "node:fs";
import { applyFit } from "@world/fit";
import { renderCard } from "@world/desktop/messages/cards";
import { messageActions } from "@world/desktop/messages/actions";
import { feedHasNew } from "@world/desktop/messages/view";
import { FEED } from "@world/desktop/messages/threads";
import type { ActionContext } from "@world/desktop/controller";

function rigActions(day: number, conv: string) {
  const store = createStore({ startDay: day });
  const session = Object.assign(initialSession({ ...DEFAULT_CLOCK, time: "23:00" }, "left", "desktop"), { homeConversation: conv });
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
  const act = (name: string, data: Record<string, string> = {}) => messageActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => renderMessages({ state: store.getState(), events: store.getEvents(), startDay: day, session, night: false, nowMs: 0 }).body.value;
  return { store, session, act, out };
}

describe("R2 · a photograph opens large", () => {
  it("a 朋友圈 photograph and an image card are focusable buttons; an image with no src is not", () => {
    const feed = render(2, FEED);
    expect(feed).toContain('<button type="button" class="photo-btn" data-action="photo-open" data-src="/msgs/feed/hirelist.jpg" data-focus="photo:/msgs/feed/hirelist.jpg"><img class="fp-photo" src="/msgs/feed/hirelist.jpg"');
    const card = (src?: string) => renderCard({ type: "image", ...(src ? { src } : {}), alt: "一张照片" }, (s) => s, "wx", false).value;
    expect(card("/msgs/photo.png")).toContain('<button type="button" class="photo-btn" data-action="photo-open" data-src="/msgs/photo.png"');
    expect(card()).not.toContain("photo-open");
    expect(card()).toContain('class="c-image ph"');
  });
  it("a click opens it over the window, a click on the veil closes it and gives the focus back; nothing is logged", () => {
    const r = rigActions(2, FEED);
    const before = r.store.getEvents().length;
    r.act("photo-open", { src: "/msgs/feed/hirelist.jpg" });
    expect(r.session.photoOpen).toBe("/msgs/feed/hirelist.jpg");
    expect(r.out()).toMatch(/<div class="photo-veil" data-action="photo-close"><img class="photo-big" src="\/msgs\/feed\/hirelist.jpg" alt="" draggable="false"><\/div><\/div>$/);
    r.act("photo-close");
    expect(r.session.photoOpen).toBeNull();
    expect(r.session.focusNext).toBe("photo:/msgs/feed/hirelist.jpg");
    expect(r.out()).not.toContain("photo-veil");
    expect(r.store.getEvents().length).toBe(before);
    r.act("photo-open", {});
    expect(r.session.photoOpen).toBeNull();
  });
  it("it closes when the conversation changes (a row, or 朋友圈)", () => {
    const r = rigActions(2, FEED);
    r.act("photo-open", { src: "/msgs/feed/hirelist.jpg" });
    r.act("conv", { conv: "family" });
    expect(r.session.photoOpen).toBeNull();
    r.act("photo-open", { src: "/msgs/photo.png" });
    r.act("feed");
    expect(r.session.photoOpen).toBeNull();
  });
  it("the veil: dark, the picture centred within 86 %, contained; no fade under reduced motion", () => {
    const css = fs.readFileSync("src/world/desktop/desktop.css", "utf8");
    expect(css).toMatch(/\.photo-veil\{position:absolute;inset:0;[^}]*background:rgba\(0,0,0,\.82\)/);
    expect(css).toMatch(/\.photo-big\{max-width:86%;max-height:86%;object-fit:contain/);
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.photo-veil\{animation:none\}\}/);
  });
});

// ——— R3 · 朋友圈's dot ———
describe("R3 · 朋友圈 shows a dot when there is something new", () => {
  const post = (day: number, t: string) => ({ day, t });
  it("new when later than the last seen; with nothing seen, any post of today", () => {
    expect(feedHasNew([post(2, "20:30"), post(1, "09:00")], null, 2)).toBe(true);
    expect(feedHasNew([post(1, "09:00")], null, 2)).toBe(false);
    expect(feedHasNew([post(2, "20:30")], { day: 2, t: "20:30" }, 2)).toBe(false);
    expect(feedHasNew([post(2, "20:31")], { day: 2, t: "20:30" }, 2)).toBe(true);
    expect(feedHasNew([post(3, "07:00")], { day: 2, t: "23:00" }, 3)).toBe(true);
    expect(feedHasNew([], null, 2)).toBe(false);
  });
  const feedRow = (out: string) => out.match(/<button type="button" class="row wx-row feed-row[^"]*"[\s\S]*?<\/button>/)![0];
  it("an empty red dot on the row's icon, gone once the column has been open, back when a newer post comes; never in the badge", () => {
    const r = rigActions(2, "family");
    expect(feedRow(r.out())).toContain('<span class="av feed-av" aria-hidden="true"></span><span class="dot"></span>');
    const badge = renderMessages({ state: r.store.getState(), events: r.store.getEvents(), startDay: 2, session: r.session, night: false, nowMs: 0 }).badge;
    r.act("feed");
    r.out();
    expect(r.session.feedSeen).not.toBeNull();
    expect(feedRow(r.out())).not.toContain('class="dot"');
    // the dot never counts: the badge is the same with it and without it
    expect(renderMessages({ state: r.store.getState(), events: r.store.getEvents(), startDay: 2, session: r.session, night: false, nowMs: 0 }).badge).toBe(badge);
    r.act("conv", { conv: "family" });
    expect(feedRow(r.out())).not.toContain('class="dot"');
    // an older mark: the newest post is new again
    r.session.feedSeen = { day: 1, t: "23:59" };
    expect(feedRow(r.out())).toContain('<span class="dot"></span>');
  });
});

// ——— R4 · 离开屏幕 keeps its size ———
describe("R4 · 离开屏幕 keeps its size relative to the stage", () => {
  it("applyFit writes the stage's scale as --stage-k (800 × 497 and 800 × 600 alike, and 1600 × 900)", () => {
    for (const [w, h, k] of [[800, 497, 0.5], [800, 600, 0.5], [1600, 900, 1]] as const) {
      const root = document.createElement("div");
      Object.defineProperty(root, "clientWidth", { get: () => w });
      Object.defineProperty(root, "clientHeight", { get: () => h });
      applyFit(root, document.createElement("div"), { w: 1600, h: 900 }, null);
      expect(Number(root.style.getPropertyValue("--stage-k")), `${w}×${h}`).toBeCloseTo(k, 4);
    }
  });
  it("the pill, in the fixed HUD layer outside the scaled stage, is scaled by --stage-k and placed on the stage, hovered or not; guided adds no size", () => {
    const css = fs.readFileSync("src/world/room/room.css", "utf8");
    const base = css.match(/\.hud-host \.leave-screen\{[^}]*\}/)![0];
    expect(base).toContain("transform:translateY(-50%) scale(var(--stage-k,1))");
    expect(base).toContain("left:calc(var(--stage-l,0px) + 12px * var(--stage-k,1))");
    expect(base).toContain("top:calc(var(--stage-t,0px) + var(--stage-h,100vh) / 2)");
    const hover = css.match(/\.hud-host \.leave-screen:hover,\.hud-host \.leave-screen:focus-visible\{[^}]*\}/)![0];
    expect(hover).toContain("scale(var(--stage-k,1))");
    // the guided ring is an outline and a shadow only (no rule sizes a guided target)
    for (const rule of css.match(/\[data-guide="on"\]\{[^}]*\}/g) ?? []) expect(rule).not.toMatch(/width|height|scale|zoom|font-size/);
  });
});
