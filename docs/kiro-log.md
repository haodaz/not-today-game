# Kiro log

Appended after each task. Neither Kiro nor Claude edits the other's area without a note here.

## world-state

- `content/variables.json` and `content/stages.json` are Claude's. Code under `src/` only reads
  them. Kiro does not create, overwrite or reformat either file.
- All engine constants come from `constants` in `variables.json`. None is written as a literal
  in `src/`.
- `day` is a save counter, +1 on the `lieDown` event. No wall-clock time, no demo mode, no
  `CLOCK_OVERRIDE` (decision 2026-10-30).
- 2026-10-31 07:36 · world-state task 11: FC_RUNS=5000 vitest run → 13 files, 210 tests passed in 0.8 s (stage(day) monotonic, replay idempotent + prefix-monotonic, overdueDays 1..lastDay, day counter). Run by Claude; Kiro's last attempt returned no output.

## replies

- `content/replies/` and `content/strings/` are Claude's. `src/state/replies/table.ts` reads,
  checks and freezes the 18 day files and `family.json`; no string is rewritten. The schema guard
  is strict (unknown keys, statuses, placeholders, times, readAfter all fail at import), so a new
  content feature is noticed instead of ignored.
- world-state amendment: `reply` events gain optional `recipient` and `text`. The loan reducer
  only reacts to recipient-less replies, so saying `no` in a conversation on day 5 no longer
  refuses the loan (D1). `derive` now also adds the flags of every incoming message for days
  1..day (incoming effects may only be flags, so this stays idempotent).
- Decisions waiting on the author (all in `.kiro/specs/replies/design.md` §2):
  - D3 object words are one use, globally, per FR1. That leaves most lent-word cells
    unreachable (e.g. `no` has 70 cells, only the first one sent ever plays). Please confirm or
    say "per day" / "per recipient".
  - D4 `cond_show: {has: "lent"}` holds for loan `lent` and `repaid`; a failed condition on an
    entry plays the neutral "read, no reply".
- TODO(Claude), content suggestions so code can drop two hardcoded markers:
  - a structured "account deregistered" field (code now keys off flags `xz_left`, `lz_gone`);
  - a structured placement for the day-15 family message (code now keys off `family_in_input`).
- Strings: every chip in all 19 tables has a label in `zh.json` (the family keys were added
  before this spec started). No string TODO.
- Timing constants (typing 4–8 s, recall 2–5 s) are named constants in
  `src/world/replies/plan.ts`; they come from the replies spec, not `variables.json`. Claude may
  move them into `constants` if they should be tunable as content.

## replies (revision 2026-10-31)

- Lent words follow the author's decision: available every day to every recipient while the
  object is held; `objectWords[x].used` only records the first use; struck through (reason
  `lost`) once the object is lost to the hand, or when the day's table marks it `gone`.
- Held / lost lives in `src/state/objects.ts`, shared with delivery. Because a lent word now
  plays repeatedly, its entry's `effects` apply each time it is sent; desktop-ui should offer
  each chip once per conversation per day.

## delivery

- `content/delivery.json` is Claude's; `src/state/delivery/table.ts` reads, checks (strictly) and
  freezes it. Nothing is rewritten; receipts with a chosen item are composed for display only.
- world-state amendment: three event kinds, `order {meal, shopId, itemId, t}`, `pickup {meal}`,
  `useItem {itemId, objectId}`. Orders and pickups stay in the event log; `State` only gets flags
  (the variable table has no field for orders).
  TODO(Claude): add a variable if orders should be state.
- `derive` also adds the flags of meals that never arrive (day 16 `no_delivery`, day 18
  `slip_ready`) from that day's morning.
- Reading needed from the author or the night-hand spec: `raids[night].blockedWith` is taken to
  be the object handed to the hand (lost). Day 17's `objects_returned` pickup brings back
  everything handed over on earlier nights, in night order. Nothing writes `raids` yet, so in real
  play nothing is lost and the day-17 bag is empty until the night-hand spec lands.
- Shop drift is read as cumulative from each ring on (the note says 起). The day-10 calm daytime
  shows the list undrifted.
- TODO(Claude), strings and content:
  - `delivery.shop.closed` (closed-shop label) is not in `zh.json`;
  - the typo drift swaps two adjacent characters of one shop name; authored typo names would
    replace this.

## desktop-ui

- The desktop is real components: pure `(model) → HTML` views (auto-escaping template), one
  controller that mounts, re-renders and turns `data-action` clicks into events or session
  changes. `npm run dev` shows day 1; `?day=N` jumps (never touches saves); `?beat=night&t=23:41`
  sets the stand-in beat clock; `?focus=left|right` or key F shows one monitor; `?lang=en`.
