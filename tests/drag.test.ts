// @vitest-environment happy-dom
// work-stages-polish 2: a clipping dragged onto a slot fires board-card then board-slot through the
// action table (a `fill` boardStep in the log); Escape or a release elsewhere cancels without
// changing the pick, and the click after a drag is swallowed. Day 4's 「意识」 board.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { clueStage } from "@world/desktop/workbench/clue-stage";
import { createClipDrag } from "@world/desktop/workbench/drag";
import { setLocale } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("drag a clipping onto a slot", () => {
  it("press, move, release over a slot: board-card then board-slot, one fill each; Escape and a miss cancel", () => {
    setLocale("zh");
    const store = createStore({ startDay: 4 });
    completeUntil(store, "task1");
    const task = taskByFlag(4, "task_d4_1")!;
    const board = task.board!;
    store.appendEvent({ kind: "open", target: "conv:boss", t: "09:10" });
    store.appendEvent({ kind: "open", target: "conv:group", t: "09:11" });
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });

    const root = document.createElement("div");
    document.body.appendChild(root);
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const paint = () => (root.innerHTML = clueStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, task, board).value);
    const ctx: ActionContext = { store, session, rerender: paint, later: () => {}, now: () => 1000 };
    const runs: string[] = [];
    const d = createClipDrag(root, (name, data, el) => {
      runs.push(`${name}:${data.card ?? data.slot}`);
      boardActions[name]!(ctx, data as DOMStringMap, el);
    });
    paint();

    let under: string | null = null;
    document.elementFromPoint = () => (under ? root.querySelector(`.cs-slot[data-slot="${under}"]`) : null);
    const clip = (card: string) => root.querySelector<HTMLElement>(`.cs-clip[data-card="${card}"]`)!;
    const fire = (el: Element, type: string, x: number) => el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 200, button: 0, bubbles: true }));
    const dragTo = (card: string, slot: string | null, opts: { escape?: boolean } = {}) => {
      const el = clip(card);
      fire(el, "pointerdown", 100);
      under = slot;
      fire(el, "pointermove", 400);
      if (slot) expect(root.querySelector(`.cs-slot[data-slot="${slot}"]`)!.classList.contains("drop")).toBe(true);
      expect(el.classList.contains("dragging")).toBe(true);
      if (opts.escape) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      fire(el, "pointerup", 400);
      return el;
    };
    const fills = () => store.getEvents().filter((e) => e.kind === "boardStep" && e.taskId === task.id && e.op.t === "fill").map((e) => (e.kind === "boardStep" && e.op.t === "fill" ? `${e.op.slot}=${e.op.card}` : ""));

    dragTo("c1", "r1");
    expect(runs).toEqual(["board-card:c1", "board-slot:r1"]);
    dragTo("c3", "r3");
    expect(fills()).toEqual(["r1=c1", "r3=c3"]);
    expect(session.boardPick).toBeNull();

    // Escape mid-drag: nothing fires, the pick unchanged, the clipping back in place; the click after is swallowed.
    runs.length = 0;
    const el = dragTo("c2", "r2", { escape: true });
    expect(runs).toEqual([]);
    expect(el.style.transform).toBe("");
    let clicked = false;
    root.addEventListener("click", () => (clicked = true));
    el.click();
    expect(clicked).toBe(false);
    // A release over no slot: nothing either.
    dragTo("c2", null);
    expect(runs).toEqual([]);
    expect(fills()).toEqual(["r1=c1", "r3=c3"]);
    expect(session.boardPick).toBeNull();

    // A press without a move is left to the click (no action from the drag).
    fire(clip("c2"), "pointerdown", 100);
    fire(clip("c2"), "pointerup", 100);
    expect(runs).toEqual([]);
    d.destroy();
    root.remove();
  });
});
