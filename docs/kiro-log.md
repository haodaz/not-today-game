# Kiro log

Appended after each task. Neither Kiro nor Claude edits the other's area without a note here.

## world-state

- `content/variables.json` and `content/stages.json` are Claude's. Code under `src/` only reads
  them. Kiro does not create, overwrite or reformat either file.
- All engine constants come from `constants` in `variables.json`. None is written as a literal
  in `src/`.
- `day` is a save counter, +1 on the `lieDown` event. No wall-clock time, no demo mode, no
  `CLOCK_OVERRIDE` (decision 2026-10-30).
- 2026-10-31 07:36 · world-state task 11: FC_RUNS=5000 vitest run → 13 files, 210 tests passed in 0.8 s (stage(day) monotonic, replay idempotent + prefix-monotonic, overdueDays 1..lastDay, day counter). Run by Claude; Kiro's last attempt returned no output.

## replies

- `content/replies/` and `content/strings/` are Claude's. `src/state/replies/table.ts` reads,
  checks and freezes the 18 day files and `family.json`; no string is rewritten. The schema guard
  is strict (unknown keys, statuses, placeholders, times, readAfter all fail at import), so a new
  content feature is noticed instead of ignored.
- world-state amendment: `reply` events gain optional `recipient` and `text`. The loan reducer
  only reacts to recipient-less replies, so saying `no` in a conversation on day 5 no longer
  refuses the loan (D1). `derive` now also adds the flags of every incoming message for days
  1..day (incoming effects may only be flags, so this stays idempotent).
- Decisions waiting on the author (all in `.kiro/specs/replies/design.md` §2):
  - D3 object words are one use, globally, per FR1. That leaves most lent-word cells
    unreachable (e.g. `no` has 70 cells, only the first one sent ever plays). Please confirm or
    say "per day" / "per recipient".
  - D4 `cond_show: {has: "lent"}` holds for loan `lent` and `repaid`; a failed condition on an
    entry plays the neutral "read, no reply".
- TODO(Claude), content suggestions so code can drop two hardcoded markers:
  - a structured "account deregistered" field (code now keys off flags `xz_left`, `lz_gone`);
  - a structured placement for the day-15 family message (code now keys off `family_in_input`).
- Strings: every chip in all 19 tables has a label in `zh.json` (the family keys were added
  before this spec started). No string TODO.
- Timing constants (typing 4–8 s, recall 2–5 s) are named constants in
  `src/world/replies/plan.ts`; they come from the replies spec, not `variables.json`. Claude may
  move them into `constants` if they should be tunable as content.
