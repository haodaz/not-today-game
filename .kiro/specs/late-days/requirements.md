# late-days — requirements (author 2026-11-01)

What the last cycles add on top of rings (stages.json `cycles[].ring`). All of it is content-driven and stage-gated; nothing here appears before its day. Assets from Claude.

## FR1. Kuro is bigger
- The HUD body (day-loop Correction) is 192 px, not 96: twice the size in every view. Chat anchors adjust.

## FR2. Red eyes, days 16–18
- From day 16 every Kuro state uses the `_red` variant of its frames (`public/kuro/k3d_<state>_red.png`, same alignment, eyes red). The avatar in dialogue uses `k3d_base_red.png`. No other change: it is just the eyes.

## FR3. The maw, days 16–18
- New state `maw`, three frames, each its own look (no crossfade between them, cut): `k3d_maw.png` one ring of teeth (the flash in FR4), `k3d_maw2.png` rings receding into the throat (night-hand beat of days 16–18 when the player holds up nothing), `k3d_maw3.png` a black tentacle coming out of the maw (day 18 night only). Author 2026-11-01: keep all three.

## FR4. Kuro closes what it does not want you to read, days 16–18
- `content/browser/day-16..18.json` pages and `content/days` items may carry `kuroCloses: true` (Claude adds). When the player opens such a page/document, after 1.2 s Kuro's HUD body crawls (crawl loop) from the corner to the window's close control, the `maw` frame flashes for 400 ms, the window closes, and the dialogue box shows Kuro's line from the content (`kuroClosesLine`, zh/en). The player can reopen; Kuro does it again, each time 0.3 s sooner. Nothing is lost; it is only closed. Logged as event `kuroClosed {pageId}` (judgement can cite it).

## FR5. Text tentacles in the browser, ring ≥ wall (day 10 on)
- On browser pages a 2D canvas overlay draws tentacle shapes made of the page's own characters (a few thousand glyphs, the page text sampled in reading order), drifting slowly from the edges across the page and out again, 8–20 s per pass, never covering the headline for more than 2 s. Opacity by ring: wall 0.08, room 0.18, door 0.3. Pure 2D canvas, no WebGL; pauses when the tab is hidden. Reference: script/notes/视觉参考.md (ASCII shark / tentacles). Never on the workbench or messages, only the browser (the outside world).

## FR6. Tests
- Snapshot: HUD at day 15 vs 16 (eyes), a kuroCloses page before/after close, browser with overlay flag at ring wall/room/door (canvas is mocked: assert the sampler output and parameters).
- Property: no `_red` frame or `maw` state before day 16; no overlay before ring wall.
