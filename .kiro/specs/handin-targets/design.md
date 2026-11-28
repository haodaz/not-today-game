# handin-targets · design

- One map, `DELIVERABLE_TARGETS` in `src/state/days/tasks.ts` next to `DELIVERABLE_TO`: per target
  `{ conversation, name, receives }`. `merge` → `g_merge` / `msgs.g_merge` / receives; `kuro` → no
  thread / `kuro.name` / does not receive (its own `print` beat speaks). `deliverableTarget(to)`
  reads it (null for an absent `to`).
- Readers: `transcript.ts` (file card thread), `shell.ts` `forWhom` (the 交给 chip), `runtime.ts`
  (the `task.sent` line), `game.ts` (taskHome landing: boss / partner / group as before, anything
  unknown → boss as before, merge → g_merge, kuro → no landing). `board.ts` `finishLabel` already
  keys `board.send.<to>` / `board.sent.<to>` with no boss fallback.
- R1's day check: `checkHandinTargets(day, tasks, recipients)` (pure, in tasks.ts). The loader
  cannot see the reply tables (state/replies reads the days), so a test runs it over the real content.
- Content: `script/tools/handin-targets-content.mjs` adds the four strings and changes the eight
  `"to"` lines in place (each file must have exactly one).
