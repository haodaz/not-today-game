// work-mode (author 2026-11-16): over full-screen 工作台 the dock is two buttons (开始工作 / 退出工作模式);
// 开始工作 is the one way into the day's game; once started it runs to its end; the workspace shows the
// work read-only; nothing from outside reaches in while work mode is on.
import "./specimen";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dayFile } from "@state/days/table";
import { taskByFlag, type Task } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { buildShell, initialSession, type Session } from "@world/desktop/model";
import { desktopApps } from "@world/desktop/apps";
import { renderDesktop } from "@world/desktop/shell";
import { workLayer } from "@world/desktop/workbench/compare";
import { renderShell } from "@world/desktop/workbench/shell";
import { gameRunning, inWorkMode, workBar, workBlocks, workHolds, workNow } from "@world/desktop/workbench/work-mode";
import { hereOf, settleSession } from "@world/dialogue/place";
import { escapeHtml } from "@world/html";
import { setLocale, t } from "@world/i18n";
import { push, settle } from "@world/loop/dialogue";
import { loopActions, loopKeys, renderGame } from "@world/room/game";
import { fillPlaceholders } from "@world/replies/placeholders";
import { completeUntil } from "./complete-items";

setLocale("zh");

/** The checklist item whose done flag is this task's. */
const itemOf = (day: number, task: Task): string => dayFile(day)!.items.find((it) => it.done.kind === "flag" && it.done.flag === task.done)!.id;
/** Today's board task (days 4–17 have exactly one). */
const boardTask = (day: number): Task => {
  const file = dayFile(day)!;
  for (const it of file.items) {
    if (it.done.kind !== "flag") continue;
    const tk = taskByFlag(day, it.done.flag);
    if (tk?.board) return tk;
  }
  throw new Error(`day ${day} has no board task`);
};
/** A run on `day` with every item before `item` done. */
function storeAt(day: number, item: string): Store {
  const store = createStore({ startDay: day, patch: { fullness: 100 } as never }); // fed: the work bar is not held by hunger here
  completeUntil(store, item);
  return store;
}
/**
 * A run on `day` with its board task the work under way. Days 7 and 9 put it on the night list (it
 * follows the boss's call), so the day is done up to 桌子 first, the task left (as pacman.test does).
 */
function boardDay(day: number): { store: Store; task: Task } {
  const task = boardTask(day);
  const item = itemOf(day, task);
  const store = storeAt(day, item);
  if (workNow(store.getState(), store.getEvents(), { launched: new Set(), workShow: null })?.task.id !== task.id) completeUntil(store, "desk", { skip: [item] });
  return { store, task };
}
function rig(store: Store, patch: Partial<Session> = {}) {
  const session = initialSession({ beat: "work", time: "14:00" }, "left", "desktop");
  Object.assign(session, { leftApp: "workbench", focus: "left", onboard: "done" }, patch);
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 1000 };
  const act = (name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
  const desktop = () => renderDesktop(buildShell(store.getState(), store.getEvents(), session, desktopApps, 1000, store.getStartDay())).value;
  const stage = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: 1000, startDay: store.getStartDay() })?.value ?? null;
  const game = () => renderGame(store, session, 1000).value;
  return { session, ctx, act, desktop, stage, game };
}
const barOf = (out: string) => /<div class="work-bar">.*?<\/div>/s.exec(out)?.[0] ?? null;

