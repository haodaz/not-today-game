// lock-by-device (2026-11-06): R1 an object lock has no chips; its code is read off the open device
// (the 老物件栏 modal's footer); R2 deviceReading per device; R3 one wrong reading is flawed, two jam
// the lock for the day (only 让它试 is left), and the night's judgement counts them. Source locks keep
// their chips.
import { describe, expect, it } from "vitest";
import { boardJudgement, boardState, lockJammed, wrongReadings } from "@state/days/board";
import { dayFiles } from "@state/days/table";
import { taskFiles, type Task } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { lockRow } from "@world/desktop/workbench/board";
import { lockReading } from "@world/desktop/workbench/lockread";
import { renderObjectBarUse } from "@world/desktop/workbench/objbar";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { EMPTY_DIALOGUE, push } from "@world/loop/dialogue";
import { envFor, PROGRAMS } from "@world/objects/index";
import { UPSIDE_DOWN_DEG, upsideDownOf } from "@world/objects/calculator";
import { codeInReading, deviceReading } from "@world/objects/reading";
import { loopActions } from "@world/room/game";
import { renderRoom } from "@world/room/hud";
import { completeUntil } from "./complete-items";
import * as await_openWork from "@world/desktop/workbench/work";

const WORK = { beat: "work" as const, time: "10:00" };
function session(view: Session["view"] = "desktop"): Session {
  const s = initialSession(WORK, "left", view);
  s.dialogue = EMPTY_DIALOGUE;
  return s;
}
const store1 = (found: string[] = []) => {
  const s = createStore({ startDay: 3 });
  for (const id of found) s.appendEvent({ kind: "openLayer", objectId: id });
  return s;
};
const env = (store: Store, s: Session, id: string) => envFor(store.getState(), store.getEvents(), s, id, 0);

