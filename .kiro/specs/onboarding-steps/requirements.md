# onboarding-steps — requirements (2026-11-05, author on playtest-1105 R1)

The first-visit card lists every app at once; the author wants the mature pattern instead: one app at a time, pointing at its dock icon (coach marks). And the desktop gets a wallpaper.

## R1. Coach marks replace the single card
- First desktop visit of a run (same trigger and "seen" flag as playtest-1105 R1): step through the dock apps left to right — 喂信, 汀汀, 工作台, 浏览器, then the 文件 decoy — one step each.
- Each step: the desktop under it dims (black 30 %); the step's dock icon is lifted above the dim with a 2 px ring in the accent colour and an 8 px soft glow. A card 300 px wide sits 14 px above the icon, centred on it (clamped inside the monitor), with a 10 px arrow pointing down at the icon. Card content: the app's name (bold, the dock name), its line (the existing `onboard.*` string; Claude has dropped the "名字：" prefix from them), and at the bottom right `onboard.step` ("{n} / {total}").
- Buttons on the card: `onboard.skip` (text button, left) and `onboard.next` (primary, right); on the last step the primary is `onboard.ok`. Enter = next, Esc = skip. Clicks outside the card do nothing.
- Skip or the last ok marks it seen. Nothing is logged.
- Remove the single list card.

## R2. Wallpaper, a different one each day
- `content/wallpapers.json` (Claude's, already in the tree): `{ _note, list: ["/os/wallpaper_a.jpg", "/os/wallpaper_b.jpg", "/os/wallpaper_c.jpg"] }`; strict loader (non-empty list of paths under /).
- The desktop background (both monitors, under the windows and the dock) is `list[(day - 1) % list.length]`, `background-size: cover`, centred. It changes only at a new day; when it does, crossfade 1.2 s on the first desktop visit of that day. Night plates and the ring layer stay above it as they are today.

## R3. Strings (Claude's, already in the tree when this is sent): `onboard.next` 下一个 / Next, `onboard.skip` 跳过 / Skip, `onboard.step` {n} / {total}.

## R4. Tests
- First visit: step 1 highlights 喂信's icon; next walks the five in order; the last shows ok; skip at any step ends it; seen afterwards (no second showing in the run).
- Esc skips, Enter advances; a click outside does nothing.
- The desktop renders list[(day − 1) % n]: day 1 → a, day 2 → b, day 4 → a.
