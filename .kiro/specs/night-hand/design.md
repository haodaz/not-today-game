# night-hand — design

## 1. Approach

The hand needs no new event. A raid night's choices are the shutdown beat's `choices`, which
the day-loop already plays in the dialogue box and records as `choose {beat: "shutdown", index}`.
`applyChoose` now writes the raid. Everything else is a pure function of state.

`src/state/nights.ts` reads `content/nights.json` and works out, from content:
- the raid nights (`raidNights`), and which of them can be blocked (`blockableNights`);
- what each choice does (`raidMove`: block / give / nothing) and its stored outcome (`outcomeOf`);
- whether an object can be held up (`canHoldUp`) and whether it's in dream state (`inDream`);
- the good-ending check (`blockedEveryRaid`).

The world-state kinds `handObject`, `handLost` and `handNothing` stay documented no-ops. The
choice index already says which move was made, and `handLost` has no payload to say which lost
thing.

## 2. Decisions (please review)

- **N1. `raids` shape (variables.json, Claude's file; noted there and in the kiro log).**
  - Old: `{taken, blockedWith}`. New: `{blockedWith: object|null, gave: string|null}`.
  - Held up an object → `{blockedWith: object, gave: null}`.
  - Handed over → `{blockedWith: null, gave: "loan" | object}`.
  - Nothing → both null.
  - "Taken" is `blockedWith === null`.
  - A night is answered once; a second `choose` on the same raid night is rejected.
- **N2. What is offered (`choiceOffered`).**
  - An `item_dream` choice shows only if its object can be held up: found, recognised, not
    upgraded, not lost.
  - An `item_lost` object choice shows only if the object is found, not upgraded and not lost.
  - `item_lost: "loan"` is "hold up something already lost": it needs only its `cond_show`.
  - Choices that aren't offered are hidden, never shown disabled, and the reducer rejects them.
- **N3. Day 18.** It's a raid night (its shutdown has choices, and nights.json has its line).
  But both of its choices (fill the slip / hold the hand) hold nothing up, so it can't be
  blocked. `blockedEveryRaid` therefore counts the nights content lets you block
  (`blockableNights` = 5, 7, 9, 10, 13, 16). Read literally, FR3 ("every raid night has
  `blockedWith`") would make the good ending impossible. **Author to confirm.**
- **N4. Dream state is one night.**
  - Blocking sets `dream[object] = {until: night + 1}`. `inDream` holds while
    `day < until`, i.e. until lying down.
  - The day-loop used `constants.dreamDays` (3) as a duration. That was a misreading: the note
    says it's the number of dream nights (stages.json `dreamNights`). Content is unchanged.
  - Rendering: a held object in dream state draws its canvas at 2× the channel resolution at the
    same size, so it stays whole pixels (only when the scale divides by 2).
- **N5. san comes only from content.** The choices carry +1 / −1 / nothing, matching FR2, and
  the reducer never adds san of its own.
- **N6. Day 17.** The `objects_returned` pickup clears the objects from `lost`; `"loan"` stays.
  `returnedObjects` (what the bag holds) is objects only.
- **N7. Presentation.**
  - The shutdown sequence on a raid night is the beat's lines, then the hand's line from
    nights.json (as a narration line), then the choices.
  - In the room: the stage gets `raid`, and a `.gap-glow` dims the desk and lights the gap. It
    fades in like the held-item dim (200ms) and out in 140ms (motion layer).
  - Nothing says why a choice is missing.

## 3. Not done (named)

- Done since (recognise spec R6): what the hand takes on nights 9 and 18 is
  `content/nights-takes.json`, read strictly in `nights.ts`. A "nothing" move on those nights
  sets the take's flag and plays its line, and night 9 also takes the HR chip's number. The
  raid outcome is unchanged (`{blockedWith: null, gave: null}`).
- Done since: the recognise spec appends `recognise`, so blocks are offered in real play once
  an object is recognised.
- The motion.md hold-up-to-the-gap push (600ms, ease-in-out) is still open. The raid here is a
  choice in the dialogue box.
- The desktop view shows the raid in the dialogue box over the desktop without the gap glow (one
  monitor at a time; the gap is between them).
- The morning line after a block is whatever content's boot beat already carries (FR3).

## 4. Tests (FR4)

`tests/night-hand.test.ts`:
- Raid nights from content; the strict nights.json loader; the hand's line queued after the
  shutdown lines; the gap glow.
- Block / give / nothing outcomes, san, dream for one night, answered once.
- Property: offered choices never include upgraded or lost objects; a block needs found ∧
  recognised; non-offered choices are rejected.
- Snapshots: night 5 lent (3 choices) and not lent (2); night 13 with the dictionary upgraded
  (no block).
- The dream canvas, and `blockedEveryRaid`. The day-17 return is in `tests/delivery-effects.test.ts`.
