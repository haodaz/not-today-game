# replies — tasks

Each task is under 30 minutes. After every task run `npx tsc --noEmit 2>&1 | tail -20` and
`npx vitest run 2>&1 | tail -20`. Do not commit. Never rewrite a content string; if a task seems to
need story text, leave a TODO for Claude in `docs/kiro-log.md`.

## 1. Reply event shape and loan guard (world-state amendment, D1)
- [x] `reply` event gains optional `recipient` and `text`.
- [x] Loan reducer reacts only to recipient-less replies.
- [x] Tests: a day-5 `no` to the group leaves `loan === "none"`; existing loan tests unchanged.

## 2. Reply table loader and schema guard
- [x] `src/state/replies/table.ts`: glob `content/replies/day-*.json`, normalise `family.json` in as recipient `family`.
- [x] Schema guard: statuses, line keys, `HH:MM`, `readAfter` parsable, `effects` keys (incoming: flags only), known placeholders, known `cond_show` shape.
- [x] `src/world/replies/duration.ts`: `parseDuration`.
- [x] Tests: 18 days × recipients load; guard rejects bad samples; `{nick}` only in family; durations.

## 3. Resolve and menu
- [x] `condHolds` (D4), `objectWordState` (D3), `isDeregistered` (D5), shrink rule (D2).
- [x] `menu(day, recipient, state)` and `resolve(day, recipient, word, state)`.
- [x] Tests: each rule; property FR5 (every menu word resolves to an entry or `gone`, random states).

## 4. Reducer effects and incoming flags
- [x] `applyReplyEvent`: flags, clamped `san`, object word `used`; nothing when gone/deregistered/off-menu.
- [x] `incomingFlags` wired into `derive`; update the world-state `f()` test for derived flags.
- [x] Add reply-with-recipient drafts to the test arbitrary; replay idempotence still holds.

## 5. Placeholders, seed, labels
- [x] `fillPlaceholders(text, names)`; never called by state code.
- [x] Seeded jitter in a range, deterministic per `day:recipient:word`.
- [x] `labelKey`; test every key exists in `zh.json` except the known-missing family keys; TODO note.

## 6. planReply and planGoneClick
- [x] Steps per status (reply, read, typing, recalled, silence, deregistered) plus interrupt; `inner` returned separately.
- [x] Line timing rule against the beat time.
- [x] Unit tests per status.

## 7. planIncoming and evidencePool
- [x] Deliver items whose condition holds, by `t`; `noReadReceipt` for odd; `placement` (D6).
- [x] `evidencePool(state)` with ids `incoming:{day}:{recipient}:{index}`.
- [x] Tests.

## 8. Snapshots (FR5)
- [x] Day 1 boss `salary`, day 5 group `no`, day 13 xiaozhang every word, day 15 family incoming.
- [x] Log decisions D1–D7 and the string TODOs in `docs/kiro-log.md`.
