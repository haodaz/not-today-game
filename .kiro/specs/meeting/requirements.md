# meeting — requirements (2026-11-04, author)

Days 3, 7 and 9 happen in an online meeting (载体与交互.md: 会议 is the most used carrier; day 3's call overlay is half of it). Like the IDE (ide spec), this is a second **view** of a work-v2 board: same slots, cards, sources, Kuro fill, print, deliver and judgement. Only the look and one new card source change.

## R1. Content shape (strict loader)
A board may carry `view: "meeting"` and `meeting`:
- `people: { id, name, tile?: string }[]`: the tiles (name label; `tile` an optional image path under `/`; default a dark tile with initials).
- `lines: { t: string, who: string, text: string, card?: string }[]`: the meeting's subtitles in order (`t` like `09:02`); `who` is a person id; `card` names a board card this line reveals.
- `layout: "grid" | "seats"`; with `seats`, `seats: Record<slotId, "circle" | "triangle">` places each slot as a seat.
- New card source `from: { meeting: true }`: found once today's meeting has **reached** the line that names that card (R3). Loader: every `who` is a person, every `card` exists and has `from: {meeting:true}`, every seat names a slot; `meeting` only with `view: "meeting"`.

## R2. The meeting view (workbench, same task page)
- **Left (flex)**: the meeting window. A grid of tiles (2–4 columns); the speaking tile has a soft ring. Under the grid, the subtitle bar: `t · name: text`. A small control row: ▶ play / ⏸ pause, ⟲ from the start, and the line counter `n / total`.
- **Right (≈340 px)**: with `layout: "grid"`, today's slot rows (labels from `given.rows`) and the card tray; with `layout: "seats"`, the slots drawn as seats: circle seats on a ring, the triangle seat outside the ring (the same click-to-place as today). Kuro's assist and print below, as today.
- The lock row (if any) above the right column, as today.

## R3. Playing the meeting (event)
- ▶ advances one line every 2.6 s (0.3 s with `fast=1`); it stops at the end. Each line reached logs one event `{ kind: "open", target: "meeting:<taskId>#<index>" }` (reusing the open kind; once per line per day), so `cardFound` for `{meeting:true}` is: an `open` of `meeting:<taskId>#i` today where line i names the card. Reload resumes at the furthest line reached.
- Opening the task the first time today starts playing by itself.
- Day 3's existing call (overlay, CALL_TOTAL_MS) is untouched; a later spec may move it here.

## R4. Strings (Claude adds): `meeting.play`, `meeting.pause`, `meeting.restart`, `meeting.circle`, `meeting.triangle`.

## R5. Tests
- Loader: valid meeting board loads; each rejection in R1.
- `cardFound` for `{meeting:true}`: not found before its line is reached, found after, not from another day, not from another task's meeting.
- View: grid layout renders tiles, subtitle and slot rows; seats layout renders circle seats and one triangle seat; a table board renders as today.
- Playing: ▶ logs one `open` per new line, never twice; resume after reload at the furthest line; `fast=1` timing.
- A fixture meeting board (under `.kiro/specs/meeting/`, placeholder text) plays through: watch, place, print, send. Claude switches days 7 and 9 to `view: "meeting"` after this lands.
