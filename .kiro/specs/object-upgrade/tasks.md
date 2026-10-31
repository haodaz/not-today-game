# object-upgrade — tasks

- [x] 1. Read `content/upgrades.json` with a strict guard (`src/state/upgrades.ts`).
- [x] 2. Events `upgrade` / `declineUpgrade`, with reducers, rejection rules and judgement deltas
  plus evidence.
- [x] 3. `currentOffer`: per-object offer, one nag, the day-13 final offer, and the after-final
  rule.
- [x] 4. Small window offer block and the `upgrade-yes` / `upgrade-no` actions.
- [x] 5. Upgraded word → `hidden`; night choices hidden and rejected for upgraded objects.
- [x] 6. Desk bar upgraded slot (hi-res icon).
- [x] 7. Tests: property, snapshots (day 5 / 8 / 13, desk bar), unit.
- [ ] 8. High-resolution device screens and `gain` outputs (device specs).
- [ ] 9. The child's corrected text (needs a content field; TODO Claude).
- [ ] 10. Good ending counts upgraded objects as unable to block (san-and-endings).
