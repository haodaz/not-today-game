# The work games make sounds (Claude, 2026-11-16)

battle-sfx gave the battles and the boss fight a chip. The thirteen work games themselves are still
silent: a pair joining in 连连看, a line clearing in the tetris, a mine going off, a box reaching its
mark — nothing. This spec puts the same chip under every game, at five kinds of moment, with four new
recipes. One rule for all, then a table per game so nothing is guessed.

## 1. Four new recipes (`src/world/sound/chip.ts`)

| id | for | recipe |
|---|---|---|
| `tick` | a plain move (a tap, a step, a turn, a rotate) | square 660 Hz, 20 ms, gain 0.6 |
| `match` | a right thing happening (a pair, a clear, a box on its mark, a hit) | square 784 Hz 50 ms, then 1047 Hz 50 ms |
| `wrong` | a mistake (a wrong pair, a leak, a miss) | square 196 Hz with a 30 Hz tremolo (gain 1 ↔ 0.2), 160 ms |
| `clear` | a game done (the task's game won) | square 1047, 1319, 1568 Hz at 70 ms each (a short cousin of `win`) |

`win` (the full jingle), `lose`, `cursor` and `heal` are reused as the tables say. Add the four to
`ChipId`, `CHIP_RECIPES` and the recipe test.

## 2. One function, every state change

`src/world/desktop/workbench/game-sfx.ts` (new): `export function gameChip(field: keyof Session, before: unknown, after: unknown): ChipId | null`
— the sound of a game's state going from `before` to `after`, by the tables below; null when nothing
in the table happened (the same object, or a change the table does not name). It never reads the DOM
and never throws on a null side (a game not yet started, or just cleared).

Where it is called — **every place board.ts replaces a game's session field**, so a line cleared by
gravity sounds like one cleared by a key:
- the `withTally` wrapper (an action: `before` is already there; call `ctx.chip?.(id)` after `noteTally`,
  after the battle-sfx write);
- the timer callbacks (`ctx.later`) that step a game (snake / pacman / tetris ticks, match3's cascade,
  rhythm's sweep, moles' pops, gacha's turn, fill's rounds): capture the field before, call the step,
  then `gameChip`.
- `*-start` and `*-assist` presses: `cursor` first (the press), then the table's sound if any; an assist
  that ends the game sounds `heal`, not `clear`.
A sound plays at most once per state change. A change that the table maps to two things (a merge that
also ends the game) plays the later one only (`clear` / `win` / `lose` beat `match`).

## 3. The tables (read each engine for the exact fields)

| game (field) | `tick` | `match` | `wrong` | end |
|---|---|---|---|---|
| link | a card picked | a pair joined (`left` fell) | a pair that turned back (the tally's mistake) | `done` → `clear` |
| match3 | a tap or swap | a set cleared (each cascade step) | a swap that cleared nothing | `done` → `clear`; no moves left → `lose` |
| snake | a turn key | the snake ate | — | the goal length → `clear`; death → `lose` |
| pacman | a turn key | a line of dots finished (the `lines` field) | — | all eaten → `clear`; caught → `lose` |
| mines | a reveal or a flag | — | — | `won` → `clear`; a mine → `wrong` then `lose` 150 ms later |
| sokoban | a step | a box onto its mark | a box pushed off its mark | solved → `clear` |
| tetris | a key (move, rotate, drop) — never the gravity tick | a line cleared (one `match` per clear, even for several lines) | — | `done` → `clear`; topped out → `lose` |
| pipes | a tile rotated | the flow reached a new tile | a leak | `done` → `clear` |
| moles | — | a mole hit | a miss (an empty hole) | `done` → `clear`; `over` → `lose` |
| rhythm | — | a note hit | a note missed | `done` → `clear`; `over` → `lose` |
| gacha | the crank turned | a capsule opened | — | the last one → `clear` |
| spot | — | a difference found | a wrong click | all found → `clear` |
| fill | a pick | a round settled | — | approved → `clear` |
| chain (stack) | a slide that moved something | a merge | — | 2048 (approved) → `win` (the jingle); `over` → `lose` |

Timed games (snake, pacman, tetris, rhythm, moles) never sound on a tick that changed nothing the
table names; a tick that only moved the snake is silent.

## Tests

- `tests/chip.test.ts`: the four new ids have recipes.
- `tests/game-sfx.test.ts`: for every row of the table, a `before` → `after` pair (made with the
  engine's own functions where cheap, otherwise literal states) gives the named id; the same state
  twice → null; null sides → null; `clear` beats `match` when both happen in one change.
- Actions: with `ctx.chip` a spy, one representative action per game records the expected id (the
  link pair, the mines reveal, the sokoban step…), and a gravity tick in tetris records nothing.
- No snapshot should change.

## Not in this spec

New recipes beyond the four; the battle and the boss (battle-sfx); music; the title drawer's games.
