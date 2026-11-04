# camera — requirements (author 2026-11-03 / 11-04)

The textbook (day 2) is replaced by a **disposable film camera** from the end of primary school (`script/notes/端盒与物件节奏.md` § 课本换成一次性胶片相机). Its power, the author's words: 「相机的工作能力是截图后看不一样的地方……不用额外等一天。但是拍现实会隔一天才能显出照片。」 Objects arrive one a day (stages.json `objectsFoundOnDay`, already re-timed: camera = day 2). Holding / using, works rules, locks: reuse objects-in-hand, objects-in-room, object-bar. Invent nothing beyond this.

## R1. The object
- `camera` replaces `textbook` everywhere the object ids are listed (types, found / recognised lists, objects.json, stages.json, the object strip, the case). `textbook` goes away; its back-cover 「96」 cell is not carried over (that memory moves to a test paper tied to the chick, Claude, later).
- Front: a cardboard-wrapped disposable camera. Keys (hotspots from objects.json `keys`, Claude measures): `shutter` (top), `wheel` (the thumb wheel at the back-right), `flash` (the front button). A small **counter window** shows shots left (27 at the start of the run).
- Using it: `wheel` must be turned once after each shot (a click; the counter window ticks) before `shutter` works again; `shutter` = a white flash over the screen (120 ms) and a click (`camera-shutter`, silent if missing); the counter drops by one. At 0 the shutter does nothing (the counter shows 0). Session state for the wheel; the count comes from the log (R2).

## R2. Two kinds of photo (event `photo`)
Every shot logs `{ kind: "photo", day, at: string, t }`, where `at` is where the camera was pointed:
- **On the screen** (屏幕 view, either monitor): `at = "screen:<place>"` (the place id the screen already uses, e.g. `screen:workbench:task:<id>`, `screen:tingtalk:<conv>`, `meeting:<taskId>`). The photo is ready **at once**.
- **In the room** (房间 / 床 / 门 / 窗): `at = "room:<facing>"`. The photo is **developed the next day** (it appears from day+1).
- Shots left = 27 − photos so far this run.

## R3. The album (文件 app)
- A folder 相册 (`files.album`) lists the photos, newest first, as thumbnails with time and place. A screen photo shows a still of what was on that screen (a static copy of the markup at that moment is enough; iframes as a grey box). A room photo shows the facing's still (`public/room/shots/<facing>.jpg`) with what content adds for that day (R4); before day+1 it is not listed.
- **Differences** (the screen power): when a screen photo is opened next to the live screen of the same place, the album shows both side by side and draws a thin red ring around every element whose text differs between the two (compare text of matching `data-*` keyed elements; nothing smarter). That is how the player sees 「不一样的地方」.

## R4. Content (Claude, after this lands)
- `content/photos.json`: `{ "room": [{ "facing", "fromDay", "toDay"?, "add": { "text"?: string, "overlay"?: path } }], "screen": [{ "at", "day", "add": { "text"?, "overlay"? } }] }`: what a developed room photo or a screen photo shows that the eye did not (e.g. day 10's meeting tile with the Yellow Sign; day 15's swapped faces). Strict loader; missing file = nothing extra.
- objects.json `camera`: recognise question, keys, `works: { at: [room, bed, door, window] }` (anywhere); locks may use `object: "camera"` (days 10 and 15).

## R5. Strings (Claude adds): `files.album`, `obj.key.camera.shutter`, `obj.key.camera.wheel`, `obj.key.camera.flash`, `camera.empty` (no shots left), `camera.wind` (wind first).

## R6. Art (Claude supplies): `public/objects/camera_front.png`, `camera_back.png`, `camera_white.png`; `public/sfx/camera-shutter.mp3`, `camera-wheel.mp3`. Missing assets degrade silently (a tinted box).

## R7. Tests
- Object list: `camera` everywhere `textbook` was; day 2's box gives the camera.
- Shutter needs the wheel; flash + count; 27 → 0 then nothing.
- `photo` events: screen vs room `at`; screen photos listed at once, room photos from day+1.
- Album side-by-side marks exactly the changed elements (fixture with two differing texts).
- A board lock with `object: "camera"` behaves like the other object locks.

