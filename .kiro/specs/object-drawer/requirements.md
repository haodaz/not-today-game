# The object drawer and the Kurogotchi (author 2026-11-03)

Author: 「我们获得的道具能不能在 menu 页面单独玩」「克总结局之后能不能克麻歌子一个，可以养克总」「克总能打破第四面墙，触手自己伸出屏幕摁按钮（因为小屏幕之外其实还是大屏幕）」「克总可以换一个屏幕稍微大一点的机器」「pixel art 那种感觉」「偶尔可以是红眼睛」. Decisions: objects never found are **not shown**; the drawer's chick is fresh every time; the Kurogotchi **remembers**.

The drawer lives on the title page, outside the story. It reads only the cross-run profile (the same place that holds the endings) and never writes to a run. Everything in it is the **original** object: never the upgraded state.

## 1. The profile remembers which objects were found

- `ProfileWriter.recordObject(id)` (src/state/saves.ts): adds `id` to `profile.objects: string[]` once (idempotent, order of first finding).
- A watcher like `watchEndings` (src/world/endings/record.ts, or a sibling file): for every new `openLayer` event in a **saved** run (`saved` false for `?day=N` debug runs; `?found=` grants never record), call `recordObject(objectId)`. Wire it in `src/main.ts` next to `watchEndings`.
- `readCollection` (src/ui/collection.ts) also returns `objects: string[]` (only ids that exist in `content/objects.json`, unknown ones dropped) and `kurogotchi: boolean` = `endings.good ≥ 1`. `EMPTY_COLLECTION` gets `objects: []`, `kurogotchi: false`.

## 2. The drawer page on the title

- A title button `title.drawer` (道具 / Objects), between 设置 and 制作, **only when** `collection.objects.length > 0 || collection.kurogotchi`. Action `title-drawer`; `title-back` returns, like 制作.
- The page: a grid of cells, one per found object in the order of `content/objects.json` (chick, textbook, pager, iccard, tape, dictionary, calculator, phone), then the Kurogotchi last if unlocked. **Objects not found are not shown at all** (no outline, no gap). A cell: the photo `/objects/<id>_front.png` (the Kurogotchi: `/objects/kurogotchi/base.png`, pixelated) and its name `obj.name.<id>`.
- Clicking a cell opens it in the middle of the page, large; a back control returns to the grid. Light page, one tone, like the rest of the title.

### Playing an object in the drawer

- **Drawn devices** (chick, pager, dictionary, calculator, tape): the same `renderDevice` markup and CSS as 使用 in the game, never `upgraded`, with the flip / rotate buttons where the object has them, keys clickable, key sounds as in the game. Program state lives only in memory for that page (a fresh `init` each time the cell is opened); no store, no events, no run. Env: `day` = the object's day in `content/objects.json`, `level` 0, `upgraded` false.
- **Photo objects** (textbook, iccard, phone): the photo with the holding drag-to-turn and the flip, no program.
- **The walkman in the drawer plays the theme song**, not the story recordings: `play` starts the same theme file the title plays (`theme_<m|f>_<zh|en>.mp3`, same choice), `stop` pauses, `ff` / `rew` seek ±15 s with the squeal, volume keys/wheel set its volume. The reels follow the song's position (`packRadii` over position / duration). The title's own theme pauses while the walkman plays and resumes after.

## 3. The Kurogotchi (克麻歌子), a second machine

Unlocked by the good ending (`endings.good ≥ 1`); hidden before that.

