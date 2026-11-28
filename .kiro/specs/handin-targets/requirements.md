# handin-targets: the day's work is handed to whoever asked for it

Author, 2026-11-28 (ledger #182–#185). Her words: 「我觉得 7 天开始做主的人就不是老王了，10 天以后大集团更不是，越往后要活的人职级越高才对…前面 789 可能是来做融合工作的人的要求，10 开始是集团一些人的要求」; day 18: 「18是克总」.

Before this spec: a board's deliverable can go to `boss`, `partner`, `group` (the company group), `workbench` or the `hand`. Days 7 and 8 send to the company group, day 9 and day 18 to the boss. The posters already name the new askers (commit be44444); the work still lands in the old threads.

After this spec: the work of days 7–9 lands in the fusion group (`g_merge`), where the advisers asked for it; day 18's is handed to Kuro, who asked for it, and shows in no conversation.

Scope for Kiro: the loader, the places that read `deliverable.to`, the strings' wiring, tests, and four one-line content changes given verbatim. **No sentence is written by Kiro**: every string is given below. Do not touch any other text in `content/`.

## R1 · Two new targets

`DELIVERABLE_TO` (src/state/days/tasks.ts) becomes `["boss", "partner", "group", "merge", "kuro", "workbench", "hand"]`.

- `merge`: the fusion group. Its conversation is `g_merge` (it exists on days 7–9 only; `OUTSIDE_GROUPS` / `PARENT_GROUPS` in src/state/replies/table.ts).
- `kuro`: handed to Kuro. No conversation.
- The loader fails loudly when a task's `to` is `merge` on a day whose reply table has no `g_merge` recipient (check it where the bilingual task file is validated against the day, or in a test over the real content if the loader cannot see the reply tables: say which you chose in the log).
- The zh / en twin check already compares `deliverable.to`; keep it.

## R2 · Everywhere `to` is read

Each of these treats `to` as one of boss / partner / group today. Make them table-driven from one place (a small exported map next to `DELIVERABLE_TO`: target → conversation id or null, and whether it is a person / group that "receives a message"):

- `src/world/desktop/messages/transcript.ts` `CONVERSATION_OF_TO`: `merge` → `g_merge`. A sent file card from 你 appears in that group's thread at the time it was sent, exactly as it does in the company group today. `kuro` → no conversation.
- `src/world/desktop/workbench/shell.ts` (line ~90, the header's 交给 chip): `merge` shows the thread's name (`msgs.g_merge`); `kuro` shows `kuro.name`.
- `src/world/loop/runtime.ts` (line ~268, the `task.sent` line after a send): said for `merge` as for the other threads; for `kuro` it is not said (the board's own `print` beat speaks).
- `src/world/room/game.ts` (line ~1371, where a call that ended decides which thread the work goes to): leave the three old values as they are; `merge` and `kuro` never come from a call.
- The send / sent buttons and labels use `board.send.<to>` / `board.sent.<to>`: add the four strings of R3 and make sure nothing falls back to `boss` for the new targets.

## R3 · Strings (verbatim; zh then en)

- `board.send.merge`: 「发到融合工作群」 / "Send to the integration group"
- `board.sent.merge`: 「已发到融合工作群」 / "Sent to the integration group"
- `board.send.kuro`: 「交给克总」 / "Hand it to Kuro"
- `board.sent.kuro`: 「已交给克总」 / "Handed to Kuro"

Menu / status strings must use characters the bundled fonts have (`tests/fonts.test.ts`); if one of these fails that test, report it instead of changing the wording.

## R4 · Content (four values, nothing else)

- `content/tasks/day-07.json` and `content/tasks/en/day-07.json`: the board task's `deliverable.to`: `"group"` → `"merge"`.
- `content/tasks/day-08.json` and `en/`: `"group"` → `"merge"`.
- `content/tasks/day-09.json` and `en/`: `"boss"` → `"merge"`.
- `content/tasks/day-18.json` and `en/`: `"boss"` → `"kuro"`.

## R5 · What must keep working

- Days 1–6 and 10–17 behave exactly as before (10–17 hand their work to the hand at night).
- A day-7 walk: the minutes are sent, the file card shows in 融合工作群 (汀汀), the day's checklist item is done, the night comes.
- Day 18: the list is handed in, the checklist item is done, the ending is reached as before.
- The walk driver (`script/tools/auto-day-shoot.mjs`) needs no change if it presses the board's send button by its `data-action`; if it looks for the button by its words, make it follow the new words.
- Tests: the loader accepts the two targets and rejects `merge` on a day without the group; a sent file on day 7 is in `g_merge`'s transcript and not in `group`'s; `kuro` produces no file card anywhere; the header chip's names; the `task.sent` line said / not said. Update snapshots only where the diff is exactly these words, and say so in the commit.
- `npm test` and `npx tsc --noEmit` green before the commit.

## Not in this spec

- Any dialogue, poster or chat text (Claude's).
- The reply tables (`content/replies/`): Claude is editing them in parallel; do not open them for writing.
