# Chick raising (the author's idea, 2026-11-11)

The chick (the bootleg Tamagotchi, `src/world/objects/chick.ts`) becomes something the player raises
for real, like a pocket monster: four stats, a limited number of cares a day, the menu as the real
machine's. Later (not in this spec) the stats decide how well it brute-forces gates in the electronic
world. Design note (Chinese): `script/notes/chick-raising-2026-11-11.md`.

## R1 · The stats, from the log
- Four stats: `atk` (攻), `def` (防), `hp` (血), `spd` (敏), integers from 0.
- A care is one B press on one of these menu icons: `meal` → hp +1, `play` → spd +1, `training` → atk +1,
  `medicine` → def +1. The other icons (`light`, `toilet`, `checkup`, `attention`) never change a stat
  (light darkens the screen, checkup shows the stats, the rest nod, as today).
- At most **10** cares count per day, in any mix. Later cares that day still play their animation
  and sound but add nothing.
- Everything is derived from the log, pure: a care is the existing `pressKey` event
  (`{ kind: "pressKey", day, key: "chick:<icon>" }`), appended by `src/world/objects/index.ts` when
  the program returns a new `Out` `{ care: "<icon>" }` from its `key()`. Export
  `chickStats(events, day)` → `{ atk, def, hp, spd, today: number }` from a new `src/state/chick.ts`.
- The program's `key()` must not append events itself (programs are pure); it returns the `Out`.
  `index.ts` turns it into the event. The program needs to know today's count: add
  `careToday?: number` to `ObjectEnv`, filled in `envFor`.

## R2 · The screen
- `checkup` (B on the check icon): instead of the single `check` frame, draw four bars on the 32×16
  LCD with `Bits.rect`: one row per stat in the order 攻 防 血 敏, each bar's length = min(stat, 18)
  pixels from x = 10 (the first 8 px of each row hold a 4×4 icon-sized mark drawn from the existing
  icon tiles: training / medicine / meal / play). No text.
- After the 10th care of the day, pressing B on a stat icon still plays the icon's animation; the
  success beep is not played (the key sound only).
- Upgraded (Kuro has taken it over): unchanged — nothing the player presses changes anything.

## R3 · The caption and the player's line (no Kuro line)
- While the chick is in 使用 (the room's `held` device), a small caption under the device:
  `obj.chick.caption` = 「A 换 · B 做 · C 回」 (strings zh/en). Reuse the device footer slot
  (`renderDevice(..., footer)`), as the lock footer does.
- The first time the 11th care of a day is attempted, the player's own inner line plays once in the
  box: `obj.chick.full` = 「今天只能做这么多了。」 (`k: "inner"`). Once a day (session memo is fine).

## R4 · Tests
- `tests/chick-raising.test.ts`: stats from events (mix, cap at 10 a day, next day resets the count,
  stats keep growing); the program returns `{ care }` only while under the cap and only for the four
  icons; `index.ts` appends `pressKey` with `chick:<icon>`; the checkup frame draws the bars
  (assert a few pixels); the caption markup; the inner line once.
- Run `npm run -s validate`, `npx tsc --noEmit -p .`, `npx vitest run`. Everything green.

## Out of scope
- Using the stats in work tasks (battle screens). The title drawer's 克麻歌子.
