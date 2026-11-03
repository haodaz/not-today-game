// work spec (2026-11-02) and its correction "the choice is a reply, not a toolbar": the task
// sentence is sent, Kuro asks 「这个怎么做？」 with the three options as chips under its message,
// the chip is the reply; day 1's document and ledger surfaces (FR1–FR3). The same task events and
// flags as before; catch flags only when both clauses were read; Kuro's touch exactly as content.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import day01 from "@content/tasks/day-01.json";
import { applyEvent } from "@state/events";
import { parseTaskFile, taskFiles, type Task } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext } from "@world/desktop/model";
import { renderWork } from "@world/desktop/workbench/work";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { escapeHtml } from "@world/html";
import { hasString, t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const tasks = taskFiles.get(1)!;
const task1 = tasks.find((x) => x.id === "task1")!;
const task2 = tasks.find((x) => x.id === "task2")!;
const task3 = tasks.find((x) => x.id === "task3")!;

describe("the loader accepts the document and the ledger, strictly", () => {
  it("day 1: task1 has its doc, task2 its ledger, task3 neither", () => {
    expect(task1.doc).toMatchObject({ conflict: [5, 10], catchFlags: ["caught_6_11"], kuroEdit: { clause: 10 } });
    expect(task1.doc!.left).toHaveLength(task1.doc!.right.length);
    expect(task2.ledger).toMatchObject({ target: [0, 3], value: 31, kuroTidy: { col: 1 } });
    expect(task3.doc ?? task3.ledger).toBeUndefined();
  });

  const bad = (edit: (t: Record<string, any>[]) => void) => {
    const raw = structuredClone(day01) as { tasks: Record<string, any>[] };
    edit(raw.tasks);
    return () => parseTaskFile(raw, "day-01.json");
  };
  it.each([
    ["a conflict clause out of range", (ts: Record<string, any>[]) => (ts[0]!.doc.conflict = [5, 40]), /index/],
    ["the same clause twice", (ts: Record<string, any>[]) => (ts[0]!.doc.conflict = [5, 5]), /different/],
    ["a catch flag the self path does not set", (ts: Record<string, any>[]) => (ts[0]!.doc.catchFlags = ["nope"]), /not set by the self path/],
    ["columns of different lengths", (ts: Record<string, any>[]) => ts[0]!.doc.right.pop(), /clauses/],
    ["an unknown doc key", (ts: Record<string, any>[]) => (ts[0]!.doc.extra = 1), /unknown key "extra"/],
    ["kuroEdit out of range", (ts: Record<string, any>[]) => (ts[0]!.doc.kuroEdit.clause = 99), /index/],
    ["a ledger row with a cell missing", (ts: Record<string, any>[]) => ts[1]!.ledger.rows[0].pop(), /cells/],
    ["a ledger target out of range", (ts: Record<string, any>[]) => (ts[1]!.ledger.target = [20, 0]), /index/],
    ["a ledger on a docs task", (ts: Record<string, any>[]) => (ts[0]!.ledger = structuredClone(ts[1]!.ledger)), /belongs to app "ledger"/],
  ])("rejects %s", (_n, edit, msg) => {
    expect(bad(edit)).toThrow(msg);
  });
  it("a task without a surface object parses exactly as before", () => {
    const raw = structuredClone(day01) as { tasks: Record<string, unknown>[] };
    delete raw.tasks[0]!.doc;
    delete raw.tasks[1]!.ledger;
    const parsed = parseTaskFile(raw, "day-01.json");
    expect(parsed.tasks[0]!.doc).toBeUndefined();
    expect(parsed.tasks[0]!.self).toEqual(task1.self);
  });
});

/** Day 1 with `task` open: boot, messages seen, and the tasks before it done (self). */
function dayWith(taskId: "task1" | "task2" | "task3"): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  for (const id of ["task1", "task2"] as const) {
    if (id === taskId) break;
    store.appendEvent({ kind: "task", flag: tasks.find((x) => x.id === id)!.done, mode: "self" });
  }
  return store;
}
function ctxFor(store: Store) {
  let now = 0;
  const session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: now });
  return { ctx, app, wait: (ms: number) => (now += ms) };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const work = (app: AppContext) => renderWork(app).value;
const lastTask = (store: Store) => store.getEvents().filter((e) => e.kind === "task").at(-1);

