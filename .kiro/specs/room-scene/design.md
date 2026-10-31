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
