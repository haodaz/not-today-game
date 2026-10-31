# day-loop — requirements

What drives the player through a day and makes them finish it. Author decision 2026-11-01: a progressive checklist in the room/desk views (never the whole day at once) plus one RPG-style dialogue box for narration, inner voice, sounds and choices. Data: `content/days/day-NN.json` (Claude writes; day-01 is the format sample).

## FR1. The checklist (今日)
- Lives in the room, desk and door views (not inside any desktop app). Shows at most the current item and the next unlocked one; completed items collapse to a single greyed line count ("已做 3 件").
- Items are written in the protagonist's voice (second person, short). Each item has `id`, `text`, `unlock` (an event or flag that reveals it), `done` (an event or flag that ticks it), optional `rewrite` (text after a partial event, e.g. after ordering: "午饭在路上。" without a tick), optional `sfx` on unlock, optional `self` (true = ticks itself without the player; a horror beat).
- The bed item is locked until every item with `required: true` is done. Lying down appends `lieDown` (world-state) and ends the day.
- Items unlock by events only, never by wall time. Delivery arrival unlocks "去拿。" via the delivery `arrives` event; the Kuro chat item unlocks after the last work item; "关机" unlocks after work and desk.
- Some days add items the player did not expect (`origin: "them"`) or tick items by themselves (`self`); render both with the same style as ordinary items, no highlight.

