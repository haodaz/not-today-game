# The blind-box case (端盒) (author 2026-11-03)

Replaces "one more layer of the box each few days". Design note: `script/notes/端盒与物件节奏.md`. The author: 「一个大箱子里面有 n 个小箱子就行（你见过盲盒端一箱的吗）。每天拿出一个，里面有剩下的合着的小箱子。一天只能打开一个，其他的怎么也打不开（比太累了强）」「看得见没关系」.

## What the player sees
- Clicking the box in the room (`pick-box`, room view) no longer opens a layer directly. It opens **the case**: an overlay over the room (like the items strip: the room dims behind it), showing a cardboard case seen from above with **9 slots in a 3 × 3 grid**: 8 identical small sealed boxes (one per object in `stages.json` `objectsFoundOnDay`) and **one hidden box** that looks different (darker, no print). Opened boxes leave an empty slot. No text says how many are left or which "layer" this is.
- Which slot holds which object is a deterministic shuffle by the run id (the same every reload, different per run). Nothing on a box tells you what is inside.
- **Exactly one box is loose today**: the box of today's object (`boxObjectFor(day)`) if the day's `openBox` item is unlocked and not done; on `hiddenBoxDay` (new `stages.json` field, 18) the hidden box. Every other closed box is **stuck**.
- Clicking the loose box: the case closes and the existing `loop-box` flow runs unchanged (`openLayer`, the object rises to the hand, its beat and the recognise question).
- Clicking a stuck box: it gives a small shake (200 ms), a dull thud (`box-thud`, silent if missing), and a box line from strings `box.stuck.0` … `box.stuck.3`, cycling by how many stuck clicks happened today (session count, starts at a seeded offset). No event, no state. Never "too tired".
- On days with no box item (and before the item unlocks) every box is stuck; the case still opens.
- Esc / clicking outside closes the case.

## The hidden box (day 18)
- `stages.json` gets `"hiddenBoxDay": 18`. On that day the hidden box is the loose one. Opening it appends `openLayer` with `objectId: "slip"` (the loader and the reducer accept `"slip"` as the hidden box's id: it is not an object, it has no program, no recognise question, it never goes to the desk row or 老物件). Its beat is the day's `beats.box` sequence from content, then the 寄件单 (`/room/desk/slip.png`, already used by the day-18 `slip` item) appears on the desk as today.
- `boxObjectFor(18)` returns `"slip"`; `found` never contains `"slip"`.

## Art
CSS first: cardboard browns, a printed band on the small boxes, the hidden box near-black with a thin red edge, soft shadow. If `public/room/box/case.png`, `public/room/box/small.png`, `public/room/box/hidden.png` exist, use them as backgrounds (Claude may supply them later); missing files fall back to the CSS.

## Strings (Claude has added them)
`box.case` (accessible name of the overlay), `box.hidden` (accessible name of the hidden box), `box.small` (accessible name of a small box), `box.stuck.0`–`3`.

## Files
`src/world/room/game.ts` (`pick-box` opens the case; new actions `case-pick` with `data-slot`, `case-close`), a new `src/world/room/case.ts` (pure: slots from run id + events, which one is loose, the markup), `src/world/room/room.css`, `src/world/room/hud.ts` (mount the overlay; `boxObjectFor` and `hiddenBoxDay`), `src/state/events.ts` / the reducer only to allow `objectId: "slip"`, `src/world/loop/sfx` only if a sound id needs registering. Tests in a new `tests/blind-box.test.ts`.

## Tests
- The case has 9 slots; the slot order is stable for one run id and differs for another; opened objects' slots are empty.
- Today's loose box is today's object only while the day's `openBox` item is unlocked and not done; all others stuck; on a day without a box item, none is loose.
- Clicking the loose box runs `loop-box` (one `openLayer` for today's object); clicking a stuck box logs nothing and cycles the four lines.
- Day 18: the hidden box is loose, opening it logs `openLayer` `"slip"`, `found` does not change, the slip shows on the desk; before day 18 the hidden box is stuck.
- No text in the case names a count or a layer.

## Addition 2026-11-07 (author): before lunch, and how it looks
- **Before the day's box item unlocks** (every day: it unlocks after the lunch is taken in), a click on any box in the case says one line instead of the stuck lines: string `box.beforeLunch` 「吃点东西再来研究这个吧。」 (zh + en in the tree), as an inner line, with the small shake. The stuck lines (`box.stuck.*`) are for the boxes that are not today's once the item has unlocked. No event, no state.
- **The drawing**: the case reads as 3 × 4 because each small box is drawn as two stacked pills (a lid line and a body). Draw each slot as one box: a single rounded cube seen from above with a thin tape cross, no horizontal split. Nine slots, 3 × 3, unchanged.
- **An opened slot** shows the case's bottom (a darker cardboard well), not a black block: it should read as "this one has been taken".
- Tests: before the unlock a click says box.beforeLunch and no stuck line; after it, today's box is loose and the others say stuck lines; the opened slot's markup.
- **The loose box must look loose** (author 2026-11-07: the player must never have to try every box to find the rule). From the moment the day's item unlocks, today's box sits visibly different from the stuck ones: tilted a few degrees, its lid lifted a crack, and it wobbles once when the case opens; the stuck ones are square and still. Before the unlock no box looks loose. Test: the loose slot carries the `loose` class and the others do not, before and after the unlock.
- **Correction 2026-11-07 (author):** before the day's box item unlocks, clicking the carton in the room (`pick-box` / `bed-box`) does **not open the case at all**: it only says `box.beforeLunch` as an inner line, like any RPG door that is not yet open. The case overlay opens only once the item has unlocked (and on days with no box item, as today, with every box stuck). The in-case before-lunch click of the previous point is therefore unreachable and goes.
- The opened slot's well reads black under the dimmed overlay: make it a clearly lighter cardboard colour than the case's edge, so it reads as "taken", not as a hole.
