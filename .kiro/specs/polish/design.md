# polish — design

## 1. Approach

The controller replaces `root.innerHTML` on every change. Any CSS transition on an old node dies
with it, and any `@keyframes` on a new node replays on every render. Motion therefore lives in
one DOM-side module that runs around each render:

- `before()`, just before `innerHTML`, keeps references to the outgoing nodes that may need to
  leave gracefully (stage, monitor, tab, held layer, dialogue, choices, checklist lines).
- `after()`, after `fit()`, compares what is on screen now with the last render (by keys
  derived from the session and state, never from new markup attributes), and then:
  - starts an entry for what appeared (start time remembered per key);
  - re-applies any entry still under way with a negative `animation-delay`, so it continues
    instead of restarting;
  - turns what left into a **ghost**: the old node, re-inserted at its old place,
    `pointer-events:none`, `aria-hidden`, playing its exit. It is re-inserted after every render
    until it ends, then removed.

Pure parts (timings, the reveal clock, stagger delays, door step list) live in
`src/world/motion/timing.ts` and `reveal.ts` and are unit-tested in node. The DOM part
(`src/world/motion/dom.ts`) is small and has no game logic.

## 2. Decisions (please review)

- **P1. One source for timings.** `timing.ts` holds every motion.md value. `applyMotionVars`
  writes them as CSS variables (`--m-dim: 200ms`, …) on `:root`. `motion.css` uses only those
  variables; a test fails if it contains a literal duration.
