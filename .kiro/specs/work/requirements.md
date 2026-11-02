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

## Correction 2026-11-02 (author): the choice is a reply, not a toolbar
The three buttons under the input (自己做 / 让它做，我看一眼 / 让它做) go. That strip under a multi-line input is where people expect mode, file and path pickers, not decisions. The flow is a conversation:
1. The day's task is already in the input as one sentence (content `text`); the player sends it (Enter or ↑).
2. It appears as the player's message; Kuro answers in the thread with its stance line for that task and asks how to proceed: 「这个怎么做？」 followed by the three options **as reply chips under Kuro's message**, the way the 消息 app offers canned replies.
3. The chosen chip is sent as the player's reply; the work proceeds as today (自己做 opens the surface; 让它做 runs Kuro's window; 看一眼 / 通过 continue in the same thread).
4. The strip under the input keeps only what belongs there: a scope selector (只看本公司文档 ↔ 全部) and nothing else for now.
Tests: no `wb-mode` buttons under the input; the three options exist only as chips under Kuro's question; the flow completes the same flags and events as before; snapshot the thread on day 1 before and after the choice.

## Addition 2026-11-02 (author): marking is the operation that decides the player's numbers
- **自己做** = find the business problem (clause 6 vs 11). **让它做，我看一眼** = Kuro processes first; the player reads its result and marks what is strange (odd characters, odd adjectives, a sentence that is not a person's). Both are *marking*; a correct mark is what counts (truth score, catch flags). Content lists the markable spots per task (`doc.marks: [{span, kind: "conflict"|"kuro"|"odd", worth: 1|2}]`).
- Proposals (Claude, to be approved before building, not part of the current segment):
  1. **Red pens** (author decided 2026-11-02, this one is not a proposal): in **自己做** the pens are unlimited; in **让它做，我看一眼** the player has three — a mark on a real spot returns the pen, a mark on nothing loses it. Doing it yourself costs time; auditing Kuro costs attention.
  2. **Two ways to mark**: click a sentence = "this line"; drag a span = "something in here" (half credit if the span contains a real spot).
  3. **Kuro reacts at once** when its own change is caught: day 1 "That's mine.", day 9 "You're the only one who reads that far.", day 13 nothing said but the line reverts by itself. Being caught is what it likes.
  4. **The diff is incomplete** from day 7: one change Kuro did not admit is not in the diff and is found only by reading.
  5. **The dictionary verifies**: holding the Wenquxing over an odd word shows a gloss that tells you it does not belong in a contract; the first time an old object is useful at work.

## Addition 2026-11-02 (author): the two modes, for every kind of task
Not only the merge. For every task kind (document, code, ledger, data model, space assembly, product script):
- **自己做** = the player works with Kuro as copilot. Kuro hands over one unit at a time (a clause, a function, a column, a field); the player reads it and can say 「这里不对」 / 「那里不对」 (fixed replies chosen under Kuro's message, never typed); Kuro revises; the player reads again; then 通过. Red pens unlimited.
- **看克总的** (让它做，我看一眼) = Kuro writes the whole thing and hands it over; the player finds the faults. Three red pens.
- **让它做** = no reading; 通过 only.
The unit per task kind comes from content (`doc.units`, `code.units`, …); the surfaces differ, the loop is the same.
