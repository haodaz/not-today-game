// chick-fights (author 2026-11-27, ledger #156): 「我想小鸡每次都能战斗，战斗如何胜利完成度上升一格，每个任务 boss
// 能力会提升，所以要记得喂鸡」. The chick's level is the days it was fed; the fight is on every task,
// once; a win lifts the task one step and a loss changes nothing; Kuro's upgrade makes it strong for
// three days, then it fights no more; the status panel shows it; recognising is no judgement (that
// part is in recognise.test.ts and endings.test.ts).
import "./specimen";
import { describe, expect, it } from "vitest";
import { chickFedDays, chickFedOn, chickFights } from "@state/chick";
import { boardJudgement, boardState, canPrint, compareScore, freshBoard, liftVerdict, settleVerdict, stepBoard } from "@state/days/board";
import { taskByFlag, taskFiles } from "@state/days/tasks";
import type { GameEvent } from "@state/events";
import { createStore } from "@state/store";
import type { State } from "@state/types.gen";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import { initialSession } from "@world/desktop/model";
import { battleOffered, battleScene, battleTurn, battleCmd, chickStrength, chickToday, fightControl, foeStrength, startBattle, FED_HP, HP_PER_LEVEL, KURO_LEVELS, OURS_HP, OURS_HP_MIN, FOE_HP } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { settleActions } from "@world/desktop/workbench/settle-sheet";
import { setLocale, t } from "@world/i18n";
import { chickForgotten } from "@world/loop/runtime";
import { chickRow, statusPanel } from "@world/room/status";
import { completeUntil } from "./complete-items";

setLocale("zh");

const meal = (day: number): GameEvent => ({ kind: "pressKey", day, key: "chick:meal" });
const play = (day: number): GameEvent => ({ kind: "pressKey", day, key: "chick:play" });

describe("R1: the chick's level comes from the log", () => {
  it("the days it got its meal, counted once a day, cumulative; other cares are not meals", () => {
    const log = [meal(1), meal(1), play(2), meal(3), meal(5)];
    expect([1, 2, 3, 4, 5].map((d) => chickFedDays(log, d))).toEqual([1, 1, 2, 2, 3]);
    expect([1, 2, 3, 4, 5].map((d) => chickFedOn(log, d))).toEqual([true, false, true, false, true]);
    expect(chickFedDays([], 9)).toBe(0);
  });
});

describe("R2: it can be sent in on every task", () => {
  it("offered whatever the board's kind, once per task, when the chick is held and not taken", () => {
    const kinds = new Set<string>();
    for (const [day, tasks] of taskFiles) {
      for (const f of tasks) {
        const task = taskByFlag(day, f.done);
        if (!task?.board) continue;
        const b = task.board;
        kinds.add(b.tune ? "tune" : b.stack ? "stack" : b.compare ? "compare" : b.game ? `game:${b.game.kind}` : "table");
        expect(battleOffered(["chick"], [], day, task.id), `${day}:${task.id}`).toBe(true);
        expect(battleOffered(["chick"], [{ kind: "open", day, target: `battle:${task.id}`, t: "10:00" }], day, task.id)).toBe(false);
        expect(battleOffered(["camera"], [], day, task.id)).toBe(false);
        expect(battleOffered(["chick"], [], day, task.id, true)).toBe(false);
      }
    }
    // the run has the tuning board, the chain and games among its boards: none is left out
    expect([...kinds].some((k) => k === "tune")).toBe(true);
    expect([...kinds].some((k) => k === "stack")).toBe(true);
    expect([...kinds].some((k) => k.startsWith("game:"))).toBe(true);
  });

  it("the control: the button, 饿着 when it was not fed today, nothing while a fight is on or once it is fought", () => {
    const state = { day: 3, found: ["chick"], upgraded: {} } as unknown as State;
    const hungry = fightControl(state, [meal(1)], "task1", false)!.value;
    expect(hungry).toContain('data-action="battle-start"');
    expect(hungry).toContain(`<small class="wl-hungry">${t("battle.hungry")}</small>`);
    const fed = fightControl(state, [meal(3)], "task1", false)!.value;
    expect(fed).toContain(`data-action="battle-start">${t("battle.go")}</button>`);
    expect(fed).not.toContain("wl-hungry");
    expect(fightControl(state, [meal(3)], "task1", true)).toBeNull();
    expect(fightControl(state, [meal(3), { kind: "open", day: 3, target: "battle:task1", t: "10:00" }], "task1", false)).toBeNull();
    expect(fightControl({ ...state, found: [] } as unknown as State, [], "task1", false)).toBeNull();
  });
});

