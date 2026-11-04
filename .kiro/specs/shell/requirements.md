# shell — requirements (2026-11-04, author; replaces the ide-layout draft)

"咱们是左：文件浏览器，中：对话；右：应用区（比如代码、preview、文件内容展开），一个通下来或者 2 个 share 都有，文件浏览器也可以缩起来。它其实是某种大关系不变、小窗口可以收起展开的模组式……关系上其实对话是最外层的窗口。可以只剩对话。其他框都比对话的大 border 缩进一圈。"

**The model is the Claude desktop app (Code tab), light.** One shell for every task page, every day: the conversation with Kuro is the page; the explorer (left) and the app panes (right) are inset cards that open and close around it. Only what is inside the panes changes from day to day (table / IDE / meeting). No new interactions: the board's existing ops and actions (pick a card, click a slot, drag, Kuro fill, print, send, lock) are reused as they are.

## R1. Layout (task page `task:<id>`; home unchanged)
```
┌rail┬───────────────────────────── task page (conversation = the outer frame) ─────────────────────────────┐
│ 64 │ header 48: [⊟] 任务标题 · 交给 X · 在办            [🗂 files][🌐 预览][</> 代码][▦ 表格][▶ 会议] │
│    │ ┌explorer card┐   conversation column              ┌ pane card (one, full height) ──────────────┐ │
│    │ │ ▾ 页面 / 格子 │   (max 720 wide, centred in        │ 40 header: icon · title · tabs   ⤢  ×      │ │
│    │ │   …  ●       │    the space left between cards)   │ body                                       │ │
│    │ │ ▾ 素材       │   Kuro lines left, mine right      ├ 8 gap ─────────────────────────────────────┤ │
│    │ │   …          │                                    │ second pane card (optional, stacked)       │ │
│    │ └──────────────┘   [ composer: 让它补全 · 打快照 ]    └────────────────────────────────────────────┘ │
└────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Parameters (px unless noted):
- **Conversation frame** = the whole task page area right of the rail: background `#FAF9F7`, no inner border. It is always there; with every card closed it is the only thing left.
- **Inset cards** (explorer and every pane): `margin: 8` from the frame edges and from each other, `border: 1px solid #E7E5E0`, `border-radius: 12`, `background: #FFFFFF`, `box-shadow: 0 1px 2px rgba(0,0,0,.04)`. Card header 40: 13 px medium title, icon 16, right-side buttons ⤢ (maximize: the card takes the whole frame minus 8 margins, the conversation hides behind it; ⤢ again restores) and × (close).
- **Header (48)**: left `⊟` toggles the explorer; then the task title (15 medium), `交给 X`, the status chip (在办 amber / 已交 green). Right: the pane toggles, icon buttons 32×32, radius 8, inactive transparent with `#6B6B6B` icon, active `#E3ECFA` background with `#2F6FEB` icon, a tooltip with the pane name. Only the toggles that this task has appear (R3).
- **Explorer card**: width 248, full height under the header, collapsible to 0 (`⊟`). Tree look (VS Code): folder rows 28 high with ▾/▸, file rows 26, 13 px, 8 indent per level.
- **Pane area**: width 46 % of the frame (min 480, max 900) when at least one pane is open; 0 when none. One open pane = full height. Two = stacked, the first 56 %, the second the rest, 8 gap. At most two: opening a third closes the one opened earliest. The conversation column takes the remaining width (min 380; below that the explorer collapses first).
- **Conversation column**: centred, max width 720. Kuro: plain text, 14 px / 1.65, `#1F1F1F`, its 20 px portrait at the left of its first line in a run. Me: right-aligned bubble `#F0EEEA`, radius 18, padding 10×14. Lines wrap; never clipped. Composer at the bottom: radius 16, border `#E5E5E5`, white; inside it the board's action buttons as chips (`让它补全`, `打快照`, the send step when printed). It is not a free text box on task pages.
- Type: system UI font; code 12.5 px `SF Mono, Menlo, monospace`. Everything light; no dark panel anywhere.
- Open / closed / maximized / explorer state: session only, per task; defaults per view on first open (R3).

