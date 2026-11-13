# The book by the bed (author 2026-11-13)

The gamebook — the interactive novel this game grew from — now ships inside the game at
`public/gamebook/index.html` (assembled with external pictures; the assembler lives in the
holloween repo, not here). In the game it is **a book on the headboard shelf**, there from day 1,
read lying in bed: before sleeping and before getting up. The author's rules, in her words:

- 每天睡前可以有一个选项，看书。躺着不用只看天花板了。形容就是：你拿起了床头的书。
- 第一次拿的话，玩家说了一句：not today……什么奇怪的作者才会起这样奇怪的名字。然后展开书的页面。
- 不再问这是谁的书，名字已经都被填好。
- 起床前也可以看书。
- 过完一天才有一天的书：第 n 天打不开第 n+1 天。书上说：今天的故事就到这里了，后面是空白的。
- 书有选项分支，几次游戏把选项都打完了，书上能体验的剧情也变多（the book keeps its own save).
- 第一次看完合上书，玩家嘀咕一句：虽然名字很奇怪，剧情还挺真实的。

All text is in `content/strings/{zh,en}.json` already (Claude): `room.book` (the hotspot's label,
床头的书), `room.book.read` (看书, the choice), `room.book.take` (你拿起了床头的书。), `room.book.first`
(the player's line the first time), `room.book.after` (the mutter after the first close). Do not add
or edit strings; a missing one is a question for Claude.

## What the book page takes (already built into `public/gamebook/index.html`)

Open it as `/gamebook/index.html?` + these query parameters (URL-encoded):

| param | from | meaning |
|---|---|---|
| `name` | `state.names.login` | fills 这是谁的故事 and skips the gate (the book no longer asks) |
| `nick` | `state.names.nick` | 小名 |
| `call` | `state.names.calledBy` | 下属、同事怎么称呼 |
| `boss` | `state.names.bossCalls` | 老板怎么叫 |
| `ta` | `state.names.pronoun`: `"she"` → `她`, `"he"` → `他`, `null` → `他` | 别人说起的时候 |
| `days` | the days lived (below) | day `days + 1` and later open as the blank page |
| `embed` | `1` | hides the book's own hint card |

Empty name fields are not sent (the book keeps its defaults). The book saves its own progress in
the browser (`localStorage` keys `nt_*`), separate from the game's — that is wanted: every run adds
to what the book can tell.

**Days lived** = `state.day` once today's shutdown beat has happened (`beat:shutdown` step in today's
events), else `state.day - 1`. So on day 1's night the player lies down with a book whose first
page is blank (the day is not over until they sleep — the day's story appears the next morning);
before getting up on day 2, day 1 is there. On the title page (no run): `days` is 18 when
`profile.finishedRuns ≥ 1`, else 0.

## The hotspot (`src/world/room/collection.ts`, `src/world/room/shots.ts`, `src/world/room/hud.ts`)

- Replace `deskBook` (the book on the desk, gated on a finished run) with the **shelf book**: a
  button over the stack of two books lying on the headboard shelf in the `room` view, rect
  `ROOM_COLLECTION.book = { l: 1120, t: 500, w: 200, h: 50 }` (stage px; the room shot is 2048 wide,
  stage is 1600: the stack sits at 1430–1690 × 640–700 in the photo). No drawn image over the photo:
  the stack is the book. The usual hover affordance of the room's hotspots (a label `room.book`),
  nothing else.
- There from day 1, in the run and on the title page; the title page keeps the same rect (the
  title's room is the same shot).
- Clicking it = the `read` path below (the take line, the first-time line, the reader), standing.
- Remove `/room/book.png`'s use (`title.json` `book.src` may go; `book.reader` becomes
  `/gamebook/index.html`). Ask Claude before deleting the file.

## The choices (`src/world/loop/dialogue.ts`, `src/world/room/game.ts`)

- `bedAsk`: `BED_OPTIONS` gains a third choice `read` (label `room.book.read`) after 睡 / 再待会儿;
  `BED_RECORD_OPTIONS` the same, after its own.
- `riseAsk`: gains `read` after 起 / 再躺会儿.
- Picking `read`, or clicking the shelf book:
  1. the box finishes; a one-line inner fragment `room.book.take` plays;
  2. **first time in this profile**: then the player's own line `room.book.first` (speaker `me`);
  3. the reader opens (`session.bookOpen = true`) with the URL above, over the current view
     (lying: over the ceiling; standing: over the room).
- Closing the reader (`book-close`, Esc): if it was the first time, the player's line
  `room.book.after` plays as a one-line fragment; then, when the read came from a bed ask, the same
  ask is pushed again (the player is still lying there and chooses again); from the rise ask, the
  rise ask again; from the hotspot, nothing more.
- "First time" is per profile: a boolean in the profile (`src/state/saves.ts`, the collection in
  `src/world/desktop/model.ts` / `src/ui/title/*`), set when the reader first opens; it survives
  runs. A guest profile behaves the same for its session.

## Keep

- `.book-reader` (full-screen iframe + close chip) stays as it is; only its `src` changes.
- The replay driver (`script/tools/auto-day-shoot.mjs`) picks 睡 / 起 by text; a third chip must
  not change their order.
- `GUIDE_ALLOWS` already lists `book-close`; add the new action names the same way.

## Tests

- `BED_OPTIONS` / `BED_RECORD_OPTIONS` / rise options end with `read`; their labels.
- The reader URL for a state with names and pronoun, for days lived at night and at morning, on
  the title page with and without a finished run; empty fields omitted.
- The first-time path: take line → first line → reader open; the profile flag set; second time no
  first line; the after line once, on the first close; the bed ask re-pushed after a bed read.
- The shelf book renders from day 1 (room view, title room); `desk-book` is gone.
- Snapshots that carried the desk book refresh (content-only).

## Not in this spec
The book's own page (the assembler is Claude's, in the holloween repo); the gamebook's text.
