# The chick's face, v2 (author 2026-11-15): a bigger LCD, icons printed on the shell

The author looked at the chick next to a real Tamagotchi and a bootleg's booklet: 「小鸡目前看不出形状和
道具，像乱码。操作 icon 其实已经不是 pixel 了。」 The LCD was 32 × 16 with the eight 4 × 4 icons laid
over its top row, so the chick had twelve rows and the icons were noise. Real devices print the icons
on the plastic around the glass and keep the whole LCD for the pet. We do the same.

Claude has already replaced `content/frames/chick.json` in the working tree (uncommitted; Claude
commits it with your work). It is the only source of pictures; code never draws a frame or an icon.

## The content file (read it first)

- `frames.<id>`: **32 rows × 48 columns** for every id in `CHICK_FRAMES` (unchanged set: idle-1,
  idle-2, turn, eat-1, eat-2, dark, check, nod, grave, smile-1, smile-2). The chick is ~24 × 21 with a
  solid eye and beak; props sit beside it (a bowl in eat, a moon in dark, a heart in nod).
- `icons.<icon>`: **9 × 9** for every icon in `CHICK_ICONS` (same eight, same order). These are the
  pictures printed on the shell, never blitted on the LCD.
- `frames.check` is the **status template**: four marks down the left and four empty bar frames.
  Code fills the bars (below).

## Code

### `src/world/objects/frames.ts`
- `CHICK_W = 48`, `CHICK_H = 32`, `ICON_SIZE = 9`. The parser's row/column checks follow the
  constants (they already do); update the header comment (32×16 → 48×32, icons printed on the shell).

### `src/world/objects/chick.ts` — `drawChick`
- **No icon strip on the LCD.** Remove the `s.menu !== null` branch that blits `CHICK_ICONS` across
  the top. `s.menu` still cycles with A and B still acts on `CHICK_ICONS[s.menu]`; only the drawing
  moves to the shell.
- **`check`**: blit the `check` frame as it is (marks + empty bars), then fill each bar:
  `STAT_ROW_H = 8`, `STAT_BAR_X = 15`, `STAT_BAR_MAX = 28`; for `STAT_ORDER[i]` draw
  `b.rect(STAT_BAR_X, 3 + i * STAT_ROW_H, Math.min(stat, STAT_BAR_MAX), 4, 1)`. Drop the
  `b.rect(0,0,w,h,0)` clear and the `STAT_MARK` icon blits (the marks are in the template now;
  `STAT_MARK` goes away).
- Everything else (flash, `finer`, upgraded `upgradedHi`, turn/eat/nod/dark timing) unchanged.

### `src/world/room/devices.ts` — the egg's front, and `devices.css`
- Around the glass, **two rows of four icons printed on the bezel**: above the glass
  meal · light · play · medicine, below it toilet · checkup · training · attention (A's order, left
  to right, top row first). Each icon is the content bitmap rendered as an inline SVG of 9 × 9 unit
  rects (`shape-rendering: crispEdges`), in a printed-ink colour on the cream bezel (the brand's
  brown family, lighter: ~`#9a5a00` at 70 %). About 18 px square on the 300 px egg.
- The **selected icon** (`(ctx.p as ChickState).menu`, when not null and the chick is not upgraded)
  is shown as a real device would: a dark rounded square behind it with the icon in the LCD green.
  Nothing on the LCD marks the selection.
- Layout: the glass keeps its 4 px padding and the 3 : 2 shape of the new frame (48 × 32 at 3 px
  per cell = 144 × 96 inside; the glass is 152 × 104). Grow the bezel to fit the two icon rows
  (about 200 × 180: icon row ~20 px, glass, icon row ~20 px, with the same rounded-shield shape);
  move the brand up if it collides; keep A B C and their labels where they are (adjust `top`s by the
  bezel's growth so nothing overlaps). The back face is untouched.
- `held.ts` already reads `CHICK_W / CHICK_H`; the dream-level scaling and the ghost layer work on
  the canvas size and need no change — verify the held view and the title drawer both show the
  whole 48 × 32 frame crisp (integer scale, `DEVICE_BACKING` unchanged).

### `src/world/objects/kurogotchi.ts` and the Kuro egg
Untouched (its 64 × 64 PNG poses are a different device).

## Tests
- `tests/objects-in-hand.test.ts`: the synthetic frames/icons fixtures use the constants' sizes
  (48 × 32 frames, 9 × 9 icons); the menu-strip assertions (icon bits on the LCD's top row when
  `menu` is set, and the per-icon ascii snapshots around line 873) are rewritten: with `menu` set
  the LCD shows the same picture as with it null.
- `tests/chick-raising.test.ts`: the status-screen bit checks move to the new geometry
  (bar fill at `STAT_BAR_X`, rows `3 + 8i`, width = stat, 4 tall, capped at 28).
- `tests/taken.test.ts`: unchanged expectations should still hold; fix sizes if they read `CHICK_W`.
- New: the shell renders eight bezel icons in order; the selected one carries the `on` class and
  the LCD does not change; no icon is marked when upgraded.
- Snapshots carrying the egg's markup refresh (content-only); say so in the log.

## Not in this spec
New frames or new icons (Claude's file); the chick's behaviour; the Kuro egg.
