// compare (author 2026-11-11): 猜老板的言外之意 — day 1's work on the real content. The pages, the boss's
// taste (the slot's answer), the satisfaction and the hand-in gate, Kuro's rewrite (judged flawed at
// night), the transcript, and the pane's markup.
import { describe, expect, it } from "vitest";
import { boardJudgement, boardState, canPrint, comparePending, compareScore, freshBoard, stepBoard } from "@state/days/board";
import { ideTranscript } from "@state/days/ide";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { setLocale, t } from "@world/i18n";
import { comparePane, riddle } from "../src/world/desktop/workbench/compare";

const task = () => taskByFlag(1, "task_merge_done")!;
const board = () => task().board!;

describe("the content", () => {
  it("day 1's board compares five pages, two different cards each, the boss's three riddles, Kuro's remark per card; the threshold is 80", () => {
    const b = board();
    const cmp = b.compare!;
    expect(cmp.versions).toEqual(["v15", "v16"]);
    expect(cmp.threshold).toBe(80);
    expect(cmp.pages.map((p) => p.slot)).toEqual(b.slots.map((s) => s.id));
    for (const p of cmp.pages) {
      expect(p.left).not.toBe(p.right);
      expect(p.bubbles.length).toBeGreaterThanOrEqual(1);
      expect(p.bubbles.length).toBeLessThanOrEqual(3);
      expect(Object.keys(p.remark).sort()).toEqual([p.left, p.right].sort());
      // the boss's taste is one of the two
      const answer = b.slots.find((s) => s.id === p.slot)!.answer;
      expect([p.left, p.right]).toContain(answer);
    }
    expect(b.ide?.diff).toBeUndefined();
    expect(b.ide?.api).toBeUndefined();
    expect(task().deliverable?.label).toContain("v17");
  });
  it("a riddle's 【key words】 are drawn bold and coloured", () => {
    expect(riddle("要【厚】一点，别人一听就知道我们【不是套壳】。").value).toBe('要<b class="cmp-key">厚</b>一点，别人一听就知道我们<b class="cmp-key">不是套壳</b>。');
    expect(riddle("你觉得呢？").value).toBe("你觉得呢？");
  });
});

describe("the picks", () => {
  it("pages are picked in order; the score counts the boss's taste; 发给老王 needs every page and 80 %", () => {
    const b = board();
    const cmp = b.compare!;
    let s = freshBoard(b);
    expect(comparePending(b, s)?.slot).toBe("r1");
    expect(compareScore(b, s)).toEqual({ right: 0, picked: 0, total: 5, pct: 0 });
    // four of five to his taste: 80 %, enough
    for (const p of cmp.pages.slice(0, 4)) s = stepBoard(b, s, { t: "fill", slot: p.slot, card: b.slots.find((x) => x.id === p.slot)!.answer });
    expect(comparePending(b, s)?.slot).toBe("r5");
    expect(canPrint(b, s)).toBe(false);
    const last = cmp.pages[4]!;
    const wrong = b.slots.find((x) => x.id === last.slot)!.answer === last.left ? last.right : last.left;
    s = stepBoard(b, s, { t: "fill", slot: last.slot, card: wrong });
    expect(comparePending(b, s)).toBeNull();
    expect(compareScore(b, s).pct).toBe(80);
    expect(canPrint(b, s)).toBe(true);
    // three wrong: 40 %, not enough; Kuro's rewrite (assistFill) makes every page his taste
    let w = freshBoard(b);
    for (const p of cmp.pages) {
      const answer = b.slots.find((x) => x.id === p.slot)!.answer;
      const other = answer === p.left ? p.right : p.left;
      w = stepBoard(b, w, { t: "fill", slot: p.slot, card: cmp.pages.indexOf(p) < 2 ? answer : other });
    }
    expect(compareScore(b, w).pct).toBe(40);
    expect(canPrint(b, w)).toBe(false);
    w = stepBoard(b, w, { t: "assistFill" });
    expect(compareScore(b, w).pct).toBe(100);
    expect(w.assists).toBe(1);
    expect(canPrint(b, w)).toBe(true);
  });

  it("Kuro's rewrite is judged flawed at night (SAN down a little) even though every page is his taste", () => {
    const store = createStore({ startDay: 1 });
    const b = board();
    for (const p of b.compare!.pages) store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "fill", slot: p.slot, card: p.left } });
    store.appendEvent({ kind: "boardStep", taskId: task().id, op: { t: "assistFill" } });
    const s = boardState(b, 1, task().id, store.getEvents());
    store.appendEvent({ kind: "task", flag: task().done, mode: "let", slots: { ...s.slots }, assists: s.assists });
    store.appendEvent({ kind: "give", deliverableId: task().deliverable!.id, t: "15:00" });
    expect(boardJudgement(1, store.getEvents())).toEqual({ verdict: "flawed", san: task().judge!.flawed });
    // the player's own picks, all his taste: perfect
    const own = createStore({ startDay: 1 });
    const slots = Object.fromEntries(b.slots.map((x) => [x.id, x.answer]));
    own.appendEvent({ kind: "task", flag: task().done, mode: "self", slots, assists: 0 });
    own.appendEvent({ kind: "give", deliverableId: task().deliverable!.id, t: "15:00" });
    expect(boardJudgement(1, own.getEvents())).toEqual({ verdict: "perfect", san: 0 });
  });

  it("the transcript: the open beat, per pick the player's line, 渲染好了 and the face; the sum after the last; the remarks after the hand-in", () => {
    const b = board();
    const cmp = b.compare!;
    const ops = cmp.pages.map((p) => ({ t: "fill" as const, slot: p.slot, card: b.slots.find((x) => x.id === p.slot)!.answer }));
    const lines = ideTranscript(b, ops);
    expect(lines.slice(0, 2).map((l) => l.on)).toEqual(["open", "open"]);
    expect(lines[2]).toMatchObject({ on: "compare:cmpPick", who: "me", args: { n: "1", v: cmp.pages[0]!.left === ops[0]!.card ? "v15" : "v16" } });
    expect(lines[3]).toMatchObject({ on: "compare:cmpRendered", who: "kuro", args: { n: "1" } });
    expect(lines[4]).toMatchObject({ on: "compare:cmpHappy", who: "kuro" });
    const sum = lines.find((l) => l.on === "compare:cmpSum")!;
    expect(sum.args).toEqual({ n: "5", r: "5", w: "0", pct: "100" });
    expect(lines[lines.indexOf(sum) + 1]!.on).toBe("compare:cmpPass");
    const after = ideTranscript(b, [...ops, { t: "print" }, { t: "send" }]);
    const remarks = after.filter((l) => l.on.startsWith("remark:"));
    expect(remarks.map((l) => l.text)).toEqual(cmp.pages.map((p) => p.remark[b.slots.find((x) => x.id === p.slot)!.answer]));
    expect(after.indexOf(remarks[0]!)).toBeGreaterThan(after.findIndex((l) => l.on === "print"));
    expect(after[after.length - 1]!.on).toBe("send");
    // a wrong pick: the pout
    const wrongOps = [{ t: "fill" as const, slot: "r1", card: cmp.pages[0]!.left === b.slots[0]!.answer ? cmp.pages[0]!.right : cmp.pages[0]!.left }];
    expect(ideTranscript(b, wrongOps).map((l) => l.on)).toContain("compare:cmpPout");
  });
});

