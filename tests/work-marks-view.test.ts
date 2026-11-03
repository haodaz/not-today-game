// The marking surfaces in the workbench view (work spec items 1–7), driven through the actions:
// the pens shown in 看克总的, a click that hits / misses, Kuro's reaction line when a kuro spot is
// caught, the 自己做 units flow with 这里不对 / 下一段, the code surface, and the held dictionary's
// gloss. The day-1 task tree is replaced (by flag) with fixtures that carry marks / units / code.
import { describe, expect, it, vi } from "vitest";

vi.mock("@content/strings/zh.json", async (importOriginal) => {
  const real = (await importOriginal<{ default: Record<string, string> }>()).default;
  return { default: { "wb.unit.wrong": "这里不对", "wb.unit.next": "下一段", ...real } };
});

// The tree openWork reads comes from taskByFlag; everything else (day files, flags) stays real.
let TREE: any = null;
vi.mock("@state/days/tasks", async (importOriginal) => {
  const real = await importOriginal<typeof import("@state/days/tasks")>();
  return { ...real, taskByFlag: (day: number, flag: string) => (flag === "task_v17_done" && TREE ? TREE : real.taskByFlag(day, flag)) };
});

import { parseTaskFile } from "@state/days/tasks";
import { createStore, type Store } from "@state/store";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession, type AppContext } from "@world/desktop/model";
import { renderWork } from "@world/desktop/workbench/work";
import { escapeHtml } from "@world/html";
import { t } from "@world/i18n";
import { loopActions } from "@world/room/game";

const DOC = {
  day: 1,
  tasks: [
    {
      id: "t",
      title: "合同",
      app: "docs",
      done: "task_v17_done",
      start: { say: [{ k: "narration", t: "两版并排。" }], options: [{ mode: "self", goto: "self" }, { mode: "look", goto: "look" }, { mode: "let", goto: "let" }] },
      self: { say: [{ k: "narration", t: "你读。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_a"] } },
      look: { say: [{ k: "narration", t: "你扫了一眼。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_a"], looked: true } },
      let: { say: [{ k: "narration", t: "你通过了。" }], kuro: [], effects: { flags: ["task_v17_done"], letItDoUnchecked: 1 } },
      doc: {
        left: ["Clause one is fine.", "Two owes a wage here.", "Clause three is fine."],
        right: ["Clause one is fine.", "Two owes a wage here.", "Clause three is fine."],
        conflict: [0, 2],
        catchFlags: ["caught_a"],
        units: [{ text: "Clause one is fine." }, { text: "Two owes a wage here.", fix: "Two is now capped." }, { text: "Clause three is fine." }],
        marks: [{ clause: 1, kind: "kuro", worth: 2, caught: "我以为你不会读到那里。", word: "wage", span: [11, 15] }],
      },
    },
  ],
};
const CODE = {
  day: 1,
  tasks: [
    {
      id: "c",
      title: "diff",
      app: "code",
      done: "task_v17_done",
      start: { say: [{ k: "narration", t: "一段 diff。" }], options: [{ mode: "self", goto: "self" }, { mode: "look", goto: "look" }, { mode: "let", goto: "let" }] },
      self: { say: [{ k: "narration", t: "你读代码。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_code"] } },
      look: { say: [{ k: "narration", t: "你扫了一眼。" }], kuro: [], effects: { flags: ["task_v17_done", "caught_code"], looked: true } },
      let: { say: [{ k: "narration", t: "你通过了。" }], kuro: [], effects: { flags: ["task_v17_done"], letItDoUnchecked: 1 } },
      code: {
        lines: ["function pay(amount) {", "  return amount * rate;", "  log(secretKey);", "}"],
        catchFlags: ["caught_code"],
        marks: [{ clause: 1, kind: "conflict", worth: 2 }, { clause: 2, kind: "kuro", worth: 2, hidden: true, caught: "那一行不是你写的。" }],
      },
    },
  ],
};
const treeOf = (raw: unknown, label: string) => parseTaskFile(raw, label).tasks[0]!;

