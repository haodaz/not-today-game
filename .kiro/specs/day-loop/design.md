# day-loop — design

## 1. Approach

Everything the loop knows comes from the event log and `content/days/day-NN.json`:
- The checklist is a pure function `(day file, state, today's events) → item statuses`. Nothing
  about it is stored.
- The dialogue box is a session queue of content sequences. A runtime fills it from what changed
  after each event: items newly unlocked or done, beat steps, and the night before lying down.
- Delivery waiting is a pure "is arrival due" check, driven by real play minutes in the session.
  When due, it appends an arrival step.
- The room HUD and the door view are pure views. One controller switches between room, door and
  desktop.

## 2. Decisions taken (please review)

- **L1. Three event kinds (world-state amendment).**
  - `step {name, t}` records loop moments the world has no event for: `boot`,
    `openApp:<app>`, `eat:<meal>`, `beat:desk|shutdown`, `delivery:arrives:<meal>`, `chat:any`.
    It changes nothing.
  - `choose {beat, index}` records a dialogue choice. Its reducer applies the choice's
    `effects`: `flags`; `san`, clamped to the table range; and `item_dream` → `dream[object] =
    {until: day + 1}` (one night; night-hand N4 — `dreamDays` is the count of dream nights, not
    a duration). On a raid night it also writes `raids[day]` (night-hand N1).
    `item_lost` (`"loan"` or an object id) is added to the `lost` set (variables.json, added
    2026-10-31 at the author's request). The day-17 pickup whose flags include
    `objects_returned` empties `lost`. Raids are unchanged.
  - `task {flag, mode: self|look|let|auto}` plays the day's task tree (see L2).
- **L2. Work tasks (task trees, replaces the stand-in).** `content/tasks/day-NN.json` is read by
  `src/state/days/tasks.ts` (strict guard; every path's `effects.flags` must include the task's
  `done` flag). `taskByFlag(day, flag)` links a checklist item to its task.
  - The 工作台 ask box and the three modes append `task {flag, mode}` for the first open task.
  - The reducer applies the chosen path's effects: flags, `san` (clamped), `letItDoUnchecked`.
    `looked` is the event itself; nothing else stores it.
  - The runtime queues `start.say` + `path.say` to the dialogue box (shown over the desktop
    too). The path's `kuro` lines show in the small window, derived from today's log.
  - `auto` (self-ticking items, ~4 s after unlock) and tasks without a tree set only the flag.
  - Known gap: day 18's task (`task1` / `task_d18_1`) does not match its checklist item
    (`slip` / `slip_filled`); waiting on content.
- **L3. Condition tokens.**
  - Supported: `start`, `done:<id>`, `flag:<f>`, and the event tokens `event:boot`,
    `openApp:<app>`, `order:<meal>`, `delivery:arrives:<meal>`, `pickup:<meal>`, `eat:<meal>`,
    `openBox` (an `openLayer` today), `reply:<recipient>`, `beat:<desk|shutdown>`, `chat:any`,
    `lieDown`.
  - An event token only counts if the event happened today. An item counts as done only once it
    is unlocked.
- **L4. Rewrite.** An item with `rewrite` whose done token is `order:<meal>` shows its rewrite
  text, unticked ("wait"), until that meal's arrival step. It is already done for the bed's
  required count.
- **L5. Arrival (FR3).**
  - After an order, arrival is due once at least `minMinutes` of play have passed, and either
    the next work item has been done or `waitMinutes` have passed.
  - On arrival: append `step delivery:arrives:<meal>` and move the beat clock to delivery's
    `arrivesAt`, so the door machine agrees.
  - Play minutes are session time. A reload restarts the wait from load.
- **L6. Beats and the clock.** The day-loop drives the stand-in beat clock:
  - boot → `boot 09:03`
  - the first messages open → `work`
  - opening the phone for a meal → that window's start
  - lunch pickup → `afternoon`
  - desk → `desk ≥ 18:30`
  - shutdown → `night ≥ 23:41`
  - The times are the mocks'. Beat sequences play on their step: boot, desk and shutdown on
    their step; box on `openLayer`.
  - Lying down plays the night sequence, then appends `lieDown`.
- **L7. Heart-rate chip.**
  - It shows from `stages.json.heartRateFromDay` if present, else from day 9. Day 9's boot
    narration ("右屏右上角多了一个组件。心率。") and the mock say so. TODO(Claude): add the field.
  - It shows `72 + round((sanStart − san) × 0.6)` bpm: a proxy that rises as SAN falls. SAN
    itself is never shown.
- **L8. Backdrop.** `public/room/shots/desk_close.jpg` does not exist in the repo. The room view
  layers that URL over `/design/hud/bg_desk.jpg` (served in dev only) over a dark fill.
  TODO: add the shot.
- **L9. Desk bar.**
  - Items: the box (layers left = objects not yet found), the phone, the cup (no number: no
    live state holds when the water was poured), then each found object in found order.
  - Objects are cutouts from `/objects/<id>_white.png` with an empty integer-pixel screen. The
    device skeleton will draw the screens.
  - The box opens the object `stages.json objectsFoundOnDay` gives for today.
- **L10. Desktop amendment (2026-11-01).**
  - One monitor at full size, opening on the monitor with the current app (left, 消息).
  - A 左屏 / 右屏 toggle sits at the top edge; ← → also switch.
  - The other monitor shows as a thin tab on its side with its badges.
  - A 房间 chip, or Esc, returns to the room.

## 3. Modules

```
src/state/days/table.ts     load + strict guard of content/days; condition tokens parsed
src/state/days/effects.ts   step / choose / task reducers
src/world/loop/checklist.ts statuses, visible list, bed lock, actionable items, required order check
src/world/loop/dialogue.ts  queue: push sequences, advance, choices (cond_show)
src/world/loop/waiting.ts   arrivalDue
src/world/loop/runtime.ts   store-change diff → dialogue, sfx, self ticks, arrival timers, clock
src/world/loop/sfx.ts       sound ids → /sfx/<id>.mp3, silent on error
src/world/room/hud.ts       room HUD (checklist, day/overdue/hr, desk bar, dialogue, cams, menu, phone panel)
src/world/room/door.ts      door view (the delivery door machine over /room/door_wall.png)
src/world/room/game.ts      render by view; loop actions
```

The desktop controller gains a pluggable root renderer, change hooks, and the keys
(← →, space, Esc).

## 4. Tests (FR5)

- **Property:** for every day, the required items can be done in some order. Each `unlock` is
  satisfied by earlier `done`s or engine events, and an arrival token only counts after a
  reachable order of that meal. The bed is reachable.
- **Snapshots:**
  - the day-1 checklist at boot, after ordering, and after arrival;
  - day 17 with the self-ticked item;
  - day 18 at its last item;
  - the room HUD at day 1 and day 9 (heart rate);
  - the desktop at one monitor with the toggle.
- **Unit tests:** guard, tokens, reducers, rewrite, bed lock, dialogue queue and choices, arrival
  rule, and the runtime diff with a fake context.

## Amendments implemented (2026-10-31)

- **One settings button.**
  - The bottom-left row is now a single ⚙ 设置 button (`settings-open`). It opens a centred
    dialog over the dimmed view, in 房间 / 桌子 / 门 and over 屏幕.
  - 声音 is a switch (`loop-mute`, `role="switch"`).
  - 语言 is 中文 · English (`settings-lang`), which re-renders from en.json at once.
  - 返回首页 is `settings-home`, supplied by main.ts. The title page isn't built yet, so it
    reopens the game without debug parameters on the saved run.
  - 取消, a click on the dim, or Esc closes it.
  - `loop-restart` and `loop-lang` are gone; nothing restarts the run.
- **Four camera levels.**
  - `View` is `room | desk | desktop | door` (chips 房间 · 桌子 · 屏幕 · 门; `hud.cam.screen`).
  - 房间 is room.jpg, with the desk (and its monitors) clickable → 桌子.
  - 桌子 is desk_close.jpg. The desk bar is its object layer (shown there only), and each
    monitor → 屏幕 on its side.
  - In both, the glowing small window on the right monitor (`kuro-call`) opens Kuro's window as
    an overlay, the same component, without entering 屏幕. Esc or a click on the dim hangs up.
  - Esc steps out one level (屏幕 → 桌子 → 房间, 门 → 房间).
  - Positions are measured once in `src/world/room/shots.ts` (both shots 2048×1152, ×0.78125
    onto the stage). The camera push uses the same numbers.
  - The raid glow sits in the shot's gap.
