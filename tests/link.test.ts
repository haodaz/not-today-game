// link-link (author 2026-11-13): day 4's 「意识」 — pairs dealt with a move on them, the line with at most
// two bends, a join clears both, the first wrong pair turns back once, all joined approves the form.
import "./specimen";
import { describe, expect, it } from "vitest";
import { taskByFlag } from "@state/days/tasks";
import { createStore } from "@state/store";
import { boardState, canPrint } from "@state/days/board";
import type { ActionContext } from "@world/desktop/controller";
import { initialSession } from "@world/desktop/model";
import { boardActions } from "@world/desktop/workbench/board";
import { hasMove, linkPath, linkShuffle, linkStart, linkTap, type LinkGrid } from "@world/desktop/workbench/link";
import { dice } from "@world/desktop/workbench/battle";
import { workLayer } from "@world/desktop/workbench/compare";
import { setLocale, t } from "@world/i18n";
import { completeUntil } from "./complete-items";

const GAME = { kind: "link" as const, cols: 8, rows: 6, kinds: 8 };

/** A 4×3 board from rows of letters (. = empty). */
const grid = (...rows: string[]): Pick<LinkGrid, "cols" | "rows" | "cells"> => ({
  cols: rows[0]!.length,
  rows: rows.length,
  cells: rows.join("").split("").map((ch) => (ch === "." ? -1 : ch.charCodeAt(0) - 97)),
});