describe("§1 the work bar", () => {
  it("work mode is full-screen 工作台 in front on the screen; there the dock is two buttons; elsewhere the plain dock", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store, { wbFull: true });
    expect(inWorkMode(r.session)).toBe(true);
    expect(barOf(r.desktop())).toBe(`<div class="work-bar"><button type="button" class="wk-start" data-action="work-start">${escapeHtml(t("work.start"))}</button><button type="button" class="wk-exit" data-action="work-exit">${escapeHtml(t("work.exit"))}</button></div>`);
    expect(r.desktop()).not.toMatch(/<div class="dock/);
    const plain = rig(store);
    expect(inWorkMode(plain.session)).toBe(false);
    expect(barOf(plain.desktop())).toBeNull();
    expect(plain.desktop()).toContain('<div class="dock">');
  });

  it("the label follows the day: 开始工作 before the start, 继续工作 once started, 今天的活干完了 (disabled) when all is handed in", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const session = rig(store).session;
    expect(workBar(store.getState(), store.getEvents(), session)).toEqual({ label: "work.start", enabled: true, exit: true });
    store.appendEvent({ kind: "boardStep", taskId: tk.id, op: { t: "fill", slot: tk.board!.slots[0]!.id, card: tk.board!.slots[0]!.answer } });
    // a reload: the session knows nothing, the log does
    expect(workBar(store.getState(), store.getEvents(), rig(store).session)).toEqual({ label: "work.resume", enabled: true, exit: false });
    const done = createStore({ startDay: 4, patch: { fullness: 100 } as never });
    completeUntil(done, dayFile(4)!.items.at(-1)!.id, { all: true });
    expect(workBar(done.getState(), done.getEvents(), rig(done).session)).toMatchObject({ label: "work.allDone", enabled: false });
    const r = rig(done, { wbFull: true });
    expect(barOf(r.desktop())).toContain(`data-action="work-start" disabled>${escapeHtml(t("work.allDone"))}</button>`);
  });

  it("退出工作模式 closes the full chrome and brings the dock back; the box's held lines play then", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store, { wbFull: true });
    r.session.dialogue = push(r.session.dialogue, { key: "d4:lunch:onUnlock", lines: [{ k: "narration", t: "afternoon" }], ending: { kind: "none" } });
    settleSession(r.session);
    expect(r.session.dialogue.queue).toHaveLength(0);
    expect(r.session.dialogue.waiting?.length).toBe(1);
    r.act("work-exit");
    expect(r.session.wbFull).toBe(false);
    expect(r.session.dialogue.queue.map((q) => q.key)).toEqual(["d4:lunch:onUnlock"]);
    expect(r.desktop()).toContain('<div class="dock">');
  });
});

describe("§2 开始工作 targets today's current task", () => {
  it("a board task not launched → its launch page; launched → its stage; a task without a board → its page", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store, { wbFull: true });
    r.act("work-start");
    expect(r.session.launchShow).toBe(`4:${tk.id}`);
    expect(r.session.workbenchPage).toBe(`task:${tk.id}`);
    expect(r.session.workShow).toBeNull();
    r.act("task-launch", { task: tk.id });
    expect(r.stage()).toContain('class="work-stage');
    // the stage hidden (a reload): 继续工作 shows it again, no launch page
    const again = rig(store, { wbFull: true });
    again.session.launched.add(`4:${tk.id}`);
    again.act("work-start");
    expect(again.session.launchShow).toBeNull();
    expect(again.session.workShow).toBe(`4:${tk.id}`);
    // Stale-data audit 2026-11-25 (author 11-13: 看一眼 / 让它做 are gone): no day has a work task
    // without a board or a game any more; 开始工作 always opens a game.
    // (the content files themselves: the test setup adds practice specimens to the parsed days)
    for (let day = 1; day <= 18; day++) {
      const file = JSON.parse(readFileSync(new URL(`../content/days/day-${String(day).padStart(2, "0")}.json`, import.meta.url), "utf8")) as { items: { id: string; done: string; self?: boolean }[] };
      for (const it of file.items) {
        if (!it.done.startsWith("flag:task_") || it.self) continue;
        const task = taskByFlag(day, it.done.slice(5));
        expect(task, `day ${day} ${it.id}`).toBeDefined();
        expect(!!(task!.board || task!.game), `day ${day} ${it.id} has a board or a game`).toBe(true);
      }
    }
  });

  it("a row click opens the page to look at and never launches (no 要开始工作吗)", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store);
    r.act("wb-nav", { page: `task:${tk.id}` });
    expect(r.session.workbenchPage).toBe(`task:${tk.id}`);
    expect(r.session.launchShow).toBeNull();
    expect(r.session.dialogue.queue.map((q) => q.ending.kind)).not.toContain("workAsk");
  });

  it("every day 4–17's board task opens a stage from 开始工作 (days 7 and 9's meeting boards too)", () => {
    for (let day = 4; day <= 17; day++) {
      const { store, task: tk } = boardDay(day);
      expect(workNow(store.getState(), store.getEvents(), rig(store).session)?.task.id, `day ${day}`).toBe(tk.id);
      const r = rig(store, { wbFull: true });
      r.act("work-start");
      if (r.session.launchShow) r.act("task-launch", { task: tk.id });
      const stage = r.stage();
      expect(stage, `day ${day}`).not.toBeNull();
      expect(stage!, `day ${day}`).toMatch(/<section class="work-stage[^"]*" data-screen="[a-z]+"/);
      expect(stage!, `day ${day}`).not.toContain("wl-back");
    }
  });
});