- `src/world/desktop/desktop.css` is the mock's `design.css` with tokens and classes kept, the
  mock-only `.note` removed, additions marked at the end.
- world-state amendment: `reply` takes an optional beat time `t`; new event kind
  `open {target: browser | conv:<recipient>, t}` (opening a conversation increments `readCount`;
  opening the browser is citeable).
- Decisions waiting on the author (design.md §2): U1 the beat clock is a stand-in until the day
  engine (lines due later move it forward); U3 conversations are rebuilt from the log; U5 the
  changelog collapses from the first day of the second ring; U6 ring layer values; U8 Kuro's
  body precedence and frame table.
- TODO(Claude), content:
  - `content/workbench/day-NN.json` (schema proposed in desktop-ui design §6). None exist, so the
    workbench shows its structure, the store's numbers and empty sections; no mock copy was
    transcribed into `src/` or `content/`.
  - `content/tasks/` (work-task trees): the workbench modes and buttons are inert hooks until then.
  - strings `wb.now.letItDo` ("让它做而没看一眼 · {n} 次" in the mock) and `wb.now.count`; they
    render as ⟦key⟧ and are the only keys missing on any day (a test enforces the list).
  - optional `msgs.<conversation>.av` avatar letters (now: first character of the name).
  - 朋友圈 has no content; it is a label only.
  - an explicit changelog-collapse day in stages.json would replace U5.
- The Kuro small window renders the day's idiom, starters, turns and the bedtime line;
  answering is the kuro-chat spec's (`data-action="kuro-ask"` hook, unhandled).
- Delivery: shops now carry authored `typo` names (Claude, 2026-10-31); the typo drift uses them.
  The day-1 receipt text changed in content; its delivery snapshot was updated accordingly.

## day-loop (2026-11-01)

- `content/days/` is Claude's; `src/state/days/table.ts` reads, checks strictly (keys, line kinds,
  condition tokens, item references, choice effects) and freezes it.
- world-state amendment: three event kinds. `step {name, t}` records loop moments; `choose
  {beat, index}` applies a choice's effects (flags, san, item_dream → `dream`; `item_lost` is
  logged only); `task {flag, mode}` sets a work-task flag (stand-in for `content/tasks/`).
- `event:loan:decided` (day 5) is supported: the item opens a two-choice prompt that appends the
  recipient-less `reply` (lend / no) world-state already uses for the loan.
- Desktop amendment applied: one monitor at a time, 左屏 / 右屏 toggle, ← →, the other monitor as
  a thin tab with its badges, Kuro's small window on the shown monitor, 房间 chip / Esc back.
- Decisions waiting on the author (day-loop design §2): L2 the workbench ask box completes the
  open work task until task trees exist; L5 arrival timing; L6 the loop drives the stand-in beat
  clock (times from the mocks); L7 heart-rate chip from day 9 and its bpm formula; L9 desk bar.
- Content question for Claude: day 18's `reply` unlocks on `done:task1`, whose flag `slip_filled`
  is also what the shutdown choice "填寄件单" sets. Today the stand-in can set it from the
  workbench, so the day is finishable, but the good ending is "do not fill the slip".
- TODO(Claude), strings: `hud.today` 今日, `hud.done` 已做 {n} 件, `hud.overdue` 拖欠 {n} 天,
  `hud.hr` {bpm} bpm, `hud.cam.room` 房间, `hud.cam.desk` 桌面, `hud.cam.door` 门,
  `hud.menu.sound` 声音, `hud.menu.lang` 语言, `hud.menu.restart` 重新开始, `hud.phone` 手机,
  `hud.box.left` 剩 {n} 层, `loop.loan.lend` (the lend choice), `desktop.screen.left` 左屏,
  `desktop.screen.right` 右屏. Suggested values are the mocks'.
- TODO, assets: `public/room/shots/desk_close.jpg` does not exist; the room falls back to
  `design/hud/bg_desk.jpg` (dev only). `public/sfx/` does not exist; sounds are silent (FR3).
- TODO(Claude), optional: `stages.json heartRateFromDay`.

## 2026-10-31 — task trees, `lost`, object-upgrade

- Task trees: `content/tasks/day-NN.json` replace the workbench stand-in (day-loop design L2
  updated). The ask box and three modes append `task {flag, mode}`. The reducer applies the
  path's flags / san / `letItDoUnchecked`; `say` lines go to the dialogue box (also over the
  desktop), `kuro` lines to the small window. New mode `auto` for self-ticking items.
