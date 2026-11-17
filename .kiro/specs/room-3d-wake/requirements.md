# Requirements: room-3d-wake — the wake flash on day 4's morning

Author, 2026-11-16: an earlier morning flashes the code-built, half-collapsed room for a few seconds
when the player gets up; 「我这是还没睡醒吗」; one look round; gone. She chose **day 4** (「第4天可以」:
the first morning after things go wrong — the extra rice, the haunted tune board, the night-3
dream), and 「还没睡醒那句是立绘对话框说的」: **the line is said in the portrait dialogue box as the
player's own line, never as a caption on the picture.** Not shown again before day 10.

Build this after `room-3d-window` (same host pattern, same page). Read that spec first.

## What already exists (do not build again, do not edit)

- `room3d/index.html?embed=1`, the message protocol and the `.outside-host` / iframe pattern from
  `room-3d-window`. **Never edit anything under `room3d/`.**
- Posting `{ target: "nt-room", wake: true }` to the embedded room makes it play the flash by
  itself: it sets its own light (8:00, collapse 0.33, no tentacles / pixels / outside thing), snaps
  to the desk wall, posts `{ source: "nt-room", type: "wake-line" }` **at once**, looks round once
  (four quarter turns of about a second each; the walls drain clean during the third), and posts
  `{ source: "nt-room", type: "wake-done" }` about six seconds in, when the room is clean.
  (The room also posts `type: "ready"` after its first frames, as for the look-out.)
- Getting up is `getUp()` in `src/world/room/game.ts`: from `lying` it goes to 床, then queues the
  day's `rise` beat once (`session.riseBeatDay`).
- The player's own line in the dialogue box is a `speaker` line with `who: "me"` (lying-view R1;
  example `boxPlacedQueued` in `src/world/loop/runtime.ts`).
- String (Claude, both languages): `wake.flash` 「我这是还没睡醒吗。」 / "Am I not awake yet?".
- The event log's generic `step` event: `{ kind: "step", day, name, t }`.

## R1 — When

On **day 4 only**, the first time the player gets up (`getUp` from `lying`), and only if the run
has no `step` event named `wake:flash` on day 4 yet. Record that step (`t` = the clock's time) the
moment the flash opens, so a reload during or after it never shows it again. Every other day:
`getUp` unchanged.

Exported as a pure `wakeFlashDue(state, events): boolean` in a new `src/world/room/wake.ts`
(`day === 4 && !events.some(step wake:flash on day 4)`), so the day can move with one constant
(`WAKE_FLASH_DAY = 4`).

## R2 — The flash

`Session.wakeFlash: { readonly since: number; readonly phase: "loading" | "up" | "fading" } | null`
(initial `null`). When due, `getUp`:

1. goes to 床 as today (the view behind the flash is the bed wall; it does not matter, the iframe
   covers the stage);
2. does **not** queue the `rise` beat yet (leave `riseBeatDay` unset);
3. appends the `wake:flash` step, sets `wakeFlash = { since: now, phase: "loading" }`, rerenders.

Host: the same `.outside-host` markup as the look-out (`src/world/room/outside.ts` / `hud.ts`),
class `wake`, **no back pill** (nothing to click; the dialogue box is the only thing over it), the
iframe `src="/room3d/index.html?embed=1"`. On the iframe's `load` post `{ target: "nt-room", day: 4,
time: 8, face: 0, spot: null, lamp: false, ceil: false, rain: false, outer: false, eaten: false,
far: 0 }` and then `{ target: "nt-room", wake: true }` (two posts, in that order). On `ready` the
iframe gets class `ready` (fade-in 600 ms, as the look-out) and `phase` becomes `"up"`.

Messages from that iframe's window:

- `wake-line` → queue the player's line: `push(session.dialogue, { key: "d4:wake", lines:
  [{ k: "speaker", who: "me", t: t("wake.flash") }], ending: { kind: "none" } })`. The box opens over
  the 3D picture (the host is below the dialogue box, see room-3d-window R3). The line is read with
  a click as any line; the flash does not wait for it.
- `wake-done` → `phase = "fading"`: the iframe fades **out** over 600 ms (class `gone`), then the
  host is removed (`wakeFlash = null`) and the `rise` beat is queued exactly as `getUp` does today
  (`riseBeatDay`, `beatQueued(day, "rise", seq)`, `settleSession`). If the player has not yet
  clicked the wake line away, the rise lines simply follow it in the queue.

## R3 — Safety nets

- If `ready` has not arrived **8 s** after `since`, or `wake-done` has not arrived **15 s** after
  `since`: end the flash as if `wake-done` had come (fade, remove, rise beat). A slow machine never
  strands the player on day 4.
- While `wakeFlash !== null`: the stare countdown does not run (`somethingOpen`), turning / wheel /
  Esc / the back control do nothing to the view (the host covers the stage; keyboard turns are
  ignored), HUD tiles and panels still work above it. `window-out` is not reachable (view is 床).
- The headless replay driver (`script/tools/auto-day-shoot.mjs`, Claude's) gets up through the
  dialogue's 起床 choice; with no real iframe messages in headless Chrome the 15 s net ends the
  flash. Claude accepts the delay; nothing to change in the driver.

## R4 — Tests

`tests/wake-flash.test.ts`:

- `wakeFlashDue`: day 4 with no step → true; day 4 with the step → false; days 3 and 5 → false.
- `getUp` on day 4: view 床, the `wake:flash` step appended, `wakeFlash.phase === "loading"`, no
  rise lines queued yet, the host with the iframe in the render; the second `getUp` of the run (a
  reload: fresh session, same events) queues the rise beat at once and no host.
- the message handling as pure functions (`onRoomMessage(session, msg, now)` or equivalent):
  `ready` → `up`; `wake-line` → the player's line queued with `who: "me"` and `t("wake.flash")`;
  `wake-done` → `fading` and the rise beat queued; the 8 s / 15 s nets.
- `getUp` on day 3 and day 5: unchanged (rise beat queued at once, no host).

Snapshots: none expected to change (day 4's getting-up has no snapshot); if one does, leave it
failing and list it.

## Out of scope

The desk close-up and the day-10+ room faces (later specs); any second flash; the picture's content
(the room decides what it shows for `wake`).

## Rules

- Never `git` anything; Claude reviews and commits.
- Never edit `content/`, `script/`, `room3d/`, or the strings; `.kiro/specs/*` are read-only to you.
- `src` must never contain the word "veins" (a test guards it).
- `npx tsc --noEmit -p .` and `npx vitest run` must be green before you report.
- Report in English what you built and where you departed from this file.
