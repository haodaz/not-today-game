# pager-foreign — tasks

- [x] 1. R1: strict loader for `content/pager-foreign.json` (`parseForeign`, `pagerForeign` in `src/state/hands.ts`); optional until Claude writes the file; kid.json untouched.
- [x] 2. R2: foreign pages arrive at their `t` on the game clock (`arrivedMessages` with the clock time), newest first with the child's message; 读 / ↑ / ↓ unchanged; a page that comes after 读 lights the envelope again; only its digits.
- [x] 3. R3: tests (`tests/pager-foreign.test.ts`, fixture pages). Log entry in docs/kiro-log.md.
