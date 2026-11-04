# ide — requirements (2026-11-04, author)

Day 1's main task is not a table. "第一天的工作，与其说是有很多操作，不如说玩家和克总说话，边说边熟悉界面，并且要用一些对话把自己的隐忧、这个科幻逻辑的前提说出来。中间就算玩家不细看，有些东西在点击的过程中也会讨论到。" The work looks like an IDE + an AI copilot (Kuro) + a browser preview.

The deliverable already exists and is the preview: `public/docs/player/day-01-space.html` (Claude's; 14 pages, 4:3, its own 代码 toggle shows code beside the preview). This spec is a second **view** of the same work-v2 board: same slots, cards, sources, Kuro fill, print, deliver and judgement. Nothing about scoring changes.

## R1. Content shape (strict loader)
A board may carry:
- `view: "ide"` (default: today's table view).
- `ide: { src: string, pages: Record<slotId, number> }`: the deliverable URL and, per slot, the page index (`c`) where that slot's content shows.
- `beats: Beat[]`, `Beat = { on: string, lines: { who: "kuro" | "me", text: string }[] }`. `on` is one of: `open`, `fill:<slotId>`, `fill:<slotId>:<cardId>`, `kuro`, `unlock`, `print`, `send`. Every slot/card id named must exist on the board. en files carry their own `text`.
- Loader rejects unknown keys, an `ide` without `view: "ide"`, page indices outside 0–99, and beats naming missing ids.

## R2. The IDE view (workbench, same task page)
Three columns inside the workbench page:
- **Left (≈260 px)** · 页面 (`board.ide.pages`): the slots as a page list, each row the slot label + its filled card or an empty drop line; below it 数据源 (`board.ide.sources`): the tray of found cards, greyed when not found yet, exactly as today. Drag/drop and click-to-place behave as today.
- **Centre (flex)**: an iframe of `ide.src` with query `theme=mariana&code&c=<page>&fill=<slot:card,…>` (see R3). The page shown is the page of the slot filled last; before any fill, 0.
- **Right (≈300 px)** · 克总 (`board.ide.copilot`): the transcript (R4) as chat bubbles: Kuro on the left with its small portrait, the player on the right. Below it, today's Kuro assist button (让它补全) and the print button relabelled `board.ide.snapshot` (打快照). The send step after printing is unchanged.
- The lock row (if any) sits above the page list, as today.

## R3. The preview follows the board (pure)
`ideSrc(board, state, ops)` builds the iframe URL from the board ops: `fill` lists every currently filled slot as `slotId:cardId` (Kuro's fills included, Kuro cards by their own id), comma-separated, in slot order; `c` is the page of the last slot filled (or the page of the last slot Kuro filled; 0 when nothing). The iframe reloads only when the URL changes. The deliverable reads `fill` and shows each slot's card text on its page (Claude's side; already done).

## R4. The transcript is derived from the log (pure, replayable)
`ideTranscript(board, ops)` returns the lines to show, in order: the `open` beat first; then, walking the board ops in log order, for each op the matching beat, once per beat:
- a fill of slot S with card C → the `fill:S:C` beat if present, else `fill:S`;
- Kuro's assist → `kuro`; an unlock → `unlock`; print → `print`; the deliverable sent → `send`.
A beat already shown is not shown again (refilling the same slot does not repeat it). No new events: everything comes from today's board ops, so a reload or a replay shows the same transcript. New lines appear with a short typing delay (300 ms per line, session only; tests read the pure list).

## R5. Onboarding falls out of it
The `open` beat is where Kuro tells a first-time player what to do (drag a source onto a page, look at the preview, snapshot, send). No separate tutorial for this screen.

## R6. Strings (Claude adds): `board.ide.pages`, `board.ide.sources`, `board.ide.copilot`, `board.ide.snapshot`.

## R7. Tests
- Loader: valid `ide` board loads; rejections as listed.
- `ideSrc`: empty board → `c=0`, no `fill`; fills in slot order; last-filled page; Kuro fills included.
- `ideTranscript`: open first; `fill:S:C` beats over `fill:S`; once per beat; kuro / print / send beats; replay of the same ops gives the same list.
- View: an `ide` board renders the three columns, the iframe `src` equals `ideSrc`, the print button reads 打快照; a table board renders as today.
- A fixture `ide` board plays through: find sources, fill, snapshot, send. (Claude switches day 1 task3 to `view: "ide"` after this lands.)