describe("R3: strength", () => {
  it("the chick: 8 HP and 4 % damage a level; fed today +16, not fed −16, never under 40", () => {
    expect(chickStrength(0, true)).toEqual({ level: 0, hp: OURS_HP + FED_HP, mul: 1 });
    expect(chickStrength(0, false)).toEqual({ level: 0, hp: OURS_HP - FED_HP, mul: 1 });
    expect(chickStrength(5, true)).toEqual({ level: 5, hp: OURS_HP + 5 * HP_PER_LEVEL + FED_HP, mul: 1.2 });
    expect(chickStrength(18, false).hp).toBe(OURS_HP + 18 * HP_PER_LEVEL - FED_HP);
    expect(Math.min(...[0, 1, 2].map((n) => chickStrength(n, false).hp))).toBeGreaterThanOrEqual(OURS_HP_MIN);
  });

  it("the work's monster: 8 HP and 4 % damage a day past the first", () => {
    expect(foeStrength(1)).toEqual({ level: 1, hp: FOE_HP, mul: 1 });
    const d10 = foeStrength(10);
    expect([d10.level, d10.hp]).toEqual([10, FOE_HP + 9 * HP_PER_LEVEL]);
    expect(d10.mul).toBeCloseTo(1.36, 6);
  });

  it("the fight starts with those numbers and the damage is multiplied", () => {
    const strong = startBattle("9:t", "foe", "/x.png", 0, chickStrength(9, true), foeStrength(9));
    expect([strong.ours.max, strong.theirs.max, strong.level, strong.foeLevel]).toEqual([OURS_HP + 72 + FED_HP, FOE_HP + 64, 9, 9]);
    const plain = startBattle("9:t", "foe", "/x.png", 0);
    const hit = (s: ReturnType<typeof startBattle>) => { const m = { ...s, phase: "menu" as const, queue: [] }; return m.theirs.hp - battleTurn(m, "grind", 1).theirs.hp; };
    // the same seeded roll, 1.36 times the damage (give or take the rounding)
    const base = hit({ ...plain, theirs: { ...plain.theirs, hp: 500, max: 500 } });
    const up = hit({ ...plain, oursMul: 1.36, theirs: { ...plain.theirs, hp: 500, max: 500 } });
    expect(Math.abs(up - base * 1.36)).toBeLessThanOrEqual(1);
  });

  it("a win reads: the foe is down, the banner (大鸡大利，工作顺意), then what it did for the work; the last screen keeps both", () => {
    let s = { ...startBattle("3:t", "foe", "/x.png", 0), phase: "menu" as const, queue: [] } as ReturnType<typeof startBattle>;
    s = battleTurn({ ...s, theirs: { ...s.theirs, hp: 1 } }, "grind", 1);
    expect(s.queue.slice(-3).map((l) => l.t)).toEqual([t("battle.won", { foe: "foe" }), t("battle.win.banner"), t("battle.win.grade")]);
    expect(t("battle.win.banner")).toBe("大鸡大利，工作顺意！");
    expect(t("battle.win.grade")).toBe("小鸡的胜利使你的工作变得更优秀了。");
    while (s.phase === "text") s = battleCmd(s, "next", 2);
    const out = battleScene(s, 3).value;
    expect(out).toContain(`<div class="bt-box bt-won"><p class="bt-line bt-banner">${t("battle.win.banner")}</p><p class="bt-line">${t("battle.win.grade")}</p>`);
    const lost = battleScene({ ...s, phase: "lost" }, 3).value;
    expect(lost).not.toContain("bt-banner");
  });

  it("fed every day it wins on every day; never fed it loses in the late days (the same moves, the seeded dice)", () => {
    const fight = (day: number, fed: boolean): string => {
      let s = startBattle(`${day}:t`, "foe", "/x.png", 0, chickStrength(fed ? day : 0, fed), foeStrength(day));
      for (let i = 0; i < 400 && !["won", "lost"].includes(s.phase); i++) {
        if (s.phase === "text") s = battleCmd(s, "next", i);
        else s = battleTurn(s, "hype", i);
      }
      return s.phase;
    };
    const days = Array.from({ length: 18 }, (_, i) => i + 1);
    expect(days.map((d) => fight(d, true)).filter((r) => r === "won").length).toBe(18);
    expect(days.filter((d) => d >= 12).map((d) => fight(d, false)).filter((r) => r === "lost").length).toBe(7);
  });
});

