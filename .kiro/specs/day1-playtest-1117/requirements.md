# Day 1 playtest fixes (author's playtest, 2026-11-17)

The author played day 1 again on the live site. Her notes are in
`../holloween/script/notes/作者反馈-2026-11-17.md`; the parts that need code are below. The content
side is already in (commit 89afc4a and the strings commit with this spec): 克总 is the zh name, the
protagonist no longer says how to turn, the reply's early line is gone, and every string this spec
names exists in `zh.json` and `en.json`. Do not add or reword strings; a missing one is a question.

Her rule behind all of it: a guide text tells the player what to do; the protagonist never says it.
The thing to click is the thing that is lit.

## R1. 起床 is day 1's first checklist item

- Add the event token `event:rise` to the day-file parser (`src/state/days/table.ts`, next to `boot`).
  Getting up from the bed (`getUp` in `src/world/room/game.ts`, the 起床 answer of the rise ask)
  records a `rise` event once per day.
- Add this item at the top of `items` in `content/days/day-01.json`, and change `boot`'s `unlock`
  from `"start"` to `"done:rise"`. This one content edit is yours; say so in the log.

  ```json
  { "id": "rise", "text": "起床。", "unlock": "start", "done": "event:rise", "required": true }
  ```

  The English twin `content/days/en/day-01.json` gets the same item with `"text": "Get up."`.
- On day 1 the guide's first target is the rise spot (R2), before the tower.

## R2. The ceiling: one spot gets you up; the rest has something to say

Now a click anywhere on the ceiling view (`lying`) asks 要起来吗 (`nav.ts`, the `lying` branch of
`onClick`). Change it:

- **The rise spot**: a band along the bottom of the ceiling view (the edge of the bed, the bottom
  ~18 % of the stage, full width). A click there asks 要起来吗 as today. It is a prompt anchor with
  the hint id `rise` (`hint.rise`, `hint.short.rise` = 点这里，起床). Esc, ← / → and the back key still
  ask, as today.
- **The ceiling light**: its rect on the picture is a hotspot. A click plays `room.lying.lamp` as one
  `inner` line.
- **Anywhere else on the ceiling**: plays `room.lying.ceiling` as one `inner` line.
- Each of the two lines plays at most once per lying-down (a second click there does nothing), so
  clicking around never stacks lines. Kuro's body keeps its own button.

## R3. Desk first, then the screen

Her words: 「点屏幕，坐到电脑前，这很奇怪。应该是点击桌子，靠近书桌；点击屏幕，使用电脑。」

- In the room facing the desk, re-cut the hit areas: **the two monitors only** go straight to the
  screen (`view desktop`), as now; **the desk surface and everything else on the desk** goes to the
  desk view (`view desk`). Both stay possible.
- New hint id `desk` (`hint.desk`, `hint.short.desk` = 靠近书桌), anchored on the desk area in the
  facing view. `screen`'s prompt (`hint.short.screen` = 使用电脑) anchors on the monitors in the desk
  view.
- Day 1's guided path after the tower: ring the desk in the room, then the screens in the desk view
  (the guide lights the whole path, as for lunch in `navigation-polish`).

## R4. The first time at the computer

- Before the screen's coach marks (the bubbles of the first visit), the protagonist says one line:
  `screen.first.me` (办公越久，用到的软件越少。就这几个。), as a `speaker` line, `who: "me"`, in the
  dialogue box over the screen. When it is dismissed, the coach marks start and show **one bubble at
  a time** (click to the next), not several at once.
- Only on the first visit (the same condition the coach marks use now).

## R5. 老王's thread on day 1 (TingTalk, `msgs`, boss thread)

- **Read marks.** Under each message the player sends, a small grey 未读 that turns to 已读 just before
  the other side starts answering (TingTalk's look: right-aligned, under the bubble). Strings:
  `wb.msgs.unread` / `wb.msgs.read` (未读 / 已读), already in both languages.
- **The player's line card sits lower.** 老王's text now sits in the upper part of the thread; the
  player's line card (`where: "screen:msgs:boss"` lines) must not sit up there with it. Put it at the
  bottom of the thread, above the input row, so it never covers the newest message.
- **The reply prompt.** When the reply choices open, the line `msgs.reply.prompt.d1`
  (工作了十多年，想说的话就那几句。选一句回他吧。) shows as the choices' header, and the player's line card
  is gone: the choices are the guide. General rule: `msgs.reply.prompt.d<day>` when that string
  exists, nothing when it does not.
- **Timing of 「听他说完话」.** The reply item's `onDone` lines (听他说完话，感觉一天的精力用掉了一半。/
  点个餐吧。) now start as soon as the player's reply is sent, while 老王's answer is still arriving.
  They must wait until 老王's last message of that answer has landed. Do this for any item whose
  `done` is `event:reply:<who>`: its `onDone` waits for that thread to go quiet.

## R6. The 3D desk's guide follows the object

The desk is code-built now (`room3d/room.js`, `src/world/room/desk3d.ts`). The guide ring is placed
from the rects `room3d` posts on a `locate` request (`type: "where"`), and nobody asks again after the
player drags an object, so the ring stays where the object was.

- The guided object **glows in the 3D scene itself**: the host posts `{ type: "glow", id }` (or
  `id: null` to stop) and `room3d` gives that object a soft pulsing emissive rim. The glow moves with
  the object because it is the object.
- Keep the DOM ring as a fallback only where the target is not a 3D object, and in that case re-post
  `where` when a drag ends.

## Out of scope

- NPC half-body portraits (decided: NPCs show half-body when they talk with the player). That is new
  art and a separate job.
- The web page's collapse: the news for all 18 days and the tentacles already exist.

## Done means

- `npm run typecheck`, `npm test` and `npm run validate` clean.
- Day 1 from the title in the browser: lying → only the bottom band gets you up, the lamp and the
  ceiling each say their line → 起床 ticks → tower → desk → screen → the line → bubbles one by one →
  老王's thread with read marks, the prompt as the choices' header → 听他说完话 only after 老王 finishes →
  lunch. Drag a guided desk object: the glow goes with it.
- A line in `docs/kiro-log.md` for this job, naming the one content edit (R1).
