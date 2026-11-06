// desk-prints (2026-11-06): R1 a sent deliverable also leaves its print on the desk (today); R2 the
// pile of earlier prints; R3 the close view. Session only for the view; the pile is from the log.
import { describe, expect, it } from "vitest";
import { deliverableForHand, deliverableOnDesk } from "@state/days/board";
import { printsOnDesk } from "@state/days/prints";
import { taskFiles } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { BeatClock } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type Session } from "@world/desktop/model";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE } from "@world/loop/dialogue";
import { showing } from "@world/loop/dialogue";
import { beatQueued } from "@world/loop/runtime";
import { dayFile } from "@state/days/table";
import { push } from "@world/loop/dialogue";
import { loopActions, loopKeys } from "@world/room/game";
import { PILE_EDGES_MAX, renderRoom } from "@world/room/hud";

const boardTask = (day: number) => taskFiles.get(day)!.find((x) => x.board && x.deliverable)!;
/** Print today's board (every slot right), as the board's 打印 does. */
function print(store: Store): void {
  const task = boardTask(store.getState().day);
  const slots = Object.fromEntries(task.board!.slots.map((s) => [s.id, s.answer]));
  store.appendEvent({ kind: "task", flag: task.done, mode: "self", slots, assists: 0 });
}
/** Send today's deliverable (board.send.<to>, or given to the hand): the `give` event. */
const send = (store: Store) => store.appendEvent({ kind: "give", deliverableId: boardTask(store.getState().day).deliverable!.id, t: "17:00" });
const NIGHT: BeatClock = { beat: "night", time: "23:41" };

function rig(store: Store, view: Session["view"] = "desk") {
  const session = initialSession({ beat: "work", time: "17:30" }, "left", view);
  session.dialogue = EMPTY_DIALOGUE;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const out = () => renderRoom({ state: store.getState(), events: store.getEvents(), session }).value;
  return { store, session, ctx, act, out };
}

describe("R1 · a sent deliverable leaves a print", () => {
  it("a to: boss board sent on day 1: on the desk today (sent), gone after sleep; the hand offers nothing that night", () => {
    const store = createStore({ startDay: 1 });
    expect(boardTask(1).deliverable!.to).toBe("boss");
    print(store);
    expect(deliverableOnDesk(1, store.getEvents())).toBeNull(); // not sent yet: it is on screen
    send(store);
    expect(deliverableOnDesk(1, store.getEvents())).toMatchObject({ id: boardTask(1).deliverable!.id, sent: true });
    expect(deliverableForHand(1, store.getEvents())).toBeNull();
    // The hand's give / refuse choices stay for `hand` deliverables only.
    const night = dayFile(1)!.beats.shutdown!;
    const session = initialSession(NIGHT, "left", "room");
    session.dialogue = push(EMPTY_DIALOGUE, beatQueued(1, "shutdown", night, { kind: "beatChoices", day: 1, beat: "shutdown" }));
    session.dialogue = { ...session.dialogue, line: session.dialogue.queue[0]!.lines.length - 1 };
    const choices = showing(session.dialogue, store.getState(), store.getEvents())?.choices ?? [];
    expect(choices.some((c) => c.choice === "give")).toBe(false);
    store.appendEvent({ kind: "lieDown" });
    expect(deliverableOnDesk(2, store.getEvents())).toBeNull();
    // Day 5 is a hand night (a raid) with a person's deliverable: sent, its print stays, the hand gets no 递给它.
    const s5 = createStore({ startDay: 5 });
    expect(boardTask(5).deliverable!.to).toBe("partner");
    print(s5);
    send(s5);
    expect(deliverableOnDesk(5, s5.getEvents())!.sent).toBe(true);
    const n5 = initialSession(NIGHT, "left", "room");
    n5.dialogue = push(EMPTY_DIALOGUE, beatQueued(5, "shutdown", dayFile(5)!.beats.shutdown!));
    n5.dialogue = { ...n5.dialogue, line: n5.dialogue.queue[0]!.lines.length - 1 };
    expect((showing(n5.dialogue, s5.getState(), s5.getEvents())?.choices ?? []).some((c) => c.choice === "give")).toBe(false);
  });

  it("a hand board on day 11: on the desk until given; given → not in the pile", () => {
    const store = createStore({ startDay: 11 });
    expect(boardTask(11).deliverable!.to ?? "hand").toBe("hand");
    print(store);
    expect(deliverableOnDesk(11, store.getEvents())).toMatchObject({ id: boardTask(11).deliverable!.id });
    expect(deliverableOnDesk(11, store.getEvents())!.sent).toBeUndefined();
    expect(deliverableForHand(11, store.getEvents())).not.toBeNull();
    expect(printsOnDesk(11, store.getEvents()).map((p) => p.id)).toEqual([boardTask(11).deliverable!.id]);
    send(store);
    expect(deliverableOnDesk(11, store.getEvents())).toBeNull();
    expect(printsOnDesk(11, store.getEvents())).toEqual([]);
  });
});

