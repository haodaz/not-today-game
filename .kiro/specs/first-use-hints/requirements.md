# first-use-hints — requirements (2026-11-06; the author's 11-04 feedback + the 11-05 playtest)

Every first time in the room gets one hint, with the same look as the desktop coach marks (onboarding-steps R1): the screen dims (black 30 %), the thing to touch gets the 2 px accent ring and 8 px glow, a 300 px card with a 10 px arrow sits next to it (above if there is room, else below; clamped inside the stage) with one line and one button `hint.ok`. Enter / Esc dismiss. Clicks outside the card do nothing while it is up. Strings are Claude's and already in the tree.

## R1. The hints (id → when → what it points at → string)
1. `tower` — day 1, in 房间, after the waking lines end, while the tower is off → `[data-action=tower-power]` → `hint.tower`.
2. `screen` — right after the power-on lines end → the first `[data-action=view][data-view=desktop]` → `hint.screen`.
3. `turn` — the first time the player is back in the room from the computer → the right-edge turn hint → `hint.turn`.
4. `phone` — the first time the lunch-ordering item is the current item and the player is in 房间 or 桌子 → `[data-action=view][data-view=desk]` in 房间, `[data-action=loop-phone]` in 桌子 → `hint.phone`.
5. `door` — the first delivery arrival (doorbell) → the 门 way (`[data-action=view][data-view=door]` or the door's hotspot when on 门) → `hint.door`.
6. `table` — the first time a meal has been taken in and not eaten → the 窗 way, or the meal table when on 窗 → `hint.table`.
7. `box` — the first time a box is loose (day 1's box item unlocked) → the box / bed-box hotspot (or the 床 way) → `hint.box`.
8. `items` — the first time an object has been found → `[data-action=items-toggle]` → `hint.items`.
9. `kuro` — the first time the chat item unlocks → `[data-action=kuro-call]` → `hint.kuro`.
10. `bed` — the first time the shutdown beat is done → the bed (or the 床 way) → `hint.bed`.
11. `chickHint` — from the day after the chick was found, the first time the chick is visible (on 桌子 or in the desktop's object strip) → the chick → `hint.chickHint`.
12. Workbench: the first time the player focuses 工作台's input, Kuro's pill says `kuro.hint.typing` (its usual line, no card).

## R2. Rules
- One hint at a time, in the order its condition comes true; a hint waits while a dialogue box, the desktop coach marks, a choice or another hint is up, and shows when its anchor is on screen.
- Seen hints are kept in the profile (cross-run), so a second run is not taught again. Nothing is logged in the run.
- Settings (in-game and title) get a `settings.hints` row with `settings.hints.on` / `settings.hints.off` (default on); off means none show. Turning it off also ends a hint that is up.

## R3. Tests
- Each of the 12: shows once under its condition, anchored to its element; not again after `hint.ok`; not in a second run.
- Waits behind a dialogue box and the desktop coach marks; one at a time.
- Settings off: none show; the toggle is persisted.
- Clicks outside the card do nothing; Enter / Esc dismiss.
