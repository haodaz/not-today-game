// gacha (author 2026-11-13): day 17's 回电话 — the capsule machine after the filled form; four named eggs
// and a nameless fifth; the crank turns once; the egg out is the card the slot holds; opening it
// approves the form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { GACHA_TURN_MS, gachaOpen, gachaPhase, gachaStart, gachaTurn } from "@world/desktop/workbench/gacha";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "gacha" as const, slot: "r1", eggs: [{ card: "c1", label: "青禾" }, { card: "d1", label: "老王" }, { card: "d2", label: "Vivi" }, { card: "k1", label: "克总" }] };

describe("gacha", () => {
  it("day 17's board is a gacha; the machine holds the four named eggs and a nameless fifth", () => {
    expect(taskByFlag(17, "task_d17_work")!.board!.game).toEqual(GAME);
    const g = gachaStart("t", GAME, dice("s1"));
    expect(g.eggs).toHaveLength(5);
    expect(g.eggs.at(-1)).toMatchObject({ card: null, label: "" });
    expect(new Set(g.eggs.slice(0, 4).map((e) => e.card))).toEqual(new Set(["c1", "d1", "d2", "k1"]));
    expect(gachaPhase(g, 0)).toBe("idle");
  });

  it("the crank turns once; the egg out is the slot's card (else the first named one); it opens once it is out", () => {
    const g = gachaStart("t", GAME, dice("s1"));
    const turned = gachaTurn(g, "k1", 1000);
    expect(g.eggs[turned.picked!]!.card).toBe("k1");
    expect(gachaPhase(turned, 1000)).toBe("turning");
    expect(gachaPhase(turned, 1000 + GACHA_TURN_MS)).toBe("out");
    expect(gachaTurn(turned, "c1", 2000)).toBe(turned);
    expect(gachaOpen(turned, 1200)).toBe(turned);
    const opened = gachaOpen(turned, 1000 + GACHA_TURN_MS + 1);
    expect(opened.opened).toBe(true);
    expect(gachaPhase(opened, 9000)).toBe("open");
    const fallback = gachaTurn(g, "nothing", 0);
    expect(g.eggs[fallback.picked!]!.card).not.toBeNull();
  });

  it("after the filled form the stage shows the machine; the turn, the egg out, the open approves the form and the sheet opens", () => {
    setLocale("zh");
    const store = createStore({ startDay: 17 });
    completeUntil(store, "work");
    const task = taskByFlag(17, "task_d17_work")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `17:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string) => boardActions[name]!(ctx, {} as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 17, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="gacha"');
    act("gacha-start");
    expect(session.gacha?.key).toBe(task.id);
    expect(out()).toContain('class="gc-crank" data-action="gacha-turn"');
    act("gacha-turn");
    expect(session.gacha!.turnedAt).toBe(1000);
    expect(session.gacha!.eggs[session.gacha!.picked!]!.card).toBe(board.slots[0]!.answer);
    expect(out()).toContain('class="gc-crank turning"');
    // an open while still turning does nothing
    act("gacha-open");
    expect(store.getEvents().at(-1)).not.toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    now = 1000 + GACHA_TURN_MS + 10;
    expect(out()).toContain('data-action="gacha-open"');
    expect(out()).toContain("青禾");
    act("gacha-open");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 17, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("gacha.stage.won", { name: "青禾" }));
    expect(out()).toContain('class="gc-egg blank stuck"');
    now += 6000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
