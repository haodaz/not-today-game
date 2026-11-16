# Game swaps (author, 2026-11-16): 华容道 on day 17, 跟读 on day 7, 数织 on day 12

The author compared each day's game with a proposal and decided:
「17换，最后让出来的地方，要通过一根触手。11不要换。7可以换，但是吃豆人游戏好，有别的地方能用吗」 — then
「12天那个可以」 for the nonogram, and for day 18: 「18天能不能先是吃豆人，然后最终战并不是工作任务，而是一个最后
的战斗。」

So: day 17 回电话 gacha → **klotski** (华容道); day 7 晨会纪要 pacman → **echo** (跟读, repeat the roll call);
day 12's side task 对账结果看一眼 gets a small **nonogram** (数织); day 11 stays; **pacman stays as a module**
for day 18 (its content comes later, from Claude). The gacha goes away entirely.

Strings for the three new stages are already in `content/strings` (`klotski.stage.*`, `echo.stage.*`,
`nonogram.stage.*`, zh and en). Do not add or change strings; a missing one is a question for Claude.
Never edit `content/`: the day files keep their old games until the parser accepts the new ones;
tests use the inline fixtures below; Claude flips the content afterwards.

Every new game follows the pattern the other stages use (`src/world/desktop/workbench/sokoban.ts`
is the model): a pure engine + view in one file, its session in `model.ts`, its actions in `board.ts`
wrapped by `withTally`, a `grade()` for `grades.ts` (`FIELD`), sounds in `game-sfx.ts`, a keyboard
hook in `controller.ts` where keys are used, the stage picked in `compare.ts`'s `genericWorkLayer`
chain, and a test file of its own. The stage opens from 开始工作 only (`.kiro/specs/work-mode`); it is
modal until the task is handed in; the hand-in sits in its foot row. The play field keeps the
original game's plain look (author: homage games keep their look); the day's texture goes on the
surround.

## 1. Klotski, day 17 回电话 (`workbench/klotski.ts`)

Content shape (parser in `src/state/days/tasks.ts`, next to `gacha`, which it replaces):

```json
"game": { "kind": "klotski", "slot": "r1",
  "level": ["xNNy", "xNNy", "AABB", "CCDD", "s..t"],
  "blocks": { "A": { "card": "c1", "label": "青禾" }, "B": { "card": "k1", "label": "克总" },
              "C": { "card": "d1", "label": "老王" }, "D": { "card": "d2", "label": "Vivi" } } }
```