/** Days 1–5, each board printed and sent; the store stands on day 5. */
function fiveDays(): Store {
  const store = createStore({ startDay: 1 });
  for (let d = 1; d <= 5; d++) {
    print(store);
    send(store);
    if (d < 5) store.appendEvent({ kind: "lieDown" });
  }
  return store;
}

describe("R2 · the pile", () => {
  it("day 5 after days 1–4 sent: oldest first in printsOnDesk; four edges under today's top print", () => {
    const store = fiveDays();
    expect(store.getState().day).toBe(5);
    const prints = printsOnDesk(5, store.getEvents());
    expect(prints.map((p) => p.day)).toEqual([1, 2, 3, 4, 5]);
    expect(prints.map((p) => p.id)).toEqual([1, 2, 3, 4, 5].map((d) => boardTask(d).deliverable!.id));
    const out = rig(store).out();
    const pile = /<button type="button" class="slot deliverable pile"[\s\S]*?<\/button>/.exec(out)![0];
    expect(pile.match(/class="pile-edge"/g)).toHaveLength(4);
    expect(pile).toContain(`data-deliverable="${boardTask(5).deliverable!.id}"`);
    expect(pile).toContain(`title="${escapeHtml(boardTask(5).deliverable!.label)}"`);
    // The paper fallback (no img yet).
    expect(pile).toContain('<span class="pile-top"><span class="paper-thumb" aria-hidden="true"></span></span>');
    // In the spot left-front by the lamp foot.
    expect(out).toContain('<div class="at" data-at="deliverable" style="left:230px;top:640px;width:200px;height:140px"><button type="button" class="slot deliverable pile"');
    expect(out).toMatchSnapshot();
  });

  it("the edges stop at six; with today's not there, the pile's name is 一摞打印件 with the count", () => {
    const store = createStore({ startDay: 1 });
    for (let d = 1; d <= 9; d++) {
      print(store);
      send(store);
      store.appendEvent({ kind: "lieDown" });
    }
    const out = rig(store).out();
    const pile = /<button type="button" class="slot deliverable pile"[\s\S]*?<\/button>/.exec(out)![0];
    expect(pile.match(/class="pile-edge"/g)).toHaveLength(PILE_EDGES_MAX);
    const n = printsOnDesk(store.getState().day, store.getEvents()).length;
    expect(pile).toContain(`title="${escapeHtml(t("prints.pile", { n }))}"`);
  });
});

describe("R3 · look closer", () => {
  it("a click opens it (newest first); → and ← page; Esc closes; no event logged", () => {
    const store = fiveDays();
    const r = rig(store);
    const events = store.getEvents().length;
    r.act("prints-open");
    let out = r.out();
    expect(out).toContain(`<div class="prints-view" role="dialog" aria-modal="true" aria-label="${escapeHtml(boardTask(5).deliverable!.label)}" data-print="${boardTask(5).deliverable!.id}" data-at="1/5">`);
    expect(out).toContain(`<div class="print-paper"><span>${escapeHtml(boardTask(5).deliverable!.label)}</span></div>`);
    expect(out).toContain(`aria-label="${escapeHtml(t("prints.close"))}">×</button>`);
    expect(loopKeys(r.ctx, { key: "ArrowRight" } as KeyboardEvent)).toBe(true);
    out = r.out();
    expect(out).toContain(`data-print="${boardTask(4).deliverable!.id}" data-at="2/5"`);
    r.act("prints-next");
    r.act("prints-next");
    r.act("prints-next");
    r.act("prints-next"); // stops at the oldest
    expect(r.out()).toContain('data-at="5/5"');
    expect(loopKeys(r.ctx, { key: "ArrowLeft" } as KeyboardEvent)).toBe(true);
    expect(r.out()).toContain('data-at="4/5"');
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(r.session.printsView).toBeNull();
    expect(r.out()).not.toContain("prints-view");
    expect(r.session.view).toBe("desk"); // Esc closed the view, not the camera
    expect(store.getEvents()).toHaveLength(events);
  });
});
