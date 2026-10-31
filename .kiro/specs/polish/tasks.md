# polish — tasks

- [x] 1. `timing.ts` and `reveal.ts` (pure), with tests.
- [x] 2. Controller: the `motion` hook around render, and `ctx.now`.
- [x] 3. Held phone and objects: session `holding`, `loop-hold` / `loop-put-down`, Esc, the held
  layer and device canvas, and the desk-bar buttons and `lifted` class.
- [x] 4. Door: the step list, the hit area, the chain layer, the shadow, sounds, and the W1 fix.
  Also fixed: the door view was interpolated as escaped text (`raw()` now; renderDoorView
  escapes its own content).
- [x] 5. Reveal gating in `loop-advance` (and Space / Enter at a choice), plus the hold.
- [x] 6. `dom.ts`: entries and ghosts for held, dialogue, choices, checklist, door, views, the
  monitor push, shutdown, sleep/wake, Kuro lines, and phase-locked loops.
- [x] 7. `motion.css`, plus Kuro timings (300ms crossfade, 3s ±3px bob, 1.2s crawl).
- [x] 8. Tests (`tests/polish.test.ts`); the one snapshot updated (P9).
- [ ] 9. Check in a browser: node tests cover the pure parts and the markup only, not the DOM layer.
