# The character panel and the three game buttons (author 2026-11-15)

> **Superseded in part (2026-11-25):** the buttons and the panels are now `game-menu` (rune medallions, one glass menu with tabs). See `.kiro/specs/game-menu/requirements.md`.


The room's HUD gets a **人物** button beside 道具 and 设置; the three become one strip of game
buttons, each an icon with its word under it. 人物 opens the character panel: who you are, what
day it is, the three meters, what you have collected. The author's words: 「加上人物状态按钮，点击
后展示人物状态框（姓名、天数、理智、克总（几颗心表示亲密度）、同化度）。人物/道具/设置的按钮更游戏化一些。」

Strings are in `content/strings/{zh,en}.json` (Claude): `hud.status` (人物), `hud.items` (道具,
existing), `settings.button` (existing), `status.title`, `status.day` ({n}), `status.san`,
`status.kuro`, `status.assim`, `status.objects` ({n}, {total}), `status.upgraded` ({n}),
`status.chats` ({n}), `status.close`. Do not add or edit strings; a missing one is a question.

## The strip (`src/world/room/hud.ts`, `room.css`)

- Bottom-left of the room stage, where 设置 and 道具 sit today: three buttons in a row, in this
  order: **人物 · 道具 · 设置**. Each is a square tile (about 56 px) with a pixel icon on top and the
  word under it, in the HUD's paper tone; the active one (a panel open) is inverted.
- Icons: draw them inline as small SVGs in the game's pixel register (the battle mode's 8-bit look):
  人物 = a head-and-shoulders silhouette, 道具 = the carton with its flap open, 设置 = a gear. No
  emoji, no icon font. 16 × 16 grid, crisp edges (`shape-rendering: crispEdges`).
- The strip appears wherever 设置 appears today (the room views, the desktop); on the desktop the
  current placement rules of the two buttons carry over to the three.
- Actions: `status-open` / `status-close` (new, session field `statusOpen`), the existing
  `items-toggle` and `settings-open`. `status-*` goes into `GUIDE_ALLOWS` and `MASK_ALLOWS` as
  `settings-*` is (the panel may be opened while a line is up; it blocks nothing).

## The panel (`src/world/room/status.ts`, new)

A card over the stage (the settings layer's size and paper), `role="dialog"`, closed by
`status.close`, Esc, or a click outside. Contents, top to bottom:

1. **Portrait and name**: the player's portrait (`state.names.portrait` → the same picture the
   chat uses for the player) and `state.names.login`; under it `status.day` with `state.day` and
   the day's phase word the HUD already shows.
2. **理智** (`status.san`): a bar of `state.san` / 100 and the number. The bar's colour follows
   `sanBand` (the HUD's bands); below 30 the bar flickers once a second (reduced motion: no).
3. **克总** (`status.kuro`): five hearts for `state.affinity` / 100 — each heart 20; a half heart
   for the odd 10. Pixel hearts (inline SVG, the same register as the icons), empty ones outlined.
4. **同化** (`status.assim`): a bar of `state.assimilation` / `constants.assimilationMax`, drawn in
   the ending-page red; at `assimilationGoodMax` a tick mark on the bar (nothing said).
5. **老物件** (`status.objects`): `state.found.length` of the eight, then `status.upgraded` with the
   count of `state.upgraded` entries that are true — shown only when ≥ 1.
6. **`status.chats`**: the number of `chat` events in the run.

Numbers are plain; the panel explains nothing. On day 18 after the run has ended, and on the
title page, the button is absent (the title has its own things).

## Tests

- The strip renders three buttons in order with their labels; the active state.
- `status-open` / `status-close` / Esc / outside click; `statusOpen` in the session.
- The panel's numbers for a state: hearts for affinity 0 / 10 / 55 / 100; the bar widths; the
  upgraded line only when ≥ 1; the chats count.
- A snapshot of the panel (zh) for a day-5 state.
- Existing HUD snapshots refresh for the strip (content-only); say so in the log.
