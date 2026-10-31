# desktop-ui — requirements

Written by Claude with the author, 2026-10-31. Kiro writes design.md and tasks.md and implements. Design reference: `design/desktop/*.html` (static HTML/CSS mocks drawn by the author and Claude; treat them like Figma: match layout, tokens and copy; do not import them as code).

## 1. What it is

The two monitors share one desktop. The desktop has exactly three things: **消息** (messages: private chats, the company group, 朋友圈), **工作台** (the workspace the player wrote for the company; Kuro works inside it), **浏览器** (the outside world: one news page per day). Plus two desktop-level things that belong to no app: Kuro's **small window** (private chat, light theme, bottom-right) and Kuro's **body** (a desktop pet that crawls and changes state).

Day/night: in the day beats the desktop is light. In the night beat the desktop stays, but every app shows a closed plate ("今天的工作看完了。不想再看了。") and only the small window glows (see `design/desktop/night05.html`).

## 2. Functional requirements

### FR1. Shell
- Top bar: brand, current app, `第 N 天 · 时段 HH:MM`, weather glyph, Kuro status dot. Dock on the left monitor only: 消息 / 工作台 / 浏览器 with badges. Windows are positioned per mock; no free dragging needed for the hackathon.
- All copy comes from `content/strings/zh.json` (fallback en.json). No story string in `src/`.

### FR2. 消息
- Conversation list (boss, partner, group, xiaozhang, laozhou; family in its own section) with avatar, last preview, time, unread count. Group members appear as `member` with generated neutral avatars.
- Conversation view: bubbles, voice-note rows (`[语音] 41″` + 转文字 block), cards (`[卡片] …`), `已读`, `正在输入` that can end in nothing, `[撤回了一条消息]`, `[该账号已注销]`.
- Reply bar: the fixed menu from `replyOptions` (labels from strings), plus object-lent words, plus a `free` text input only where the day's table has a `free` entry for that recipient. Greyed (`gone`) words render struck-through and show their `inner` line when hovered/tapped.
- Sending a word consults `content/replies/day-NN.json` (see the `replies` spec) and plays the result: reply lines with timing, read receipts, interrupts in another conversation, and the italic inner line.
- `incoming` messages for the day are delivered at their `t` within the day's beats (or all at boot if the player skipped time).
- 朋友圈 is a scrollable feed from content; it never issues tasks.

### FR3. 工作台
- Home per `design/desktop/wb-home.html`: sidebar (首页 / 新任务 / 文档 / 代码 / 账本 / 工单 / 项目; 在办的事; 最近; 你), greeting with Kuro's face, one input with three modes (`自己做` / `让它做，我看一眼` / `让它做`), cards (在办, 文档, 账本, 此刻, 更新日志), 常做的事, 接着昨天的.
- Inner pages: 文档 (two versions side by side, player highlights in yellow/blue, Kuro's diff in green/red; actions 并排 / 看一眼 / 让它合并), 账本 (应收 with the +1/day number, 工资 with the player's row, 模型费用 row visible only to the player), 代码 (file view + 更新日志 panel that becomes a single horizontal line from the day stages.json says).
- Every work task is a hand-written quick-reply tree from `content/tasks/` (not an LLM). The three modes map to the task-tree branches; `让它做` without `看一眼` increments `letItDoUnchecked` and the credits log.
- The 此刻 card shows only live state the game really has (first keystroke time, water poured at, times lain down) and lines from `content/kuro-days/`. Never login inputs.

### FR4. 浏览器
- One page per day from `content/browser/day-NN.json` (Claude will write; until then show day 1 placeholder from the mock copy). Newspaper layout per `design/desktop/browser.html`. Optional to open; opening is logged as an event (Kuro's rubric may cite it).

### FR5. Kuro's small window and body
- Small window: light theme, always on top, present in every beat including night. Shows the chat beat (see assistant spec): memory, 3–4 starter questions from `content/kuro-days/day-NN.md`, turn counter `今天 n/5`, the constant bedtime line after the fifth turn.
- Body: a sprite with states idle / busy / think / happy / rest / crawl, two frames each from `public/kuro/` (aligned PNGs); transitions are opacity crossfades with ease (never hard cuts), plus a slow bob. State is derived from the store: busy while a task runs, think while waiting for the player, happy when the player says 漂亮, rest in the night beat, crawl when moving between the small window and the active window. It never blocks clicks.

### FR6. Corruption layers (ring)
- The desktop reads `ring` for the day from stages.json and turns on one layer per ring: `software` (content only: missing line, odd timestamps), `screen` (CSS variables: tint, pixel drift, blur; one shop name typo in the phone), `desk`/`wall`/`room`/`door` are handled by the room scene, not the desktop. `calmDaytime` days render the desktop as ring `software` in day beats only.

## 3. Non-functional
- Pure views of the store; no app writes state directly; they emit events.
- Works at 1440×900 per monitor, both monitors visible side by side in the room scene; also a "focus one monitor" view.
- Snapshot tests for each app at day 1, day 10 (calm), day 13 (ring room), night beat.

## Amendment 2026-11-01 (author): one monitor at a time
The desktop view never splits the viewport between the two monitors. It shows **one monitor at full size** (1440×900 fitted to the viewport, aspect kept) and switches between left and right: a small 左屏 / 右屏 toggle at the top edge, keyboard ← →, and the dock/app badges of the other monitor still visible as a thin tab on that side. The two-monitors-side-by-side layout exists only inside the 3D room view (room-scene), where both screens are seen on the desk. Default on open: the monitor that has the current app (messages on the left for day 1 morning).