describe("link-link", () => {
  it("day 4's board is a link-link", () => {
    expect(taskByFlag(4, "task_d4_1")!.board!.game).toEqual(GAME);
  });

  it("deals every kind in pairs with a move on the board", () => {
    for (let seed = 0; seed < 6; seed++) {
      const g = linkStart("t", GAME, dice(`s${seed}`));
      expect(g.cells).toHaveLength(48);
      expect(g.left).toBe(24);
      const count = new Map<number, number>();
      for (const k of g.cells) count.set(k, (count.get(k) ?? 0) + 1);
      for (const n of count.values()) expect(n % 2).toBe(0);
      expect(hasMove(g)).toBe(true);
      expect(g.shuffles).toBe(0);
    }
  });

  it("joins straight, with one bend, with two bends (through the ring outside too), and not through tiles", () => {
    // a . . a   straight along the top row
    const g1 = grid("a..a", "bccb", "dd..");
    expect(linkPath(g1, 0, 3)).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
    // b and b on row 1: blocked by the c's between — but joinable around the ring outside? no: (0,1)→(-1,1)→(-1,?)… two bends: (0,1)→(0,-1)→(3,-1)→(3,1) needs (0,0) and (3,0) empty — they hold a's
    expect(linkPath(g1, 4, 7)).toBeNull();
    // the d's: next to each other
    expect(linkPath(g1, 8, 9)).toEqual([{ x: 0, y: 2 }, { x: 1, y: 2 }]);
    // one bend: a at (0,0) and a at (1,1) with (1,0) or (0,1) empty
    const g2 = grid("a...", ".a..", "....");
    expect(linkPath(g2, 0, 5)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
    // two bends: a at (0,0) and a at (0,2) with a b between them, around through column -1 (the ring outside)
    const g3 = grid("ab..", "bb..", "ab..");
    expect(linkPath(g3, 0, 8)).toEqual([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 2 }, { x: 0, y: 2 }]);
    // fully walled: no line
    const g4 = grid("abb.", "bbbb", "bbba");
    expect(linkPath(g4, 0, 11)).toBeNull();
    // different kinds never pair (the tap checks the kind; the path itself only checks the line)
    expect(hasMove(grid("aa"))).toBe(true);
    expect(hasMove(grid("ab", "cd"))).toBe(false);
    // walled in by each other: the diagonal pairs have no line (three bends would be needed)
    expect(hasMove(grid("ab", "ba"))).toBe(false);
  });

  it("a tap picks; a second joins the pair; the first wrong pair turns back once; stuck boards reshuffle", () => {
    const base = linkStart("t", GAME, dice("s2"));
    // hand-laid: row 0 = a b c d e f g h, row 1 = a b c d e f g h, the rest cleared → every column is a vertical pair
    const cells = base.cells.map((_, i) => (i < 16 ? i % 8 : -1));
    const g: LinkGrid = { ...base, cells, left: 8 };
    const picked = linkTap(g, 0, 100, dice("r"));
    expect(picked.pick).toBe(0);
    const joined = linkTap(picked, 8, 200, dice("r"));
    expect(joined.cells[0]).toBe(-1);
    expect(joined.cells[8]).toBe(-1);
    expect(joined.left).toBe(7);
    expect(joined.path).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    expect(joined.pathAt).toBe(200);
    expect(joined.pick).toBeNull();
    // wrong: a (1,0)=b with (2,0)=c — the first time the pair wakes, the pick is dropped
    const wrong = linkTap({ ...joined, pick: 1 }, 2, 300, dice("r"));
    expect(wrong.aware).toEqual([1, 2]);
    expect(wrong.awareUsed).toBe(true);
    expect(wrong.pick).toBeNull();
    // the second wrong pair: the pick just moves
    const wrong2 = linkTap({ ...wrong, pick: 1 }, 2, 400, dice("r"));
    expect(wrong2.aware).toBeNull();
    expect(wrong2.pick).toBe(2);
    // the last pair: done
    let h: LinkGrid = { ...base, cells: base.cells.map((_, i) => (i === 0 || i === 1 ? 3 : -1)), left: 1 };
    h = linkTap(linkTap(h, 0, 500, dice("r")), 1, 600, dice("r"));
    expect(h.done).toBe(true);
    expect(h.left).toBe(0);
    // stuck: a b / b a — the diagonals cannot be joined; a shuffle deals the same tiles until a move exists
    const stuck: LinkGrid = { ...base, cells: grid("ab", "ba").cells, cols: 2, rows: 2, left: 2 };
    expect(hasMove(stuck)).toBe(false);
    const dealt = linkShuffle(stuck, dice("r"));
    expect(hasMove(dealt)).toBe(true);
    expect(dealt.shuffles).toBe(stuck.shuffles + 1);
    expect([...dealt.cells].sort()).toEqual([...stuck.cells].sort());
  });

  it("after the filled form the stage shows the board; all joined approves the form and the sheet opens", () => {
    setLocale("zh");
    const store = createStore({ startDay: 4 });
    completeUntil(store, "task1");
    const task = taskByFlag(4, "task_d4_1")!;
    const board = task.board!;
    const session = initialSession({ beat: "work", time: "10:00" }, "left", "desktop");
    session.workShow = `4:${task.id}`;
    let now = 1000;
    const ctx: ActionContext = { store, session, rerender: () => {}, later: () => {}, now: () => now };
    const act = (name: string, data: Record<string, string> = {}) => boardActions[name]!(ctx, data as DOMStringMap, null as never);
    const out = () => workLayer({ state: store.getState(), events: store.getEvents(), session, nowMs: now })!.value;
    store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "unlock", code: board.given.lock!.answer } });
    for (const slot of board.slots) store.appendEvent({ kind: "boardStep", taskId: task.id, op: { t: "fill", slot: slot.id, card: slot.answer } });
    expect(canPrint(board, boardState(board, 4, task.id, store.getEvents()))).toBe(false);
    expect(out()).toContain('data-screen="link"');
    act("link-start");
    expect(session.link?.key).toBe(task.id);
    expect(out()).toContain('data-action="link-tap" data-i="0"');
    expect(out()).toContain(t("link.stage.count", { n: "24" }));
    // a reshuffle keeps the tiles
    const before = [...session.link!.cells].sort();
    act("link-shuffle");
    expect([...session.link!.cells].sort()).toEqual(before);
    // the last pair joined: approved; the stamp; then the sheet's button
    session.link = { ...session.link!, cells: session.link!.cells.map((_, i) => (i === 0 || i === 1 ? 2 : -1)), left: 1 };
    act("link-tap", { i: "0" });
    act("link-tap", { i: "1" });
    expect(store.getEvents().at(-1)).toMatchObject({ kind: "boardStep", op: { t: "approve" } });
    expect(canPrint(board, boardState(board, 4, task.id, store.getEvents()))).toBe(true);
    expect(out()).toContain(t("link.stage.won"));
    now = 4000;
    expect(out()).toContain(`data-action="board-settle">${t("sheet.settle.open")}</button>`);
  });
});
