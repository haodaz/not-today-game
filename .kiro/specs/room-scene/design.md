# room-scene — design (motion segment, 2026-11-01)

Scope: the three 2026-11-01 sections at the end of requirements.md. Stills stay photos. The splat
renders only camera moves (房间 ↔ 桌子, later 床), with the night and collapse layers on top. FR3
objects, FR4 ring geometry and the day-18 pull-out are later segments. This one only leaves the
camera path and the clamp open to a scripted move.

## 1. Modules (`src/world/room/splat/`)

| file | what | DOM / three |
|---|---|---|
| `pose.ts` | poses, interpolation, the window clamp, `CameraMove` / `poseAt` | pure |
| `look.ts` | `collapseMix(day)`, `splatLook(day, beat)` (night, gap light, mix) | pure |
| `gate.ts` | `splatEnabled({ search, webgl, reducedMotion })`, `hasWebGL(doc)` | pure / probe |
| `moves.ts` | `splatMoveFor(from, to)`: which view changes the splat renders | pure |
| `layer.ts` | the DOM layer: lazy load, the move's frame loop, the cross-fade, re-placing across renders | DOM, no three |
| `scene.ts` | the only file that imports three and gaussian-splats-3d: two viewers (clean, collapsed), `render(pose, mix)` | browser only |
| `vendor.d.ts` | ambient types for the slice of three / gaussian-splats-3d that `scene.ts` uses | types |

`layer.ts` reaches `scene.ts` only through an injected `load()`. In the game that is
`() => import("./scene")`, so Vite splits three and the splat library into their own chunk. That
chunk is fetched after the first render and never by the title page, which doesn't mount the layer.

## 2. Decisions (please review)

- **S1. Poses.** These come from public/room/README.md, in world coordinates, with up (0,−1,0).
  - 房间 = f080: pos (−3.127, −0.071, −0.872), look (0.615, −0.118, 22.497).
  - 桌子 = f43: pos (0.023, 0.053, 0.324), look (−2.706, −0.439, 24.833).
  - 床 = f159: pos (−6.312, 0.068, 4.090), look (9.106, 0.167, 12.600).
  - **Flag:** the README lists f43 under 门墙, the door-wall section, whose model is in door.splat's
    own coordinates. The spec names f43 for 桌子, so `POSES.desk` uses it. If it frames wrongly in
    room_clean.splat, the README's 凑近桌面 pose, pos (−1.0, 0, 6.0) look (0.6, −0.1, 22.5), is
    one constant away (`DESK_CLOSE_ALT`).
- **S2. A pose is { pos, yaw, pitch }.** Yaw is atan2(dx, dz) of the look direction and pitch is
  asin(dy) of it. Interpolation lerps pos and takes the short arc for yaw and pitch, under one
  easing (`easeInOutCubic`). Lerping the two look points directly would swing the view, because
  their distances differ (23 vs 24 units).
- **S3. The window clamp.**
  - Window side = negative yaw: f001 −53° and the 窗墙 pose −50°, both framing the window.
  - The allowed poses span yaw −6.4° (f43) … +61° (f159), and pos.x ≤ 0.023.
  - `WINDOW_CLAMP = { yawMin: min yaw of the allowed poses, xMax: max x of the allowed poses }`.
    These bounds come from the poses themselves, so an interpolated pose can never leave them,
    and a jittered or scripted pose is pulled back.
  - `clampPose(p, bounds)` is pure.
  - A `CameraMove` carries its own `path(t) → Pose` (default: eased interpolation from → to) and
    `clamp: Clamp | null` (default `clampPose` with `WINDOW_CLAMP`; `null` = bypass). The day-18
    pull-out will be a scripted `CameraMove` with `clamp: null`.
- **S4. Timing.**
  - A splat move lasts `MOTION.view` (400 ms), the same as the CSS push. The motion layer keeps the
    arriving stage transparent (`m-nobg`) for exactly that time.
  - The arriving photo, inside the splat layer, fades in over the last 200 ms (`SPLAT_FADE_MS`).
  - When the move ends, the stage's own identical photo comes back underneath and the layer is
    removed, with no cut.
  - **Flag:** 400 ms with a 200 ms fade leaves 200 ms of pure splat. A longer splat move needs the
    motion layer to take the splat's duration. I left that out so the CSS fallback is unchanged.
- **S5. Where the layer sits.** It is inserted in `#app` just before the live stage:
  - above the motion layer's backdrop copy (the CSS push, still playing underneath);
  - below the stage, whose HUD stays on top and whose photo is hidden during the move.

  It has the stage's own `--stage-x / --stage-y / --scale`, so it fills exactly the stage rect. The
  letterbox stays the blurred photo.
