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

## ide v2 — the work is a programmer's (2026-11-08, author; Claude implements)
「v16 和 v17 有一点差异对比。你要从代码工作的角度告诉我怎么让玩家执行对比、合并。并且最后要重新计算其中的数据（从未来智能的某个接口拿最新数据），然后做出 fixed 的数据（断开接口之类的）。并且让这一切变得可操作。」 v17 is the analysis (事情 A), v16 is yesterday's version (invented), v18 is day 3's self-evolution version.
- **Content** (`board.ide`): `diff: { <slot>: { line, v16, v17 } }` — per page the one line Kuro's overnight merge changed (never the slot's own line); `api: { live, fixed, at, snap }` — the data import's two targets, when the data was pulled, the snapshot id. `{{api}}` in a code line is drawn as `live` until the snapshot is printed, then `fixed`. Beats: `merge:<slot>:<v16|v17>`, `merge:<slot>`, `merge` (every differing page merged), `fetch`.
- **Steps, in order, each lit by G7**: (1) 对比 → 合并: a page with a difference shows its dot; its code pane shows the line as − v16 / + v17 with 要 v17 的 / 留 v16 的 (op `merge`); (2) 填: the sources into the slots as before; (3) 重算: 拉最新数据 (op `fetch`, once, only after 1 and 2): the preview's numbers change (836 → 211 nodes, 4,912 → 1,180 links; `?data=fetched`); (4) 固定: 打快照 (the `task` event as before) switches the import to `snapshot.js`; the page shows `SNAPSHOT snap-2028-10-16-01 · 截至 … · 已断开接口` (`&snap=1`); (5) 交给老王 as before.
- The page opened on its own (no query) is the delivered version: the pulled numbers and the snapshot line.
- Later days: the API's numbers may change while the snapshot does not (the foreshadowing lives here).
- Tests: `tests/ide-v2.test.ts` (ops, gating, query, transcript, loader rejections) and the G7 sequence in `tests/guidance.test.ts`.
