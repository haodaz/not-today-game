# Requirements: room-3d-desk — the code-built desk replaces the photo 桌子

Author, 2026-11-16, on how the 3D desk enters the game: 「这个我选2，3d的其实一开始替换麻烦，但是越往后越
简单。因为一切都是数学问题。比如把东西拖动换个位置，自己布置，都行」. So: **the 桌子 view is the embedded
code-built room at its desk spot, from day 1, every day; the things on it are the hotspots.** Not a
look-only close-up. Dragging and arranging come later; this spec is plain parity with today's
photo 桌子.

Build after `room-3d-window`. Read `room-3d-window` and `room-3d-wake` first: the host
(`src/world/room/outside.ts`), the message rules (post only after `ready`), the layering.

## What the room gives (built; do not build again, never edit `room3d/`)

- Page `/room3d/index.html?embed=1&day=N`; commands after `ready`: `{ target: "nt-room", day, time
  (6–24), face (0 desk wall), spot ("desk" | "win" | …), lamp, ceil, rain, outer, eaten, far }`, plus
  `{ prints: true|false }` (the printed sheets on the shut laptop) and `{ chick: "<frame name>" }`
  (a key of `content/frames/chick.json` `frames`; repaints the chick's LCD).
- Picks: every click posts `{ source: "nt-room", type: "pick", id, face, spot }` and changes nothing
  itself (a click on the mug also takes a sip). Ids: the old objects `chick camera pager iccard tape
  dictionary calculator phone` (only when on the desk that day); `mug lamp switch`; `screen-left
  screen-right deskphone prints keyboard desk meal window slit tower box bed shelf door coat bag`;
  `null`. Things win over places.
- Locate: `{ locate: [ids] }` → `{ source: "nt-room", type: "where", rects: { id: [x, y, w, h] |
  null }, face, spot, moving }`, fractions of the frame, y down; `null` = not there; `moving` true
  while a turn / walk-up eases (ask again, or wait ~700 ms after a face / spot command).
  `screen-left` / `screen-right` are the glass panels.
- Hover: `{ source: "nt-room", type: "hover", id | null }` on change, at most every 80 ms; the room
  sets its own pointer cursor over anything pickable.
- The room decides which objects it shows by its own day table. **Ask of the other session (Claude
  relays): a `{ objects: [ids] }` command so the game's `state.found` rules.** Until it exists, the
  room's table is close enough (`content/stages.json` objectsFoundOnDay).

## What the photo 桌子 has today (parity list; `src/world/room/hud.ts` deskThings / tabletop, `shots.ts`)

| today | pick id | game action |
|---|---|---|
| left / right monitor hit → 屏幕 on that side | `screen-left` / `screen-right` | `view` desktop with `data-screen` left / right |
| an old object on the desk bar (`loop-hold`) | its id | `loop-hold` `{ object: id }` (only if `state.found` has it; else ignore) |
| the flip phone on the desk (`loop-phone` → the call sheet) | `deskphone` | `loop-phone` |
| the printed sheets (`prints-open`) | `prints` | `prints-open` |
| the day-18 slip (`desk-slip`) | `slip` (when the room models it) | `desk-slip` |
| the lamp (`lamp`) | `lamp` | `lamp`, then post the new `lamp` state |
| the cup (no action today) | `mug` | nothing (the room sips) |
| the tower's power button (房间 only today) | `tower` | `tower-power` if the room reports it from the desk spot |
| the post-ending walkman prop (`walkman-toggle`) | not modelled | nothing until it is (`walkman` id later) |
| bottom 6 % of the stage = back to 房间 | — | unchanged: the HTML edge strip over the frame |
| `keyboard desk meal window slit box bed shelf door coat bag switch null` | — | ignored on 桌子 |

The pure map: `deskPick(id, state): { action, data } | null` in a new `src/world/room/desk3d.ts`.

## R1 — One shared room frame

One persistent iframe for the room (`data-keep="room3d:room"`, `src=/room3d/index.html?embed=1&day=N`),
created the first time it is needed and then **hidden, never removed**, across views and re-renders
(`display: none` when not shown; the page keeps running). It is shown for 桌子 (this spec) and for
the window look-out (`room-3d-window`: this supersedes its "created on each look-out" line — the
look-out uses this shared frame too; its back pill and its command stay as specified). The wake
flash keeps its own `&wake=1` frame.

Creation: never on the title page. Allowed and wanted: on the first render of a day's `lying` view
(the player is still reading the waking lines, so the room is ready by the time they reach 桌子) and,
failing that, on entering 桌子 or the look-out. `day` in the URL is the day of creation; the day is
also in every command, so the frame need not be recreated at a new day — post the command.

## R2 — 桌子 is the frame

When `session.view === "desk"` (and not the `desk=photo` fallback, R6): the stage's backdrop is the
room frame (the host from `outside.ts`, kind `desk`), in place of the photo and the tabletop cutouts
(`tabletop(deskThings)`, the monitor hits, `litScreens`). The command on `ready` and on change:

```ts
{ target: "nt-room", day, time: hour, face: 0, spot: "desk", lamp: session.lampOn ?? hour >= 18,
  ceil: false, rain: weatherOf(day) === "rain", outer: false, eaten: false, far: 0 }
```
then `{ prints: printsOnDesk(day, events).length > 0 }` and `{ chick: frame }` (R5), each only when
changed. `hour` as in `outsideCommand` (`room-3d-window`): `hh + mm / 60` from the clock, clamped to
[6, 24]. Put the command builders in `desk3d.ts` next to `outsideCommand` (share the hour helper).

Everything HTML that sits over the photo today still sits over the frame, unchanged: the edge strip
(back), the held device layer, the prints view, the phone sheet, the items panel, the dialogue box,
Kuro's body, the HUD tiles, ⚙ / status panels, the case panel is not on 桌子 today and stays off.

## R3 — Picks become actions

The room-message layer (`outside.ts`, `createRoom3dLayer`) also routes `pick` messages from the
shared frame: `deskPick(id, state)` → the existing action through the controller's dispatch, exactly
as a click on the old hit button would (the same guidance refusals apply: a guided step that rings
the phone refuses `loop-hold` the way it refuses the old desk-bar button; see R4). Picks arrive while
anything is open over the view (a dialogue line, a panel, a held device): ignore them then
(`somethingOpen` from `stare.ts`, minus `outside`/`wakeFlash`).

## R4 — What the game draws over the frame

The game keeps drawing its own marks; it needs the things' rectangles for that:

- After `ready`, after every face / spot command, and when the `objects` / `prints` state changes:
  post `{ locate: [...] }` for the ids in the parity table plus `mug`. On `where` with
  `moving: false`, store `session.roomRects: Record<id, Rect | null>` in **stage px** (x·1600,
  y·900, w·1600, h·900); with `moving: true`, ask again after 700 ms.
- Draw from `roomRects`: the monitor glow (`monitor-lit`, on `screen-left` / `screen-right`), the
  guidance ring and the red / yellow marks on whatever today rings a desk hit (the monitors, the
  phone, an object, the prints — look at how `guidedItem` / the hit classes mark them today and mark
  an overlay `<i>` at the same rect instead), the one-time pointers (举起来 etc.). These overlays are
  `pointer-events: none`; the room receives the click and reports the pick.
- Hover: optional for this spec; if cheap, show the thing's existing aria-label text as the small
  tag the hits show today, at the hovered rect.

## R5 — The chick's face

The desk chick in the room shows a fixed `idle-1`. The game owns the face: export from
`src/world/room/devices.ts` (or wherever the held chick UI chooses its frame) a pure
`chickFrameNow(state, session, nowMs): ChickFrameId`, and post `{ chick }` on change (throttle to the
animation's own step). If no such chooser exists for the desk (today the desk LCD is only a CSS
placeholder), post `"idle-1"` and leave a TODO naming this spec; the held device UI is unchanged.

## R6 — Fallbacks and the comparison

- Dev URL param `desk=photo` keeps today's photo 桌子 (the author compares: 「我要有对比才有决策」).
  The headless replay driver (`script/tools/auto-day-shoot.mjs`, Claude's) will pass it; nothing for
  you there.
- If the shared frame posts no `ready` within 8 s of being shown on 桌子, show the photo 桌子 for the
  rest of the run (session flag) and `console.warn` once. Nothing is lost: the photo path stays.

## R7 — Tests

`tests/desk3d.test.ts`:
- `deskPick`: every row of the parity table (found / not-found object, each screen side, deskphone,
  prints, lamp, mug → null, ignored ids → null, `null` → null).
- the desk command (hour clamp, lamp default and override, rain day 4 / clear day 10) and the
  `prints` / `chick` posts only on change.
- `where` → `roomRects` in stage px; `moving` → re-ask (the pure part).
- picks ignored while something is open; a pick routes to the same action the old hit dispatched
  (spy on the controller).
- the 8 s fallback flag; `desk=photo` renders the old tabletop.
- the shared frame is not created on the title page; is created on the first `lying` render.

Snapshots of 桌子 change (the frame instead of the photo and cutouts): leave them failing and list
them; Claude refreshes after review.

## Out of scope

Dragging / arranging the desk, the day-10+ room faces, the switch and ceiling light (the author's
「可以增加开关和吸顶灯的交互」 — pending her answer on where), the slip and the post-ending walkman
until the room models them, `low=1` by device.

## Rules

- Never `git` anything; Claude reviews and commits.
- Never edit `content/`, `script/`, `room3d/`, or the strings; `.kiro/specs/*` are read-only to you.
- `src` must never contain the word "veins" (a test guards it).
- `npx tsc --noEmit -p .` and `npx vitest run` green before you report, except the 桌子 snapshots.
- Report in English what you built and where you departed from this file.
