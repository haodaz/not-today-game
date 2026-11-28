# room-3d-room · design

Same pattern as `room-3d-desk`, one level out: the shared frame (`data-keep="room3d:room"`) is the
backdrop of 房间 / 窗 / 门 / 床 on the frame days, the game draws its HTML over it, the room's picks
run the photo's actions. `room3d/` is not touched.

## R1 · `room3dOn(day, session)` (src/world/room/desk3d.ts)

```
frameDay(day)   = ringOf(day) ∈ {wall, room}  or  (ringOf(day) = door and day is one of the first two
                  days of its cycle)                      // today: days 10–17, from content/stages.json
room3dWants     = frameDay(day) and view ∈ {room, window, door, bed} and clock.beat ≠ night (R5)
                  and no line scene (backdrop or standing NPC) and no cut and no ending page / fight
                  and not deskPhoto (?desk=photo, or the 8 s net failed: R6) and not noWebGL
room3dOn        = room3dWants and session.roomFrame ≠ null      // as desk3dOn: the frame exists
```

The box-less arrival still only exists before the day-1 pickup, so it cannot meet a frame day.
`settleRoomFrame` also makes the frame when `room3dWants`. The 8 s net (`ROOM_READY_NET_MS`) and
its flag (`deskPhoto`) are shared with 桌子: one frame, one verdict for the run.

## R2 · the frame mode

`roomMode` gains `face` (after `boss`, `desk` and the window look-out, before `hidden`). The command
is the shared builder's with `spot: null` and the room's own wall numbers: 房间 0, 床 1, 门 2, 窗 3.
The spec says 窗 1 / 床 3, but `room3d/room.js` `FACES` is 桌墙 0, 床墙 1, 门墙 2, 窗墙 3. The
window look-out already posts face 3 with spot `win`, and the room only walks up to `slit` from
face 1 and `win` / `meal` from face 3. The spec's numbers would show the bed wall on 窗. Reported
for the author to settle; PROTOCOL.md's "(room, window, door, bed)" has the same slip. `roomPosts` treats
`face` like `desk` for `objects` / `prints` / `glow` (the room's things must match the game's), and
a face change re-locates. `coat` is posted as today. The stage carries `frame-on`. room.css drops
its photograph, and `applyFit` gets no backdrop (a plain dark letterbox). The turn animation
(`m-turn-face`) is skipped when the arriving stage is `frame-on`. Over the frame, at the left and
right 8 %, two plain strips (`frame-edge`) let the nav layer see the pointer on its turn edges (the
iframe would swallow it).

## R4 · renderRoom's layers on a frame view

