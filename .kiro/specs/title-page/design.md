# title-page — design

## 1. Approach

The title page is its own small screen, mounted before the game and replaced by it. It lives in
`src/ui/`, the only place allowed to read `nt_profile` (saves.test enforces this).

- `src/ui/title/table.ts`: the strict loader of `content/title.json`.
- `src/ui/title/model.ts`: the page's state (menu / questions / settings / credits, the answers,
  the idle event, the monitors). Pure transitions.
- `src/ui/title/view.ts`: a pure view of that state. No story string: every text is
  `title.*` / `settings.*` strings, or content.
- `src/ui/title/mount.ts`: the DOM side. Clicks, inputs, keys, the idle scheduler, rain, and the
  push before the game starts.
- `src/ui/collection.ts`: reads the profile's `finishedRuns` and `endings` for the host.

`main.ts` decides:
- With a save: 继续 · 第 N 天 mounts the game on the saved run.
- Without one: 新游戏 → the questions → 开始 starts a new run, whose first event is
  `names {names}`.
- `?day=N` skips the title (debug).

The in-game room gets the collection from the host as session data (`session.collection`),
never as state: the figures and the book are presentation, and the story never reads them.

## 2. Decisions (please review)

- **T1. Names enter the run as an event.** `names {login, nick, calledBy, bossCalls, pronoun}`
  is the run's first event, checked against the variable table. `state.names` is "changed by
  the title page only", and the log keeps it replayable. The title page is the only one that
  appends it.
- **T2. The questions.** Five rows, each shown once the one above is answered:
  - the name → `login`;
  - 家里人 → `nick`;
  - 老板 → `bossCalls`;
  - 同事 → `calledBy`;
  - 她 / 他 / 不说 → `pronoun` (`she` / `he` / `null`).

  A row counts as answered when its text is non-blank, or a pronoun has been chosen (不说
  counts). 开始 is enabled only when all five are.
  - 🎲 fills a neutral value from `title.json` `dice` (optional; TODO Claude: 老大 / 老板 / 哥 /
    姐) plus the name already given. It never offers a personal name of its own; with no list
    and no name it is disabled.
  - Esc goes back to the menu, keeping the answers.
- **T3. No restart.** The title has no 新游戏 while a save exists and no restart action
  anywhere. The in-game settings panel is reused without 返回首页 (`settingsPanel(…, {home: false})`).
- **T4. Idle.** 15 s of nothing, then every 20–40 s one event from `title.json` `idle.events`,
  never two at once.
  - Each layer is a DOM node over the background (lamp, right monitor, chair, gap, rain).
  - `ms > 0` lights it for that long; `ms: 0` is a cut (the chair shifted one pixel stays
    until the next event).
  - Rain is the `rain-loop` sound, paused for `ms`.
  - Random timing is cosmetic (`Math.random`); nothing in state reads it.
- **T5. 新游戏 / 开始 / Esc.**
  - 新游戏: rain louder, both monitors wake (600 ms, a soft lit screen) and stay lit, and the
    menu gives way to the questions.
  - 开始: the background pushes in toward the desk over 1.4 s along 房间→桌子's path (around
    the desk point, ×1.6), the lamp goes off, then the game mounts on day 1 in the room.
  - Esc from the questions: the monitors sleep and the rain settles.
- **T6. Positions on the room shot** (`ROOM_SHOT`, 2048×1152 → stage), provisional until the
  assets land:
  - the chair region (for the 1 px cut);
  - the figures at the desk's left end by the window;
  - the book left of the keyboard.
- **T7. Figures and book.**
  - One figure per ending ever reached (`endings.bad / survive / good > 0`), in both the title
    room and the in-game 房间. On hover or focus each shows its name as a chip
    (`title.fig.*`); no counts, no dates.
  - The book shows in the in-game 房间 iff `finishedRuns ≥ 1`. It opens `/gamebook/` in a
    full-screen iframe with a close chip. It is never on the title.
  - A missing image still renders its node (the img fails quietly; the node has a size and a
    label).
- **T8. Profile.** `ProfileWriter.recordEnding(kind)` adds 1 to `endings[kind]` and to
  `finishedRuns`. main.ts calls it when an `ending` event is appended (once per ending, never
  on reload). The bad ending's `runs + 1` stays.
- **T9. Type.**
  - `src/ui/fonts.css` declares the four self-hosted faces (`font-display: swap`) and a
    size-adjusted fallback face per family, so a swap does not reflow the fixed dialogue box:
    - `NT Title`: Barlow Condensed 700;
    - `NT Kai`: LXGW WenKai, fallback Noto Sans SC;
    - `NT Serif`: Alegreya;
    - `NT Sans`: Alegreya Sans.
  - The fallback metrics are provisional until Claude's subset step reports the real ones.
  - Game layer only: the title, the room HUD, dialogue, settings, endings and credits. The
    desktop keeps system fonts.
  - `html[lang]` follows the locale. The title and the stage header numbers use `NT Title`.
- **T10. Language.** The app opens in English (README: "English is the default"); `?lang=zh`
  opens in Chinese. The toggle bottom-right switches at once. Tests keep the zh default.
- **T11. Not done (named).** `profiles.names` online (backend spec). The splat background and
  its drift (room-scene).

## 3. Tests (FR5)

`tests/title.test.ts`:
- Snapshots: title without a save; with a save (day 7); the questions mid-way; complete; the
  room with and without the book.
- Property: 开始 is disabled until all five are answered.
- Property: no element in any title snapshot has a restart action.
- Property: the book node exists iff `finishedRuns ≥ 1`.
- Units:
  - the strict title.json loader;
  - the `names` event;
  - the dice never invent a name;
  - figures per ending;
  - `recordEnding`;
  - the idle schedule never overlaps two events and is quiet for the first 15 s.
