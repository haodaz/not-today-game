# NOT TODAY

An eighteen-day desktop horror game. You are a tired co-founder working from a rented room in a rainy city. Every day: boot, open the box, work, look at the desk, shut down, lie down. Two monitors show a modern work system and an assistant called Kuro, a black Labrador puppy's head on a small octopus body, who gets kinder every day and harder to read. A cardboard box with no sender gives up one childhood object a day: a knock-off Tamagotchi that starved in 1997, a pager, a phone card, a cassette and Walkman, a pocket dictionary, a solar calculator, a dead feature phone. They are the only things still trying to keep you alive.

At night a hand comes out of the gap between the monitors and asks for something. You can hold up an object to be looked at instead.

**Play:** https://not-today-game.vercel.app (work in progress; `?day=N` jumps to a day). English is the default language; 中文 in settings.

Built for **Kiroween 2026**, Resurrection category.

## What is new, what is not

- **Written before the jam, by the author with Claude:** the story, the setting bible, an 18-day branching Chinese gamebook and the watercolour concept art. Published at [github.com/haodaz/nottoday](https://github.com/haodaz/nottoday) under CC BY-NC-ND and playable at [nottodaygame.com](https://nottodaygame.com).
- **Made during the jam (this repository):** every line of game code, the content tables that turn the gamebook into a playable day loop, the design mocks, the generated 3D room and object assets, and the sounds.

## How it was built

Three hands, each with its own job:

- **The author** decides everything: mechanics, pacing, what the characters say, what the UI looks like, what the room feels like. Nothing here was not asked for.
- **Claude** (Anthropic; Claude Fable 5.1 and Claude Opus 5.5, in Claude Code) writes the content and the design: `content/` (replies, days, tasks, browser pages, delivery, Kuro's days and rubric, strings), `.kiro/steering/`, every `requirements.md`, the static HTML mocks in `design/`, the asset pipelines, and this README. Claude writes no game code.
- **Kiro** writes every line of game code from the steering and the specs: for each spec it writes `design.md` and `tasks.md`, implements task by task, and keeps the tests green. Its own notes and the decisions it asked about are in [`docs/kiro-log.md`](docs/kiro-log.md).

Kiro features used: steering (`.kiro/steering/product.md`, `voices.md`, `tech.md`, `structure.md`, `threejs.md`), specs (`.kiro/specs/*`, nineteen so far), and agent hooks (`.kiro/hooks/*.json`: on save, content files are validated against the loaders and the string tables; the state-test hook used to run on every save and was deferred to one full run at the end of each task when its cost in credits showed up; the hooks only report, Kiro decides). The spec flow is the whole workflow: Claude writes the requirements, Kiro writes design and tasks, the author reviews in the browser, Claude writes the next requirements from what the author says.

How a working day with Kiro looks, concretely:

1. The author plays a build and says what feels wrong ("the coffee cup is floating", "I can't tell which app is Claude").
2. Claude turns each remark into a dated addition in the relevant `requirements.md` (search any spec for "Correction 2026-" or "Addition 2026-") and writes one prompt for Kiro that names the spec sections, the files and the tests expected.
3. Kiro implements, keeps `tsc` clean and `vitest` green (1,468 tests in 82 files at the last count), backs up and diffs every snapshot it refreshes, and logs what it decided in `docs/kiro-log.md`.
4. Claude verifies (typecheck, full test run), commits, and walks the changed days headlessly with `script`-side drivers that play each day from its content file, so a regression on day 13 is found without anyone clicking through twelve days first.

Content and code never cross: Kiro does not edit `content/`, Claude does not edit `src/`. When content needs a new field, Claude writes the content first (the strict loaders reject it, so the tree goes red on purpose) and the next Kiro prompt says so.

## Architecture in one paragraph

Vite + TypeScript, no framework, one store. `state = f(day) ⊕ replay(events)`: the player's actions are an event log; replaying it twice gives the same state. The day is a counter that the player advances by lying down. Everything that is story lives in `content/` as data and is validated by strict loaders at import; `src/` contains no story string. The desktop is DOM, object screens are canvases at integer pixels, the room is a set of photographed stills that you walk between, and the collapse of the room is a WebGL fragment shader that dissolves the photo into its edited later stages (the Gaussian-splat version of the room is still there behind `?splat=1`).

## Content

| Folder | What |
|---|---|
| `content/days/` | the checklist, dialogue lines and night beat of each day |
| `content/replies/` | every day × every person × every word the player can say, and what comes back |
| `content/tasks/` | the work tasks as three-path trees (do it yourself / let it do it and look / let it do it) |
| `content/delivery.json` | the phone, the shops, 18 days of what is at the door |
| `content/browser/` | one newspaper page per day: the outside world |
| `content/kuro-days/`, `kuro-profile.md`, `kuro-world.md`, `kuro-rubric.md` | who Kuro is, what it may know each day, how it judges the player |
| `content/objects.json`, `upgrades.json`, `nights.json` | recognising the objects, Kuro's upgrade offers, what the hand wants |
| `content/replies/family.json`, `clan.json` | the parents' group and the big family group: 18 days of 吃饭了吗, showing off, probing, forwarding |
| `content/npc.json`, `desk.json`, `stages.json` | who has a face, where things sit on the desk, which nights are dreams |
| `content/strings/` | zh (source) and en |

## Assets

Generated during the jam; see `public/README.md`.

- Room: Gemini video → COLMAP → Brush → `.splat`; the room, desk and door views are stills from the same shoot, and each stage of the collapse (wall, otherworld, glitch, white) is an image edit of those stills (wan2.6-image), blended by the shader.
- Objects: Hunyuan3D-2.1 shape from the watercolour cutouts, with the painting projected back onto the mesh.
- Kuro's sprite states: Meta Muse Image, aligned by head, crossfaded in the game; the giant three-headed Kuro of the good ending the same way.
- People: the player (faceless, hair over the eyes; adult and child) and the NPCs (老王, vivi, 小张, 老周, the teacher, the parents) are Muse Image watercolour busts, white-keyed; relatives in the big family group are silhouettes.
- Food, door wall, the things on the desk (cup, phone, box, slip): Muse Image, keyed from white or green.
- The old office of the day-11 dream: Qwen-Image.
- Theme song 「今天不可以 / Not Today」: lyrics by the author, sung in four voices (zh/en, male/female) with Suno; it plays only on the title, the credits and the walkman after an ending. Day and night beds, stingers, the doorbell, the pager buzz, the chick's beep and the footsteps: Suno Sounds and ffmpeg, listed in `public/sfx/README.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173/?day=1
npm test
npm run typecheck
```

Optional `.env.local` (see `.env.example`) for Supabase; without it the game runs fully offline with Kuro's scripted lines. Online, Kuro is Claude behind a Supabase Edge Function (`supabase/functions/kuro-chat`): it talks in the player's language, remembers the run, and judges the eighteen days from the event log at the end.

Kuro is the only character with a model behind it; everyone else is written. The function never trains anything. Each turn it assembles one context: who Kuro is (`content/kuro-profile.md`), what it may know that day (`kuro-world.md`, `kuro-days/`), what it remembers, and a variable layer:

- **Locked lines.** Some answers are fixed (the red-blue lines, and a low/mid/high answer per question chosen by Kuro's opinion of the player). The server inserts them verbatim; the model only continues after them.
- **Dice.** A seeded d100 per run, day and question. Kuro's opinion of the player does not change the game, it moves the thresholds: a well-liked player gets more critical successes (an unreadable word, a nosebleed) and fewer critical failures (the answer flickers and is forgotten, the turn still spent).
- **Scores.** After each evening's talk Kuro scores the day on truth, values and bond, citing event ids; the sum decides whether the good ending is open.

Some questions only appear when Kuro thinks well of you, and the generous answers are the dangerous ones.

## Licence

Code: MIT. Story, text and art: CC BY-NC-ND 4.0 (the author, 好大壮 / Elodie Hao Liu). Kuro is played by Claude. The author credits Claude openly for its share of the writing; what is hers and what is Claude's is described above.
