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
