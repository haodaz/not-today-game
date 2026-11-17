# Requirements: room-light-switch — the wall switch and the ceiling light, in the photo room too

Author, 2026-11-16: 「开关吸顶灯第10天之前也要有。我们有不同光线的房间照片对吧，其实白天就是稍微亮一点，晚上有光
效」. The wall switch by the door is in the photos (门 and 窗 facings); clicking it turns the ceiling
light on and off. **By day the room gets slightly brighter. By night it is a light effect** on top
of what the evening look does today (the dark layer and the lamp's warm glow). The code-built room
already has `ceil`; the game's state drives it.

Small job. Read how the lamp works first: `lamp` action and `Session.lampOn` (`src/world/room/game.ts`,
`src/world/desktop/model.ts`), `lampLit` (`src/world/objects/works.ts`), `eveningLook` and
`.evening-look` / `.evening-lamp` (`src/world/room/hud.ts`, `src/world/room/room.css`).

## R1 — State

`Session.ceilOn: boolean` (initial `false`; session only, like `lampOn`; no event). A pure
`ceilLit(session) = session.ceilOn`. Day and night the player decides; nothing turns it on by itself.

## R2 — The switch is a hit

On the 门 and 窗 facings a `look-hit switch` button, `data-action="switch"`, `title` / `aria-label`
`t("room.switch")` (开关 / Light switch; strings exist):

- 门: `fracRect(DOOR_WALL, 0.695, 0.745, 0.355, 0.425)` (the plate right of the door frame, measured
  on door_wall.png).
- 窗: `fracRect(WINDOW_WALL, 0.135, 0.175, 0.39, 0.45)` (the same plate, seen from the window side).

Action `switch`: `ctx.play?.("lamp-click")` (reuse the lamp's click), `session.ceilOn = !session.ceilOn`,
rerender. Allowed any time the view is a facing and nothing is open (the same guard as `lamp`); not a
guided target; refused during guidance like `room-look`.

## R3 — The light, on the stills

`eveningLook(view, evening, lampLit, ceilLit)`:

- **Night, ceiling on**: the dark layer lifts from `EVENING_DARK` (0.6) to **0.25**, and a cold, even
  wash from above: an `<i class="evening-ceil">` filling the stage, `background: linear-gradient(
  rgba(214,224,236,.22), rgba(214,224,236,.06) 60%, transparent)`, `mix-blend-mode: screen`. The
  lamp's warm glow stays as it is when the lamp is lit. The window light (`windowLight`) unchanged.
- **Day, ceiling on**: no dark layer today; the room is slightly brighter: the stage gets class
  `ceil-day` → `filter: brightness(1.06)` on the backdrop (the photo) only, not on the HUD. Subtle:
  the author's word is 「稍微亮一点」.
- **Off**: exactly today's look.
- `lying` (the ceiling): at night with the ceiling on, over `ceiling_night.jpg` a soft disc of light
  at the lamp (`<i class="ceil-disc">`, centred at 50 % / 42 % of the stage, 360 px, radial white
  0.35 → 0); by day with it on, the same `brightness(1.06)`. The photo files are unchanged.
- The evening look applies to all four facings (room-turn R4); so does this. The desktop (屏幕)
  view and the 3D views do not use the stills' look.

## R4 — The code-built room follows

Wherever the game posts a room command (`outsideCommand` in `room-3d-window`; the desk command in
`room-3d-desk`; the wake flash posts nothing), `ceil` = `session.ceilOn` instead of `false`. A
`switch` pick from the 3D desk (`room-3d-desk` parity table: `switch` was ignored) maps to the
`switch` action, then the command is re-posted (it changed).

## R5 — Tests

`tests/light-switch.test.ts`:
- the switch hit on 门 and 窗 with its title; not on 房间 / 床.
- `switch` toggles `ceilOn` and plays the click; refused while a dialogue line is queued.
- `eveningLook`: night + ceiling on → `--evening-dark: 0.25` and `.evening-ceil`; night off → 0.6 and
  no wash; day on → `ceil-day`; the lamp glow unaffected either way.
- `lying` at night with the ceiling on renders `.ceil-disc`.
- `outsideCommand` carries `ceil` from `ceilOn`.

Snapshots of 门 and 窗 gain the switch hit; leave them failing and list them — Claude refreshes
after review.

## Out of scope

Any day-by-day failure of the light (a bulb that will not come on, flicker; the author decides
whether the collapse touches it); the SAN meters; the diary.

## Rules

- Never `git` anything; Claude reviews and commits.
- Never edit `content/`, `script/`, `room3d/`, or the strings; `.kiro/specs/*` are read-only to you.
- `src` must never contain the word "veins" (a test guards it).
- `npx tsc --noEmit -p .` and `npx vitest run` green before you report, except the two snapshots.
- Report in English what you built and where you departed from this file.