## R8. Amendment (author 2026-11-04, after R1–R7): an **instant camera** (拍立得), not a disposable
「你弄个拍立得就行，然后如果照真实的屋子 / 拍屏幕显影需要时间」「这样可以画计算器、文曲星材质的效果（我们有一套电子材质）」「工作时不限制用处。但是在现实世界只有 10 张」「每天拍某个角落会有崩坏的东西被拍出来……十几天 × 4（四面墙）」. Where R8 differs from R1–R7, R8 wins.
- **Keys**: `shutter` (the red button, front right) and `flash`. **No wind wheel** (remove it and `camera.wind`). The counter window on the back shows sheets left in the pack.
- **Sheets**: photos of the **room** (`at: "room:<facing>"`) use the pack: **10 per run**; at 0, the shutter clicks and nothing comes out (`camera.empty`). Photos of the **screen** (`at: "screen:…"` / `meeting:…`) are **unlimited** and never count.
- **Every photo develops**: the sheet ejects from the front slot (`camera-shutter` already contains the eject whirr), then develops over **20 s real time**, drawn by code in the objects' electronic-material set (like the calculator's LCD and the dictionary's dot matrix): blank grey-white → a cyan cast with the shapes coming up → the final colours. A photo closed before it is done keeps developing in the album; the album shows its current stage.
- **Room photos** are no longer "next day": they develop like any other (20 s) and show the facing's still plus the content's addition for **(day, facing)** (`content/photos.json` `room: [{ day, facing, add: { text?, overlay? } }]`; `fromDay/toDay` are replaced by `day`). The addition appears only in the last stage of developing.
- **Screen photos**: once developed, the side-by-side with difference rings (R3) as before.
- Tests: 10 room sheets then empty; screen photos unlimited and uncounted; the three developing stages by elapsed time; a room photo on (day, facing) shows that day's addition only when developed.

## R9. The camera in 使用 is a drawn device, clean (author 2026-11-04: 「你出的这些素材总感觉长的特别旧」)
Like the calculator and the dictionary (devices.ts, `DEVICE_IDS`), the camera's 使用 face is the game's own drawing, not the photo: add `camera` to `DEVICE_IDS`. Flat, clean, bright, not worn (the photo `camera_front.png` stays for holding only). Parameters (CSS, inline SVG for the lens):
- Body 360 × 300 px, radius 28 top / 18 bottom. Upper part (top 62 %): `#F6F4EF` (warm white) with a 1 px `#E3DED4` edge. Lower part: `#2B2B2E` (near-black), with the photo slot: a 260 × 10 px slit, `#141416`, radius 5, centred 26 px from the bottom.
- A vertical stripe of our own under the lens, 34 px wide, from the lens to the black part: two bands `#2FB7A8` (teal) and `#F07A5A` (coral). No rainbow, no logo, no text.
- Lens: centred in the upper part, outer ring 132 px `#1E1E21`, inner glass 84 px radial `#3A4A55 → #11161A`, one small white highlight.
- Flash window top-left 78 × 46 px, radius 8, fill `#FFFFFF` with 6 thin vertical lines `#D9D9D9`. Viewfinder top-right 54 × 46 px, radius 10, `#1E1E21` with an inner `#5B6770` square.
- Keys: `shutter` a 46 px red button `#E5322D` (bottom-left of the upper part, 2 px darker ring, presses 2 px); `flash` a small 30 × 14 px yellow slider `#F2B632` under the viewfinder (toggles left/right).
- The counter (sheets left) is a tiny 7-segment readout on the back, drawn with the calculator's seg code, shown when the device is flipped (`FLIPPERS` gets `camera`).
- The ejected sheet: a white frame 200 × 236 px (thick bottom border like an instant photo) sliding down out of the slot over 600 ms; its picture area develops as R8 says.
- Upgraded state: the same shell with class `upgraded` (as the other devices): the sheet develops instantly, never shows the content's addition (Kuro tidies it away).
