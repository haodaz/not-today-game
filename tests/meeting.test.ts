// meeting (2026-11-04): the meeting view of a work-v2 board. The loader (R1), the meeting card source
// (R3), the view (R2), playing (R3), and a play-through. Uses the fixture
// .kiro/specs/meeting/board-meeting.json (placeholder text), injected as day-1 task3; content is not edited.
import "./specimen";
import { describe, expect, it, vi } from "vitest";
import fixture from "../.kiro/specs/meeting/board-meeting.json";
import tasks01 from "@content/tasks/day-01.json";
import { parseTaskFile, type BoardCard, type Task, type TaskBoard } from "@state/days/tasks";

/** Day 1 with task3 as the fixture board (its real id and done flag). */
function meetingDay01(mut: (t: any) => void = () => {}) {
  const raw = structuredClone(tasks01) as any;
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board: structuredClone(fixture.board), deliverable: structuredClone(fixture.deliverable), judge: structuredClone(fixture.judge) } : t,
  );
  mut(raw.tasks.find((t: any) => t.id === "task3"));
  return raw;
}
const parseWith = (mut: (t: any) => void) => () => parseTaskFile(meetingDay01(mut), "day-01.json");
const seatsOf = (t: any) => {
  t.board.meeting.layout = "seats";
  t.board.meeting.seats = { s1: "circle", s2: "circle", s3: "triangle" };
};

describe("the loader (meeting R1)", () => {
  it("loads a meeting board: view, people, lines, layout; the meeting card source", () => {
    const b = parseWith(() => {})().tasks.find((t) => t.id === "task3")!.board!;
    expect(b.view).toBe("meeting");
    expect(b.meeting!.people.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(b.meeting!.people[1]).toEqual({ id: "p2", name: "person two", tile: "/npc/sil_1.png" });
    expect(b.meeting!.lines[1]).toEqual({ t: "09:01", who: "p2", text: "line-1", card: "m1" });
    expect(b.meeting!.layout).toBe("grid");
    expect(b.cards[0]!.from).toEqual({ meeting: true });
  });
  it("loads the seats layout", () => {
    const b = parseWith(seatsOf)().tasks.find((t) => t.id === "task3")!.board!;
    expect(b.meeting!.seats).toEqual({ s1: "circle", s2: "circle", s3: "triangle" });
  });
  it("a meeting only with view \"meeting\", and view \"meeting\" only with a meeting", () => {
    expect(parseWith((t) => delete t.board.view)).toThrow(/a meeting needs view "meeting"/);
    expect(parseWith((t) => (t.board.view = "table"))).toThrow(/a meeting needs view "meeting"/);
    expect(parseWith((t) => delete t.board.meeting)).toThrow(/view "meeting" needs a meeting/);
  });
  it("every who is a person; every card exists and comes from the meeting", () => {
    expect(parseWith((t) => (t.board.meeting.lines[0].who = "nobody"))).toThrow(/"nobody" is not a person/);
    expect(parseWith((t) => (t.board.meeting.lines[0].card = "zz"))).toThrow(/"zz" is not a card/);
    expect(parseWith((t) => (t.board.meeting.lines[0].card = "a1"))).toThrow(/"a1" does not come from the meeting/);
  });
  it("every seat names a slot (and each slot has one); seats only with layout \"seats\"", () => {
    expect(parseWith((t) => (t.board.meeting.layout = "seats"))).toThrow(/layout "seats" needs seats/);
    expect(parseWith((t) => (seatsOf(t), (t.board.meeting.seats.zz = "circle")))).toThrow(/"zz" is not a slot/);
    expect(parseWith((t) => (seatsOf(t), (t.board.meeting.seats.s1 = "square")))).toThrow(/must be one of circle, triangle/);
    expect(parseWith((t) => (seatsOf(t), delete t.board.meeting.seats.s3))).toThrow(/slot "s3" has no seat/);
    expect(parseWith((t) => (t.board.meeting.seats = { s1: "circle" }))).toThrow(/seats only with layout "seats"/);
    expect(parseWith((t) => (t.board.meeting.layout = "row"))).toThrow(/must be one of grid, seats/);
  });
  it("a meeting card needs a meeting that reveals it; a lock never comes from the meeting", () => {
    expect(
      parseWith((t) => {
        delete t.board.view;
        delete t.board.meeting;
      }),
    ).toThrow(/"m1" comes from a meeting, but the board has none/);
    expect(parseWith((t) => delete t.board.meeting.lines[3].card)).toThrow(/"m2" comes from the meeting, but no line reveals it/);
    expect(parseWith((t) => (t.board.given.lock = { from: { meeting: true }, codes: ["0000"], answer: "0000" }))).toThrow(/a lock cannot come from the meeting/);
    expect(parseWith((t) => (t.board.cards[2].from = { meeting: true, conv: "boss" }))).toThrow(/exactly one of file \/ conv \/ call \/ meeting/);
    expect(parseWith((t) => (t.board.cards[2].from = { meeting: 1 }))).toThrow(/meeting: must be true/);
  });
  it("rejects unknown keys, bad times and tiles outside /", () => {
    expect(parseWith((t) => (t.board.meeting.extra = 1))).toThrow(/unknown key "extra"/);
    expect(parseWith((t) => (t.board.meeting.people[0].extra = 1))).toThrow(/unknown key "extra"/);
    expect(parseWith((t) => (t.board.meeting.lines[0].extra = 1))).toThrow(/unknown key "extra"/);
    expect(parseWith((t) => (t.board.meeting.lines[0].t = "9:00"))).toThrow(/HH:MM/);
    expect(parseWith((t) => (t.board.meeting.people[0].tile = "npc/x.png"))).toThrow(/under \//);
    expect(parseWith((t) => (t.board.meeting.people[1].id = "p1"))).toThrow(/duplicate person id "p1"/);
  });
});

// ——— the board injected as day-1 task3 (so the reducer accepts its steps) ———

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/meeting/board-meeting.json")).default as any;
  const d1 = (await import("@content/tasks/day-01.json")).default as any;
  const raw = structuredClone(d1);
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board: structuredClone(fx.board), deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) } : t,
  );
  const parsed = real.parseTaskFile(raw, "day-01.json");
  const t3 = parsed.tasks.find((t: any) => t.id === "task3")!;
  const files = new Map(real.taskFiles);
  files.set(1, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => (day === 1 && flag === t3.done ? t3 : real.taskByFlag(day, flag)) };
});

