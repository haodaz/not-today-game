# guidance — requirements (2026-11-07, author's day-1 playtest)

The author's finding, after playing day 1 as a stranger: **the game knows the next step, the player does not.** The fix is one mechanism used at every moment where the story needs one specific action, plus a sweep of the places that made day 1 unplayable. Chinese source of the audit: `script/notes/第一天陌生人排查-2026-11-07.md` (23 rows). Content and strings are Claude's and are in the tree before this spec runs; do not edit content/ or public/.

Principle (author): *"我们永远可以设计和点箱子差不多的阻断来引导用户 … 要有这些空气墙。你测着永远没问题，因为你永远知道精确的点哪里。用户不知道。"* At a guided moment, the one thing to do is lit and everything else answers with one line and opens nothing; everywhere else the player explores freely.

## The layers (author, 2026-11-07 evening)
Walls, from the room to the task: (1) an object that cannot be used now (床, the carton before lunch) — one line; (2) a thing already used today (the camera) — one line saying so; (3) an app on the screen that is not the one to open — one line; (4) in 听听, whose thread to read first; (5) in 听听, a file that must be opened; (6) inside a task, the order of its steps. Walls (1)–(2) have no target (gates R1: the line only). Walls (3)–(6) have a target: the guide state below (ring + line). Then two things that are not walls: (7) story rules that move the player (when lunch arrives, the story takes the player off the screen to the door); (8) **heads and tails**: every scripted stretch opens with a line that says where we are and what to do, and ends with a line that says it is done and lands the camera back where the player was. R14 lists the tails day 1 is missing.

## R1. The guide state (one mechanism)
- A pure function `guideNow(state, events, session)` in `src/world/loop/guide.ts` returns the current guide or null: `{ target: GuideTarget; refuse: string }` where `refuse` is a strings key. Targets are a small union: `{ kind: "tower" } | { kind: "dock"; app: "tingtalk" } | { kind: "conv"; id: "boss" } | { kind: "card"; doc: string } | { kind: "clauses"; indexes: number[] } | { kind: "phone" }`. Derived from the log and the session only (survives a reload).
- **Rendering:** the target's element carries `data-guide="on"`, and the stage draws a pulsing ring around it (class `guide-ring`, the coach's 30 % dim behind it, a 2 px ring in the coach's blue, 1.2 s ease pulse; `prefers-reduced-motion` keeps the ring and drops the pulse). One ring at a time. Where the target is not on the current view (the phone while on the desktop; the tower while facing 床), no ring is drawn and the refuse line is the guide (R2 says which lines).
- **Blocking:** in the controller's action wrapper (next to `coachBlocks`), while a guide is on, an action that is not on the target, not in `GUIDE_ALLOWS` and not the room's own navigation is refused: the guide's `refuse` line is pushed to the box as a one-line fragment (`ending: none`, like `room.box.beforeLunch`) and the handler does not run. `GUIDE_ALLOWS`: the box's own controls (`loop-advance`, choices, `dlg-history`), `settings-*`, `kuro-call` and Kuro's chat, `view` (every room turn and 回房间), `bed`, `rise-*`, the lying ask, `items-toggle`, the objects' own layers, `onboard-*`, the call's controls. Refusing never opens a layer or changes the view (gates R1).
- Tests: `guideNow` for each R2 moment (on / off by the events that end it); a refused action pushes the line and changes nothing else; an allowed action runs; the ring markup is on the target and nowhere else.

