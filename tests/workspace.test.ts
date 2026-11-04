// workspace (2026-11-04): 工作台 as a chat app — the rail, a session list, one main area that is home
// (greeting, composer, cards; never a board) or a task page (header + its board in its view). The
// object strip lives in the task header only. Day 1 task3 is the ide fixture board with an object
// lock (.kiro/specs/ide/board-ide.json, placeholder text), injected; content is not edited.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/ide/board-ide.json")).default as any;
  const d1 = (await import("@content/tasks/day-01.json")).default as any;
  const raw = structuredClone(d1);
  const board = structuredClone(fx.board);
  board.given.lock = { object: "chick", codes: ["0000", "1111"], answer: "0000" };
  raw.tasks = raw.tasks.map((t: any) => (t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board, deliverable: structuredClone(fx.deliverable), judge: structuredClone(fx.judge) } : t));
  const parsed = real.parseTaskFile(raw, "day-01.json");
  const t3 = parsed.tasks.find((t: any) => t.id === "task3")!;
  const files = new Map(real.taskFiles);
  files.set(1, parsed.tasks);
  return { ...real, taskFiles: files, taskByFlag: (day: number, flag: string) => (day === 1 && flag === t3.done ? t3 : real.taskByFlag(day, flag)) };
});

import { createStore, type Store } from "@state/store";
import { taskFiles } from "@state/days/tasks";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext } from "@world/desktop/model";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { sessionList } from "@world/desktop/workbench/sessions";
import { workbenchActions } from "@world/desktop/workbench/actions";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const tasks = () => taskFiles.get(1)!;
const doneFlag = (id: string) => tasks().find((x) => x.id === id)!.done;
const title = (id: string) => escapeHtml(tasks().find((x) => x.id === id)!.title);

/** Day 1, booted, messages seen; `done` tasks handed in; `found` objects opened. */
function day1(done: string[] = [], found: string[] = []): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  for (const id of found) store.appendEvent({ kind: "openLayer", objectId: id });
  for (const id of done) store.appendEvent({ kind: "task", flag: doneFlag(id), mode: "self" });
  return store;
}
function harness(store: Store) {
  const session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  // 工作台 as the monitor draws it (shell R10): its one top bar, then the page under it.
  const out = () => {
    const r = renderWorkbench({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: 0 } as AppContext);
    return `<div class="app-top">${r.bar.value}</div>${r.body.value}`;
  };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  /** The sidebar's markup, opened for the look (shell R10: it is collapsed by default). */
  const side = () => {
    const was = session.wbSidebar;
    session.wbSidebar = true;
    const s = /<aside class="wb-sidebar sessions">(.*?)<\/aside>/s.exec(out())?.[1] ?? "";
    session.wbSidebar = was;
    return s;
  };
  return { session, ctx, out, act, side };
}
/** The one top bar's contents (shell R10). */
const headOf = (html: string) => /<div class="app-top">(.*?)<\/div><div class="body wb-app">/s.exec(html)?.[1] ?? "";
const taskOpens = (store: Store) => store.getEvents().filter((e) => e.kind === "open" && e.target.startsWith("task:"));