import { isOpenTarget, openedMeetingLine, type GameEvent } from "@state/events";
import { createStore, type Store } from "@state/store";
import { boardJudgement, cardFound, foundCardIds } from "@state/days/board";
import { meetingFurthest, meetingTarget } from "@state/days/meeting";
import { taskByFlag, taskFiles } from "@state/days/tasks";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderBoard } from "@world/desktop/workbench/board";
import { gridColumns, initials, MEETING_LINE_MS, MEETING_LINE_MS_FAST, meetingLineMs } from "@world/desktop/workbench/meeting";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const DONE = (tasks01 as any).tasks.find((x: any) => x.id === "task3").done as string;
const task = () => taskByFlag(1, DONE)!;
const board = () => task().board!;
const cardOf = (id: string): BoardCard => board().cards.find((c) => c.id === id)!;
const doneFlag = (id: string) => taskFiles.get(1)!.find((x) => x.id === id)!.done;

/** Day 1 with task3 (the meeting board) under way: booted, messages seen, task1 and task2 handed in. */
function day1(): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  for (const id of ["task1", "task2"]) store.appendEvent({ kind: "task", flag: doneFlag(id), mode: "self" });
  return store;
}
/** A harness with a fake clock: `later` is queued and run by hand. */
function harness(store: Store, session: Session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop")) {
  const queue: { ms: number; fn: () => void }[] = [];
  const ctx: ActionContext = { store, session, rerender: () => {}, later: (ms, fn) => void queue.push({ ms, fn }), now: () => 0 };
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: 0 });
  const out = () => renderWorkbench(app()).body.value;
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  /** Run the queued callbacks once (each may queue the next). */
  const step = () => queue.splice(0).forEach((q) => q.fn());
  return { session, ctx, app, out, act, queue, step };
}
const meetingOpens = (store: Store) => store.getEvents().filter((e) => e.kind === "open" && e.target.startsWith("meeting:")).map((e) => (e.kind === "open" ? e.target : ""));

