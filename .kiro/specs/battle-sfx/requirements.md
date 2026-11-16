# Battle sounds, synthesized on the chip (Claude, 2026-11-16)

The work games' battle mode (`src/world/desktop/workbench/battle.ts`, a Gen-1 Pokémon homage) and
day 18's boss fight (`src/world/endings/boss.ts`) play in silence. This spec gives them 8-bit sounds
made on the game's own AudioContext at the moment they are needed — square waves and noise bursts,
the way a Game Boy did it. No audio files: nothing to fetch, nothing missing offline, and the sounds
belong to the same register as the pixel monsters. The babble player (`src/world/sound/babble-player.ts`)
already builds sounds this way on the `AContext` interfaces; follow its shapes.

## 1. The chip (`src/world/sound/chip.ts`, new)

Pure recipes plus one player function. `ChipId` and its recipe, all times in ms, all gains relative
(the player scales by a master `CHIP_GAIN = 0.25` so they sit under the music):

| id | what it is for | recipe |
|---|---|---|
| `cursor` | a menu choice (FIGHT / a move / RUN; a boss move) | square 880 Hz, 40 ms, hard stop |
| `text` | a text line appearing | square 1200 Hz, 25 ms |
| `hit` | a plain blow (`hit` / `strike`) | white-noise burst 90 ms (gain 1 → 0 linear) + square sweep 220 → 60 Hz over 120 ms |
| `shake` | 冲撞 / 加需求 / gaze / bark / pager / phone | square 80 Hz with an 8 Hz tremolo (gain 1 ↔ 0.3), 350 ms, then a 100 ms noise tail |
| `flame` | 喷火 | white noise through a lowpass sweeping 4000 → 400 Hz over 500 ms, gain 0.8 → 0 |
| `flash` | the camera, the boss's eyes | triangle 2400 Hz 60 ms, then 1600 Hz 60 ms |
| `throw` | 扔笔记本 | bandpass noise sweeping 300 → 2000 Hz over 250 ms (the whoosh), then `hit` at 250 ms |
| `flip` | 键盘掀桌 | noise crash 200 ms (gain 1 → 0) + square 110 Hz 150 ms, the loudest of all (gain 1.2) |
| `heal` | 改口 / the tape / lick / the player's heal | square arpeggio 523, 659, 784 Hz, 60 ms each |
| `down` | a fighter falls | square stepping 440 → 330 → 220 → 110 Hz, 125 ms each (the Gen-1 faint) |
| `win` | the fight is won | square 659, 784, 1047 Hz at 90 ms each, then 1319 Hz for 300 ms |
| `lose` | the fight is lost | square 196 Hz 250 ms, then 147 Hz 250 ms |
| `stage2` | the boss changes form | noise swell 1200 ms (gain 0 → 0.9 → 0) under a 55 Hz square |
| `join` | Q-Kuro joins | `heal` and then `shake` cut to 150 ms |

- `export const CHIP_RECIPES: Readonly<Record<ChipId, ChipStep[]>>` — a step is `{ at, kind: "osc" | "noise", wave?, from, to?, ms, gain?, filter?: { type, from, to? }, tremolo?: { hz, depth } }`; keep it data so the table is testable without audio.
- `export function playChip(ctx: ChipContext, out: ANode, id: ChipId, gain = CHIP_GAIN): void` — schedules the steps on `ctx.currentTime` and lets them end by themselves (`stop(at + ms)`); `ChipContext` is the subset of `AContext` it needs (`createOscillator`, `createGain`, `createBufferSource`, `createBuffer` or a noise buffer made once and cached per context, `createBiquadFilter`, `currentTime`, `sampleRate`), like `BabbleContext`. If an interface in `player.ts` lacks a method the recipes need (a filter, `createBuffer`), add it there and to the fake contexts in the tests.
- Never `new Audio`, never a second AudioContext.

## 2. The player and the actions

- `SoundPlayer` gains `chip?(id: ChipId): void` beside `babble`: unlocks on first use the way `babble` does, no-op when there is no context or when `muted`.
- `ActionContext` (`src/world/desktop/controller.ts`) gains `readonly chip?: (id: ChipId) => void`, wired from `deps.sound?.chip` where `babble` is wired. Absent = silence (tests, jsdom).

## 3. When they sound

Two pure mappers, so the moments are testable without a DOM:

- `export function battleChip(prev: BattleState | null, next: BattleState): ChipId | null` in `battle.ts`:
  a new line (`next.at !== prev?.at`, phase `text`) → by its `fx`: `hit` → `hit`, `shake` → `shake`,
  `flame` → `flame`, `down` → `down`, `heal` → `heal`, `none` → `text`; phase newly `won` → `win`,
  `lost` → `lose`, `ran` → `text`; nothing changed → null.
- `export function bossChip(prev: BossBattle | null, next: BossBattle): ChipId[]` in `boss.ts` (a
  list: an act can carry two): a new act (`next.act && next.act.at !== prev?.act?.at`) → by
  `act.move.fx`: `throw`, `flip`, `strike` → `hit`, `shake`, `flash`, `heal`, `none` → `text`; then
  `down` if a party member or the boss went from hp > 0 to hp ≤ 0 in this act; `stage2` when
  `next.boss.stage === 2 && prev?.boss.stage === 1`; `join` when `!prev?.joined && next.joined`;
  phase newly `won` → `win`, `lost` → `lose`. A `boss-next` that only advances the text → `text`.

Wiring:
- `board.ts` `"battle-act"`: `move` / `fight` / `run` / `back` press → `ctx.chip?.("cursor")` first; after
  the state is set, `battleChip(before, after)` → `ctx.chip?.(id)`. `"battle-done"` → `cursor`.
- `flow.ts`: `"boss-move"` → `cursor`, then `bossChip` over the change; the tick that makes the boss or
  an object act (`bossTick` returning a new `act`) and `"boss-next"` → `bossChip` likewise. `down` plays
  150 ms after the act's own sound (`ctx.later`), never at the same instant.
- Settings' mute already silences the master; nothing new there.

## Tests

- `tests/chip.test.ts`: every `ChipId` has a recipe; `playChip` on a fake context (the babble tests'
  fake, extended) creates the nodes a recipe names, schedules `start`/`stop` in order, never throws
  when a method is missing (returns silently).
- `battleChip` / `bossChip`: a table of transitions → ids (new line of each fx, won, lost, ran, no
  change → null / []; boss stage change, Q-Kuro joining, a member falling with the act's sound).
- Actions: with `ctx.chip` a spy, a battle move press records `cursor` then the line's id; a boss
  move records `cursor` then the act's ids; with `chip` absent nothing throws.
- No snapshot should change (sound only). If one does, say why in the log.

## Not in this spec

Music, the stingers and the room sounds (content/sound.json, Claude's); the battle rules; any new
visual; the title page.
