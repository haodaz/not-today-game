# object-tutor — requirements (2026-11-07, author)

Author decision 2026-11-07: every old object that can be used in the room gets one line from Kuro on the day it arrives — how to use it — and the walkman gets a second line on night 5, before lying down, to press record (day 6's lock reads the code off that night's recording; without it the lock cannot be read and the day cannot end). Tutorial as a line in Kuro's mouth, never a card. Content and strings are Claude's and are in the tree; do not edit content/ or public/.

## R1. The arrival line
- Strings `kuro.tutor.<objectId>` for the eight objects (chick, camera, pager, iccard, tape, dictionary, calculator, phone), zh and en, are in `content/strings`; an optional second line `kuro.tutor.<objectId>.2` follows as the next line of the same Kuro item (the chick has one). The lines are Kuro's remarks, not instructions: the author's wording, never paraphrased.
- When an object is taken from the box and recognised on its day (the `recognise` event for that object, after the recognise sequence's own lines and the option's continuation), Kuro says `kuro.tutor.<objectId>` once: queued as a Kuro line (voice "kuro", Kuro's portrait, the same shape as a `who: "kuro"` speaker line, lying-view R1), after the recognise sequence, before anything else. Once per object per run (derive it from the log: the recognise event, not a session flag — a reload must not repeat it, and a second run must say it again).
- If a string is missing, say nothing (never an empty box).

## R2. Night 5: the bed question offers the recorder (author 2026-11-07)
- On day 5 only, the bed question (`bedAsk`, `room.bed.confirm` 要结束这一天吗 with 睡 / 再待会儿) has a third choice, `room.bed.record` 「打开录音机」 (string in the tree, zh + en), listed after 睡 and before 再待会儿. It is offered only while the tape is found and not taken by Kuro, and only on day 5 (not on later nights).
- Choosing it: the walkman goes into the hand in use mode at 床, at night, exactly as a 道具 → hold → 使用 would (the drawn device with its real keys; tape-record R1 lets REC work there). The question closes. When the player puts the device down (Esc / the put-down control), the bed question is asked again, this time without the recorder choice if REC was pressed (a recording is on), with it again if not.
- No Kuro line at night; the arrival line (R1) is the only tutorial for the tape.

## R3. Tests
- Day 1: after the chick is recognised, the next queued item is Kuro's `kuro.tutor.chick` with voice kuro; a reload does not queue it again; a new run does.
- Day 5: the bed question has three choices (睡 / 打开录音机 / 再待会儿); choosing 打开录音机 puts the tape in use at 床 and asks again after it is put down; day 4 and day 6 bed questions have two choices.
- A missing string queues nothing.
- Snapshots that change only by the new line: list them, do not edit them.