- Edit in Claude's area, at the author's request: `content/variables.json` gains `lost`
  (`set<string>`, default `[]`), with a note in its `note` field. `item_lost` choices ("loan" or
  an object id) add to it; the day-17 pickup with `objects_returned` empties it. Lost objects
  leave the desk bar and can't be held. Raids unchanged. `types.gen.ts` was edited by hand to
  match; the generator test confirms it.
- object-upgrade spec: design.md and tasks.md written. Decisions U1–U5 (offer schedule, one nag,
  day-13 final covering all open objects, after-final rule, judgement clamp to -10..10 with
  evidence ids `upgrade:<obj>` / `declineUpgrade:<obj>`, hi-res desk-bar icon as the only tell).
- TODO(Claude), content: day 18 mismatch. `content/tasks/day-18.json` has task `task1` with done
  `task_d18_1`; `content/days/day-18.json` has item `slip` with done `flag:slip_filled`, and
  `reply` unlocks on `done:task1`. As it stands the slip item ticks only via the "let" path
  (which sets `slip_filled`) and the good ending is "do not fill the slip". tests/tasks.test.ts
  lists day 18 as a known gap until content settles it.
- TODO(Claude), content: the child's "corrected" text on an upgraded object (pager 0.7734 → 你好,
  tape half-sentence completed) has no field yet.
- TODO, later specs: hi-res device screens / `gain` outputs (device specs); upgraded objects
  can't block for the good ending (san-and-endings).
- Tests: 38 files, 556 passing; typecheck clean. Browser not checked.

## 2026-10-31 — polish (motion)

- Spec `polish`: requirements, design (P1–P10) and tasks, from design/hud/motion.md and the mocks
  held.html, held-object.html and door.html. This is feel only: no state, event or content
  changes.
- Motion is a DOM layer around each render (`src/world/motion/dom.ts`):
  - entries are keyed from session and state and continue across renders via negative delays;
  - what leaves becomes an inert "ghost" playing its exit.
- Timings live in one place (`timing.ts`, written to CSS variables). `CHOSEN` lists the values
  motion.md doesn't give.
- Snapshot change: one. Desk-bar object slots are now `<button data-action="loop-hold">`, so they
  can be clicked and reached by keyboard (P9). Everything else is unchanged.
- Fixed on the way:
  - The door view was shown as escaped markup text.
  - The sixth door step (bag on the desk corner) was never shown (W1).
  - Kuro's bob and the night glow restarted on every re-render.