describe("R1 · two kinds of page", () => {
  it("home: the greeting, the composer (a multi-line box, the continue chips' row, ↑) and the cards; no board, no task content", () => {
    const h = harness(day1());
    const out = h.out();
    expect(out).toContain('class="main home"');
    expect(out).toContain('<div class="ask wb-composer"><textarea class="wb-compose-in"');
    expect(out).toContain(escapeHtml(t("wb.composer.placeholder")));
    expect(out).toContain('data-action="wb-compose-send"');
    expect(out).toContain('<div class="cards">');
    for (const not of ["surface", "board", "wb-task-h", 'data-action="wb-send"', 'data-action="board-']) expect(out, not).not.toContain(not);
    // The task under way is a link in 在办 to its task page.
    expect(out).toContain(`<button type="button" class="ln task" data-action="wb-nav" data-page="task:task1"><b>${title("task1")}</b>`);
  });

  it("home never draws the board, even when the board task is the one under way", () => {
    const out = harness(day1(["task1", "task2"])).out();
    expect(out).not.toContain("surface board");
    expect(out).toContain('data-page="task:task3"');
  });

  it("a task page: the header (title, for whom, 在办 / 已交) and its board in its view; no composer", () => {
    const store = day1(["task1", "task2"]);
    const h = harness(store);
    h.act("wb-nav", { page: "task:task3" });
    expect(h.session.workbenchPage).toBe("task:task3");
    const out = h.out();
    const head = headOf(out);
    expect(head).toContain(`<span class="tt-name">${title("task3")}</span>`);
    expect(head).toContain(escapeHtml(t("wb.task.for", { who: t("msgs.boss") })));
    expect(head).toContain(`<span class="st doing">${escapeHtml(t("wb.task.doing"))}</span>`);
    // shell 2026-11-04: the IDE board's panes (预览 + 代码 by default; no files in this fixture: 预览).
    expect(out).toContain('<section class="sh-card sh-preview" data-card="preview">');
    for (const not of ["wb-composer", "<textarea", 'class="cards"', "main home"]) expect(out, not).not.toContain(not);
    // Handed in: 已交, and the board read back without its actions.
    store.appendEvent({ kind: "task", flag: doneFlag("task3"), mode: "let", slots: { s1: "a1", s2: "a2", s3: "k1" }, assists: 1 });
    const after = h.out();
    expect(headOf(after)).toContain(`<span class="st done">${escapeHtml(t("wb.task.done"))}</span>`);
    expect(after).toContain('<div class="surface board read">');
    expect(after).toContain("card-k1");
    expect(after).not.toContain('data-action="board-');
  });

  it("a task without a board shows its own work surface; its app page is a button in the header", () => {
    const h = harness(day1());
    h.act("wb-nav", { page: "task:task1" });
    const out = h.out();
    // shell R3 / R11: its own surface is one pane, open by default; the input is in the composer.
    expect(out).toMatch(/<section class="sh-card sh-work" data-card="work">.*<div class="sh-card-b"><div class="sh-work"><div class="surface /s);
    expect(out).toMatch(/<div class="sh-composer"><div class="ask sh-ask">.*data-action="wb-send"/s);
    expect(headOf(out)).toContain(`data-action="wb-nav" data-page="docs">${escapeHtml(t("wb.nav.docs"))}</button>`);
  });

  it("opening: only the task under way, one handed in, or one opened before; an unknown or locked task is ignored", () => {
    const h = harness(day1());
    for (const page of ["task:nope", "task:task3", "task:"]) {
      h.act("wb-nav", { page });
      expect(h.session.workbenchPage, page).toBe("home");
    }
    expect(taskOpens(h.ctx.store)).toEqual([]);
  });
});

describe("R2 · one navigation: the rail and the session list", () => {
  it("nothing opened today: only 新任务; no expanded nav column", () => {
    const h = harness(day1());
    const out = h.out();
    const side = h.side();
    expect(side).toMatch(new RegExp(`data-action="wb-nav" data-page="home" data-compose="1"><svg[^>]*>.*?</svg><span>${escapeHtml(t("wb.sessions.new"))}</span></button>`, "s"));
    expect(side).not.toContain(escapeHtml(t("wb.sessions.today")));
    expect(side).not.toContain(escapeHtml(t("wb.sessions.recent")));
    expect(side).not.toContain("task:");
    for (const key of ["wb.search", "wb.nav.tickets", "wb.nav.projects", "wb.sec.doing"]) expect(out, key).not.toContain(escapeHtml(t(key)));
    // The section icons (shell R10) are in the sidebar.
    expect(side).toContain('<nav class="wb-sections">');
  });

  it("opening task A then B lists B, A under 今天 (once each, from today's open events), the current one highlighted", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task1" });
    h.act("wb-nav", { page: "home" });
    h.act("wb-nav", { page: "task:task1" });
    store.appendEvent({ kind: "task", flag: doneFlag("task1"), mode: "self" });
    h.act("wb-nav", { page: "task:task2" });
    expect(taskOpens(store).map((e) => e.kind === "open" && e.target)).toEqual(["task:task1", "task:task2"]);
    expect(sessionList(store.getState(), store.getEvents()).today.map((e) => e.taskId)).toEqual(["task2", "task1"]);
    const side = h.side();
    expect(side.indexOf(escapeHtml(t("wb.sessions.today")))).toBeGreaterThan(-1);
    expect(side.indexOf('data-page="task:task2"')).toBeLessThan(side.indexOf('data-page="task:task1"'));
    expect(side).toContain('<button type="button" class="it on" data-action="wb-nav" data-page="task:task2"><i class="dot doing"');
    expect(side).toContain('<button type="button" class="it" data-action="wb-nav" data-page="task:task1"><i class="dot done"');
    // 新任务 goes home with the caret in the composer.
    h.act("wb-nav", { page: "home", compose: "1" });
    expect(h.session.workbenchPage).toBe("home");
    expect(h.session.focusNext).toBe("wb-compose");
    expect(h.out()).toContain('data-focus="wb-compose"');
  });

  it("earlier days' tasks are under 最近 and open read-only; today's list starts empty", () => {
    const store = day1();
    const h = harness(store);
    h.act("wb-nav", { page: "task:task1" });
    store.appendEvent({ kind: "task", flag: doneFlag("task1"), mode: "self" });
    store.appendEvent({ kind: "lieDown" });
    expect(store.getState().day).toBe(2);
    expect(taskOpens(store).map((e) => e.day)).toEqual([1]);
    expect(sessionList(store.getState(), store.getEvents()).recent.map((e) => [e.day, e.taskId])).toEqual([[1, "task1"]]);
    // (Day 2 has Vivi's lock on the screen, which refuses the game's wb-nav; the workbench's own
    // action is what the session list's buttons run underneath.)
    const nav = (data: Record<string, string>) => workbenchActions["wb-nav"]!(h.ctx, data as DOMStringMap, null as never);
    nav({ page: "home" });
    const side = h.side();
    expect(side).not.toContain(escapeHtml(t("wb.sessions.today")));
    expect(side).toContain(escapeHtml(t("wb.sessions.recent")));
    expect(side).toContain('class="it earlier" data-action="wb-nav" data-page="task:task1" data-day="1"');
    nav({ page: "task:task1", day: "1" });
    expect([h.session.workbenchPage, h.session.wbTaskDay]).toEqual(["task:task1", 1]);
    const out = h.out();
    expect(h.side()).toContain('class="it on earlier"');
    // shell R11: the thread read back is the conversation; nothing to send.
    expect(out).toMatch(/<div class="sh-thread"><div class="sh-me" data-on="work">/);
    expect(out).not.toContain('data-action="wb-send"');
    // Read-only: opening it logs nothing, and an earlier task never opened that day cannot be opened.
    expect(taskOpens(store)).toHaveLength(1);
    nav({ page: "task:task2", day: "1" });
    expect(h.session.workbenchPage).toBe("task:task1");
  });
});

