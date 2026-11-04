# Three numbers: SAN, assimilation, affinity (author 2026-11-03)

Author: 「san 值 / 同化度 / 好感度要不要做成 3 个数字（目前使用克总掉 san，但其实是长同化），剧情上就好判定很多」「早点调整，后面再做设计的时候能简单」. Design: `script/notes/机制设计稿-干活.md`.

| | What it is | What moves it | What the player sees |
|---|---|---|---|
| **SAN** (exists) | whether you hold up | the night's board judgement (work-v2), what the night shows | the heart rate (exists) |
| **assimilation** (new) | how far you have become one of them | letting Kuro do the work, its help on a board, upgrading an old object | no number; the world (later segments) |
| **affinity** (exists) | you and Kuro | the night chat (exists) | no number; how Kuro talks |

Letting Kuro work **no longer costs SAN**; it raises assimilation. Doing it yourself **no longer gains SAN** (the best is nothing).

## Variables (Claude adds them to `content/variables.json` and regenerates `types.gen.ts` before this segment)
- `assimilation`: int 0–100, default 0. Only goes up.
- constants: `assimilationMax` 100, `assimilationGoodMax` 40, `assimLook` 1, `assimLet` 4, `assimAssist` 3, `assimKuroCardKept` 3, `assimUpgrade` 8.
- `letItDoUnchecked` and `goodMaxUnchecked` stay for old saves but no rule reads them any more.

## What raises assimilation
- A task path's effects may carry `assimilation: n` (loader key in `src/state/days/tasks.ts` effects, like `san`); the reducer adds it (clamped to 0–100, never down). Claude will move every `let` / `look` path's SAN change into `assimilation` in content after this lands.
- A board task's `task` event: `+ assists × assimAssist`, and `+ assimKuroCardKept` for each Kuro card in the printed slots.
- An `upgrade` event: `+ assimUpgrade`.
- Accepting the day-13 「全员升级」 (whatever event/flag records it today): assimilation becomes `assimilationMax`.

## Endings (`src/state/endings.ts`) — four of them
Author: 「温柔的世界应该被克总同化之后回到第一天（梦境里一切美好的那一天）」「san 掉光了要有个崩坏世界结局，直接结束游戏，可以写你崩坏在第 x 天」.
- **collapse** 「崩坏的世界」 (new): SAN ≤ 0. At the next ending check (the shutdown beat, or 躺下 right after the night's `boardJudge`) the run ends with `collapse`. Sequence: the room's collapse look runs straight through to white in about 4 s (reuse the late-days collapse stages; with `fx=0` or reduced motion, a cut to white), then black with one line `ending.collapse.line` (`{day}` = the day it happened), then the ending page like the others (its last line `credits.last.collapse`, `{day}` too), then the title. **The run is over**: no bad-end day, no return to day 1; 新游戏 starts fresh. The profile records it (`endings.collapse`); the title's collection shows it like the others (`title.fig.collapse`).
- **bad** 「温柔的世界」: now **only** assimilation ≥ `assimilationMax` (SAN no longer leads here). Its sequence is unchanged: the dream-like happy day 1 (the bad-end day), the night reveal, the ending page, then day 1.
- **good** conditions: `shookHand`, `recognisedAll`, `affinity` (as today), and **`assimilation ≤ assimilationGoodMax`** in place of `unchecked`. Drop `blockedAll` (old objects no longer block the hand).
- **survive**: as today.
- `ENDINGS` gains `"collapse"`; `content/variables.json` `ending` already lists it (Claude); the profile's ending counts and the collection gain it.

## Files
`src/state/days/tasks.ts` (effects key), `src/state/days/effects.ts` (apply it), `src/state/events.ts` (board task and upgrade), wherever 全员升级 is applied (`src/state/upgrades.ts`), `src/state/endings.ts`, the ending flow and page (`src/world/endings/flow.ts`, `view.ts`, `record.ts`), the title collection (`src/ui/collection.ts`, `src/ui/title/*`). Tests: a new `tests/assimilation.test.ts`, and update the ending tests that assumed `blockedAll` / `unchecked`.

## Tests
- A path with `assimilation: 4` raises it by 4; it never goes down or past 100; SAN is untouched by it.
- A board printed with 2 assists and Kuro's card kept: + 2×3 + 3.
- An upgrade: + 8; 全员升级 accepted: 100.
- Assimilation 100 at the shutdown beat → bad (温柔的世界), with SAN still high.
- SAN 0 after the night's judgement → collapse at 躺下 (not lieDown, no next day); SAN 0 at the shutdown beat → collapse; the line carries the day; no bad-end day follows; the profile counts it.
- Good needs assimilation ≤ 40; 41 with everything else true → survive.
- Old saves (no assimilation in their events) replay to 0.
