# recognise — requirements

Objects only count (for blocking raids and for the good ending) once the player has recognised them. Data: `content/objects.json`.

## FR1. When
- On the day an object comes out of the box (`objectsFoundOnDay` in stages.json), right after the box beat's lines, the dialogue box asks `q` with the three `options` (order shuffled once per run, seeded by the run id so replay is stable). Choosing appends `recognise {object, right}`.
- Right → `recognised[object] = true`, play `right.say` + `right.inner`. Wrong → play `wrong.say` + `wrong.inner`; the object stays unrecognised; the question returns the next day the player picks the object up from the desk bar (once per day).
- No hints, no colouring of the right option, no retry the same day.

## FR2. Effects elsewhere
- night-hand offers a hold-up only for recognised objects (already implemented).
- The desk bar shows an unrecognised object slightly desaturated; recognised in full colour (the only tell).
- Kuro's rubric: a right answer is `truth +1` evidence; a wrong one is not negative.

## FR3. Tests
- Property: every object has exactly one right option; recognising is idempotent; a wrong answer never sets `recognised`.
- Snapshot: day 1 chick question; day 4 pager with a wrong answer then the next-day re-ask.
