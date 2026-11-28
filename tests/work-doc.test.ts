// work-doc (author 2026-11-27, #165: 「后面有些天，真实工作 UI 的效果看起来很简陋」): a table board may
// name the document it is; the workspace shows that page (the 预览 pane) filled as the cards go in.
// First: days 4–6, the three chapters of the due-diligence material.
import "./specimen";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { freshBoard, stepBoard } from "@state/days/board";
import { ideSrc } from "@state/days/ide";
import { taskByFlag } from "@state/days/tasks";
import { setLocale } from "@world/i18n";
import { panesOf, shellDefaults } from "@world/desktop/workbench/shell";

const DAYS = [[4, "task_d4_1", 1], [5, "task_d5_1", 2], [6, "task_d6_1", 3]] as const;
const docOf = (lang: "zh" | "en") => {
  const html = readFileSync(resolve(__dirname, `../public/docs/player/${lang === "en" ? "en/" : ""}dd-material.html`), "utf8");
  return JSON.parse(/const DOC = (\{[\s\S]*?\n\});/.exec(html)![1]!) as { chapters: { cards: Record<string, string>; items: { slot: string; label: string; answer: string; ask: string }[] }[] };
};

describe("work-doc: the due-diligence material (days 4–6)", () => {
  it.each(["zh", "en"] as const)("%s: each day's board names its chapter; the page has every slot, every card and the right answers", (lang) => {
    setLocale(lang);
    const doc = docOf(lang);
    for (const [day, flag, ch] of DAYS) {
      const board = taskByFlag(day, flag)!.board!;
      expect(board.doc!.src).toBe(`/docs/player/${lang === "en" ? "en/" : ""}dd-material.html?ch=${ch}`);
      expect(board.doc!.pages).toEqual(Object.fromEntries(board.slots.map((s, i) => [s.id, i])));
      const chapter = doc.chapters[ch - 1]!;
      expect(chapter.items.map((i) => [i.slot, i.label, i.answer])).toEqual(board.slots.map((s) => [s.id, s.label, s.answer]));
      for (const item of chapter.items) expect(board.given.rows[item.slot]).toContain(item.ask);
      // every card the board can put in a slot (its own and Kuro's) is on the page, word for word (the page adds the full stop)
      const cards = [...board.cards, ...(board.kuro?.cards ?? [])];
      expect(Object.keys(chapter.cards).sort()).toEqual(cards.map((c) => c.id).sort());
      for (const c of cards) expect(chapter.cards[c.id]!.replace(/[。.]$/, "")).toBe(c.text.replace(/[。.]$/, ""));
    }
    setLocale("zh");
  });

  it("the workspace opens the document; the table is a toggle away; an IDE day is as it was", () => {
    setLocale("zh");
    const task = taskByFlag(4, "task_d4_1")!;
    expect(panesOf(task, true)).toEqual(["files", "preview", "table"]);
    expect(shellDefaults(task, true).panes).toEqual(["preview"]);
    const day1 = taskByFlag(1, "task_merge_done")!;
    expect(day1.board!.doc).toBeUndefined();
    expect(panesOf(day1, true)).not.toContain("table");
  });

  it("the page is addressed like a preview: the chapter, the line in hand, what is filled", () => {
    setLocale("zh");
    const board = taskByFlag(5, "task_d5_1")!.board!;
    let s = { ...freshBoard(board), unlocked: true };
    expect(ideSrc(board, s, [])).toBe("/docs/player/dd-material.html?ch=2&theme=light&pane=preview&c=0&fill=");
    s = stepBoard(board, s, { t: "fill", slot: "r1", card: "c1" });
    s = stepBoard(board, s, { t: "fill", slot: "r3", card: "k1" });
    expect(ideSrc(board, s, [], "r3")).toBe("/docs/player/dd-material.html?ch=2&theme=light&pane=preview&c=2&fill=r1:c1,r3:k1");
  });
});
