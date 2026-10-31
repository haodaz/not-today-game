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

## replies (revision 2026-10-31)

- Lent words follow the author's decision: available every day to every recipient while the
  object is held; `objectWords[x].used` only records the first use; struck through (reason
  `lost`) once the object is lost to the hand, or when the day's table marks it `gone`.
- Held / lost lives in `src/state/objects.ts`, shared with delivery. Because a lent word now
  plays repeatedly, its entry's `effects` apply each time it is sent; desktop-ui should offer
  each chip once per conversation per day.

## delivery

- `content/delivery.json` is Claude's; `src/state/delivery/table.ts` reads, checks (strictly) and
  freezes it. Nothing is rewritten; receipts with a chosen item are composed for display only.
- world-state amendment: three event kinds, `order {meal, shopId, itemId, t}`, `pickup {meal}`,
  `useItem {itemId, objectId}`. Orders and pickups stay in the event log; `State` only gets flags
  (the variable table has no field for orders).
  TODO(Claude): add a variable if orders should be state.
- `derive` also adds the flags of meals that never arrive (day 16 `no_delivery`, day 18
  `slip_ready`) from that day's morning.
- Reading needed from the author or the night-hand spec: `raids[night].blockedWith` is taken to
  be the object handed to the hand (lost). Day 17's `objects_returned` pickup brings back
  everything handed over on earlier nights, in night order. Nothing writes `raids` yet, so in real
  play nothing is lost and the day-17 bag is empty until the night-hand spec lands.
- Shop drift is read as cumulative from each ring on (the note says 起). The day-10 calm daytime
  shows the list undrifted.
- TODO(Claude), strings and content:
  - `delivery.shop.closed` (closed-shop label) is not in `zh.json`;
  - the typo drift swaps two adjacent characters of one shop name; authored typo names would
    replace this.
