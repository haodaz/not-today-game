// 端盒 (blind-box 2026-11-03). The box in 房间 opens the case: nine small boxes in a 3 × 3, eight
// objects and one hidden box, in a deterministic shuffle by the run id. Exactly one is loose today
// (today's object while its 开箱 item is open, the hidden box on day 18); the rest are stuck. The
// loose box runs loop-box unchanged; stuck boxes log nothing and cycle four lines. "slip" is the
// hidden box's id: opening it never touches `found`, and the 寄件单 then shows on the desk.
import { afterEach, describe, expect, it } from "vitest";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { setLocale, t } from "@world/i18n";
import { loopActions } from "@world/room/game";
import { boxObjectFor, hiddenBoxDay, openBoxReady, renderRoom } from "@world/room/hud";
import { CASE_CONTENTS, CASE_OBJECTS, HIDDEN_ID, caseSlots, boxOpened, looseContent, stuckLineKey } from "@world/room/case";
import { completeUntil } from "./complete-items";

afterEach(() => setLocale("zh"));

function ctxOf(store: Store, view: Session["view"] = "room"): ActionContext {
  let now = 0;
  return { store, session: initialSession(DEFAULT_CLOCK, "left", view), rerender: () => {}, later: () => {}, now: () => now };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const atDay = (day: number, runId = "run-a") => {
  const store = createStore({ runId, startDay: 1 });
  while (store.getState().day < day) store.appendEvent({ kind: "lieDown" });
  return store;
};
const roomOf = (ctx: ActionContext, runId = ctx.store.getRunId()) =>
  renderRoom({ state: ctx.store.getState(), events: ctx.store.getEvents(), session: ctx.session, runId }).value;
const box = (ctx: ActionContext) => ctx.session.dialogue.queue.flatMap((q) => q.lines.map((l) => l.t)).join("|");

// ——— the slots ———

describe("the case has nine slots", () => {
  it("nine contents: the eight objects and one hidden box", () => {
    expect(CASE_OBJECTS).toHaveLength(8);
    expect(CASE_CONTENTS).toHaveLength(9);
    expect(CASE_CONTENTS.filter((c) => c === HIDDEN_ID)).toHaveLength(1);
    const slots = caseSlots("run-a");
    expect(slots).toHaveLength(9);
    expect([...slots].sort()).toEqual([...CASE_CONTENTS].sort());
  });

  it("the slot order is stable for one run id and differs for another", () => {
    expect(caseSlots("run-a")).toEqual(caseSlots("run-a"));
    // Two different run ids give different orders (these two seeds differ).
    expect(caseSlots("run-a")).not.toEqual(caseSlots("run-b"));
  });

  it("an opened object's slot is empty (boxOpened from the log)", () => {
    const events = [{ kind: "openLayer", day: 1, objectId: "chick" }] as const;
    expect(boxOpened("chick", events)).toBe(true);
    expect(boxOpened("pager", events)).toBe(false);
    const store = createStore({ runId: "run-a", startDay: 1 });
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    const ctx = ctxOf(store);
    ctx.session.caseOpen = true;
    const html = roomOf(ctx);
    // The chick's box is an empty slot (no data-slot button for it); another's box is still a button.
    expect(html).not.toContain('data-slot="chick"');
    expect(html).toContain('data-slot="pager"');
    expect((html.match(/class="case-slot empty"/g) ?? []).length).toBe(1);
  });
});

// ——— which box is loose ———

describe("exactly one box is loose today", () => {
  it("today's object only while the 开箱 item is unlocked and not done; all others stuck", () => {
    const store = atDay(1);
    // Day 1, before the box item unlocks: nothing loose.
    expect(openBoxReady(store.getState(), store.getEvents())).toBe(false);
    expect(looseContent(1, boxObjectFor(1), false)).toBeNull();
    // Once the box item is unlocked and not done: today's object (chick) is loose.
    completeUntil(store, "box");
    expect(openBoxReady(store.getState(), store.getEvents())).toBe(true);
    expect(looseContent(1, boxObjectFor(1), true)).toBe("chick");
    // After the box is opened (done), it is no longer loose.
    store.appendEvent({ kind: "openLayer", objectId: "chick" });
    expect(openBoxReady(store.getState(), store.getEvents())).toBe(false);
    expect(looseContent(1, boxObjectFor(1), false)).toBeNull();
  });

  it("on a day with no box item, none is loose", () => {
    // Build a fresh day-9-style state where no object is found that day: boxObjectFor is null.
    expect(boxObjectFor(9)).toBeNull();
    expect(looseContent(9, boxObjectFor(9), true)).toBeNull();
    expect(looseContent(9, boxObjectFor(9), false)).toBeNull();
  });

  it("the case still opens on a day without a box item (every box stuck)", () => {
    const store = atDay(9);
    const ctx = ctxOf(store);
    act(ctx, "pick-box");
    expect(ctx.session.caseOpen).toBe(true);
    const html = roomOf(ctx);
    // No slot carries the `loose` class.
    expect(html).not.toContain("case-slot box small loose");
    expect(html).not.toContain("case-slot box hidden loose");
  });
});

// ——— picking ———

describe("picking a box", () => {
  it("the loose box runs loop-box: one openLayer for today's object, and the case closes", () => {
    const store = atDay(1);
    const ctx = ctxOf(store);
    // The box item is unlocked and not done: today's object is loose.
    completeUntil(store, "box");
    act(ctx, "pick-box");
    expect(ctx.session.caseOpen).toBe(true);
    const before = store.getEvents().length;
    act(ctx, "case-pick", { slot: "chick" });
    expect(ctx.session.caseOpen).toBe(false);
    expect(store.getEvents().length).toBe(before + 1);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "openLayer", objectId: "chick" });
    expect(store.getState().found).toContain("chick");
  });

  it("a stuck box logs nothing and cycles the four lines", () => {
    const store = atDay(1);
    const ctx = ctxOf(store);
    completeUntil(store, "box");
    act(ctx, "pick-box");
    ctx.session.caseStuck = 0; // a known offset, so the cycle is predictable
    const before = store.getEvents().length;
    // pager's box is stuck today (chick is the loose one): clicking it speaks and logs nothing.
    const lines: string[] = [];
    for (let i = 0; i < 5; i++) {
      ctx.session.dialogue = { queue: [], line: 0, page: 0 };
      act(ctx, "case-pick", { slot: "pager" });
      lines.push(box(ctx));
    }
    expect(store.getEvents().length).toBe(before); // stuck boxes log nothing
    expect(ctx.session.caseOpen).toBe(true); // the case stays open
    // The four lines cycle: click 0..4 → lines 0,1,2,3,0.
    expect(lines).toEqual([0, 1, 2, 3, 0].map((n) => t(`box.stuck.${n}`)));
  });

  it("stuckLineKey cycles 0..3", () => {
    expect([0, 1, 2, 3, 4, 5].map(stuckLineKey)).toEqual(["box.stuck.0", "box.stuck.1", "box.stuck.2", "box.stuck.3", "box.stuck.0", "box.stuck.1"]);
  });
});

