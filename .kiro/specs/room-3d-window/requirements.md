# Requirements: room-3d-window — the window look-out in the code-built room

Author, 2026-11-16: 「希望今晚能把3d在合适的天数和范围里用进去」, and the rollout she confirmed:
the desk close-up in 3D from day 1, the room faces in 3D from day 10, **the view out of the window
always 3D with a look-out interaction in the photo room**, a wake flash on a morning not yet chosen.

This spec is the first slice: **the window look-out, every day, from the photo room's 窗 facing.**
It is the one 3D view with no hotspots of its own, so it needs no hotspot map. The desk close-up, the
day-10 faces and the wake flash are later specs built on the same host.

## What already exists (do not build again, do not edit)

- `room3d/` is the code-built room, a second Vite page (vite.config.ts `build.rollupOptions.input`;
  dev and prod both serve it at `/room3d/index.html`). It belongs to another session: **never edit
  anything under `room3d/`.** three.js is in its own chunk, loaded only when the page is loaded.
- `room3d/index.html?embed=1` shows only the picture, filling its frame, and is driven by
  `postMessage({ target: "nt-room", ... })` from the parent:
  `day` 1–18 · `time` 6–24 (hours; full daylight before 16.8) · `face` 0 desk wall / 1 bed / 2 door / 3 window ·
  `spot` `"desk" | "meal" | "win" | "slit" | null` · `lamp`, `ceil`, `rain`, `outer`, `eaten` booleans ·
  `far` 0–1 · `wake: true` · `vision: true`. It posts `{ source: "nt-room", type: "ready" }` to the
  parent after its first frames. `?embed=1&low=1` is the low-spec render.
- The window facing is `view === "window"` on `public/room/shots/window.jpg` (1664×928); its hits are
  `LOOK_SPOTS.window` (bag, door) and `FLAT_HOTS.window` (the meal table) in `src/world/room/shots.ts`,
  rendered by `lookHits` / `flatHits` in `src/world/room/hud.ts`. The glass itself has no hit.
- `leaveControl()` in `src/world/desktop/shell.ts` is the left-edge pill (`.leave-screen`, styled in
  `src/world/room/room.css` under `.hud-host`). The look-out's way back is the same pill.
- Strings (Claude, already in both languages): `room.window.look` (看窗外 / Look out of the window),
  `room.window.back` (离开窗边 / Step back from the window).
- Stares: `somethingOpen()` in `src/world/room/stare.ts` lists what stops a stare countdown.

## R1 — The glass is a hit on the 窗 facing

On `view === "window"`, beside the existing look hits, one more `look-hit` button covers the glass:
`data-action="window-out"`, `title`/`aria-label` `t("room.window.look")`, class `look-hit glass`, rect
`fracRect(WINDOW_WALL, 0.385, 0.643, 0.145, 0.56)` (the two panes between the frame, measured on
window.jpg). It is rendered on every day; it is not a guided target. During a guided step it is
refused exactly as `room-look` is (whatever the guidance module does to off-path clicks, the same).

## R2 — Session and actions

- `Session.outside: { readonly since: number } | null` (initial `null`). Session only; no event.
- `window-out`: only when `view === "window"`, `outside === null`, nothing is open (the same
  `somethingOpen` test as the stare uses, minus `outside` itself); sets `outside = { since: now }`.
- `window-back`: sets `outside = null`. Esc does the same while it is open (before any other Esc
  handling). Everything else the keyboard does on the facing (turning, wheel-out) is off while open.
- The box, the panels, 道具, ⚙ and the dialogue box keep working over it (they sit above, see R3);
  opening the dialogue over it does not close it.

## R3 — The host: the iframe and the way back

While `outside !== null`, the room stage (`.stage.room.window-view`) gets a child
`<div class="outside-host">` positioned over the whole stage (absolute, inset 0, scaling with the
stage like the hits do), with:

- `<iframe class="room3d" src="/room3d/index.html?embed=1&day=${state.day}" title="${t("room.window.look")}" allow="" loading="eager" referrerpolicy="no-referrer">`,
  filling the host, `opacity: 0`, `transition: opacity 600ms`; class `ready` → `opacity: 1`.
