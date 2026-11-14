# The devices play (author 2026-11-13): 猜数字 on the calculator, Wordle on the 文曲星

Two of the old things are consoles in their own right. First step: make them playable from the
title page's 老物件 panel (`objbar`), as the device itself — the drawn keys, the device's own screen,
nothing drawn over a photo (objects-as-game-ui). Later a day's lock or task may call the same
engines (that is a separate spec); so the engines are pure and the device programs expose a
game mode, nothing else knows about it yet.

## 1. The calculator: 猜数字 (Bulls and Cows, 1A2B)

- Secret: 4 distinct digits, the first may be 0. Seeded from the run / profile seed as the other
  dice are, so a reload keeps the same secret within one game.
- A guess: 4 distinct digits typed on the keys; `=` submits. Fewer than 4, or a repeated digit:
  the display blinks once, nothing else.
- Feedback on the 8-segment display, in the display's own glyphs: `nAmB` — `n` digits right and in
  place, `m` right but elsewhere (A and b are drawable on seven segments; use the calculator's
  existing glyph table and add A / b if missing). The next key press clears it for the next guess.
- 8 guesses. `4A0B` wins: the display shows the secret and blinks three times. The 8th wrong guess:
  the display shows the secret steady; `C` starts a new game.
- Entering the mode: from the objbar card's 「玩一局」 chip (strings below); inside the device the
  mode is marked only by the display showing `----` at the start. `C` held (or pressed twice when the
  display is empty) leaves the mode. The normal calculator (and the upside-down reading) is untouched
  outside the mode.
- Engine `src/world/objects/games/bulls.ts`: `newBulls(seed)`, `guessBulls(state, digits)` →
  `{ state, a, b, won, over }`; pure, no DOM.

## 2. The 文曲星: Wordle

- Answers: `content/wordle.json` → `{ "answers": [...] }` (Claude's file, five-letter words, lower
  case; already there). A guess is any five letters (not checked against a list).
- 6 tries. Letters typed on the device's own keys; `lookup` (the 查 key) submits; `back` deletes.
- The dot-matrix screen shows the 6×5 grid; each judged letter sits on a cell: filled (right place),
  half-tone / outlined (in the word, elsewhere), plain (not in the word) — the LCD has no colour.
  Below the grid, the keys already judged are marked the same way in a one-line strip (the
  letters used so far), so the player can see what is ruled out.
- Win: the grid stays, the device's little speaker beep (the dictionary's existing sfx) twice.
  Lose: the answer scrolls once across the bottom line. `power` or `back` held leaves the mode.
- The answer of the day: pick by the profile's day count / seed, not random per open, so a lost
  game cannot be reopened for the same word twice in a row.
- Engine `src/world/objects/games/wordle.ts`: `newWordle(answer)`, `guessWordle(state, word)` →
  `{ state, marks: ("hit"|"near"|"miss")[], won, over }`; the standard duplicate-letter rule.

## Where it is reached (`src/ui/title/*`, `src/world/objects/*`)

- The 老物件 panel on the title page: the calculator's and the dictionary's cards get a chip
  `objbar.play` (玩一局) under their 打开 chip, shown only when the object is in the profile's
  collection (as the cards themselves are). It opens the device in game mode.
- In a run, nothing yet: the devices behave as today. (The engines are what a later lock will use.)
- Strings (Claude, already in `content/strings/{zh,en}.json`): `objbar.play`, `game.bulls.name`
  (猜数字), `game.wordle.name` (Wordle). The devices show no other text — their screens speak.

## Tests

- Engines: feedback for known pairs (1234 vs 1243 → 2A2B; 0123 vs 3210 → 0A4B), win / over
  after 8 or 6, duplicate-letter marks (e.g. answer "apple", guess "pulpy"), rejected inputs.
- Device programs: the mode's display after a guess, `----` at the start, leaving the mode restores
  the normal program; the dictionary grid cells after two guesses.
- The title panel: the chip only on those two cards, only when collected; a snapshot of the
  calculator in game mode.
