# collapse-details — requirements (2026-11-04, author)

Small things that go wrong and then go back, so the player is never sure they saw it. Author: 「中间崩坏可以看到格子闪烁位置变成六芒星之类的中间还有法阵，稍后又恢复正常。」「或者头像变怪了也行。」 and (decided earlier) 「屏幕 3」 in 调度中心. Notes: `script/notes/作者反馈-2026-11-04.md` § 崩坏小细节. Stage comes from `content/stages.json` (never hardcode days).

## R1. The meeting turns into a hexagram (stage ≥ 4)
- While a meeting plays (meeting view) on a day with stage ≥ 4, **once per meeting per day**, at a line chosen by a seeded roll (run id + day + task id; never the first or last line): the tiles flicker (2 frames of 80 ms, opacity 0.2) and slide to six points of a hexagram (two overlapping triangles) around the window's centre, extra tiles stacking on the points; in the centre a thin magic circle (inline SVG: two concentric rings, a hexagram, 12 tick marks, stroke `currentColor` at 35 %) fades in over 400 ms. It holds 2.4 s, then everything slides back to the grid and the circle fades out (600 ms). Subtitles keep running.
- `prefers-reduced-motion`: no slide; the grid swaps to the hexagram positions and back with a 300 ms fade.
- Session only: no event, nothing in the log. A reload may show it again (it is a glimpse, not a record).

## R2. A face that is wrong for a moment (stage ≥ 3)
- In a meeting on a day with stage ≥ 3, **once per meeting per day** (seeded, a different line from R1), one person's avatar tile is drawn wrong for 900 ms: the same image with a CSS distortion: mirrored eyes (the top 45 % of the image flipped horizontally inside the tile), a 6 % vertical stretch and a 1 px chromatic split (two offset copies, red and blue, at 0.5 opacity). Then normal. Never the player's own tile, never a tile without an image.

## R3. 屏幕 3 in 调度中心 (stage 5)
- On days with stage 5, the first time 调度中心 opens on a day, its screen strip shows a third thumbnail, 屏幕 3 (`mc.screen3`), after 左屏 / 右屏: a dark screen with one window thumbnail the player never opened (a blank white window titled `mc.unknownWindow`). It cannot be dragged to, clicked or focused (no response; the cursor stays default). The next time 调度中心 opens that day, it is gone. Session only.

## R4. Strings (Claude adds): `mc.screen3` 屏幕 3 / Screen 3, `mc.unknownWindow` 未命名 / Untitled.

## R5. Tests
- R1/R2 seeded choice: same run/day/task → same line; never first/last; R1 and R2 never on the same line; not on stage < 4 (R1) / < 3 (R2).
- R1 markup: the hexagram positions and the circle appear for that line and are gone after; reduced motion swaps without the slide class.
- R2: the distortion class on one non-player tile with an image, for that line only.
- R3: stage 5, first open of the day shows 屏幕 3 and the unknown window; second open does not; stage < 5 never; it accepts no drop and no click.
