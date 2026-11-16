# The book by the bed is this run's diary (author 2026-11-16)

The author played day 1 on the live site and opened the book: it held the whole gamebook (the
novel), day 1's story already written on day 1's morning, pages that would not turn by click, and a
right-hand column that scrolled by the screen when she pressed →. Her verdict: the book must tell
**this run** — 「要和这一天的选择、工作是否成功、克总是否替你重新干活、和克总聊过什么，这些都要能展示出来」 —
written only after the day is over, read like a book.

The model is in: `src/state/diary.ts` (Claude). `diary(state, events)` gives one page per day lived,
`diaryDays(state, events)` says how many (today counts once its `beat:shutdown` step is logged, so
on day 1's morning there is no book; at day 1's bed ask there is one page). A page is
`{ day, lines }`; a line is `{ key, args? }` where `key` is a strings key and an argument is a
string, a number, or `{ key }` (another strings key to print first). Print a line as
`t(line.key, resolvedArgs)`. The strings are all in `content/strings/{zh,en}.json` under `diary.*`
(Claude's). Do not add strings; a missing one is a question.

## 1. The book (`src/world/room/collection.ts`, `room.css`)

- `bookReader` no longer embeds `public/gamebook/index.html`. It draws a book: a full-screen dim, a
  centred open spread (two pages side by side, paper tone like the HUD, ~1180 × 760 on the 1600 × 900
  stage, a gutter shadow), the close chip top-right as now.
- **Pages** are made from the diary: each day's lines in order, the head line as a heading, the
  weather line under it in a smaller face, the rest as paragraphs (one line = one paragraph, 17 px,
  line-height 1.9). A day runs over as many pages as it needs: pack paragraphs into pages of a fixed
  height (measure with a fixed budget of about 20 lines of text per page, counting a paragraph as
  `ceil(chars / 28)` lines; no DOM measuring). A day always starts on a new left page.
- After the last written day: one page with `diary.blank` alone, then nothing. A book with no days
  does not open (the hotspot and the 看书 choices are absent, §3).
- **Turning**: a click on the right half of the spread, →, Space or PageDown turn forward; a click on
  the left half, ←, PageUp turn back; the first and last spreads do not wrap. The spread's page
  numbers sit in the outer bottom corners. Nothing scrolls: `overflow: hidden` on the pages.
- The book opens on the **last written day's first spread** (the day just lived), not on page 1.
- `session.bookOpen` stays the flag; add `session.bookSpread: number` (the spread index shown),
  reset to the last spread on open.

## 2. The names in the lines

`DiaryArg` `{ key }` values are printed with `t(key)` before the line is printed; strings and numbers
are passed as they are. Nothing else is interpolated (the line text is content).

## 3. When there is a book (`collection.ts` `shelfBook`, `dialogue.ts` bed / rise options, `game.ts`)

- The shelf book hotspot, the bed ask's 看书 and the rise ask's 看书 exist only when
  `diaryDays(state, events) ≥ 1`. On day 1's morning there is nothing on the shelf to click; at
  day 1's bed ask there is.
- The first-time line (`room.book.first`) and the after line (`room.book.after`) play as they do now
  (the strings changed to fit a diary; nothing in the flow changes). The title page's book stays the
  gamebook as it is (`title.json` `book.reader`); only the run's book is the diary.
- The `?days=` / `bookUrl` plumbing goes with the iframe; keep `daysLived` as an alias of
  `diaryDays` or replace its uses.

## Tests

- The reader's markup: the spread, the page numbers, a day's head and weather lines, the blank page
  last; a day longer than one page packs onto two; the book opens on the last day's spread.
- Turning: forward / back by click halves and keys; no wrap at either end; `bookSpread` in the
  session.
- No hotspot and no 看书 choice with zero days; both with one.
- Snapshots carrying the reader or the bed ask refresh (markup-only); say so in the log.

## Not in this spec

The diary's content and rules (`src/state/diary.ts`, Claude's); the gamebook page itself; the title
page.
