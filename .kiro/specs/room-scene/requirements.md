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

## Navigation 2026-11-01 (author): now that the room is 3D, moving is pointing, not buttons
The rectangular hotspots and the 房间/桌子/屏幕/门 chips were a stand-in. Next round, first segment:
- **Point to go.** Clicking a thing glides the camera to its framing: desk → 桌子, a monitor → 屏幕 on that side, the door → 门, the bed → 床 (new framing, pose to be calibrated), the box → 桌子 then the box opens. Moves are continuous splat moves (900 ms) with the photo cross-fade at the end as today; with the splat off, the CSS push.
- **Back.** Right-click, Esc, a click on the bottom 6 % of the stage, or wheel-back pulls the camera out one level (屏幕 → 桌子 → 房间). Never past 房间.
- **Look.** At any framing, press-and-drag turns the head a little (±15° yaw, ±8° pitch) with the splat live; release eases back to the framing's pose over 600 ms. No walking; the room stays closed. With the splat off, drag does nothing.
- **Hotspots live in splat space.** Each pickable thing is a box in world coordinates (desk, left monitor, right monitor, tower, door, bed, box, lamp) in `calibration.ts` next to the poses; picking is a ray against those boxes projected through the current camera, so the hotspots move with the camera and with the drag. Hover lifts the thing 4 % brighter. Keyboard: Tab cycles the pickable things, Enter picks. With the splat off, the boxes project through the framing's fixed pose, which reproduces today's rectangles.
- The chips stay until this works in the browser, then go; the tests that read them switch to picking.

## Addition 2026-11-02 (author): the collapse on the stills
"我们目前没有大面积崩坏的效果呀." The collapse exists only on the splat during moves and as a few CSS variables on the monitors; the photo stills, where the player spends nearly all the time, stay clean. From now on the stills collapse too. Everything below is CSS/DOM over the existing backdrops, driven by `ring` from stages.json (and `calmDaytime` → nothing, `tenderDay` → warm grade but the overlays stay). Assets from Claude in `public/room/fx/`.

- **A `.fx` layer** sits over the backdrop and under the HUD in 房间 / 桌子 / 门 (and the desktop's monitor frame), with children per effect; each is on or off by ring, and its strength is a CSS variable set from the day within the ring (first day of the ring 0.5, second 0.75, third 1.0; day 10 none).
- **Ring `wall` (days 11–12)**: `veins.png` (1568×928, transparent) stretched over the wall behind the monitors in 房间 and over the upper third of 桌子, `mix-blend-mode: multiply`, opacity 0.35 × strength, slowly breathing (scale 1.00→1.02, 6 s loop). The lamp's light goes pink: a radial gradient at the lamp's rect (`content/desk.json` lamp) in 桌子, and at the lamp's spot in 房间 (Kiro measures), `#ff9fb0` at 0.25 × strength, screen blend. The desktop's existing `--tint` stays.
- **Ring `room` (days 13–15)**: the whole stage gets a colour grade (`filter: saturate(.8) sepia(.12) contrast(1.05)`) and a full-screen `pores.jpg` tile (2048², mirrored so it is seamless, multiply, opacity 0.18 × strength, drifting 20 px over 12 s). The left monitor's text gets the same tile as a `background-blend-mode: multiply` on the `.os` background (the 毛孔/指纹 of day 13). The veins stay from `wall`, at 0.5. Day 14: the grade turns warm (`sepia(.2) brightness(1.05)`), overlays unchanged ("墙还是肉的，光是暖的").
- **Ring `door` (days 16–18)**: day 16 as `room` plus the 门 view darkened 25 % with `door_chain.png` already in place. Day 17 (白): the stage goes toward white, `filter: brightness(1.3) contrast(.75) saturate(.5)`, a white vignette from the edges (radial, 0.45), and all desktop text at 60 % opacity; veins and pores fade to 0.3. Day 18: like 17 with the vignette at 0.6; the 房间 backdrop is the white corridor only at the boot beat's first line (the `boot` beat's `where: room` line), then the room.
- **Night beats** keep their own look; the `.fx` layer stays but the grade is not applied at night (the dark does that work).
- **Reduced motion** (`prefers-reduced-motion`): no breathing, no drift; opacities unchanged.
- **Tests**: snapshot 房间 and 桌子 on days 10, 11, 13, 14, 17, 18 and the desktop on 13 (the `.fx` children and their variables, not pixels); property: no `.fx` child before ring `wall`, none on day 10, all variables within [0, 1].

