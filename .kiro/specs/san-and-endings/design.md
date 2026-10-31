# san-and-endings — design

## 1. Approach

The ending is state, written by one event, so a run ends exactly once and a reload lands on the
same page:
- `ending {kind: "bad" | "survive" | "good"}` sets `state.ending` (a new variable, default
  `"none"`).
- After it, the reducer rejects every other event: the run is over.

Which ending, and when, is a pure function (`src/state/endings.ts`):
- `dueAtShutdown(state)` → `"bad"` when SAN is 0 and no ending has happened yet. The runtime
  appends it on the `beat:shutdown` step, so it never comes mid-beat (FR1).
- `dueAtLieDown(state)` on the last day → `"good"` if all five good conditions hold, else
  `"survive"` (no flag, or `slip_filled`, or `shook_hand` without the rest). The night's
  lie-down appends `ending` instead of `lieDown` (FR2).
- `goodConditions(state)` → `{shookHand, recognisedAll, blockedAll, affinity, unchecked}`; good
  needs all five. "Every raid blocked" is night-hand's `blockedEveryRaid`.

The pages are a pure view of `state.ending` plus a session phase (`src/world/endings/`):
- bad: 你和你 → credits → title (the host clears `nt_run`, adds 1 to `runs` in the profile).
- survive: credits → 第一日 (the host clears `nt_run`; a new run).
- good: credits → day 19.

## 2. Decisions (please review)

- **E1. New variable `ending`** (`enum none|bad|survive|good`, variables.json; Claude's file,
  noted there and in the kiro log). It's the single fact the endings and the "once per run"
  guarantee rest on.
- **E2. SAN.**
  - Clamped 0..100 by the existing range. It changes only through content effects; stages.json
  has no daily drift, so there is none.
  - `sanBand(san)` = how many of `constants.sanThresholds` (70 / 50 / 30 / 10) it is below
    (0..4). The stage carries `data-san-band`. CSS reads it for presentation only:
    - the cup colder;
    - the room one step narrower (a side vignette, until room-scene);
    - a denser grain over text.
  - bpm = `bpmAtFullSan + (bpmAtZeroSan − bpmAtFullSan) × (1 − san/100)`, rounded. That's 72
    at 100 and 110 at 0, both from constants; it replaces the HUD's local formula.
- **E3. 你和你 is built from the log and content, never written.**
  - For each day played: that day's first family incoming line (content/replies) at its time,
    answered on time with the player's `family.fine` label (好。).
  - Then, for each `task` event in mode `let` (unchecked), a message "you" sent: the task's
    title from content/tasks.
  - Both sides are "you". The title is the string `ending.youAndYou` (TODO Claude: 你和你).
- **E4. Credits (FR3).**
  - One line per `judgement.evidence` entry, in day order (stable): the day, the note (what was
    stored), and which way it moved Kuro.
  - Evidence entries store no delta, so the direction is read from the content that wrote them:
    - `upgrade:` → upgrades.json accept;
    - `declineUpgrade:` → decline;
    - `recognise:` → +1 truth.
  - An unknown source shows no direction. The chat rubric will add its own source when it lands.
  - Arrows ↑ / ↓ per dimension; the dimension words are strings (`credits.dim.*`, TODO Claude).
  - The last line is the ending's (`credits.last.<kind>`, TODO Claude), and good's is the plain
    red/blue line.
  - One line per 1.6 s; a click jumps to the end; a click at the end goes on. Never skipped
    entirely.
- **E5. Pages.** The title page isn't built, so "the title page" is the host's `home`: it
  reopens the game, which, with `nt_run` cleared, starts a new run on day 1.
  - 第一日 is a white page with that string (`ending.firstDay`, TODO Claude: 第一日); a click
    starts the new run.
  - Day 19 (good) is the door view, still, with one line (`ending.day19`, TODO Claude) until
    room-scene turns the handle.
- **E7. SAN reaching 0 after the last shutdown beat** (e.g. a night-18 choice): there is no next
  shutdown beat, so lying down that night gives bad. The requirements don't cover this.
- **E8. 你和你's place.** "The small window shows" it: rendered as the small-window component,
  centred on a dark page, after the run has ended (the desktop is gone by then).
- **E6. Profile.** `runs += 1` goes through a new `increment(key)` on the profile writer. It
  reads and writes inside saves.ts and returns nothing, so the story still never reads the
  profile.

## 3. Modules

```
src/state/endings.ts        sanBand, bpm, goodConditions, dueAtShutdown, dueAtLieDown, applyEnding
src/state/events.ts         + ending; nothing after it
src/world/endings/youandyou.ts   the conversation, from the log
src/world/endings/credits.ts     lines from evidence; the roll clock
src/world/endings/view.ts        pages: 你和你 / credits / 第一日 / day 19
src/world/room/game.ts      ending pages replace the views; ending-next action; host hooks
src/state/saves.ts          ProfileWriter.increment
```

## 4. Tests (FR4)

- Property: SAN never leaves 0..100 under any events.
- Property: the bad ending fires exactly once per run (a second `ending` and anything after it
  are rejected; `dueAtShutdown` is false once ended).
- Good needs all five: dropping any one gives survive.
- Snapshots: credits rolled from a fixture log; 你和你 from a fixture run.
- Units: bands, bpm ends, the survive fallbacks, the roll clock, `increment`.
