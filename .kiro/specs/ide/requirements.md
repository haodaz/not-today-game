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

## ide v2, day 3 — the memo and the directions (2026-11-08, author; Claude implements)
「第三天则是在一个小时的通话之后，克总整理了一个修改纪要，我们怎么对着这个纪要去改代码（不用真的改，选区域，给 2–3 个方向，选择往哪个方向说）… 我们要模拟的是怎么把第一天的东西改口成第三天的过程（各种公司业务不变换个故事完全不同，那种现实情况的黑色幽默）」「老王说的是四个方向，具体执行是要做成好几个变化，不只是四个，一定别太死板」.
- **The memo**: the explorer's first folder is 会议纪要 (`board.ide.memo`): 老王's directions from the call as read-only rows (the board's `given.rows`), not pages. Below it the pages, as on day 1 (five to seven of them: every page of v17 that the call touches, not one per direction).
- **A page**: its code pane shows the v17 passage as a struck line (`{{slot}}`'s line carries the old text as a comment above it: `// v17: …`) and, instead of a tray, **2–3 directions** under the line: cards with `slot: <page>` (options belong to one page, need no source, are always found). Clicking one fills the slot (op `fill`), the preview follows (`?fill=`), Kuro answers with that card's beat (`fill:<slot>:<card>`). Choosing again replaces it.
- **The directions**, per page, from the least to the most bent: keep the risk and fix words / risk and opportunity both / the full reversal. The slot's `answer` is the full reversal (老王's perfect); the judge's `flawed` is the middle one, `wrong` the first (the night's judgement as on other days: the hand measures how far the story bent). The deliverable is the same page either way (`day-03-evolve.html`): the business did not change, only the story.
- 参考文献 is a page with one direction, 不动 (Kuro's 「内容改了，参考文献还改吗？」 exchange is its beat).
- 打快照 → `snap-2028-10-16-03`; sent to 老王; a minute later his reply 「收到。这版肯定没问题，18，数字吉利。」(en: "Got it. This one's fine for sure — eighteen. (In Chinese it sounds like 'gonna get rich.') Lucky number."); 02:40 「辛苦了，好好休息。」 as before.
- G7 lights: the first unfilled page, then its first direction, then 打快照.
- Loader: a card may carry `slot`; such a card is in no tray, is found from the start, and may fill only that slot; the memo folder needs `given.rows`. Tests in `tests/ide-v2.test.ts`.

## tune — days 2–3's backend is a tuning board (2026-11-08, author; Claude implements)
「每个 action 会对冲一些参数…有些实施步骤能让 AI 更自主，但是会失去控制风险和人工参与；有些步骤增强了监管和装配，但是中间的很多环境不能自动化。第二天不管怎么做效果最多达到接近 60%，第三天能到 80%…本质有点像那种 a+1, b+2, c−1，通过几步调整最终让 a>60, b>60, c>60 的那种升级/洗练游戏。」「4 个 bar 的一个 chart…2 个颜色，原本的数据和变化的数据…有的条会推进，有的条会倒退一点点，最终目的那里有一根竖线。」
- **Content** (`board.tune`, only with `view: "ide"`; then `slots: []`, `cards: []`): `dims` (2–6: id, label), `start` (0–100 per dim), `reach` (today's line), `promise` (what the partner's page claims; 100), `steps` (modules on at once), `mods` (id, label, `delta` per dim — signed, the trade-offs — optional `from` + `hint` like a card's source), `assist` (Kuro's set for 让它补全), `carry` (`{day, task}`: that board's final set is on when this one opens — day 3 continues day 2).
- **Op** `mod {id, on}` (a `boardStep`): on spends a step (never over the budget), off gives it back; a module whose source is not found yet is not offered. The fold ignores an impossible switch. `BoardState.mods` is the ordered on-set.
- **The bars are the preview's** (author: 「评价条是某种结果，更应该在 preview 里面；tuning 其实还是在改一些对 AI 的训练、约束、支持」): the 代码 pane is `evolve.config.js` — one section per `tune.groups` entry (训练 / 约束 / 支持, a comment line), one switch per module with its deltas as chips, the budget counted in the tab bar. The preview page draws the bars: per dim the value the board opened with today (quiet grey), today's gain in blue / today's loss in red hatch, a black tick at `reach`, an amber mark at `promise`, `now/line` at the end (red until over the line, then blue). Below: one switch per module with its deltas as chips; unfound modules show their hint. The preview page draws the same from the query (`mods, dims, base, reach, promise, left, done`), with the partner's full bars beside ours and the gap line.
- **Finish**: 今天先这样 (`board.tune.print`) is enabled once every bar is over the line or the budget is spent. Day 2's set cannot reach 60 (best 55, exactly one set); day 3's reaches 80 with exactly one set of eight (two new modules in, one of yesterday's out); the animation (m4) and Vivi's skin (n4) are traps in no best set. Judge: a bar more than 10 under the line is a wrong slot (`tuneShort`); Kuro's assist sets ignore safety.
- **Beats**: `mod:<id>` / `unmod:<id>` (when the switch took), `steps` (budget spent), `reach` (every bar over the line), plus open / kuro / print / send. Numbers: `tests/tune.test.ts` brute-forces both days.
- **G7**: only the first switch is lit (free exploration after that), then 今天先这样.