describe("R2 · deviceReading", () => {
  it("dictionary: a known word looked up → the word as typed (trimmed, lower-case); unknown or typing → null", () => {
    const st = store1();
    const s = session();
    const e = env(st, s, "dictionary");
    const base = PROGRAMS.dictionary!.init(e) as object;
    expect(deviceReading("dictionary", { ...base, input: " Depart ", answer: ["离开", "v."] }, e, s)).toBe("depart");
    expect(deviceReading("dictionary", { ...base, input: "zzz", answer: ["zzz", t("dictionary.unknown")] }, e, s)).toBeNull();
    expect(deviceReading("dictionary", { ...base, input: "dep", answer: null }, e, s)).toBeNull();
  });

  it("calculator: on and showing a number → the display; off, empty or 0 → null; upside down → what it reads that way", () => {
    const st = store1();
    const s = session();
    const e = env(st, s, "calculator");
    const base = PROGRAMS.calculator!.init(e) as object;
    expect(deviceReading("calculator", { ...base, on: true, display: "0.7734" }, e, s)).toBe("0.7734");
    expect(deviceReading("calculator", { ...base, on: false, display: "0.7734" }, e, s)).toBeNull();
    expect(deviceReading("calculator", { ...base, on: true, display: "0" }, e, s)).toBeNull();
    expect(deviceReading("calculator", { ...base, on: true, display: "" }, e, s)).toBeNull();
    s.hand.roll = UPSIDE_DOWN_DEG + 10;
    expect(deviceReading("calculator", { ...base, on: true, display: "0.7734" }, e, s)).toBe(upsideDownOf("0.7734"));
  });

  it("pager: a page shown → its text; dark or the time → null", () => {
    const st = createStore({ startDay: 4 });
    const s = session();
    const e = env(st, s, "pager");
    expect(e.pager.length).toBeGreaterThan(0);
    const base = PROGRAMS.pager!.init(e) as object;
    const shown = deviceReading("pager", { ...base, view: "msg", index: 0 }, e, s);
    expect(shown).toBe([...e.pager].reverse()[0]!.text);
    expect(deviceReading("pager", { ...base, view: "dark" }, e, s)).toBeNull();
    expect(deviceReading("pager", { ...base, view: "time" }, e, s)).toBeNull();
  });

  it("tape: a tape line in the box now → its text (backwards too); none → null", () => {
    const st = createStore({ startDay: 12 });
    const s = session();
    const e = env(st, s, "tape");
    expect(deviceReading("tape", null, e, s)).toBeNull();
    s.dialogue = push(EMPTY_DIALOGUE, { key: "d12:tape:side-a", lines: [{ k: "narration", t: "往东北走" }, { k: "narration", t: "别回头" }], ending: { kind: "none" } });
    expect(deviceReading("tape", null, e, s)).toBe("往东北走");
    s.dialogue = { ...s.dialogue, line: 1 };
    expect(deviceReading("tape", null, e, s)).toBe("别回头");
    // Backwards: the reverse play's own say, the same prefix.
    s.dialogue = push(EMPTY_DIALOGUE, { key: "d12:tape:side-a:rev", lines: [{ k: "narration", t: "南西往" }], ending: { kind: "none" } });
    expect(deviceReading("tape", null, e, s)).toBe("南西往");
    // Another line in the box is not the tape's.
    s.dialogue = push(EMPTY_DIALOGUE, { key: "d12:beat:boot", lines: [{ k: "inner", t: "东北" }], ending: { kind: "none" } });
    expect(deviceReading("tape", null, e, s)).toBeNull();
  });

  it("camera: the back → the sheets-left counter as its two cells show it; the front → null; any other object → null", () => {
    const st = store1();
    const s = session();
    const e = { ...env(st, s, "camera"), sheets: 9 };
    s.hand.face = "back";
    expect(deviceReading("camera", null, e, s)).toBe("09");
    s.hand.face = "front";
    expect(deviceReading("camera", null, e, s)).toBeNull();
    expect(deviceReading("chick", null, e, s)).toBeNull();
    expect(deviceReading("iccard", null, e, s)).toBeNull();
  });

  it("the code a reading shows: the first lock code it contains; none → null", () => {
    expect(codeInReading(["12", "9", "4"], "09")).toBe("9");
    expect(codeInReading(["depart", "remain"], "depart")).toBe("depart");
    expect(codeInReading(["东北", "西南"], "一直往东北走")).toBe("东北");
    expect(codeInReading(["12", "9"], "33")).toBeNull();
    expect(codeInReading(["12"], null)).toBeNull();
  });
});

// ——— the day-7 dictionary lock, in play ———

const lockTask = (day: number, object: string): Task => taskFiles.get(day)!.find((x) => x.board?.given.lock?.object === object && !x.board.given.lock.from)!;
const itemOf = (day: number, task: Task) => dayFiles.get(day)!.items.find((it) => it.done.kind === "flag" && it.done.flag === task.done)!.id;

function day7() {
  const store = createStore({ startDay: 7 });
  store.appendEvent({ kind: "openLayer", objectId: "dictionary" });
  const task = lockTask(7, "dictionary");
  // Day 7's lock is on its night task (晨会纪要): the day's other items done first, so night falls.
  completeUntil(store, itemOf(7, task), { all: true, skip: [itemOf(7, task)] });
  const s = session("desktop");
  const ctx: ActionContext = { store, session: s, rerender: () => {}, later: () => {}, now: () => 0 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session: s, night: false, nowMs: 0 });
  const board = task.board!;
  const st = () => boardState(board, 7, task.id, store.getEvents());
  const row = () => lockRow(board, st(), store.getState(), store.getEvents(), s)?.value ?? "";
  const modal = () => renderObjectBarUse(app(), 0)?.value ?? "";
  /**
   * The open dictionary shows `word` looked up and known. (Set on its program state: content's
   * dictionary table does not carry day 7's codes yet — Claude's, per R2 — so a real lookup of them
   * reads 查无此词 today.)
   */
  const lookUp = (word: string) => {
    const prog = s.hand.programs.dictionary as Record<string, unknown>;
    s.hand.programs.dictionary = { ...prog, open: true, on: true, input: word, answer: [word, "v."] };
  };
  const clearWord = () => undefined;
  return { store, s, ctx, act, task, board, st, row, modal, lookUp, clearWord };
}