describe("the pane", () => {
  it("live: the portrait, the page's riddles with their key words, the two versions as buttons, 克总你定, five faces; a pick marks its card and face; all picked: the settlement", () => {
    setLocale("zh");
    const b = board();
    const cmp = b.compare!;
    let s = freshBoard(b);
    let out = comparePane(task(), b, s, true, false, null).value;
    expect(out).toContain('<img class="cmp-portrait" src="/npc/boss.png"');
    expect(out).toContain('<b class="cmp-key">厚</b>');
    expect(out).toContain(`data-action="compare-pick" data-slot="r1" data-card="${cmp.pages[0]!.left}"`);
    expect(out).toContain(`data-action="compare-pick" data-slot="r1" data-card="${cmp.pages[0]!.right}"`);
    expect(out).toContain(`data-action="compare-kuro" data-slot="r1"`);
    expect(out.match(/class="cmp-face todo/g)).toHaveLength(5);
    expect(out).toContain(t("compare.page", { n: "1", label: b.slots[0]!.label }));
    expect(out).not.toContain("cmp-sum");
    // pages picked to his taste: happy faces; the next page shows
    for (const p of cmp.pages) s = stepBoard(b, s, { t: "fill", slot: p.slot, card: b.slots.find((x) => x.id === p.slot)!.answer });
    out = comparePane(task(), b, s, true, false, null).value;
    expect(out.match(/class="cmp-face happy/g)).toHaveLength(5);
    expect(out).toContain("cmp-sum");
    expect(out).toContain("<b>100%</b>");
    expect(out).toContain(t("compare.pass", { pct: "80" }));
    expect(out).not.toContain("compare-redo");
    // under the bar: the redo
    let w = freshBoard(b);
    for (const p of cmp.pages) w = stepBoard(b, w, { t: "fill", slot: p.slot, card: b.slots.find((x) => x.id === p.slot)!.answer === p.left ? p.right : p.left });
    out = comparePane(task(), b, w, true, false, null).value;
    expect(out.match(/class="cmp-face pout/g)).toHaveLength(5);
    expect(out).toContain('data-action="compare-redo"');
    expect(out).toContain(t("compare.fail", { pct: "80" }));
    // while Kuro renders: the buttons wait
    expect(comparePane(task(), b, s, true, true, null).value).toContain(t("compare.rendering", { n: "5" }));
    expect(comparePane(task(), b, freshBoard(b), true, true, null).value).toMatch(/data-action="compare-pick"[^>]* disabled/);
    // read back: no buttons
    const read = comparePane(task(), b, s, false, false, null).value;
    expect(read).not.toContain("data-action=");
  });
});
