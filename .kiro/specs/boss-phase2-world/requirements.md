# Requirements: boss-phase2-world — the fight's second phase in the red world

Author, 2026-11-17: the fight has **two phases**. 「炸开的那一下做成第二阶段进场，视角转化，巨兽的巨首
能否缓缓升起」 — the burst is the entrance of phase 2: the viewpoint changes to the code-built red
world and the giant head rises slowly. And: 「我想让它有种视角异位（不是直接切换，是由1用旋转或者某种
方式换到了2的地面和视角）」 — **not a cut**: the eye is dislocated from phase 1's ground to phase 2's
ground by a rotation / a motion. Earlier: 「目前2阶段像个小boss，没有神性」 — in phase 2 the boss does
not lunge or flinch; the world acts for it.

Read first: `src/world/endings/boss.ts` (the rules: `BossBattle.boss.stage` 1 | 2, the burst on the
first bar emptied, `.boss-page.final` = stage 2), `src/world/endings/flow.ts` (the fight in the
session: `startEnding` → pull-out → `bossStart`; `runBoss`; `boss-done`), `src/world/room/outside.ts`
(the room-frame host and its DOM layer; `room-3d-window` / `room-3d-desk` specs), `boss-fx.ts`
(IMPACT_DELAY by Fx; the hook reads the state's acts).

## What the room gives (built or being built by the other session; never edit `room3d/`)

Embedded page `/room3d/index.html?embed=1&day=18`, commands after `ready`:

- `{ boss: true }` — the room is gone; the eye at one fixed place over the red world, the head still
  DOWN below the horizon, the ring of nine tentacles sunk. Builds the far world on its first frame
  (a second or two) — so post `{ pause: true }` only **500 ms after** `{ boss: true }`, never at once.
  `{ boss: true, risen: true }` starts with the head already up (a reload mid-phase).
  `{ boss: false }` leaves the mode.
- `{ dislocate: true }` — **3000 ms**. The camera starts matching phase 1's framing (eye 1.3 m above
  a flat dark ground, level, the ground's edge a near-straight line at ~60 % of the frame height,
  black above) and ends in the boss pose (looking down on the round world, the horizon a curve at
  ~45 %). Easing smoothstep (≈ `cubic-bezier(.42,0,.58,1)`). **Roll 26° × sin(π·q)**: zero at both
  ends, peak at 1500 ms, the horizon's right end up / left end down (counter-clockwise), then level.
  The eye rises and tips down continuously over the 3 s. The ring of tentacles starts up at 1860 ms.
  At the end it posts `{ source: "nt-room", type: "dislocated" }`. The head stays down throughout.
  `{ boss: true }` alone sits at the end pose (no dislocation).
- `{ rise: true }` — the head rises from below the frame over **5.5 s**, dim, the eyes and the rest
  of its light coming in over the last ~14 %; at the top it posts `{ source: "nt-room", type:
  "risen" }` once and the ring comes up to its idle. A second `rise` does nothing. `strike` / `hurt`
  are ignored until it has risen.
- `{ strike: true }` — the tentacles rise fast and curl down onto the middle (down at ≈0.5 s), then
  sink back. `{ hurt: true }` — they drop back at once and the red light under the ground stutters.
- `{ pause: true | false }` as everywhere.

All of these are built. Keep every name and timing as constants in one place
(`src/world/endings/phase2.ts`), so a change on the room's side is one edit.

## R1 — The frame behind the fight

When the fight starts (`session.boss` set by the flow), create the room frame through
`outside.ts` as kind `boss` — **a persistent host outside `.boss-page`** (the page re-renders every
tick; the frame must not), behind it (z below the page), hidden (`display: none`) and, after
`ready`: post `{ boss: true }` then `{ pause: true }` (the world is built while phase 1 plays). Reuse
the shared room frame if one exists (`room3d:room`, paused on the desk); the fight owns it until
`boss-done`.

On `boss-done` (the ending pages begin): post `{ boss: false }`, `{ pause: true }`, hide the host.

