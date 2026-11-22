# texture-pass — requirements (Claude, 2026-11-22; author: 「游戏的感受和质感先上去」)

Seven wiring jobs that put the 2026-11-21 asset night into the game. Every asset is already in `public/`
(listed per job). Nothing here changes a rule of play: these are pictures, loops and short cuts on top
of what exists. Content (which line uses which pose, which day uses which clip) is Claude's and comes in
`content/`; this spec gives the shapes the renderer must honour and the fallbacks when content says
nothing. English only in commits and logs (hackathon judges may read them). Never commit, never deploy.

## R1. Cutscenes (过场): a full-screen cut before a day-loop beat

- Assets: `public/cut/<beat>/<look>.mp4` (3 s, 960 px, H.264, muted) and `public/cut/<beat>/<look>.jpg`
  (the still). Beats: `wake`, `boot`, `door_takeout`, `carton`, `eat`, `work`, `shutdown`, `liedown`.
  Looks: `she`, `he`, `none`, `cap`, `glare` (the file names of `PORTRAIT_FILES` plus the two new looks, R6).
- Content: `content/cuts.json` (Claude): `{ beats: { <beat>: { on: <event>, days?: [..], once?: true } } }`
  where `on` names the moment (`rise`, `boot`, `door:pickup`, `carton:open`, `eat:lunch`, `eat:dinner`,
  `work:start`, `shutdown`, `lieDown`). The loader is strict like `npc.json`'s. Until the file exists the
  beat map is empty and nothing plays.
- A pure function `cutFor(state, session, event): { video, poster } | null` in `src/world/cut/plan.ts`
  reads the map, the player's look (`names.portrait` → file name) and `cuts.json`; `once` beats play on
  their first occurrence only (`session.cutsPlayed`). No DOM in this file; this is what the tests cover.
- The player: a `.cut-layer` over everything, the dialogue box included (its line reads after the cut), poster image first, then the video
  (`autoplay muted playsinline`, no controls); fades in 150 ms, plays, fades out 200 ms, then the beat
  continues exactly as before. A click or any key skips. `prefers-reduced-motion` or a failed `play()`
  shows the poster for 1.2 s instead. The whole cut never blocks input for more than 3.5 s.
- Headless replay (`?fast=1`) and tests: the layer renders nothing (no `<video>` in jsdom).
- Tests: the plan (right file per look and beat, `once`, absent map = null); a snapshot of the layer markup.

## R2. Standing portraits with poses

- Assets: `public/npc/stand/<npc>_<pose>.webp` beside the existing `<npc>.webp`. Poses present per NPC
  (not every NPC has every pose): `p1..p4`, `angry`, `laugh`, `scared`, `tired`, `assim`;
  `boss_innsmouth` too. Idle loops: `public/anim/stand/<npc>_idle.webm` (VP9 with alpha, 4 s).
- Content shape: a dialogue line may carry `pose: "<pose>"` (string). `sceneOf` resolves the stand to
  `/npc/stand/<npc>_<pose>.webp` when the file is known for that NPC (a table in `content/npc.json`
  `stands: { <npc>: ["p1", ...] }`, strict loader), else the plain stand. A pose holds until the next
  line of that NPC with a pose, or the backdrop changes. The `other` (dimmed) figure keeps its last pose.
- From day 13 on (`stages.json`), an NPC that has an `assim` file uses it as the default stand when the
  line has no pose (author: 同化版 from the day the colleagues change). Content may still name a pose.
- Idle breathing: when the stand has an `_idle.webm`, the renderer draws the `<video>` loop over the
  still (same box, `object-fit: contain`, muted, loop); the still stays underneath so a slow network
  shows the picture first. Reduced motion → no video.
- Tests: pose resolution (named pose, unknown pose → plain, `assim` default from day 13, backdrop reset).

## R3. Kuro's window moods

- Assets: `public/kuro/win_<mood>.png`: `calm`, `favour`, `glance`, `squint`, `nosebleed`, `god`,
  `closer`, `listen`.
- `src/world/desktop/kuro/body.ts` gains a `mood` layer on top of its frame sets: a pure function
  `kuroMood(state, session): Mood | null` — `nosebleed` for the rest of the day after a taboo answer
  (`taboo.ts` already knows the moment), `god` on nights 10–17 while the hand is showing (`raidShowing`),
  `favour` when affinity is in its top band and the chat is open, `listen` while the player types in
  the chat, `glance`/`squint` while the pointer rests ≥ 2 s on a chip the task marks `wrong` (the
  board already knows its wrong chips; expose a `hover` event), `closer` when the HUD heart rate ≥ 110
  (meters-v2) for ≥ 5 s. Null = the existing frame sets. One mood at a time, this order of precedence.
- The mood picture replaces the frame set's image while the mood holds; no new animation.
- Tests: `kuroMood` precedence and bands; never a mood in the title or on a dream night's reading page.

## R4. Battle skins

- Assets: `public/battle/party2/obj_<id>_{stance,strike,hurt}.png` and `obj_<id>_assim.png` (the object
  gone over to the boss's side), 192 px tall, transparent; `public/battle/mons/mon_dNN.gb.png` (days
  4–18, four-tone 64 px ×4, transparent); `public/battle/boss2/boss_{stage1,stage2,stage3,giant,
  defeated}.jpg`; `public/battle/battle_fx_sheet.jpg`, `battle_bg_wide.jpg`, `battle_bg_office.jpg`.
