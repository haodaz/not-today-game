# Day 11's cost sheet as a budget fill (author 2026-11-13, replaces the balance game)

Day 11's work (`content/tasks/day-11.json`, task `work`, 成本表) carries the `balance` game today.
The author finds the scales have too little to do; the day becomes **填格**: a budget buys shapes,
the shapes fill the cells the sheet demands, the sheet grows every round. Four rounds are one game.
What the game is really about (never said): the budget runs out before the appetite does, and the
only pieces left are people.

## The board

- A square grid, some cells marked **要求** (the lines the sheet must cover); the rest blank.
- A tray of **pieces**: polyominoes (1, 2, 3, 4 cells; the usual shapes) each with a **price**.
  A piece is picked from the tray, rotated (R / a ⟳ button), and placed by clicking the anchor cell;
  it must fit inside the grid and not overlap another piece. It may cover blank cells (waste).
  A placed piece can be picked up again (its price refunded) until the round ends.
- A **budget** per round, shown as 预算 N / spent M. Placing pays, lifting refunds.
- The round ends when every 要求 cell is covered: 下一轮. Round 4 done → the board's `approve` op
  (as the other games), then the settlement.
- A second kind of piece appears from round 3: **自己人** — a 1-cell piece per colleague
  (老王, Vivi, 小张, 老周, then 你), **price 0**. Using one greys that name in the tray for the rest
  of the game. Round 4 cannot be passed on the budget alone: the last cells take 自己人.
- Stuck (budget spent, 要求 cells left, no 自己人 left) → 让克总帮忙 (`settle.kuro`, as the other
  games): Kuro fills the rest with 自己人 of his own choosing — all of them, 你 last — and the round
  passes; the judgement reads the game's grade as `wrong` (the quality rule in
  `src/state/days/board.ts`: a game won by Kuro is `wrong`, won by the player `perfect`).

## The four rounds (starting numbers; tune so that a solver finds a solution for every round)

| round | grid | 要求 cells | budget | pieces offered | 自己人 |
|---|---|---|---|---|---|
| 1 | 4×4 | 6 | 20 | 1 (¥3) ×3, I2 (¥5) ×2, L3 (¥7) ×2 | — |
| 2 | 5×5 | 10 | 24 | the same + T4 (¥9) ×1, O4 (¥8) ×1 | — |
| 3 | 6×6 | 16 | 26 | the same ×2 | 4 names (unused) |
| 4 | 7×7 | 24 | 26 | the same ×2 | the names left; 你 appears when the others are grey |

The 要求 layout per round is fixed in `content/tasks/day-11.json` under `board.game`
(`kind: "fill"`, `rounds: [{ size, cells: ["r,c", …], budget, pieces: [{ shape, price, n }] }]`,
`people: ["laowang", "vivi", "xiaozhang", "laozhou", "me"]`) — Claude writes the content;
the loader validates it (shapes from a fixed set, cells inside the grid, prices ≥ 0). Kiro: tell
Claude the exact schema you want and he writes the rounds; do not invent content.

A pure solver test (`tests/fill.test.ts`): each round is solvable with its budget plus the 自己人
available by then; round 4 is **not** solvable on budget alone; a known solution replays.

## The look (`src/world/desktop/workbench/fill.ts`, the work layer)

The cost sheet's own paper: the grid drawn as the sheet's cells (ruled lines, 要求 cells tinted the
sheet's red), the tray at the right as a column of price tags, 预算 / 已用 at the top like a sheet
total. A 自己人 piece is a name tag. Keyboard: R rotates, Esc drops the pick. The round change: the
grid grows in place (a short grow), the previous pieces stay drawn faint under the new grid for a
beat, then clear. The settlement (projection page) shows the real cost sheet with the 人 rows the
player spent struck through — Claude writes those strings when the page is up; say which keys you
need.

## Keep / tests

- The same wiring as the other game boards: `fill-start`, `fill-pick`, `fill-rotate`, `fill-place`,
  `fill-lift`, `fill-next`, `fill-assist`, dev `fill-cheat` (solves the current round); keys through
  `controller.ts` onKey while `session.fill` is up and `session.workShow`.
- The replay driver (`script/tools/auto-day-shoot.mjs`) wins game boards through `[data-action=<game>-cheat]`
  — give it `fill-cheat` that completes all four rounds, and add the one line for it in the driver's
  game list.
- Remove the `balance` game from day 11 only (the code can stay for another day). The day's launch
  page and brief are Claude's.
- Tests: the reducer / pure engine (placement, overlap, budget, refund, round end, 自己人 greying,
  Kuro's fill order), the solver, a view snapshot of round 1, the cheat.
