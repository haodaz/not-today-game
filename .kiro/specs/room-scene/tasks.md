# room-scene — tasks (motion segment)

- [x] 1. `pose.ts`: README poses, `poseFromLook` / `lookOf`, `lerpPose`, easing, `clampPose` with `WINDOW_CLAMP`, `CameraMove` + `poseAt` (path and clamp overridable).
- [x] 2. `look.ts`: `collapseMix(day)` (room .4, door 1), `splatLook(day, beat)` (night, gap colour, mix).
- [x] 3. `gate.ts` and `moves.ts`: kill switch, WebGL probe, reduced motion; the moves the splat renders.
- [x] 4. `layer.ts`: lazy load after the first render, ready gate, the move loop, re-placing across renders, cross-fade, night / vignette layers; CSS in room.css.
- [x] 5. `scene.ts` + `vendor.d.ts`: three + gaussian-splats-3d, clean and collapsed viewers, nudge frame, `render(pose, mix)`. Type-checked only; not run anywhere yet.
- [x] 6. Controller `splat` dep; `main.ts` passes `splatForGame(window)` for the game only (never the title). Fix: the motion layer's stage copies keep the centring offsets (polish P11).
- [x] 7. Tests (`tests/splat.test.ts`, 19 tests).
- [ ] 8. Check in a browser: load time, frame rate, f43 framing, FOV against the photos, the lamp's position, `vite build` chunking. (Not possible here.)

## Correction 2026-11-01: fit the splat to the stage

- [x] 9. The layer is the stage rectangle from fit.ts (`splatBox`), clipped. The library lives in a `host` (its `rootElement`) inside it.
- [x] 10. 900 ms moves: `CHOSEN.roomDesk`, `viewMoveMs`, shared by the CSS push and the splat. motion-dom waits and the timeout updated.
- [x] 11. `calibration.ts` (pos / look / fov per framing). 桌子 = the close-desk pose. Optional fov on poses.
- [x] 12. `?splatcal=1` (dev only): still pose, photo at 50 %, tuning keys, readout, P prints the table (`calibrate.ts`, pure helpers).
- [ ] 13. Run the calibration in a browser against desk_close.jpg and room.jpg and paste the table. Measure load time and frame rate. (Not possible here.)

## Calibration and the day-18 pull-out

- [x] 14. Paste Claude's calibration (room fov 48.5, desk pose and fov 40). Tests read the table instead of repeating it.
- [x] 15. `splat/pullout.ts`: the pure timeline (camera, island, dark), the cuts, `pullMove` (clamp: null).
- [x] 16. Flow: `session.pullOut`, its cut timer, pages waiting, no skip. `renderPullOut` and the dark sprites. `createPullDriver`.
- [x] 17. Splat layer: the scripted pull, `#app.splat-pull`. Black letterbox.
- [x] 18. Tests (`tests/pullout.test.ts`); `tests/endings.test.ts` runs the cut before the pages.
- [ ] 19. Browser check: the splat island against the mask; how the 2 s good cut feels; the door opening (later segment).
- [x] 20. Answers: the pull-out only after the bedtime branch (a shutdown bad skips it); gaze on the desk pose's look target; good's 2 s cut kept. `lerpPose` bounded to its endpoints.
