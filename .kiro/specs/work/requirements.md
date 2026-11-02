# work — requirements (author 2026-11-02)

The work tasks get a working surface. Today the three modes (`self` / `look` / `let`) are buttons on a tree; the author: "具体的工作界面没有，目前只有外层". Design source: `script/notes/工作界面.md` (Chinese, author's decisions at the end). The task trees in `content/tasks/day-NN.json` stay the source of lines, flags and effects; this spec adds the **doing** between the mode choice and the effects.

## FR1. Three surfaces, all from day 1
Each task has an `app` (`docs`, `ledger`, `export`; later days may add `code`, `tickets`, `projects`, which reuse one of the three surfaces until their own exist). Choosing a mode opens the surface inside the workbench; finishing it applies the branch's `say`/`kuro`/`effects` exactly as today. Every surface is 3–6 actions, under 30 s.
- **docs**: two columns, left the old version, right the new, 10–14 clauses each from content (`doc.left[]`, `doc.right[]`), differing clauses tinted, a 「通过」 button always present. `self`: the player scrolls and must click the two conflicting clauses (`doc.conflict: [i, j]`) to have "read" them; both clicked → Kuro's small window: the task's first `kuro` line + 合并 / 不合; then 通过. Fewer than two clicked at 通过 = the `self` branch's effects without the catch flags (`doc.catchFlags`). `let`: Kuro's window scrolls for 3 s, the merged text appears with one clause rewritten (`doc.kuroEdit: {clause, text}`); opening that clause = `look`, pressing 通过 without = `let`.
- **ledger**: an 8-row table (`ledger.rows[]`: client, amount, due, overdue days, note), the target cell lit (`ledger.target: [row, col]`, `ledger.value`). `self`: click the cell, type, Enter (retyping allowed). `let`: Kuro sets the cell and also "tidies" one column (`ledger.kuroTidy: {col, how}`); opening the column header shows the change (= look), not opening = let.
- **export**: a field checklist (`export.fields[]`, `export.wanted[]`) and 「导出」; result line 「已生成 <name>.csv · N 列」. `self`: tick and export; over/under-ticking still exports. `let`: Kuro ticks one extra field (`export.kuroExtra`); opening the list before 导出 = look.

## FR2. What Kuro does when it does it (the author's rule)
- Kuro's touch is **strange, not wrong**: its rewritten clause, tidied column or extra field reads as not quite human (word order, a word that should not be there, a tense that slips) and yet the outcome holds: the boss accepts, the table balances. Content writes the strange text; code never generates it.
- **Two times in ten it is simply right**: `kuroEdit` / `kuroTidy` / `kuroExtra` may be absent; then look finds nothing odd. Content decides per task.
- Looking (opening the touched thing) is logged as today's `looked`; not looking as `letItDoUnchecked`. Nothing new in state.

## FR3. Kuro's window during work
- `let`/`look`: the small window shows motion for 3 s (scrolling, typing dots, the `busy` sprite state), then the branch's `kuro` line. `self`: nothing until the conflict is found.
- Keyboard-usable: Tab through clauses/cells/fields, Enter to pick.

## FR4. Content (Claude)
- `content/tasks/day-NN.json` tasks gain `doc` / `ledger` / `export` objects as above. Strict loader; a task whose `app` has no matching object keeps today's button-only tree (so content can land day by day).

## FR5. Tests
- Loader strict. Snapshots: each surface at open, mid-way, and done, in `self` and `let`. Properties: `self` without both conflict clicks never sets a catch flag; `let` sets `letItDoUnchecked` unless the touched thing was opened; a task with no surface object behaves exactly as before; the surface never writes world events itself (the branch effects do, as today).
