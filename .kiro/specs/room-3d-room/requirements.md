# room-3d-room: on days 10–17 the room itself is the code-built room

Author, 2026-11-16: 「我觉得10天之后的房间可以变成你的3d」 (confirmed: room photos days 1–9, 3D from day 10; 「首先把所有原本能交互的都做上」). Author, 2026-11-28, on finding it was never wired: 「这时候房子不是3d效果了吗，我也有点困惑了」, then: 「2也做，我觉得17天前是3d，18是真实崩坏」.

Before this spec: the code-built room (`room3d/`, one shared iframe, `src/world/room/outside.ts`) is shown in three places only: 桌子 from day 1 (spec `room-3d-desk`), the look-out of the window (`room-3d-window`), and the endings / day 17's cutscene. The views 房间, 窗, 门 and 床 are photographs on all eighteen days.

After this spec: on **days 10–17** those four views are the room frame at the matching `face`. **Day 18 is photographs again** (the flesh ones, commit 7a6dde3: 「18是真实崩坏」). Days 1–9 stay photographs.

Scope for Kiro: the game side only. **Never edit `room3d/`** (it is Claude's; its contract is `room3d/PROTOCOL.md`). **No sentence is written by Kiro.** Read first: `.kiro/specs/room-3d-desk/requirements.md` and its design (this spec is the same pattern, one level out), `src/world/room/desk3d.ts`, `src/world/room/outside.ts`, `src/world/room/hud.ts` (what each photo view draws), `src/world/room/shots.ts` (the photo hot areas), `room3d/PROTOCOL.md`.

## R1 · When a view is the room frame

One pure function next to `desk3dOn` (`src/world/room/desk3d.ts` or a sibling): `room3dOn(day, session)` is true when all of these hold:

- the day's ring is `wall` or `room`, or the day is one of the first two days of ring `door` (read `content/stages.json` through `@state/stages`; with today's table that is days 10–17; never hardcode day numbers except through that table), and
- `session.view` is `room`, `window`, `door` or `bed`, and
- nothing that needs the photograph is up: a dream or memory scene (`scene-on`), a line with a backdrop / standing NPC scene, the box-less arrival still, a cut (`src/world/cut`), the ending pages, and
- the frame is usable: `session.deskPhoto` is false (the `?desk=photo` switch and the headless walk keep photographs everywhere) and the frame has not failed its `ready` within `ROOM_READY_NET_MS` this run (R6).

`lying` and `table` stay photographs in this spec (the room has no camera for the ceiling; `table` is listed under "Not in this spec").

## R2 · The frame is the backdrop

- The shared frame (R1 of `room-3d-desk`; do not make a second iframe) is shown under the HUD for those views, with `face`: 房间 0, 窗 1, 门 2, 床 3, and `spot: null`. The other command fields are the ones `deskCommand` already sends (`day`, `time`, `lamp`, `ceil`, `rain`, `coat` when it is not 0, and so on).
- Turning between two of these views (`room-turn`) posts the new `face`; the room turns by itself. The photo turn animation (`m-turn-face`) is not played between two frame views. A turn between a frame view and a photo view (never happens inside one day, but `lying` ↔ `bed` does) cross-fades as 桌子 ↔ 房间 does today.
- While a frame view is shown, the photo layers of that view are not drawn: the stage's own background photograph, the `.fx` stack and its WebGL layer, `.window-light`, `.evening-look` (the room has its own lamp, ceiling light and daylight). The letterbox behind the stage is plain dark (`applyFit` with no backdrop).
- The screen's text creatures (`src/world/desktop/textlife`) are untouched: they live on the monitor, not in the room.

## R3 · Picks become the photo's actions

The room posts `{ source: "nt-room", type: "pick", id, face, spot }` and changes nothing itself. Map every id that has a photo counterpart to **the same action the photo hot area runs** (find each in `hud.ts` / `shots.ts` / `game.ts`; the list below is the intent, the code is the authority):

