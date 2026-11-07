# object-tutor — requirements (2026-11-07, author)

Author decision 2026-11-07: every old object that can be used in the room gets one line from Kuro on the day it arrives — how to use it — and the walkman gets a second line on night 5, before lying down, to press record (day 6's lock reads the code off that night's recording; without it the lock cannot be read and the day cannot end). Tutorial as a line in Kuro's mouth, never a card. Content and strings are Claude's and are in the tree; do not edit content/ or public/.

## R1. The arrival line
- Strings `kuro.tutor.<objectId>` for the eight objects (chick, camera, pager, iccard, tape, dictionary, calculator, phone), zh and en, are in `content/strings`.
- When an object is taken from the box and recognised on its day (the `recognise` event for that object, after the recognise sequence's own lines and the option's continuation), Kuro says `kuro.tutor.<objectId>` once: queued as a Kuro line (voice "kuro", Kuro's portrait, the same shape as a `who: "kuro"` speaker line, lying-view R1), after the recognise sequence, before anything else. Once per object per run (derive it from the log: the recognise event, not a session flag — a reload must not repeat it, and a second run must say it again).
- If a string is missing, say nothing (never an empty box).

## R2. The night-5 reminder
- On day 5, when the `shutdown` beat's sequence ends (the room after the tower is off, before the night chat and before lying down), Kuro says `kuro.tutor.tape.night` once (derive from the log as in R1: the day's `shutdown` beat reached, and the line not yet said — or key it to the beat the same way the boot beat is keyed per day). Only on day 5, only if the tape is found (it always is: it arrives on day 5).

## R3. Tests
- Day 1: after the chick is recognised, the next queued item is Kuro's `kuro.tutor.chick` with voice kuro; a reload does not queue it again; a new run does.
- Day 5: after the shutdown beat, `kuro.tutor.tape.night` is queued once; day 6 shutdown queues nothing.
- A missing string queues nothing.
- Snapshots that change only by the new line: list them, do not edit them.
