# room-turn — requirements (2026-11-04, author)

The room was two pictures and a door you had to back out of ("完全不3d，和贴了2个图差不多"). Now
the room is four walls you turn between, and every wall leads to the next, so no move ever needs a
"back" out of it ("4面连起来的好处就是不会出现需要跳出的交互了").

Floor plan (author-approved sketch, 2026-11-04): north = desk wall (the big window's corner on its
left), east = bed wall (bed head by the desk with the parcel box between them; a tall narrow window
at the door end), south = door wall (the door toward the west end; the curtain at the left of the
door still is that narrow window), west = big window wall (the little meal table under the window,
left of centre; the desk comes in from the right). Turning right: 房间 → 床 → 门 → 窗 → 房间.

Assets (Claude supplies, already in the tree): `public/room/shots/bed.jpg`, `public/room/shots/window.jpg`
(1664×928, fitted to the 1600×900 stage like room.jpg: cover, centred). 门 keeps `public/room/door_wall.png`
and its door actions. Strings (already in content/strings): `hud.turn.left`, `hud.turn.right`, `room.mealTable`.

## R1. Four facings
- The top level of the room is one of four facings: `room` (the desk wall, today's 房间 still), `bed`,
  `door`, `window`. `session.view` keeps these names; `bed` changes meaning from the splat sleep pose
  to the bed facing (its still is bed.jpg); `window` is new.
- 桌子 and 屏幕 stay as levels under `room` (walk to the desk, back out to `room`). The four facings
  are all top level: none of them has a back strip, right-click / Esc / wheel-back do nothing there.
- 门 is no longer a level: its bottom back strip goes, and 房间's right-8 % door edge goes. The door's
  own actions (chain, opening, the delivery beat) are unchanged, now on the door facing.

## R2. Turning
- **Edges.** On every facing, the left 8 % and right 8 % of the stage are the turn edges. Resting the
  pointer there fades in (200 ms, under the HUD, like today's edge hints) a soft arrow ← or → with
  the word `hud.turn.left` / `hud.turn.right`; the cursor is `walk`. Clicking turns 90° that way.
- **Keys.** ← and → turn, on the four facings only (not at 桌子 / 屏幕, not on the desktop, not while
  a dialogue, a list, the items panel, a text field or the held object has the keys).
- **Motion.** A turn is a 450 ms horizontal slide: the outgoing still leaves toward the side you turn
  away from and the arriving still comes in from the side you turn toward, eased in/out, with the
  walking rule's ±4 px bob once. Each still's placed things ride with their still (never ahead of it,
  per the 2026-11-02 correction). HUD, clock and checklist stay put. Reduced motion: the 400 ms
  crossfade instead. A turn asked for during a turn waits for it to finish (at most one queued).
- **Going somewhere by code.** Whatever today moves the view to `door` or `bed` (the delivery knock,
  the sleep flow, `data-view` buttons, the 门 hotspot) now turns the shortest way; two facings away is
  two turns back to back, 300 ms each, toward the right. From 桌子 / 屏幕, back out to `room` first.
- Nothing about turning is an event or state: like today's moves it is session only.

## R3. What each facing has (stage px on 1600×900; Claude measured)
- `room`: as today (tower, monitors, lamp, desk, box, bed), minus the door edge.
- `bed`: `bed` {l:500,t:490,w:817,h:410} → today's bed action (the sleep flow); `box`
  {l:236,t:616,w:261,h:237} → turn left to `room`, then today's box action.
- `door`: today's door actions and rectangles.
- `window`: `mealTable` {l:565,t:600,w:225,h:300}, label `room.mealTable`. Today's meal cutout moves
  here from 桌子's tabletop: the meal that `deskMeal` picks is drawn on the little table at
  {l:615,t:570,w:105,h:85} (same art, scaled to the rect), and clicking it (or the table while a meal is
  there) is today's eat step (`eat:<meal>`). 桌子 no longer draws the meal. The still shows a takeout box
  already; Claude will supply a clean still later, keep the rect.
- The hotspots go in the framing table next to the others (fixed rectangles, like ROOM_SHOT); hover,
  Tab / Enter and the cursor rules apply as for 房间. The splat stays off; with `?splat=1` the new facings
  simply have no splat (show the still).

## R4. Looks that depend on the view
- Evening look, the collapse shader and the photo-collapse stills apply to all four facings. Where a
  stage still is missing for `bed` / `window`, use the base still with the shader (Claude supplies the
  stage stills later, same file pattern as the existing ones).
- Raid / night-hand overlays: keep today's rules per view; `window` behaves like `room`.

## R5. Tests
- Turning order both ways from each facing; ←/→ keys turn only on facings and only when nothing else has
  the keys; a second turn during a turn queues once, a third is dropped.
- Edge hints only in the outer 8 % and only on facings; no back strip on any facing; Esc / right-click do
  nothing on a facing and still back out from 桌子 / 屏幕.
- Shortest-way moves: `room → door` is two turns right; `window → bed` two turns right; `door → bed` one
  left. The delivery knock lands on `door`; the sleep flow lands on `bed`.
- The meal is drawn on the meal table in `window` and not on 桌子; clicking it logs today's eat step once.
- Snapshots: the four facings at rest (day 1 morning), and `room` with the right arrow showing.
- Reduced motion: a turn is the crossfade.
