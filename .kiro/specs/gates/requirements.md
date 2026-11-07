# gates — requirements (2026-11-07, author's rule, Claude's audit)

The author's rule, from the blind-box correction: **a thing that cannot be used here or now never opens its own layer.** The click answers with one line in story terms (an RPG door that is not yet open), the player is not taken anywhere they must back out of, nothing is silent, and the one thing that *can* be used looks different from the ones that cannot. Content and strings are Claude's and in the tree; do not edit content/ or public/.

Claude audited every gate (2026-11-07). Already right: 床 before nightfall (one line, no move), Kuro while today's chat is locked (one line), 屏幕 before the tower is on (one line, no move), the door and the hooks (a look line), the workbench's own locked columns and not-yet-found cards (in-app states), the case before lunch (blind-box correction). To fix:

## R1. 床 after nightfall with work left
Today: the bed click lies the player down first (`lying`), and only then says 「还没完。」, so they must get up again. Now: when the night's required items are not done, the click says `room.bed.locked` (reworded: 「活还没干完，躺不下。」) from where the player stands and does not change the view. Lying down happens only when the question (睡 / 打开录音机 / 再待会儿) can be asked.

## R2. The camera's second shot and the empty pack
Today: the shutter opens the viewfinder, and only the shutter press inside it says `camera.usedToday` / `camera.empty` and closes it. Now: when a room photo was already taken today, or the pack is at 0, the shutter press in hand says the line and the viewfinder does not open.

## R3. 使用 where the object does not work
Today: entering 使用 on an object whose `works` rule fails (the IC card without the lamp, the calculator in the dark, the phone away from the window) shows the device and the cannot-use line. Now: the device is not entered; the object stays in the hand as it is and the line is said. The `useAt` record with `ok: false` is still logged (objects-in-room R2). Key presses that fail (the walkman's REC away from the bed at night) keep object-tutor R4. On the desk, the object bar (`objbar-open`) follows the same rule: an object that does not work at the desk says `objbar.notYet` 「还不能在这儿用。」 (string exists) and the modal does not open.

## R4. Nothing silent
- 屏幕 before boot says `room.screen.off` on every click, not once a day (the same line again is fine; two in a row for one click is not).
- 关机 before the shutdown beat is open (the desk beat not reached, or work left) says `room.shutdown.notyet` 「活还没干完，先别关。」 (string in the tree) instead of returning silently.
- The 道具 button is not shown while nothing has been found (day 1 before the chick); after that it shows as today.
- Day 18's slip on the desk before its item unlocks: no change (it is not shown before).

## R5. Tests
One test per gate above: the line is queued, the view does not change (R1, R2, R3), the modal does not open (R3), the line repeats per click (R4), the 道具 button's absence on day 1 before the box. Snapshots that change only by these: list, do not edit.
