# The game's grade survives a reload (Claude, 2026-11-15): the `graded` event

meters-v2 §1 grades every game from the session (`gradeGame` in
`src/world/desktop/workbench/grades.ts`). The session dies with the tab: a player who wins the game,
reloads the page and then presses 提交 hands in a `task` event with no `quality`, and the night judges
the work as if it were perfect. (fill is the exception — it keeps its record in the log.) This spec
puts the grade in the log as the play goes, so a reload changes nothing.

## 1. The event (`src/state/events.ts`)

- New kind: `{ kind: "graded"; day: number; task: string; quality: BoardVerdict }` — the grade of the
  play on this task's game as it stands after an action. Add it to the kinds list next to `"stare"`.
- Reducer: `applyGraded` validates and returns the state unchanged. `task` must be a token
  (`/^[a-z][a-z0-9:_-]*$/i`), `quality` one of `perfect | flawed | wrong`; anything else throws with
  the event's name in the message, like `applyStare` does.
- `derive` / replay: no state effect, so idempotence and prefix-monotonicity hold as they are.

## 2. Writing it (`src/world/desktop/workbench/board.ts`)

In `withTally`, after `noteTally`: compute `gradeGame(c.board, c.task.id, day, ctx.session, events)`.
If it is non-null and differs from the **last** `graded` event for `(day, c.task.id)` (or there is
none), `ctx.store.appendEvent({ kind: "graded", task: c.task.id, quality })`. Same grade twice in a
row writes nothing, so a task leaves at most a few `graded` events (a `wrong` at the first move, a
`perfect` or `flawed` when it is done, maybe a `wrong` again after a restart).

Only the actions `withTally` already wraps (the games in `FIELD`); `spot` and `fill` are not touched.

## 3. Reading it (`grades.ts`)

`gradeGame`: where a game's session is gone (`own(...)` is null) and the board has a game in `FIELD`,
return the quality of the last `graded` event for `(day, taskId)` instead of null. The session, when it
exists, still wins. Export a helper `gradedInLog(events, day, taskId): BoardVerdict | null` for this
and for the tests. Update the function's comment (the "as before this spec" sentence is no longer
true).

## Tests

- `tests/events.test.ts`: `graded` validates (bad task, bad quality throw; a good one leaves the
  state identical).
- `tests/grades.test.ts`: a win writes `graded: perfect`; the same grade twice writes one event; a
  restart after a loss writes `wrong` once; with the game's session cleared (as after a reload) and a
  `graded` in the log, `gradeGame` returns that grade; with neither it returns null; `printBoard`'s
  `task` event carries the grade from the log after the session is cleared.
- The replay tests should still pass unchanged; if a snapshot of an event log changes only by added
  `graded` events, refresh it and say so in the log.

## Not in this spec

Changing any grade rule; `spot` (its grade is the tally's and the tally is session-only — a known,
accepted gap); the night's judgement.
