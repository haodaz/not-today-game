# lying-view — requirements (2026-11-06, author)

The author's decisions from the day-1 replay: the day begins and ends lying in bed, looking at the ceiling, and Kuro is simply there when you wake, never introduced. Two parts: speaker lines that Kuro and the player say inside a day file (R1, content already in the tree), and a fifth view, 躺下 / the ceiling (R2–R5). Content and strings are Claude's; do not edit content/ or public/.

## R1. Kuro and the player as speakers in day files (content is in)
- `content/days/day-01.json` `beats.boot.say` now opens with three `speaker` lines: `who: "kuro"` 「早上好。」, `who: "me"` 「这是克总，我的 AI。」, `who: "kuro"` 「看看今天要干什么，跟着任务走没错。」 (en twin the same shape). Strings `who.kuro` (克总 / Kuro) and `who.me` (我 / Me) exist as fallbacks.
- A `speaker` line whose `who` is `kuro` is queued and shown exactly like one of Kuro's chat lines (`item()` in `src/world/dialogue/kuro.ts`): Kuro's portrait, `KURO_LINE_BOX`, the tag `kuro.name`, Kuro's voice/face treatment. When a `say` sequence mixes Kuro lines with others, split it into queue items so that only the Kuro lines carry `voice: "kuro"` (the box reads `head.voice`); the sequence must still read as one, in order, with one click per line, and its ending (choices etc.) stays on the last item.
- A `speaker` line whose `who` is `me` is the player's own line: the player's tag and portrait as in the chat's player turn (playtest-1105 R6), never an NPC silhouette. Pronoun / dream state as today.
- Any day, any beat: the rule is by `who`, not by day 1. Tests: day-01 boot renders Kuro / player / Kuro with the right tags and portraits; a mixed sequence advances in order; `talking()` / `leaveKuro` are not confused by these lines (leaving Kuro's chat must not drop a day beat's remaining lines — give these items a key that is not `kuro:` and decide `talking` from the chat items only, or equivalent).

## R2. The fifth view: 躺下 (the ceiling)
- A view `lying` under 床 (the pattern of `table` under 窗 and 桌子 under 房间: a level, with a way back to 床 by Esc / the back control / the wheel). Backdrops: `public/room/shots/ceiling_day.jpg` (day) and `public/room/shots/ceiling_night.jpg` (after nightfall), same size class as the facings; Claude supplies both files before this spec is run. The evening look (dark layers, lamp) applies as on the facings.
- No hotspots on the ceiling except Kuro (R4). The HUD (checklist, 第 N 天, desk bar) shows as in the facings.

## R3. Waking there
- The day starts in `lying`, not in 房间: the first thing the player sees is the ceiling, and the `boot` beat (playtest-1105 R3: the waking lines) plays over it. When the beat ends, the player is still lying; any turn / Esc / the back control goes up to 床, then the facings as today. Nothing else changes about the day's start (the dream night still comes first on days that have one; after the dream the waking lands here).
- The title → day 1 flow lands here too.

## R4. Lying down before sleeping, and Kuro from the bed
- Clicking the bed (the `bed` action, from 房间 or 床) **before nightfall** still only says `room.bed.notyet` (no view change).
- **After nightfall** clicking the bed goes to `lying` first (the night backdrop). Lying there:
  - If the night's required items are not done: `room.bed.locked` as today, said from the bed; the player can go back up.
  - Otherwise the question `room.bed.confirm` (睡 / 再待会儿) is asked **from `lying`**, and 再待会儿 leaves the player lying (no view change) so they can still talk to Kuro.
  - Kuro's body is present in `lying` (bottom-right as everywhere) and a click is `kuro-call` as today: the evening chat can be held from the bed. After the chat, clicking the bed / a 睡 control asks again.
- `sleep` (the answer 睡): the night begins from `lying` directly (no turn to 床 first; the turn-then-sleep path in `sleep()` is for a 睡 given elsewhere and may stay for that case).
- The day can only be completed from `lying`: there is no other way to `lieDown`.

## R5. Tests
- `lying` is reachable from 床 and back; the day starts in `lying`; `bed` after nightfall goes to `lying`; `bedAsk` is asked from `lying`; 再待会儿 keeps the view; `kuro-call` works in `lying`; `sleep` from `lying` starts the night; the boot beat plays over `lying`.
- Snapshots that change only by the new view / the new opening lines: list them in the report, do not edit them.

## R6. Getting up (addition 2026-11-06, author, after seeing R1–R5)
- `lying` has no 返回 / back control and no wheel-out. Leaving it is an action: a click on the ceiling (anywhere that is not Kuro's body), Esc, ← / → or the back key asks `room.rise.ask` 「要起来吗？」 with two choices, `room.rise.up` 「起床」 and `room.rise.stay` 「再躺一会儿」 (strings in the tree, zh + en). 起床 goes up to 床; 再躺一会儿 keeps the player lying. While a dialogue is up, the ask waits (dialogue owns the screen, playtest-1105 R2).
- The day's opening is split in two. `beats.boot.say` is what is heard and said lying down (day 1: Kuro's three lines and the rain). A new optional beat `beats.rise: { say: [...] }` is what the player sees on getting up (day 1: the cold water, the black screens, the inner line about the power button). It plays once per day, right after the first 起床 of that day, in the view the player stands up into (床). Days without `rise` play nothing on getting up. The day-file parser (`src/state/days/table.ts`) and `scripts/validate-content.ts` accept the key; the English twin has the same shape. Claude moves day 1's lines once the parser accepts the key; other days follow later.
- After nightfall the bed question (`bedAsk`, 睡 / 再待会儿) stays as in R4; 再待会儿 keeps the player lying, and getting up from there is the same 起床 ask.
- Tests: the ask from a click / Esc; 起床 lands on 床 and plays `rise` once; 再躺一会儿 stays; a day file with `rise` parses and one without still does; `rise` with an unknown key fails.
