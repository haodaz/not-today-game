# world-state — Requirements

## 1. Overview

The whole game has a single state, and that state is a function of the date plus a replay of an
append-only event log:

```
state = f(day) ⊕ replay(events)
```

`world-state` is the module that owns this. It holds every variable, computes `day` and `stage`,
appends and replays events, exposes a cosmetic injectable clock, and persists two save slots. It
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

- **Changed 2026-10-30 (author decision, see steering/product.md):** `day` is a counter in the run
  save, starting at 1 and incremented by exactly one when the `lieDown` event is appended. It never
  derives from the wall clock. `day` is a state field; the `lieDown` reducer is the only thing that
  changes it.
- `stage = content/stages.json[byDay][day]` when `byDay` has an entry for `day`; for any day after
  `constants.lastDay`, `stage = afterDay18`.
- `ring` (how far the daytime corruption has spread) is derived from `content/stages.json[cycles]`:
  the cycle whose `days` contain `day`; after the last cycle, the last cycle's ring. `ring` is a
  derived accessor, not a state variable (the variable table is closed).
- The same file also supplies `calmDaytime`, `tenderDay`, `dreamNights` and `nightBeat`; they are
  exposed as read-only accessors. Their effects (rendering, affinity) belong to other specs.
- The stages table is read from `content/stages.json` at runtime. Code never hardcodes the table
  and never hardcodes individual stage values.
- Every engine constant (`overdueBase`, `loanAmount`, `loanReplyDay`, `repayDay`, `lastDay`,
  `affinityThreshold`, `tenderDayAffinityMultiplier`, ...) is read from `constants` in
  `content/variables.json`; none is written as a literal in code.

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

### FR4. Fakeable clock (reduced 2026-10-30: the clock no longer drives `day`; it is cosmetic only, still injectable for tests. Demo mode and CLOCK_OVERRIDE are dropped; `?day=N` stays as a debug jump.)

- There is one `Clock` interface. Its only consumers are cosmetic (e.g. a timestamp in a chat
  bubble). It never feeds `day`, `stage`, or any reducer.
- The real wall clock is the default; tests inject a fake one. No test depends on the real clock.
- `?day=N` is a debug jump: it builds the day-N state with an empty event log (`f(N)`). It is not
  a feature and has no effect on saves.
- No demo mode, no `CLOCK_OVERRIDE`.

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

- **Stage mapping:** for every day `1..lastDay`, `stage(day)` equals `stages.json byDay[day]`;
  `stage(25)` equals `afterDay18`. `ring(day)` equals the ring of the cycle containing `day`.
  (Plan B values, for orientation only: 1→0, 4→1, 7→3, 10→4, 13→5, 18→5. The test reads the table.)
- **Day counter:** `day` starts at 1 and is incremented by exactly one per `lieDown` event, by
  nothing else.
- **Replay idempotency:** replaying a 200-event log twice produces `deep-equal` state.
- **Loan lifecycle:** with the day counter at `repayDay` and a `loanReplyDay` `reply` event
  carrying `choice: "lend"`, `loan === "repaid"` (and `balance` is restored). On the day before, the
  same log yields `loan === "lent"` (and `balance` is minus `loanAmount`). With `choice: "no"`,
  `loan === "refused"`.
- **Slot isolation:** a profile write never changes the run save; a run-save clear never touches
  the profile.
- **Property tests:**
  - `stage(day)` is monotonic non-decreasing for all days.
  - `replay` is idempotent (`replay ∘ replay == replay`).
  - `overdueDays === constants.overdueBase + day` for all days `1..lastDay`.

## 6. Implementation constraints

- Do not copy values from `content/variables.json` or `content/stages.json` into code or into
  this spec. Read them at runtime.
- Every task derived from this spec (in `tasks.md`) must take under 30 minutes.