- **P2. Values motion.md doesn't give** (in `CHOSEN`, separate from `MOTION`):
  - strike-through 160ms;
  - door step text 240ms (same as a new checklist item);
  - door image crossfade 400ms;
  - the room ↔ door switch crossfades in 400ms (the camera's duration);
  - Kuro's new line 240ms;
  - morning fade-from-white 800ms (same as going black);
  - the lie-down rise 24px;
  - the chosen choice holds 160ms before it fades.
- **P3. Exit durations.**
  - Exits are 0.7× their entry unless motion.md names them: put-down is 220ms, and room ↔
    desktop is "reversed", so 400ms both ways.
  - The dialogue box and the losing choices leave in 112ms.
  - A folded checklist item leaves in 168ms.
  - The monitor push is a single 240ms move.
- **P4. Reveal state is session.** `session.reveal = {key, startMs, total, perChar, leadMs,
  doneAt, hold}`. The key is `queue[0].key:line`. It is set by `after()` when the key changes.
  `loop-advance` (clicks and keys) first completes an unfinished reveal, and ignores clicks
  during the 1.5s hold; after the hold, the motion module advances by itself. With no
  `session.reveal` (tests, no DOM), `loop-advance` behaves as before.
  - Wall time comes in only through `ActionContext.now` (default `Date.now`) and the motion
    module's clock. It's cosmetic: no state reads it.
- **P5. Held items are session.** `session.holding: ObjectId | null` sits next to the existing
  `phoneOpen`, and the two are exclusive. New actions are `loop-hold` (an object slot) and
  `loop-put-down` (the dim layer, a full-stage button labelled for screen readers); Esc also
  puts down. While an item is held, or flying back, its slot gets the class `lifted` (contents
  hidden).
  - The rise path is computed after render: the vector from the centre to the slot, and the
    slot / item size ratio, written as `--fx --fy --fs` on the held element. The ghost keeps
    them for the way back.
- **P6. Device screens.** `src/world/room/held.ts` has a provisional channel table: chick 32×16
  (from the voices rules); the others 32×16 until their device specs. It also has where the
  screen sits on each shell (chick measured from the mock; others centred).
  - The canvas is blank: frames are content and the device specs draw them. Integer scale is
    `floor(target / w)`.
- **P7. Door.**
  - `doorContent` renders the step list (content captions, `.on` on the current one), a
    full-stage `door-hit` button behind the HUD, the chain image layer for `chainOpen` /
    `holding`, and the shadow while `holding`. `door-next` is gone.
  - Sounds `chain` (open to the chain) and `lock` (close) play in `loop-door`.
  - **W1 fix:** after `place`, `doorMeal` also returns the meal whose `session.door` is
    `onDesk` today, so step six shows. Leaving the door view forgets a finished door beat.
- **P8. Room ↔ desktop geometry.** The monitor in the room shot is taken to be centred at
  (800, 330) and 420px wide (room px). These are constants in `timing.ts` until the room scene
  exists.
- **P9. Snapshot changes.** Everything is class-only, with one exception: an object slot on the
  desk bar was a `<div>` and must be clickable and keyboard-reachable, so it becomes
  `<button type="button" class="slot" data-object="…" data-action="loop-hold">`. The
  upgrades desk-bar snapshot changes for this. Everything else in the snapshots is unchanged.
- **P10. Phase-locked loops.** Infinite animations (Kuro's bob, the night glow) get
  `animation-delay: -(now mod period)`, so a re-render never restarts them.

- **P11. The stage fills the window (correction 2026-11-01).**
  - `src/world/fit.ts`, used by the game controller and the title mount, on every render and on
    resize. `fitStage(winW, winH, w, h)` is pure: scale = min(winW/w, winH/h, 2), offsets centre
    the stage both ways.
  - The stage is 1600×900 for every view except 屏幕, which uses its monitor's own stage size.
  - An empty window (no layout, tests) gives scale 1 at 0,0.
  - `applyFit` writes `--scale`, `--stage-x` and `--stage-y` on the stage, so the motion layer's
    copies keep their place. It writes `--letterbox` on `#app`, which survives re-renders.
  - CSS: `#app > .stage` is absolute at the offsets. `#app::before` draws the letterbox: the view's
    photo, cover, `blur(24px) brightness(.45)`, with a 60 px bleed so the blur has no pale edge.
  - The photo per view (`BACKDROPS`):
    - title and 房间: room.jpg;
    - 桌子 and 屏幕: desk_close.jpg, because the screens sit on the desk;
    - 门: door_wall.png.
  - The ending pages use the photo of the view they were reached from.
  - Camera-move offsets are in stage px with `transform-origin: 0 0`, so they are unchanged by
    the offset.

## 3. Modules

```
src/world/motion/timing.ts   MOTION, CHOSEN, exitOf, applyMotionVars, choiceDelays, room geometry
src/world/motion/reveal.ts   Reveal, startReveal, revealShown, revealDoneAt, revealBusy, holdUntil
src/world/motion/dom.ts      createMotion(root, ctx, hooks) → { before, after, destroy }
src/world/motion/motion.css  keyframes and rules; durations only via var(--m-*)
src/world/room/held.ts       heldLayer (phone / object), CHANNELS, SCREEN_AT
src/world/room/hud.ts        desk bar buttons + lifted; door content (steps, hit, layers)
src/world/room/game.ts       loop-hold, loop-put-down, reveal gating, door sounds, Esc
src/world/desktop/controller.ts  deps.motion hook, ctx.now
```

## 4. Tests

- Timing: every motion.md number, the easing, the 0.7 exit rule, and no literal durations in
  `motion.css`.
- Reveal: monotonic, length-bounded, inner 1.5×, the 400ms sound lead only with a sound id;
  completing jumps to the end; the hold.
- `loop-advance` with a reveal: the first click completes, the second advances; clicks during
  the hold do nothing.
- Choices stagger bottom-up.
- Door: five clicks walk the six steps one at a time, one lit at a time; step six shows after
  pickup; `chain` and `lock` sounds.
- Held: hold and put down, exclusive with the phone; the canvas is at the channel size with an
  integer CSS scale; an upgraded object's screen is `hi`; Esc puts down.
- Checklist: removing `origin` from every item of every day renders identical markup.
