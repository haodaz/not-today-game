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