## R2. The guided moments (day 1; later days are listed where they apply)
| id | when (on → off) | target | refuse line (strings, in the tree) |
|---|---|---|---|
| G1 | day 1 standing, before `boot` → `boot` | tower (in 房间) | none new: the screen's existing line `room.screen.notyet` stays |
| G2 | day 1, first desktop visit after the coach (`onboard` done) → the first `openApp:msgs` (听听 opened) | dock 汀汀 | `guide.work.first` 「先看看工作的事情。」 for every other dock tile, decoy, 文件, 回收站, 设置 tile, calendar |
| G3 | day 1, 听听 open and the boss thread not yet opened today → `open conv:boss` | the 老板 row | `guide.boss.first` 「先看老板的。」 for the other rows and the reply bar |
| G4 | any day with a required `lunch` item: from the end of the day's `msgs` lines until `order:lunch` | the phone (桌子); on the desktop no ring, the line guides | `guide.lunch.first` 「先点饭。干起来就忘了。」 for `wb-send` / `wb-choose` / opening a task page (the 工作台 home still opens) |
| G5 | Vivi's lock (`viviLock` ≠ null) **and** the boss thread was opened today → the doc opened | the deliverable card; when another app is in front, the dock tile 汀汀 (or the right-monitor tab) | `vivi.lock` (text changed in the tree: 「Vivi 在群里发了个网页，先点开看一眼。」) |
| G6 | task page, mode `self`, a document with `conflict`, until both clauses are clicked | the conflict clauses (ring on each unclicked one) | none: nothing else is refused on the page |
- G3 changes 听听's first open of day 1: no conversation is active (the right pane empty, as a real client on launch) until a row is clicked; `session.conversation` starts null that day and the row click sets it. Days 2+ open on the boss as today.
- G5 changes `viviLock`'s timing: the lock holds only after `open conv:boss` was logged today (`src/world/desktop/vivi.ts`, a new argument or a wrapper in game.ts). The refused switch still lands on the lock's conversation (never a dead end).
- G6: the self-mode Kuro line is now an instruction (content: 「第 6 条和第 11 条打架了，你把它们标出来。」); the 合并/不合 chips appear only after both clauses are clicked (as today). The task page draws **no text box** (R7).
- Tests: one per row, on and off.

## R3. Windows close; the dock on both monitors
- The traffic lights work: **red closes** the window (the app leaves the stack; its monitor shows the next window or the wallpaper; its state is kept so reopening from the dock is where it was), **yellow minimises** (same as close for now, so both do something), green as today. The browser-doc page's own × (`br-doc-close`) is removed: the browser bar's ‹ returns to the news page, red closes the browser.
- The dock is drawn on **both** monitors (same tiles, same hover rules as shell R11 for 工作台 full screen).
- Tests: red closes and the next window comes up; yellow minimises; the doc page has no ×, ‹ returns; the dock renders on the right monitor.

## R4. One Kuro on the screen; the box's size
- Author (2026-11-07 evening): 「克总在屏幕里是在桌面右下角，不能是额外有一个克总，话都是从额外的克总说的。」 On the desktop view Kuro is **the pet inside the monitor** (the `.kpet` at the desktop's bottom-right, with its pill): the room's big Kuro body in the stage's `hud-br` is **not drawn** there. Everything Kuro does on the screen comes from the in-monitor one: its lines (a `speaker` line with `who: "kuro"`, the evening chat, the tutor remarks) are spoken from the pet (its portrait in the box is fine; the body that reacts is the pet), `kuro-call` is a click on the pet or its pill, its face states play on the pet.
- The dialogue box on the desktop is the room's size (same `.dlg` width/height; today the desktop's is taller).
- Tests: no stage Kuro body in the desktop render; the pet carries `data-action="kuro-call"`; a Kuro line on the desktop animates the pet's state; the box's class list is the same in both views.

## R5. The checklist on the desktop
- The 今日 card (`renderChecklist`) is drawn on the desktop view too, top-left, over the monitor's bezel area, the same card as the room's. Tests: present in the desktop render.

