# object-upgrade — requirements

Author decision 2026-11-01: Kuro offers to upgrade each old object separately, so the game's core rule (resolution is danger) is a daily temptation from the day an object arrives, not a single event on day 13. Data: `content/upgrades.json`; state: `upgraded` in variables.json.

## FR1. Offers
- From `offerFrom` (only if the object is found), Kuro's small window shows the `offer` line with two buttons (`upgrade.yes` / `upgrade.no`). Declining hides it; after `nagAfterDays` it returns once with the `nag` line. Offers never consume chat turns. (No `finalOfferDay` / `finalOffer`: the all-at-once 全员升级 offer was dropped by the author 2026-11-06; each object is offered from the day after it arrives, and each upgrade raises assimilation, three-meters.)
- Accepting appends an `upgrade` event `{object}`; `upgraded[object] = true`; log for the rubric with `judgement.accept`; declining logs `judgement.decline`.

## FR2. What upgrading changes (all derived from `upgraded`)
- The object's screen switches to the high-resolution channel (device skeleton: antialiased, no integer-pixel rule) and shows the convenient output described in `gain` (pager digits translated, chick auto-fed and animated, tape transcribed, etc.).
- Its lent word is removed from the reply menu. The child's message on it is replaced by the "corrected" text from content (pager 0.7734 → 你好; tape half-sentence completed). Its desk-bar icon renders in the new high-res style: the only visible tell.

## FR3. Tests
- Property: an upgraded object never appears in a night choice list; its word is never in the menu afterwards.
- Snapshot: pager offer on day 4 (it arrives day 3), nag on day 7; desk bar with one upgraded object. All eight objects (camera from day 3, phone from day 9) have an offer.

## Addition 2026-11-03 (author, revised the same evening): after an upgrade, Kuro moves in

Author: 「升级之后不是骗人，而是克总进去了，3 天之后就只剩下一个克总在里面，功能失效了」; 「他们都是高像素屏幕，克总的 art 就能在里面出现了（就用现在的 pixel art 就行）」. The old screens (32 × 16 dots, seven segments, 2 × 16 cells) are too coarse to hold Kuro: an object that was **never upgraded is never taken**. The drawer (老物件) always shows the original and is never taken. Never explained in-game. (This replaces the earlier three-level "invasion" draft: no lies, no interference — first it is easier, then it is gone.)

Upgrading is a loan (design note `script/notes/机制设计稿-干活.md`): the object's ability becomes **automatic** right away, and three days later it belongs to Kuro.

### The two states
A pure helper in a new `src/world/objects/taken.ts`: `upgradedOn(id, events)` (the day of its `upgrade` event, or null) and `takenByKuro(id, state, events)` = upgraded and `today − upgradedOn ≥ 3`.
- **Upgraded, not yet taken** (the upgrade day and the two days after):
  - In 使用 the device shows its smooth hi screen as today. After a key press, with chance 1/6 (seeded, `unit(hash(seed + n))`, `n` the program's own press counter), Kuro's face (`public/objects/kurogotchi/base.png` or `blink.png`) fills the hi screen for 180 ms, then the object's own frame. Nothing else changes. (Only Kuro gets randomness.)
  - **In work its ability is automatic**: a board lock that needs this object opens by itself when the task is opened (a `boardStep` `unlock` with the right code, logged as the object's, not an assist).
- **Taken** (from the third day after the upgrade):
  - In 使用 the hi screen shows **only Kuro**: idle `base`, `blink` for 300 ms every ~4 s, `talk` for 600 ms after any key press, `red` with chance 1/12 when it returns to idle (seeded). Drawn as a Kurogotchi frame into the hi canvas with `imageSmoothingEnabled = false`, scaled to the glass height, centred (wide screens: pager, calculator, dictionary at the left, the rest of the glass dark; the tape inside its dark window). The object's own program never draws again; its keys are answered only by Kuro's `talk`.
  - **In work it is gone**: a board lock that needs it counts as unavailable (only 「让它试」 is left), exactly like an object never found.
- Holding (the photo) is unchanged in both states.

### Files
New `src/world/objects/taken.ts`; `src/world/objects/program.ts` (env gains `taken: boolean` and `seed: string`, set where the env is built); the upgraded paths of `chick.ts`, `pager.ts`, `dictionary.ts`, `calculator.ts`, `tape.ts` (a taken object draws nothing of its own); `src/world/objects/paint.ts` / `layer.ts` (drawing a Kurogotchi frame into the hi canvas; preload the eight images once); where the env is built (`held.ts` / `layer.ts`); `src/state/days/board.ts` (`lockObjectAvailable` uses `takenByKuro` with the events instead of today's `upgraded && inDream` stand-in, and the automatic unlock for an upgraded, not-yet-taken object); `src/world/desktop/workbench/board.ts` (the automatic unlock when the task opens). Tests in a new `tests/taken.test.ts`.

### Tests
- `takenByKuro`: never upgraded → false on every day; upgraded on day 6 → false on days 6–8, true from day 9.
- Not yet taken: the board lock for that object opens itself on opening the task, not counted as an assist; glimpses only through the seed; a replay renders the same frames.
- Taken: the device never calls the object's own `draw`; a key press shows `talk`; the board lock counts it unavailable (only 让它试).
- The original (not upgraded) devices and the drawer never draw a Kurogotchi frame.
