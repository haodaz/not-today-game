# ide-layout — requirements (2026-11-04, author)

"不要硬用一个区域把代码和 preview 都写在里面……这两块该分别归入不同的框架才对。" / "任务列表应该和侧导航一起收起来了呀。" / "别再让它发明新交互了，有那么多成熟的东西可以直接用，人们看了也更习惯。" / "别让他再做成黑色的了……它明明自己就长这样。"

**The model is the IDE you are running in (Kiro / VS Code), light theme.** Explorer on the left, editor area in the middle (split: preview above, code below), the agent panel on the right. No new interaction: the same click-a-card-then-click-a-slot (and drag) the board already has; only where things sit changes. This revises the IDE view (`.kiro/specs/ide`, R2–R3). Scoring, ops, beats, transcript, print, send: unchanged.

## R1. The task page gives the work the whole width
- On a task page (`task:<id>`) the session list (新任务 / 今天 / 最近) is collapsed: only the rail's icons stay, like VS Code's activity bar. A toggle at the top of the rail (sidebar icon, `wb.sessions.toggle`) shows / hides the session list; session-only, default hidden on task pages, shown on home.
- Home is unchanged.

## R2. Four panes, light (`view: "ide"` only)
```
┌ rail ┬ EXPLORER ────┬ preview (browser tab) ───────────┬ 克总 ────────┐
│      │ ▾ 页面        │ ● 未来智能 · 技术表达   ⟳        │ (transcript) │
│      │   02-技术底座 ● │ localhost/space.html#2           │              │
│      │   04-数据      │ [ iframe: the deliverable ]      │              │
│      │   …           ├ 02-技术底座.js ─────────────────┤              │
│      │ ▾ 素材        │  1  …code…                        │ 让它补全      │
│      │   卡片…        │  7  title: [ 空 ]  ← the slot      │ 打快照        │
└──────┴──────────────┴───────────────────────────────────┴──────────────┘
```
- **Explorer (≈240 px)**, VS Code tree look: a folder **页面** (`board.ide.pages`) with one file per slot, in slot order, named from content (R4); an unfilled slot's file has a dot (●, like an unsaved file). A folder **素材** (`board.ide.sources`): the tray cards as tree rows (found = normal, not found = greyed, exactly the tray's rules). The lock row (if any) sits at the top of the explorer as a notice row.
- **Preview (top of the middle, ≈55 %)**: a browser-tab chrome (tab title = the deliverable's `<title>`, an address line showing the path and `#<page>`, a reload icon that does nothing harmful) around the iframe of `ideSrc` (R3).
- **Editor (bottom of the middle, ≈45 %)**: a tab with the open file's name; line numbers; the file's code (R4). The slot line shows the slot as an inline field: empty → a highlighted blank (click target, same as today's empty slot); filled → the card text as a string literal with a green `+` in the gutter (like a diff). Selecting a 素材 card then clicking the blank fills it; drag works too.
- **克总 (≈320 px)**, like your agent panel: the transcript bubbles (text wraps; never clipped), then 让它补全 and 打快照 at the bottom. Send as today.
- **Light theme throughout** (white / #F7F8FA panels, #E5E7EB borders, dark text, a soft blue accent). No dark editor. Code colours: a light syntax palette (keywords purple, strings green, numbers orange, comments grey).

## R3. Which page is open
- Clicking a file in 页面 opens it in the editor and moves the preview to that slot's page (`ide.pages`). Session only, no event.
- Default open file: the slot filled last (by board ops), else the first slot.
- `ideSrc` becomes `theme=light&pane=preview&c=<page of the open file>&fill=<slot:card,…>` (always `fill=`, even empty). The deliverable's `pane=preview` hides its own 代码 toggle and code column (Claude's side).

## R4. Content: the code of each page
`ide.files: Record<slotId, { name: string, code: string[] }>`: every slot has one; `code` has exactly one line containing `{{slot}}`, where the slot field is drawn. Loader rejects a missing file for a slot, a file for an unknown slot, zero or several `{{slot}}` lines, an empty name. en files carry their own names/code (same keys). Claude writes day 1's files after this lands; tests use a fixture.

## R5. Strings (Claude adds): `wb.sessions.toggle`, `board.ide.explorer`, `board.ide.preview`.

## R6. Tests
- Task page: session list hidden by default, toggle shows it; home shows it.
- IDE view renders explorer (页面 files with ● on unfilled, 素材 rows greyed when unfound), preview chrome + iframe, editor with line numbers and the slot field, 克总 panel; no dark class.
- Clicking a page file changes the editor file and the iframe `c`; default open file = last filled.
- Filling from the editor blank uses the same op as the table slot; the file's ● goes away; the gutter shows `+`.
- `ideSrc`: `theme=light&pane=preview`, `c` = open file's page, `fill=` always.
- Loader: `ide.files` rules as in R4.
- Table and meeting views unchanged.