- TODO(Claude), strings: `hud.putDown` (suggested 点屏幕外面放下, from the held.html mock; used as
  the hint and the dim layer's label). Until then it shows as missing.
- Not done, waiting on other specs:
  - object keys (1px press, the click sound);
  - holding an object up to the gap at night;
  - the desk bar folding away at shutdown;
  - Kuro going busy → think before a small-window line;
  - the corridor light following the ring.
- Provisional: device channels other than the chick's 32×16, and where each screen sits on its
  shell (`room/held.ts`). Also the room's monitor point for the camera (`ROOM_MONITOR`).
- Known: at the door, a queued dialogue box sits over the door-beat text (same place, as in the
  mock).
- Tests: 39 files, 573 passing; typecheck clean. Not checked in a browser.

## 2026-10-31 — night-hand

- Spec `night-hand`: design (N1–N7) and tasks written; implemented in `src/state/nights.ts`, the
  `choose` reducer, the runtime (the hand's line) and the room (dim + gap glow).
- Raid nights come from content: shutdown beats with choices (5, 7, 9, 10, 13, 16, 18). What the
  hand wants is `content/nights.json`, read strictly. It stays a separate file; it's not folded
  into the day files.
- Edit in Claude's area: `content/variables.json` `raids` is now
  `{blockedWith: object|null, gave: string|null}` (was `{taken, blockedWith}`), with a note.
  `types.gen.ts` was edited by hand to match; the generator test confirms it.
- Behaviour changes:
  - Dream state lasts one night (`until: night + 1`). `dreamDays` is the dream-night count.
  - A hold-up choice is offered only for a found, recognised, not-upgraded, not-lost object.
  - The day-17 bag brings back objects; the loan row stays lost.
  - Four older tests were updated to the new rules.
- Open, for the author:
  - **N3.** Day 18's choices hold nothing up, so "every raid night has blockedWith" can never
    hold. `blockedEveryRaid` counts the blockable nights (all but 18). Confirm.
  - Nothing appends `recognise` yet (recognize spec), so no block is offered in real play
    until then.
  - "On days 9 and 18 the hand takes something else": no content field says what; stored as
    nothing given. TODO(Claude) if wanted.
  - The motion.md hold-up-to-the-gap push is still open.
- Tests: 40 files, 585 passing; typecheck clean. Not checked in a browser.

## 2026-10-31 — recognise, night takes

- Spec `recognise`: design (R1–R7) and tasks written and implemented.
  - On an object's box day the question comes right after the box beat. Three options appear in
    a per-run order, and the answer's lines play.
  - A wrong answer can be tried again on a later day by picking the object up (once a day).
  - An unrecognised object is desaturated on the desk bar.
  - A right answer is truth +1 evidence (`recognise:<object>`).
- The `recognise` event now carries `option` (content index); the reducer derives right / wrong
  (R1). The plain world-state form (no option) still recognises.
- New: a run id. `store.getRunId()`, `runId` in the run save (version 2; v1 saves migrate to
  `run-legacy`); new runs use `crypto.randomUUID()`. It only seeds per-run orders.
- Moved: the judgement writer to `src/state/judgement.ts` (shared with upgrades), and the seeded
  hash to `src/state/seed.ts` (`world/replies/seed.ts` re-exports `jitter`).
- Night-hand: `content/nights-takes.json` is read in `nights.ts`. On nights 9 and 18 "nothing
  given" sets the flag and plays the line. Night 9's heart-rate chip keeps its pulse and loses
  its number.
- Content changed while I worked (Claude): `content/delivery.json` gained `sprites` and
  per-item `sprite`. The strict delivery loader rejected them and stopped every delivery test,
  so it now reads both (`deliveryTable.sprites`, `Item.sprite`). Nothing draws them yet.
- Open, for the author:
  - **R6.** Day 18's two choices both hold nothing up, so either one ("填寄件单" too) sets
    `hand_taken` and plays 「它握住了。你没有抽回来。」. Confirm, or say which choice is the
    "nothing".
  - The textbook and the phone are asked (objects.json has them) but aren't in
    `recognised.of`, so they never count. Their right answer is known from the log only (R3).
- Tests: 41 files, 603 passing; typecheck clean. Not checked in a browser.

## 2026-10-31 — six fixes (no new spec)

1. The phone is held straight (`PHONE_TILT_DEG = 0`, `--m-phone-tilt`); objects keep −3°.
2. The phone always shows the shop list. Outside an ordering window every shop is greyed with
   the next window's time (`nextWindow`); there's no blank screen.
3. The bottom-left row is now one ⚙ 设置 button and a centred panel: 声音 switch, 语言
   中文 · English (instant), 返回首页, 取消. `loop-restart` and `loop-lang` are removed;
   nothing restarts the run.
   - 返回首页 reopens the game on the saved run until the title page exists.
   - The `hud.menu.*` keys are now unused. TODO(Claude): they and the zh `_todo` can go.
4. Kuro's small window is folded to a pill beside its body by default.
   - It opens on click, for 6 s on a new line (held while hovered), and stays open in the
     evening chat beat.
   - Over 消息 / 工作台 it docks top-right.
   - The 13 desktop snapshots changed: day renders show the pill; night renders wrap the window
     in `kmini-dock`.
5. Four camera levels: 房间 / 桌子 / 屏幕 / 门.
   - Click areas and camera points are measured on the new 2048×1152 room.jpg and desk_close.jpg
     (`src/world/room/shots.ts`).
   - The desk bar shows at 桌子 only.
   - The glowing right monitor calls Kuro's window as an overlay from 房间 / 桌子.
   - Esc steps out one level.
   - Tests that read the desk bar now render 桌子.
6. Night 18's take only for 「不填。握住它。」.
   - Edit in Claude's area: `content/nights-takes.json` gains `"requiresFlag": "shook_hand"` on
     night 18, with a note in its `_note`.
   - The loader accepts `requiresFlag` and checks that a "nothing" choice of that night sets it.
- Not done (named):
  - The evening chat beat doesn't open the call overlay by itself; the player clicks the glow.
  - The settings panel's language switch only changes UI strings: the day files and other
    content are Chinese only.
- Tests: 42 files, 621 passing; typecheck clean. Not checked in a browser.

## 2026-10-31 — Kuro button correction; san-and-endings

- Correction (day-loop): Kuro's animated body is the call button at the HUD's bottom right, in
  every view, left of the camera chips, with an unread dot.
  - Clicking it opens the chat overlay rising from it (320 ms); clicking again or Esc closes.
  - The evening chat beat opens it by itself, once a day, when the box is empty.
  - The monitor glow is mood only (`.kuro-mood`, not a control).
  - On 屏幕 the monitor draws no body any more; the pill and window shift left of it.
  - The room.jpg measurements in `room/shots.ts` are the ones taken on the 2048×1152 image; the
    camera push reads them.
  - Snapshots: 13 desktop, 2 room HUD, 1 desk bar.
- Spec `san-and-endings`: design (E1–E8) and tasks written and implemented.
  - The run ends with one `ending` event (bad / survive / good) that sets `state.ending`. After it
    the reducer takes nothing.
  - Bad is appended at the shutdown beat once SAN is 0. Survive or good replace the last night's
    lie-down (bad if SAN reached 0 after the last shutdown, E7).
  - Good needs all five conditions.
  - 你和你 is built from the log: each day's first family message, answered 好。 on time, plus the
    unchecked tasks' titles as messages you sent.
  - The credits are the stored evidence in day order, with the direction read from the content
    that wrote each entry; one line per 1.6 s, a click to the end, never skipped.
  - After the credits: bad goes home (run cleared, profile `runs` + 1); survive shows 第一日, then
    a new run; good shows day 19 (the door, still, one line).
  - The bpm comes from constants (72 → 110). SAN bands drive the cup, a side vignette and grain.
- Edit in Claude's area: `content/variables.json` gains `ending` (enum none|bad|survive|good),
  with a note. `types.gen.ts` was edited by hand to match; the generator test confirms it.
- New: `ProfileWriter.increment(key)` (reads and writes inside saves.ts, returns nothing).
- TODO(Claude), strings (they show as ⟦missing⟧ until written):
  - `ending.next`, `ending.youAndYou` (你和你), `ending.firstDay` (第一日), `ending.day19`;
  - `credits.dim.truth`, `credits.dim.values`, `credits.dim.bond`;
  - `credits.last.bad`, `credits.last.survive`, `credits.last.good` (good's is the final
    red/blue line).
- Not done (named):
  - The title page (`endingHost` reopens the game for now).
  - The door handle turning on day 19 (room-scene).
  - The credits get no direction from chat-rubric evidence until that source exists (`deltaOf`).
- Tests: 43 files, 642 passing; typecheck clean. Not checked in a browser.

## 2026-10-31 — two fixes: ghosting, the monitor glow

1. Ghosting (motion layer).
   - Every element the motion layer touches has a key (`motionKey`). A ghost only plays while
     nothing live has its key, and of two ghosts with the same key the newer wins. So an element
     that changes state replaces its old version at once; only one that truly leaves keeps its
     exit.
   - Checklist lines are keyed by item id (every line now has `data-id`), so a rewritten line is
     the same line.
   - Held phone → object, choices → choices and the like are replaced at once.
   - Shutdown darkens the monitor and tab in place (`m-power-off`) instead of a ghost copy on top.
   - Camera moves keep exactly one backdrop:
     - a picture-only copy of a stage (`m-backdrop`) carries the move, behind the arriving
       stage, which hides its own picture (`m-nobg`) until the move ends;
     - the HUD is replaced at once;
     - pushing in, the old photo zooms then cuts to the new framing; pulling out, the new photo
       starts zoomed and settles;
     - 屏幕 shrinks into, or grows out of, its monitor over the one photo;
     - the door fades one picture out and then the other in.
   - Fixed on the way: the settings panel's exit looked for the old `.settings-host` (now
     `.hud-host`).
   - New test `tests/motion-dom.test.ts` (happy-dom) drives the real controller, render and
     motion layer through every camera level, held swaps, a rewritten checklist line, the
     monitor push, shutdown, settings and the call. After each render, and mid-move, it asserts
     no duplicate keys and one backdrop on a photo view.
   - New dev dependency: `happy-dom` 21.0.4 (exact), used only by that file
     (`// @vitest-environment happy-dom`).
2. The glow on the right monitor is gone in every view: the shot rects, the CSS, the phase lock.
   - Following "nothing breathing on the monitor", the small window's night pulse on 屏幕
     (`.kmini.blink` animation) is removed too. Its static night look stays. Revert that one rule
     if the desktop-ui night blink should stay.
- Snapshots: the checklist lines' `data-id` (3) and the room HUD without the glow (2).
- Tests: 44 files, 648 passing; typecheck clean. Not checked in a real browser.