- `foeImage(task)` → `/battle/mons/mon_d<day>.gb.png` when the task's day has one, else the old two.
- `faceOf` / party poses in `boss.ts` read `party2` (stance / strike / hurt per act, `assim` for an
  upgraded object that fights on the boss's side — endings-matrix: upgraded objects are not in the
  party; if the design later puts them opposite, the file is there). `BOSS_IMG` gains stage 3 (hurt,
  under 30 % HP) and `defeated` (the win frame, before the camera beat); `giant` is the backdrop of the
  同化 super-battle. The old files stay until the author has seen both in a run.
- The fx sheet is sliced by CSS (`background-position`) for `flame`, `flash`, `hit`, `shake`, `heal`,
  `smoke`; the existing CSS effects keep working where no slice is wired.
- Tests: `foeImage` per day; snapshot of one party member in each pose.

## R5. The gods' hands, nights 10–17

- Assets: `public/night/hand_d<NN>.jpg` (the real desk at night, the hand of that night's god) and
  `hand_d<NN>.mp4` (4 s, slight motion; day 10 has no clip — the still only).
- On a hand night the `.gap-glow` layer (hud.ts) gains the night's picture: the still as its
  background, the clip (muted, loop) over it when present; the existing pink gap line stays on top of
  the picture's gap. The picture is the whole stage behind the dialogue box, like a backdrop.
- Day 18's hand is Kuro's (night 18 is its own): no god picture; unchanged.
- Tests: the hand layer markup per night (10 still only, 11–17 still + clip), none on other nights.

## R6. Two new looks

- Assets: `public/player/cap.png`, `glare.png` (title busts), `cap_kid.png`, `glare_kid.png`; stands
  `public/player/looks/<look>_<pose>.webp` for all five looks (`stand`, `cross`, `chick`, `phone`,
  `type`, `eat`, `carton`, `scared`, `tired`, `desk`); idle loops `public/anim/looks/<look>_<pose>.webm`.
- `State.names.portrait` grows to `"p1" | "p2" | "p3" | "p4" | "p5"` (variables.json + `gen:state`),
  `PORTRAIT_FILES` gains `p4: "cap"`, `p5: "glare"`. The title's picker turns through five. Saves with
  p1–p3 are untouched. Battle party sprites for the two new looks do not exist yet: in the boss fight
  they fall back to `none`'s sprites (`he-*`/`none-*` files) until drawn.
- The player's standing portrait (dialogue inner lines, dream nights) may use the `looks` stands by the
  same `pose` field as R2 (`who: "me"` lines). Default: the bust as today.
- Tests: picker cycles 5, file map, save migration no-op.

## R7. Posters and stickers (files only, content decides)

- `public/launch/day-NN.v2.jpg` (refined comic-poster versions, days 3–18): `launch.art` in
  `content/tasks` may point at either; no code change. Claude switches the days he picks.
- `public/msgs/stickers/<pack>_<name>.png` (family 20, office 20): a message line may carry
  `sticker: "<pack>_<name>"` and renders the picture (160 px) instead of a text bubble, in both chat
  apps. Strict: unknown sticker = the line's text. Tests: one sticker bubble snapshot per app.

## Order and size

R1 → R2 → R6 → R4 → R5 → R3 → R7. Each job is its own Kiro run with the repo green (`npm test`,
`tsc`) before and after. Assets total about 60 MB under `public/`; nothing is deleted or renamed.

## Status (2026-11-22, built by Claude — Kiro had no credits)

- R1 cutscenes: 478dc4f (layer over the box; `__nt` dev handle). R2 poses + idle loops: 2ae9f00, figure =
  video alone 4117153. R6 looks: 4117153. R4 battle skins: faee263 (stage 3 / defeated art not wired: on
  a dark ground). R5 hands: fd61549 (not seen in a browser yet). R3 moods: ad0117a (glance / squint
  unwired: no hover signal). R7: every launch page on its `.v2.jpg`; stickers as `[贴纸] <name>` /
  `[sticker] <name>` lines (bubbles.ts `STICKERS`), two in day 14's group flood.
- Still to do: the author's pick of poses per line (content), more cuts per day, the hand-night check
  in a real run, glance / squint triggers, battle stage 3 cut-outs.

## R8 (added 2026-11-22, built): the player's own figure — `me` on a line

- A day-file or prologue line may carry `me: "<pose>"` (`LOOK_POSES`: stand, cross, chick, phone, type, eat,
  carton, scared, tired, desk) or `me: ""`. From that line the player's figure stands in their chosen look
  (`/player/looks/<look>_<pose>.webp` + its loop) until `""`, the end of the sequence, or a new backdrop.
- Beside a standing NPC: the player left (`.me`), the NPC right; whoever's line is on is lit, the other dims.
  Alone (the room, no backdrop): centre, over a dim (`.dlg-layer.me-on`). A prop on hides the figure.
- Content (122 fields, zh + en twins): every day's story points, by the player's state at that moment —
  author: 「第三天干完老王的活，吃冷饭之前该是什么样子」 → `tired`; the carton arrival `carton`; the chick
  `chick`; the hand nights `scared`; the prologue's adult scenes stand / cross / phone / type / eat / desk / carton.