describe("§3 once started, the game runs to its end", () => {
  it("no way back on the stage, no 退出工作模式, no 离开屏幕; Esc does nothing; the ways out wait", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store, { wbFull: true });
    r.act("work-start");
    r.act("task-launch", { task: tk.id });
    expect(gameRunning(store.getState(), store.getEvents(), r.session)).toBe(true);
    const out = r.game();
    expect(out).toContain('class="work-stage');
    expect(out).not.toContain("wl-back");
    expect(out).not.toContain('data-action="work-hide"');
    expect(out).not.toContain('data-action="work-exit"');
    expect(out).not.toContain("leave-screen");
    expect(out).not.toMatch(/<div class="dock/);
    expect(loopKeys(r.ctx, { key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(r.session.view).toBe("desktop");
    expect(r.session.workShow).toBe(`4:${tk.id}`);
    r.act("work-exit");
    expect(r.session.wbFull).toBe(true);
    for (const [action, data] of [["dock", { app: "msgs" }], ["screen", { screen: "right" }], ["win-full", { app: "workbench" }], ["view", { view: "desk" }], ["nav-back", {}], ["mc-toggle", {}], ["work-exit", {}]] as const) {
      expect(workBlocks(r.ctx, action, data), action).toBe(true);
    }
    expect(workBlocks(r.ctx, "view", { view: "desktop" })).toBe(false);
    expect(workBlocks(r.ctx, "board-slot", { slot: "s1" })).toBe(false);
    expect(workBlocks(r.ctx, "settings-open", {})).toBe(false);
    // handed in: the stage closes by itself, the bar offers 退出工作模式 again, and it works
    const slots = Object.fromEntries(tk.board!.slots.map((x) => [x.id, x.answer]));
    store.appendEvent({ kind: "task", flag: tk.done, mode: "self", slots, assists: 0 });
    expect(gameRunning(store.getState(), store.getEvents(), r.session)).toBe(false);
    expect(r.stage()).toBeNull();
    expect(barOf(r.desktop())).toContain('data-action="work-exit"');
    expect(r.game()).toContain("leave-screen");
    r.act("work-exit");
    expect(r.session.wbFull).toBe(false);
  });

  it("a reload while a game runs: back on the screen it is work mode, 工作台 in front, the bar's 继续工作 and nothing else", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    store.appendEvent({ kind: "boardStep", taskId: tk.id, op: { t: "fill", slot: tk.board!.slots[0]!.id, card: tk.board!.slots[0]!.answer } });
    const r = rig(store, { view: "desk", leftApp: "tingtalk", wbFull: false });
    r.act("view", { view: "desktop" });
    expect(r.session.wbFull).toBe(true);
    expect(inWorkMode(r.session)).toBe(true);
    const bar = barOf(r.game())!;
    expect(bar).toBe(`<div class="work-bar"><button type="button" class="wk-start" data-action="work-start">${escapeHtml(t("work.resume"))}</button></div>`);
    expect(r.game()).not.toContain("leave-screen");
    r.act("work-start");
    expect(r.session.workShow).toBe(`4:${tk.id}`);
    expect(r.stage()).toContain('class="work-stage');
  });

  it("让它补全 is on the stage's foot row, beside the hand-in; the meeting stage carries its lock card", () => {
    const { store, task: tk } = boardDay(7);
    const r = rig(store, { wbFull: true });
    r.act("work-start");
    if (r.session.launchShow) r.act("task-launch", { task: tk.id });
    const stage = r.stage()!;
    expect(stage).toContain('data-screen="meeting"');
    expect(stage).toMatch(/<div class="cs-right"><button type="button" class="ts-assist" data-action="board-assist">[^<]+<\/button><button type="button" class="ts-finish" data-action="board-settle" disabled>/);
    expect(stage).toContain('<div class="cs-lock">');
    expect(stage).toContain('data-action="board-lock"');
  });
});

describe("§4 the workspace shows the work, read-only", () => {
  it("a table board: the live state with nothing to press — no slot, card, lock, assist, print or code; `.target` on the next slot", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const b = tk.board!;
    store.appendEvent({ kind: "boardStep", taskId: tk.id, op: { t: "unlock", code: b.given.lock!.answer } });
    store.appendEvent({ kind: "boardStep", taskId: tk.id, op: { t: "fill", slot: b.slots[0]!.id, card: b.slots[0]!.answer } });
    const r = rig(store);
    r.act("wb-nav", { page: `task:${tk.id}` });
    const app = () => ({ state: store.getState(), events: store.getEvents(), startDay: store.getStartDay(), session: r.session, night: false, nowMs: 1000 });
    // work-doc (2026-11-27, #165): day 4's page opens on its document; the table is a toggle away
    const first = renderShell(app(), tk, 4, (x) => fillPlaceholders(x, store.getState().names)).main.value;
    expect(first).toContain('<iframe class="ide-frame" data-keep="ide" src="/docs/player/dd-material.html?ch=1');
    expect(first).not.toContain('<table class="btable">');
    r.act("shell-pane", { pane: "table" });
    const out = renderShell(app(), tk, 4, (x) => fillPlaceholders(x, store.getState().names)).main.value;
    for (const action of ["board-slot", "board-card", "board-lock", "board-kuro-lock", "board-assist", "board-print", "board-code", "work-show"]) expect(out, action).not.toContain(`data-action="${action}"`);
    expect(out).toContain('<div class="surface board live">');
    expect(out).toContain('<table class="btable">');
    expect(out).toContain(`<span class="bslot filled" data-slot="${b.slots[0]!.id}">`);
    expect(out).toContain(`<span class="bslot target" data-slot="${b.slots[1]!.id}"></span>`);
    expect(out.match(/bslot target/g)).toHaveLength(1);
    expect(out).toContain('<div class="sh-composer"></div>');
  });
});

