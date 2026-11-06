# NOT TODAY

Built for **Kiroween 2026**, category **Resurrection**.

## What the game is

NOT TODAY is an eighteen-day desktop narrative horror game that runs in the browser. You are a tired co-founder working from a rented room in a rainy city, and every day has the same five beats: boot, open the box, work, look at the desk, shut down. Two monitors show a modern work system and an assistant named Kuro, a black Labrador puppy's head on a small round octopus body; the system gets kinder every day and harder to read. A blind-box case with no sender lets one small box loose each day: eight objects from the player's own years (a knock-off Tamagotchi that starved in 1997, an instant camera, the father's numeric pager, a phone card, a cassette and Walkman, an English-only pocket dictionary, a solar calculator, the first feature phone), and on day 18 a shipping slip. These low-resolution objects are the only things still trying to keep you alive. From day 10 the work is the gods' work: at night a hand reaches out of the gap between the monitors to collect it. The days move only when you lie down; there is no death, only being replaced. Every evening you may talk with Kuro, and Kuro quietly judges you: its opinion is the ending, and the credits are its log of your eighteen days.

## Run and test

```bash
npm install
npm run dev          # http://localhost:5173/?day=1   (?day=N jumps to a day; debug only)
npm test             # vitest, the whole suite
npm run typecheck    # tsc --noEmit
npm run validate     # content checks: day files, objects, missing English strings
```

Play it at [not-today-game.vercel.app](https://not-today-game.vercel.app) (deployed from `main` on every push). English is the default; 中文 is in settings.

The game is fully playable offline: Kuro's evening talk falls back to scripted lines from `content/`. With a `.env.local` (see `.env.example`) the client in `src/net/` talks to the Kuro backend, a Supabase Edge Function in [`supabase/functions/kuro-chat`](supabase/functions/kuro-chat) (shared code in `supabase/functions/_shared/kuro/`): it answers from the day's authored material (`content/kuro-days`, profile, rubric), rolls Kuro's only randomness, and keeps the judgement that becomes the credits. `npm run bundle:kuro` packs the content into the function; `npx supabase functions deploy kuro-chat` ships it.

## How it was built with Kiro

Kiro features used in this repository:

- **Specs:** 52 spec folders under [`.kiro/specs/`](.kiro/specs). Each holds a `requirements.md`; Kiro wrote `tasks.md` for 39 of them and `design.md` for 16. Later changes are dated additions inside the same requirements ("Addition 2026-…", "Correction 2026-…").
- **Steering:** 5 files under [`.kiro/steering/`](.kiro/steering). `product.md`, `voices.md` (the four text sources and their grammar), `tech.md` and `structure.md` are always included; `threejs.md` is included only for files under `src/room/**`.
- **Agent hooks:** 3 `PostFileSave` hooks under [`.kiro/hooks/`](.kiro/hooks).
  - `validate-days-on-save` checks a saved day file.
  - `missing-english-on-save` lists strings missing from `en.json`.
  - `state-tests-on-save` used to run the state tests on every save and was changed (2026-11-03, to save credits) to defer them to one full run at the end of each task.
  - The hooks only report; they never edit content.
- **Autopilot chat (vibe) sessions:** each segment is one prompt that names the spec and its requirement numbers. Kiro then reads, implements task by task, runs `tsc` and the full `vitest`, and reports.
- **The log:** [`docs/kiro-log.md`](docs/kiro-log.md) is where Kiro appends what it decided, what it could not do and what it left for Claude, after each task.

Kiro features **not** used: MCP servers (there is no `.kiro/settings/mcp.json`), Powers, custom agents and skills (`.kiro/` holds only `specs/`, `steering/` and `hooks/`).

## Who did what

- **The author** wrote the story and makes every decision: mechanics, pacing, what the characters say, how the room and the UI look. She playtests the builds and says what is wrong.
- **Claude** (Anthropic) wrote:
  - the content in `content/` (days, replies, tasks, Kuro's days, profile and rubric, strings in zh and en);
  - every spec's requirements and the steering files.
  It also verifies each segment (typecheck, full test run, playing the changed days in a browser), and makes small fixes in `src/` and `tests/` itself when Kiro is idle (a CSS rule, a test's content expectation, a snapshot refreshed after checking it changed only in text); each such commit says so.
- **Kiro** wrote the game code: everything in `src/`, `tests/`, `scripts/` and `.kiro/hooks/`.
  - It works from the steering and the specs, and keeps `tsc` clean and `vitest` green.
  - Content and code never cross. Kiro does not edit `content/`; when it had to, the log says so.
  - Kiro ran on Claude Opus 5.5 (the Kiro session metadata; `docs/kiro-log.md` itself does not name the model).

## Architecture in one paragraph

Vite and TypeScript, no framework, one store. State is `f(day) ⊕ replay(events)`: every player action is an event, and replaying the same log gives the same state. The day is a counter advanced only by lying down; nothing reads the wall clock for story. Everything that is story lives in `content/` as data, read by strict loaders that fail at import, so `src/` holds no story string. The desktop is DOM. Object screens are canvases drawn at integer pixels. The room is a set of photographed stills you turn between, with the collapse drawn by a WebGL shader over them.

## Numbers (from the tree, 2026-11-06)

| What | Number | Taken from |
|---|---|---|
| Days | 18 | `content/days/day-01.json` … `day-18.json` (directory listing); `validate-content` reports `days: 18 files, 0 problems` inside the test suite |
| Tests | 2,156 passing in 130 files | `npx vitest run` |
| Content files | 186 | directory listings of `content/` and its subfolders |
| Specs | 52 folders (39 with `tasks.md`, 16 with `design.md`) | listings of `.kiro/specs/` |
| Steering files | 5 | listing of `.kiro/steering/` |
| Hooks | 3 | listing of `.kiro/hooks/` |

## What is new and what is not

- **Written before the jam**, by the author with Claude: the story, the setting bible, an 18-day branching Chinese gamebook and the watercolour concept art.
- **Made during the jam**, in this repository: all game code, the content tables that turn the gamebook into a playable day loop, and the assets in `public/`.

## Licence

- **Code:** MIT (see `LICENSE`).
- **Story, text and art:** CC BY-NC-ND 4.0, by the author, published at [github.com/haodaz/nottoday](https://github.com/haodaz/nottoday).