## R6. 工作台 home: the sidebar open, a past, no empty cards
- The first time 工作台 opens in a run the sidebar is **open** (shell R10's overlay); ⌘B / the toggle as today; later opens remember the session's choice.
- Past tasks: `content/tasks/past.json` (Claude writes it: three finished tasks dated October 2028 with title, mode, result line) is listed in the sidebar under 最近 and in the 在办 card as 已交 rows under today's; opening one shows its thread read-only (the player's line, Kuro's line, the result).
- A card with nothing in it is not drawn (文档, 更新日志, 常做的事 on day 1); 「此刻」 shows its count as a number (0 is 0 次). The greeting follows the clock (`greetingKey`), 12:04 is 下午好.
- The home's lead line 「三件事在办」 counts the tasks listed, not today's total.
- Tests: sidebar open on the run's first open; past rows render from the file; empty cards absent; greeting by time.

## R7. The task page: no text box; a busy line; the opening narration on time
- No text box on a task page (it was always read-only); the chips are the whole input. The home page's box stays.
- While Kuro works (`busyUntil` in the future) the thread shows a Kuro bubble with `wb.busy` 「在做……」 and the pane shows the same line, instead of an empty bubble and a blank pane.
- A task's `start.say` narration plays when the page opens with its surface (today it played after 已交).
- Tests: no `input.ph` on a task page; the busy bubble; the start narration's timing.

## R8. The phone's put-down hint
- `hud.putDown` 「点屏幕外面放下」 is drawn **under the phone's bottom edge** (outside the device), never over its buttons. Test: the hint's rect does not intersect the phone's.

## R9. The four reply words are the rule; show it
- The four chips are the protagonist's whole vocabulary on purpose (the answers play on it: 「你收到啥了，我还没发呢」), so they stay the same in every thread. What is missing is the rule being visible: a thread that is not the boss's shows the hint `reply.hint.other` 「能说的就这四句。」 above its chips the first time its bar is shown in a run (the boss's keeps `reply.hint.boss`). Test: the hint shows once per thread, then not.

## R10. A deliverable card in a group names its sender
- In `transcript.ts`, a `deliverable` line in a `SPEAKER_CONVERSATIONS` conversation goes through `speakerOf` like a `card` line: the bubble is Vivi's (her avatar, her name, the prefix split off the card title). Test: day 1's 全员 card bubble has `who: "partner"` and the title without 「Vivi：」.

## R11. The browser-doc iframe survives renders
- `br-frame` gets `data-keep="doc:<url>"` so `keepframes` keeps it loaded across re-renders (the author saw a blank page while the workbench's pill kept re-rendering). Test: the iframe has the keep key.

## R12. The ordered dish in the delivery texts
- `{dish}` in `content/delivery.json` texts (`bag`, `receipt`, the eat lines) is filled with the dish the player ordered that meal (the order event's item name); Claude replaces the hard-coded 「黄焖鸡米饭 · 不放香菜」 with the placeholder once the filler exists (remarks stay). Test: an order of 沙县 shows 沙县 on the receipt.

## R13. The case closes with the view
- The 3×3 case layer (`case-layer`) closes on any view change / room turn (it stayed open over 窗 and while eating). Test: a `view` action with the case open closes it.

## R14. Heads and tails (transitions)
- **Vivi's page, read:** after the doc's `onOpen` line(s) have been read, the box says `vivi.back` 「看完了，接着回去工作吧。」 and the browser-doc page closes by itself: the browser window leaves the front and the app that was in front before the card was clicked (听听, or 工作台 when the lock refused a switch there) is in front again. The player is never left on the news page.
- **Lunch arrives while on the screen:** the doorbell line(s) play as today; on their last line the camera leaves the screen by itself: 回房间, facing 门 (`delivery.leave` 「外卖到了。去门口。」 as the inner line that carries the move; the day file's own doorbell lines stay). Away from the screen the lines play and the camera turns to 门.
- **A task sent (已交):** after its closing lines, 工作台 returns to its home page with the next task's row lit (the guide ring, R1) when one is unlocked; when none is, the home shows 「今天的活干完了」 as a line in the thread (string `wb.done.today` exists? if not, use the checklist's own state only; Claude adds the string later if wanted).
- **The boss replied (回老板 done):** no move; the thread stays. **Shutdown:** the shutdown beat lands in 房间 as today; **bed:** lying as today.
- Tests: the doc's tail (line, page closed, previous app front); the doorbell's camera move from the desktop and from a facing; the task's return to home with the ring.

## Files
`src/world/loop/guide.ts` (new), `src/world/desktop/controller.ts`, `src/world/room/game.ts`, `src/world/room/hud.ts`, `src/world/desktop/shell.ts`, `src/world/desktop/placement.ts`, `src/world/desktop/vivi.ts`, `src/world/desktop/messages/{view,actions,transcript}.ts`, `src/world/desktop/workbench/{shell,work}.ts`, `src/world/desktop/browser/view.ts`, `src/world/room/case.ts`, `src/world/room/held.ts`, `src/world/room/room.css`, `src/world/desktop/desktop.css`, `src/state/days/tasks.ts` (past.json loader), `src/world/loop/waiting.ts` or wherever delivery texts are filled. Tests beside the existing ones; list any snapshot that changes and why, do not edit it.
