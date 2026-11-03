# title-page — requirements (rewritten 2026-11-01, author)

The launch screen is a full-screen game title, not a book cover and not a form. Reference feel: Kena / Satisfactory / MURK title screens: the world fills the screen, the menu is a short column of words laid on it. Strings in `content/strings/*` (`title.*`).

## FR1. Look
- Background: the room (`public/room/shots/room.jpg` for now; the splat with a slow camera drift once room-scene lands), darkened to about 60 %, a very slow push-in (120 s loop, ease-in-out), rain sound at low volume. No Kuro anywhere on this screen; its first sight is inside the screen on day 1.
- Title `NOT TODAY` top-left, large, wide tracking, no subtitle. Below it the menu column, left-aligned, outlined text buttons with ~2 px hairline, generous vertical spacing; hover = fill, 160 ms.
- Bottom-left small: version and the credit line `好大壮 · 与 Claude 一起写成` (only here).
- Language toggle 中文 / English bottom-right as plain text; English is the default at submission.

## FR2. Menu
- Without a save: `新游戏` · `设置` · `制作`.
- With a save: `继续 · 第 N 天` · `设置` · `制作`. **There is no `新游戏` while a save exists and no restart anywhere** (mechanic): the only ways back to day 1 are the endings. `nt_run` is cleared only by an ending; `nt_profile` always survives.
- `设置` opens the same centred panel as in-game (声音 / 语言 / 取消; no 返回首页 here). `制作` opens a plain scrolling credits page (team, tools, the new-vs-pre-existing disclosure from README) with a back button.

## FR3. 新游戏: the questions
- Clicking 新游戏 does not change screen: the menu column fades and the questions appear in its place, one line at a time, each answered before the next appears: 这是谁的故事？（名字）→ 家里人怎么称呼你？→ 老板怎么叫你？→ 同事怎么叫你？→ 她 / 他 / 不说. Each has a 🎲 that fills a neutral random value (dice list: 老大 / 老板 / 哥 / 姐 / the name). Never prefill personal names. The last button says `开始`, enabled only when every question is answered or diced. Esc goes back to the menu.
- Values go to `names` (variables.json) and to `profiles.names` when online (backend).

## FR4. The book on the desk (after one finished run)
- Once `nt_profile.finishedRuns ≥ 1` (set by any ending), the room view shows a small book on the desk, left of the keyboard (`public/room/book.png`, Claude provides; cutout like the objects). Clicking it opens the gamebook reader full-screen (an iframe of `/gamebook/` served from `public/gamebook/`, a copy of nottoday/index.html; Claude provides) with a close chip top-right. It is a gift for players who finished: the whole branching book as a second, older kind of game. It never appears on the title screen and never before the first ending.

## FR5. Tests
- Snapshot: title without save, title with save (day 7), questions mid-way, questions complete; room with and without the book.
- Property: 开始 is disabled until all answered; no element with a restart action exists in any title snapshot; the book node exists iff finishedRuns ≥ 1.

## FR6. Type (author 2026-11-01: "don't forget the fonts")
- Self-hosted, subset, in `public/fonts/` (Claude provides the files; Kiro wires `@font-face` and the subset build step is Claude's). Never system fonts for game text.
  - Title `NOT TODAY` and the stage header numbers: **Barlow Condensed 700**, tracking .12em.
  - Chinese game text (menu, dialogue, HUD chips, settings, credits): **霞鹜文楷 LXGW WenKai** (OFL), with `Noto Sans SC` as the fallback only while the subset loads.
  - English game text: **Alegreya** (OFL) for dialogue and credits, **Alegreya Sans** for chips and menus.
  - The computer UI (desktop, workbench, messages, browser) keeps system fonts on purpose: it must look like a real computer. Only the game layer gets the game fonts.
- Font swap must not reflow the fixed dialogue box: size-adjust the fallback so line heights match.

## FR7. The waiting room, and what 新游戏 does
- While the title sits idle the room is not quite still. Every 20–40 s (random) one small thing happens, one at a time, never two: the lamp dims for a frame; the right monitor wakes for 200 ms and sleeps; the chair is one pixel to the left after a cut; the gap between the monitors has a line of light for a second; the rain stops for three seconds. Each is a DOM/CSS layer over the background, from a fixed list in `content/title.json` (Claude writes; `idle: [{id, layer, ms}]`). Never on the first 15 s, so a new player sees nothing.
- Clicking 新游戏: the rain gets louder and both monitors wake and stay lit (soft glow, not the old breathing box; it is the computer turning on, 600 ms). The menu fades into the questions (FR3).
- Clicking 开始: the camera pushes in toward the desk over 1.4 s, the lamp goes off, the screen cuts to day 1 in the room view at boot. The push uses the same path as 房间→桌子.
- Esc from the questions: the monitors sleep again and the rain settles.

## FR8. Where the endings live: three figures on the desk
- Each ending the player has ever reached (`nt_profile.endings: {bad, survive, good}` counts; set by san-and-endings) puts a small figure on the left end of the desk, by the window, in the title room and in the in-game room view: bad = a small grey figure of a person with no face (「第一日，改」: the one who was replaced); survive = a small cardboard box with a shipping slip (「回到第一日」); good = the chick, standing (「第十九日」). Assets `public/room/fig_{bad,survive,good}.png` (Claude provides, cutouts). Hovering shows the ending's name as a one-word chip; nothing else, no dates, no counts.
- All three plus the book (FR4) are the whole collection. There is no achievements screen.

## Correction 2026-11-01 (author): the questions live in a card, over the desk
- Clicking 新游戏 first pushes the camera to the 桌子 framing (same path and 1.4 s as 房间→桌子; monitors wake during the push). The menu column fades out during the push.
- The questions then appear in a **card**: a centred panel like the settings panel (translucent warm grey, hairline, 8 px radius, about 560 px wide), title `这是谁的故事？` as its header, one question row at a time inside it, 🎲 beside each, `开始` as the card's only button. Nothing is written straight onto the background any more. Esc closes the card and pulls back to the room framing.
- 开始 closes the card and the day-1 room view begins from the desk framing (the lamp goes off, then the first beat). Mock: design/chrome/title-questions.html.

## Correction 2026-11-03 (Claude's 18-day walkthrough): the language is remembered

Today the locale comes only from `?lang=zh` in the URL (`src/main.ts`). A player who picks 中文 on the title page or in 设置 is back in English after any reload, after an ending (the way home is `location.assign(pathname)`, which drops the query), and when a saved run is resumed.

Rule:
- The chosen locale is stored in localStorage key `nt_lang` (`"zh"` | `"en"`) whenever it changes: title toggle `title-lang`, title settings `settings-lang`, in-game 设置 `settings-lang`.
- At start (`src/main.ts`): `?lang=` if present (and it is stored too), else `nt_lang`, else `"en"` (the submission opens in English).
- `document.documentElement.lang` follows every change (already done in game.ts; do the same on the title page).
- Storage access is wrapped in try/catch; failure falls back to the old behaviour.

Files: `src/main.ts`, `src/ui/title/mount.ts`, `src/world/room/game.ts` (`settings-lang`), one small helper (e.g. `src/world/i18n.ts`: `storedLocale(storage)`, `rememberLocale(storage, l)`), tests in `tests/title-page.test.ts` or a new `tests/locale.test.ts`.

Tests: the helper reads/writes `nt_lang`; URL beats storage; storage beats the default; an unknown stored value is ignored; storage that throws falls back to `"en"`; the title toggle and both settings rows store the new value.
