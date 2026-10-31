# recognise — design

## 1. Approach

The question uses the dialogue box like a beat's choices:
- a queue entry whose ending is `{kind: "recognise", object, order}`;
- its one line is the object's `q` (narration);
- its options are content's three `t`s, in this run's order.

Choosing appends `recognise {objectId, option}`. The reducer reads right or wrong from content.
The runtime queues the answer's lines (`say` as narration, then `inner`).

`src/state/recognise.ts` reads `content/objects.json` strictly (checked against stages.json
`objectsFoundOnDay`) and holds the reducer and the pure helpers (`knows`, `askedOn`,
`optionOrder`).

## 2. Decisions (please review)

- **R1. The event carries the option, not `right`.**
  - FR1 says `recognise {object, right}`. The event stores `option` (the content index), and the
    reducer derives right / wrong from content, so the UI can't record a wrong "right".
  - The world-state field name `objectId` is kept.
  - Without `option` it's world-state's plain form (recognises, as before), which the existing
    tests and debug use.
- **R2. Run id.**
  - FR1 seeds the shuffle with "the run id", which didn't exist. The store now has
    `getRunId()`; the run save carries `runId` (save version 2); a v1 save migrates to
    `run-legacy`.
  - New runs get `crypto.randomUUID()` (not the clock). Tests and debug jumps default to
    `run-<startDay>`.
  - The order is `shuffled("recognise:<runId>:<object>", 3)` and is baked into the queue entry.
- **R3. Textbook and phone.**
  - objects.json asks about all eight box things, but `recognised` (variables.json) holds only
    the six that count, so the textbook and the phone are never added to it.
  - A right answer for them is known from the log (`knows` = in `recognised`, or a right
    answer in the log). That drives the re-ask and the desk-bar colour.
- **R4. Once a day.**
  - The reducer is pure on state and can't see the log, so "no retry the same day" is
    enforced where the question is queued: on the box day after the box beat, and on later days
    from `loop-hold` when the object is picked up and isn't known.
  - Either way only if `!askedOn(events, day, object)`.
  - A reload mid-question loses the box (session), so picking the object up that day asks
    again.
- **R5. Rubric.**
  - A right answer: `truth +1` (clamped), with evidence
    `{day, eventId: "recognise:<object>", note: the right option's text}`, once per object.
  - A wrong answer writes nothing.
  - The judgement writer moved to `src/state/judgement.ts`, shared with object-upgrade.
- **R6 (resolved 2026-10-31).** Night 18's take now has `requiresFlag: "shook_hand"`, so it
  applies only to 「不填。握住它。」, never to 「填寄件单」. The original reading follows.
- **R6. Night takes (`content/nights-takes.json`, read in `nights.ts`).**
  - On a raid night with a take (9, 18), a "nothing" move sets the take's `flag`, and the
    runtime plays its `say` as a narration line.
  - On night 9 the heart-rate chip keeps its pulse but loses its number once the flag is set,
    as the line says.
  - **Day 18: both choices hold nothing up** (fill the slip / hold the hand), so either one
    sets `hand_taken` and plays 「它握住了。」. That reads right for holding the hand, and maybe
    not for filling the slip. **Author to confirm**, or mark which choice is the "nothing".
- **R7. Desk bar.** An object that isn't known gets the class `unknown` (desaturated to 35%).
  It's the only tell, and the options carry no hint.

## 3. Modules

```
src/state/recognise.ts   table, optionOrder, knows, askedOn, wasRight, applyRecognise
src/state/judgement.ts   judge (clamped) + hasEvidence; used by upgrades and recognise
src/state/seed.ts        hash / jitter / shuffled (moved from world/replies/seed.ts, re-exported there)
src/state/nights.ts      + parseTakes, takeOf, takeFor
src/state/store.ts, saves.ts   runId (save v2, migration from v1)
src/world/loop/dialogue.ts     recognise ending, endsInChoice
src/world/loop/runtime.ts      questionQueued, answerQueued; question after the box beat; answer; take line
src/world/room/game.ts         loop-choice → recognise; loop-hold re-ask
src/world/room/hud.ts          desk bar `unknown`; HR chip after the heartbeat is taken
```

## 4. Tests (FR3)

`tests/recognise.test.ts`:
- Content: one right option of three for every box object; the strict loader.
- Property: a wrong answer never sets `recognised` or moves the judgement; a right one is
  idempotent (once in `recognised`, one evidence entry, truth +1 once).
- Snapshots: the day-1 chick question, and the day-4 pager wrong answer followed by the
  next-day re-ask. Also: no retry that day, and no re-ask once known.
- The shuffle is stable per run id; the runId is saved and migrated; the desk-bar colour.
- Takes: the strict loader; night 9 nothing → flag + line + HR number gone; a block takes
  nothing; other nights only cost san; night 18 (R6).
