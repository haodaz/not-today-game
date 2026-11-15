# The title page breathes (author 2026-11-15): continuous ambient motion on the room

The author looked at another game's main menu: a still picture that reads as alive because the
sea keeps moving and the ship turns, slowly. 「其实只是比我们多了一点光效。」 Our title page is the
room photo darkened, a 120 s zoom, and one small thing every 20–40 s (the idle events). Between
the events it is a JPEG. This spec adds the layer that never stops: the window's light, rain on
the glass, a standby light on a monitor, film grain. Quiet, continuous, nothing new to click.
The idle events stay exactly as they are; the words (logo, menu) stay still — a still logo over a
moving picture is the whole trick.

Everything here is CSS keyframes on layers the view prints; no JS per frame. All layers sit inside
`.title-room` (so they push in with the camera and the drift) and are `pointer-events: none`.
Stage coordinates: the photo is `room_nobox.jpg` (2048 × 1152) cover-fitted to 1600 × 900, so a
stage px = image px × 0.78125 (the numbers below are stage px).

## 1. The layers (`src/ui/title/view.ts` `room()`, `title.css`)

Printed right after `.title-photo`, before the `.idle` layers, in this order:

1. **`.amb.daylight`** — the light from the window, breathing. A gradient anchored on the left
   edge: `linear-gradient(90deg, rgba(205,218,236,.9) 0, rgba(205,218,236,.35) 120px, transparent
   420px)` over the full stage height. Its opacity breathes `0.06 → 0.16 → 0.06`, 11 s,
   `ease-in-out`, infinite. A second copy **`.amb.daylight.b`** at half strength breathes on a 17 s
   period, so the two never line up and the light never visibly repeats (two periods that are not
   multiples of each other: that is what keeps a loop from looking like a loop).
2. **`.amb.rain`** — streaks on the glass only. The glass is the bright strip at the far left:
   `l 0, t 0, w 38, h 445` (the sill is at ~445–470). Inside it, a `repeating-linear-gradient` of
   1 px lines of `rgba(220,230,245,.55)` every 14 px, tilted −8° (rain under wind), tile
   `60 × 240`, `background-position` running downward 240 px every 3.2 s `linear infinite`. A
   second gradient in the same element (two `background-image`s) at a different spacing (9 px) and
   speed (5.1 s), half as bright: depth. Overall opacity `.45`. **Class `off`** (the model's
   `rain === false`, below): opacity fades to 0 in 600 ms and the animation keeps running (so it
   resumes without a jump).
3. **`.amb.led`** — the right monitor's standby light. A 3 × 3 px square at the monitor's bottom
   right: `ROOM_SHOT.monitors.right` is `l 640, t 305, w 257, h 156` → the LED at `l 884, t 454`.
   Colour `#f0a030`, `box-shadow: 0 0 4px 1px rgba(240,160,48,.55)`. Breathes `0.25 → 1 → 0.25`
   over 2.4 s `ease-in-out infinite` — the sleep pulse every real monitor has. **Absent** (not
   printed) when `m.monitorsAwake` or the `monitor_right` idle is on: a lit screen has no standby
   light.
4. **`.amb.grain`** — film grain over the whole stage. The tile is made once in the mount
   (`src/ui/title/mount.ts`): a 128 × 128 canvas filled with random grey pixels (each channel the
   same random 0–255, alpha 255), exported with `toDataURL`, set on the root as
   `style.setProperty("--t-grain", "url(...)")`. jsdom has no canvas: when `getContext` returns
   null, set nothing (the layer is then transparent). CSS: `background-image: var(--t-grain)`,
   `background-size: 128px 128px`, `mix-blend-mode: soft-light`, `opacity: .07`, and
   `animation: t-grain 800ms steps(8) infinite` where `t-grain` runs `background-position` from
   `0 0` to `-96px -160px` (eight distinct offsets a second-and-a-bit: that is what a video's noise
   floor looks like; the eye reads it as "footage", not "picture"). Under the vignette, over the
   photo.

### The drift gets a sideways component
`t-drift` today scales `1 → 1.07` over 120 s. Keep that and add `translate: 0 0 → -14px 6px` in
the same keyframes (a push that is also a slow pan reads as a camera, not a zoom). The camera
classes (`cam-in` / `cam-out` / `cam-desk`) override the animation as they do now; nothing changes
there.

### A new idle layer: `window`
`src/ui/title/table.ts` `IDLE_LAYERS` gains `"window"`. The view prints
`<div class="idle window [on]">` (after the other idle layers): the same gradient as `.amb.daylight`
at `opacity: 0`, `.on` → `opacity: .5` with no transition — a far flash of lightning through the
curtain. Claude adds the content event (`far_lightning`, layer `window`, 120 ms) to
`content/title.json` when the layer is in; do not edit content.

## 2. The model (`src/ui/title/model.ts`, `mount.ts`)
- `TitleModel.rain: boolean` (initial `true`). The mount already keeps `rainOn` for the
  `rain_stops` idle event; mirror it into the model where it flips (`set({ ...model, rain: rainOn })`
  at both places), so the view can print `.amb.rain.off` while the sound is paused. Nothing else
  in the mount changes.

## 3. Reduced motion
Under `@media (prefers-reduced-motion: reduce)`: the rain layer is hidden, the grain's animation
is `none` (static grain stays), the LED stays steady at opacity .5, both daylight layers hold at
their mid opacity. The drift already follows the game's rule in `motion.css`; follow the same.

## Tests
- `tests/title.test.ts`: the four ambient layers are
  printed in order inside `.title-room`; `.amb.rain` carries `off` when `rain` is false; `.amb.led`
  is absent when `monitorsAwake`; the `window` idle layer prints and carries `on` for an idle event
  on that layer; `parseTitle` accepts layer `"window"`.
- The mount: with a canvas available (`HTMLCanvasElement.prototype.getContext` stubbed to return a
  2d-like object with `createImageData` / `putImageData` and a `toDataURL`), the root gets
  `--t-grain`; without one, it does not and nothing throws.
- Snapshots carrying the title room's markup refresh (markup-only); say so in the log.

## Not in this spec
New idle events (Claude's content); the logo and menu (still, on purpose); the Kuro figures on the
desk; any sound change; the in-run room views (this is the title page only).