describe("the choice is a reply", () => {
  it("no wb-mode buttons under the input; the strip has only the scope and ↑", () => {
    const { app } = ctxFor(dayWith("task1"));
    const out = renderWorkbench(app()).body.value;
    expect(out).not.toContain("wb-mode");
    const strip = /<div class="strip">(.*?)<\/div><\/div>/.exec(work(app()))![1]!;
    expect(strip.match(/<button/g)).toHaveLength(2);
    expect(strip).toContain('data-action="wb-scope"');
    expect(strip).toContain('data-action="wb-send"');
  });

  it("the sentence is in the input; sent, it is the player's message; the chips exist only under Kuro's question", () => {
    const { ctx, app } = ctxFor(dayWith("task1"));
    const item = "v17 过一遍。";
    expect(work(app())).toContain(`value="${escapeHtml(item)}"`);
    expect(work(app())).not.toContain('data-action="wb-choose"');
    act(ctx, "wb-send");
    const out = work(app());
    expect(out).toContain(`<div class="wm me"><div class="bub">${escapeHtml(item)}</div></div>`);
    // Three chips, inside Kuro's message (the last .wm.them before the input), and nowhere else.
    const kuroMsg = out.slice(out.lastIndexOf('<div class="wm them">'), out.indexOf("<input"));
    expect(kuroMsg.match(/data-action="wb-choose"/g)).toHaveLength(3);
    expect(out.match(/data-action="wb-choose"/g)).toHaveLength(3);
    for (const key of ["wb.mode.self", "wb.mode.look", "wb.mode.let"]) expect(kuroMsg).toContain(escapeHtml(t(key)));
    act(ctx, "wb-choose", { mode: "self" });
    const after = work(app());
    expect(after).not.toContain('data-action="wb-choose"');
    expect(after).toContain(`<div class="wm me"><div class="bub">${escapeHtml(t("wb.mode.self"))}</div></div>`);
  });

  it.each(["self", "look", "let"] as const)("a task without a surface completes on the chip: the same event as before (%s)", (mode) => {
    const store = dayWith("task3");
    const { ctx } = ctxFor(store);
    const before = store.getState();
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode });
    expect(lastTask(store)).toEqual({ kind: "task", day: 1, flag: task3.done, mode });
    expect(store.getState().flags).toEqual(applyEvent(before, { kind: "task", day: 1, flag: task3.done, mode }).flags);
  });
});

/** Plays one surface task to 通过 and returns the task event. */
function play(task: Task, mode: "self" | "look" | "let", steps: (ctx: ActionContext) => void = () => {}) {
  const store = dayWith(task.id as "task1" | "task2");
  const { ctx, wait, app } = ctxFor(store);
  act(ctx, "wb-send");
  act(ctx, "wb-choose", { mode });
  // While Kuro works, 通过 waits.
  if (mode !== "self") {
    act(ctx, "wb-pass");
    expect(lastTask(store)?.flag).not.toBe(task.done);
    wait(3000);
  }
  steps(ctx);
  const markup = work(app());
  act(ctx, "wb-pass");
  return { store, event: lastTask(store)!, markup };
}