- `screen`, `keyboard`, `desk` → the view change the monitors / the desk hot area make today (`view` to `desktop` / `desk`)
- `tower` → `tower-power`; `lamp` → `lamp`; `switch` → `switch`
- `window` → `window-out` (the look-out, already the frame); `slit` → what the gap does today
- `door` → `room-look` door (and the delivery's door prompt when a delivery waits: whatever the photo's door spot does then)
- `coat` → `room-look` coat (which now asks 换一件; the frame already shows the chosen garment through `coat`); `bag` → `room-look` bag
- `bed` → the bed action (the lie-down ask); `box` → the carton's action (`bed-box` / open case); `shelf` → the bedside book
- `meal` → the view change to the table (`table`, a photo view)
- the eight objects and `mug` when they are in frame → their desk actions, as `deskPick` maps them
- any other id, or `null` → nothing

The hover chips: ask the room where each mapped id is (`locate` → `where`), and draw the same invisible marks with `data-chip` the desk uses (`.desk3d-marks > .room-mark`), with the chip strings the photo hot areas carry today. A mark is only a place for the chip and the guide ring: the click is the room's pick.

The guide (`guideNow`) and the air walls keep working: a guided target that is one of these ids glows in the room (`glow`) and its mark carries the ring, as on 桌子.

## R4 · What the game still draws over the frame

Everything that is not the photograph: the HUD, the checklist, the dialogue box with portraits and standing figures, the choices, the object strip, the held object, Kuro's floating body, the night's hand layer, the delivery's door prompt. Go through `renderRoom` in `hud.ts` and sort every layer into "photo only" (off on a frame view) or "kept"; put the table in `design.md`.

Things that are **placed on the photograph by coordinates** (the figures of `content/…` with rects, `facing-things`, `door-spot`, `box-open`, `shelf-book`, prints, the carton): do not guess a 3D place for them. For each, write in `design.md` one of: "the room already shows it by `day` / a command" (name the field), or "needs the room" (Claude will add it to `room3d/`), and on a frame view draw none of the second kind. Report the "needs the room" list at the end.

## R5 · Nights

The evening and the night beats (`isEvening`, the hand nights of days 10–17, the dream nights 11 and 15) are where the photo view carries most staged pictures. In this spec: **from the moment the day's clock is in the `night` beat, the four views are photographs again** (the existing night look, hand and scenes play exactly as today). The frame views are for `boot`, `work`, `afternoon` and `desk`. Say so in one comment where the rule is.

## R6 · Fallback and switches

- No `ready` from the frame within `ROOM_READY_NET_MS` of first being shown on one of these views: photographs for the rest of the run (the rule 桌子 has), no error shown.
- `?desk=photo` (the walk driver passes it): photographs everywhere, as today.
- `prefers-reduced-motion`: the frame is still used; turning posts the `face` with no added game-side animation.
- A machine without WebGL (`hasWebGL`): photographs.

## R7 · Tests

- `room3dOn`: true on days 10–17 for the four views in the day beats; false on days 1–9 and 18, at night, on `lying` / `table` / `desk`, with `deskPhoto`, in a scene, after a failed `ready`. Property: for every day and view it never returns true when the day's ring is before `wall`.
- Markup: on a frame view the stage has no `.fx`, no `.window-light`, no `.evening-look`, no photo hot areas, and has the room host; on day 18 and on day 9 it has the photographs as today (existing snapshots unchanged).
- Posts: entering 床 on day 12 posts `face: 3`; turning to 门 posts `face: 2` and nothing else changes; the garment (`coat`) is posted when not 0.
- Picks: each id of R3 runs its action (`coat` leaves the 换一件 ask in the box; `switch` toggles `ceilOn`; `bed` asks to lie down); an unmapped id does nothing.
- The headless walk (`script/tools/auto-day-shoot.mjs`, `?desk=photo`) needs no change: days 10–17 still clear in it. Do not run it; say that it was not run.
- `npx tsc --noEmit` and `npm test` green, read, then commit as a separate step. Update a snapshot only where the diff is exactly this spec's markup, and say so.

## Report

At the end, in the chat: what is on a frame view and what is not (the R4 table in short), the "needs the room" list, anything in R3 that had no photo counterpart, and what was not checked in a real browser.

## Not in this spec

- Any change inside `room3d/` (a ceiling camera for `lying`, things the room does not show yet): Claude's, from the "needs the room" list.
- The `table` view up close in 3D (`spot: "meal"`), the nights in 3D, day 18.
- Any line, chip text or name.
