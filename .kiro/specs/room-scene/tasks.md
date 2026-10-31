# room-scene — tasks (motion segment)

- [x] 1. `pose.ts`: README poses, `poseFromLook` / `lookOf`, `lerpPose`, easing, `clampPose` with `WINDOW_CLAMP`, `CameraMove` + `poseAt` (path and clamp overridable).
- [x] 2. `look.ts`: `collapseMix(day)` (room .4, door 1), `splatLook(day, beat)` (night, gap colour, mix).
- [x] 3. `gate.ts` and `moves.ts`: kill switch, WebGL probe, reduced motion; the moves the splat renders.
- [x] 4. `layer.ts`: lazy load after the first render, ready gate, the move loop, re-placing across renders, cross-fade, night / vignette layers; CSS in room.css.
- [x] 5. `scene.ts` + `vendor.d.ts`: three + gaussian-splats-3d, clean and collapsed viewers, nudge frame, `render(pose, mix)`. Type-checked only; not run anywhere yet.
- [x] 6. Controller `splat` dep; `main.ts` passes `splatForGame(window)` for the game only (never the title). Fix: the motion layer's stage copies keep the centring offsets (polish P11).
- [x] 7. Tests (`tests/splat.test.ts`, 19 tests).
- [ ] 8. Check in a browser: load time, frame rate, f43 framing, FOV against the photos, the lamp's position, `vite build` chunking. (Not possible here.)
