// shell (2026-11-04): every task page is one light shell after the Claude desktop app — the
// conversation with Kuro is the outer frame; the explorer and the app panes are inset cards that open
// and close around it. The fixture .kiro/specs/shell/board-shell.json (an IDE board with `ide.files`,
// an object lock, beats; placeholder text) is day-1 task3; table and meeting variants are drawn from
// it. Content is not edited.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import fixture from "../.kiro/specs/shell/board-shell.json";
import tasks01 from "@content/tasks/day-01.json";
import { parseTaskFile, type Task, type TaskBoard } from "@state/days/tasks";

function shellDay01(mut: (t: any) => void = () => {}) {
  const raw = structuredClone(tasks01) as any;
  raw.tasks = raw.tasks.map((t: any) =>
    t.id === "task3" ? { id: t.id, title: t.title, app: t.app, done: t.done, board: structuredClone(fixture.board), deliverable: structuredClone(fixture.deliverable), judge: structuredClone(fixture.judge) } : t,
  );
  mut(raw.tasks.find((t: any) => t.id === "task3"));
  return raw;
}
const parseWith = (mut: (t: any) => void) => () => parseTaskFile(shellDay01(mut), "day-01.json");

describe("the loader: ide.files (R4) and beats on every view (R5)", () => {
  it("loads each page's file", () => {
    const b = parseWith(() => {})().tasks.find((t) => t.id === "task3")!.board!;
    expect(b.ide!.files!.s1).toEqual({ name: "base.js", code: ["// line-1", "const base = {{slot}};", "export default base;"] });
    expect(Object.keys(b.ide!.files!)).toEqual(["s1", "s2", "s3"]);
  });
  it("rejects a missing file, a file for an unknown slot, zero or several {{slot}} lines, an empty name, unknown keys", () => {
    expect(parseWith((t) => delete t.board.ide.files.s3)).toThrow(/slot "s3" has no file/);
    expect(parseWith((t) => (t.board.ide.files.zz = { name: "z.js", code: ["{{slot}}"] }))).toThrow(/"zz" is not a slot/);
    expect(parseWith((t) => (t.board.ide.files.s2.code = ["const data = 1;"]))).toThrow(/exactly one line with \{\{slot\}\} \(has 0\)/);
    expect(parseWith((t) => (t.board.ide.files.s2.code = ["{{slot}}", "{{slot}}"]))).toThrow(/\(has 2\)/);
    expect(parseWith((t) => (t.board.ide.files.s2.name = ""))).toThrow(/non-empty string/);
    expect(parseWith((t) => (t.board.ide.files.s2.extra = 1))).toThrow(/unknown key "extra"/);
  });
  it("an IDE board without files still loads (its 代码 pane is absent)", () => {
    expect(parseWith((t) => delete t.board.ide.files)).not.toThrow();
  });
  it("beats are allowed on a table board, with the IDE beats' rules", () => {
    const table = (t: any) => {
      delete t.board.view;
      delete t.board.ide;
    };
    expect(parseWith(table)().tasks.find((x) => x.id === "task3")!.board!.beats).toHaveLength(3);
    expect(parseWith((t) => (table(t), (t.board.beats[1].on = "fill:zz")))).toThrow(/"zz" is not a slot/);
  });
});

vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  const fx = (await import("../.kiro/specs/shell/board-shell.json")).default as any;
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

import { createStore, type Store } from "@state/store";
import { boardJudgement, boardState } from "@state/days/board";
import { ideOps, ideSrc } from "@state/days/ide";
import { taskByFlag, taskFiles } from "@state/days/tasks";
import type { ActionContext } from "@world/desktop/controller";
import { fileById } from "@world/desktop/files/view";
import { initialSession, type AppContext, type Session } from "@world/desktop/model";
import { renderShell } from "@world/desktop/workbench/shell";
import { renderWorkbench } from "@world/desktop/workbench/view";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const DONE = (tasks01 as any).tasks.find((x: any) => x.id === "task3").done as string;
const task = () => taskByFlag(1, DONE)!;
const doneFlag = (id: string) => taskFiles.get(1)!.find((x) => x.id === id)!.done;
const SRC = "/docs/player/day-01-space.html";

/** Day 1 with task3 (the shell fixture) under way; the chick found (the lock's object). */
function day1(): Store {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  store.appendEvent({ kind: "openLayer", objectId: "chick" });
  for (const id of ["task1", "task2"]) store.appendEvent({ kind: "task", flag: doneFlag(id), mode: "self" });
  return store;
}
function harness(store: Store) {
  const session: Session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  const app = (): AppContext => ({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session, night: false, nowMs: 0 });
  // 工作台 as the monitor draws it (R10): its one top bar, then the page.
  const out = () => {
    const r = renderWorkbench(app());
    return `<div class="app-top">${r.bar.value}</div>${r.body.value}`;
  };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  return { session, ctx, app, out, act };
}
/** On the task page of task3. */
function onPage(store = day1()) {
  const h = harness(store);
  h.act("wb-nav", { page: "task:task3" });
  return h;
}
const cardOf = (out: string, id: string) => new RegExp(`<section class="sh-card sh-${id}[^"]*" data-card="${id}">`).exec(out)?.[0] ?? null;
const lastStep = (store: Store) => store.getEvents().filter((e) => e.kind === "boardStep").at(-1);
const fill = (s: string) => s;
const variant = (board: Partial<TaskBoard>): Task => ({ ...task(), board: { ...task().board!, ...board } as TaskBoard });

