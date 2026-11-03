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

## Amendment 2026-11-01 (author): the small window must not cover the desktop
- Default state while working: **folded** to a pill next to Kuro's body (its face + the first few words of its last line). Click to expand; click outside or Esc to fold.
- When Kuro has a new line: expand for 6 s, then fold unless hovered or the player typed.
- In the evening chat beat (after shutdown) it stays expanded.
- Expanded, it must never overlap the active app's input area or reply bar: if its default bottom-right position would, it docks to the top-right of the monitor instead. The body (sprite) always stays visible.

## Addition 2026-11-01 (author): faces in 消息
The coloured letter squares were placeholders. Every conversation and every speaker that is in `content/npc.json` shows its **avatar image** (`avatar`, a 256 px square served from `public/npc/`) in the conversation list (38 px, radius 10) and on its bubbles (30 px, radius 8); the letter and the colour classes go. The player's own bubbles keep the neutral square. `member` (company group) and anyone else without an entry get one of the **silhouettes** listed in `npc.json`, chosen stably by name hash (same person, same silhouette, every day), drawn on the same light grey. The family conversation's avatar is the mother (`family` in `npc.json`); the father has his own entry for the day he speaks. Snapshot the list and one group transcript; add a property test that no `.av` renders a letter any more.

## Addition 2026-11-01 (author): two family groups
The 家里 section holds two conversations, both groups:
- **爸妈** (`family`, `content/replies/family.json`, name `msgs.family`): the parents' group. An unprefixed incoming line is the mother; a line prefixed `father：` is the father (`father` in `npc.json`); reply lines carry `who: "family"` (mother) or `who: "father"`. Avatar in the list: the mother's.
- **相亲相爱一家人** (`clan`, `content/replies/clan.json`, name `msgs.clan`): the big family group. Same file shape as `family.json` (`{ _note, days: { "1": { incoming, <word>: entry } } }`); generalise `parseFamilyFile` so both files go through the same parser, and `labelKey` treats `clan` like a work conversation (`reply.<word>`; new word `thanks`, string `reply.thanks`). Every line is prefixed with a relative's name (大姨 / 二舅 / 小姑 / 表弟 / 堂姐 / 姥姥) and has `who: "member"`; they are not in `npc.json`, so each gets a silhouette by name hash (same name, same silhouette, every day). Avatar in the list: a silhouette too.
- **Prefix resolution** (applies to every group): a `名字：` prefix that equals an NPC's display name (`msgs.<id>`, e.g. 老周) or an NPC id (e.g. `father`) renders that NPC's name and avatar; any other prefix renders as written with a silhouette. No letters anywhere.
Snapshots: the list with both family groups; day 1 and day 14 of `clan`; day 6 of `family` with the father's voice line.