describe("the surfaces: the same flags and events as before", () => {
  it("document self, both clauses read: 合并 / 不合 is chosen before 通过; the self event (with merge); the catch flag is set", () => {
    const { store, event } = play(task1, "self", (ctx) => {
      act(ctx, "wb-clause", { i: "5" });
      act(ctx, "wb-clause", { i: "10" });
      act(ctx, "wb-merge", { merge: "1" });
    });
    expect(event).toEqual({ kind: "task", day: 1, flag: task1.done, mode: "self", merge: true });
    expect(store.getState().flags).toContain("caught_6_11");
  });
  it("with the strings in content, 通过 does nothing after both clauses until a chip is chosen (the missing-string case is work-merge.test.ts's mocked table)", () => {
    expect(hasString("wb.merge") && hasString("wb.keep")).toBe(true);
    const store = dayWith("task1");
    const { ctx, app } = ctxFor(store);
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "self" });
    for (const i of task1.doc!.conflict) act(ctx, "wb-clause", { i: String(i) });
    const out = work(app());
    for (const key of ["wb.merge", "wb.keep"]) expect(out).toContain(`>${escapeHtml(t(key))}</button>`);
    expect(out).not.toContain('data-action="wb-pass"');
    act(ctx, "wb-pass");
    expect(lastTask(store)?.flag).not.toBe(task1.done);
    act(ctx, "wb-merge", { merge: "0" });
    act(ctx, "wb-pass");
    expect(lastTask(store)).toEqual({ kind: "task", day: 1, flag: task1.done, mode: "self", merge: false });
  });
  it("property: self without both conflict clicks never sets a catch flag", () => {
    fc.assert(
      fc.property(fc.subarray([...Array(task1.doc!.left.length).keys()]), (clicks) => {
        const both = task1.doc!.conflict.every((i) => clicks.includes(i));
        const { store, event } = play(task1, "self", (ctx) => {
          clicks.forEach((i) => act(ctx, "wb-clause", { i: String(i) }));
          // Both read: a chip must be chosen before 通过.
          if (both) act(ctx, "wb-merge", { merge: "0" });
        });
        expect(store.getState().flags.includes("caught_6_11")).toBe(both);
        expect(event.kind === "task" && event.mode).toBe("self");
        expect(store.getState().flags).toContain(task1.done);
      }),
      { numRuns: 40 },
    );
  });

  it("document let: Kuro's touch is exactly the content's text; not opened = let, opened = look", () => {
    const edit = task1.doc!.kuroEdit!;
    const notOpened = play(task1, "let");
    expect(notOpened.markup).toContain(escapeHtml(edit.text));
    expect(notOpened.markup).not.toContain('class="wdiff"');
    expect(notOpened.event).toMatchObject({ mode: "let" });
    expect(notOpened.store.getState().letItDoUnchecked).toBe(1);
    const opened = play(task1, "let", (ctx) => act(ctx, "wb-clause", { i: String(edit.clause) }));
    expect(opened.markup).toContain(`<ins>${escapeHtml(edit.text)}</ins>`);
    expect(opened.markup).toContain(`<del>${escapeHtml(task1.doc!.right[edit.clause]!)}</del>`);
    expect(opened.event).toMatchObject({ mode: "look" });
  });

  it("document 看一眼: the diff opens with the result; the look event", () => {
    const { markup, event } = play(task1, "look");
    expect(markup).toContain('class="wdiff"');
    expect(event).toMatchObject({ mode: "look" });
  });

  it("ledger self: click the cell, type, Enter; the self event", () => {
    const { event } = play(task2, "self", (ctx) => {
      act(ctx, "wb-cell");
      ctx.session.work!.cellDraft = "31";
      act(ctx, "wb-cell-enter");
      expect(ctx.session.work!.cell).toBe("31");
    });
    expect(event).toEqual({ kind: "task", day: 1, flag: task2.done, mode: "self" });
  });

  it("ledger let: Kuro sets the cell; the tidied column's header shows its touch exactly as content; opened = look", () => {
    const tidy = task2.ledger!.kuroTidy!;
    const notOpened = play(task2, "let");
    expect(notOpened.markup).toContain(`<td class="target">${task2.ledger!.value}</td>`);
    expect(notOpened.markup).not.toContain(escapeHtml(tidy.how));
    expect(notOpened.event).toMatchObject({ mode: "let" });
    const opened = play(task2, "let", (ctx) => act(ctx, "wb-col", { col: String(tidy.col) }));
    expect(opened.markup).toContain(`<div class="wdiff">${escapeHtml(tidy.how)}</div>`);
    expect(opened.event).toMatchObject({ mode: "look" });
    expect(opened.store.getState().flags).toContain("kept_format");
  });

  it("the surface writes no world event until 通过", () => {
    const store = dayWith("task1");
    const { ctx, wait } = ctxFor(store);
    const n = store.getEvents().length;
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "let" });
    wait(3000);
    act(ctx, "wb-clause", { i: "10" });
    expect(store.getEvents()).toHaveLength(n);
  });
});

describe("snapshots (day 1)", () => {
  it("the thread before and after the choice", () => {
    const { ctx, app } = ctxFor(dayWith("task1"));
    act(ctx, "wb-send");
    const before = work(app());
    act(ctx, "wb-choose", { mode: "self" });
    const after = work(app());
    expect({ before, after }).toMatchSnapshot();
  });

  it("the four surface states: document self, document let, ledger self, ledger let", () => {
    const docSelf = play(task1, "self", (ctx) => {
      act(ctx, "wb-clause", { i: "5" });
      act(ctx, "wb-clause", { i: "10" });
      act(ctx, "wb-merge", { merge: "0" });
    }).markup;
    const docLet = play(task1, "let", (ctx) => act(ctx, "wb-clause", { i: "10" })).markup;
    const ledgerSelf = play(task2, "self", (ctx) => act(ctx, "wb-cell")).markup;
    const ledgerLet = play(task2, "let", (ctx) => act(ctx, "wb-col", { col: "1" })).markup;
    expect({ docSelf, docLet, ledgerSelf, ledgerLet }).toMatchSnapshot();
  });
});
