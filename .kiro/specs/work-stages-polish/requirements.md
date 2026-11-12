# Work stages polish — requirements

Scope: the full-stage work screens added on 2026-11-12 under `src/world/desktop/workbench/`:
`clue-stage.ts` (the evidence board), `meeting-stage.ts` (the meeting replay), `stack-stage.ts`
(the approval chain, a 2048), and their styles in `src/world/desktop/desktop.css`. Read
`script/notes/work-screens-2026-11-12.md` first. Content (`content/**`) is not yours; strings you
need go into `content/strings/zh.json` and `content/strings/en.json` only (both, same keys).
Do not run git. Shell: `npx tsc --noEmit -p . 2>&1 | tail -20` and `npx vitest run 2>&1 | tail -20`
only, never more than twice in a row. Report per item below, with the files touched and any
snapshot that changed for another reason.

## 1. A settlement page for the evidence board and the meeting replay

Today the clue and meeting stages end on the 提交 button (`data-action="board-print"`) in the foot.
The compare and tune stages already end on their own settlement screens; these two must too.

- The foot's button becomes `data-action="board-settle"` (label string `sheet.settle.open`,
  zh 「整理好了」 / en "Put it together"), enabled under the same condition as 提交 is now
  (`canPrint`).
- `board-settle` sets `session.workPhase = { key: ideKey(day, task), phase: "settle" }` (extend the
  `workPhase` union in `src/world/desktop/model.ts`; keep the existing `"result"` member working —
  `compare.ts` reads it, narrow with `phase === "result"` there). `board-settle-back` clears it.
  Put both actions in `src/world/desktop/workbench/board.ts` next to `tune-select`.
- While `workPhase.phase === "settle"` for this task, the clue / meeting stage renders the
  settlement instead of the board: one sheet, centred, paper look (`.st-sheet`), with a header (the
  counterpart's portrait if the stage has one, `sheet.settle.kick` 「发给{who}的」 / "Going to
  {who}", the board's title) and one row per slot: its number, its label and demand
  (`board.given.rows[slot.id]`), and the text of the card placed in it (`cardText`). Under the sheet:
  `board-settle-back` (`sheet.settle.back` 「再改改」 / "Change it") and 提交 (`board-print`, label
  `finishLabel(task)`).
- Tests: a vitest file `tests/sheet-settle.test.ts` using `tests/specimen.ts` and a day-4 or day-8
  board: the settle button is disabled until every slot is filled; after `board-settle` the output
  contains the sheet with every placed card's text and both buttons; `board-settle-back` returns to
  the board.

## 2. Drag a clipping onto a slot (the evidence board and the meeting template)

Clicking a clipping then a slot keeps working (`board-card` → `board-slot`). Add pointer dragging:
press on a `.cs-clip` (a found card), drag, release over a `.cs-slot` → the same two actions fire in
order (`board-card` with the card, then `board-slot` with the slot). Mouse and touch. While dragging,
the clipping follows the pointer (a translated clone or `transform` on the element), the slot under
the pointer gets a `drop` class, and an Escape or a release elsewhere cancels without changing the
pick. Keyboard users are unaffected. Implement in a small module `workbench/drag.ts` wired from the
desktop controller's pointer handling (`src/world/desktop/controller.ts`: find where `onClick` is
bound and bind pointerdown/move/up beside it; the drag must dispatch through the same action table,
never call the store directly). A test (`tests/drag.test.ts`) that simulates pointerdown on a card,
pointermove, pointerup over a slot and asserts the two `boardStep`s in the log.

## 3. The approval chain: swipe, slide animation, the approval moment

In `stack-stage.ts` / `board.ts`:

- Touch / mouse swipe on `.sk-grid` moves the chain (`stack-move` with the swipe's direction;
  threshold 24 px; one move per gesture).
- Tiles slide: give each `.sk-cell.on` a stable identity per move so the move can animate. Simplest
  acceptable: the grid keeps `data-prev` positions and the renderer adds a one-frame
  `transform: translate()` from the previous cell to the new one, transitioned over 120 ms (as 2048
  does). A merged tile pops (`ts-pop` is there already). No animation when
  `session.reducedMotion` is on.
- The approval moment: when the `approve` step is recorded (the top rank appears), the top tile
  pulses twice and the screen shows the approved state (`sk-done`) with the ladder's top rank lit;
  then the player goes back to the sheet with 提交 enabled (already the case — just make sure the
  stage does not flicker through an empty state).
- Tests: `tests/stack.test.ts` exists; add a case for the swipe direction helper (dx/dy → direction,
  below threshold → none).

## 4. Out of scope

No new screens, no changes to `content/**` beyond the string keys named above, no changes to the
state engine (`src/state/**`) other than nothing. If something in `src/state/days/board.ts` seems to
block you, report it instead of changing it.