**Look**: not an egg. A rounded rectangle, matte black with a thin red rim, `obj.brand.kurogotchi` (克麻歌子 / KUROGOTCHI) under the screen, three round keys A / B / C. The screen is a **64 × 64** pixel-art LCD: the frames are images in `public/objects/kurogotchi/<pose>.png` (64 × 64, indexed colour, Claude's), drawn at an integer scale with `image-rendering: pixelated` on a pale green glass. Poses: `base` (one eye winking: its idle), `blink` (eyes closed, smiling), `happy`, `talk`, `eat`, `hungry`, `sleep`, `red` (red eyes). Draw as `<img>` swaps or a canvas `drawImage`, whichever is simpler; no smoothing.

**Program** `src/world/objects/kurogotchi.ts`, a pure reducer like the chick (state in, state + outputs out):
- State: `hunger` 0–4, `joy` 0–4, `chats` (this session), `light` on/off, `menu` index, `pose`, `lastSeen` (ISO date string), `fed` (total).
- Keys: A cycles the menu (feed · chat · light; three small icons drawn in the glass's top strip as pixel squares, the selected one inverted), B does it, C cancels.
- **feed**: pose `eat` for 1.2 s, then `blink`; `hunger` −1 (min 0), `joy` +1, `fed` +1.
- **chat**: pose `talk`; a line `kurogotchi.line.<n>` (n chosen by the reducer from a seed passed in env: only Kuro gets randomness) shows under the screen as a one-line ticker; `chats` +1. On the 5th chat: pose `sleep`, light off, the ticker says `kuro.bedtime`, chat is refused until the cell is reopened.
- **light**: toggles; off = `sleep` pose on a dark glass.
- Idle: `base`, `blink` for 300 ms every ~4 s. `hunger ≥ 3` → pose `hungry`. Each time it returns to idle there is a 1-in-12 chance (seeded) of `red` for 1.5 s.
- Hunger: +1 per 2 real minutes open; on open, +1 per day since `lastSeen` (max 4).
- **It remembers**: the state is saved in the profile (`profile.kurogotchi`, via `ProfileWriter`) after every change and read back on open. On open, if `lastSeen` is ≥ 2 days ago, the ticker shows `kurogotchi.missed` with `{n}` days. `lastSeen` is set to today on open.

**It reaches out of its screen (the fourth wall)**: the screen is small, but outside it is still the big screen.
- When `hunger ≥ 3` and no key has been pressed for 8 s: a pixel tentacle (square cells at the same scale as the LCD's pixels, colour `#0f2a12` with a 1-cell `#7a1010` edge) grows out of the LCD's right edge, crawls across the shell to key A, presses it (the key shows its pressed state, key sound) until the menu is on feed, then crawls to B and presses it; the program receives those keys as if the player pressed them (so it feeds itself). It retracts. About 3.5 s in all.
- When the 5th chat puts it to sleep, a tentacle comes out and presses `light` (A to the light icon, then B) itself.
- `prefers-reduced-motion`: no tentacle drawn; the keys just press themselves.
- The tentacle is cosmetic DOM/SVG over the device; the key presses go through the same reducer path as player keys.

## Strings (Claude has added them, zh and en)
`title.drawer`, `obj.name.<id>` for the eight objects and `kurogotchi`, `obj.brand.kurogotchi`, `kurogotchi.line.0`–`7`, `kurogotchi.missed` (`{n}`), and the existing `kuro.bedtime`. Kuro's lines are English in both locales, as everywhere in the game.

## Files
`src/state/saves.ts`, `src/world/endings/record.ts` (or a sibling), `src/main.ts`, `src/ui/collection.ts`, `src/world/room/collection.ts` (the type), `src/ui/title/model.ts`, `src/ui/title/view.ts`, `src/ui/title/mount.ts`, `src/ui/title/title.css`, a new `src/ui/title/drawer.ts`, `src/world/room/devices.ts` + `devices.css` (the Kurogotchi shell), a new `src/world/objects/kurogotchi.ts` (registered where the other programs are), tests `tests/object-drawer.test.ts` and `tests/kurogotchi.test.ts`.

## Tests
- Profile: an `openLayer` in a saved run records the object once; a debug run (`saved` false) records nothing; unknown ids are dropped by `readCollection`.
- Title: no drawer button with an empty collection; with `objects: ["chick","pager"]` the button shows and the page has exactly two cells in content order; with `endings.good = 1` the Kurogotchi cell is last; with `endings.good = 0` it is absent.
- Drawer play: opening the chick renders the device without `upgraded`, key presses change only the in-memory program (the store's event count is unchanged); reopening starts fresh.
- Walkman in the drawer: `play` asks the sound player for the theme file, `stop` pauses it; no recording `say` is ever produced.
- Kurogotchi reducer: feed lowers hunger and shows `eat` then `blink`; the 5th chat sleeps and refuses a 6th; hunger ≥ 3 gives `hungry`; days since `lastSeen` raise hunger (max 4) and produce the `missed` line with `n`; red appears only through the seed; state round-trips through the profile.
- The tentacle: with hunger 3 and 8 s idle, the scheduled presses are A… then B, and the program ends fed; with reduced motion no tentacle element is rendered but the presses still happen.
