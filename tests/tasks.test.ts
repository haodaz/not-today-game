import { describe, expect, it } from "vitest";
import day01 from "@content/tasks/day-01.json";
import { dayFiles, taskFlags } from "@state/days/table";
import { parseTaskFile, taskByFlag, taskFiles } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import { DEFAULT_CLOCK } from "@world/desktop/beat";
import type { ActionContext } from "@world/desktop/controller";
import { taskLines } from "@world/desktop/kuro/mini";
import { initialSession } from "@world/desktop/model";
import { showing } from "@world/loop/dialogue";
import { syncLoop } from "@world/loop/runtime";
import { loopActions } from "@world/room/game";

const clone = () => structuredClone(day01) as any;

// TODO(Claude): content/tasks/day-18.json names its task "task1" with done
// "task_d18_1"; content/days/day-18.json names the item "slip" with done
// "flag:slip_filled" (only the "let" path sets slip_filled). Content decides
// which is right; until then day 18 is a known gap, logged in docs/kiro-log.md.
const KNOWN_GAPS = new Set<string>();

describe("task trees (content/tasks)", () => {
  it("has a file per day; every task matches a checklist item by id and done flag", () => {
    expect([...taskFiles.keys()]).toEqual([...dayFiles.keys()]);
    for (const [day, tasks] of taskFiles) {
      const items = dayFiles.get(day)!.items;
      for (const t of tasks) {
        if (KNOWN_GAPS.has(`${day}:${t.id}`)) continue;
        const item = items.find((it) => it.id === t.id);
        expect(item, `day ${day} ${t.id}`).toBeDefined();
        expect(item!.done, `day ${day} ${t.id}`).toEqual({ kind: "flag", flag: t.done });
      }
    }
  });

  it("every work item of every day has a tree, except items that tick themselves", () => {
    for (const [day, file] of dayFiles) {
      for (const it of file.items) {
        if (it.done.kind !== "flag" || it.self || KNOWN_GAPS.has(`${day}:${it.id}`)) continue;
        expect(taskByFlag(day, it.done.flag), `day ${day} ${it.id}`).toBeDefined();
      }
    }
  });

  it.each([
    ["an unknown key", (d: any) => (d.tasks[0].extra = 1), /unknown key "extra"/],
    ["an unknown mode", (d: any) => (d.tasks[0].start.options[0].mode = "maybe"), /must be one of/],
    ["a path that does not set the done flag", (d: any) => (d.tasks[0].let.effects.flags = []), /done flag/],
    ["an unknown effect", (d: any) => (d.tasks[0].self.effects.mood = 1), /unknown key "mood"/],
    ["an unknown app", (d: any) => (d.tasks[0].app = "mail"), /app/],
  ])("rejects %s", (_name, change, message) => {
    const d = clone();
    change(d);
    expect(() => parseTaskFile(d, "day-01.json")).toThrow(message);
  });
});

describe("task event plays the tree", () => {
  const t1 = taskByFlag(1, taskFlags(1)[0]!)!;

  it("applies the chosen path's effects: flags, san, letItDoUnchecked", () => {
    for (const mode of ["self", "look", "let"] as const) {
      const store = createStore({ startDay: 1, events: [] });
      const san = store.getState().san;
      store.appendEvent({ kind: "task", flag: t1.done, mode });
      const e = t1[mode].effects;
      for (const f of e.flags ?? []) expect(store.getState().flags, mode).toContain(f);
      expect(store.getState().san, mode).toBe(Math.max(0, Math.min(100, san + (e.san ?? 0))));
      expect(store.getState().letItDoUnchecked, mode).toBe(e.letItDoUnchecked ?? 0);
    }
  });

  it("an item that ticks itself only sets its flag", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "task", flag: t1.done, mode: "auto" });
    expect(store.getState().flags).toContain(t1.done);
    expect(store.getState().letItDoUnchecked).toBe(0);
  });

  function ctxFor(store: Store) {
    const session = initialSession(DEFAULT_CLOCK, "right", "desktop");
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {} };
    return ctx;
  }

  it("the ask box (sentence, chip, 通过) plays start + the path in the dialogue box, Kuro's lines in the small window", () => {
    const store = createStore({ startDay: 1 });
    store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
    store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
    let now = 0;
    const ctx: ActionContext = { ...ctxFor(store), now: () => now };
    syncLoop(ctx, 0);
    // The choice is a reply (work 2026-11-02): send the sentence, pick the chip, let it work, 通过.
    loopActions["wb-send"]!(ctx, {} as DOMStringMap, null as never);
    loopActions["wb-choose"]!(ctx, { mode: "look" } as DOMStringMap, null as never);
    now += 3000;
    loopActions["wb-pass"]!(ctx, {} as DOMStringMap, null as never);
    syncLoop(ctx, 0);
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "task", flag: t1.done, mode: "look" });
    const q = ctx.session.dialogue.queue.find((x) => x.key === `d1:task:${t1.id}`)!;
    expect(q.lines.map((l) => l.t)).toEqual([...t1.start.say, ...t1.look.say].map((l) => l.t));
    expect(showing(ctx.session.dialogue, store.getState())).not.toBeNull();
    const lines = taskLines({ state: store.getState(), events: store.getEvents(), startDay: 1, session: ctx.session, night: false, nowMs: 0 });
    expect(lines).toEqual([...t1.look.kuro]);
  });
});