describe("R1 · the frame: the conversation and its inset cards", () => {
  it("the conversation is always there; the explorer and the panes are inset cards", () => {
    const out = onPage().out();
    expect(out).toContain('<div class="main task shell view-ide" data-task="task3">');
    expect(out).toContain('<div class="sh-conv"><div class="sh-thread">');
    expect(cardOf(out, "explorer")).toBe('<section class="sh-card sh-explorer sh-explorer-card" data-card="explorer">');
    expect(cardOf(out, "preview")).toBe('<section class="sh-card sh-preview first" data-card="preview">');
    expect(cardOf(out, "code")).toBe('<section class="sh-card sh-code second" data-card="code">');
    for (const c of ["explorer", "preview", "code"]) expect(out).toMatch(new RegExp(`data-card="${c}"><header class="sh-card-h">.*?data-action="shell-max" data-pane="${c}"`, "s"));
  });

  it("⊟ hides and shows the explorer", () => {
    const h = onPage();
    expect(h.out()).toContain(`class="sh-tg explorer on" data-action="shell-explorer" aria-pressed="true" aria-label="${escapeHtml(t("pane.explorer.toggle"))}"`);
    h.act("shell-explorer");
    expect(cardOf(h.out(), "explorer")).toBeNull();
    expect(h.out()).toContain('class="sh-tg explorer" data-action="shell-explorer" aria-pressed="false"');
    h.act("shell-explorer");
    expect(cardOf(h.out(), "explorer")).not.toBeNull();
  });

  it("closing every pane leaves the conversation alone", () => {
    const h = onPage();
    h.act("shell-close", { pane: "preview" });
    h.act("shell-close", { pane: "code" });
    h.act("shell-explorer");
    const out = h.out();
    expect(out).not.toContain("sh-panes");
    expect(out).not.toContain('<section class="sh-card');
    expect(out).toContain('<div class="wb-task-body sh-frame"><div class="sh-conv">');
  });

  it("⤢ maximizes a card over the conversation, and ⤢ again restores it", () => {
    const h = onPage();
    h.act("shell-max", { pane: "preview" });
    expect(cardOf(h.out(), "preview")).toBe('<section class="sh-card sh-preview max first" data-card="preview">');
    expect(h.out()).toContain('class="wb-task-body sh-frame has-panes maxed"');
    h.act("shell-max", { pane: "preview" });
    expect(cardOf(h.out(), "preview")).toBe('<section class="sh-card sh-preview first" data-card="preview">');
    expect(h.out()).not.toContain("maxed");
    // Closing a maximized card restores the frame too.
    h.act("shell-max", { pane: "code" });
    h.act("shell-close", { pane: "code" });
    expect(h.out()).not.toContain("maxed");
  });

  it("the R1 parameters are in the stylesheet", () => {
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain(".wb .sh-card{background:#FFFFFF;border:1px solid #E7E5E0;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,.04)");
    expect(css).toMatch(/\.wb-task-body\.sh-frame\{[^}]*padding:8px;gap:8px;background:#FAF9F7/);
    // R10: one 44 px top bar for 工作台 (the R1 48 px task header is gone).
    expect(css).toMatch(/\.win\.wb\.full > \.bar\.app-top\{height:44px/);
    expect(css).toContain(".wb .sh-card-h{height:40px");
    expect(css).toContain(".wb .sh-tg{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#6B6B6B");
    expect(css).toContain(".wb .sh-tg.on{background:#E3ECFA;color:#2F6FEB}");
    expect(css).toContain(".wb .sh-card.sh-explorer-card{flex:0 0 248px;width:248px}");
    expect(css).toContain(".wb .sh-panes{flex:0 0 46%;min-width:480px;max-width:900px");
    expect(css).toContain(".wb .sh-panes > .sh-card.first{flex:0 0 calc(56% - 4px)}");
    expect(css).toMatch(/\.wb \.sh-conv\{[^}]*min-width:380px/);
    expect(css).toMatch(/\.wb \.sh-thread\{[^}]*max-width:720px/);
    expect(css).toContain(".wb .sh-bub{background:#F0EEEA;border-radius:18px;padding:10px 14px");
    expect(css).toContain("border:1px solid #E5E5E5;border-radius:16px;background:#FFFFFF");
    expect(css).toContain('font:12.5px/1.7 "SF Mono",Menlo,monospace');
    expect(css).toContain(".wb .sh-frow{height:28px");
    expect(css).toContain(".wb .sh-file{height:26px");
  });
});

describe("R3 · the toggles and the panes", () => {
  const toggles = (out: string) => [...out.matchAll(/data-action="shell-pane" data-pane="([a-z]+)"/g)].map((m) => m[1]);
  it("only this view's panes: IDE 文件 · 预览 · 代码 (預览 above 代码 by default; 文件 closed)", () => {
    const out = onPage().out();
    expect(toggles(out)).toEqual(["files", "preview", "code"]);
    expect(out).toContain(`class="sh-tg on" data-action="shell-pane" data-pane="preview" aria-pressed="true" aria-label="${escapeHtml(t("pane.preview"))}" title="${escapeHtml(t("pane.preview"))}"`);
    expect(out).toContain('class="sh-tg" data-action="shell-pane" data-pane="files" aria-pressed="false"');
  });

  it("table: 文件 · 表格 (the table open); meeting: 文件 · 会议 (the meeting open)", () => {
    const h = onPage();
    const table = variant({ view: undefined, ide: undefined, beats: undefined });
    const shown = (tk: Task) => {
      const r = renderShell(h.app(), tk, 1, fill);
      return r.tools.value + r.main.value;
    };
    const tout = shown(table);
    expect(toggles(tout)).toEqual(["files", "table"]);
    expect(tout).toMatch(/data-card="table">.*<table class="btable">/s);
    const meeting = variant({ view: "meeting", ide: undefined, meeting: { people: [{ id: "p1", name: "person one" }], lines: [{ t: "09:00", who: "p1", text: "line-0" }], layout: "grid" } });
    const mout = shown(meeting);
    expect(toggles(mout)).toEqual(["files", "meeting"]);
    expect(mout).toMatch(/data-card="meeting">.*<div class="mt-left" data-playing="0"><div class="mt-grid"/s);
  });

  it("two panes stack; opening a third closes the one opened earliest", () => {
    const h = onPage();
    h.act("shell-pane", { pane: "files" });
    const out = h.out();
    expect(cardOf(out, "preview")).toBeNull();
    expect(cardOf(out, "code")).toBe('<section class="sh-card sh-code first" data-card="code">');
    expect(cardOf(out, "files")).toBe('<section class="sh-card sh-files second" data-card="files">');
    h.act("shell-pane", { pane: "files" });
    expect(cardOf(h.out(), "code")).toBe('<section class="sh-card sh-code" data-card="code">');
    // A pane this view does not have is never opened.
    h.act("shell-pane", { pane: "table" });
    expect(cardOf(h.out(), "table")).toBeNull();
  });

  it("a task without a board: its own surface is one pane, open (handed in here: read back)", () => {
    const h = harness(day1());
    const t1 = taskFiles.get(1)!.find((x) => x.id === "task1")!;
    const out = renderShell(h.app(), t1, 1, fill).main.value;
    expect(cardOf(out, "work")).not.toBeNull();
    expect(cardOf(out, "explorer")).toBeNull();
    // R11: the thread read back is the conversation; the pane holds the surface; no chips (handed in).
    expect(out).toMatch(/<div class="sh-conv"><div class="sh-thread"><div class="sh-me" data-on="work">/);
    expect(out).toMatch(/data-card="work">.*<div class="sh-work"><div class="surface /s);
    expect(out).not.toContain("wthread");
    expect(out).toContain('<div class="sh-composer"></div>');
  });
});

describe("R2 · the explorer", () => {
  it("页面: one row per slot (its file name), ● on the unfilled; 素材: found cards, the unfound greyed; the lock notice on top", () => {
    const store = day1();
    const h = onPage(store);
    const out = h.out();
    expect(out).toMatch(new RegExp(`<span class="sh-tw"><svg[^>]*>.*?</svg></span>${escapeHtml(t("board.ide.pages"))}`));
    expect(out).toContain('<button type="button" class="sh-file on" data-action="shell-slot" data-slot="s1"><span class="sh-fn">base.js</span><span class="sh-dot" aria-hidden="true"></span></button>');
    expect(out).toContain('data-slot="s2"><span class="sh-fn">data.js</span><span class="sh-dot"');
    expect(out).toContain(`${escapeHtml(t("board.ide.sources"))}</div>`);
    expect(out).toContain('<button type="button" class="sh-pick" data-action="board-card" data-card="a1">card-a1</button>');
    expect(out).toContain('<div class="sh-file card notfound" aria-disabled="true"><span class="sh-fn">hint-a2</span></div>');
    expect(out).toMatch(/<div class="sh-lock"><div class="block-row"><button type="button" class="block" data-action="board-lock">/);
    expect(out).toContain(escapeHtml(t("board.lock.useObject", { object: t("obj.name.chick") })));
    h.act("board-card", { card: "a1" });
    expect(h.out()).toContain('<div class="sh-file card picked"><button type="button" class="sh-pick" data-action="board-card" data-card="a1">');
    // A slot row in the explorer places the picked card (the board's own fill op) and selects it.
    h.act("shell-slot", { slot: "s2" });
    expect(lastStep(store)).toMatchObject({ op: { t: "fill", slot: "s2", card: "a1" } });
    const after = h.out();
    expect(after).toContain('<button type="button" class="sh-file on" data-action="shell-slot" data-slot="s2"><span class="sh-fn">data.js</span></button>');
    expect(after).not.toContain('data-card="a1"');
  });

  it("a picked card placed by clicking the slot's field in the 代码 pane (the same op)", () => {
    const store = day1();
    const h = onPage(store);
    h.act("board-card", { card: "x1" });
    expect(h.out()).toContain('<button type="button" class="sh-field empty target" data-action="board-slot" data-slot="s1"');
    h.act("board-slot", { slot: "s1" });
    expect(lastStep(store)).toMatchObject({ op: { t: "fill", slot: "s1", card: "x1" } });
  });

  it("a slot row with nothing picked only selects it: 代码 opens its file, 预览 moves to its page", () => {
    const store = day1();
    const h = onPage(store);
    h.act("shell-close", { pane: "code" });
    const before = store.getEvents().length;
    h.act("shell-slot", { slot: "s3" });
    expect(store.getEvents()).toHaveLength(before);
    const out = h.out();
    expect(cardOf(out, "code")).not.toBeNull();
    expect(out).toContain('<span class="sh-tab on">use.js</span>');
    expect(out).toContain(`src="${escapeHtml(`${SRC}?theme=light&pane=preview&c=9&fill=`)}"`);
  });

  it("↗ on a found card opens 文件 on its source: a file's text, or the conversation's lines", () => {
    const store = day1();
    const h = onPage(store);
    expect(h.out()).not.toContain('data-action="shell-source" data-card="a1"');
    store.appendEvent({ kind: "open", target: "file:c-v16", t: "10:00" });
    expect(h.out()).toContain('data-action="shell-source" data-card="a3"');
    h.act("shell-source", { card: "a3" });
    const out = h.out();
    expect(cardOf(out, "files")).not.toBeNull();
    expect(out).toContain(`<div class="sh-src-h">${escapeHtml(fileById("c-v16")!.name)}</div><div class="f-body doc">`);
    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:01" });
    const opens = () => store.getEvents().filter((e) => e.kind === "open" && e.target === "conv:partner").length;
    const before = opens();
    const focus = h.session.focus;
    h.act("shell-source", { card: "a2" });
    expect(h.out()).toContain('<div class="sh-source conv">');
    // tingtalk R2: the thread also opens in 听听, on the monitor that is not 工作台's; the player stays.
    expect(h.session).toMatchObject({ rightApp: "tingtalk", conversation: "partner", focus });
    expect(h.session.place.tingtalk).toBe("right");
    expect(opens()).toBe(before + 1);
  });
});

describe("the IDE panes and the conversation", () => {
  it("预览: the tab, the address line, the iframe at ideSrc (light, pane=preview, the selected slot's page)", () => {
    const store = day1();
    const h = onPage(store);
    const out = h.out();
    expect(out).toContain('<div class="sh-browser"><div class="sh-tabs"><span class="sh-tab on">fixture-deliverable</span></div><div class="sh-addr">…/day-01-space.html#2</div>');
    const src = ideSrc(task().board!, boardState(task().board!, 1, "task3", store.getEvents()), ideOps(task(), 1, store.getEvents()));
    expect(src).toBe(`${SRC}?theme=light&pane=preview&c=2&fill=`);
    expect(out).toContain(`<iframe class="ide-frame" data-keep="ide" src="${escapeHtml(src)}"`);
  });

  it("代码: the selected file with line numbers and the slot field; filled, the card as a string with a green +", () => {
    const store = day1();
    const h = onPage(store);
    const before = h.out();
    expect(before).toContain('<span class="sh-tab on">base.js</span>');
    expect(before).toContain('<div class="sh-ln"><span class="sh-gut">1</span><span class="sh-mk"></span><code>// line-1</code></div>');
    expect(before).toContain('<div class="sh-ln slot"><span class="sh-gut">2</span><span class="sh-mk"></span><code>const base = <button type="button" class="sh-field empty" data-action="board-slot" data-slot="s1" aria-label="slot-1"></button>;</code></div>');
    expect(before).toContain('<div class="sh-ln"><span class="sh-gut">3</span>');
    h.act("board-card", { card: "a1" });
    h.act("board-slot", { slot: "s1" });
    expect(h.out()).toContain('<div class="sh-ln slot added"><span class="sh-gut">2</span><span class="sh-mk">+</span><code>const base = <button type="button" class="sh-field filled" data-action="board-slot" data-slot="s1">"card-a1"</button>;</code></div>');
  });

  it("the conversation: the beats (Kuro's portrait on the first line of a run, mine a bubble); the composer's chips", () => {
    const out = onPage().out();
    expect(out).toMatch(/<div class="sh-kuro first" data-on="open"><img class="sh-av"[^>]*><div class="sh-kt">open-1<\/div><\/div><div class="sh-kuro" data-on="open"><span class="sh-av-gap"><\/span><div class="sh-kt">open-2<\/div><\/div><div class="sh-me" data-on="open"><div class="sh-bub">open-3<\/div><\/div>/);
    expect(out).toContain(`<div class="sh-composer"><button type="button" class="sh-chip" data-action="board-assist">${escapeHtml(t("board.assist"))}</button><button type="button" class="sh-chip primary" data-action="board-print" disabled>${escapeHtml(t("board.ide.snapshot"))}</button></div>`);
    expect(out).not.toContain("<textarea");
  });

  it("a board without beats: one Kuro line, the board title", () => {
    const h = onPage();
    const out = renderShell(h.app(), variant({ view: undefined, ide: undefined, beats: undefined }), 1, fill).main.value;
    expect(out).toMatch(/<div class="sh-thread"><div class="sh-kuro first" data-on="open"><img class="sh-av"[^>]*><div class="sh-kt">fixture-shell<\/div><\/div><\/div>/);
  });

  it("a play-through in the shell: pick and place from the explorer, unlock, print and send; judged as before", () => {
    const store = day1();
    const h = onPage(store);
    store.appendEvent({ kind: "open", target: "conv:partner", t: "10:00" });
    store.appendEvent({ kind: "open", target: "file:c-v16", t: "10:01" });
    for (const [slot, card] of [["s1", "a1"], ["s2", "a2"], ["s3", "a3"]]) {
      h.act("board-card", { card: card! });
      h.act("shell-slot", { slot: slot! });
    }
    h.act("board-code", { code: "0000" });
    expect(h.out()).toContain(`class="sh-chip primary" data-action="board-print">${escapeHtml(t("board.ide.snapshot"))}</button>`);
    h.act("board-print");
    const events = store.getEvents();
    expect(events.some((e) => e.kind === "task" && e.flag === DONE)).toBe(true);
    expect(events.some((e) => e.kind === "give" && e.deliverableId === "d1-tech")).toBe(true);
    expect(boardJudgement(1, events)).toEqual({ verdict: "perfect", san: 0 });
    // Handed in: the page is read back (no actions), the conversation still there.
    // (Rendered a second on: the new line types in after 300 ms.)
    const after = renderWorkbench({ ...h.app(), nowMs: 1_000 }).body.value;
    expect(after).toContain('<div class="surface board read">');
    expect(after).toContain("print-1");
    expect(after).not.toContain('data-action="board-');
  });
});

describe("light, and home unchanged", () => {
  it("no dark class anywhere in the shell (IDE, table, meeting)", () => {
    const h = onPage();
    const outs = [
      h.out(),
      renderShell(h.app(), variant({ view: undefined, ide: undefined }), 1, fill).main.value,
      renderShell(h.app(), variant({ view: "meeting", ide: undefined, meeting: { people: [{ id: "p1", name: "p" }], lines: [{ t: "09:00", who: "p1", text: "x" }], layout: "grid" } }), 1, fill).main.value,
    ];
    for (const out of outs) {
      expect(out).not.toMatch(/class="[^"]*\b(dark|codefile)\b/);
      expect(out).not.toContain("ide-mid");
    }
  });

  it("home is unchanged (greeting, composer, cards) and the session list lists the task as before", () => {
    const h = onPage();
    h.act("wb-nav", { page: "home" });
    const out = h.out();
    expect(out).toContain('class="main home"');
    expect(out).toContain('<div class="ask wb-composer">');
    expect(out).not.toContain("sh-frame");
    expect(out).not.toContain("wb-sidebar sessions");
    h.act("wb-sidebar");
    expect(h.out()).toContain('class="it" data-action="wb-nav" data-page="task:task3"');
  });
});

// ——— R8–R10: one 44 px top bar, the overlay sidebar, line icons ———

import { desktopApps } from "@world/desktop/apps";
import { buildShell } from "@world/desktop/model";
import { renderDesktop } from "@world/desktop/shell";
import { loopKeys } from "@world/room/game";

/** The whole desktop with 工作台 in front on the shown monitor. */
function desk(h: ReturnType<typeof harness>, store: Store): string {
  h.session.rightApp = "workbench";
  return renderDesktop(buildShell(store.getState(), store.getEvents(), h.session, desktopApps, 0, 1)).value;
}
const winOf = (out: string) => {
  const at = out.indexOf('data-win="workbench"');
  expect(at).toBeGreaterThan(-1);
  return out.slice(out.lastIndexOf("<div", at));
};

describe("R10 · one top bar", () => {
  it("工作台's window is full-screen with exactly one bar: traffic lights, sidebar toggle, ← →, title ▾, pane toggles, 老物件", () => {
    const store = day1();
    const h = onPage(store);
    const win = winOf(desk(h, store));
    expect(win).toMatch(/^<div class="win wb full" data-win="workbench"[^>]*>/);
    expect(win.slice(0, win.indexOf(">"))).not.toContain("style=");
    const bars = [...win.matchAll(/<div class="bar[ "]/g)];
    expect(bars).toHaveLength(1);
    expect(win).toMatch(/^<div class="win wb full"[^>]*><div class="bar app-top" data-drag-win/);
    const bar = /<div class="bar app-top"[^>]*>(.*?)<\/div><div class="body wb-app">/s.exec(win)![1]!;
    for (const part of ["tl-g", 'data-action="wb-sidebar"', 'data-action="wb-back"', 'data-action="wb-forward"', 'class="wb-title drop"', 'data-action="shell-explorer"', 'data-action="shell-pane"', "objbar"]) {
      expect(bar, part).toContain(part);
    }
    // The title's ▾ is the down icon (SVG), and the page has no second header.
    expect(bar).toMatch(/class="wb-title drop"[^>]*>.*?<svg class="ic"/s);
    expect(win).not.toContain("sh-head");
    expect(win).not.toContain(escapeHtml(t("wb.autosave")));
  });

  it("on home the title is 工作台 (no ▾) and the strip of pane toggles is absent", () => {
    const h = onPage();
    h.act("wb-nav", { page: "home" });
    const out = h.out();
    expect(out).toContain(`<span class="wb-title"><span class="tt-name">${escapeHtml(t("wb.title"))}</span></span>`);
    expect(out).not.toContain("wb-title drop");
    expect(out).not.toContain('data-action="shell-explorer"');
  });

  it("← and → walk the pages visited this session", () => {
    const h = onPage();
    h.act("wb-nav", { page: "home" });
    expect(h.session.workbenchPage).toBe("home");
    expect(h.out()).toMatch(/data-action="wb-forward" disabled/);
    h.act("wb-back");
    expect(h.session.workbenchPage).toBe("task:task3");
    expect(h.out()).not.toMatch(/data-action="wb-forward" disabled/);
    h.act("wb-forward");
    expect(h.session.workbenchPage).toBe("home");
    // A new page after a step back drops the forward pages.
    h.act("wb-back");
    h.act("wb-back");
    expect(h.session.workbenchPage).toBe("home");
    expect(h.out()).toMatch(/data-action="wb-back" disabled/);
    h.act("wb-nav", { page: "task:task3" });
    expect(h.session.wbHistory.pages.map((p) => p.page)).toEqual(["home", "task:task3"]);
  });

  it("the title's ▾ opens the session dropdown; a click outside closes it", () => {
    const h = onPage();
    expect(h.out()).not.toContain("wb-titlemenu sessions");
    h.act("wb-titlemenu");
    expect(h.out()).toContain('<div class="wb-titlemenu sessions" role="menu">');
    expect(h.out()).toContain('data-action="wb-titlemenu-close"');
    h.act("wb-titlemenu-close");
    expect(h.out()).not.toContain("wb-titlemenu sessions");
  });
});

describe("R10 · the overlay sidebar", () => {
  it("is hidden by default; open, it is an overlay aside with the sections, search, 新任务 and the sessions", () => {
    const h = onPage();
    expect(h.out()).not.toContain("wb-sidebar sessions");
    h.act("wb-sidebar");
    const out = h.out();
    expect(out).toContain('<div class="wb-scrim" data-action="wb-sidebar-close" aria-hidden="true"></div><aside class="wb-sidebar sessions"><nav class="wb-sections">');
    for (const key of ["wb.nav.home", "wb.nav.docs", "wb.nav.approvals", "wb.nav.contacts"]) expect(out, key).toContain(`aria-label="${escapeHtml(t(key))}"`);
    expect(out).toContain('data-input="wb-search"');
    expect(out).toContain(`data-compose="1"><svg class="ic"`);
    expect(out).toContain('class="it on" data-action="wb-nav" data-page="task:task3"');
    // The explorer stays where it was under the overlay.
    expect(cardOf(out, "explorer")).not.toBeNull();
  });

  it("⌘B / Ctrl+B toggles it while 工作台 is shown; Esc and the scrim close it; a page change closes it", () => {
    const store = day1();
    const h = onPage(store);
    h.session.rightApp = "workbench";
    expect(loopKeys(h.ctx, { key: "b", metaKey: true } as KeyboardEvent)).toBe(true);
    expect(h.session.wbSidebar).toBe(true);
    expect(loopKeys(h.ctx, { key: "B", ctrlKey: true } as KeyboardEvent)).toBe(true);
    expect(h.session.wbSidebar).toBe(false);
    h.act("wb-sidebar");
    loopKeys(h.ctx, { key: "Escape" } as KeyboardEvent);
    expect(h.session.wbSidebar).toBe(false);
    expect(h.session.view).toBe("desktop");
    h.act("wb-sidebar");
    h.act("wb-sidebar-close");
    expect(h.session.wbSidebar).toBe(false);
    h.act("wb-sidebar");
    h.act("wb-nav", { page: "home" });
    expect(h.session.wbSidebar).toBe(false);
    // Not on 工作台: ⌘B is not taken.
    h.session.rightApp = "msgs";
    expect(loopKeys(h.ctx, { key: "b", metaKey: true } as KeyboardEvent)).toBe(false);
    expect(h.session.wbSidebar).toBe(false);
  });

  it("the search filters the session titles", () => {
    const h = onPage();
    h.act("wb-sidebar");
    h.session.wbSearch = "\u0001no-such-title";
    expect(h.out()).not.toContain('data-page="task:task3"><');
    h.session.wbSearch = task().title.slice(0, 2);
    expect(h.out()).toContain('class="it on" data-action="wb-nav" data-page="task:task3"');
  });
});

describe("R8 · the explorer is never auto-hidden; R9 · line icons", () => {
  it("with both panes open the explorer and its 素材 rows are drawn; no container query hides it", () => {
    const out = onPage().out();
    expect(cardOf(out, "explorer")).not.toBeNull();
    expect(cardOf(out, "preview")).not.toBeNull();
    expect(cardOf(out, "code")).not.toBeNull();
    expect(out).toContain(`<div class="sh-frow"><span class="sh-tw">`);
    expect(out).toContain(escapeHtml(t("board.ide.sources")));
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).not.toContain("@container");
    expect(css).toContain(".wb .sh-panes{flex-shrink:1}");
  });

  it("the bar and the cards draw SVG line icons, not the old glyphs", () => {
    const out = onPage().out();
    for (const glyph of ["▤", "◍", "●", "⤢", "⊟", "▸", "▾"]) expect(out, glyph).not.toContain(glyph);
    expect([...out.matchAll(/<svg class="ic" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"/g)].length).toBeGreaterThan(8);
  });
});

// ——— R11: a task without a board; the dock over full-screen 工作台 ———

import { atDockEdge, dockPeeker, DOCK_EDGE_PX, DOCK_HIDE_MS } from "@world/desktop/dockpeek";
import { renderWork } from "@world/desktop/workbench/work";
import { shellActions } from "@world/desktop/controller";

describe("R11.1 · a task without a board: the thread is the conversation, the surface the pane", () => {
  /** Day 1 with task1 (a 文档 task, no board) under way. */
  const onTask1 = () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
    const h = harness(store);
    h.act("wb-nav", { page: "task:task1" });
    return h;
  };
  const conv = (out: string) => /<div class="sh-conv">(.*?)<\/div><div class="sh-composer">/s.exec(out)?.[1] ?? "";
  const composer = (out: string) => /<div class="sh-composer">(.*?)<\/div><\/div><div class="sh-panes">/s.exec(out)?.[1] ?? "";
  const pane = (out: string) => /<section class="sh-card sh-work"[^>]*>(.*)<\/section>/s.exec(out)?.[1] ?? "";
  const t1 = () => taskFiles.get(1)!.find((x) => x.id === "task1")!;

  it("before the sentence is sent: the composer holds the input and ↑; the surface pane is open", () => {
    const out = onTask1().out();
    expect(out).toContain('<div class="sh-conv"><div class="sh-thread"></div><div class="sh-composer">');
    expect(composer(out)).toMatch(/^<div class="ask sh-ask"><input class="ph" data-input="wb-draft"[^>]*value="[^"]+".*data-action="wb-send">/s);
    expect(pane(out)).toMatch(/<div class="sh-work"><div class="surface (doc|ledger|mark)/);
  });

  it("sent: the player's line and Kuro's question are bubbles in the column; the mode chips are in the composer", () => {
    const h = onTask1();
    h.act("wb-send");
    const out = h.out();
    const c = conv(out);
    expect(c).toMatch(/^<div class="sh-thread"><div class="sh-me" data-on="work"><div class="sh-bub">[^<]+<\/div><\/div><div class="sh-kuro first" data-on="question"><img class="sh-av"/);
    expect(c).not.toContain("wb-choose");
    expect(c).not.toContain('class="wm');
    expect([...composer(out).matchAll(/class="sh-chip" data-action="wb-choose" data-mode="(self|let|look)"/g)].map((m) => m[1]).sort()).toEqual(["let", "look", "self"]);
    expect(pane(out)).not.toContain("wb-choose");
    expect(pane(out)).not.toContain("sh-me");
  });

  it("a mode chosen: its chip is the player's bubble; Kuro working shows its dots in the column; the surface and 通过 follow", () => {
    const h = onTask1();
    h.act("wb-send");
    h.act("wb-choose", { mode: "self" });
    const out = h.out();
    expect(conv(out)).toContain(`<div class="sh-me" data-on="work"><div class="sh-bub">${escapeHtml(t("wb.mode.self"))}</div></div>`);
    expect(composer(out)).not.toContain("wb-choose");
    expect(composer(out)).toContain('data-action="wb-pass"');
    expect(pane(out)).toMatch(/<div class="sh-work"><div class="surface /);
    // 让它做: Kuro works (its dots in the column); the pane waits.
    const k = onTask1();
    k.act("wb-send");
    k.act("wb-choose", { mode: "let" });
    k.session.work!.busyUntil = Number.MAX_SAFE_INTEGER;
    const busy = renderShell(k.app(), t1(), 1, fill).main.value;
    expect(conv(busy)).toContain('<div class="sh-kuro typing" aria-live="polite">');
    // The surface waits empty while Kuro works (as it did in the ask box).
    expect(pane(busy)).toMatch(/<div class="sh-work">(<div class="surface (doc|ledger)"><\/div>)?<\/div>/);
  });

  it("the ask box elsewhere is drawn exactly as before (the same items, joined)", () => {
    const h = onTask1();
    h.act("wb-send");
    const out = renderWork(h.app()).value;
    expect(out).toMatch(/^<div class="ask"><div class="wthread"><div class="wm me">/);
    expect(out).toContain('<div class="wchips"><button type="button" class="chip" data-action="wb-choose"');
  });
});

describe("R11.2 · the dock over full-screen 工作台", () => {
  const desktop = (patch: Partial<Session>) => {
    const store = day1();
    const h = harness(store);
    Object.assign(h.session, { focus: "left" }, patch);
    return renderDesktop(buildShell(store.getState(), store.getEvents(), h.session, desktopApps, 0, 1)).value;
  };
  const dockClass = (out: string) => /<div class="(dock[^"]*)">/.exec(out)?.[1];

  it("hidden while 工作台 is in front on the left monitor; up while peeking; other apps keep it", () => {
    expect(dockClass(desktop({ leftApp: "workbench" }))).toBe("dock auto");
    expect(dockClass(desktop({ leftApp: "workbench", dockPeek: true }))).toBe("dock auto peek");
    expect(dockClass(desktop({ leftApp: "msgs", place: { msgs: "left", tingtalk: "right", workbench: "left", browser: "left" } }))).toBe("dock");
    expect(dockClass(desktop({ leftApp: "browser", dockPeek: true }))).toBe("dock");
    const css = readFileSync(resolve(__dirname, "../src/world/desktop/desktop.css"), "utf8");
    expect(css).toContain(".dock.auto{transform:translate(-50%,calc(100% + 24px))");
    expect(css).toContain(".dock.auto.peek{transform:translateX(-50%)}");
  });

  it("the bottom 6 px of the monitor bring it up; it hides 600 ms after the pointer leaves", () => {
    const rect = { left: 0, right: 1600, bottom: 900 };
    expect(DOCK_EDGE_PX).toBe(6);
    expect(atDockEdge(800, 900 - DOCK_EDGE_PX, rect)).toBe(true);
    expect(atDockEdge(800, 899, rect)).toBe(true);
    expect(atDockEdge(800, 900 - DOCK_EDGE_PX - 1, rect)).toBe(false);
    expect(atDockEdge(1700, 899, rect)).toBe(false);
    let on = false;
    const timers: { ms: number; fn: () => void; gone: boolean }[] = [];
    const p = dockPeeker({ shown: () => on, set: (v) => void (on = v), later: (ms, fn) => timers.push({ ms, fn, gone: false }), cancel: (h) => void (timers[(h as number) - 1]!.gone = true) });
    p.move(false);
    expect([on, timers.length]).toEqual([false, 0]);
    p.move(true);
    expect(on).toBe(true);
    p.move(false);
    expect(timers.map((x) => x.ms)).toEqual([DOCK_HIDE_MS]);
    expect(DOCK_HIDE_MS).toBe(600);
    p.move(false); // no second timer
    expect(timers).toHaveLength(1);
    // Back at the edge (or on the dock) before it ran: the hide is dropped.
    p.move(true);
    expect(timers[0]!.gone).toBe(true);
    p.move(false);
    timers.at(-1)!.fn();
    expect(on).toBe(false);
  });

  it("the dock-peek action sets the session flag", () => {
    const h = harness(day1());
    shellActions["dock-peek"]!(h.ctx, { on: "1" } as DOMStringMap, null as never);
    expect(h.session.dockPeek).toBe(true);
    shellActions["dock-peek"]!(h.ctx, { on: "0" } as DOMStringMap, null as never);
    expect(h.session.dockPeek).toBe(false);
  });
});
