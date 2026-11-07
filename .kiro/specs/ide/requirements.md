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
「每个 action 会对冲一些参数…有些实施步骤能让 AI 更自主，但是会失去控制风险和人工参与；有些步骤增强了监管和装配，但是中间的很多环境不能自动化。第二天不管怎么做效果最多达到接近 60%，第三天能到 80%…本质有点像那种 a+1, b+2, c−1，通过几步调整最终让 a>60, b>60, c>60 的那种升级/洗练游戏。」「4 个 bar 的一个 chart…2 个颜色，原本的数据和变化的数据…有的条会推进，有的条会倒退一点点，最终目的那里有一根竖线。」「评价条是某种结果，更应该在 preview 里面；tuning 其实还是在改一些对 AI 的训练、约束、支持。」「每个模块上还得选择几个不同的路径，都需要形容（几个子 action 的 bulletin），对应不同的状态条增减结果，需要真的合理猜想。」「按照科学逻辑给一下增减关系。不必精确到 paper 级别。科幻要合理。」
- **Content** (`board.tune`, only with `view: "ide"`; then `slots: []`, `cards: []`): `dims` (2–6: id, label), `start` (0–100 per dim), `reach` (today's line), `promise` (what the partner's page claims; 100), `steps` (modules set at once), `groups` (the config file's sections: 训练 / 约束 / 支持), `mods` — each a decision (id, label, group, optional `from` + `hint` like a card's source) with 1–3 `paths`: a way of doing it (id, label, 2–4 `bullets` = sub-actions, `delta` per dim, signed: the trade-offs) — `assist` (Kuro's choice, module → path), `carry` (`{day, task}`: that board's final choice is set when this one opens). The whole table lives in `script/tools/tune-table.mjs` (zh + en labels, bullets, deltas, the why of each delta, beats); running it rewrites the four task files.
- **The table and why the bars move** (real MLOps practice; the four bars: 自主 = how much the system changes itself without a person, 安全 = how likely a bad change is caught or undone, 自动化 = how little a person must do to keep it running, 效果 = how good the output is). ★ = day 3's menu only; ✗ = a trap in no best set.
  - 微调节奏: 每晚全量重训 — autonomy and automation up (it changes itself every night, nobody touches it), safety down a lot (a bad night ships straight to production), results up a little; 每周 LoRA — the same shape, milder (the adapter only, the old model kept); ★数据回流闭环 — autonomy and results up (the system learns from its own corrected output), a small safety cost (feedback loops amplify their own errors).
  - 数据入库: 小张周一手工导 — results up only (clean data, but a person does it); 接口定时拉取 — results and automation up, safety down (schema drift goes in unnoticed); 「自动理解」✗ — nothing arrives.
  - 推理方式: 真算 40 s — results and safety up (a real, inspectable computation), automation down (someone waits); ★真算 + 缓存 — the same results, automation up instead (instant after the first run), a small safety cost moved to cache invalidation; 预渲染 3 s ✗ — automation up, results collapse (the numbers are drawn, not computed).
  - 参数选择: 自动调参 — autonomy up, results up a little, safety down (a search can overfit the eval); 手调固定 — results and safety up a little, autonomy and automation down (a person retunes when the data changes).
  - 自改权限: 改 prompt — autonomy up, safety down; 改配置和数据筛选 — autonomy up a lot, safety down a lot (it decides what it learns from, unreviewed).
  - 上线前审批: 每次人工 — safety up a lot, automation and autonomy down a lot (a person in every loop); 抽样 10% — a tenth of the safety for a tenth of the cost; ★只审差异 — most of the safety at a small cost (a diff fits on one screen).
  - 发布方式: 直接替换 — automation up, safety down; 沙箱回滚 — safety up, autonomy and automation down (a person rolls back); ★金丝雀 — safety and automation both up (5% of traffic, automatic rollback), a little autonomy.
  - 评测: 看 loss — automation up, safety and results down (it grades its own exam); 冻结评测集 — safety and results up, autonomy up a little (an honest gate lets it change more freely); ★影子评测 — safety up a lot and autonomy up (old and new run side by side for a week; swapping only when the new one wins is what makes a nightly retrain survivable).
  - 可观测: 日志与追踪 — safety up (you know which step broke), a little autonomy and results.
  - 前端接入: 导出接口 — results and automation up (every button wired); 照页面写 ✗ — nothing behind the buttons; ★她的皮子 ✗ — pretty, buttons go nowhere, safety down (it hides what the backend does).
  The shape of the puzzle: autonomy costs safety; oversight costs automation; day 3's new paths (shadow eval, canary, diff-only approval, cache) are what lets a nightly retrain be kept safely — that is why 80 is reachable only then.
