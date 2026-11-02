// work FR1, the self path on a document: once both conflicting clauses are read, Kuro's message
// offers 合并 / 不合 as reply chips; either way the catch flags are set, 通过 follows, and the task
// event carries `merge`. The strings (`wb.merge` / `wb.keep`) are Claude's: this file falls back to
// the literals only here, under content's own strings (content's win once they exist).
import { describe, expect, it, vi } from "vitest";

vi.mock("@content/strings/zh.json", async (importOriginal) => {
  const real = (await importOriginal<{ default: Record<string, string> }>()).default;
  return { default: { "wb.merge": "合并", "wb.keep": "不合", ...real } };
});

import { applyEvent } from "@state/events";
import { taskFiles } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext } from "@world/desktop/model";
import { renderWork } from "@world/desktop/workbench/work";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const task1 = taskFiles.get(1)!.find((x) => x.id === "task1")!;
const doc = task1.doc!;

function open(): { store: Store; ctx: ActionContext; app: () => AppContext } {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  const session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => 0 };
  return { store, ctx, app: () => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: 0 }) };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const work = (app: AppContext) => renderWork(app).value;
const tasks = (store: Store) => store.getEvents().filter((e) => e.kind === "task");

describe("合并 / 不合 after both conflicting clauses", () => {
  it("the chips appear only after both clicks, under Kuro's message; 通过 waits for the answer", () => {
    const { ctx, app } = open();
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "self" });
    expect(work(app())).not.toContain('data-action="wb-merge"');
    act(ctx, "wb-clause", { i: String(doc.conflict[0]) });
    act(ctx, "wb-clause", { i: "0" });
    expect(work(app())).not.toContain('data-action="wb-merge"');
    expect(work(app())).toContain('data-action="wb-pass"');
    act(ctx, "wb-clause", { i: String(doc.conflict[1]) });
    const out = work(app());
    const kuroMsg = out.slice(out.lastIndexOf('<div class="wm them">'), out.indexOf('<div class="surface'));
    expect(kuroMsg).toContain(escapeHtml(task1.self.kuro[0]!));
    expect(kuroMsg.match(/data-action="wb-merge"/g)).toHaveLength(2);
    expect(kuroMsg).toContain(`>${escapeHtml(t("wb.merge"))}</button>`);
    expect(kuroMsg).toContain(`>${escapeHtml(t("wb.keep"))}</button>`);
    expect(out).not.toContain('data-action="wb-pass"');
    // 通过 does nothing until answered.
    act(ctx, "wb-pass");
    expect(tasks(ctx.store)).toHaveLength(0);
  });

  it.each([
    [true, "1", "wb.merge"],
    [false, "0", "wb.keep"],
  ] as const)("merge %s: the reply, then 通过: the same self event plus merge; the catch flags either way", (merge, data, key) => {
    const { store, ctx, app } = open();
    const before = store.getState();
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "self" });
    for (const i of doc.conflict) act(ctx, "wb-clause", { i: String(i) });
    act(ctx, "wb-merge", { merge: data });
    const out = work(app());
    expect(out).not.toContain('data-action="wb-merge"');
    expect(out).toContain(`<div class="wm me"><div class="bub">${escapeHtml(t(key))}</div></div>`);
    if (merge) {
      // The merge result is the right-hand version, in one column.
      expect(out).toContain('class="surface doc merged"');
      for (const clause of doc.right) expect(out).toContain(escapeHtml(clause));
    } else expect(out).not.toContain("merged");
    act(ctx, "wb-pass");
    expect(tasks(store)).toEqual([{ kind: "task", day: 1, flag: task1.done, mode: "self", merge }]);
    for (const f of doc.catchFlags) expect(store.getState().flags).toContain(f);
    // The state is the self path's, exactly as without the record.
    expect(store.getState().flags).toEqual(applyEvent(before, { kind: "task", day: 1, flag: task1.done, mode: "self" }).flags);
    expect(store.getState().san).toBe(applyEvent(before, { kind: "task", day: 1, flag: task1.done, mode: "self" }).san);
  });

  it("the reducer takes merge only on a self path that found the conflict", () => {
    const s = createStore({ startDay: 1 }).getState();
    expect(() => applyEvent(s, { kind: "task", day: 1, flag: task1.done, mode: "let", merge: true })).toThrow(/merge/);
    expect(() => applyEvent(s, { kind: "task", day: 1, flag: task1.done, mode: "self", missed: true, merge: false })).toThrow(/merge/);
  });

  it("snapshot: the thread with the chips", () => {
    const { ctx, app } = open();
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "self" });
    for (const i of doc.conflict) act(ctx, "wb-clause", { i: String(i) });
    expect(work(app())).toMatchSnapshot();
  });
});