describe("the meeting card source (meeting R3)", () => {
  const at = () => ({ board: board(), taskId: "task3" });
  const ev = (day: number, target: string) => ({ kind: "open", day, target, t: "10:00" }) as unknown as GameEvent;
  it("the open target meeting:<taskId>#<index>", () => {
    expect(isOpenTarget("meeting:task3#0")).toBe(true);
    expect(openedMeetingLine("meeting:task3#12")).toEqual({ taskId: "task3", index: 12 });
    for (const bad of ["meeting:task3", "meeting:#1", "meeting:task3#-1", "meeting:task3#01", "meeting:task3#x"]) expect(isOpenTarget(bad), bad).toBe(false);
  });
  it("not found before its line is reached, found after", () => {
    expect(cardFound(cardOf("m1"), 1, [], at())).toBe(false);
    expect(cardFound(cardOf("m1"), 1, [ev(1, "meeting:task3#0")], at())).toBe(false);
    expect(cardFound(cardOf("m1"), 1, [ev(1, "meeting:task3#1")], at())).toBe(true);
    expect(cardFound(cardOf("m2"), 1, [ev(1, "meeting:task3#1")], at())).toBe(false);
    expect([...foundCardIds(board(), 1, [ev(1, "meeting:task3#1")], "task3")]).toEqual(["m1", "a1", "x1"]);
  });
  it("not from another day, not from another task's meeting, not without its task", () => {
    expect(cardFound(cardOf("m1"), 2, [ev(1, "meeting:task3#1")], at())).toBe(false);
    expect(cardFound(cardOf("m1"), 1, [ev(1, "meeting:task9#1")], at())).toBe(false);
    expect(cardFound(cardOf("m1"), 1, [ev(1, "meeting:task3#1")])).toBe(false);
  });
});

