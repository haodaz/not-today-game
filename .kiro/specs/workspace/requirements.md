# workspace — requirements (2026-11-04, author)

"你现在其实是在 home，workspace 原本说话的多行文本框 UI 给改没了。我们真的进了某个任务，应该是咱俩现在的这种页面，侧导航会多一条对话记录进去干活。你让 kiro 不要把它堆在首页这么小小的空间。" / "老物件不要单独一列，做任务的时候才出现就行。" / "侧面导航都收起来了，却又搞了一个展开的导航，很奇怪。"

The workbench (工作台 app) becomes a chat-app shape, like the Claude app the author works in: a rail, a session list, and one main area that is either **home** or **a task**. Boards (table / ide / meeting views) only ever render on a task page.

## R1. Two kinds of page
- **Home** (`wb-nav home`): the greeting, then the **composer**: a multi-line text box with the starter chips under it (today's starters and continue chips as today), sending to Kuro as today. Then today's cards (在办 / 文档 / 账本 / …). No board, no task content on home.
- **Task page** (`wb-nav task:<taskId>`): the whole main area belongs to that task: a header (task title, who it is for, status: 在办 / 已交) and the task's body: its board in its view, filling the width and the height below the header. A task without a board shows its existing work surface (doc / ledger / code) the same way.
- Opening a task (a 在办 card, a message's task link, a checklist link, Kuro's "open" action, the auto-day driver's selectors) goes to its task page.

## R2. One navigation: rail + session list
- Keep the rail (消息 · 工作台 · 文档 · 审批 · 通讯录).
- Replace the second, expanded nav column (工作台 / 新任务 / 文档 / 代码 / 账本 / 工单 / 项目 / 在办的事 / 最近) with a **session list**: at the top 新任务 (goes to home, focus in the composer); then **今天**: one entry per task the player has opened today (title, a dot for 在办 / 已交), newest first, the current one highlighted; then **最近**: tasks from earlier days (open read-only). An entry appears the first time the task is opened (derived from today's `open` events of the task; no new event kind).
- 文档 / 代码 / 账本 stay reachable from the rail and from inside the tasks that use them; they are no longer nav items of their own.

## R3. Old objects only while working
- The object bar is not a permanent column. On a **task page** it is a compact strip of icons in the task header (same states: own / -up / -taken, placeholders; a click is 使用 over the desktop as today). On home it is not shown. The board lock's 用{object}看一眼 keeps working (it opens the object as today).

## R4. The IDE on a task page
- Columns: pages + sources ≈ 260 px · preview flex (takes the rest, never under 50 % of the main area) · Kuro ≈ 320 px. Full height under the task header. The deliverable inside keeps its own 代码 toggle.

## R5. Strings (Claude adds): `wb.sessions.new`, `wb.sessions.today`, `wb.sessions.recent`, `wb.task.for`, `wb.task.doing`, `wb.task.done`, `wb.composer.placeholder`.

## R6. Tests
- Home renders the composer and cards and no board; a task page renders its board and header and no composer.
- Session list: empty today → only 新任务; opening task A then B → B, A under 今天; earlier days under 最近; the current one highlighted; no expanded nav column.
- Object strip on a task page only; the lock still opens its object.
- IDE columns on a task page (preview at least half of the main area).
- Existing navigation tests that used the old nav column are updated; play-through selectors keep working (`data-action=wb-nav` with `data-page=task:<id>`).
