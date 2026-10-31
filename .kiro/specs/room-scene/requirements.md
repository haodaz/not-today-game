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
