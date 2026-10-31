# room-scene — requirements

The room is the backdrop for the five beats and the stage for rings desk/wall/room/door. Assets: `public/room/room.splat` (Gaussian splat of the rented room; camera poses in `public/room/README.md`), `public/room/door_wall.png` + `door_chain_night.png` (door wall reference), `public/objects/*_shape.glb` + `objects.json` + cutouts, `public/kuro/*` (Kuro sprites are DOM, not 3D).

## FR1. Rendering
- three.js scene with `@mkkellogg/gaussian-splats-3d` for the room. One scene, several named cameras (from README): `room` (f080), `desk` (close), `window` (f001), `bed` (f159), `door` (a new pose facing the door wall; until the door is in the splat, the door wall is a textured plane placed opposite the window using `door_wall.png`).
- The first frame can be black until the sort worker wakes: nudge the camera once after load (README notes this).
- The two monitors are DOM (desktop-ui) composited over the 3D view at screen-space positions derived from two anchor points in the scene (`screens.json`: left/right monitor rectangles in 3D; project to screen each frame). The gap between monitors is a DOM element too.
- Mouse (and, if the player allows, head tracking via MediaPipe, local only) moves the camera ±small offsets around the active pose. Never leave the reconstructed path.

## FR2. Beats → cameras
- boot: `desk`; open box: `desk` tilted down; work: `desk` with monitors full; look at the desk: `room`; shutdown/night: `desk` dimmed; door beat (delivery): `door`.
- Night: same splat, darkened with a warm lamp glow and the gap light (pink from ring wall) as DOM/shader layers. No second scene for night.

## FR3. Objects
- Objects are GLB meshes with the projection material: front image (`objects.json.img`), elevation `el`, rotation `rot`; faces away from the projection get the image's bright-average tint. Screens are canvas textures (NearestFilter) placed on a plane at each object's screen rect (to be measured per object; store in `objects.json`).
- "Hold up": first person; the object rises from the bottom of the view toward the gap. No hands are drawn.
- Phone (delivery) is a plane with a canvas screen; it is new-world (high resolution).

## FR4. Rings
- `desk`: objects react (idle animations), the gap widens (DOM).
- `wall`: a decal plane with veins behind the monitors; lamp colour shifts.
- `room`: cross-fade to a second splat `room_collapsed.splat` when it exists (to be generated with the same pipeline); until then, a full-screen pore overlay and colour grade.
- `door`: the door wall plane darkens; on day 19 the handle turns (small animation on the door plane).

## FR5. Tests
- Smoke test that the scene mounts headless (swiftshader) and renders a non-black frame for each named camera.

## Scope decision 2026-11-01 (author, after a probe of room.splat): the splat is for motion only
The probe showed the splat is sharp around the desk, the monitors, the bed and the back wall, and a fog toward the window side. So the room scene does **not** replace the photo stages. Scope now:
- **Stills stay photos.** 房间 / 桌子 / 门 keep their photo backdrops, hotspots and HUD exactly as today.
- **Moves use the splat.** A camera move between 房间 and 桌子 (and later 床 for the night beat) renders the splat for the duration of the move, from the pose of the departing framing to the pose of the arriving one (poses in `public/room/README.md`: 房间 = f080, 桌子 = f43, 床 = f159), then cross-fades to the photo of the arriving framing in the last 200 ms. The photo stage is shown underneath, so a slow load falls back to today's CSS push without any gap.
- **Night and collapse** use the splat too: at night the room darkens with the lamp glow and the gap light as shader/DOM layers over the splat; from ring `room` (day 13+) the collapsed look is a colour grade and pore overlay on the splat; `room_collapsed.splat` stays optional.
- **The window side is never framed.** Poses are clamped so the camera never looks past the desk's left edge toward the window; a vignette (edges 35 % darker) hides floaters at the corners.
- **Asset:** use `public/room/room_clean.splat` (pruned by Claude with script/tools/splat-prune.mjs: oversized and far-out gaussians removed, 1.5 % of the set; the window-side fog cannot be pruned away, hence the pose clamp and the vignette). Loader `@mkkellogg/gaussian-splats-3d` with three.js, loaded lazily after the first render, never on the title page.
- FR3 objects and FR4 ring geometry stay as written but are a later segment; this segment is only the move, night and collapse layers, with the feature behind a `?splat=0` kill switch and off when WebGL is unavailable.

## Addition 2026-11-01 (author): the over-pruned splat is the collapsed room
`public/room/room_collapsed.splat` exists now: the same capture pruned hard (half the gaussians gone), which makes the walls go dark and holed and leaves threads in the fog. The author wants exactly that for the collapse: from ring `room` (day 13) the moves and the night layer cross-fade from room_clean to room_collapsed as the ring deepens (room: 40 % mix, door: 100 %); no second capture is needed. Same poses, same clamp.