describe("R4: a win raises the task one step; a loss changes nothing", () => {
  const task = () => taskByFlag(1, "task_merge_done")!;
  const board = () => task().board!;

  it("one step up, perfect stays", () => {
    expect((["wrong", "flawed", "perfect"] as const).map(liftVerdict)).toEqual(["flawed", "perfect", "perfect"]);
  });

  it("the board: a win lifts it, a loss leaves it as it was", () => {
    const b = board();
    const fresh = freshBoard(b);
    expect(stepBoard(b, fresh, { t: "chick", won: false })).toBe(fresh);
    expect(stepBoard(b, fresh, { t: "chick", won: true }).lifted).toBe(true);
  });

  it("a draft under the boss's bar: it cannot go; the chick wins; it goes as it is, without Kuro", () => {
    const b = board();
    const cmp = b.compare!;
    let w = freshBoard(b);
    for (const p of cmp.pages) {
      const answer = b.slots.find((x) => x.id === p.slot)!.answer;
      w = stepBoard(b, w, { t: "fill", slot: p.slot, card: cmp.pages.indexOf(p) < 2 ? answer : p.cards.find((c) => c !== answer)! });
    }
    expect(compareScore(b, w).pct).toBeLessThan(cmp.threshold);
    expect([canPrint(b, w), settleVerdict(b, w)]).toEqual([false, "fail"]);
    const lost = stepBoard(b, w, { t: "chick", won: false });
    expect([canPrint(b, lost), settleVerdict(b, lost)]).toEqual([false, "fail"]);
    const won = stepBoard(b, w, { t: "chick", won: true });
    expect([canPrint(b, won), settleVerdict(b, won), won.assists]).toEqual([true, "pass", 0]);
    expect(compareScore(b, won).pct).toBe(compareScore(b, w).pct); // no cell filled itself
  });

  it("a table with a wrong cell: 让克总帮忙 only; after the win, the send button and the chick's line", () => {
    // no board of the run is a plain table any more (each has its game); the rule still stands for one:
    // day 4's board with its game taken off
    const t4 = taskByFlag(4, "task_d4_1")!;
    const b = { ...t4.board!, game: undefined };
    let w = { ...freshBoard(b), unlocked: true };
    const [first, ...rest] = b.slots;
    const wrongCard = b.cards.find((c) => c.id !== first!.answer && !b.slots.some((s) => s.answer === c.id)) ?? b.cards.find((c) => c.id !== first!.answer)!;
    w = stepBoard(b, w, { t: "fill", slot: first!.id, card: wrongCard.id });
    for (const s of rest) w = stepBoard(b, w, { t: "fill", slot: s.id, card: s.answer });
    expect(settleVerdict(b, w)).toBe("fail");
    expect(settleActions(t4, b, w).buttons.value).toContain('data-action="settle-kuro"');
    const won = stepBoard(b, w, { t: "chick", won: true });
    expect(settleVerdict(b, won)).toBe("pass");
    const a = settleActions(t4, b, won);
    expect(a.buttons.value).toContain('data-action="board-print"');
    expect(a.buttons.value).not.toContain("settle-kuro");
    expect(a.line!.value).toContain(t("battle.win.grade"));
  });

  it("on the work screen: the draft under the bar offers only Kuro; after the chick's win it offers the send button and says why", () => {
    const store = createStore({ startDay: 1, patch: { found: ["chick"] } as never });
    completeUntil(store, task().id);
    const b = board();
    for (const p of b.compare!.pages) {
      const answer = b.slots.find((x) => x.id === p.slot)!.answer;
      store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "fill", slot: p.slot, card: p.cards.find((c) => c !== answer)! } });
    }
    const session = initialSession({ beat: "work", time: "14:00" }, "left", "desktop");
    session.workShow = `1:${task().id}`;
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: 99_000 })!.value;
    expect(out()).toContain('data-screen="settle"');
    expect(out()).toContain('data-action="compare-redo"');
    expect(out()).not.toContain('data-action="board-print"');
    expect(out()).toContain('data-action="battle-start"'); // the fight is offered at the settlement too
    store.appendEvent({ kind: "open", target: `battle:${task().id}`, t: "14:00" });
    store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "chick", won: true } });
    expect(out()).toContain('data-action="board-print">');
    expect(out()).not.toContain('data-action="compare-redo"');
    expect(out()).toContain(`<p class="cmp-verdict pass chick">${t("battle.win.grade")}</p>`);
    expect(out()).not.toContain('data-action="battle-start"');
  });

  it("the night's judgement: Kuro's rewrite is flawed; with the chick's win, perfect; a loss, still flawed; never given, wrong", () => {
    const night = (fight: boolean | null, give = true) => {
      const store = createStore({ startDay: 1 });
      const b = board();
      for (const p of b.compare!.pages) store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "fill", slot: p.slot, card: p.cards[0]! } });
      store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "assistFill" } });
      if (fight !== null) store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "chick", won: fight } });
      const s = boardState(b, 1, task().id, store.getEvents());
      store.appendEvent({ kind: "task", flag: task().done, mode: "let", slots: { ...s.slots }, assists: s.assists });
      if (give) store.appendEvent({ kind: "give", deliverableId: task().deliverable!.id, t: "15:00" });
      return { verdict: boardJudgement(1, store.getEvents())!.verdict, fights: chickFights(store.getEvents(), 1) };
    };
    expect(night(null)).toEqual({ verdict: "flawed", fights: { won: 0, lost: 0 } });
    expect(night(true)).toEqual({ verdict: "perfect", fights: { won: 1, lost: 0 } });
    expect(night(false)).toEqual({ verdict: "flawed", fights: { won: 0, lost: 1 } });
  });
});

