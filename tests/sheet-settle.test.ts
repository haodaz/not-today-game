// work-stages-polish 1: the clue / meeting stage ends on a settlement sheet. 整理好了 (board-settle) is
// enabled only once every slot is filled; it shows the sheet with each placed card and the one way out
// the verdict allows (author 2026-11-13): the send button, or 让克总帮忙. Day 4's 「意识」 board.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions, cardText } from "@world/desktop/workbench/board";
import { clueStage } from "@world/desktop/workbench/clue-stage";
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

  // on a plain table board (day 12's, 2026-11-13: a game board always passes its settlement — the game itself decided)
  it("a wrong card fails the settlement: only 让克总帮忙; his card takes the wrong slot and the story asks 要发吗？", () => {
    setLocale("zh");
    const store = createStore({ startDay: 12 });
    completeUntil(store, "work");
    const task = taskByFlag(12, "task_d12_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    let now = 1000;
    const timers: { at: number; fn: () => void }[] = [];
    const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void timers.push({ at: now + ms, fn }), now: () => now };
    const act = (name: string) => boardActions[name]!(ctx, {} as DOMStringMap, null as never);
    const out = () => clueStage({ state: store.getState(), events: store.getEvents(), session, nowMs: now }, task, board).value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    const [wrongSlot, ...rest] = board.slots;
    for (const slot of rest) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    const other = board.cards.find((c) => c.id !== wrongSlot!.answer)!;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: wrongSlot!.id, card: other.id } });
    act("board-settle");
    let sheet = out();
    expect(sheet).toContain(`<p class="sl-verdict fail">${t("settle.fail")}</p>`);
    expect(sheet).toContain(`data-action="settle-kuro">${t("settle.kuro")}</button>`);
    expect(sheet).not.toContain('data-action="board-print"');
    // 让克总帮忙: his fix lands at once, and the story plays over the settlement — the player's line,
    // Kuro's two, then the choice (every option sends); the sheet behind already says it can go
    act("settle-kuro");
    const last = store.getEvents().at(-1)!;
    expect(last).toMatchObject({ kind: "boardStep", op: { t: "assistFix" } });
    const queued = session.dialogue.queue.filter((q) => q.key.startsWith(`d12:settle:${task.id}:kuro`));
    expect(queued.flatMap((q) => q.lines).map((l) => (l.k === "speaker" ? `${l.who}:${l.t}` : l.k))).toEqual([`me:${t("settle.kuroWork")}`, `kuro:${t("settle.kuroDone")}`, `kuro:${t("settle.sendAsk")}`]);
    expect(queued.at(-1)!.ending).toEqual({ kind: "settleSend", taskId: task.id });
    expect(timers).toHaveLength(0);
    sheet = out();
    expect(sheet).toContain(t("settle.kuroDone"));
    expect(sheet).toMatch(/<button type="button" class="wl-cta" data-action="board-print">[^<]+<\/button>/);
    expect(sheet).not.toContain('data-action="settle-kuro"');
    expect(sheet).toContain(`<p class="st-card">${escapeHtml(cardText(board, board.kuro.fill[wrongSlot!.id] ?? wrongSlot!.answer))}</p>`);
  });
});