- **S6. The fallback.** A move uses the splat only if the scene is `ready` when the move starts.
  Ready means loaded and one nudged frame drawn, so the worker-sort black first frame happens
  off-screen (FR1). Otherwise nothing is inserted and the CSS push plays as today. A load that
  finishes mid-move waits for the next move. A load error turns the layer off for the session.
- **S7. Off.** The layer is off with `?splat=0`, without WebGL (`webgl2` or `webgl` context), or
  under `prefers-reduced-motion: reduce`. Off means the controller gets no `splat` dep: no
  element, no class, no import. Tests mount without it, and happy-dom has no WebGL, so `gate.ts`
  says off there too.
- **S8. Night.** At night (beat `night`) the layer adds three DOM layers over the canvases:
  - `.splat-night`: a dark wash (.55, as the room's raid dim);
  - `.splat-lamp`: a warm radial glow, provisional at the desk lamp's corner (top right of the desk);
  - `.splat-gap`: the gap light, white before ring `wall` and pink from it (night-hand's colour).
    Its x moves with the move, between `ROOM_SHOT.gap` and `DESK_SHOT.gap`, eased like the pose.
- **S9. Collapse.**
  - `collapseMix(day)`: ring `room` → 0.4, `door` → 1, otherwise 0. Rings come from stages.json
    via `ringOf`.
  - From mix > 0, `scene.ts` loads `room_collapsed.splat` too, as a second viewer on a second
    canvas over the clean one, with CSS opacity = mix. Two canvases cross-fade correctly because
    each is opaque over black.
  - It applies to every splat move from day 13, night or day, with the night layers over both.
- **S10. Vignette.** `.splat-vignette`: a radial gradient to rgba(0,0,0,.35) at the edges, only
  while the layer is in.
- **S11. Types.** No `@types/three` (one install only). `vendor.d.ts` declares the few classes
  and members `scene.ts` calls, nothing more. `scene.ts` is not run in tests, so the adapter is
  checked only by tsc against those declarations.

## 2b. Correction 2026-11-01: fit the splat to the stage (after the first browser run)

- **S12. The stage rectangle.** `splatBox(winW, winH)` = `fitStage(…, 1600, 900)` (fit.ts). The
  layer is placed at its `left / top`, 1600×900 CSS px, `scale(fit.scale)`. It has
  `overflow:hidden; clip-path:inset(0); contain:paint`, so nothing reaches the letterbox.
  - Likely cause of the full-window canvas: the library resizes or reparents what it owns.
  - `scene.ts` therefore creates a `host` element that holds both canvases and is both viewers'
    `rootElement`. The layer mounts the host inside the clipped box, and puts it back if the
    library moves it.
  - The canvases are forced to 100 % of the host (`!important`). `renderer.setSize(…, false)`
    never sets a CSS size.
- **S13. 900 ms.**
  - `CHOSEN.roomDesk = 900`, and `viewMoveMs(from, to, camera)` is the one source for the
    duration. The motion layer's CSS push for 房间 ↔ 桌子 and the splat move both use it.
  - The other camera moves keep `MOTION.view` (400 ms); the door keeps `doorView`.
  - Ease-in-out over the whole way; the arriving photo fades in over the last 200 ms.
  - This supersedes S4's 400 ms.
- **S14. Poses and FOV in one table.** `calibration.ts` holds each framing's `{ pos, look, fov }`;
  `pose.ts` builds `POSES` from it. A pose carries an optional `fov` (vertical, degrees), which is
  interpolated along a move, and `scene.ts` applies it.
  - 桌子 is now the README's close-desk pose, pos (−1.0, 0, 6.0) look (0.6, −0.1, 22.5),
    measured on room.splat (supersedes S1's f43).
  - The clamp bounds follow, since they come from the poses: yaw ≥ 5.54° (the desk pose), x ≤ −1.0.
  - **Calibration (`?splatcal=1`, dev builds only):**
    - once the splat is ready, the layer stays in at the current framing's pose, still;
    - the stage's photo is hidden and the layer's photo sits at 50 % over the splat;
    - keys tune the pose: ← → yaw, ↑ ↓ pitch, W A S D R F move, [ ] FOV, Shift ×10;
    - a readout shows the row, and P prints the whole table in calibration.ts's shape;
    - moves in this mode use the tuned poses.
  - **Status: not yet calibrated.** I can't run a browser here, so the FOV is still the
    provisional 50° and the poses are the README's. The tool exists so the calibration run can be
    pasted back.

## 2c. Addition 2026-11-01: the day-18 pull-out

Calibrated framings (Claude, `?splatcal=1`): room fov 48.5, desk pos (−0.345, 0, 11.562) look
(2.013, −0.145, 35.446) fov 40. Bed unchanged.

- **S15. One timeline.** `splat/pullout.ts` is pure: `pullOutAt(elapsed, from) → { p, camera,
  island, dark }`.
  - Camera: position from the framing to `PULL_END` (67, −29, −1), ease-in cubic over 6 s. The
    gaze turns from the framing's look onto `ROOM_CENTRE`, the mean of the three framings'
    positions, by about 3.8 s.
  - Island: start distance / current distance to `ROOM_CENTRE` (perspective). It is 1 at the
    start and about 0.08–0.10 at 6 s.
  - Dark: 0 until 3 s, then linear to 1 at 6 s.
  - The CameraMove is scripted, with `path` and `clamp: null`. The player's moves still clamp.
- **S16. The cut, in the flow.** `startEnding` on the last day sets `session.pullOut =
  { ending, from, startMs, cutMs }` and schedules the cut: good 2 s, bad and survive 6 s.
  - At the cut, `pullOut` goes back to null and the first page opens as before (bad: 你和你,
    otherwise the credits).
  - While it plays, `renderEnding` renders the pull-out page and `endingNext` does nothing, so
    the pull-out can't be skipped.
  - The `ending` event is still appended synchronously at lie-down; only the pages wait.
  - From 屏幕 the view becomes 桌子, so the stage is the room's size.
- **S17. Two renderings, one dark.**
  - The pull-out page holds the photo island and the dark layer:
    - the island is the framing's photo, scaled by `--island` around the centre, over black;
    - the dark layer is dark_tile.png tiled, 22 eyes (eye_1..3) and 8 tentacles, at opacity
      `--dark`.
  - Sprites are seeded and pure (`darkSprites`): radius ≥ 0.42 of the stage ellipse, √-biased
    toward the edges, bigger at the edges. The eyes blink out of sync (period and phase per
    sprite); the tentacles drift slowly.
  - The dark layer's mask is clear inside an ellipse √2 × the island's half size (it
    circumscribes the island rectangle), fading out over 22 %, so it never covers the room.
  - `createPullDriver` (a controller dep) writes `--island` and `--dark` every frame from the same
    timeline; the render writes them too.
  - With the splat ready at the start, the layer runs the scripted move under the page with the
    night wash, and `#app.splat-pull` hides the photo island. Otherwise the photo island plays.
  - A pull-out already under way never switches to the splat.
  - The letterbox is black during the pull-out (`applyFit(…, null)`).
- **S18. Open.**
  - Good's "the door opens instead": no door animation exists yet. Good cuts at 2 s to its
    usual credits → day 19.
  - The splat's apparent room size follows the projection, not the perspective `island`
    estimate, so the mask may differ slightly from what the splat shows. Check in a browser.

## 3. Flow

1. First render of the game: `layer.after()` schedules `load()` at idle, or after 1 s.
2. `load()`: dynamic import → `createSplatScene()` → clean viewer `addSplatScene` → nudge, render
   → `ready`. The collapsed viewer loads when a move first needs mix > 0.
3. Every render: `after()` compares the view with the last one. If `splatMoveFor(from, to)` names
   a move and the scene is ready, it starts `{ start, dur, move, look }`.
4. While a move runs, every `after()` re-inserts the layer element before the live stage (the
   controller replaced `innerHTML`), with fresh offsets. A rAF loop calls
   `scene.render(poseAt(move, eased t), mix)` and updates the gap's x and the photo's opacity.
5. At `start + dur` the layer element is removed, and the loop stops.

## 4. Tests (`tests/splat.test.ts`)

- Pure:
  - the poses from the README;
  - `lerpPose` endpoints, midpoint and short-arc yaw; easing endpoints and monotonicity;
  - `clampPose` is idempotent, never yields a yaw below `yawMin` or an x above `xMax`, and leaves
    the three poses unchanged;
  - property: every interpolated pose between allowed poses is inside the clamp;
  - a scripted move with `clamp: null` keeps its out-of-bounds pose; the default clamp pulls it in.
- `collapseMix` by ring for all 18 days (0 before day 13, .4 on room days, 1 on door days);
  `splatLook` night / gap colour.
- Kill switch: `?splat=0`, no WebGL and reduced motion → off; otherwise on.
  `hasWebGL(document)` in happy-dom is false.
- Fallback, with a fake scene:
  - a move before ready inserts nothing, and the DOM is identical to a mount without the layer;
  - after ready, a 房间 → 桌子 move inserts one `.splat-layer` before the stage, with the vignette
    and the arriving photo;
  - it survives a re-render mid-move and is gone after the move;
  - the door and 屏幕 moves never use it;
  - a load error leaves it off.
- No splat work in happy-dom: the game mount (`renderGame`, motion on) never calls `load` and
  never imports `scene.ts`. `gate` is off there, so `main.ts` passes nothing.
