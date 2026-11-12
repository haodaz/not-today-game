# Work screens (2026-11-12)

Author's rule, in her words: 「每个任务都是独立的交互界面」「别新瓶装旧酒，继续放之前的 UI 图」「直接在这个全屏的游戏画布上做成新的交互」「千万别把报告和维度的细节弄丢了」「没有克总处理了」「最后结算的时候先展示出来，再提交」「台词都是看着代码逻辑硬生成出来的…非常别扭」.

Every task: Kuro's card 「要开始工作吗？」 → the launch page (that day's own picture: `launch.art` generated, or the bust + a motif; `launch.tone` for the ground; the brief as plain lines in one white panel) → the work screen on the full stage → the settlement → 提交. The state engines are unchanged (`src/state/days/board.ts`); only the pictures are new. No per-step Kuro card anywhere; Kuro only at a failed end.

## The three screens so far

| screen | file | boards | what it shows |
|---|---|---|---|
| compare | `workbench/compare.ts` (`workLayer`) | `board.compare` (days 1, 3 v18, 10) | the counterpart's riddles, the page's whole code in each version side by side (`versionCards`, card `patch` for several diffs), 用这版 at the card's foot; result screen with the rendered page; settlement with the faces |
| tune stage | `workbench/tune-stage.ts` | `board.tune` (days 2, 3) | the AI training lab backdrop, 研发目标 bars (today's line, her 100), the module as a research node with its paths as action cards (select → 行动), 行动 N/M + progress, the 分析 report per dimension; budget spent → the report page (her page vs the backend) with Kuro's offer, then 提交; the skin path (day 3 `front: skin`) dresses the report as Vivi's page |
| clue stage | `workbench/clue-stage.ts` | `kind: table`, no tune / meeting / ide (days 4, 5, 6, 8, 11–17 for now) | the evidence board: the demands as pinned notes with a slot each, the found sentences as clippings (the unfound greyed with where to look), the lock card over the notes until its code is read where it lives |

Everything else still falls to `genericWorkLayer` → `renderBoard` (the old pane): the meeting boards (days 7, 9) first of all. Each later day should get its own screen in this spirit (plan in `days-2-18-interaction-plan.md`), with its own key art (`script/tools/gen-image.mjs`, see memory `launch-art-generation`).

## Looking at a screen quickly (dev)

`?lang=zh&day=N&view=desktop&seed=flags:<earlier days' task flags>&launch=<task>` → the launch page; 开始工作 opens the screen. The replay driver (`script/tools/auto-day-shoot.mjs`) knows the three screens (`compare-pick` / `tune-select` + `tune-act` + `.ts-node` / `board-card` + `board-slot`).

## The settlement: the game projected back into the real (author, later the same day)

「结算就是把游戏对世界的改变投射回真实」. The work is a game because Kuro cannot do it properly — he makes it 欢乐缤纷 (认知污染), and what it spends is the world. So every task ends on one full-screen page in two halves (`workbench/settle-layer.ts`, `settleLayer`):

- **left, the game's ending**: the score and the faces (compare), each dimension's bar against her promise and today's line with what each step did (tune), clippings found / pinned (clue, meeting), the rank the form reached (the chain); then 再改改 / 提交 / Kuro's offer.
- **right, what it really looks like now**: the real page in an iframe (`ideSrc` with every pick — the backend page puts on Vivi's skin by itself when `front: skin` was taken), the sheet as it goes out, and on the chain day the approval-flow UI beside it (`.af`, 已批 stamps up to the rank reached). No caption over it and nothing boxed in: the real thing gets the whole half.

The settlement matches the score; it need not be a success.

## The first launch page opens with Kuro (day 1, v17)

`launch.intro` (content) plays in the game's NPC dialogue box over the launch page — Kuro, one line a screen: 从第 1 版改到第 17 版？… / 不用担心！有克总在，工作都会变得很欢乐！ / 让我们轻轻松松，用游戏的办法解决问题吧！ / 你的游戏进度，会真的影响这份工作的效果哦！！ — then the player: ……也不知道这是什么时候加的功能。 开始工作 appears only after (`queueLaunchIntro` in `workbench/actions.ts`; the dialogue layer sits above the launch and work pages now). The right half of the settlement is what that line proves.

Dev: `&filled=1` also spends a tune board's budget; the launched task must be the loop's open item (seed the flags, and the day's earlier event items are not seedable — use the replay for those days).

## Two ways out of a settlement (author 2026-11-13)

「结算页面意味着游戏玩完了，失败了不可能 change it。只可能有 2 个选择」. `settleVerdict` (state): a compare
board passes at its threshold; a table / meeting board passes with every slot right, or once Kuro has
fixed it; the tune and the chain never fail at the sheet (the line is a goal; the chain approves before
the sheet opens — a stuck chain gets 让克总帮忙 on the chain itself, he stamps it). Passed → the send
button only. Failed → 让克总帮忙 only: the wrong slots take his card (`assistFix`, one assist, judged
at night like the others; a compare board takes his whole fill), and the story plays in the box over
the settlement — player 「克总很是认真的忙了一会儿，咱也不知道在忙活啥，咱也不敢问。」, Kuro 「好了，可以发了。」
「要发吗？」, then 发出去 / 快点发出去 / 发发发 (`settleSend`): every one sends, and the scene changes.
No 再改改 anywhere. The player's line gets variants later.