describe("R5: Kuro's three days, then no more fights", () => {
  const upgraded = (day: number, on: number): [State, GameEvent[]] => [{ day, found: ["chick"], upgraded: { chick: true } } as unknown as State, [{ kind: "upgrade", day: on, object: "chick" }, meal(1), meal(2)]];

  it("the upgrade day and the two after: six levels up; from the third day after: taken, no fight", () => {
    for (const d of [5, 6, 7]) {
      const [state, events] = upgraded(d, 5);
      const c = chickToday(state, events);
      expect([c.taken, c.kuro, c.kuroDaysLeft, c.strength.level], String(d)).toEqual([false, true, 8 - d, 2 + KURO_LEVELS]);
      expect(fightControl(state, events, "task1", false)!.value).toContain('data-action="battle-start"');
    }
    const [state, events] = upgraded(8, 5);
    expect(chickToday(state, events)).toMatchObject({ taken: true, kuro: false });
    const chip = fightControl(state, events, "task1", false)!.value;
    expect(chip).toBe(`<span class="wl-battle taken" aria-disabled="true">${t("battle.taken")}</span>`);
  });

  it("never upgraded: its own level, never taken", () => {
    const c = chickToday({ day: 18, found: ["chick"], upgraded: {} } as unknown as State, [meal(1), meal(2), meal(18)]);
    expect([c.taken, c.kuro, c.fedDays, c.fedToday, c.strength.level]).toEqual([false, false, 3, true, 3]);
  });
});

