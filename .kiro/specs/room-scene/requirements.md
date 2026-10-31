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

## Addition 2026-11-01 (author): the day-18 pull-out
The camera can never be pulled back by the player; the clamp holds. But on **night 18**, after the bedtime branch and before the ending card, the camera pulls far out along the room's axis (about pos (67,-29,-1) looking at the room, 6 s, ease-in) until the lit room is a small island in black. The black is not empty: a layer of **eyes and tentacles** (sprites Claude will provide under `public/room/dark/`: `eye_*.png` cutouts and `tentacle_*.png`, plus a tiling `dark_tile.png`) fades in around the island over the last 3 s, dense at the edges, thinning toward the room, eyes blinking out of sync, tentacles drifting slowly. The good ending cuts it short at 2 s (the door opens instead); bad and survive hold the full pull-out, then the ending card. This is its own segment after the motion segment; the motion segment only has to leave the camera path and the clamp overridable for a scripted move.

## Correction 2026-11-01 (author, after the first browser run): fit the splat to the stage
Seen in the browser: the splat draws and leaves, but (1) the camera barely travels during the 400 ms move, (2) the canvas covers the whole window instead of the stage rectangle, so the cut to the photo jumps, and (3) the end pose does not match the 桌子 photo.
- The splat canvas is **clipped to the stage rectangle** and uses the stage's scale and offset (`fit.ts`); nothing is drawn in the letterbox.
- A splat move lasts **900 ms** (the CSS push for these two views is lengthened to match); the camera travels the whole way, ease-in-out.
- The end pose of 房间→桌子 is the README's **close-desk pose** (the one measured on room.splat, not f43 from door.splat), and the field of view is chosen so the last splat frame lines up with `desk_close.jpg`'s framing: Kiro measures it by overlaying the photo at 50 % in a dev-only `?splatcal=1` mode and reports the FOV and pose used. Same for 桌子→房间 against `room.jpg`.
- The 房间 pose may include the window; the vignette stays.

## Correction 2026-11-01 (author): the good ending pulls out too, and sees Kuro itself
Every ending on night 18 does the full 6 s pull-out. What appears in the black differs:
- **Bad and survive:** the layer of eyes and tentacles as written above.
- **Good:** no scattered eyes. A **single giant Kuro**, realistic, not the cartoon sprite: a black three-headed hound (the same Labrador as Kuro, grown vast) whose body is an octopus, its body and arms covered in many eyes, its arms wrapped around the whole space so the lit room sits inside its embrace. Assets Claude will provide under `public/room/dark/giant/`: `body.png` (the embrace, a ring of arms with the gap for the room at centre, transparent inside), `heads.png` (three heads above the room, eyes dull red), and `arm_*.png` for slow drift. It fades in over the same last 3 s, the heads last; the room is never covered. Then the credits. The 2 s cut for good is dropped once these assets exist; until then the earlier rule stands.