function open(hold = false): { store: Store; ctx: ActionContext; app: () => AppContext; wait: (ms: number) => void } {
  const store = createStore({ startDay: 1 });
  store.appendEvent({ kind: "step", name: "boot", t: "09:03" });
  store.appendEvent({ kind: "step", name: "openApp:msgs", t: "09:04" });
  const session = initialSession({ beat: "work", time: "10:00" }, "right", "desktop");
  if (hold) session.holding = "dictionary";
  let now = 0;
  const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
  return {
    store,
    ctx,
    app: () => ({ state: store.getState(), events: store.getEvents(), startDay: 1, session, night: false, nowMs: now }),
    wait: (ms: number) => (now += ms),
  };
}
const act = (ctx: ActionContext, name: string, data: Record<string, string> = {}) => loopActions[name]!(ctx, data as DOMStringMap, null as never);
const work = (app: AppContext) => renderWork(app).value;
/** Choose a mode and, when Kuro works (look / let), wait out its 3 s so the surface is shown. */
function choose(h: { ctx: ActionContext; wait: (ms: number) => void }, mode: "self" | "look" | "let"): void {
  act(h.ctx, "wb-choose", { mode });
  if (mode !== "self") h.wait(3000);
}
const lastTask = (store: Store) => store.getEvents().filter((e) => e.kind === "task").at(-1);

