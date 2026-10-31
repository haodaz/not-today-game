# world-state — Design

## 1. Goal & scope

One module owns all game state. It is a pure data layer:

```
state = f(day) ⊕ replay(events)
```

It holds every variable named in `content/variables.json`, computes `day` and `stage`, runs the
append-only event log as a deterministic left fold, fakes the clock, and persists two save slots.
It does no rendering, knows nothing about how objects look, makes no network calls, and makes no
LLM calls.

This spec realises the `state/` row of `structure.md`: store, time function, event log, saves,
stages.

## 2. Module layout (`src/state/`)

```
src/state/
  variables.ts     load content/variables.json → VariableTable (names, types, ranges, defaults, constants)
  stages.ts        load content/stages.json → stageOf, ringOf, isCalmDaytime, isTenderDay, nightBeatOf, dreamNights
  clock.ts         Clock: cosmetic wall time only (injectable); never feeds day (changed 2026-10-30)
  events.ts        Event discriminated union + applyEvent reducer (left-fold step); lieDown does day += 1
  fday.ts          f(startDay): defaults with day = startDay; derive(): stage, overdueDays, loan repay from day
  replay.ts        fold(events, base) = events.reduce(applyEvent, base)
  store.ts         computeState(day, events); subscribe(); getState(); appendEvent()
  saves.ts         nt_run + nt_profile: version, stepwise migrations, atomic write, isolation
  index.ts         public API
  types.gen.ts     generated typed State interface (from variables.json) — not hand-written
scripts/
  gen-state-types.ts   reads content/variables.json, emits src/state/types.gen.ts
```

`content/` is Claude's area. `variables.json` and `stages.json` are already committed by Claude;
`world-state` only **reads** them and never creates or overwrites them. A note in
`docs/kiro-log.md` records that they are Claude's. The `variables.json` `constants` block supplies
engine constants; code reads them and never hardcodes their values.

## 3. The core computation

```
computeState(startDay, events):
  base   = f(startDay)                             // defaults with day = startDay (1 in a normal run)
  folded = fold(events, base)                      // left fold; lieDown does day += 1
  state  = derive(folded)                          // from folded.day: stage, overdueDays, loan repayment
  return state
```

This is the concrete meaning of `state = f(day) ⊕ replay(events)`. `day` is itself part of state:
the `lieDown` reducer is the only thing that increments it, and `startDay` is 1 except for the
`?day=N` debug jump, which is `computeState(N, [])`. `derive` then reads the folded `day`, so
`stage`, `overdueDays` and the loan repayment are always consistent with it. Each appended event is
stamped with `state.day` at append time. The whole thing is a pure function of `(startDay, events)`
and never reads a clock, so it is deterministic and idempotent: replaying the same log twice yields
`deep-equal` state.

### Why the fold, not events, handles the loan repayment

The `repayDay` repayment is a day-driven transition, **not** an event, so it is never appended to
the log. The loan value is derived; every named value below is read from the `constants` block of
`content/variables.json` and never hardcoded:

| reply on day `loanReplyDay` | while `day < repayDay` | once `day >= repayDay` | balance |
|-----------------------------|------------------------|------------------------|---------|
| (no `loanReplyDay` reply)   | `"none"`               | `"none"`               | base    |
| `choice: "lend"`            | `"lent"`               | `"repaid"`             | base − `loanAmount` while lent; restored (base) when repaid |
| `choice: "no"` (chick word) | `"refused"`            | `"refused"`            | base    |

- The fold handles the event side: a `reply` on day `loanReplyDay` with `choice: "lend"` sets
  `loan = "lent"` and `balance -= loanAmount`; `choice: "no"` sets `loan = "refused"`.
- `derive` handles the day side: if `loan === "lent"` and `day >= repayDay`, set
  `loan = "repaid"` and restore `balance` to base.

The derivation reads `loanReplyDay`, `repayDay`, `loanAmount`, and `overdueBase` from the
`constants` block of `content/variables.json`. Code never defines these as literals. The two reply
payloads this spec recognises are `"lend"` and `"no"`; other reply choices pass through untouched
(their effects belong to later specs).

## 4. Types & validation

