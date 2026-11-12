# The old work folder — requirements

An easter egg (author 2026-11-12). The 文件 app (`src/world/desktop/files/`, state in
`src/state/files.ts`, content `content/files.json`) gets one more folder, **旧工作** — design drafts
of Kuro as a plain Labrador, from before the game. The player opens one of its pictures once: the
screen goes black for a beat, and when it comes back the Files window is closed and the folder is
gone for the rest of the run. Nothing is said about it, ever — no line, no toast, no log entry the
player can see.

Content is Claude's and is already there: `content/files-egg.json` (the folder, its five image
files, their `src` under `public/egg/labrador/`). Do not edit `content/`; if a fixture is easier for
a test, build one in the test. Do not run git. Shell: `npx tsc --noEmit -p . 2>&1 | tail -20` and
`npx vitest run 2>&1 | tail -20` only, never more than twice in a row. Report per item with the files
touched and any snapshot that changed for another reason.

## 1. The folder and its image body

- `src/state/files.ts`: import `content/files-egg.json` beside `content/files.json`, parse its
  `folder` with the same strictness (`keys`, `str`, `fail` as the other folders): `id`, `name`,
  `from` (the day it first appears), `files[]` each with `id`, `name`, `date`, `body`. Add the body
  kind `{ kind: "image"; src: string }` to `FileBody` (allowed only in this folder — fail if it shows
  up in `files.json`). Expose it as `filesData.egg: Folder` (not inside `folders`, so nothing that
  iterates the three folders changes).
- `src/world/desktop/files/view.ts`: the folder is listed last in the left column, after 导出 and
  before 回收站, with the same look, **only while it is still there** (item 2). Its files list like
  any folder's (name, date). An opened image body renders `<figure class="file-image"><img
  src="…" alt=""></figure>` in the body pane, the picture fit inside (`object-fit: contain`, the
  pane's full height, a dark neutral ground `#1d2129` behind it). No caption.

## 2. Opening one: the black beat, then gone

- Opening any file of this folder goes through the existing `file-open` action
  (`src/world/desktop/files/actions.ts`), which already logs `{ kind: "open", target: "file:<id>" }`.
  That log is the only state: the folder is **gone** once any `open` event targets one of its file
  ids (a pure helper `eggGone(events): boolean` in `src/state/files.ts`, next to the listing
  helpers; no new event kind, no flag).
- The beat: on that first open the action also sets `session.eggFlashAt = nowMs` (add the field to
  `Session` in `src/world/desktop/model.ts`, default `null`). While `nowMs - eggFlashAt < 900`, the
  desktop renders a full-screen black overlay `<div class="egg-flash">` above everything
  (`position: fixed; inset: 0; z-index: 95; background: #000` — above the taboo flash's 90; style in
  `src/world/room/room.css` next to `.taboo-flash`). The picture itself is shown for the first ~250 ms
  before the black (so the player sees it once): render the image for `nowMs - eggFlashAt < 250`,
  then the black until 900, then nothing. With `session.reducedMotion` the black lasts 300 ms.
- When the overlay ends the Files window is closed (`session` as `files-close` leaves it) and the
  folder is not listed. Reopening 文件 shows the three folders and the bin only. A reload of the run
  keeps it gone (the `open` event is in the log).
- Never on a day before `from`; never twice; nothing in the bin.

## 3. Tests

`tests/files-egg.test.ts` with `tests/specimen.ts`: (a) the folder is listed from its `from` day,
last before the bin, and its image file renders the `figure.file-image` with the content's `src`;
(b) `file-open` on it logs the open, sets `eggFlashAt`, the overlay shows black between 250 and
900 ms and not after; (c) after that the folder is not listed and `eggGone` is true; a second
`file-open` on its id does nothing new. Keep `tests/files-app.test.ts` green.

## 4. Out of scope

No lines, no strings, no changes under `content/`, no change to `src/state/events.ts`.
