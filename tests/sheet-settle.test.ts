// work-stages-polish 1: the clue / meeting stage ends on a settlement sheet. 整理好了 (board-settle) is
// enabled only once every slot is filled; it shows the sheet with each placed card and the one way out
// the verdict allows (author 2026-11-13): the send button, or 让克总帮忙. Day 4's 「意识」 board.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag, type TaskBoard } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, settleVerdict } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions, cardText } from "@world/desktop/workbench/board";
import { clueStage } from "@world/desktop/workbench/clue-stage";
import { settleActions } from "@world/desktop/workbench/settle-sheet";
import { openWork } from "@world/desktop/workbench/work";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("the settlement sheet (clue stage)", () => {
  it("整理好了 waits for every slot; the sheet lists each placed card; every slot right → the send button only", () => {
    setLocale("zh");
    const store = createStore({ startDay: 4 });
    completeUntil(store, "task1");
    const task = taskByFlag(4, "task_d4_1")!;
    const board = task.board!;
    expect(openWork(store.getState(), store.getEvents())?.tree?.id).toBe(task.id);
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
    const act = (name: string) => boardActions[name]!(ctx, {} as DOMStringMap, null as never);
    const out = () => clueStage({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000 }, task, board).value;

    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    const [last, ...rest] = [...board.slots].reverse();
    for (const slot of rest) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });

    // Not every slot: 整理好了 is there and disabled; 提交 is not on the board any more.
    expect(out()).toContain(`data-action="board-settle" disabled>${t("sheet.settle.open")}</button>`);
    expect(out()).not.toContain('data-action="board-print"');
    act("board-settle");
    expect(session.workPhase).toBeNull();

    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: last!.id, card: last!.answer } });
    // day 4's board carries a game (link-link, 2026-11-13): the form is printable only once the game approved it
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "approve" } });
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
    act("board-settle");
    expect(session.workPhase).toEqual({ key: `4:${task.id}`, phase: "settle" });

    const sheet = out();
    expect(sheet).toContain('class="st-sheet"');
    expect(sheet).not.toContain('class="cs-notes"');
    expect(sheet).toContain(escapeHtml(board.title));
    expect([...sheet.matchAll(/class="st-row"/g)]).toHaveLength(board.slots.length);
    for (const slot of board.slots) expect(sheet).toContain(`<p class="st-card">${escapeHtml(cardText(board, slot.answer))}</p>`);
    // the settlement rule (author 2026-11-13): no 再改改 — every slot right, so it can go: the send button only
    expect(sheet).not.toContain('data-action="board-settle-back"');
    expect(sheet).toContain(`<p class="sl-verdict pass">${t("settle.pass")}</p>`);
    expect(sheet).toMatch(/<button type="button" class="wl-cta" data-action="board-print">[^<]+<\/button>/);
    expect(sheet).not.toContain('data-action="settle-kuro"');
  });

  // every table board carries a game now (2026-11-13), and a game board always passes its settlement — the game itself
  // decided — so the fail path is checked on the pure pieces with day 11's board stripped of its game
  it("a wrong card fails the settlement on a plain table: only 让克总帮忙; his fix (assistFix) makes it sendable", () => {
    setLocale("zh");
    const store = createStore({ startDay: 11 });
    completeUntil(store, "work");
    const task = taskByFlag(11, "task_d11_work")!;
    const { game: _game, ...plain } = task.board!;
    const board = plain as TaskBoard;
    const s = () => boardState(board, 11, task.id, store.getEvents());
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    const [wrongSlot, ...rest] = board.slots;
    for (const slot of rest) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    const other = board.cards.find((c) => c.id !== wrongSlot!.answer)!;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: wrongSlot!.id, card: other.id } });
    expect(settleVerdict(board, s())).toBe("fail");
    let actions = settleActions(task, board, s());
    expect(actions.line!.value).toContain(`<p class="sl-verdict fail">${t("settle.fail")}</p>`);
    expect(actions.buttons.value).toContain(`data-action="settle-kuro">${t("settle.kuro")}</button>`);
    expect(actions.buttons.value).not.toContain('data-action="board-print"');
    // 让克总帮忙: his fix — the wrong slot takes his card (his fill, else the answer); the verdict passes and it can go
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "assistFix" } });
    expect(s().slots[wrongSlot!.id]).toBe(board.kuro.fill[wrongSlot!.id] ?? wrongSlot!.answer);
    expect(s().assists).toBe(1);
    expect(settleVerdict(board, s())).toBe("pass");
    actions = settleActions(task, board, s());
    expect(actions.line!.value).toContain(t("settle.kuroDone"));
    expect(actions.buttons.value).toMatch(/<button type="button" class="wl-cta" data-action="board-print">[^<]+<\/button>/);
    expect(actions.buttons.value).not.toContain('data-action="settle-kuro"');
    expect(escapeHtml(cardText(board, s().slots[wrongSlot!.id]!))).toBeTruthy();
  });
});