- **Event** is a hardcoded discriminated union — the 12 kinds are defined by this spec, not by
  external data, so they live in `events.ts`. Payloads are minimal:
  - `reply` → `{ choice: string }`
  - `openLayer` → `{ layerIndex: number }`
  - `recognise`, `looked`, `handObject` → `{ objectId: string }`
  - `pressKey` → `{ key: string }`
  - `letItDo` → `{ taskId: string }`
  - `pokeReset`, `lieDown`, `sitUp`, `handLost`, `handNothing` → `{}`
  - Every event also carries its recorded `day`.
- **State** is a typed interface generated from `content/variables.json`
  (`scripts/gen-state-types.ts` → `src/state/types.gen.ts`). It covers **every** variable in the
  table: `day`, `stage`, `found`, `recognised`, `chickFrame`, `pagerUnread`, `repliedNumbers`,
  `translated`, `dream`, `readCount`, `replyOptions`, `objectWords`, `loan`, `balance`,
  `overdueDays`, `newWorld`, `san`, `letItDoUnchecked`, `raids`, `pokedReset`, `names`, `flags`. No
  variable values are hand-copied. The generated file has a `DO NOT EDIT` header.
- `variables.ts` loads the table at runtime and provides `defaults()` and `validate(state)`,
  which checks every variable against its declared type and range. `validate` runs on loaded saves
  and in tests.
- `applyEvent` implements **only** the reducers this spec defines: `openLayer`→`found`,
  `recognise`→`recognised`, `pokeReset`→`pokedReset`, `letItDo`→`letItDoUnchecked`, and `reply`
  (`lend`/`no`)→`loan`/`balance`. Every other event kind is a no-op for now, and every field not
  listed passes through untouched — its reducer is owned by a later spec (device, san-and-endings,
  night-hand, new-world).

## 5. Clock

`clock.ts` exposes one injectable interface, `Clock.now(): Date`, plus `realClock` (wall time) and
`fakeClock(iso)` for tests. It is cosmetic only: the one consumer is things like a timestamp in a
chat bubble. It never feeds `day`, `stage`, or any reducer, and nothing else in `src/state` may
read the wall clock directly. `day` is the counter described in §3.

`?day=N` is a debug jump, handled by `debugStartDay(search: string): number | null` which parses
the URL query. The store then builds `computeState(N, [])`. There is no demo mode and no
`CLOCK_OVERRIDE`.

## 6. Persistence

`saves.ts` manages two slots, kept strictly separate:

- **Run save** `nt_run`: `{ version, startDay, day, events }`. `day` is the counter; on load it
  must equal `startDay` plus the number of `lieDown` events, otherwise the save is rejected.
  `clearRun()` deletes it on a bad-ending restart.
- **Profile** `nt_profile`: cross-run, never cleared, never readable by store/story logic. Only
  a title-page accessor reads it.

Mechanics:

- Atomic write: serialise to `nt_X.tmp`, then rename to `nt_X`. The previous good save is moved to
  `nt_X.bak` before the rename, so a failed write leaves the last good save intact.
- `version`: integer on every save. `migrations[]` is a stepwise list `N → N+1`. Load detects the
  stored version and runs forward one step at a time, never skipping.
- A profile write never touches `nt_run`; a `clearRun()` never touches `nt_profile`.

## 7. Testing strategy

- Unit tests per module (stage and ring mapping read from the table, the `?day=N` parser, each
  defined event's `applyEvent`, the day counter, the loan lifecycle, save migrations, slot
  isolation).
- One integration test: build a 200-event log, assert `deep-equal` of two replays.
- Property tests (`fast-check`): `stage(day)` monotonic non-decreasing; `replay` idempotent;
  `overdueDays === constants.overdueBase + day` for `1..lastDay`; `day` equals `startDay` plus the
  number of `lieDown` events. Each property lands with the module it covers and the whole suite is
  run after every task; task 11 collects the remaining ones.
- No test depends on the wall clock; the cosmetic clock is faked.

## 8. Out of scope

Rendering, object appearance, network, LLM calls, and any story string. Those belong to other
specs. `world-state` only stores and mutates abstract state.
