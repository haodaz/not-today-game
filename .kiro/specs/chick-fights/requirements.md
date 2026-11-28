# chick-fights: the chick is the helper in every task; feeding it is what makes it strong

Author, 2026-11-27 (ledger #156). Her words: 「我想小鸡每次都能战斗，战斗如何胜利完成度上升一格，每个任务 boss 能力会提升，所以要记得喂鸡（如果上升一格能让任务成功、不需要克总重做，那就达成目的了），其他几个老物件有时候能在过程中用，不用每次都设计用法，这样我们可以简单一些。」 Her decisions the same evening: feeding counts cumulatively; a lost fight costs nothing (「代价就是没有提升任务的效果」); after Kuro's upgrade the chick is strong for three days and then cannot fight, and it does not stand with the player in the last fight; and recognising an object is not a judgement (「不要和认不认出来挂钩…一开始认物件只是 3 个对话 3 种交流」).

Before this spec: feeding the chick had no consequence anywhere; the battle existed on three board kinds only, with a fixed 80 HP chick, and a win filled one cell.

## R1 · The chick's level comes from the log

- `chickFedDays(events, day)`: the number of distinct days up to and including `day` on which the meal was given to the chick at least once (the existing care event for the meal icon). Cumulative: it never goes down. Pure, from the event log.
- `chickFedToday(events, day)`.
- Nothing else about the chick's care changes (no hunger, no death).

## R2 · It can be sent in on every task

- 让小鸡上 is offered on every task that has a board, whatever the board's kind (table, meeting, compare, a game board, the tuning board, the approval chain), when the chick is found, it can still fight (R5) and this task's fight has not been fought. Once per task, as before.
- Where a board kind has no 让小鸡上 control today, it gets one in the same place and style as the others.
- When the chick was not fed today, the control carries the small tag `battle.hungry`.

## R3 · Strength

- Chick: max HP = 80 + 8 × level, + 16 when fed today, − 16 when not (never under 40); damage × (1 + 0.04 × level). Level = `chickFedDays`.
- The task's monster: its existing HP + 8 × (day − 1); damage × (1 + 0.04 × (day − 1)).
- So a chick fed every day keeps a little ahead of the day's monster; one that was skipped falls behind. The seeded dice stay.

## R4 · A win raises the task's grade one step

- A win no longer fills a cell.
- When the task is judged at night, a won fight raises its grade one step: wrong → flawed, flawed → perfect; perfect stays. It applies after the cap for Kuro's help, and only to work that was given.
- At the settlement a won fight makes a board that would fail pass (a draft under the boss's bar, a table with a wrong cell, a tuning board under the line): the send button, without Kuro's fix. The settlement says so with the win's line. A game board's grade line shows one step up.
- The fight is offered before a board's own game starts and at its settlement, not while the game is under way.
- A loss changes nothing; the task's one fight is used.
- Won or lost is in the event log (replay gives the same grade).
- The win's line in the battle box says so (`battle.win.grade`).

## R5 · Kuro's three days, then no more fights

- Once the chick is upgraded, for the three days before it is taken (the existing rule: taken three days after the upgrade) it fights at level + 6, and it counts as fed (Kuro's offer was to feed it; its own keys no longer work).
- Once taken (its screen shows only Kuro), it cannot fight: the control is replaced by a disabled chip `battle.taken`.
- The last fight is unchanged: an upgraded object does not stand with the player.

## R6 · The status panel shows the chick

A row 小鸡, above 老物件 n/8, from the day the chick is found:

- fed today: a filled dot and `status.chick.fed`; not fed: a hollow dot and `status.chick.hungry`;
- the days fed, as a row of small cells, one lit per day fed (the same drawing as 饱食度), with `status.chick.days`;
- today's fights: `status.chick.fight.none`, or `status.chick.fight` with how many it fought today and how many it won. (The wording keeps to characters the bundled menu font already has.)
- Upgraded and not yet taken: `status.chick.kuro` with the days left. Taken: only `status.chick.taken`.

On waking, from day 2, if the chick is found, not upgraded, and was not fed the day before: one inner line `chick.hungry.morning`, once that day. It is not a checklist item.

## R7 · Recognising is not a judgement

- The good ending no longer requires the eight objects to be recognised.
- The "right" option no longer changes the judgement (truth) variable or anything else: the three options are three ways of answering, each with its own next line, as now.
- Nothing else may gate on `recognised`. What only shows it (a chip, a card) may stay.

## Strings (zh / en)

| key | zh | en |
|---|---|---|
| status.chick | 小鸡 | Chick |
| status.chick.fed | 今天喂过了 | Fed today |
| status.chick.hungry | 它饿着 | It is hungry |
| status.chick.days | 喂了 {n} 天 | Fed on {n} days |
| status.chick.fight.none | 今天还没上场 | No fight yet today |
| status.chick.fight | 今天上场 {n} 次，帮上了 {w} 次 | Today: {n} fights, helped {w} times |
| status.chick.kuro | 克总在带它，还有 {n} 天 | Kuro has it in hand: {n} more days |
| status.chick.taken | 它是克总的了 | It is Kuro's now |
| battle.hungry | 饿着 | hungry |
| battle.taken | 是克总的了 | Kuro's now |
| battle.win.banner | 大鸡大利，工作顺意！ (the author's, 2026-11-27: "winner winner, chicken dinner" turned round) | Chicken winner, work better! |
| battle.win.grade | 小鸡的胜利使你的工作变得更优秀了。 (the author's own sentence, 2026-11-27) | The chick's win made your work better. |
| chick.hungry.morning | 昨天忘了喂它。 | I forgot to feed it yesterday. |

## Done when

- `tsc` clean, the whole suite green, with new tests for R1–R7 (levels from a log, the offer on every board kind, the strengths, the grade step on a win and nothing on a loss, the three strong days and the taken chip, the status row's four states, the morning line once, the good ending without `recognised`).
- The replay driver still finishes a day (it may ignore the fight).