## Correction 2026-11-02 (author): the collapse is in the photos, not on the lens
The author saw the overlay version: "贴在摄像机了", "整个空间其实没有变". A flat decal over the photo reads as something on the camera, not on the wall. So the stills collapse by **swapping the photo itself**. Claude made edited versions of each backdrop (same framing, same furniture; only the world changes) in `public/room/fx/`:

| stage | 房间 | 桌子 | 门 | what it is |
|---|---|---|---|---|
| `wall` | room_wall.jpg | desk_wall.jpg | door_wall.jpg | the first change: thin dark veins under the paint, lamp light slightly pink |
| `other` | room_other.jpg | desk_other.jpg | door_other.jpg | the otherworld: rust, damp, grime, red lamp, grating floor, yellowed bedding |
| `glitch` | room_glitch.jpg | desk_glitch.jpg | door_glitch.jpg | the world as a corrupted file: pixel blocks, duplicated furniture, floating fragments |
| `white` | room_white.jpg | desk_white.jpg | door_white.jpg | fading out: overexposed, colours drained, only outlines |

Rule, replacing the `.fx` overlay children `veins`, `lamp`, `pores` (full-screen), `dark` and `vignette`:
- The backdrop of each still is a **stack**: the clean photo at the bottom, then the stage photos above it, each with an opacity. `fxPlan` returns `{ stage, mix }` per day: days 11–12 `wall` at 0.6 / 1.0; day 13 `other` 0.5, day 14 `other` 0.8, day 15 `other` 1.0; day 16 `other` 1.0 **plus** `glitch` 0.7 on top (the last change before the white); day 17 `white` 0.85 over `other` 0.4; day 18 `white` 1.0. Day 10 (calm) clean. Days 1–9 clean. Night beats use the same stack (the dark layers above it do their work as today).
- Transitions are only at the day boundary, so nothing animates during a day; but inside a day the `glitch` layer (day 16) flickers: opacity 0.7 ± 0.3 at irregular intervals (seeded by day, 0.3–2 s), never with reduced motion (then steady 0.7).
- The desktop's left monitor keeps the pores tile on `.os` from ring `room` (that one is a texture on a surface, not on the lens). The desktop's `--tint` stays. The white stage still dims desktop text to 60 % on days 17–18.
- The 门 view shows the same stack. The splat move layer is unchanged (it has its own collapsed splat).
- Tests: replace the `.fx` child snapshots with the stack: 房间 / 桌子 / 门 on days 10, 11, 12, 13, 15, 16, 17, 18 (which photos, which opacities); property: clean before day 11 and on day 10, opacities in [0, 1], the stage order is monotone (wall → other → glitch → white, never back); the glitch flicker is seeded and deterministic.
- `public/room/fx/veins.png` is gone; `pores.jpg` stays for the monitor.

## Addition 2026-11-02 (author): the collapse breathes — a shader, not a crossfade
Two photos crossfading reads as slides ("ppt 2 页切来切去"). The stack from the correction above stays as the **data** (`fxPlan` → stage photos and amounts), but it is **rendered by a fullscreen fragment shader** (WebGL2, one quad, the clean photo and up to two stage photos as textures, a 512² seeded noise texture Claude supplies at `public/room/fx/noise.png` (fbm, tileable); three.js is already in the project for the splat). The shader runs under the HUD in 房间 / 桌子 / 门 whenever the stack has any stage; otherwise the plain photo is drawn as today. 30 fps cap, paused when the tab is hidden.