- **Op** `mod {id, path | null}` (a `boardStep`): a path on a module not yet set spends a step (never over the budget); another path on a set module swaps for free; null clears it and gives the step back; a module whose source is not found yet is not offered. `BoardState.mods` is module → path.
- **The bars are the preview's**: the page draws per dim the value the board opened with today (quiet grey), today's gain in blue / loss in red hatch, a black tick at `reach`, the partner's full amber bars beside ours, `now/line`, and the gap line. The 代码 pane is `evolve.config.js`: one section per group (a comment line), one line per module (`cadence: "nightly",  // 微调节奏`) with its paths as radio chips carrying their deltas, and the chosen path's sub-actions under it; the tab bar counts modules set against the budget. 参数 sits above 预览; no explorer.
- **Finish**: 今天先这样 (`board.tune.print`) is enabled once every bar is over the line or the budget is spent. Day 2's menu cannot reach 60 (best 55: nightly + sample gate + frozen evals + logs + export, with or without the manual import); day 3 reaches 80 with exactly one choice of eight (nightly, pull, cached, diff, canary, shadow, logs, export). Judge: a bar more than 10 under the line is a wrong slot (`tuneShort`); Kuro's assist choices ignore safety.
- **Beats**: `mod:<module>:<path>` (else `mod:<module>`), `unmod:<module>`, `steps`, `reach`, plus open / kuro / print / send. Numbers: `tests/tune.test.ts` brute-forces both days.
- **G7**: only the first module's chips are lit (free exploration after that), then 今天先这样.
- **The foreshadowing** (author: 「这份文件会存在玩家的电脑里。第四天开始，再打开，变成所有项 100%，页面有些奇怪的乱播…或者安全控制之类的变成 0」): a handed-in tuning page opened again from day 4 (`HAUNT_FROM`) gets `&haunt=<day>` (`ideSrc`'s last argument; the shell passes today's day for a read-back, never for the live board). The page then shows 自主 / 自动化 / 效果 at 100 and 安全 at 0 (the red hatch back to nothing), every module on, and misplays a little: a bar overshoots its track and snaps back, a number flickers (1OO, ١٠٠, 0.), the stamp's date drifts (2028-10-<day+16>, 「自进化 · 第 N 轮」), the training log keeps appending (`self-edit · config changed by: (self)`, `safety · 0 checks · ok`), the nav highlight wanders. Nothing in the game's state changes; the file grew by itself.
- **The preview is a report** (author: 「preview 里面也有分析和效果，状态条只是最上面的一个 overview…定好几层数值，最后拼成报告」): 进化度 (the bars, overview) → 分析 (`report.md`: per bar, the chosen paths that push it up or drag it down with their deltas, from the same table the game uses — `tune-table.mjs` writes it into the page between `/*TUNE*/` and `/*END*/` — and how far under today's line it is) → 模块 (what was chosen) → the backend sections (接入 / 数据集 / 训练任务 / 训练闭环 / 审批与执行 / 界面) rendered by path. Choosing 她的皮子 reskins the whole page (gradient, glass cards, 「✨ EVO 自演化引擎 v2.0 · 让 AI 自己成长 · 人类参与度 0%」, a 开始分析 → button in every section that does nothing; the log hidden): pretty, buttons go nowhere.
- **Sources on paths** (author: 「第三天才想明白要接她的 css，最好是克总提醒的」): a path may carry its own `from` + `hint` (the module's `from` stays for a whole module): 她的皮子 waits for Vivi's chat (day 3), 只审差异 for the v17 thread with Wang; an unfound path shows its hint as a dashed chip. Kuro's day-3 open beat says 「她那页的皮子还在她私聊里。接不接，你定。」 — the reminder is Kuro's, not a manual.