describe("R1 · no chips; the footer reads it off the device", () => {
  it("an object lock renders no chips; a source lock still does", () => {
    const r = day7();
    expect(await_openWork.openWork(r.store.getState(), r.store.getEvents())?.tree?.id).toBe(r.task.id);
    r.act("board-lock");
    expect(r.s.objbarOpen).toBe(true);
    expect(r.row()).not.toContain("bcode");
    // A source lock (day 5's Vivi DM) keeps its chips once its source is open.
    const src = taskFiles.get(5)!.find((x) => x.board?.given.lock?.from)!;
    const s5 = createStore({ startDay: 5 });
    const conv = (src.board!.given.lock!.from as { conv: string }).conv;
    s5.appendEvent({ kind: "open", target: `conv:${conv}`, t: "10:00" });
    const ss = session();
    ss.boardLockOpen = true;
    const out = lockRow(src.board!, boardState(src.board!, 5, src.id, s5.getEvents()), s5.getState(), s5.getEvents(), ss)!.value;
    expect(out).toContain('class="bcode" data-action="board-code"');
  });

  it("the read button appends the unlock op with the matched code; the right reading opens the column", () => {
    const r = day7();
    r.act("board-lock");
    expect((r.s.hand.programs.dictionary as { open: boolean }).open).toBe(true); // board-lock opens the clamshell
    let m = r.modal();
    // Nothing looked up yet: the reading is empty, the button off, 它现在显示的不是提取码.
    expect(m).toContain('<div class="ob-foot"');
    expect(m).toContain(`<span class="ob-noreading">${escapeHtml(t("board.lock.noReading"))}</span>`);
    expect(m).toMatch(/<button type="button" class="ob-read" data-action="board-read" disabled>/);
    r.lookUp(r.board.given.lock!.answer);
    m = r.modal();
    expect(m).toContain(`<span class="ob-reading">${r.board.given.lock!.answer}</span>`);
    expect(m).toContain(`data-action="board-read">${escapeHtml(t("board.lock.read"))}</button>`);
    r.act("board-read");
    expect(r.store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", taskId: r.task.id, op: { t: "unlock", code: r.board.given.lock!.answer } });
    expect(r.st().unlocked).toBe(true);
    expect(r.modal()).not.toContain("ob-foot");
  });

  it("with the device closed again the panel says 打开它，照它显示的填", () => {
    const r = day7();
    r.act("board-lock");
    r.act("objbar-close");
    expect(r.row()).toContain(escapeHtml(t("board.lock.open")));
  });
});

describe("R3 · a wrong reading costs", () => {
  const wrongTwo = (lock: { codes: readonly string[]; answer: string }) => lock.codes.filter((c) => c !== lock.answer);

  it("one wrong: status wrong1, the lock stays; two: jammed, the footer gone, only 让它试 — which still opens it with one assist", () => {
    const r = day7();
    const lock = r.board.given.lock!;
    const [w1, w2] = wrongTwo(lock);
    r.act("board-lock");
    r.lookUp(w1!);
    expect(lockReading(r.store.getState(), r.store.getEvents(), r.s, "dictionary", 0)?.code).toBe(w1);
    r.act("board-read");
    expect(wrongReadings(r.st())).toBe(1);
    expect(r.st().unlocked).toBe(false);
    expect(r.row()).toContain(escapeHtml(t("board.lock.wrong1")));
    expect(r.modal()).toContain("ob-foot");
    // The same wrong code again is still one distinct wrong reading.
    r.act("board-read");
    expect(wrongReadings(r.st())).toBe(1);
    r.clearWord();
    r.lookUp(w2!);
    r.act("board-read");
    expect(wrongReadings(r.st())).toBe(2);
    expect(lockJammed(r.board, r.st())).toBe(true);
    expect(r.row()).toContain(escapeHtml(t("board.lock.jammed")));
    expect(r.row()).toContain('data-action="board-kuro-lock"');
    expect(r.modal()).not.toContain("ob-foot");
    // Jammed: no more readings are taken.
    const n = r.store.getEvents().length;
    r.act("board-code", { code: lock.answer });
    expect(r.store.getEvents()).toHaveLength(n);
    r.act("board-kuro-lock");
    expect(r.st()).toMatchObject({ unlocked: true, assists: 1 });
    expect(wrongReadings(r.st())).toBe(2); // a Kuro unlock does not undo them
  });

  it("the judgement: all slots right + one wrong reading → flawed (or wrong at wrongAt 1); + two → wrong; replay gives the same", () => {
    const verdictWith = (wrong: number) => {
      const r = day7();
      const lock = r.board.given.lock!;
      for (const code of wrongTwo(lock).slice(0, wrong)) r.store.appendEvent({ kind: "boardStep", taskId: r.task.id, op: { t: "unlock", code } });
      if (wrong < 2) r.store.appendEvent({ kind: "boardStep", taskId: r.task.id, op: { t: "unlock", code: lock.answer } });
      else r.store.appendEvent({ kind: "boardStep", taskId: r.task.id, op: { t: "assistUnlock" } });
      const slots = Object.fromEntries(r.board.slots.map((sl) => [sl.id, sl.answer]));
      r.store.appendEvent({ kind: "task", flag: r.task.done, mode: wrong < 2 ? "self" : "let", slots, assists: wrong < 2 ? 0 : 1 });
      r.store.appendEvent({ kind: "give", deliverableId: r.task.deliverable!.id, t: "17:00" });
      const v = boardJudgement(7, r.store.getEvents())!;
      // Replay: the same log, a fresh store, the same verdict.
      const again = createStore({ startDay: 7, events: r.store.getEvents() });
      expect(boardJudgement(7, again.getEvents())).toEqual(v);
      return v.verdict;
    };
    const wrongAt = r7WrongAt();
    expect(verdictWith(0)).toBe("perfect");
    expect(verdictWith(1)).toBe(wrongAt > 1 ? "flawed" : "wrong");
    expect(verdictWith(2)).toBe("wrong");
  });
});
const r7WrongAt = () => lockTask(7, "dictionary").judge!.wrongAt;

describe("R5 · snapshot", () => {
  it("the day-7 dictionary lock with the device open and a reading", () => {
    const r = day7();
    r.act("board-lock");
    r.lookUp(r.board.given.lock!.codes[0]!);
    const foot = /<div class="ob-foot"[\s\S]*?<\/div>/.exec(r.modal())![0];
    expect({ row: r.row(), foot }).toMatchSnapshot();
  });
});

// ——— the lock's face (2026-11-10): the code is read where the device shows it ———
// A face lock (day 8's calculator, 「拿去窗那边用」) sends the player to the window; the calculator
// works there by day, but the 老物件栏 modal is the desk's (and by day, lampless, the calculator does
// not open from it). So 就按它显示的填 sits under the device in the room's 使用 as well.
describe("the room's 使用 carries the read footer at the lock's face", () => {
  it("day 8 at 窗: the footer under the calculator, off until it shows a code; the right reading opens the column from there", () => {
    const task = lockTask(8, "calculator");
    const answer = task.board!.given.lock!.answer;
    const store = createStore({ startDay: 8 });
    store.appendEvent({ kind: "openLayer", objectId: "calculator" });
    store.appendEvent({ kind: "recognise", objectId: "calculator" });
    completeUntil(store, itemOf(8, task));
    expect(await_openWork.openWork(store.getState(), store.getEvents())?.tree?.id).toBe(task.id);
    const s = initialSession(WORK, "right", "window");
    s.dialogue = EMPTY_DIALOGUE;
    s.hand.inLight = true;
    const ctx: ActionContext = { store, session: s, rerender: () => {}, later: () => {}, now: () => 0 };
    const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
    const room = () => renderRoom({ state: store.getState(), events: store.getEvents(), session: s, nowMs: 0 }).value;
    // Lifted and used at the window: logged ok, so the lock's code is offered; nothing keyed yet.
    act("loop-hold", { object: "calculator" });
    expect(room()).not.toContain("ob-foot"); // holding only: no footer
    act("obj-use");
    let out = room();
    expect(out).toContain('<div class="dev-focus">');
    expect(out).toContain(`<div class="ob-foot" data-lock="${task.id}">`);
    expect(out).toMatch(/<button type="button" class="ob-read" data-action="board-read" disabled>/);
    for (const k of ["C", ...answer]) act("obj-key", { object: "calculator", key: k });
    out = room();
    expect(out).toContain(`<span class="ob-reading">${answer}</span>`);
    expect(out).toContain(`data-action="board-read">${escapeHtml(t("board.lock.read"))}</button>`);
    expect(s.objbarOpen).toBe(false);
    act("board-read");
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: answer } });
    expect(boardState(task.board!, 8, task.id, store.getEvents()).unlocked).toBe(true);
    expect(room()).not.toContain("ob-foot");
  });

  it("at 床 by day the calculator does not work, so nothing is offered: no footer; the modal still draws one footer, not two", () => {
    const task = lockTask(8, "calculator");
    const store = createStore({ startDay: 8 });
    store.appendEvent({ kind: "openLayer", objectId: "calculator" });
    store.appendEvent({ kind: "recognise", objectId: "calculator" });
    completeUntil(store, itemOf(8, task));
    const s = initialSession(WORK, "right", "bed");
    s.dialogue = EMPTY_DIALOGUE;
    s.hand.inLight = true;
    const ctx: ActionContext = { store, session: s, rerender: () => {}, later: () => {}, now: () => 0 };
    const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
    act("loop-hold", { object: "calculator" });
    act("obj-use");
    expect(s.hand.using).toBe(false);
    expect(renderRoom({ state: store.getState(), events: store.getEvents(), session: s, nowMs: 0 }).value).not.toContain("ob-foot");
    // Used at the window once (the code is offered from then on), then the modal at the desk, lamp
    // on at night: one footer, the modal's own (the room's is not drawn inside it).
    const w = initialSession(WORK, "right", "window");
    w.dialogue = EMPTY_DIALOGUE;
    w.hand.inLight = true;
    const wctx: ActionContext = { store, session: w, rerender: () => {}, later: () => {}, now: () => 0 };
    loopActions["loop-hold"]!(wctx, { object: "calculator" } as unknown as DOMStringMap, null as never);
    loopActions["obj-use"]!(wctx, {} as DOMStringMap, null as never);
    expect(store.getEvents().some((e) => e.kind === "useAt" && e.objectId === "calculator" && e.facing === "window" && e.ok)).toBe(true);
    const night = initialSession({ beat: "night", time: "23:10" }, "right", "desktop");
    night.dialogue = EMPTY_DIALOGUE;
    const nctx: ActionContext = { store, session: night, rerender: () => {}, later: () => {}, now: () => 0 };
    loopActions["objbar-open"]!(nctx, { object: "calculator" } as unknown as DOMStringMap, null as never);
    expect(night.objbarOpen).toBe(true);
    const m = renderObjectBarUse({ state: store.getState(), events: store.getEvents(), startDay: 8, session: night, night: true, nowMs: 0 }, 0)?.value ?? "";
    expect(m.match(/class="ob-foot"/g)?.length).toBe(1);
  });
});
