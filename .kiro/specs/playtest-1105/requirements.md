# playtest-1105 — requirements (2026-11-05, the author's first real play of day 1)

The author could not finish day 1. Everything below is from that play (the log: NOT-TODAY-测试问题记录-2026-11-05.docx). Every rule applies to all 18 days, not only day 1. Use mature patterns; where a number is given, use it. Content and strings are Claude's and already in the tree (listed under each item); do not edit content/ or public/.

## R1. A new player can see the computer (BUG, highest)
- Entering the computer for the first time in a run lands on the bare desktop: no app open, the dock visible (macOS desktop).
- 工作台 opens as a normal window (chrome `window`), never full screen by default. Full screen is only what the player chooses (the green light / an existing toggle). When it is full screen the dock still slides up when the pointer is within 4 px of the bottom edge (shell R11.2 peek, as today).
- In the 工作台 window the sidebar toggle and the tool entries (pane toggles, 老物件) are visible in the top bar at every window size ≥ 900 px wide.
- First desktop visit of a run: one centred card, title `onboard.title`, then one row per dock app in dock order (icon 28 px + one line): `onboard.tingtalk`, `onboard.workbench`, `onboard.msgs`, `onboard.browser`, `onboard.files`; one button `onboard.ok`. Shown once per run (a session flag in the save is fine; no event). Clicking outside the card does nothing.

## R2. Dialogue owns the screen (BUG)
- While a dialogue box is up, a click anywhere on the screen advances it (Enter / Space too), and nothing under the mask receives the click. Today only a click on the card advances and clicks elsewhere reach room hotspots.

## R3. Powering on, and the day's opening (JH)
- The day's `boot` beat (content/days `beats.boot.say`) plays when the day starts in the room (waking, before the player does anything), not when the tower is switched on.
- Switching the tower on says two lines: narration `room.boot.on`, then inner `room.boot.hint`. The two screens light (show their lit state) from that moment.

## R4. Things to touch in the room (JH)
- `content/room-looks.json` (+ `content/en/room-looks.json`, same keys and line counts; strict loader with twin check like sleeptalk): `{ _note, looks: { coat, bag, door, lock: string[] } }`.
- New flat hotspots (rects as fractions of the facing's backdrop, x0–x1 / y0–y1):
  - 门 (door_wall.png): coat .33–.42 / .17–.65; lock (chain + handle) .64–.70 / .31–.53; door (the leaf, minus the lock rect) .48–.69 / .02–.95; bag .69–.80 / .79–1.0.
  - 窗 (shots/window.jpg): bag .16–.245 / .74–.95; door .00–.13 / .00–.97.
- A click shows one random line from that key as an inner dialogue line; never the same line twice in a row for the same key. Logs nothing.

## R5. The meal table (JZ)
- `public/room/shots/window.jpg` is now an empty table (Claude replaced it): no food until today's meal is taken in, then the existing meal overlay (the ordered meal's art). Check that the overlay still sits on the table (WINDOW_SHOT.meal) and adjust the rect if it does not.
- 窗's table gets a close view like 桌子 (click the table → a close-up of the tabletop with the meal art large; back with Esc / the back control), using the same view pattern as 桌子.

## R6. Kuro in the room (UI / BUG)
- Talking to Kuro in the room uses the same single dialogue box as everyone else: the speaker's portrait changes per line (Kuro's portrait for Kuro, none / the player's for the player). No second box.
- Find why the room chat with Kuro only ever says "good to see you" and fix it (report the cause). If chat is locked until the day's work is done, clicking Kuro says `kuro.room.notYet` instead.

## R7. The checklist (TY)
- The day's checklist shows all task items (done rules `flag:task_*`) as one line `checklist.work` with {done}/{total}; the other items (boot, messages, box, desk, shutdown, chat, bed) stay as they are. The specific work lives in 工作台.

## R8. Settings (JZ)
- In both the in-game settings panel and the title's: `settings.restart` (clears the current run, cloud copy untouched, returns to the title) and on the title also `settings.clearAll` (clears the run and the profile: objects, album, endings; keeps language and mute). Each asks first with its confirm string and `settings.confirm` / `settings.cancel`.

## R9. Title music (SY)
- Before the first finished run (profile finishedRuns = 0) the title plays the rain bed and the instrumental `music-day`, never the sung theme. After it, the sung theme in the current language (theme_{m|f}_{zh|en}). The walkman in 老物件 keeps playing the sung theme as now.

## R10. Bugs to find and fix (report each cause)
1. The phone (iPhone on the desk / its open view) shows a white screen.
2. Back from the computer to the room, the screen image stays visible for a moment before it goes.
3. On 桌子, dragging any one prop (cup, phone) moves all props together, as if they were one layer. Each prop moves alone.
4. The room turn between facings is too fast: make it 2× its current duration with ease-in-out (report old and new ms).

## R11. Tests
One or more per item: R1 first visit lands on the bare desktop with the dock and the card once; R2 a click on the mask advances and does not reach a hotspot; R3 boot beat at day start, power-on lines; R4 loader + twin + no repeat; R6 one box; R7 one work line with counts; R8 restart clears only the run, clearAll the profile; R9 title music by finishedRuns; R10 each bug.
