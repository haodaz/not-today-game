# desktop-ui — design

## 1. Approach

The two monitors are real components. Each one is a pure function `(model) → HTML string`,
built with an auto-escaping tagged template. A thin controller in the browser mounts the result,
re-renders on store or session change, and turns clicks (`data-action` attributes, one delegated
listener) into events or session changes.

Pure functions are node-testable and snapshot-testable without a DOM, and they cannot write state.
The only DOM-imperative part is the Kuro body sprite, because crossfades need persistent nodes.

The visual language is ported from `design/desktop/design.css`: tokens and class names are kept,
the mock-only `.note` and `.stage` are removed, and the additions are marked. Every visible string
comes from `content/strings/zh.json`, falling back to `en.json`, or from content data. `src/`
holds no copy.

## 2. Decisions taken (please review)

- **U1. Beat clock stand-in.** The day engine isn't written yet, so the desktop takes a small
  `BeatClock { beat: boot|work|afternoon|desk|night; time: HH:MM }` as session state, not game
  state.
  - Default: `boot 09:03`, as in the mock. Debug params `?beat=night&t=23:41` sit beside `?day=N`.
  - When a reply's line is due later (`atBeat t`), the clock advances to `t` after a short real
    delay (`BEAT_STEP_MS`). Time therefore moves as the conversation happens.
  - The day engine replaces this.
- **U2. Two event-log amendments.**
  - `reply` gains optional `t` (the beat time it was sent), so a conversation can be rebuilt in
    order after a reload.
  - New kind `open { target: "browser" | "conv:<recipient>", t }`. Opening the browser is
    citeable (FR4). Opening a conversation increments `readCount` (the variable table says
    "changedBy: opening messages") and drives unread counts.
- **U3. Conversations are rebuilt from the log, not stored.** The view of a conversation is a pure
  function of `(state, events, day, clock)`:
  - incoming items of each day, and the player's replies with their plans;
  - interrupts land in their `where` conversation;
  - a line due after the current beat time is not there yet;
  - a `nextBoot` read receipt shows from the next day.
  - The live runtime only tracks how far each just-sent plan has played (`progress`), so typing,
    the recall delay and the read delay animate in the session. After a reload, history shows
    them settled.
- **U4. Workbench data has no content yet.** FR3 refers to `content/tasks/`, which doesn't exist.
  The workbench renders its structure from strings and its live numbers from state:
  - `overdueDays` on the ledger card and in the receivable row (`n-1 → n`), and
    `letItDoUnchecked`.
  - The per-day data comes from `content/workbench/day-NN.json` (schema in §6, proposed for
    Claude). A day without a file renders empty sections; no mock copy is transcribed into
    `src/` or `content/`.
  - Work-task actions (modes, 看一眼, 让它合并, …) are inert `data-action` hooks until the task
    trees exist.
- **U5. Changelog collapse day.** stages.json has no explicit field for it. The panel collapses
  from the first day of the second cycle (ring `screen`), which matches the mock's note
  ("第 4 天起…") and `kuro-days/day-04.md`. TODO(Claude): an explicit field.
- **U6. Ring layers.**
  - `data-ring` on each monitor drives the screen-layer CSS variables (`--tint`, `--drift-*`,
    `--blur`), stronger each ring from `screen` on.
  - On a `calmDaytime` day the day beats render as `software`; the night beat does not.
  - The room rings (desk, wall, room, door) keep the screen layer at its strongest. Their own
    layers are the room scene's.
- **U7. Kuro small window.** It renders:
  - the day's idiom (the constant from `kuro-days/day-NN.md`);
  - the 3–4 starter questions (zh column);
  - `今天 n/5` from `chatTurnsToday` / `chatTurnsPerDay`;
  - the bedtime line with the input closed once turns are used up.
  - Asking is a `data-action="kuro-ask"` hook for the kuro-chat spec; this spec does not answer.
- **U8. Kuro body states** come from a pure function with this precedence:
  rest (night) > busy (task running) > happy (player said 漂亮) > crawl (moving, ~1.6 s after the
  active app changes) > think (small window waiting) > idle.
  - Two frames per state from `public/kuro/`, alternating with an opacity crossfade, plus a slow
    bob.
  - A state change crossfades the old layer out. It never hard-cuts and never takes clicks.
- **U9. Missing strings** render as `⟦key⟧` with `data-missing`, so they are visible, and every
  one is collected. A test fails if any key outside the documented TODO list is missing.

## 3. Modules

```
src/world/
  html.ts            html`` tagged template (escapes), raw(), join()
  i18n.ts            t(key, vars) zh → en → ⟦key⟧; missing-key registry
  desktop/
    beat.ts          BeatClock, parseBeatParams(search), beat labels, greeting key
    rings.ts         desktopRing(day, beat) with calm daytime
    shell.ts         renderDesktop(model): two monitors, top bars, dock, plates, layout
    model.ts         Session, AppContext, buildShell (store state + events + session → shell model)
    apps.ts          the app renderers; actions.ts the app actions (each app module plugs in)
    controller.ts    mount(root, deps): render loop, delegated actions, body crossfade, fit/focus
    messages/
      transcript.ts  conversation rebuild (U3), previews, unread
      bubbles.ts     line text → body (voice / transcript / card / attachment / system)
      view.ts        list + conversation + reply bar
      actions.ts     conv / chip / gone / send, live plan runtime
    kuro/
      days.ts        kuro-days/day-NN.md parser (idiom, starter questions) + guard
      mini.ts        small window view
      body.ts        state precedence, frame table, sprite markup + DOM crossfade controller
    workbench/
      data.ts        content/workbench/day-NN.json loader + guard (none yet)
      view.ts        sidebar, home, 文档, 账本, 代码; actions.ts wb-nav
    browser/
      data.ts        content/browser/day-NN.json loader + guard
      view.ts
    desktop.css      ported tokens + classes
src/main.ts          store from save or ?day=N; beat params; mount
```

