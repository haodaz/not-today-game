# world-state — Requirements

## 1. Overview

The whole game has a single state, and that state is a function of the date plus a replay of an
append-only event log:

```
state = f(day) ⊕ replay(events)
```

`world-state` is the module that owns this. It holds every variable, computes `day` and `stage`,
appends and replays events, fakes the clock for tests and demos, and persists two save slots. It
is the single source of truth that every view (the two monitors, the objects, the room) reads
from. It is a pure data layer: it emits no rendering and knows nothing about how anything looks.

## 2. Source data (constants, not owned by this spec)

Two JSON files hold the constants. They are the source of truth. Code and this spec never copy
their values — they are read at runtime.

- `content/variables.json` — the complete set of state variables, with types and ranges.
- `content/stages.json` — `byDay[day]` for days up to 18; `afterDay18` for every day after.

## 3. Functional requirements

### FR1. Single state, single store

- Exactly one state object. It contains only the variables named in `content/variables.json`,
  with the types and ranges given there. No other variable exists in state.
- The store is the only thing that holds state. Views read it and never write it directly;
  objects never talk to each other; they emit events (handled in FR3).
- `f(day)` is the deterministic starting state for a given day. `replay(events)` folds each event
  onto that starting state. The two are combined to produce current state.

### FR2. Day and stage

- `day = realCalendarDay - startDay + 1`, where `realCalendarDay` and `startDay` are calendar-day
  numbers obtained from the clock (FR4).
- `stage = content/stages.json[byDay][day]` when `byDay` has an entry for `day`; for any day after
  18, `stage = afterDay18`.
- The stages table is read from `content/stages.json` at runtime. Code never hardcodes the table
  and never hardcodes individual stage values.

### FR3. Append-only event log and replay

- The log is append-only: once an event is appended it is never edited or removed.
- Event kinds are exactly this set, nothing else: `openLayer`, `recognise`, `pressKey`, `reply`,
  `letItDo`, `looked`, `pokeReset`, `lieDown`, `sitUp`, `handObject`, `handLost`, `handNothing`.
- Each event records its kind, the clock-day it happened on, and any payload the kind needs.
- Replay is a left fold over the event list (`state = events.reduce(apply, f(day))`). Order is
  preserved. An event may read the state produced by earlier events (e.g. an object only lends a
  word once it has been recognised), but no event may read the wall clock; the only time an event
  sees is its own recorded day.
- Replaying the same log twice over the same `f(day)` must produce `deep-equal`-identical state;
  replay is idempotent because the fold is deterministic.
- Derived variable `loan` is computed during the fold (its name and enum live in
  `content/variables.json`):
  - `"none"` if no day-5 `reply` event exists.
  - If the day-5 `reply` carries payload `choice: "lend"`: `"lent"` while `day < 12`; `"repaid"`
    once `day >= 12`. The repayment on day 12 is part of `f(day)`, not a player event.
  - If the day-5 `reply` carries `choice: "no"` (the chick's word): `"refused"` for all later days.
  - `balance` follows `loan`: minus 44000 while `"lent"`, restored when `"repaid"`; unchanged
    while `"refused"`.

### FR4. Fakeable clock

- The clock can be overridden without code changes. Mechanisms and precedence:
  - `CLOCK_OVERRIDE` env var.
  - `?day=N&t=HH:MM` URL param.
  - Default (neither set): the real wall clock.
- Demo mode compresses one game day into about 90 seconds of wall-clock time.
- All tests and property tests run on the fake clock; no test ever depends on the real clock.
- Whatever the source, `day` and within-day time are derived through a single path.

### FR5. Persistence — two separate slots

- Two persisted slots, kept separate at all times:
  - **Run save** (`nt_run`): the in-progress run's state + event log. Cleared on a bad-ending
    restart.
  - **Cross-run profile** (`nt_profile`): accumulates across runs, never cleared, and never
    readable by anything except the title page. Story/`world-state` logic must not be able to
    read it.
- Each save carries an integer `version`.
- Migrations run forward, step by step (version N → N+1 → …), never skipping. A save on an old
  version loads and upgrades in place.
- Writes are atomic: write to a temp key first, then rename to the real key. The previous good
  save is kept until the new one is confirmed.
- A profile write never changes the run save; a run-save clear never touches the profile.

## 4. Non-functional requirements (what it must not do)

- No rendering. `world-state` produces state, not pixels, DOM, or canvas.
- No knowledge of what any object looks like. Objects are render channels elsewhere; this module
  stores and mutates only their abstract state.
- No network. No `fetch`, no sockets, no remote calls.
- No LLM calls. The chat beat's optional LLM lives elsewhere and goes through tools, not here.
- Deterministic and replayable above all: the same `(day, events)` always yields the same state.

## 5. Acceptance criteria

These are verifiable tests. The specific input→output pairs below are test expectations; the full
tables remain in `content/` and are not reproduced here.

- **Stage mapping:** `stage(1)=0, stage(4)=1, stage(7)=2, stage(10)=3, stage(13)=4, stage(16)=5,
  stage(18)=5`, and `stage(25)=5`.
- **Replay idempotency:** replaying a 200-event log twice produces `deep-equal` state.
- **Loan lifecycle:** with the clock faked to day 12 and a day-5 `reply` event carrying
  `choice: "lend"`, `loan === "repaid"` (and `balance` is restored). On day 11 the same log yields
  `loan === "lent"` (and `balance` is minus 44000). With `choice: "no"`, `loan === "refused"`.
- **Slot isolation:** a profile write never changes the run save; a run-save clear never touches
  the profile.
- **Property tests:**
  - `stage(day)` is monotonic non-decreasing for all days.
  - `replay` is idempotent (`replay ∘ replay == replay`).
  - `overdueDays === 30 + day` for all days `1..18`.

## 6. Implementation constraints

- Do not copy values from `content/variables.json` or `content/stages.json` into code or into
  this spec. Read them at runtime.
- Every task derived from this spec (in `tasks.md`) must take under 30 minutes.
