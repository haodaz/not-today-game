# world-state — Tasks

Each task is sized to under 30 minutes. Run `vitest --run` after every task that adds tests.
If a task would require writing a story string, stop and ask before proceeding.

## 1. Scaffold Vite + TypeScript project
- [ ] `package.json` with `vite`, `typescript`, `vitest`, `fast-check` (pinned versions).
- [ ] `vite.config.ts`, `tsconfig.json` (strict), alias `@content` → `content/`, `@state` → `src/state`.
- [ ] `npm run dev` boots an empty page; `vitest --run` passes with no tests.
- [ ] Create empty `src/state/` directory.

## 2. Read content schema, confirm defaults, log note
- [ ] Read `content/variables.json` and `content/stages.json` (already committed by Claude). Do **not** create or overwrite them.
- [ ] Confirm every variable in `variables.json` has a `default`; fail loud if any is missing.
- [ ] Note in `docs/kiro-log.md` that both files are Claude's and code only reads them.

## 3. variables.ts — loader, defaults, validate
- [ ] Load `content/variables.json`; expose `VariableTable`, `constants`, `defaults()`, `validate(state)`.
- [ ] `validate` checks type and range for every variable; throws with the offending key on failure.
- [ ] Tests: `defaults()` matches the table; `validate` accepts defaults and rejects out-of-range.

## 4. Codegen typed state interface
- [ ] `scripts/gen-state-types.ts` reads `content/variables.json`, emits `src/state/types.gen.ts` (a `State` interface + `DO NOT EDIT` header).
- [ ] `State` covers **every** variable in the table: `day`, `stage`, `found`, `recognised`, `chickFrame`, `pagerUnread`, `repliedNumbers`, `translated`, `dream`, `readCount`, `replyOptions`, `objectWords`, `loan`, `balance`, `overdueDays`, `newWorld`, `san`, `letItDoUnchecked`, `raids`, `pokedReset`, `names`, `flags`.
- [ ] `npm run gen:state` script; wired into `vite.config.ts` as a pre-build step.
- [ ] Test: regenerating when the file is up to date is a no-op; generated types match the table.

## 5. stages.ts + day.ts
- [ ] `stages.ts`: load `content/stages.json`; `stageOf(day)` = `byDay[String(day)] ?? afterDay18`.
- [ ] `day.ts`: `dayOf(realDay) = realDay - startDay + 1`.
- [ ] Tests: acceptance mapping `stage(1,4,7,10,13,16,18) = (0,1,2,3,4,5,5)`, `stage(25)=5`; `dayOf` offset.

## 6. clock.ts
- [ ] `Clock` interface + `now() → { realDay, t }`; sources with precedence: test inject → URL param → `CLOCK_OVERRIDE` → demo → real.
- [ ] Demo: one game day ≈ `constants.demoSecondsPerDay` wall-clock; map elapsed to `day`/`t`.
- [ ] Tests: each source resolves correctly; precedence order; demo time compression.

## 7. events.ts — union + applyEvent (non-loan)
- [ ] Discriminated union for all 12 kinds with the payloads in design §4, plus a recorded `day`.
- [ ] `applyEvent` for the non-loan kinds this spec defines: `openLayer`→`found`, `recognise`→`recognised`, `pokeReset`→`pokedReset`, `letItDo`→`letItDoUnchecked`.
- [ ] Kinds whose field effects belong to other specs (`pressKey`, `looked`, `lieDown`, `sitUp`, `handObject`, `handLost`, `handNothing`) are documented no-ops; their fields pass through untouched.
- [ ] Tests: the four reducers mutate the expected field; no-op kinds leave state `deep-equal`.

## 8. fday.ts + replay.ts + loan
- [ ] `fday.ts`: `f(day)` base state (`defaults()` + `stage` + `overdueDays = constants.overdueBase + day`).
- [ ] Read loan constants from `variables.json` `constants`: `loanReplyDay`, `repayDay`, `loanAmount`. Never hardcode them.
- [ ] `replay.ts`: `fold(events, base) = events.reduce(applyEvent, base)`; the day-`loanReplyDay` lend/no reply sets `loan`/`balance` (`balance -= loanAmount` while lent).
- [ ] `applyDayTransitions(state, day)`: if `loan === "lent"` and `day >= repayDay` → `loan = "repaid"`, restore `balance`.
- [ ] Tests: none/lent/repaid/refused lifecycle across days `loanReplyDay` / `repayDay−1` / `repayDay`; `balance` follows.

## 9. store.ts — computeState + API
- [ ] `computeState(day, events) = applyDayTransitions(fold(events, f(day)), day)`.
- [ ] `getState()`, `subscribe(fn)`, `appendEvent(kind, payload)` (records current day from clock).
- [ ] Integration test: a 200-event log replayed twice is `deep-equal`.

## 10. saves.ts — two slots, versioning, isolation
- [ ] `nt_run` + `nt_profile`; atomic write (`X.tmp` → rename; previous → `X.bak`).
- [ ] Integer `version`; stepwise `migrations[]` (N → N+1, never skip); load runs forward.
- [ ] `clearRun()` deletes only `nt_run`; profile accessor is the only reader of `nt_profile`.
- [ ] Tests: profile write leaves run save unchanged; `clearRun` leaves profile unchanged; one-step migration.

## 11. Property tests (fast-check)
- [ ] `stage(day)` monotonic non-decreasing for all days.
- [ ] `replay` idempotent (`deep-equal(replay(s), replay(replay(s)))`).
- [ ] `overdueDays === constants.overdueBase + day` for days `1..18`.
- [ ] All on injected fake clocks.
