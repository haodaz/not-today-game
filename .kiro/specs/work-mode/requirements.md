# Work mode: two buttons, one way in, no way out (author, 2026-11-16)

Three decisions from the author on 2026-11-16, all HARD, all about the workbench on the left monitor:

- 「就在 workspace 里能看到一个真正的工作（包括表单区域、代码区域长什么样），但是改变它用的是当日的游戏。」
  The workspace shows the real work; the day's game is the only thing that changes it. Nothing in the
  workspace is operable on the work itself.
- 「我们每次进入这个工作台，是不是直接把 dock 的位置改成 2 个按钮："开始工作" "退出工作模式"。要不然我们很被动，
  要么自动让克总询问是否工作开始游戏，那么用户就没法探索了；要么用户就不好进入游戏状态。」 and, on keeping a
  message hint beside them: 「我觉得不需要，进入工作，完成工作，应该是一个沉浸式 one-time 的事情」.
- 「中途不能退出，开始了就做完。」

Strings are Claude's and are already in `content/strings/zh.json` / `en.json`: `work.start` (开始工作),
`work.resume` (继续工作), `work.exit` (退出工作模式), `work.allDone` (今天的活干完了). Do not add strings; a
missing one is a question for Claude. Never edit `content/`. Days 1–3 are frozen for looks (author:
「前 3 天的别改太多」): their IDE surface, compare and tune chips stay as they are; only the dock bar
and the way in change there.

## 1. The dock becomes two buttons in work mode (`src/world/desktop/shell.ts`, `desktop.css`)

- Work mode = the workbench window on the left monitor with full chrome (`session.wbFull`, the
  `dockHides` case today). In work mode the dock row is replaced by a work bar holding exactly two
  buttons: **开始工作** (`data-action="work-start"`, primary, lit like the launch page's CTA) and
  **退出工作模式** (`data-action="work-exit"`, quiet). No app tiles, no decoys, no settings tile, no
  badges, no auto-hide/peek. Outside work mode the dock is unchanged.
- The primary's label follows the day: `work.start` when today's current task has not been started;
  `work.resume` when it was started and its stage is not on screen (a page reload, the hand-in step);
  `work.allDone`, disabled, when today's work is all handed in. One label, one button; never a count.
- 退出工作模式 closes the full chrome (`wbFull = false`) and lands on the desktop with the dock back.
  It is **not rendered while a game is running** (section 3); after hand-in it is back.
- `leaveControl` (离开屏幕) stays where it is; it is also hidden while a game is running.

## 2. 开始工作 is the one way into the day's game (`src/world/room/game.ts`, `workbench/actions.ts`)

- `work-start` targets today's current task (`openWork(state, events).tree`), never a row click:
  - a board task with a `launch` page not passed yet → `launchShow` for it (the opening plays, its CTA
    `task-launch` opens the stage as today);
  - a board task already launched → `work-show` for it;
  - a task without a board (day 7's 产品方案, day 9's 计费) → its task page, as `wb-nav` opens it today,
    with the 自己做 / 让它做 modes it already has.
  This closes days 7 and 9 (meeting boards task4 / task3): a headless walk from launch → 开始工作 on
  every day 4–18 must end on a `.work-stage` (`data-screen` set) for the board task.
- Kuro's **要开始工作吗** no longer exists: clicking a task row in 工作台 opens the page to look at and
  never launches; remove the `workAsk` dialogue ending, `WORK_ASK_OPTIONS`, and the `data.launch` round
  trip in `wb-nav`. Claude removes `task.launch.ask/go/must` from strings afterwards.
- `work.show` chips in the shell's chip row go (the bar's button does it). `work.back` (回到工作台 on
  the stage header) goes too — section 3.

## 3. Once started, the game runs to its end (`workbench/compare.ts`, the stage files, `game.ts`)

- From `task-launch` until the task's `done` flag (or Kuro's take-over after a fail, the flows that
  exist today: 让克总改一稿 / 让它补全 / the game's own fail → Kuro), the stage is modal: no `wl-back`
  button, Esc does nothing, `work-hide` is not reachable, 退出工作模式 and 离开屏幕 are not rendered,
  the dock is not shown. A reload while a game is running comes back with the bar's `work.resume` and
  nothing else enabled (session state is not saved; the game restarts at its own start, as it does now).
- The hand-in (打印 / 发给老板 / the task's own finish label, `board-print`) lives **on the stage**, in
  a foot row under the board (clue stage, meeting stage, stack stage; the compare stage has it at its
  settlement already). After hand-in the stage closes by itself (the task is done), the workspace shows
  the handed-in work read-only, and the bar offers 退出工作模式 again.
- 让它补全 (`board-assist`) moves to the same foot row, beside the hand-in; it is Kuro's offer on the
  stage, never a workspace chip.
- The meeting stage gets the lock card the clue stage has (`lockRow` inside the stage): days 7 and
  15 are meeting boards with object locks (dictionary, calculator) and today the only lock control is
  in the workspace.

## 4. The workspace shows the work, read-only (`workbench/board.ts`, `shell.ts`, `meeting.ts`)

- The board surfaces drawn in the workbench (table view, meeting view; the IDE view on days 1–3 is
  untouched) render with **no operable control on the work**: no `board-slot`, `board-card`,
  `board-lock`, `board-kuro-lock`, `board-assist`, `board-print`, `board-code` buttons. Cells show the
  live state (`boardState`): a filled slot as its card text, an empty slot empty, a locked given
  column as locked. `renderBoardRead` is the shape; keep the `surface board` class names and the
  `.btable` / `.blabel` / `.bslot` / `.filled` / `.target` structure so the sheet styling in
  `desktop.css` (2026-11-16) still applies; `.target` is the slot the game would fill next.
- The shell's chip row under the talk column loses `board-assist`, `board-print` and `work-show`; the
  tune chips (days 2–3) and compare's finish stay.
- The talk column (the bubbles) is Claude's content and is rewritten separately; keep its markup.

## 5. Nothing from outside reaches into work mode (`src/world/loop/*`, `shell.ts`)

- While work mode is on, the dock shows no badges (there is no dock), the other monitor's tab shows no
  badge, and the dialogue box does not surface new TingTalk / 喂信 arrivals or timed afternoon lines;
  they are delivered when 退出工作模式 is pressed. Phone calls are not held (a call is an interruption
  by design). The story clock keeps moving as it does now.

## 6. Tests and cleanup

- `tests/shell.test.ts`, `tests/meeting.test.ts`, `tests/drag.test.ts` assert workspace `board-slot` /
  `board-assist` buttons: change them to assert the read-only surface and the stage's foot row.
  `tests/ide.test.ts` (days 1–3) stays. Add: the two-button bar in work mode and the plain dock outside
  it; `work-start` resolving launch / show / page for the three task shapes; no `wl-back` and no exit
  while a game runs; a headless-free unit check that every day 4–18's board task opens a stage from
  `work-start`.
- Snapshot tests change for markup only; Claude refreshes them after checking the diffs.
- Do not touch `content/`, `script/`, the replay driver, or strings. Commit nothing; Claude reviews
  and commits.

Out of scope: the chat column's wording (Claude), the days 7/9 seating drawing, days 1–3 looks.
