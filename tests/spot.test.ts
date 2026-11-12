// spot the difference (author 2026-11-13): day 10's proofreading — the compare board's pick phase as
// pages side by side with one word to point at; a miss shakes and counts; the pick is the board's
// own (scored at the settlement as before); the fourth found turns the scan's page.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, settleVerdict } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { workLayer } from "@world/desktop/workbench/compare";
import { SPOT_SHAKE_MS } from "@world/desktop/workbench/spot";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("spot the difference", () => {
  it("day 10's compare board carries the game; its settlement still goes by the threshold (a game on a compare board does not pass it by itself)", () => {
    const task = taskByFlag(10, "task_d10_work")!;
    const board = task.board!;
    expect(board.game).toEqual({ kind: "spot" });
    expect(board.compare).toBeTruthy();
    const store = createStore({ startDay: 10 });
    const s = (slots: Record<string, string>) => ({ ...boardState(board, 10, task.id, store.getEvents()), slots, unlocked: true });
    const right = Object.fromEntries(board.slots.map((x) => [x.id, x.answer]));
    expect(settleVerdict(board, s(right))).toBe("pass");
    const wrong = Object.fromEntries(board.compare!.pages.map((p) => [p.slot, p.cards[0]!]));
    expect(settleVerdict(board, s(wrong))).toBe("fail");
  });

  it("the pick phase shows the versions as pages: the word that differs is the pick, every other line a miss that shakes; the last page's result turns the scan", () => {
    setLocale("zh");
    const store = createStore({ startDay: 10 });
    completeUntil(store, "work");
    const task = taskByFlag(10, "task_d10_work")!;
    const board = task.board!;
    const cmp = board.compare!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `10:${task.id}`;
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    let page = out();
    expect(page).toContain('class="wl-vs sp" data-slot="r1"');
    expect(page.match(/class="sp-pane v\d"/g)).toHaveLength(cmp.pages[0]!.cards.length);
    for (const card of cmp.pages[0]!.cards) expect(page).toContain(`<button type="button" class="sp-word" data-action="compare-pick" data-slot="r1" data-card="${card}">`);
    expect(page).toContain('data-action="spot-miss"');
    expect(page).toContain(t("spot.stage.title"));
    expect(page).not.toContain("compare.use");
    // a miss: the pages shake for a moment, the count shows
    act("spot-miss", { i: "0" });
    expect(session.spotMiss).toMatchObject({ key: `10:${task.id}`, n: 1, at: 1000 });
    expect(out()).toContain('class="sp-panes shake"');
    now += SPOT_SHAKE_MS + 10;
    expect(out()).not.toContain('class="sp-panes shake"');
    expect(out()).toContain(t("spot.stage.misses", { n: "1" }));
    // the picks, page by page, the book's word each time; the last page's result turns the scan
    for (const p of cmp.pages) {
      const answer = board.slots.find((x) => x.id === p.slot)!.answer;
      act("compare-pick", { slot: p.slot, card: answer });
      expect(session.workPhase).toEqual({ key: `10:${task.id}`, phase: "result", slot: p.slot });
      now += 10_000; // past Kuro's render pause
      const result = out();
      const last = p === cmp.pages[cmp.pages.length - 1];
      expect(result.includes("sp-flipped")).toBe(last);
      expect(result.includes(t("spot.stage.flip"))).toBe(last);
      act("compare-next");
    }
    expect(settleVerdict(board, boardState(board, 10, task.id, store.getEvents()))).toBe("pass");
    expect(out()).toContain('data-action="board-print"');
  });
});
