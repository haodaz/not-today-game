# san-and-endings — tasks

- [x] 1. `ending` variable (variables.json + types.gen) and the `ending` event; nothing after it.
- [x] 2. `src/state/endings.ts`: bands, bpm, good conditions, due-at-shutdown / due-at-lie-down.
- [x] 3. Runtime: bad at the shutdown step; the last night's lie-down appends survive / good (or
  bad if SAN reached 0 after the last shutdown, E7).
- [x] 4. 你和你 from the log (E3); credits from evidence (E4) and the roll clock.
- [x] 5. Ending pages and the host hooks (clear run, profile runs + 1, home / new run).
- [x] 6. SAN bands in CSS (cup, room, grain); bpm from constants.
- [x] 7. Tests (FR4): `tests/endings.test.ts`; saves test updated for `increment`.
- [ ] 8. TODO(Claude), strings: `ending.next`, `ending.youAndYou` (你和你), `ending.firstDay`
  (第一日), `ending.day19`, `credits.dim.truth` / `.values` / `.bond`, `credits.last.bad` /
  `.survive` / `.good` (good's is the hand-written red/blue line).
- [ ] 9. Title page (title-page spec): `endingHost` goes there instead of reopening the game.