Per stage the shader mixes with these behaviours (amounts come from `fxPlan`, time from a clock that starts at the view change; all constants in one `FX` table in `src/world/room/fx/shader.ts` so they can be tuned):
- **Dissolve, not opacity.** A stage photo appears where `noise(uv * scale + drift) < amount`, with a soft edge (smoothstep width 0.08), so it grows in patches from the edges and corners (bias the noise with distance from the centre, so the middle of the room is the last to turn). `wall` scale 3, `other` scale 2 with a second octave, `white` scale 1.5 and the patches grow from the top.
- **Breathing.** The whole image is warped by a slow radial pulse: `uv += (uv - 0.5) * a * sin(t * 2π / T)`, `wall` a 0.003 T 7 s, `other` a 0.008 T 5 s, `glitch` 0, `white` a 0.004 T 9 s. Subtle; the test is that it is felt, not seen.
- **Grain and static (滋滋).** Per-frame film grain, `wall` 0.02, `other` 0.05, `white` 0.04; plus static bursts: at seeded irregular moments (every 4–15 s on `other`, 1–4 s on `glitch`) a 0.15–0.5 s burst of horizontal tearing (rows offset by up to 12 px) and stronger grain (0.15).
- **Glitch (day 16 only).** Block displacement: the image is cut into a 24×14 grid, and in each burst 5–12 random blocks jump by up to 40 px and swap channels; constant RGB split of 2 px that widens to 8 px in bursts; scanline flicker (every 3rd row darkens 10 %).
- **Particles** (a second, additive pass or a 2D canvas above the quad, Kiro picks and says): `other` 60 dust motes drifting slowly left and down, warm grey, 1–3 px, 0.3 alpha; `white` 40 white flakes rising, 2–4 px, fading as they rise. None on `wall`.
- **Night beats**: the same shader, the dark layers above as today.
- **Reduced motion**: dissolve at the day's fixed amount, no breathing, no bursts, no particles, grain 0.
- **Fallback**: no WebGL2 → the opacity stack from the correction (that code stays).
- **Sound tie-in** (sound spec): a static burst sends `sfx:static` through `playSfx` if `public/sfx/static.mp3` exists (Claude adds the file; silence if missing).
- **Tests**: the shader is not unit-tested as pixels. Test `FX` table bounds, the burst schedule (seeded, deterministic, within the stated intervals), the particle counts per stage, the fallback path's stack, and a smoke test that the GL program compiles under the existing headless setup (the splat tests show how) and that one frame is not all black on day 13.

## Correction 2026-11-02 (author, after seeing the shader): no cow spots, nothing over the screens
Seen on day 13: the dissolve makes large hard-edged blotches ("奶牛斑"), and one of them lies across the left monitor and smears the screen hotspot's white frame. Seen on day 16: the glitch is at full strength all the time.
- **Soft, fine dissolve.** Edge width 0.08 → 0.35 (a mottled gradient, never a cut-out); noise scale `wall` 3 → 5, `other` 2 → 4 with three octaves, `white` 1.5 → 2.5; the edge bias stays (centre turns last) and is stronger: amount is multiplied by `0.55 + 0.45 * d` where `d` is the normalised distance from the centre, so on day 13 the corners are fully turned and the middle is barely.
- **Protected zone.** The monitors and the desk top never dissolve in patches: inside the rects (桌子: `content/desk.json` monitors + keyboard; 房间: the two monitor rects Kiro measures from room.jpg, the same ones the screen hotspots use; 门: none) the stage photo blends by a plain smooth crossfade at `amount`, feathered 40 px outside the rect. The hotspot frames and the dialogue box sit above the canvas as before, so nothing is drawn over them; this rule is about what shows through under them.
- **Day 16 rhythm.** Baseline glitch amount 0.7 → 0.45 with the block/RGB/scanline effects at rest only as a faint RGB split (2 px) and grain; the bursts (1–4 s apart, 0.15–0.5 s) take it to 0.9 with blocks and tearing. Between bursts the room must read as a room.
- **Day 17–18 white** keeps growing from the top; the protected zone applies there too (the monitors are the last to whiten).
- Tests: the FX table values above; a property that the dissolve weight inside a protected rect equals the plain crossfade weight (pure helper, no GL); day-16 at-rest amount ≤ 0.5 and burst amount ≥ 0.85.
- Also: pin the fast-check seed in `tests/dialogue.test.ts` "wrap" property (it fails roughly one run in ten on a random string); if the failure is real for that seed, fix the wrap, not the seed.

