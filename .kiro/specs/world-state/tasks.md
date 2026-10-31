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
- [ ] Read `content/variables.json` and `content/stages.json` (Claude's files). Do **not** create or overwrite them.
- [ ] A test confirms every variable in `variables.json` has a `default`, and that `constants` has the keys the code needs.
- [ ] Note in `docs/kiro-log.md` that both files are Claude's and code only reads them.

## 3. variables.ts — loader, defaults, validate
- [ ] Load `content/variables.json`; expose `VariableTable`, `constants`, `defaults()`, `validate(state)`.
- [ ] `validate` checks type and range for every variable; throws with the offending key on failure.
- [ ] Tests: `defaults()` matches the table; `validate` accepts defaults and rejects out-of-range.

## 4. Codegen typed state interface
- [ ] `scripts/gen-state-types.ts` reads `content/variables.json`, emits `src/state/types.gen.ts` (a `State` interface + `DO NOT EDIT` header).
- [ ] `State` covers **every** variable in the table (currently: `day`, `stage`, `found`, `recognised`, `chickFrame`, `pagerUnread`, `repliedNumbers`, `translated`, `dream`, `readCount`, `replyOptions`, `objectWords`, `loan`, `balance`, `overdueDays`, `newWorld`, `san`, `letItDoUnchecked`, `raids`, `pokedReset`, `names`, `flags`, `affinity`, `chatTurnsToday`, `chatMemory`, `judgement`).
- [ ] `npm run gen:state` script; `npm test` fails if `types.gen.ts` is out of date.
- [ ] Test: regenerating when the file is up to date is a no-op; generated keys match the table.

## 5. stages.ts
- [ ] Load `content/stages.json`. `stageOf(day)` = `byDay[String(day)] ?? afterDay18`.
- [ ] `ringOf(day)` from `cycles` (after the last cycle, the last cycle's ring); `isCalmDaytime(day)`, `isTenderDay(day)`, `nightBeatOf(day)`, `dreamNights`. Read-only accessors, nothing hardcoded.
- [ ] Tests: for every day `1..constants.lastDay`, `stageOf` and `ringOf` equal the table; `stageOf(25) === afterDay18`.
- [ ] Property test: `stageOf(day)` is monotonic non-decreasing.

## 6. clock.ts
- [ ] `Clock` interface (`now(): Date`), `realClock`, `fakeClock(iso)`. Cosmetic only; never feeds `day`.
- [ ] `debugStartDay(search)`: parse `?day=N` from a URL query string, `null` when absent or invalid.
- [ ] No demo mode, no `CLOCK_OVERRIDE`.
- [ ] Tests: `fakeClock` is deterministic; `debugStartDay` accepts `?day=7`, rejects `?day=0`, `?day=abc`, and a missing param.

## 7. events.ts — union + applyEvent (non-loan)
- [ ] Discriminated union for all 12 kinds with the payloads in design §4, plus a recorded `day`.
- [ ] `applyEvent` for the reducers this spec defines: `openLayer`→`found`, `recognise`→`recognised`, `pokeReset`→`pokedReset`, `letItDo`→`letItDoUnchecked`, `lieDown`→`day += 1`.
- [ ] Other kinds (`pressKey`, `looked`, `sitUp`, `handObject`, `handLost`, `handNothing`, and `reply` apart from the loan choices in task 8) are documented no-ops; every field not listed passes through untouched.
- [ ] Tests: the five reducers mutate the expected field; no-op kinds leave state `deep-equal`; `day` changes only on `lieDown`.
- [ ] Property test: `day === startDay + count(lieDown)` for any event list.

## 8. fday.ts + replay.ts + loan
- [ ] `fday.ts`: `f(startDay)` = `defaults()` with `day = startDay`. `derive(state)` sets `stage = stageOf(day)` and `overdueDays = constants.overdueBase + day`, and applies the loan repayment.
- [ ] Read `loanReplyDay`, `repayDay`, `loanAmount`, `overdueBase` from `constants`. Never write them as literals.
- [ ] `replay.ts`: `fold(events, base) = events.reduce(applyEvent, base)`; a `reply` stamped `loanReplyDay` with `choice: "lend"` sets `loan = "lent"` and `balance -= loanAmount`; `"no"` sets `loan = "refused"`.
- [ ] `derive`: if `loan === "lent"` and `day >= repayDay` → `loan = "repaid"`, restore `balance`.
- [ ] Tests: none / lent / repaid / refused across `repayDay − 1` and `repayDay`; `balance` follows.
- [ ] Property test: `overdueDays === constants.overdueBase + day` for days `1..constants.lastDay`.

## 9. store.ts — computeState + API
- [ ] `computeState(startDay, events) = derive(fold(events, f(startDay)))`.
- [ ] `getState()`, `subscribe(fn)`, `appendEvent(kind, payload)` (stamps the event with `state.day`).
- [ ] Integration test: a 200-event log replayed twice is `deep-equal`.
- [ ] Property test: replay is idempotent.

## 10. saves.ts — two slots, versioning, isolation
- [ ] `nt_run` (`{ version, startDay, day, events }`) + `nt_profile`; atomic write (`X.tmp` → rename; previous → `X.bak`).
- [ ] Integer `version`; stepwise `migrations[]` (N → N+1, never skip); load runs forward; reject a run save whose `day` disagrees with `startDay` + `lieDown` count.
- [ ] `clearRun()` deletes only `nt_run`; profile accessor is the only reader of `nt_profile`.
- [ ] Tests: profile write leaves run save unchanged; `clearRun` leaves profile unchanged; one-step migration.

## 11. Property tests — collect and close the gaps
- [ ] Confirm each property from requirements §5 exists and passes: `stage(day)` monotonic, replay idempotent, `overdueDays` for `1..lastDay`, `day` counter.
- [ ] Run them with a high `numRuns` once and record the result in `docs/kiro-log.md`.
