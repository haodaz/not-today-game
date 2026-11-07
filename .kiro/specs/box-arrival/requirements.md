# box-arrival — requirements (2026-11-07, author)

The blind-box case arrives on day 1 with the lunch delivery: the `box` beat (content/days/day-01.json) says the doorbell, then 「门口两样东西：一袋外卖，一个没有寄件人的纸箱。」, and the item 床边那个箱子，拆了 unlocks after `pickup`. But the room shows the carton by the bed from the first morning (it is in the backdrop photographs), its hotspot works before it has arrived, and clicking it plays the blind-box opening. The author: this has to be made consistent. Content and strings are Claude's; do not edit content/ or public/.

## R1. No box before it arrives
- Until day 1's `pickup` event (the lunch taken in at the door), the room has no case: 房间 and 床 use the box-less backdrops `public/room/shots/room_nobox.jpg` and `public/room/shots/bed_nobox.jpg` (same size as room.jpg / bed.jpg; Claude supplies them), the `pick-box` / `bed-box` hotspots are not rendered, the desk bar shows no box, and the hint `hint.box` is not given. Derive "arrived" from the log (a `pickup` on day 1, or any day ≥ 2), never from a session flag: a reload before the pickup must still show no box.
- From the pickup on, everything is as today: the backdrops with the carton, the hotspots, the desk bar's box, the hint.
- The `box` beat's lines play at the pickup moment as today (the doorbell, the two things at the door, the name on the box).

## R2. Views that show the carton
- Check every still that includes the carton: the 房间 facing, the 床 facing, the camera photos' backdrops (`BACKDROPS` in the album), the title's room, any close view. Each uses the box-less still before the arrival. The 2× collapse backdrops (`public/room/fx/*`) start on day 10 and need no variant.
- The splat (`public/room/*.splat`) is not changed; if the splat is the live 房间 view on day 1, say so in the report and hide the carton's hotspot only.

## R3. Tests
- Day 1 before pickup: no `pick-box` / `bed-box` in 房间 / 床, the backdrop src is the `_nobox` file, the desk bar has no box; after pickup the normal ones; a reload between the two keeps each state; day 2 morning shows the box.
- Snapshots that change only by the backdrop src or the hotspot: list them, do not edit them.

## R4. Day 1: the arrival scene (author 2026-11-07, content in the tree)
- Day 1's `beats.box` is now the arrival scene (doorbell → the door with the bag and the carton → the player's line → the table by the window → the carton opened, nine small boxes → Kuro → the player). It plays at the moment of day 1's `pickup` (the lunch taken in), not on `openLayer` as the box beats do today. When its last line is advanced, the case overlay (`pick-box`) opens by itself; the `box` item (拆开看看。) is done by that opening as today.
- On day 1 `openLayer` queues no box beat (the scene has played); days 2–18 keep their box beats on `openLayer` as today.
- The scene's backdrops are `/room/dream/door.jpg` and `/room/dream/table.jpg`, its props `/room/props/carton.png` (closed) and `/room/props/carton_open.png` (nine boxes); Claude supplies them.
- Test: day 1 pickup queues the scene; advancing past its end opens the case; openLayer on day 1 queues no beat; day 2 openLayer still does.