// ——— the hidden box (day 18) ———

describe("the hidden box on day 18", () => {
  it("hiddenBoxDay is 18 and boxObjectFor(18) is the slip", () => {
    expect(hiddenBoxDay).toBe(18);
    expect(boxObjectFor(18)).toBe("slip");
  });

  it("before day 18 the hidden box is stuck (not loose)", () => {
    expect(looseContent(1, boxObjectFor(1), true)).not.toBe(HIDDEN_ID);
    expect(looseContent(17, boxObjectFor(17), true)).not.toBe(HIDDEN_ID);
  });

  it("on day 18 the hidden box is loose; opening it logs openLayer slip, found does not change, the slip shows on the desk", () => {
    const store = atDay(18);
    completeUntil(store, "box");
    expect(looseContent(18, boxObjectFor(18), true)).toBe(HIDDEN_ID);
    const ctx = ctxOf(store);
    act(ctx, "pick-box");
    const before = store.getEvents().length;
    const foundBefore = [...store.getState().found];
    act(ctx, "case-pick", { slot: HIDDEN_ID });
    expect(ctx.session.caseOpen).toBe(false);
    expect(store.getEvents().length).toBe(before + 1);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "openLayer", objectId: "slip" });
    // `found` never gains "slip".
    expect(store.getState().found).toEqual(foundBefore);
    expect(store.getState().found).not.toContain("slip");
    // The slip (寄件单) shows on the desk (the tabletop) once the box item is done (unlock: done:box).
    const deskHtml = renderRoom({ state: store.getState(), events: store.getEvents(), session: initialSession(DEFAULT_CLOCK, "left", "desk") }).value;
    expect(deskHtml).toContain("/room/desk/slip.png");
  });
});

// ——— no count, no layer ———

describe("the case names no count and no layer", () => {
  it("no visible text in the case names a count or a layer", () => {
    const store = atDay(7);
    completeUntil(store, "box");
    const ctx = ctxOf(store);
    act(ctx, "pick-box");
    const html = roomOf(ctx);
    // Only the case overlay's markup.
    const start = html.indexOf('<div class="case-layer">');
    const caseMarkup = html.slice(start, html.indexOf("</div>", html.indexOf('class="case"')) + 6);
    // The visible text (between tags), not attributes/class names.
    const visibleText = caseMarkup.replace(/<[^>]*>/g, "").trim();
    expect(visibleText).toBe(""); // the case shows only boxes, no words at all
    // And no slot is labelled with a count or a layer (aria-labels are box.* names only).
    const labels = [...caseMarkup.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]!);
    for (const label of labels) {
      expect(label).not.toMatch(/层|剩|\bleft\b|\blayer\b|[0-9]/i);
    }
  });
});