## Correction 2026-11-02 (author, morning): placed things wait for the camera
During the 房间 → 桌子 push the tabletop's placed cutouts (cup, phone, box, meal, objects, walkman) appear before the camera has arrived. They belong to the arriving framing: they fade in with the arriving photo in the last 200 ms of the move (splat on) or at the end of the CSS push (splat off), never before. Same for the HUD elements that are framing-specific (the checklist card stays). Snapshot the mid-move DOM: no `.slot` children while `.m-move` (or whatever marks a move) is on.

## Correction 2026-11-02 (author, after clicking the box): no warp zoom
With the splat off, the 房间 → 桌子 move is a CSS scale-up of the whole photo ("像时空穿梭"). Replace it: when there is no splat move, the change of still is a 400 ms crossfade with at most a 3 % scale on the arriving photo, never a zoom through the picture. Same for every move between stills, both directions. The splat move keeps its own motion.

## Addition 2026-11-02 (author): walking, not switching
"好的视角迁移，应该是能先走到比较近的地方然后置换空间……更像玩家有行动而不是听鼠标的命令." A move is the player walking there, then the space changing:
- The splat move is the walk: the camera glides toward the thing, with a small head bob (2 steps per move, ±4 px vertical, ease in/out) and two soft floor sounds (`step-1.mp3`, `step-2.mp3`, Claude supplies; silence if missing). Duration scales with distance: 房间 → 桌子 900 ms, 房间 → 门 1200 ms, 桌子 → 屏幕 500 ms, back moves the same. The arriving still crossfades in only over the last 200 ms.
- Before walking: hover lifts the thing (the 4 % brighter from the navigation rule); the head-turn drag lets the player look around first; nothing moves until the click.
- With the splat off there is no walk: only the 400 ms crossfade from the no-warp correction. Never fake a walk by zooming the photo.

## Decision 2026-11-02 (author, after a screen recording of the live build): the splat goes dark until it is good
The recording shows fog and black smears on every splat move and on every head-turn, and the photo popping in at the end ("穿梭感", "严重的云雾和黑暗"). The capture is not good enough to be seen; parameters will not fix it. So:
- **Splat off by default.** The gate flips: the splat layer is on only with `?splat=1` (dev and testing); production never loads it. The collapsed splat, the night splat layers and the pull-out keep working behind the same flag; `?splat=1` remains the way to test them.
- **Moves are crossfades.** Every move between stills is the 400 ms crossfade from the no-warp correction, with the arriving still's placed things fading in with it. No zoom, no fog. The walking rule (head bob, footsteps, distance timing) applies to the crossfade too: the bob moves the whole still ±4 px, the steps play, the longer paths take longer, so a walk still feels like a walk.
- **Look is photo parallax.** Press-and-drag pans the still up to ±4 % of its width and ±2 % of its height, with the placed things moving 1.5× the photo (a little parallax), easing back over 600 ms on release. The still is already larger than the stage (2048 on a 1600 stage), so no edge shows. Never the splat.
- **Edges tell you where you can go.** In 房间, resting the pointer in the right 8 % of the stage shows a soft arrow and the word `hud.cam.door` (门); the bottom 6 % shows `hud.back` when there is a level to go back to; in 桌子, the top 10 % (the monitors) is the screen hotspot as before. The hints fade in over 200 ms and sit under the HUD. Clicking the hinted edge goes there. Keyboard: Tab/Enter as before. Strings: `hud.back` (Claude adds, zh 退回 / en Back).
- Hotspots keep their boxes and picking; with the splat off they project through the framing's fixed pose, as the navigation rule already says.
- Tests: the gate's default; a move with the splat off produces no `.splat-layer` and a 400 ms crossfade; drag pans within the limits and never mounts the splat; edge hints appear only in their zones and only where a target exists; snapshot 房间 with the door hint showing.
