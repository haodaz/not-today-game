# Camera viewfinder: frame the room, one sheet a day, the sheet rests overnight (author 2026-11-06)

Why. Today a room photo is the shutter key on the held camera: it fires at once from wherever you stand, and the pack (10 sheets) is the only limit. The author wants a viewfinder (her reference: a mobile game's photo mode — a frame over the scene, a shutter button, a close button; no zoom): the player can look through it, turn to another facing, and not press. One room photo a day: the sheet "needs to rest"; a second try that day is a line, not a photo. Screen photos (屏幕) are unchanged.

## R1 · The viewfinder
- With the camera held in the room (any facing, not 屏幕), pressing `shutter` no longer takes the photo. It opens the **viewfinder**: the device leaves the hand's slot, the room stays, and over it:
  - a frame: a 4:5 rectangle, 72 % of the stage height, centred, 2 px white corners (28 px long) and a thin white border at 35 %; the room outside the frame dimmed 25 %;
  - a round **shutter button** on the right edge, vertically centred: 64 px, white ring 3 px, a red dot `#E5322D` 40 px inside (hotspot 80 px);
  - a **close** × at the top-right of the stage (36 px, white at 80 %);
  - no zoom slider, no filters.
- Turning works as in the room (edge turns / nav layer): the frame stays, the facing changes under it. The desktop view (屏幕) cannot be entered while the viewfinder is up; Esc or × closes it (the camera is back in hand).
- Keys: Space or Enter = shutter; Esc = close. The world prompts and the HUD hide while the viewfinder is up; the dialogue box is never opened over it.

## R2 · One sheet a day
- The shutter in the viewfinder takes the photo as today (`photo` event, `at: room:<facing>`, the pack counts down, flash and eject sound) **only if no room photo was taken today** (`photo` events of this day with a `room:` at).
- A second press that day: no photo, no sheet. The viewfinder closes and one inner line plays: `camera.usedToday` 「今天用过了。连拍立得都知道一天只干一个活。」 / "Used today. Even the instant camera knows one job a day." The pack is unchanged.
- The pack at 0: `camera.empty` as today, the viewfinder closes.
- Day 18 keeps its on-the-spot developing (camera R10).

## R3 · The sheet in hand
- After the shot the viewfinder closes and the ejected sheet is shown as a close view, like an object's 使用 face: the white frame 200 × 236 at 2.4 × (480 × 566), centred, the room dimmed 35 %. Its picture area is blank (R10: a room photo stays blank all day).
- Under it one narration line: `camera.rests` 「显影很慢。胶片好像也需要休息……放一夜再看看。」 / "It develops slowly. The sheet seems to need its rest too… leave it a night and look again."
- Any click, Esc or Enter puts the sheet away (it is in the album as today). No events beyond the `photo`.

## R4 · Strings (Claude adds, zh + en)
`camera.usedToday`, `camera.rests`, `camera.viewfinder.close` (the ×'s label).

## R5 · Tests (`tests/camera-viewfinder.test.ts`)
- `shutter` in the room opens the viewfinder, no `photo` event; the frame and the button render; turning changes the facing under it.
- The shutter button logs one `photo` with the facing, closes the viewfinder, shows the sheet with `camera.rests`; a second shot that day logs nothing and plays `camera.usedToday`.
- Esc closes without a photo; Space takes one.
- 屏幕 photos unchanged: the held camera's `shutter` on the desktop takes a screen photo at once, unlimited.
- The pack at 0: no viewfinder photo, `camera.empty`.
- Snapshot: the viewfinder over 房间.