## FR2. The dialogue box
- One box at the bottom of the 3D/room views. Four line kinds from content: `narration` (plain), `inner` (italic, the me-voice), `sfx` (short, no quotes, with an optional sound id), `speaker` (with a small name tag: 门外 / 缝里 / 桌上). Kuro never speaks in this box.
- Lines come in sequences (`say: [...]`) attached to checklist events (`onUnlock`, `onDone`) and to beats (boot, open box, desk, shutdown, night). Advance by click/space; a sequence may end in `choices: [{text, goto|effects}]` rendered as a vertical list (the gamebook's branches).
- Text is content data; the box never generates text.

## FR3. Waiting and sound
- Delivery: ordering starts the delivery engine; arrival fires after the next work item is done or after `waitMinutes` of play (content), whichever first, never before `minMinutes`. On arrival: `sfx: doorbell`, the dialogue line, the checklist item.
- `sfx` ids map to files in `public/sfx/` (doorbell, pager-buzz, chick-beep, rain-loop, lamp-click, chain). Missing files are silent, never errors.

## FR4. Day file format (content/days/day-NN.json)
```
{ "day": 1,
  "beats": { "boot": {"say":[...]}, "box": {...}, "desk": {...}, "shutdown": {...}, "night": {...} },
  "items": [ { "id":"boot", "text":"开机。", "unlock":"start", "done":"event:boot", "required":true, "onDone":{"say":[...]} }, ... ],
  "delivery": { "minMinutes": 2, "waitMinutes": 6 } }
```
Every `delta`/flag referenced must exist in variables.json; every string is inline Chinese (these are story lines, not UI chrome) and is also exported to the strings table by the content hook for the English localisation.

## FR5. Tests
- Property: for every day, the required items form an order in which each item's `unlock` can be satisfied by the `done` of earlier items or by engine events; the bed is reachable.
- Snapshot: day 1 checklist at boot, after ordering, after arrival; day 17 with a self-ticked item; day 18 last item.

## FR6. Room-view HUD (author decision 2026-11-01; mock `design/hud/room.html`)
No inventory, no health bar, no clock. The HUD in the room / desk / door views:
- Top-left: the checklist (FR1).
- Top-right: `第 N 天 · 时段` and under it `拖欠 N 天` (the only number that always rises). From the day stages.json/content says, a heart-rate chip appears under it: it is the new world's widget, and it is the only visible proxy for SAN; the game itself never shows SAN.
- Bottom: the **desk bar**, not an inventory: the box (layers left), the phone, the cup (cold for N minutes, from live state), then each object taken out, in day order. An object's icon is its own screen (the chick's current frame, the pager's digits) rendered by the device skeleton at integer pixels. Objects sit directly on the bar as transparent cutouts: no card-in-card, no slot frames (author 2026-11-01). Empty positions are just gaps. The HUD cards themselves are translucent warm grey with blur, never solid white.
- The dialogue box (FR2) overlays the desk bar when active.
- Bottom-right: three camera chips 房间 / 桌面 / 门 (桌面 opens the desktop view). Bottom-left: a small menu: 声音 · 语言 · 首页 (back to the title page). **No restart inside the game** (author 2026-11-01); restarting exists only on the title page. Saves are automatic.
- Kuro is not in the room HUD; at night the right monitor's small window glows inside the 3D view.
- Status is shown by things, never bars: the cup, the room's width (room-scene), the shrinking reply menu.

## Amendment 2026-11-01 (author): one settings button
The bottom-left row is replaced by a single ⚙ **设置** button. It opens a small centred panel over the current view (dimmed behind): 声音 (on/off), 语言 (中文 / English, switching re-renders immediately from en.json), 返回首页, 取消. The language switch must actually work: `?lang=en` and the panel both set the locale; en.json is complete, missing keys fall back to zh. No restart item anywhere. Strings: `settings.title`, `settings.sound`, `settings.lang`, `settings.home`, `settings.cancel`.

## Amendment 2026-11-01 (author): four camera levels, and calling Kuro from the room
- Cameras are 房间 / 桌子 / 屏幕 / 门 (room / desk / screen / door). The current "桌面" chip was really 屏幕. **桌子** is a new level: the desk close-up (both monitors small, lamp, cup, box, objects on the desk). It is where objects and the phone are picked up, where the box is opened, and where the screens are entered (click a monitor → 屏幕). Until room-scene brings 3D, 桌子 is the 2K desk backdrop with the desk bar as its object layer; 房间 uses the wide shot (public/room/shots/room.jpg).
- **Calling Kuro**: in 房间 and 桌子, the right monitor shows Kuro's small window glowing; clicking it opens the chat window as an overlay on the current view (same component, same turns and memory) without entering 屏幕. The chat beat in the evening is this overlay.
- Chips: 房间 · 桌子 · 屏幕 · 门; strings `hud.cam.desk` now means 桌子 and `hud.cam.screen` is new.

## Correction 2026-11-01 (author): the Kuro button is a HUD icon, not a patch on the monitor
- In **every** view (房间 / 桌子 / 屏幕 / 门) Kuro's **animated body** (the sprite with its states: idle blink, busy, think, happy, rest, crawl; desktop-ui FR5) sits fixed at the bottom-right of the HUD, left of the camera chips, about 96 px, with a small unread dot when it has a new line. It is the call button. Clicking it opens the chat overlay anchored to that icon (rises from it, 320 ms); clicking it again or Esc closes.
- The glowing rectangle on the right monitor is removed entirely: no glow, no box, nothing breathing on the monitor (author).
- The small window inside 屏幕 (desktop-ui FR5) and this overlay are the same component with the same state.

## Correction 2026-11-01 (author): the checklist only watches; the player does everything in the world
The author's rule: "the checklist observes our behaviour; the player is the one who acts." Today some lines are buttons (开机, 吃, 看一眼桌子, 关机, 躺下, 老周的事) and the rest tick after something happened elsewhere. That mix is wrong. From now on:

- **No checklist line is a button.** Clicking a line does nothing. `ItemAction` / `loop-item` go away. A line ticks only because its `done` event or flag happened in the world. The current line stays highlighted (`now`), with no hover state.
- **Every item has an actuator in the world.** The ones that already do stay as they are (消息, 点饭, 去拿, 拆箱, 工作, 回老板, 和它说会儿话, 寄件单). The ones that were checklist buttons get one:

| Item | Where the player does it | Event |
|---|---|---|
| 开机 | The computer tower under the desk is a hotspot in 房间 and 桌子 (a small rect on the tower in `shots.ts`, measured from the photos; a faint light when it is off). Pressing it boots. Before boot, 屏幕 shows two black monitors and nothing else. | `step boot` |
| 吃 | After 去拿, the meal sits on the desk bar as its food image (delivery already has these). Clicking it eats; the empty box stays on the bar until the next meal. | `step eat:<meal>` |
| 看一眼桌子 | Entering 桌子 while the item is unlocked counts as looking; the desk beat plays on arrival. | `step beat:desk` |
| 关机 | A 关机 control in the work system's own chrome in 屏幕 (top-right system menu, next to the clock). Pressing it plays the shutdown beat, darkens both monitors and returns to 房间. | `step beat:shutdown` |
| 躺下 | The bed is a hotspot in 房间 (right side). Locked until the required items are done: clicking it then shows one inner line, string `room.bed.locked`, nothing else. Unlocked: the night plays, then `lieDown`, as now. | `lieDown` |
| 老周的事，回一句 (day 5) | The loan choice is made in the messages app, in the conversation with 老周, as that day's reply there. The prompt that used to open from the checklist opens from that conversation. | `loan:decided` |

- Hotspot rects are view geometry and live in `shots.ts` (Kiro measures them from `public/room/shots/*.jpg`). When room-scene brings 3D, they become mesh picks; the events do not change.
- Strings (Claude, already in zh/en): `room.bed.locked`, `room.tower.off`, `desktop.shutdown`.
- Tests: no `loop-item` action remains; each row of the table above has a test that the world action ticks the line and that clicking the line itself changes nothing. Snapshots of the room HUD are refreshed after checking the diff.

## Correction 2026-11-01 (author): where Kuro's body sits
Kuro's HUD body (192 px) sits at the bottom-right corner, **directly above the camera-chip row** and flush with its right edge, so it never overlaps the dialogue box. The chip row is provisional and will go; when it does, Kuro drops to the corner itself. The dialogue box's right edge must stay left of Kuro's left edge at 1600 px.