describe("R3 · old objects only while working", () => {
  it("the object strip is in the task header only; never on home", () => {
    const h = harness(day1(["task1", "task2"], ["chick"]));
    expect(h.out()).not.toContain("wb-objbar");
    h.act("wb-nav", { page: "task:task3" });
    const head = headOf(h.out());
    expect(head).toContain('<div class="wb-objbar">');
    expect(head).toContain('data-action="objbar-open" data-object="chick"');
    // 使用 over the desktop, as before.
    h.act("objbar-open", { object: "chick" });
    expect([h.session.holding, h.session.hand.using, h.session.objbarOpen]).toEqual(["chick", true, true]);
  });

  it("the board lock's 用{object}看一眼 still opens its object", () => {
    const h = harness(day1(["task1", "task2"], ["chick"]));
    h.act("wb-nav", { page: "task:task3" });
    expect(h.out()).toContain(escapeHtml(t("board.lock.useObject", { object: t("obj.name.chick") })));
    h.act("board-lock");
    expect([h.session.holding, h.session.objbarOpen, h.session.boardLockOpen]).toEqual(["chick", true, true]);
  });
});

describe("R4 · the IDE on a task page (now the shell: tests/shell.test.ts)", () => {
  const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
  it("the explorer · the conversation · the 预览 card, full height under the header", () => {
    const h = harness(day1(["task1", "task2"]));
    h.act("wb-nav", { page: "task:task3" });
    const out = h.out();
    expect(out).toContain('<div class="main task shell view-ide" data-task="task3">');
    for (const c of ['data-card="explorer"', 'class="sh-conv"', 'data-card="preview"']) expect(out).toContain(c);
    expect(css).toMatch(/\.wb \.main\.task\.shell\{display:flex;flex-direction:column/);
    expect(css).toMatch(/\.wb \.sh-panes\{flex:0 0 46%;min-width:480px;max-width:900px/);
  });
});

describe("the composer talks to Kuro as its body does", () => {
  it("↑ with a typed line opens the conversation and keeps the line for the player's box", () => {
    const h = harness(day1());
    h.session.kuroDraft = "hello";
    h.act("wb-compose-send");
    expect(h.session.dialogue.queue.length).toBeGreaterThan(0);
    expect(h.session.kuroInput).toBe(true);
    expect(h.session.kuroDraft).toBe("hello");
  });
  it("↑ with nothing typed does nothing", () => {
    const h = harness(day1());
    h.act("wb-compose-send");
    expect(h.session.dialogue.queue).toEqual([]);
  });
});
