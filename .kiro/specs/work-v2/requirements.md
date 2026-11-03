# Work v2: a task is several steps, its result lands on the desk, the hand collects it (author 2026-11-03)

Design: `script/notes/机制设计稿-干活.md` (v2 补充). The author: 「上班就是游戏」; every task has a skeleton — **gather material → use an old object → assemble the result in a carrier → Kuro can step in at every step** — about a dozen operations; the result appears on the real desk; at night it is handed to the hand; one judgement a night moves only SAN, and **the best a night can do is nothing: you live another day**.

This segment builds **one sample task end to end**: day 7 `task4` 「对比一下。明天早上要。」 (the call's night task, already in content), with its board in `.kiro/specs/work-v2/board-day07.json` (use that file as the test fixture; Claude adds it to content after this lands). Other tasks keep working exactly as today.

## 1. Content shape (strict loader, `src/state/days/tasks.ts`)
A task may carry, instead of the three-path tree, a **`board`**, a **`deliverable`** and a **`judge`** (shapes in the fixture). With a `board`, `start` / `self` / `look` / `let` are optional and unused.
- `board.kind`: `"table"` (rows with a label, a given column, and one slot) — the only kind this segment. `columns` are display headers.
- `board.given.rows[slotId]`: the text in the given column of that row; `board.given.lock` (optional) locks the whole given column behind an **old object**: `object` (which one), `codes` (what that object shows), `answer` (the right one).
- `board.slots[]`: `id`, `label`, `answer` (a card id).
- `board.cards[]`: `id`, `text`. Cards are the material tray; one card fits one slot.
- `board.kuro.fill`: slot → card id it would put there; `board.kuro.cards[]`: its own cards (only it can place them); `board.kuro.unlock`: what it answers for the lock.
- `deliverable`: `id`, `label`, `img` (optional; a missing image shows a plain paper thumbnail).
- `judge`: `perfect`, `flawed`, `wrong` (SAN deltas, ≤ 0), `wrongAt` (this many wrong slots or more = wrong).

## 2. The board in 工作台 (a new surface, `src/world/desktop/workbench/board.ts`)
Opening a task with a `board` shows it in the work pane: the title, the table, and under it the **tray** of cards (`board.tray` header).
- **The lock**: while the given column is locked its cells show `▒▒▒▒` and one control `board.lockCode` 「需要提取码」. Clicking it:
  - if the lock's object is found (`state.found`) and not taken by Kuro (see §5): the object's codes appear as three chips (「BP 机上滚过的数字」); picking the right one unlocks the column; a wrong one shakes and stays locked. The right code is somewhere in today's material (Claude puts it in the boss's message).
  - if not: `board.noTool` 「你手边没有能收这个的东西」 and a chip `board.kuroTry` 「让它试」: Kuro unlocks it with `kuro.unlock` (always right) — this counts as one **assist**.
- **Filling**: click a card, then a slot (or drag); a slot shows its card; click a filled slot to send the card back to the tray. Kuro's own cards never appear in the tray.
- **Kuro, at any time**: `board.assist` 「让它补全」 fills every empty slot from `kuro.fill` (its own card included where it says) and unlocks the lock if still locked; one **assist**. A Kuro card in a slot looks like any other card (no highlight); the player can send it back like any card (it then disappears, it is not in the tray).
- **Print**: `board.print` 「打印」, enabled when every slot is filled and the lock is open. It completes the task: the existing `task` event with the task's `done` flag, plus `slots` (slot → card) and `assists` (count). Mode in the event: `"self"` with no assist, `"let"` otherwise.
- All of this is derived from the log on reload (the lock state, the slots and the assists are events, or one `boardStep` event per action — Kiro's choice, recorded in the log).

## 3. The deliverable on the desk
After printing, today's deliverable is **on the desk** (the 桌子 view shows it at a free spot with `deliverable.img` or a paper thumbnail and its `label` as the hover name; it is also in the 道具 strip). It stays until it is given to the hand or the day ends.

## 4. The hand collects it (`src/state/nights.ts`, the shutdown beat)
- On a raid night, if today's deliverable is on the desk, the shutdown choices get one more, **first**: `hand.give` 「把{label}递给它」. Choosing it logs `give` with the deliverable id; the deliverable leaves the desk; the other raid choices stay as they are.
- **The judgement** (pure, from the log): count slots whose card ≠ `answer` (a Kuro card is wrong too).
  - given and 0 wrong → `perfect`;
  - given and 1 ≤ wrong < `wrongAt` → `flawed`;
  - given and wrong ≥ `wrongAt`, or **not given by the time of 躺下** → `wrong`.
  SAN changes by the judge's delta (never up). One narration line: `hand.judge.perfect` / `flawed` / `wrong` (Claude has added them).
- A day without a board task has no judgement (unchanged).

## 5. Old objects taken by Kuro (only what this task needs)
If the lock's object is upgraded and its invasion level is 3 (object-upgrade spec), it counts as **not available** for the lock (Kuro is inside it). Below 3 it works.

## Strings (Claude has added them, zh and en)
`board.tray`, `board.lockCode`, `board.noTool`, `board.kuroTry`, `board.assist`, `board.print`, `board.pagerCodes`, `hand.give` (`{label}`), `hand.judge.perfect`, `hand.judge.flawed`, `hand.judge.wrong`.

## Files
`src/state/days/tasks.ts` (loader), `src/state/events.ts` + the reducer (board steps, `give`, the judgement's SAN change), a new `src/world/desktop/workbench/board.ts`, `src/world/desktop/workbench/work.ts` (open a board task), `src/world/desktop/desktop.css`, `src/world/room/hud.ts` (the deliverable on the desk and in the strip), `src/state/nights.ts` + where the shutdown choices are built (the give choice), tests in a new `tests/work-board.test.ts`.

## Tests (with the fixture)
- Loader accepts the fixture shape and rejects: unknown keys, a slot answer that is not a card, a `kuro.fill` card that is not a card or a Kuro card, a lock answer not in its codes.
- Lock: with the pager found, the wrong code keeps it locked, the right one opens it; without the pager, 让它试 opens it and counts one assist.
- Filling and print: print is disabled until all six slots are filled and the lock is open; printing logs the task done with `slots` and `assists`; the deliverable is on the desk.
- 让它补全 fills every empty slot as `kuro.fill` says (r6 gets k1) and opens the lock; sending k1 back removes it from the board, not into the tray.
- Judgement: all right and given → SAN unchanged; k1 kept → `flawed` (−3); three wrong → `wrong` (−8); printed but not given by 躺下 → `wrong`; SAN never goes up.
- Replay: the same log rebuilds the same board, desk and SAN.
