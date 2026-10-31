# world-state — Tasks

Each task is sized to under 30 minutes. Run `npm test` (the whole suite, including the property
tests written so far) after every task, and commit at the end of every task with the tick in the
same commit. If a task would require writing a story string, stop and leave a TODO for Claude.

Plan changes 2026-10-30: `day` is a save counter (+1 on `lieDown`), no real-time clock, no demo
mode, no `CLOCK_OVERRIDE`; `content/stages.json` is plan B (cycles, ring, calmDaytime, tenderDay,
dreamNights, nightBeat); all constants come from `content/variables.json` `constants`.

## 1. Scaffold Vite + TypeScript project
- [x] `package.json` with `vite`, `typescript`, `vitest`, `fast-check` (pinned versions).
- [x] `vite.config.ts`, `tsconfig.json` (strict), alias `@content` → `content/`, `@state` → `src/state`.
- [x] `npm run dev` boots an empty page; `vitest --run` passes with no tests.
- [x] Create empty `src/state/` directory.

## 2. Read content schema, confirm defaults, log note
- [x] Read `content/variables.json` and `content/stages.json` (Claude's files). Do **not** create or overwrite them.
- [x] A test confirms every variable in `variables.json` has a `default`, and that `constants` has the keys the code needs.
- [x] Note in `docs/kiro-log.md` that both files are Claude's and code only reads them.

## 3. variables.ts — loader, defaults, validate
- [x] Load `content/variables.json`; expose `VariableTable`, `constants`, `defaults()`, `validate(state)`.
- [x] `validate` checks type and range for every variable; throws with the offending key on failure.
- [x] Tests: `defaults()` matches the table; `validate` accepts defaults and rejects out-of-range.

## 4. Codegen typed state interface
- [x] `scripts/gen-state-types.ts` reads `content/variables.json`, emits `src/state/types.gen.ts` (a `State` interface + `DO NOT EDIT` header).
- [x] `State` covers **every** variable in the table (currently: `day`, `stage`, `found`, `recognised`, `chickFrame`, `pagerUnread`, `repliedNumbers`, `translated`, `dream`, `readCount`, `replyOptions`, `objectWords`, `loan`, `balance`, `overdueDays`, `newWorld`, `san`, `letItDoUnchecked`, `raids`, `pokedReset`, `names`, `flags`, `affinity`, `chatTurnsToday`, `chatMemory`, `judgement`).
- [x] `npm run gen:state` script; `npm test` fails if `types.gen.ts` is out of date.
- [x] Test: regenerating when the file is up to date is a no-op; generated keys match the table.

## 5. stages.ts
- [x] Load `content/stages.json`. `stageOf(day)` = `byDay[String(day)] ?? afterDay18`.
- [x] `ringOf(day)` from `cycles` (after the last cycle, the last cycle's ring); `isCalmDaytime(day)`, `isTenderDay(day)`, `nightBeatOf(day)`, `dreamNights`. Read-only accessors, nothing hardcoded.
- [x] Tests: for every day `1..constants.lastDay`, `stageOf` and `ringOf` equal the table; `stageOf(25) === afterDay18`.
- [x] Property test: `stageOf(day)` is monotonic non-decreasing.

## 6. clock.ts
- [x] `Clock` interface (`now(): Date`), `realClock`, `fakeClock(iso)`. Cosmetic only; never feeds `day`.
- [x] `debugStartDay(search)`: parse `?day=N` from a URL query string, `null` when absent or invalid.
- [x] No demo mode, no `CLOCK_OVERRIDE`.
- [x] Tests: `fakeClock` is deterministic; `debugStartDay` accepts `?day=7`, rejects `?day=0`, `?day=abc`, and a missing param.

## 7. events.ts — union + applyEvent (non-loan)
- [x] Discriminated union for all 12 kinds with the payloads in design §4, plus a recorded `day`.
- [x] `applyEvent` for the reducers this spec defines: `openLayer`→`found`, `recognise`→`recognised`, `pokeReset`→`pokedReset`, `letItDo`→`letItDoUnchecked`, `lieDown`→`day += 1`.
- [x] Other kinds (`pressKey`, `looked`, `sitUp`, `handObject`, `handLost`, `handNothing`, and `reply` apart from the loan choices in task 8) are documented no-ops; every field not listed passes through untouched.
- [x] Tests: the five reducers mutate the expected field; no-op kinds leave state `deep-equal`; `day` changes only on `lieDown`.
- [x] Property test: `day === startDay + count(lieDown)` for any event list.

## 8. fday.ts + replay.ts + loan
- [x] `fday.ts`: `f(startDay)` = `defaults()` with `day = startDay`. `derive(state)` sets `stage = stageOf(day)` and `overdueDays = constants.overdueBase + day`, and applies the loan repayment.
- [x] Read `loanReplyDay`, `repayDay`, `loanAmount`, `overdueBase` from `constants`. Never write them as literals.
- [x] `replay.ts`: `fold(events, base) = events.reduce(applyEvent, base)`; a `reply` stamped `loanReplyDay` with `choice: "lend"` sets `loan = "lent"` and `balance -= loanAmount`; `"no"` sets `loan = "refused"`.
- [x] `derive`: if `loan === "lent"` and `day >= repayDay` → `loan = "repaid"`, restore `balance`.
- [x] Tests: none / lent / repaid / refused across `repayDay − 1` and `repayDay`; `balance` follows.
- [x] Property test: `overdueDays === constants.overdueBase + day` for days `1..constants.lastDay`.

## 9. store.ts — computeState + API
- [x] `computeState(startDay, events) = fold(events, f(startDay))`, where `fold` derives after every event.
- [x] `getState()`, `subscribe(fn)`, `appendEvent(draft)` (stamps the event with `state.day`; a rejected event commits nothing).
- [x] Integration test: a 200-event log replayed twice is `deep-equal`.
- [x] Property test: replay is idempotent.

## 10. saves.ts — two slots, versioning, isolation
- [x] `nt_run` (`{ version, startDay, day, events }`) + `nt_profile`; atomic write (`X.tmp` → rename; previous → `X.bak`).
- [x] Integer `version`; stepwise `migrations[]` (N → N+1, never skip); load runs forward; reject a run save whose `day` disagrees with `startDay` + `lieDown` count.
- [x] `clearRun()` deletes only `nt_run`; profile accessor is the only reader of `nt_profile`.
- [x] Tests: profile write leaves run save unchanged; `clearRun` leaves profile unchanged; one-step migration.

## 11. Property tests — collect and close the gaps
- [x] Confirm each property from requirements §5 exists and passes: `stage(day)` monotonic, replay idempotent, `overdueDays` for `1..lastDay`, `day` counter.
- [x] Run them with a high `numRuns` once and record the result in `docs/kiro-log.md`.