describe("marking a document in 看克总的 (three pens)", () => {
  it("three pens show, one is spent after a mark", () => {
    TREE = treeOf(DOC, "doc");
    const h = open();
    const { ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    let out = work(app());
    expect(out.match(/class="pen"/g)).toHaveLength(3);
    expect(out).not.toContain("pen spent");
    act(ctx, "wb-mark", { clause: "0" }); // a miss
    out = work(app());
    expect((out.match(/pen spent/g) ?? []).length).toBe(1);
  });

  it("a hit on the kuro spot shows its caught line; 通过 records the marks and sets the catch flag", () => {
    TREE = treeOf(DOC, "doc");
    const h = open();
    const { store, ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    act(ctx, "wb-mark", { clause: "1" }); // a hit on the kuro spot
    expect(work(app())).toContain(escapeHtml("我以为你不会读到那里。"));
    act(ctx, "wb-pass");
    expect(lastTask(store)).toMatchObject({ kind: "task", mode: "look", marks: [{ clause: 1, hit: true }] });
    expect(store.getState().flags).toContain("caught_a");
  });

  it("only misses: the catch flag is dropped", () => {
    TREE = treeOf(DOC, "doc");
    const h = open();
    const { store, ctx } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    act(ctx, "wb-mark", { clause: "0" });
    act(ctx, "wb-pass");
    expect(store.getState().flags).not.toContain("caught_a");
  });

  it("a span across the kuro spot hits at half worth and returns the caught line; a span beside it misses", () => {
    TREE = treeOf(DOC, "doc");
    const h = open();
    const { store, ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    act(ctx, "wb-mark-span", { clause: "1", a: "10", b: "14" }); // overlaps [11,15]
    expect(work(app())).toContain(escapeHtml("我以为你不会读到那里。"));
    expect(ctx.session.work!.marks[0]).toMatchObject({ clause: 1, hit: true, worth: 1 });
    act(ctx, "wb-mark-span", { clause: "1", a: "0", b: "3" }); // beside it
    expect(ctx.session.work!.marks.at(-1)).toMatchObject({ hit: false });
    act(ctx, "wb-pass");
    expect(store.getState().flags).toContain("caught_a");
  });

  it("look runs out of pens after three marks", () => {
    TREE = treeOf(DOC, "doc");
    const h = open();
    const { ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    for (let i = 0; i < 4; i++) act(ctx, "wb-mark", { clause: "0" });
    expect(ctx.session.work!.marks).toHaveLength(3);
    expect(work(app())).toContain("pen spent");
  });
});

describe("自己做 units (one at a time)", () => {
  it("units appear one at a time; 这里不对 swaps for the fix and hits the listed spot", () => {
    TREE = treeOf(DOC, "doc");
    const { store, ctx, app } = open();
    act(ctx, "wb-send");
    act(ctx, "wb-choose", { mode: "self" });
    // The first unit is shown, with the two chips.
    let out = work(app());
    expect(out).toContain(escapeHtml("Clause one is fine."));
    expect(out).not.toContain(escapeHtml("Two owes a wage here."));
    expect(out).toContain(`>${escapeHtml(t("wb.unit.next"))}</button>`);
    act(ctx, "wb-unit-next"); // move to unit 1 (a listed spot)
    out = work(app());
    expect(out).toContain(escapeHtml("Two owes a wage here."));
    act(ctx, "wb-unit-wrong"); // 这里不对: swap for the fix, a hit
    out = work(app());
    expect(out).toContain(escapeHtml("Two is now capped."));
    expect(ctx.session.work!.marks).toContainEqual(expect.objectContaining({ clause: 1, hit: true }));
    act(ctx, "wb-unit-next"); // unit 2
    act(ctx, "wb-pass");
    expect(lastTask(store)).toMatchObject({ mode: "self", marks: [{ clause: 1, hit: true }] });
    expect(store.getState().flags).toContain("caught_a");
  });
});

describe("the code surface", () => {
  it("shows line numbers and marks by line; a hidden kuro spot is not highlighted but is markable", () => {
    TREE = treeOf(CODE, "code");
    const h = open();
    const { store, ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    const out = work(app());
    expect(out).toContain("surface mark codefile");
    expect(out).toContain('<span class="ln" aria-hidden="true">3</span>');
    // The conflict spot on line 1 (index 1) is highlighted; the hidden kuro spot on line 2 is not.
    const row2 = out.slice(out.indexOf('data-clause="1"') - 40, out.indexOf('data-clause="1"') + 10);
    expect(row2).toContain(" y");
    const row3 = out.slice(out.indexOf('data-clause="2"') - 40, out.indexOf('data-clause="2"') + 10);
    expect(row3).not.toContain(" y");
    // Still markable: a click on the hidden line hits and shows its caught line.
    act(ctx, "wb-mark", { clause: "2" });
    expect(work(app())).toContain(escapeHtml("那一行不是你写的。"));
    act(ctx, "wb-pass");
    expect(store.getState().flags).toContain("caught_code");
  });

  it("snapshot: the code surface in 看克总的", () => {
    TREE = treeOf(CODE, "code");
    const h = open();
    const { ctx, app } = h;
    act(ctx, "wb-send");
    choose(h, "look");
    expect(work(app())).toMatchSnapshot();
  });
});

describe("the dictionary verifies (item 7)", () => {
  it("the gloss shows only while the dictionary is held, and only on a listed word", () => {
    TREE = treeOf(DOC, "doc");
    // Not held: the word is not wrapped, the gloss cannot open.
    const nope = open(false);
    act(nope.ctx, "wb-send");
    choose(nope, "look");
    expect(work(nope.app())).not.toContain('data-action="wb-gloss"');
    act(nope.ctx, "wb-gloss", { word: "wage" });
    expect(nope.ctx.session.wbGloss).toBeNull();
    // Held: the listed word is wrapped; glossing it shows the tooltip.
    const held = open(true);
    act(held.ctx, "wb-send");
    choose(held, "look");
    const out = work(held.app());
    expect(out).toContain('data-action="wb-gloss"');
    expect(out).toContain(">wage</span>");
    act(held.ctx, "wb-gloss", { word: "wage" });
    const tip = work(held.app());
    expect(tip).toContain('class="dtip"');
    expect(tip).toContain(escapeHtml("工资"));
    act(held.ctx, "wb-gloss", { word: "wage" }); // a second look closes it
    expect(held.ctx.session.wbGloss).toBeNull();
  });
});