- a dim under it (`background: rgba(0,0,0,.55)`) so the photo darkens while the room is still
  calculating; the proto's own loading word is inside the iframe and stays.
- the way back: the same pill as `leaveControl()` with `data-action="window-back"` and the word
  `t("room.window.back")`, left edge, vertical, above the iframe.

Layering: the host is above the photo, the look / flat hits and the window things, and **below** the
dialogue box, the HUD tiles, 道具 strip, ⚙ / status / items panels and the case panel, so those still
open over it. The iframe is created only when `outside` becomes non-null and removed when it becomes
null again (the room is recomputed on each look-out; that is fine for tonight).

## R4 — Driving the room from the game

A pure function `outsideCommand(state, session): RoomCommand` in a new
`src/world/room/outside.ts`:

```ts
{ target: "nt-room", day: state.day, time: hour, face: 3, spot: "win",
  lamp: session.lampOn ?? hour >= 18, ceil: false, rain: weatherOf(state.day) === "rain",
  outer: false, eaten: false, far: 0 }
```

`hour` = `hh + mm / 60` from `session.clock.time` ("HH:MM"), clamped to **[6, 24]**. `day` clamped
to [1, 18].

The room listens only once its script has run and posts `ready` after its third frame; **anything
posted before `ready` may be lost.** So: the `day` goes in the URL (`?embed=1&day=N`, so the first
frame is already the right day); the controller posts the command to `iframe.contentWindow` with
origin `"*"` (same origin; the proto checks only `target`) **first when the `ready` message arrives**
(`data.source === "nt-room" && data.type === "ready"` from that iframe's window — never on `load`),
and again whenever the command differs from the last one posted (compare `JSON.stringify`), checked
in the rerender path while `outside` is open and ready. On `ready` also add class `ready` (the
fade-in). Remove the message listener when the host is removed.

## R5 — What stops while looking out

- `somethingOpen()` in `stare.ts` also returns true when `session.outside !== null` (a stare at the
  photo window is not counted while the 3D window is up).
- `window-out` is in the same class of actions as `room-look` for work mode (`workBlocks`): never
  reachable there anyway, since work mode is `view === "desktop"`; add nothing, but keep the test.
- The headless replay driver (`script/tools/auto-day-shoot.mjs`, Claude's) never clicks the glass;
  nothing to change there.

## R6 — Tests

`tests/outside.test.ts`:

- the glass hit is on the 窗 facing on day 1 and day 18, with its title; not on 房间 / 床 / 门.
- `window-out` opens (host + iframe with the `?embed=1&day=N` src + the back pill with its word);
  the command is posted on `ready`, not before;
  `window-back` and Esc close; `window-out` while a dialogue line is queued does nothing.
- `outsideCommand`: 09:03 → time 9.05; 05:00 → 6; 18:30 → 18.5, lamp true by default; `lampOn: false` wins;
  day 4 → rain true, day 10 → rain false (`content/stages.json` weather table); day clamped.
- the stare countdown does not run while `outside` is set (through the stare module's exported
  behaviour, the way `tests/meters-v2-ui.test.ts` drives it).

Snapshots of the 窗 facing gain the glass hit; leave them failing and list the files — Claude refreshes
them after review.

## Out of scope tonight

The desk close-up (`spot: "desk"` from day 1), the day-10+ room faces (need a hotspot map per face),
the wake flash (`wake: true`, morning not chosen), reporting clicks from inside the iframe (mug,
lamp, switch), reduced-motion handling inside the room, and `low=1` selection by device.

## Rules

- Never `git` anything; Claude reviews and commits.
- Never edit `content/`, `script/`, `room3d/`, or the strings; `.kiro/specs/*` are read-only to you.
- `src` must never contain the word "veins" (a test guards it).
- `npx tsc --noEmit -p .` and `npx vitest run` must be green before you report, except the window
  snapshots named above.
- Report in English what you built and where you departed from this file.
