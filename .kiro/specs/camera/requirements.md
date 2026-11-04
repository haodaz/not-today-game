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
