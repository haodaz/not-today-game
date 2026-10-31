# late-days — design (FR2–FR6; FR1, the 192 px body, is done)

Everything here is gated by the ring the cycle table gives the day (`stages.json` `cycles[].ring`),
never by a day number in code. Two gates:

- `lateRing(day)`: ring ≥ `door` (the cycle that holds days 16–18). Red eyes, the maw, Kuro closing
  pages.
- `overlayRing(day, beat)`: the *presented* ring (`desktopRing`, so a calm-daytime day looks like
  the first ring) ≥ `wall`. The text tentacles.

`src/world/late/rings.ts` holds both. The tentacle parameters are in `browser/tentacles.ts`.

## FR2. Red eyes

- `frameUrl(name, red)` appends `_red` (`public/kuro/k3d_<frame>_red.png`). The pairs and the
  crossfade are unchanged.
- Every body slot carries `data-red` when `lateRing(day)`: the HUD body, the dialogue portrait,
  and the closer (FR4). The persistent `KuroBodyElement` reads it, and a change of eyes counts as
  a change of look (it crossfades like a state change).
- The desktop pill's face uses the red base frame too. That is the "avatar in dialogue"
  (`k3d_base_red`); the dialogue portrait is the body itself.
- Before the late ring, no markup carries `data-red` and no URL ends in `_red`.

## FR3. The maw

- New looks `maw`, `maw2`, `maw3`. Each is a single frame (`k3d_maw.png`, `k3d_maw2.png`,
  `k3d_maw3.png`), cut, never crossfaded: `KuroBodyElement` replaces the layer at once when
  either the old or the new look is a maw. They are never red (they are their own look).
- `kuroBodyState` gains a maw input with the highest precedence:
  - `maw` (one ring): the FR4 flash, for 400 ms;
  - `maw3` (the tentacle): the last day's night (`constants.lastDay`, night beat);
  - `maw2` (rings into the throat): a late-ring night after the player held up nothing to the
    hand (`state.raids[day]` = `{ blockedWith: null, gave: null }`), until morning;
  - otherwise none.
- All three need `lateRing(day)`.

## FR4. Kuro closes what it does not want you to read

**Content.** `content/browser/day-NN.json` `reading[]` entries, and `content/days` items, may carry
`kuroCloses: true` and `kuroClosesLine: { zh, en }`. One parser (`src/state/closes.ts`) is used by
both loaders: the line is required when `kuroCloses` is true and rejected without it; both
languages must be non-empty strings. The day-16 draft is copied to `tests/fixtures/browser-day-16.json`
as the loader fixture. `content/` is not edited (Claude moves the three files).

**What can be opened.**
- A browser reading entry with a headline is a button. It opens the entry as a small page inside
  the browser window (`.br-page`: its own bar with a × close control, the headline, sec · when).
  `session.browserRead` holds its index. Empty entries stay plain rows.
- A day item's "document" is 工作台's 文档 page while that item is the open work task.

**pageId.** `d<day>:reading:<index>` (0-based index into that day's `reading` list, so day 16's
老周 is `d16:reading:1`) or `d<day>:item:<itemId>`.

**Event.** `kuroClosed { pageId }`. The reducer checks the shape and that the pageId's day is the
event's day. It changes no state: nothing is lost, only closed. Judgement can cite it.

**Timeline** (`src/world/late/closer.ts`; `session.kuroCloser` = `{ pageId, line, phase, token }`):
1. Opening such a page (ring ≥ door) starts `wait`: after `max(0, 1200 − 300 × n)` ms, where `n` is
   today's `kuroClosed` events for that pageId (1.2 s, then 0.9, 0.6, 0.3, 0).
2. `crawl` for `MOTION.crawl` (1200 ms). The HUD corner is empty; the body is a slot at the page's
   × (`.kuro-closer`, state `crawl`). Motion plays `m-closer-in` from the HUD corner's position to
   there (the crawl frames loop).
3. `maw` for 400 ms: the same slot, state `maw`.
4. Close: `kuroClosed` is appended, the page is closed (`browserRead = null`, or 工作台 back to
   home), and the box shows Kuro's line in the current locale as a Kuro item (its portrait).
- If Kuro is speaking in the box when the crawl is due, it waits 500 ms and tries again.
- Closing the page yourself, leaving the browser / 文档, or leaving 屏幕 cancels it. Leaving the
  browser also closes the page. Every timer checks the token.
- There is always exactly one body slot: the HUD's, or the portrait's, or the closer's.

## FR5. Text tentacles

- `renderBrowser` adds `<canvas class="br-tentacles" data-ring data-opacity data-tentacles
  data-glyphs aria-hidden="true">` inside the browser window, only when `overlayRing`. It is never
  in 工作台 or 消息.
- Parameters (`tentacleParams(ring)`):
  - opacity: wall 0.08, room 0.18, door 0.3;
  - tentacles: wall 2, room 3, door 5;
  - 2400 glyphs;
  - each pass 8–20 s, seeded per tentacle.
- `sampleGlyphs(text, n)`: the page's text in reading order (the `.site` text in DOM order),
  whitespace dropped, cycled to `n`; empty text means no glyphs.
- `tentaclePoint(i, phase, w, h)`: a pure cubic from an edge, across, out the other side. A pass
  shows the window of the curve that is on screen at that phase.
- Glyphs inside the headline's rectangle are not drawn, so the headline is never covered (0 s ≤ 2 s).
- The DOM driver (`browser/tentacles-dom.ts`, run from the motion layer after each render) runs one
  rAF loop per canvas. It stops when the canvas leaves the DOM (window not shown) or the document
  is hidden, and resumes on `visibilitychange` and on the next render. Its clock lives in the
  driver, so a re-render continues the drift. No canvas context (tests, happy-dom): nothing to draw.

## FR6. Tests (tests/late-days.test.ts)

- Snapshots:
  - the HUD at day 15 vs day 16 (the eyes);
  - a kuroCloses page before and after Kuro closes it (with the line in the box);
  - the browser at ring wall / room / door (overlay parameters).
- Unit:
  - the sampler, the parameters, `tentaclePoint` (deterministic, starts and ends off the page);
  - the closer timeline (fake timers: 1.2 s, 0.9 s; crawl → maw → closed; cancel);
  - `kuroClosed` reducer;
  - loader fixture and strictness.
- Properties:
  - no `_red` and no maw before the late ring (every day × beat × raid outcome);
  - no overlay before ring wall (every day × beat), and never in 工作台 / 消息.