- `level`: 4 columns × 5 rows. An upper-case letter is a named block (`blocks[letter]`, card + label);
  a lower-case letter is a nameless block (`x`, `y` 1×2 standing; `s`, `t` 1×1); `N` is the nameless
  big block (2×2, no entry in `blocks`); `.` is empty. The door is under the bottom row at columns 2–3.
  Parser: rectangular, each letter one solid rectangle, exactly one `N`, every upper-case letter in
  `blocks` and vice versa, `slot` a slot id, every `card` a tray or Kuro card (like gacha's eggs).
- Claude checked this layout with a solver: 老王 and Vivi get out in 8 moves, 青禾 and 克总 in 19, the
  big block never (it is 2 wide, but no reachable state lets it out). The wrong calls are the easy
  ones; that is the point.
- The stage appears once every slot **except** `game.slot` is filled and the form is not approved
  (the gacha needed all slots; here the game decides `r1`). Controls: click a block to pick it, arrow
  keys (and WASD) push it one cell; drag by one cell is fine too. 退一步 undoes a move, 重排 restarts
  (a `fails` tally). Moves are counted (`klotski.stage.moves`).
- A 2-wide block standing on the bottom row at columns 2–3 that is pushed down leaves through the
  door: the engine marks it out; the actions append `boardStep { t: "slot", slot: game.slot, card }`
  (overwriting whatever was there, Kuro's fill included) and then `boardStep { t: "approve" }`. The
  existing `fill:r1` / `fill:r1:d1` / `fill:r1:d2` / `kuro` beats in day 17's content already say
  the line for each caller; nothing new to write.
- After the exit (≈ 900 ms slide out), the door stays open and **a tentacle comes in through it**
  (author): one dark tentacle, drawn in CSS or with `/objects/icons/tentacle-overlay.png`, enters
  from the door and lies across the board over the blocks for the rest of the stage, slow, no sound
  beyond the game's. Foot: `klotski.stage.won {name}` then `klotski.stage.left`; `klotski.stage.nameless`
  is the sub-line once the big block has been clicked at least once.
- `grade()`: the block out is `slots[game.slot].answer` → `byCount(moves, 30, 60)` (perfect / flawed
  / wrong), `capAssisted`; any other block out → `wrong`. Not out → `wrong`.
- Remove gacha: `workbench/gacha.ts`, `tests/gacha.test.ts`, the `gacha` session in `model.ts`, its
  branches in `board.ts`, `compare.ts`, `grades.ts`, `tally.ts` (the "pulls" comment), `game-sfx.ts`
  and its test rows, `loop/guide.ts`, the `.gc-*` rules in `desktop.css`, the parser branch and the
  `BoardGame` member. Claude removes `gacha.stage.*` strings afterwards.

Test fixture: day 17's `work` board with the `game` above in place of its gacha (build it in the
test from `taskByFlag` + spread). Assert: the parser accepts it and rejects a level with two `N`;
the stage shows with r2–r4 filled and r1 empty; a push into a wall is no move; 老王 out in 8 moves
writes `slot r1 = d1` then `approve` and grades `wrong`; 青禾 out in 19 grades `perfect`, in 50
`flawed`; 退一步 restores; the tentacle class appears after the exit.

## 2. Echo, day 7 晨会纪要 (`workbench/echo.ts`)

Content shape (replaces `pacman` on day 7's `task4`):

```json
"game": { "kind": "echo",
  "voices": [ { "who": "boss", "line": "王。两百。" }, { "who": "laozhou", "line": "亲王。二十六。" },
              { "who": "partner", "line": "公爵。三十一。" }, { "who": "xiaozhang", "line": "伯爵。三十六。我是第七十二个。" },
              { "who": "me", "line": "研发。编制一个。" }, { "who": "m1", "line": "" } ] }
```

- `voices`: 3 to 8 entries; every `who` must be a `meeting.people` id of the same board (parser);
  `line` may be empty (a voice with nothing to say). Rounds = `voices.length`.
- The stage appears once the minutes are filled (all slots) and not approved, as pacman did. The
  field is the meeting's seat grid: one tile per voice in `voices` order, the person's `tile` image
  and name (`me` as 你; `m1` is the camera that is off: its silhouette tile, no name). Nothing else of
  the meeting view on the stage.
- Round k (1-based): the first k voices "report" in order — each tile lights for 700 ms with its
  `line` in a bubble (an empty line = the tile goes dark instead of lit, 700 ms), 250 ms between.
  Then `echo.stage.yours`: the player clicks tiles; each click lights the tile; a click out of order
  ends the round at once (`echo.stage.wrong`, `fails` + 1) and 重来 replays the same round. The k-th
  correct click ends the round; after a 600 ms beat the next round plays. The last round's last
  voice is the empty one: the player's final click is the dark tile.
- The last round done → `boardStep approve`; foot `echo.stage.won` then `echo.stage.left`.
- Keyboard: none (clicks). Sounds: a short tone per lit tile (pitch by index), a low thud for the
  empty one, the wrong buzz from the other games.
- `grade()`: `byCount(fails, 0, 2)` with `capAssisted`; not finished → `wrong`.
- Pacman stays: `workbench/pacman.ts` and `pacman.stage.*` untouched; `tests/pacman.test.ts` builds
  its maze from an inline fixture instead of day 7's content, and its "day 7's board is a pac-man"
  case goes.

Test fixture: day 7's `task4` with the `game` above. Assert: parser accepts it and rejects an unknown
`who`; round 1 plays one voice; a wrong click fails the round and 重来 replays it; six rounds with
no mistake approve and grade `perfect`; two fails `flawed`; the empty voice renders dark.

## 3. Nonogram, day 12 对账结果看一眼 (`workbench/nonogram.ts`)

This is a plain task (no board), so it is the first side game: a plain task may carry a `game`, and
picking **自己做** plays it before the task's `self` branch runs.

Content shape on `task1` of day 12 (parser: `task.game` allowed on a plain task, only `nonogram` for now):

```json
"game": { "kind": "nonogram", "picture": ["#...#", ".###.", "##.##", ".###.", "#...#"] }
```

- `picture`: 3–10 rows of equal length in `#` / `.`; the parser derives the row and column clues
  (runs of `#`). Claude checked this one has a single solution (an eye with lashes).
- Flow: the task's `start` options show as today; choosing `self` opens the stage (`workShow` for a
  plain task: `workLayer` renders the nonogram stage when the task named has a `game` and no board)
  instead of running `self.say` at once. 看一眼 and 让它做 are unchanged and never show the picture.
- The stage: the clue numbers along the top and left, the grid of cells, click to fill, click again
  to clear, right-click or a second mode to mark a dot (optional). A wrong fill (a `.` cell) flashes
  red, clears itself and counts a mistake (`nonogram.stage.mistakes`). When every `#` cell is filled
  and no `.` cell is, the picture resolves: the grid lines fade, the clues go, the eye stays for
  1.2 s; foot `nonogram.stage.won` then `nonogram.stage.left`, and the hand-in button; hand-in runs
  the task's `self` branch exactly as choosing 自己做 does today (its `say`, `effects`, flags), with the
  `task` event's `quality` from `grade()`.
- `grade()`: `byCount(mistakes, 0, 3)`; unfinished → `wrong`.
- Sub-line `nonogram.stage.hint` under the title until the first fill.

Test fixture: day 12's `task1` with the `game` above. Assert: clues derive right; a wrong fill counts
and clears; the solved grid approves and the self branch's flags land with the grade; 让它做 skips the
stage.

## 4. Cleanup and tests

- `tests/grades.test.ts`, `tests/game-sfx.test.ts`: gacha rows out, the three new games in.
- `tests/tasks*.test.ts` (content validation): the day files still carry the old games until Claude
  flips them; the parser must keep accepting `pacman` on a meeting board.
- Snapshots change for markup only; Claude refreshes them after checking.
- Do not touch `content/`, `script/`, strings, or the replay driver. Commit nothing.

Out of scope: day 18's pacman work and the final battle (content and design, Claude, later); the
day 7 and 9 seating drawing; days 1–3.