## R2 — The burst: the dislocation, then the head

When `boss.stage` goes 1 → 2 (the burst; the log says 「它炸开了」):

1. show the host (`display: block`, opacity 0), post `{ pause: false }` then `{ dislocate: true }`;
2. the page gets `.final` from the rules (already) and, for 3000 ms, `.dislocating`: `.bs-field`
   turns with the same motion in CSS — `rotate(0)` → `rotate(-26deg)` at 50 % → `rotate(0)` at 100 %
   (CSS negative = counter-clockwise, as the room's horizon), easing `cubic-bezier(.42,0,.58,1)`, plus
   a `rotateX` growing toward the end and the party's drop onto its strip (R3), the party kept
   upright; the host's opacity 0 → 1 over the first 900 ms (the room's start pose is deliberately
   close to the 2D field: dark above, ground below). The numbers live in `phase2.ts` as CSS custom
   properties set on the page (`--dislocate-ms`, `--dislocate-roll`);
3. on `dislocated` (or a net at the dislocation's length + 500 ms): remove `.dislocating`, post
   `{ rise: true }`;
4. the fight's clock holds from the burst until `risen` (or a net of the dislocation + 5.5 s + 1 s):
   `bossTick` is not called,
   gauges do not fill, the box shows the burst line; then the clock runs (`clockAt` = now).

`Session.boss` gains nothing; the holds live in the session as `phase2: { stage: "dislocating" |
"rising" | "up"; since } | null` beside `boss` (model.ts), set by the flow.

## R3 — The page in phase 2

`.boss-page.final`: transparent background; `.bs-bg`, `.bs-boss`, `.bs-ground` and `.bs-giant`
hidden; the party (`.bs-party`) at scale ≈ 0.6 in the lower middle, standing on a dark HTML ground
strip (`.bs-strip`, new, under the party; the pixel sprites never stand on the 3D floor); the
plates, the gauge, the box, the menu, the buff cards and the boss bar (`hp2`) as they are. The
look of all of this is the other session's (.bs-* in room.css); Kiro adds the elements and the
classes, with plain placeholder rules.

## R4 — The world acts for the boss

- A boss act in stage 2 (`act.who === "boss"`, a new `act.at`): post `{ strike: true }` at the act's
  start; the page's `.bs-boss` act classes are not rendered (hidden anyway).
- A hit on the boss in stage 2 (an act whose `hits` include `boss` with `n > 0`): post
  `{ hurt: true }` at the act's impact (IMPACT_DELAY of the move's fx, as boss-fx does).
- Nothing else is posted per tick. Posts go through the DOM layer like the desk's (`roomPosts`).

## R5 — Fallbacks

- No `ready` within 8 s of the fight's start: phase 2 plays as today (the stage-2 picture, no
  frame); one `console.warn`.
- `prefers-reduced-motion`: the dislocation is a 600 ms cross-fade (no roll); the holds are the
  same.
- Dev: `&boss=survive&bosshp=0.02` leaves the first bar one hit from empty.

## R6 — Tests

`tests/boss-phase2.test.ts`: the host is created at the fight's start and hidden; `boss` + `pause`
posted after ready; the burst posts `pause:false` + `dislocate`, sets `.dislocating`, holds the
clock; `dislocated` → `rise`; `risen` → the clock runs; the nets; a boss act in stage 2 posts
`strike`, a hit on the boss posts `hurt`, nothing in stage 1; `boss-done` posts `boss:false` +
`pause` and hides; the no-ready fallback. Existing `tests/boss.test.ts` unchanged.

## Out of scope

The room's own animations and colours (the other session); the ending pages after the fight; any
change to the rules (damage, bars, buffs).

## Rules

- Never `git`; Claude reviews and commits. Never edit `content/`, `script/`, `room3d/`, or the
  strings; `.kiro/specs/*` read-only to you. `src` must never contain the word "veins".
- `npx tsc --noEmit -p .` and `npx vitest run` green before you report. Report in English what you
  built and where you departed from this file.