## Correction 2026-11-02 (author): the dock is icons, not words
"桌面上的 app dock 就是一行英文单词，3 个颜色的按钮，念起来很奇怪。" The three coloured tiles with their names go. The dock shows three monochrome icons from `public/os/msgs.svg`, `workbench.svg`, `browser.svg` (64 px tiles, grey-blue glyphs on a light tile: bubble, table, globe; the dull system a company installs on everyone's machine). No text under or inside them. The app's name (`desktop.app.*`) is the tile's `title`/`aria-label` only. The open app's tile has a small dot under it, nothing else. The right monitor's small 工作台 tab keeps its text. From the ring `desk` on (day 7), the corruption rules that already move things by a few pixels apply to these tiles exactly as to any other control. Snapshot the dock on day 1 and day 7.

## Addition 2026-11-02 (author): decoy apps on the dock
"加几个常见的，让屏幕感受更真实，垃圾桶什么的。" `content/dock.json` (strict loader, Claude owns) lists decoy apps that sit on the dock after the three real ones, in file order, same tile style, icons in `public/os/`. None has a function:
- Clicking one opens a small system window on the current monitor (same chrome as the real apps, one centred line of grey text from `window`, a close control) **and/or** makes Kuro say the matching `kuro` line (first entry whose `days` range covers today) in its HUD bubble, the one that greets, for 6 s; the line is appended to today's chat history as a Kuro turn without counting towards the daily turn limit. An app with `gone.fromDay ≤ today` keeps its tile but opens the admin notice instead, and Kuro says nothing.
- The decoys never appear in the checklist, never log an event, never change state. Click logging is session-only.
- The real apps keep their positions; the decoys come after a thin separator. Day 13 on (ring room), the corruption rules move decoy tiles too, like any control.
- Tests: loader strict; `dockFor(day)` snapshot days 1, 7, 13 (Claude tile: line 1, line 2, gone); clicking a decoy produces no event; the Kuro line does not consume a turn.

## Addition 2026-11-02 (author): 消息 looks like WeChat desktop
The author sent three screenshots of WeChat for Mac as the reference (not to copy pixel for pixel; the feel). What to take:
- **List row**: 48 px avatar (groups: a 3×3 mosaic of member avatars/silhouettes, not one icon), name in 15 px, time right-aligned in grey, second line = `sender: preview` in grey with the sender's name before a colon, `[Photo]` / `[Link]` / `[Voice]` / `[Channel]` / `[File]` tags in brackets, an unread **red dot on the avatar's corner** (count only when > 1), a muted-bell glyph on muted groups, `[@All]` in red when mentioned. Selected row has the green fill, white text. Search box with a magnifier at the top, a ⊕ beside it.
- **Conversation header**: name and member count 「群名 (17)」, three glyphs on the right (chat, call, …). A `↑ N new message(s)` pill at the top right when scrolled up.
- **Bubbles**: sender name in small grey above the bubble (groups only), avatar left, light grey bubble with a 4 px tail, time stamps centred between gaps (`Saturday 20:56`, `10/26 04:06`).
- **Article card** (what a forwarded link renders as): white card, bold title (two lines max), grey excerpt three lines, a square thumbnail at the right, and a footer line with the official account's glyph and name. `content/replies/clan.json` links get `card: {title, excerpt, account}` (Claude adds; thumbnail from `public/cards/`), falling back to today's `[链接] 文字` when absent.
- **Video card**: a 9:16 black card with a still, a centred play circle, and the channel name with the glyph at the bottom left. Same content fields with `kind: "video"`.
- **Composer**: a tall white input, a toolbar of five glyphs (emoji, box, folder, scissors ▾, mic) and a grey 「Send」 at the right; our reply chips sit above the input as today.
- Colours stay ours (the grey-blue system), the green only on the selected row. Snapshot the list and a clan conversation with one article card and one video card.

## Correction 2026-11-02 (author, evening): work in the work app, home in the home app
"工作软件和类似微信的东西最好别放在一起，有点怪。工作软件更类似钉钉之类的." Today 消息 holds the work conversations and the family ones side by side. Split:
- **工作台 (the company's system, DingTalk-like)**: a left rail 消息 / 工作台 / 文档 / 审批 / 通讯录 (strings `wb.nav.*`, Claude adds). Its 消息 holds the work conversations only: boss, partner, the all-hands group, xiaozhang, laozhou (the same `content/replies` tables, same reply chips, same NPC faces). 工作台 is today's workbench home and tasks; 文档 / 账本 / 工单 / 项目 as today; 审批 is the place where upgrade offers and the day-13 upgrade notice also appear as items (content later); 通讯录 lists the NPCs with faces and the silhouettes (presentation only). The grey-blue system look stays; no green.
- **消息 (the personal app, WeChat-like per the reference screenshots)**: only 家里 (parents' group, the clan) and 朋友圈. The list, bubbles, cards and composer per the WeChat addition above.
- Unread dots: each app's dock tile shows its own count. Nightfall's "chat with Kuro" is unchanged (Kuro is neither).
- `labelKey` and the reply tables are untouched; only which app shows a conversation changes (by recipient: boss/partner/group/xiaozhang/laozhou → 工作台, family/clan → 消息).
- Tests: snapshot 工作台·消息 and 消息 on day 1 and day 13; property: no conversation appears in both; the clan and family never appear in 工作台.

## Addition 2026-11-02 (author): Vivi's deliverable locks the screen until opened
When Vivi posts a deliverable in the all-hands thread (a message of kind `deliverable` carrying a `doc` id that opens in the browser app: her HTML 方案 or a PRD), every app/page switch on 屏幕 is refused until the player has opened that document once. The refusal is a box line, string `vivi.lock`: zh 「你必须点开来看看，否则她会揪着这个事儿不放。」 en "You have to open it and look, or she will never let it go." Opening it (the browser app shows the page) logs `open` with the doc id and lifts the lock; 回房间 is still allowed (the lock is about the screen, not the room), but the lock is back when the player returns to 屏幕. Content: the deliverable messages and docs are Claude's (script/drafts/vivi/*.html go to `public/docs/vivi/`). Tests: the lock engages on the message, refuses wb-nav / app switches with the line, lifts on `open`, survives reload (derived from the log).

## Correction 2026-11-02 (author, from the day-4 English screenshot)
1. **The system bar is the OS, not the company.** 「未来智能 · 工作台」 currently sits in the top bar over every app, so the workbench looks like the outer layer of the whole computer. The top bar shows the OS name (string `shell.brand`, Claude renames it to the 新世界 OS) and the *current app's* title; the workbench's own brand line (未来智能 · 工作台) lives inside the workbench window only.
2. **Apps must be recognisable at a glance.** The dock's monochrome line icons are replaced by coloured, recognisable ones (Claude supplies `public/os/*.svg`: 消息 green bubble, 工作台 blue grid, 浏览器 compass, Claude the orange asterisk, 文件 blue folder, 回收站 grey bin, 设置 grey gear, 日历 red-white calendar). The dock shows each app's name under or on hover of its icon (`dock.*` strings exist). The row of empty circles/squares under the canned replies in 消息 (the tool strip placeholders) is removed until each has a function.
Tests: the top bar snapshot carries the OS name and the app title; the workbench brand appears only inside the workbench; dock icons reference the new files and have accessible names.

## Addition 2026-11-02 (author): 文件, 回收站 and the work are linked
- **文件** is a real folder tree, from content (`content/files.json`, Claude): `合同/` holds v1–v17 of the contract (v16, v17 are the day-1 pair; v18+ appear as the days produce them); `下载/` holds what Vivi posted once the player opened it (her HTML 方案, the PRD), re-openable any time ("继续瞻仰"); `导出/` holds what the player exported. Opening an early version plays a one-line fragment from content, e.g. v1–v5 「你不太想点开看了。看太多遍，都不太认识字了。」; each file may carry its own `onOpen` line. Opening a file logs `open` with the file id (the Vivi lock reads the same event).
- **回收站** holds what was deleted or replaced: the clause Kuro rewrote (the old text), 小张's leaving message after day 13, the pre-merge versions; items can be opened but not restored before day 16; from day 16 the bin is empty and the strings say 「已清空」.
- Tests: the tree renders from content; opening a file logs the event and plays its line once per day; the bin's contents follow the day; nothing in 文件 is invented by code.

## Addition 2026-11-03 (author): shared things must look like what they are
Today every shared thing is a line of text (「[卡片] …」「[链接] …」「[图片] …」) drawn as the same grey box, so an article, a video, a chat history and a vote link look identical. In both apps they must be recognisable at a glance, the way they are in WeChat and DingTalk.

- **Content shape** (replies, family, clan, group; Claude migrates the existing lines): a message may carry `card: { type, … }` next to its `text` (the text stays as the fallback and for the list preview). Types and fields:
  - `article` (公众号文章): `account`, `title`, `digest?`, `cover?` — WeChat look: title bold on top, digest two lines grey, square cover on the right, account name + small avatar at the bottom.
  - `video` (视频号 / 短视频): `account`, `title`, `cover?`, `duration` — a vertical 3:4 cover with a play triangle in a circle, duration bottom-right, account and title under it.
  - `history` (聊天记录): `title` (e.g. 「群聊的聊天记录」), `lines: string[]` (up to 4 shown) — white card, title, grey lines, a thin rule, 「聊天记录」 at the bottom.
  - `link` (网页): `title`, `site`, `icon?` — title two lines, site name small, a square favicon on the right.
  - `image`: `src` (under `public/msgs/`), `alt` — the picture itself, rounded, max 240 px wide; missing src = grey placeholder with alt text.
  - `file`: `name`, `size`, `ext` — file-type icon (pdf red, doc blue, xls green, html orange), name, size.
  - `mini` (小程序: 投票 / 砍一刀 / 拼团): `brand`, `title`, `cover?` — the mini-program card with a coloured brand strip at the bottom.
  - `voice`: `seconds` — the voice bar, width by length, seconds at the end (already exists; keep).
  - `task` (工作台 only, DingTalk work card): `title`, `fields: [[label, value]]`, `action?` — blue header strip.
- **Two registers**: 消息 draws them WeChat-style, 工作台's message pane DingTalk-style (same data, the work card shape and blue accents there). A `forwarded: true` flag adds the small 「转发」 label.
- **Covers**: Claude supplies a small set of generic covers in `public/msgs/covers/` (news, short video, chart, food, cat, family photo, certificate); a card without `cover` uses a neutral tile by type, never an empty box.
- Tests: the loader accepts each type and rejects unknown fields; each type renders its own markup in both apps (snapshot one of each); a message without `card` renders as today.
