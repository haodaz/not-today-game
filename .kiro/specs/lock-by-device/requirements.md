# Lock by device: the code is read off the old object, and a wrong reading costs (author 2026-11-06)

Why. Today an object lock (`board.given.lock.object`) offers three code chips; a wrong chip only shakes, nothing records it, so every lock opens in at most three clicks and the drawn device the bar opens is scenery. The author's rule (机制设计稿-干活 v2): the ability is used through the machine itself — the dictionary must be made to show the word, the calculator to show the number, the pager the page, the walkman the line — and 「交错了」 must cost. Source locks (`from`, day 5's Vivi DM) keep their chips.

Scope: object locks only (`isObjectLock`). Devices with a screen or a transcript: `dictionary`, `calculator`, `pager`, `tape`, `camera`. The chick and the IC card are not in this spec. Upgraded objects keep `autoUnlock`. Taken objects and not-found objects keep the no-tool row + 让它试.

## R1 · No chips for an object lock
- The code panel of an object lock shows no `.bcode` chips. It shows one line of status (R3) and, while the device is open over the desktop (object-bar R2, `openObjectFromBar` + `enterUse`), the device modal carries a footer: the current reading (R2) in a monospace span, and one button `board.lock.read` (「就按它显示的填」 / "Enter what it shows").
- The footer sits inside the device modal under the device (full modal width, 44 px high, the modal's tone). It is present only when the current 工作台 task has an object lock for this very object and the lock is not yet open and not jammed.
- Clicking the button appends the same op a chip did: `boardStep {t:"unlock", code: <reading>}`. The reducer is unchanged: the right code opens the column, a wrong one is pushed to `wrongCodes`.
- `board-lock` (需要提取码) still opens the device from the bar as today; with the device closed again (× / Esc) the panel stays and says `board.lock.open` (「打开它，照它显示的填」 / "Open it and enter what it shows"). Room face locks (objects-in-room R3/R7/R8) are unchanged: the trip first, then the reading on 屏幕.

## R2 · The reading (pure, `src/world/objects/reading.ts`)
`deviceReading(id, programState, env, session): string | null` — what the device shows right now, as text:
- `dictionary`: `answer` present and `answer[1] !== t("dictionary.unknown")` → the word that was looked up (`input` as typed, trimmed, lower-case). Typing or an unknown word → null.
- `calculator`: `on` and `display` is not empty and not `"0"` → `display`; when the calculator is rotated upside down (`ROTATERS`, the current roll), the upside-down reading `upsideDownOf(display)` instead.
- `pager`: `view === "msg"` → `pagerText` (the shown page, digits and spaces as content writes them); dark or time → null.
- `tape`: a tape line is in the dialogue box now (the current say's key starts with `TAPE_SAY_PREFIX(day)`) → that line's text; otherwise null. Backwards lines count (tape-reverse: that is the point of several locks).
- `camera`: the back is shown (the sheets-left counter) → the counter as digits; the front → null.
- Any other object → null.

The code the button enters is **the first lock code contained in the reading** (`lock.codes.find((c) => reading.includes(c))`); none → the button is disabled and the footer says `board.lock.noReading` (「它现在显示的不是提取码」 / "That is not the code"). Content keeps every code displayable by its device (Claude: digits for the calculator and the pager, words in the dictionary, a line on the tape that contains the code).

## R3 · A wrong reading costs
- Wrong readings are the `unlock` ops whose code ≠ answer (already in the log; `wrongCodes`). Count distinct codes.
- One wrong: the lock stays, the shake as now, status `board.lock.wrong1` (「不对。再错一次，它今天就不认了。」 / "Wrong. One more and it will not take it today.").
- Two wrong: the lock **jams** for the day: status `board.lock.jammed` (「这把锁今天打不开了。」 / "This lock will not open today."), the footer and the read button are gone, only 让它试 (`board-kuro-lock`) remains and works as today (one assist).
- The night's judgement (`wrongCount` / `judgeBoard`, work-v2 §4): the wrong count is **wrong slots + distinct wrong readings**. So one wrong reading = `flawed` at best, two = `wrong` (with `wrongAt` 2). A Kuro unlock after a jam does not undo the readings. Everything derived from the log; replay rebuilds it.
- `autoUnlock` (upgraded object) is unchanged and never wrong.

## R4 · Strings (Claude adds, zh + en)
`board.lock.read`, `board.lock.open`, `board.lock.noReading`, `board.lock.wrong1`, `board.lock.jammed`. `board.pagerCodes` and the chip markup stay for source locks.

## R5 · Tests (`tests/lock-by-device.test.ts`)
- `deviceReading` per device: dictionary known / unknown / typing; calculator on, off, "0", upside down; pager msg / dark / time; tape line present / absent, backwards; camera back / front.
- The code picked from a reading: first contained code; none → null.
- An object lock renders no chips; a source lock still does.
- The read button appends the unlock op with the matched code; right opens the column.
- One wrong: status wrong1, lock stays; two wrong: jammed, footer gone, 让它试 still opens it with one assist.
- Judgement: all slots right + one wrong reading → flawed; + two → wrong; replay rebuilds the same.
- Snapshot: the day-7 dictionary lock panel with the device open and a reading (use `?day=7&found=…`).

## Addition 2026-11-07 (Claude, from the headless run): the read footer under the dialogue mask
- A recording plays as lines in the dialogue box, and the box owns the screen (playtest-1105 R2: the `.story-mask` covers everything at z-index 30, a click anywhere advances the line). The walkman's read footer (`board-read` in the 老物件栏 modal, `.objbar-host`, also z-index 30 but earlier in the DOM) is therefore under the mask while the only moment the reading is offered is while that line shows: a player can never press 「就按它显示的填」 for a tape (or any device whose reading is a dialogue line). Keys on the device are swallowed the same way until the line is advanced.
- Fix: while a device modal is open, the dialogue mask must not cover the modal's footer and keys: either the dialogue layer sits under the modal's footer/keys (the footer and the key row above the mask, the rest of the screen still masked), or a tape line does not raise the mask at all (it is the device's own say). The reading must stay offered while its line is in the box, and advancing the line by clicking elsewhere still works.
- Test: with a tape line in the box and the footer enabled, a click on `board-read` opens the lock (not advances the line); a click on a device key presses the key.