## R2. Explorer (every board)
- Folder **页面** (`board.ide.pages`) for an IDE board, or **格子** (`board.slots`) for table and meeting boards: one row per slot, in slot order; IDE rows are file names from `ide.files[slot].name` (R4), table / meeting rows are the slot labels; an unfilled slot has a `●` on the right (like an unsaved file). Clicking a row selects that slot (and, for IDE, opens its file in 代码 and moves 预览 to its page).
- Folder **素材** (`board.ide.sources`): the tray cards as rows (found = normal; not found = greyed, the tray's own rule). Click selects a card (highlighted row) as the tray does today; then clicking a slot (in the explorer or in a pane) places it; drag works too.
- The lock (if any) is a notice row at the top of the explorer, its object button as today.

## R3. Panes per view (what the toggles open)
- `view: "ide"`: 🌐 **预览** (browser chrome: a tab with the deliverable's `<title>`, an address line `…/space.html#<page>`, the iframe of `ideSrc`) and **</> 代码** (an editor tab with the open file's name, line numbers, the file's code, the slot line drawn as an inline field: empty = highlighted blank, the click target; filled = the card text as a string literal with a green `+` in the gutter). Default: both open, 预览 above 代码.
- `view: "table"` (default view): **▦ 表格**: the board's table exactly as today (given rows, slots, print). Default: open.
- `view: "meeting"`: **▶ 会议**: the meeting view as built (tiles, subtitles, controls); its slot rows / seats move into the explorer's 格子 folder (R2). Default: open.
- Every board also has 🗂 **文件**: the content of a 素材 card's source when the player clicks the small ↗ on a found card (the file's text, or the conversation lines) — read only, same data the 文件 / 消息 apps show. Default: closed.
- Tasks without a board keep their current surfaces (doc / ledger / code) as one pane of their own, default open.

## R4. Content: the code of each IDE page
`ide.files: Record<slotId, { name: string, code: string[] }>`: every slot has one; `code` has exactly one line containing `{{slot}}`, where the field is drawn. Loader rejects a missing file for a slot, a file for an unknown slot, zero or several `{{slot}}` lines, an empty name. en files carry their own names and code (same keys). Claude writes day 1's files after this lands; tests use a fixture.
`ideSrc` becomes `theme=light&pane=preview&c=<page of the selected slot>&fill=<slot:card,…>` (always `fill=`). Selected slot default: the slot filled last, else the first. The deliverable already supports `pane=preview` (hides its own code column).

## R5. The conversation per view
- IDE boards: `ideTranscript` as today.
- `beats` are allowed on every view (loader: same rules as IDE beats). A board without beats shows one Kuro line: the board title, then the ops' Kuro lines that exist today (assist, lock, print), in log order.

## R6. Strings (Claude adds): `pane.explorer`, `pane.preview`, `pane.code`, `pane.table`, `pane.meeting`, `pane.files`, `pane.maximize`, `pane.close`, `pane.explorer.toggle`.

## R7. Tests
- Task page: conversation always rendered; explorer and panes are inset cards; ⊟ hides / shows the explorer; closing every pane leaves the conversation alone; ⤢ maximizes a pane and restores it.
- Toggles: only this view's panes appear; defaults per view; two panes stack, a third replaces the earliest.
- Explorer: 页面 / 格子 rows with `●` on unfilled; 素材 greyed when unfound; select card → click slot in the explorer or in a pane places it (same op as today).
- IDE: preview chrome + iframe `src` = `ideSrc` (light, pane=preview, selected slot's page); 代码 shows the selected file with line numbers and the slot field; filling shows the `+`.
- Table and meeting views render inside their pane; their play-throughs still pass.
- No dark class anywhere in the shell.
- Home unchanged; the session list behaves as before.

## R8. Correction after the first look (2026-11-04, Claude in the browser at 1600×900)
The explorer was hidden on day 1 (the frame is under 1140 px with panes open, so the container query hid it), so the 素材 could not be picked at all. Cause: the session list (新任务 / 今天 / 最近) still takes ≈200 px on task pages. The author asked for it earlier: "任务列表应该和侧导航一起收起来了呀".
- On a task page the session list is **hidden by default**; the rail keeps its icons. A toggle button at the top of the rail (sidebar icon, `wb.sessions.toggle`) shows / hides it (session only). Home shows it as today.
- The explorer is **never auto-hidden** while the session list is hidden; only ⊟ / × hide it. If space is short, the pane area shrinks to its min (480) first, then the conversation to its min (380).
- Kuro's open beat must not say "drag" (there is no drag): Claude fixes the line in content.

## R9. Closer to the Claude app (author 2026-11-04, comparing with the app she works in)
"新任务按钮、任务 history 都该在收起的侧导航。区域的那几个按钮在对话的右上角而不是整个屏幕的右上角。本来空间就不大、更挤压了。工作台全屏就行，目前怎么在屏幕里还有一圈空白。"
- **One sidebar**: the rail and the session list are one left sidebar. Expanded (home default): rail icons on top (消息 · 工作台 · 文档 · 审批 · 通讯录, or a compact row of them), then 新任务, then 今天 / 最近. Collapsed (task-page default): a 56 px strip with only the icons and a 新任务 (+) icon; the sidebar toggle (sidebar icon) at its top expands / collapses it. This replaces R8's separate session-list toggle.
- **No full-width header.** The conversation column has its own top bar (44): ⊟ (explorer), the task title, 交给 X, the status chip; and at **its right end** the pane toggles and the 老物件 strip. The explorer card and the pane cards start at the top of the frame (8 margin) and run full height; they are not under any bar.
- **工作台 is full-screen inside the monitor**: no window frame, no title bar row (工作台 · 自动保存), no outer white margin; the app fills the monitor's screen area under the OS top bar. (Other apps keep their windows.)
- **Icons**: line icons, inline SVG, 18 px, stroke 1.5, `currentColor`, the shapes of the Claude app's toolbar: globe (预览), `</>` brackets (代码), grid (表格), play-in-rectangle (会议), folder (文件), sidebar-left (⊟). No text glyphs (▤ ◍ ●).
- Tests: task page has no element spanning the frame above the cards; toggles are inside the conversation top bar; 工作台 renders without window chrome; collapsed sidebar is 56 px with icons + 新任务.

## R10. One top bar, like the Claude app's (author 2026-11-04; supersedes R9's sidebar strip and the conversation's own bar)
"红黄绿按钮的工作台几个字单占一行也没有意义。你对比一下你怎么做的。红黄绿按钮、侧导航展开、项目名、和切换应用框的 icon 都在一起。"
- 工作台 has **one top bar (44 px)** and nothing above its content: left to right: the traffic lights (12 px dots; the green one carries the 移到左屏 / 移到右屏 menu from tingtalk R1b), the sidebar toggle (sidebar-left icon), ← → (back / forward through pages visited this session: home and task pages), the page title (task title with a ▾ that opens the session list as a dropdown; on home, 工作台). Right end: the pane toggles (task pages only) and the 老物件 strip. No separate window-title row, no 自动保存, no second bar on the conversation.
- **Sidebar**: collapsed = not drawn at all (0 px). Expanded = a 280 px panel sliding over from the left edge under the top bar (like the app's: overlay, white, shadow `0 8px 24px rgba(0,0,0,.08)`): a search box (filters the session titles), + 新任务, 今天 / 最近, and at its top a compact row of the app's section icons (工作台 · 文档 · 审批 · 通讯录; 消息 leaves with 听听). Default collapsed everywhere; ⌘B / Ctrl+B toggles; a click outside closes it.
- Under the bar: explorer card, conversation, pane cards, as R1, full height.
- Tests: exactly one bar above the content; traffic lights, toggle, ←→, title, pane toggles all inside it; sidebar 0 px collapsed, overlay when open; ⌘B toggles.

## R11. Seen in the browser after R10 (2026-11-04, Claude, day 1 in English at 1600×900)
1. **A task without a board** (v17, 应收表 …): its whole thread (the player's line, Kuro's "How do you want to do this?", the 自己做 / 让它做 / 我看一眼 chips, Kuro's answer) sits inside the right pane, and the conversation column shows only the task title: the middle is empty. Wrong way round. The **thread is the conversation**: it goes in the conversation column (same bubbles as a board's beats: Kuro left with its portrait, the player right), its chips in the composer. The **surface** (doc / ledger / code: the thing being worked on) is the pane, default open. Same for read-only (handed-in) pages: thread in the column, surface in the pane.
2. **The dock covers the bottom of 工作台** (it sits over the composer). macOS hides the Dock for a full-screen app: when 工作台 is the front window on the left monitor, the dock is hidden and slides up when the pointer reaches the bottom 6 px of that monitor (hides again 600 ms after it leaves). Other apps (windows) keep the dock as today.
- Tests: a non-board task page has its thread in the conversation column and its surface in a pane; the dock is hidden while 工作台 is front and shown on the bottom-edge hover.
