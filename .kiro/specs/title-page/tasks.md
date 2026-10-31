# title-page — tasks

- [x] 1. `content/title.json` strict loader (`src/ui/title/table.ts`), with an optional `dice` list.
- [x] 2. `names` event (T1); `ProfileWriter.recordEnding` (T8) and the host call on `ending`.
- [x] 3. Title model and view: menu with / without a save, settings (no 返回首页), credits
  page, the questions with 🎲 and 开始 (T2, T3).
- [x] 4. Mount: clicks, inputs, keys, idle events (T4), rain, 新游戏 / 开始 / Esc (T5), language.
- [x] 5. main.ts: title first; continue / new run; `?day=N` skips it; English by default (T10).
- [x] 6. Figures and book in the in-game 房间 from `session.collection`; the reader overlay (T7).
- [x] 7. Fonts (T9): `src/ui/fonts.css`; the game layer only.
- [x] 8. Tests (FR5): `tests/title.test.ts`; saves and events tests updated.
- [ ] 9. TODO(Claude), content:
  - strings `title.q.login`, `title.q.nick`, `title.q.bossCalls`, `title.q.calledBy`,
    `title.q.pronoun`, `title.pronoun.she` / `.he` / `.none`, `title.dice`, `title.esc`,
    `title.byline`, `title.creditsPage.team` / `.tools` / `.disclosure`;
  - `content/title.json` `dice`;
  - the font files and the subset metrics;
  - `fig_*.png`, `book.png`, `public/gamebook/`.
- [ ] 10. `profiles.names` online (backend spec); the splat background and its drift (room-scene).