## 4. Layout

- The left monitor holds the dock, with 消息, 工作台 and 浏览器 plus badges. It shows the
  dock-selected app, 消息 by default.
- The right monitor shows 工作台, unless the left one does, in which case it shows 消息.
- Kuro's small window and body live on the right monitor.
- Both monitors are 1440×900, side by side, scaled to the viewport. `?focus=left|right`, or the
  key `F`, shows one monitor.

## 5. Messages

- **List:** company conversations (boss, partner, group, xiaozhang, laozhou) and family in its
  own section. Each row shows the avatar, last preview, time, and today's unread count since the
  last `open`.
- **Bubbles:**
  - `[语音] N″` renders as a voice row, and a following `（转文字）…` attaches as its transcript.
  - `[卡片] …` renders as a card, and `[图片]`/`[链接]`/`[文档]` as attachments, all as written.
  - `[撤回了一条消息]` and `[该账号已注销]` render as system lines.
  - 已读 and 正在输入 use their strings keys.
- **Reply bar:**
  - The hint `reply.hint.<recipient>` shows where it exists.
  - Chips come from `menu()`. Lent words are dashed. Gone words are struck through, and clicking
    one shows its inner line or `reply.hint.gone`.
  - A free text input appears only where the day has `free`.
  - Select a chip, then 发送. A deregistered conversation disables everything.
  - The inner line shows in italics under the bar until the next send.

## 6. Proposed `content/workbench/day-NN.json` (for Claude)

```json
{
  "day": 1,
  "doing":   [{ "title": "…", "status": "…", "tone": "warn|ok|plain" }],
  "recent":  ["…"],
  "docs":    { "tag": "v17", "count": "17", "countLabel": "…", "versions": [{ "v": "v17", "when": "…" }],
               "page": { "title": "…", "meta": "…",
                         "left":  { "h": "…", "lines": [{ "n": 5, "text": "…", "mark": "y|b|add|del" }] },
                         "right": { "h": "…", "lines": [] } } },
  "ledger":  { "cardLabel": "…", "cardLines": [{ "label": "…", "value": "…", "tone": "red|" }],
               "columns": { "receivable": ["…"], "salary": ["…"], "model": ["…"] },
               "receivable": [{ "client": "…", "due": "…", "paid": "…", "overdue": "state|…" }],
               "salary": [{ "name": "…", "due": "…", "paid": "…", "diff": "…", "me": false }],
               "model": [{ "date": "…", "calls": "…", "amount": "…" }] },
  "now":     [{ "left": "…", "right": "…" }],
  "changelog": [{ "v": "v4.2", "when": "…", "text": "…", "short": "…" }],
  "code":    { "file": "export.ts", "meta": "…", "lines": [{ "n": 11, "seg": [{ "k": "kw|c|r|", "s": "…" }] }] },
  "common":  { "tabs": ["…"], "items": [{ "tag": "…", "text": "…" }] },
  "continue": ["…"]
}
```

`"overdue": "state"` means the cell shows `overdueDays-1 → overdueDays` from the store.

## 7. Tests

- **Snapshots** for each app (messages, workbench home and inner pages, browser, Kuro window)
  plus the shell, at day 1, day 10 (calm), day 13 (ring room) and the night beat (requirements §3).
- **One fixture snapshot** for a filled workbench. The fixture lives in `tests/fixtures/`, is
  test-only, and is not content.
- **Unit tests:** escaping, i18n fallback and the missing registry, beat params, ring/calm, the
  transcript rules of U3, the bubble parsing, the reply-bar states, the kuro-days parser over all
  18 files, body-state precedence, the browser guard over all 18 files, and the new events.

## Amendment implemented (2026-10-31): the small window does not cover the desktop

- `kuroExpanded`: open in the evening chat beat (clock beat `night`), after a click
  (`kuro-expand`), or for 6 s after a new line (`session.kuroPeekUntil`); folded otherwise.
- Folded, it's a pill beside the body: its face and the start of its last line (`lastKuroLine`),
  ellipsised. The body always shows.
- A new line is noticed by the runtime after each store change (`noticeKuroLine`). The first look
  only remembers it. At 6 s it folds, unless the pointer is over it.
  - "Or the player typed": the small window has no input yet (kuro-chat), so only hover holds it.
- A click outside it, or Esc on 屏幕, folds it.
- Open over an app with an input or reply bar at the bottom (消息, 工作台), it docks top-right
  (`kmini-dock top`); over 浏览器 it stays bottom-right.
