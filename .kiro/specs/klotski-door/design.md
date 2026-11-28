# klotski-door · design

## Content (R1)
- `BoardGame` klotski: `exit` + `blocks[ch] = { label, role, card?, face? }`. The loader checks: every level letter has an entry, one `N` 2 × 2, `exit` is a `you` block, 1 × 1, with a `card` equal to `slot`'s answer; `label` empty only for `nameless`; `face` only on `person`.
- Twin check (`localiseTask`, board branch): `level`, `exit`, `slot` and each block's `role` / `card` / `face` must match; labels come from the en twin.
- Day 17's `game` block is written by `script/tools/klotski-door-content.mjs` (the spec's JSON, verbatim) so no hand-edit touches the rest of the file.

## Engine (R2)
- `klotskiPush`: a block on the bottom row whose cells are all over the door, pushed down: if it is `exit`, the game is done (`out = exit`, the block **stays** in `blocks`); otherwise the same game comes back, with `blocked: true` set once (the sub-line).
- `trail`: the exit block's cells in order from the start, appended on every move of that block (and trimmed by 退一步 with the position). `empty`: the cells empty at the door moment.
- `klotskiPath`: state key groups by `w×h + role` for `god` and `person`.
- `grade`: nothing out → wrong; else `capAssisted(byCount(moves, 45, 90))`.

## The door moment (R3)
- `KLOTSKI_DONE_MS = 6000`. From `outAt`: 0 ms door opens; tentacles grow cell by cell along `empty ∪ trail` (reverse trail: from the door upward), then the rest of the board, the exit block's cell last. Each covered cell is an `<i class="kl-tent">` with a CSS delay; the lines `door1/2/3` appear at fixed delays (CSS `animation-delay`).
- Reduced motion: `@media (prefers-reduced-motion)` drops the animation, every cell and all three lines shown.

## Look (R4)
- Classes by role: `nameless` → `big` (eye, as before), `gate` (keyhole + arch), `god` (`kl-fig` + `kl-mark m-H|F|P|S`, inline SVG in seal red), `person` (round desaturated `<img>` + label), `you` (light tile, amber ring, no rot). The tray / wood / seals / veins of ce1eda2 are kept.

## Strings (R5)
- zh / en replaced and added as given; `out`, `won`, `left` removed.