| layer (hud.ts `renderRoom`) | on a frame view |
|---|---|
| stage photograph (room.css `.room.{view}-view`, `nobox`, `[data-coat]` door) | **photo only**: off (`frame-on`) |
| `.fx` stack and its WebGL layer (`renderFx`) | **photo only**: off |
| `.window-light` | **photo only**: off |
| `.evening-look` (dark layer, lamp glow, ceiling wash) and `ceil-day` | **photo only**: off |
| the room host (`roomHost`) | **kept**: shown as the backdrop (`face`) |
| `renderScene` (a line's backdrop / prop) | kept, but a scene turns the frame off (R1) |
| photo hot areas: `shotHits` (房间), `flatHits` (床, 窗), `lookHits`, `glassHit`, `switchHit`, `ceilingHits` | **photo only**: off; replaced by the frame marks (R3) |
| `litScreens` (`monitor-lit` at the photo's rects) | **photo only**: off; drawn instead at the room's `screen-left` / `screen-right` rects after boot, as 桌子's marks do |
| `figuresLayer` (the endings' figures on the bed, `ROOM_COLLECTION` rects) | **photo only**: off — *needs the room* |
| `shelfBook` (`ROOM_COLLECTION.book`) | **photo only**: off — the room's `shelf` place stands for it (pick → `book-open`) |
| `figureCard` (the opened figure, an overlay card) | kept (unreachable without the figures) |
| `windowThings` (窗's meal at `WINDOW_SHOT.meal`) | **photo only**: off — the room shows a meal by `day` / `eaten`; today's meal on the table or not *needs the room* |
| `doorContent`: `door-spot` buttons (`DOOR_SHOT`) | **photo only**: off — the room's `door` pick runs the spot's `loop-door` step |
| `doorContent`: `.door-bg.chain`, `.door-hand` | **photo only**: off — *needs the room* (the chain, the hand at the door) |
| `doorContent`: `renderDoorView` captions (`.door-beat`) | kept |
| `edgeHint` | kept |
| raid layer (`handStage`, `.gap-glow`) | night only: the frame is off at night (R5) |
| `wakeHost` | kept (its own frame) |
| `.hud-left` (day card, checklist, wait card) | kept |
| `itemsPanel`, `casePanel` | kept |
| `held` (viewfinder, sheet, held object) | kept |
| `dialogueBox` (portraits, standing figures, choices) | kept |
| `bottomRight` (Kuro's body), `hudTiles`, `settingsPanel`, `statusPanel`, `bookReader` | kept |

The carton has no rect layer on these views (`pick-box` / `bed-box` are hot areas). The room shows it
by `day` ("the carton" in PROTOCOL `day`). The prints are 桌子's only.

## R3 · picks → the photo's action (`roomPick`)

The authority is the code each hot area runs today (`hud.ts` PROXIES / FLAT_PROXY / lookHits /
glassHit / switchHit, `game.ts` actions). Ids not seen from the current face are not posted by the
room; where a face changes the meaning, it is keyed by view.

| room id | view | action (data) | photo source |
|---|---|---|---|
| `screen-left` / `screen-right` | any | `view` {desktop, left/right} | `monitorL` / `monitorR` |
| `keyboard`, `desk` | any | `view` {desk} | the `desk` hot area (房间, 窗) |
| `tower` | any | `tower-power` | `tower` |
| `lamp` | any | `lamp` | `lamp` |
| `switch` | any | `switch` | `switchHit` (门, 窗) |
| `window` | 窗 | `window-out` | `glassHit` |
| `door` | 房间 | `view` {door} | the `door` hot area |
| `door` | 门, 窗 | `loop-door` {next input} while a delivery waits at 门, else `room-look` {door} | `door-spot`, `lookHits` door |
| `coat` | any | `room-look` {coat} (asks 换一件) | `lookHits` coat |
| `bag` | any | `room-look` {bag} | `lookHits` bag |
| `bed` | any | `bed` | `bed` hot area |
| `box` | 床 | `bed-box` | `FLAT_PROXY.box` |
| `box` | 房间 | `pick-box` | `PROXIES.box` |
| `shelf` | from day 2 | `book-open` | `shelfBook` |
| `meal` | 窗 | `meal-table` | `FLAT_PROXY.mealTable` |
| the eight objects, `mug` | any | `deskPick` (`loop-hold`, `mug-ask`) | 桌子's |
| `slit` | — | nothing: the gap has no action by day (its glow is the night's) | none |
| `deskphone`, `prints`, `slip`, anything else, `null` | — | nothing | — |

Marks: after `ready` and every face change the layer asks `locate` for the face's mapped ids. Each
reported rect becomes an `<i class="room-mark {id}">` in `.desk3d-marks.face-marks`, carrying the
photo hot area's own action attributes (so the guide ring finds it) and its chip string. Guide: the
mark the ring lands on (`data-guide="on"`) is read back from the DOM, and its id is posted as `glow`
(the room draws the ring; the DOM ring is suppressed under `[data-glow]`, as on 桌子).

## Needs the room (for `room3d/`, Claude's)

- the endings' figures on the bed (`figuresLayer`, `figure-open`): no ids, no models
- the delivery at the door: the chain open (`.door-bg.chain`), the hand with the bag (`.door-hand`, its bleeding day), the bag and the close steps as places (today one `door` pick runs the next `loop-door` step)
- the lock on the door (`room-look lock`): no `lock` id
- today's meal on the window table by the game's state (delivered and not yet eaten), beside `eaten`: the room shows meals by `day`
- the chair (`PROXIES.chair` → 桌子): no `chair` id (the `desk` place covers the same way in)
- a ceiling camera for `lying` (not in this spec)
- the face numbering in PROTOCOL.md ("0–3 room, window, door, bed") against room.js `FACES` (桌墙 0, 床墙 1, 门墙 2, 窗墙 3)