describe("the meeting view (meeting R2)", () => {
  it("on the task page (the shell): the 会议 pane holds the window; its slots are the explorer's 格子 rows", () => {
    const h = harness(day1());
    h.act("wb-nav", { page: "task:task3" });
    const out = h.out();
    expect(out).toContain('<div class="main task shell view-meeting" data-task="task3">');
    expect(out).toMatch(/<section class="sh-card sh-meeting" data-card="meeting">.*<div class="mt-left" data-playing="1">/s);
    expect(out).toContain(`<div class="mt-grid" style="--mt-cols:${gridColumns(3)}">`);
    expect([...out.matchAll(/class="mt-tile/g)]).toHaveLength(3);
    expect(out).toContain('<span class="mt-init" aria-hidden="true">PO</span><span class="mt-name">person one</span>');
    expect(out).toContain('<img class="mt-img" src="/npc/sil_1.png"');
    expect(out).toContain('<span class="mt-init" aria-hidden="true">三</span>');
    // Playing from the first open: line 0 is up; its speaker has the ring.
    expect(out).toContain('<div class="mt-tile speaking" data-person="p1">');
    expect(out).toContain('<span class="mt-t">09:00</span> · <b>person one</b>: line-0');
    expect(out).toContain(`data-action="meeting-pause">⏸ ${escapeHtml(t("meeting.pause"))}</button>`);
    expect(out).toContain(`data-action="meeting-restart">⟲ ${escapeHtml(t("meeting.restart"))}</button>`);
    expect(out).toContain('<span class="mt-n">1 / 4</span>');
    // shell R2/R3: the slot rows moved into the explorer's 格子 folder (slot labels; ● unfilled).
    for (const [slot, label] of [["s1", "slot-1"], ["s2", "slot-2"], ["s3", "slot-3"]]) {
      expect(out).toContain(`data-action="shell-slot" data-slot="${slot}" title="${label}"><span class="sh-fn">${label}</span><span class="sh-dot" aria-hidden="true"></span></button>`);
    }
    expect(out).not.toContain("mt-row");
    // The meeting's cards wait for their lines in 素材; assist and print are the composer's chips.
    expect(out).toContain('<div class="sh-file card notfound" aria-disabled="true" title="hint-m1"><span class="sh-fn">hint-m1</span></div>');
    expect(out).toContain('data-card="a1"');
    expect(out).toContain('data-action="board-assist"');
    expect(out).toContain(`data-action="board-print" disabled>${escapeHtml(t("board.send.boss"))}</button>`);
    expect(out).not.toContain("btable");
  });

  it("renderBoard alone (outside a task page) still draws the meeting with its own slot rows", () => {
    const ctx: AppContext = { state: day1().getState(), events: [], startDay: 1, session: initialSession({ beat: "work", time: "10:00" }), night: false, nowMs: 0 };
    const out = renderBoard(ctx, task()).value;
    expect(out).toContain('<div class="surface board meeting layout-grid" data-playing="0">');
    for (const [slot, label] of [["s1", "row-1"], ["s2", "row-2"], ["s3", "row-3"]]) expect(out).toContain(`<li class="mt-row" data-slot="${slot}"><span class="mt-row-l">${label}</span>`);
  });

  it("seats: circle seats on the ring and one triangle seat outside it", () => {
    const tk = task();
    const seated = { ...tk, board: { ...tk.board!, meeting: { ...tk.board!.meeting!, layout: "seats", seats: { s1: "circle", s2: "circle", s3: "triangle" } } } } as Task;
    const ctx: AppContext = { state: day1().getState(), events: [], startDay: 1, session: initialSession({ beat: "work", time: "10:00" }), night: false, nowMs: 0 };
    const out = renderBoard(ctx, seated).value;
    expect(out).toContain("layout-seats");
    const ring = /<div class="mt-ring">(.*?)<\/div><div class="mt-out">(.*?)<\/div><\/div>/s.exec(out)!;
    expect([...ring[1]!.matchAll(/data-seat="circle"/g)]).toHaveLength(2);
    expect(ring[1]).not.toContain("triangle");
    expect([...ring[2]!.matchAll(/data-seat="triangle"/g)]).toHaveLength(1);
    expect(out).toContain(`aria-label="slot-3 · ${escapeHtml(t("meeting.triangle"))}"`);
    expect(out).toContain('data-action="board-slot" data-slot="s1"');
    // Before it plays: no line, ▶, 0 / 4.
    expect(out).toContain('<div class="mt-sub empty"');
    expect(out).toContain(`data-action="meeting-play">▶ ${escapeHtml(t("meeting.play"))}</button>`);
    expect(out).toContain('<span class="mt-n">0 / 4</span>');
  });

  it("a table board renders as today", () => {
    const tk = task();
    const { view: _v, meeting: _m, ...rest } = tk.board!;
    const table = { ...rest, cards: rest.cards.map(({ from: _f, ...c }) => c) } as TaskBoard;
    const ctx: AppContext = { state: day1().getState(), events: [], startDay: 1, session: initialSession({ beat: "work", time: "10:00" }), night: false, nowMs: 0 };
    const out = renderBoard(ctx, { ...tk, board: table }).value;
    expect(out).toContain('<div class="surface board"><div class="btitle">');
    expect(out).toContain("btable");
    expect(out).not.toContain("mt-");
  });

  it("initials and columns", () => {
    expect([initials("person one"), initials("Vivi"), initials("老周"), initials("")]).toEqual(["PO", "V", "老", ""]);
    expect([1, 2, 3, 4, 5, 9, 10, 16, 20].map(gridColumns)).toEqual([2, 2, 2, 2, 3, 3, 4, 4, 4]);
  });
});

describe("playing (meeting R3)", () => {
  it("the first open today plays by itself; ▶ logs one open per new line, never twice; it stops at the end", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task3" });
    expect(meetingOpens(store)).toEqual([meetingTarget("task3", 0)]);
    expect(h.session.meetingPlay).toMatchObject({ pos: 0, playing: true });
    expect(h.queue.map((q) => q.ms)).toEqual([MEETING_LINE_MS]);
    for (let i = 0; i < 5; i++) h.step();
    expect(meetingOpens(store)).toEqual([0, 1, 2, 3].map((i) => meetingTarget("task3", i)));
    expect(h.session.meetingPlay).toMatchObject({ pos: 3, playing: false });
    expect(h.queue).toEqual([]);
    expect(h.out()).toContain('<span class="mt-n">4 / 4</span>');
    expect(h.out()).toMatch(/data-action="meeting-play" disabled>/);
    // ⟲: from the start; the lines are not logged again.
    h.act("meeting-restart");
    expect(h.session.meetingPlay).toMatchObject({ pos: 0, playing: true });
    for (let i = 0; i < 5; i++) h.step();
    expect(meetingOpens(store)).toHaveLength(4);
    // Opening the task page again does not start it again.
    h.act("wb-nav", { page: "home" });
    h.act("wb-nav", { page: "task:task3" });
    expect(h.session.meetingPlay?.playing).toBe(false);
  });

  it("⏸ pauses on the line shown; a pending tick does nothing; ▶ goes on from there", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task3" });
    h.step(); // line 1
    h.act("meeting-pause");
    h.step(); // the stale tick
    expect(h.session.meetingPlay).toMatchObject({ pos: 1, playing: false });
    expect(meetingOpens(store)).toHaveLength(2);
    h.act("meeting-play");
    expect(meetingOpens(store)).toHaveLength(2); // the next line comes after the interval
    h.step();
    expect(meetingOpens(store)).toHaveLength(3);
  });

  it("a reload resumes at the furthest line reached, paused", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task3" });
    h.step();
    h.step(); // lines 0–2
    expect(meetingFurthest("task3", 1, store.getEvents())).toBe(2);
    // A new session over the same log (the reload).
    const again = harness(store);
    again.act("wb-nav", { page: "task:task3" });
    const out = again.out();
    expect(again.session.meetingPlay).toBeNull();
    expect(out).toContain('<span class="mt-n">3 / 4</span>');
    expect(out).toContain("line-2");
    expect(out).toContain('data-playing="0"');
    again.act("meeting-play");
    again.step();
    expect(meetingOpens(store)).toEqual([0, 1, 2, 3].map((i) => meetingTarget("task3", i)));
  });

  it("fast=1: 0.3 s a line", () => {
    const session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
    expect(meetingLineMs(session)).toBe(MEETING_LINE_MS);
    session.deliveryUnitMs = 1_000;
    expect(meetingLineMs(session)).toBe(MEETING_LINE_MS_FAST);
    expect(MEETING_LINE_MS_FAST).toBe(300);
    const h = harness(day1(), session);
    h.act("wb-nav", { page: "task:task3" });
    expect(h.queue.map((q) => q.ms)).toEqual([300]);
  });
});

describe("a play-through of the meeting board", () => {
  it("watch, place, print, send: the meeting's cards come in as it plays; judged as before", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task3" });
    expect(h.out()).not.toContain('data-card="m1"');
    h.step(); // line 1 names m1
    expect(h.out()).toContain('data-card="m1"');
    expect(h.out()).not.toContain('data-card="m2"');
    for (let i = 0; i < 3; i++) h.step();
    expect(h.out()).toContain('data-card="m2"');
    for (const [slot, card] of [["s1", "m1"], ["s2", "m2"], ["s3", "a1"]]) {
      h.act("board-card", { card: card! });
      h.act("board-slot", { slot: slot! });
    }
    expect(h.out()).toContain(`data-action="board-print">${escapeHtml(t("board.send.boss"))}</button>`);
    h.act("board-print");
    const events = store.getEvents();
    expect(events.some((e) => e.kind === "task" && e.flag === DONE)).toBe(true);
    expect(events.some((e) => e.kind === "give" && e.deliverableId === "d1-tech")).toBe(true);
    expect(boardJudgement(1, events)).toEqual({ verdict: "perfect", san: 0 });
  });
});
