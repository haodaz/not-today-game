// battle mode (author 2026-11-13): the Game Boy battle on a work screen — seeded dice, the turn and
// the text queue, 让小鸡上 once per task, a win pushing the work one cell.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { battleCmd, battleOffered, battleReward, battleScene, battleTurn, dice, startBattle, OUR_MOVES } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

describe("battle mode", () => {
  it("the dice roll the same for the same seed; a turn writes the lines and moves the HP; the menus", () => {
    setLocale("zh");
    const a = dice("4:task1:0"), b = dice("4:task1:0"), c = dice("4:task1:1");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(a()).not.toBe(c());
    let s = startBattle("4:task1", "投资人材料", "/battle/mon-brief.gb.png", 4, 0);
    expect(s.phase).toBe("text");
    expect(s.queue[0]!.t).toBe(t("battle.appear", { foe: "投资人材料" }));
    s = battleCmd(s, "next", 1); s = battleCmd(s, "next", 2);
    expect(s.phase).toBe("menu");
    expect(battleScene(s, 2).value).toContain('data-cmd="fight"');
    s = battleCmd(s, "fight", 3);
    expect(s.phase).toBe("moves");
    expect(battleScene(s, 3).value).toContain(`data-move="${OUR_MOVES[0]!.id}">${t("battle.move.hype")}`);
    const after = battleTurn(s, "hype", 4);
    expect(after.phase).toBe("text");
    expect(after.turn).toBe(1);
    expect(after.queue[0]!.t).toBe(t("battle.used", { move: t("battle.move.hype") }));
    // the work answered (unless it fainted at once): its HP or ours moved
    expect(after.theirs.hp < s.theirs.hp || after.ours.hp < s.ours.hp || after.queue.some((l) => l.t === t("battle.miss"))).toBe(true);
    // the same turn again rolls the same
    expect(battleTurn(s, "hype", 9)).toEqual({ ...after, at: 9 });
    // run
    const ran = battleCmd(s, "run", 5);
    expect(ran.after).toBe("ran");
  });

  it("让小鸡上 is offered once per task when the chick is held; a win pushes one cell", () => {
    setLocale("zh");
    const store = createStore({ startDay: 4, patch: { found: ["chick"] } });
    completeUntil(store, "task1");
    const task = taskByFlag(4, "task_d4_1")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `4:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    const s0 = boardState(board, 4, task.id, store.getEvents());
    expect(battleOffered(board, s0, ["chick"], store.getEvents(), 4, task.id)).toBe(true);
    expect(battleOffered(board, s0, [], store.getEvents(), 4, task.id)).toBe(false);
    expect(out()).toContain(`data-action="battle-start">${t("battle.go")}</button>`);
    act("battle-start");
    expect(session.battle?.key).toBe(`4:${task.id}`);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "open", target: `battle:${task.id}` });
    expect(out()).toContain('class="bt"');
    expect(out()).not.toContain('data-action="battle-start"');
    // through the opening, then a win forced by a weak foe
    act("battle-act", { cmd: "next" }); act("battle-act", { cmd: "next" }); act("battle-act", { cmd: "fight" });
    session.battle = { ...session.battle!, theirs: { ...session.battle!.theirs, hp: 1 } };
    act("battle-act", { cmd: "move", move: "grind" });
    expect(session.battle!.after).toBe("won");
    while (session.battle!.phase === "text") act("battle-act", { cmd: "next" });
    expect(session.battle!.phase).toBe("won");
    expect(out()).toContain(`data-action="battle-done">${t("battle.done")}</button>`);
    const reward = battleReward(board, boardState(board, 4, task.id, store.getEvents()))!;
    act("battle-done");
    expect(session.battle).toBeNull();
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: reward.slot, card: reward.card } });
    // once per task: no second offer
    expect(out()).not.toContain('data-action="battle-start"');
    act("battle-start");
    expect(session.battle).toBeNull();
  });
});