describe("R6: the status panel shows the chick", () => {
  const base = (over: Partial<State> = {}): State => ({ ...createStore({ startDay: 5 }).getState(), found: ["chick", "camera"], ...over }) as State;
  const session = { ...initialSession(DEFAULT_CLOCK, "left", "room"), statusOpen: true };

  it("no row before the chick is found; then it sits above the old things", () => {
    expect(chickRow(base({ found: [] }), [])).toBeNull();
    const panel = statusPanel(base(), [], session)!.value;
    expect(panel.indexOf("st-chick")).toBeGreaterThan(-1);
    expect(panel.indexOf("st-chick")).toBeLessThan(panel.indexOf("st-cases"));
  });

  it("fed today or hungry; a cell per day of the run, lit per day fed; today's fights", () => {
    const hungry = chickRow(base(), [meal(1), meal(3)])!.value;
    expect(hungry).toContain(`<span class="st-chick-today hungry"><i class="st-dot"></i>${t("status.chick.hungry")}</span>`);
    expect((hungry.match(/<i class="f"><\/i>/g) ?? []).length).toBe(2);
    expect((hungry.match(/<i class="f?"><\/i>/g) ?? []).length).toBe(5);
    expect(hungry).toContain(t("status.chick.days", { n: 2 }));
    expect(hungry).toContain(t("status.chick.fight.none"));
    const fed = chickRow(base(), [meal(5), { kind: "boardStep", day: 5, taskId: "a", op: { t: "chick", won: true } }, { kind: "boardStep", day: 5, taskId: "b", op: { t: "chick", won: false } }])!.value;
    expect(fed).toContain(`<span class="st-chick-today fed"><i class="st-dot"></i>${t("status.chick.fed")}</span>`);
    expect(fed).toContain(t("status.chick.fight", { n: 2, w: 1 }));
  });

  it("while Kuro has it: the days left; once taken: only that it is Kuro's", () => {
    const loan = chickRow(base({ upgraded: { chick: true } as State["upgraded"] }), [{ kind: "upgrade", day: 4, object: "chick" }])!.value;
    expect(loan).toContain(t("status.chick.kuro", { n: 2 }));
    const taken = chickRow(base({ upgraded: { chick: true } as State["upgraded"] }), [{ kind: "upgrade", day: 2, object: "chick" }])!.value;
    expect(taken).toContain(t("status.chick.taken"));
    expect(taken).not.toContain("st-chick-today");
    expect(taken).not.toContain("st-bar");
  });

  it("the waking thought: from day 2, held since yesterday, its own, and unfed yesterday; else nothing", () => {
    const st = (day: number, over: Partial<State> = {}) => ({ day, found: ["chick"], upgraded: {}, ...over }) as unknown as State;
    const had: GameEvent = { kind: "openLayer", day: 1, objectId: "chick" };
    expect(chickForgotten(st(2), [had])).toBe(true);
    expect(chickForgotten(st(2), [had, meal(1)])).toBe(false);
    expect(chickForgotten(st(1), [had])).toBe(false);
    expect(chickForgotten(st(3), [{ kind: "openLayer", day: 3, objectId: "chick" }])).toBe(false); // only found today
    expect(chickForgotten(st(2, { found: [] as never }), [had])).toBe(false);
    expect(chickForgotten(st(2, { upgraded: { chick: true } as never }), [had])).toBe(false);
  });
});