describe("§5 nothing from outside reaches into work mode", () => {
  it("no badge on the bar or the other monitor's tab; the messages' and the afternoon's lines wait; the work's own lines play", () => {
    const tk = boardTask(4);
    const store = storeAt(4, itemOf(4, tk));
    const r = rig(store, { wbFull: true });
    const shell = buildShell(store.getState(), store.getEvents(), r.session, desktopApps, 1000, 4);
    expect(Object.values(shell.dock.badges).every((n) => n === 0)).toBe(true);
    expect(r.desktop()).not.toMatch(/<span class="tab-app[^"]*">[^<]*<b>/);
    const here = hereOf(r.session);
    expect(here.work).toBe(true);
    expect(hereOf({ ...r.session, wbFull: false }).work).toBeUndefined();
    const msg = { key: "d4:boss:x", lines: [{ k: "narration" as const, t: "m", where: "screen:msgs:boss" as const }], ending: { kind: "none" as const } };
    const afternoon = { key: "d4:lunch:onUnlock", lines: [{ k: "narration" as const, t: "a" }], ending: { kind: "none" as const } };
    const night = { key: "d4:nightfall", lines: [{ k: "narration" as const, t: "n" }], ending: { kind: "none" as const } };
    const intro = { key: `4:${tk.id}:intro`, lines: [{ k: "speaker" as const, who: "kuro", t: "go" }], ending: { kind: "none" as const } };
    for (const q of [msg, afternoon, night]) expect(workHolds(q, 0), q.key).toBe(true);
    expect(workHolds(intro, 0)).toBe(false);
    const d = settle(push(push(push({ queue: [], line: 0, page: 0 } as never, msg), afternoon), intro), here);
    expect(d.queue[0]!.key).toBe(intro.key);
    expect(d.waiting?.map((p) => p.item.key)).toEqual([msg.key, afternoon.key]);
  });
});
