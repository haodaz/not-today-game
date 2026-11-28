# Game ↔ room protocol (v1, 2026-11-25)

The code-built room (`room3d/room.js`) runs in an iframe. The game talks to it only by
`postMessage`; the room answers the same way. This page is the whole contract. It was written down
after a missing reply left the guide ring behind a dragged phone (day1-playtest-1117 R6): if a new
message is not on this page, `tests/room-protocol.test.ts` fails.

- **Game → room:** `{ target: "nt-room", ...fields }`. Every field is optional; the room applies
  the ones present, in the order below. Senders: `src/world/room/desk3d.ts` (`roomPosts`, the desk
  and the window), `src/world/room/outside.ts` (the shared frame), `src/world/room/wake.ts` (the
  day-4 wake flash), `src/world/endings/phase2.ts` (the final battle and the endings).
- **Room → game:** `{ source: "nt-room", type, ...data }`. Receivers: `outside.ts`, `wake.ts`,
  `src/world/endings/flow.ts`.

## Game → room

### The day and the camera
| Field | Value | What the room does |
|---|---|---|
| `day` | 1–18 | the day's look: collapse amount, broken pixels, unreal lines (`dayLook`), objects, meals, the carton, the hand |
| `snap` | `false` | with `day`: keep the current look instead of jumping to the day's (a fade the game drives) |
| `time` | hour, 6–24 | daylight, the window, the lights across the yard |
| `face` | 0–3 | which wall the camera faces (room, window, door, bed) |
| `spot` | `"desk"`, `"meal"`, `"win"`, `"slit"` or `null` | the camera goes up to that spot; `null` stands back |
| `far` | 0–1 | how far the camera has pulled back (the endings' pull-out) |
| `pause` | boolean | stop or restart drawing (a frame the game has hidden) |

### Lights, weather, meals, things
| Field | Value | What the room does |
|---|---|---|
| `lamp` | boolean | the desk lamp |
| `ceil` | boolean | the ceiling light (the wall switch) |
| `rain` | boolean | rain on the window |
| `outer` | boolean | the outer world beyond the window (the last day) |
| `eaten` | boolean | the meal on the table is the eaten version |
| `objects` | string[] or `null` | which old objects lie on the desk (`null`: by day) |
| `prints` | boolean | the prints the hand left lie on the desk |
| `walkman` | `true`, `"stopped"`, `"playing"`, `false` | the walkman on the desk, its reels turning or not |
| `chick` | frame name | paints the chick's LCD |
| `glow` | object id or `null` | the guide's glow: a pulsing ring under that object, following it |
| `layout` | `{ id: [x, z] }` or `null` | puts the desk things where a saved layout says |
| `mug` | `"hold"`, `"sip"`, `"gulp"`, `"glug"`, `"down"` | the coffee mug: up in the hand and waiting; drink from the hand (a sip, a mouthful, all of it) and set it down; back on the desk untouched. A new `day` fills it again |

### Asking
| Field | Value | What the room does |
|---|---|---|
| `locate` | string[] of ids | answers `where` with each id's rectangle on screen |

### The final battle and the endings (`phase2.ts`)
| Field | Value | What the room does |
|---|---|---|
| `boss` | boolean | the red world, the boss in the room; with `risen: true` he starts standing |
| `risen` | boolean | with `boss` |
| `dislocate` | `true` | the room dislocates (answers `dislocated`) |
| `rise` | `true` | the boss rises (answers `risen`) |
| `leave` | `true` | the world pulls away (answers `left`) |
| `strike` | `true` | a hit lands |
| `hurt` | `true` | the boss is hurt |
| `condense` | boolean | the world condenses to one eye on a far greater Kuro (answers `eye`) |
| `rush` | `true` | the rush out, once the eye has been seen (answers `out`) |
| `home` | `true`, `"cut"`, `false` | the good ending's room; `"cut"` arrives by a story cut (answers `home`) |
| `kuro` | boolean | the small Kuro on the bed in the good ending, on cue |
| `peek` | number | debug: peek value for the greater Kuro |
| `greatLook`, `greatZoom` | part, number | debug view of the greater Kuro (`?great=1`) |

### Other
| Field | Value | What the room does |
|---|---|---|
| `wake` | `true` | the day-4 wake flash (answers `wake-line`, then `wake-done`) |
| `surge` | `true` | day 17's surge: the door wall, the door thrown open, the tentacles coming in (answers `surge-start`, then `surge-done`); also played from the URL with `surge=1` |
| `at` | epoch ms | with `surge`: when to start it, on the caller's clock (absent: at once) |
| `vision` | `true` | debug: toggles the vision overlay |

## Room → game

| `type` | Data | When | Who listens |
|---|---|---|---|
| `ready` | none | the first frames are drawn | `outside.ts`, `wake.ts` |
| `where` | `rects`, `face`, `spot`, `moving` | after a `locate` | `outside.ts` → the guide's marks |
| `pick` | `id`, `face`, `spot` | a click on a desk thing | `outside.ts` → the game's own action for it |
| `mug` | `word`: `"empty"` or `"ahh"` | the mug was asked to drink and is empty; a whole mug went down in one | `outside.ts` → one line in the game's language |
| `hover` | `id` | the pointer moves onto another thing | `outside.ts` (cursor) |
| `moved` | `id`, `x`, `z` | a dragged thing is set down | `outside.ts`: keeps the layout, asks `locate` again |
| `wake-line` | none | the wake flash wants the game's line said | `wake.ts` |
| `wake-done` | none | the wake flash is over | `wake.ts` |
| `surge-start` | none | the door is opening | nobody yet (the klotski stage runs on its own clock) |
| `surge-done` | none | the surge has played | nobody yet |
| `dislocated` | none | after `dislocate` | `flow.ts` |
| `risen` | none | the boss is up | `flow.ts` |
| `left` | none | the leave has ended | `flow.ts` |
| `eye` | none | the whole greater Kuro has been seen | `flow.ts` |
| `out` | none | the rush is through | `flow.ts` |
| `home` | none | the good ending's room has arrived | `flow.ts` |

## Rules
- The game never waits forever on a reply: every wait has a net (a timer) in the game.
- The room keeps no story: it shows what it is told and reports what the player did to it.
- A new field or reply goes on this page in the same change (the test checks).
