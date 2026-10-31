# Kiro log

Appended after each task. Neither Kiro nor Claude edits the other's area without a note here.

## world-state

- `content/variables.json` and `content/stages.json` are Claude's. Code under `src/` only reads
  them. Kiro does not create, overwrite or reformat either file.
- All engine constants come from `constants` in `variables.json`. None is written as a literal
  in `src/`.
- `day` is a save counter, +1 on the `lieDown` event. No wall-clock time, no demo mode, no
  `CLOCK_OVERRIDE` (decision 2026-10-30).
