# Meters v2 — the UI side (author 2026-11-12; numbers Claude's)

The **model is already in** (commit bda340a): `content/variables.json` carries the constants
(`handSan*`, `chatSanLateFrom` / `chatSanLate` / `chatSanTaboo`, `stareSan` / `stareMs`); the
reducers take the costs (`src/state/events.ts`: the `chat` turn costs and the new `stare` event;
`src/state/days/board.ts`: a game board's night verdict comes from the task event's `quality`, and
on hand nights the hand's own cut is added — `handCost`). Do not change the rules or the numbers.
This spec is what the player sees and the two things the runtime must produce: each game's grade,
and the stare events. No text is written here: every line is a strings key Claude adds; a missing
key is reported, not invented.

## 1. Every game grades its own play → `task.quality`

When a game board is printed (the `task` event with `slots` in `src/world/desktop/workbench/board.ts`,
~line 1468), add `quality: "perfect" | "flawed" | "wrong"` from the game session's own grade. Each
engine exports `grade(session): BoardVerdict` (pure, from the session's numbers it already keeps):

| game | perfect | flawed | wrong |
|---|---|---|---|
| link (d4) | no mistaken pair | ≤ 2 mistaken pairs | more |
| match3 (d5) | cleared with ≥ 3 moves left | cleared | ran out / assisted |
| snake (d6) | no death | one death | more |
| pacman (d7) | all dots, no ghost hit | all dots, hit once | otherwise |
| mines (d8) | no mine hit | one | more |
| sokoban (d9) | ≤ par moves | ≤ par × 1.5 | more |
| spot (d10) | 0 misses | ≤ 3 misses | more |
| balance (d11) | every bar inside tolerance at submit | one outside | more |
| tetris (d12) | target lines, never within 2 rows of the top | target lines | topped out / assisted |
| board (d13, 2048) | reached 2048 | reached 1024 | less |
| pipes (d14) | no leak | one leak | more |
| moles (d15) | ≥ 90 % hits | ≥ 70 % | less |
| rhythm (d16) | ≤ 2 misses | ≤ 6 | more |
| gacha (d17) | ≤ 3 pulls | ≤ 6 | more |

A game solved with Kuro's assist (`assists > 0`) is at best `flawed`. The settlement card shows the
grade as one short line under the result: `settle.quality.perfect` / `.flawed` / `.wrong` (strings,
Claude). Tests: each engine's `grade` on fixture sessions; the printed task event carries it; the
night's `boardJudge` reflects it (the model test `tests/meters-v2.test.ts` already covers the rule).

## 2. The stare countdown → `stare` events

Some things cost SAN when looked at too long. The runtime keeps one timer per *stare target* in the
session: it starts when the target is in view and nothing else is open (no dialogue, no window), is
reset when the view changes, and at `stareMs` appends `{ kind: "stare", target }` **once per target
per day** (check the day's log before appending). Targets and when they exist:

| target | view | from day |
|---|---|---|
| `gap` | the desk / 桌子 view with the gap between the monitors dark | 4 |
| `window` | the window view at night (evening / night beats) | 7 |
| `photo:<day>:<facing>` | a developed room photo open large whose content entry has an anomaly (`photosTable`'s rows with `add`) | when developed |
| `mask` | the bed view on day 10 (the mask on the bed) | 10 |
| `box` | the carton by the door, day 18 | 18 |

While the timer runs the heart-rate chip in the HUD climbs visibly (its number rises toward the
0-SAN rate over the `stareMs`), which is the countdown the author asked for; when the event fires the
chip jolts once and an inner line plays from `stare.<target-kind>` (`stare.gap`, `stare.window`,
`stare.photo`, `stare.mask`, `stare.box`; Claude writes them). After it fired, the timer does not run
again for that target that day. The headless replay must never trigger it by accident: the driver
moves on within a second, so no change there.

## 3. The chat's late turns

From the `chatSanLateFrom`-th turn of a day, the chat input's turn counter turns the SAN colour
(the heart-rate chip's red) and a one-line hint shows under the input once per day:
`chat.late` (strings, Claude). No other change: the reducer already takes the cost.

## 4. The hand's cut

On hand nights the hand's pause before it withdraws scales with the verdict it is about to get
(perfect: as now; flawed: + 1 s; wrong: + 2.5 s), and the judgement line that plays at 躺下 is
followed by the hand's own line `hand.cut.<verdict>` / `hand.cut.refused` (strings, Claude) only on
those nights. The SAN shown after 躺下 is already the combined number.

## Tests
- `grade()` per engine; `quality` on the printed task event; the settlement line.
- The stare timer: starts / resets / fires once per target per day; the chip climbs; no event in a
  headless run that leaves the view within a second.
- The late-turn hint once per day; the hand's lines per verdict.
- Snapshots: one settlement card with the grade; the HUD chip mid-countdown.
