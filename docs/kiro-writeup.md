# How Kiro was used — NOT TODAY (Kiroween 2026)

Draft for the Devpost "write-up on how Kiro was used" field. Numbers are taken from the tree on
2026-11-12; update them before submitting (`npx vitest run`, `ls .kiro/specs | wc -l`).

## In one paragraph

NOT TODAY is an 18-day desktop horror game about an AI assistant that takes over your job. It was
built with Kiro IDE in spec-driven mode from the first commit: every feature started as a
requirements file under `.kiro/specs/`, five steering files set the product, the voices, the
structure and the technical rules, and three hooks act as quality gates on save. Kiro wrote the
game code; a human author made every decision; Claude wrote the story content and the specs. The
whole history is public: `.kiro/` is at the root of the repo, and `docs/kiro-log.md` is Kiro's own
log of every job (2,600+ lines).

## Which Kiro

- **Kiro IDE**, spec mode, on Claude Opus 5.5 (the session metadata). No Kiro CLI, Web or Crew.
- One developer seat; a second person (the author) reviewed in the browser and in play.

## Specs vs vibe

Spec-driven, almost entirely. There are **63 spec folders** under `.kiro/specs/`. Each job Kiro
did began with `requirements.md` written in English by Claude from the author's decisions; Kiro
wrote `design.md` and `tasks.md` where the job needed them (16 designs, 39 task lists at the last
count), then implemented, then logged what it did and what it decided in `docs/kiro-log.md`.

A few things show how the specs were used, not just filed:

- **A spec can be superseded in part.** When the author changed the ending matrix (five endings
  instead of four), the new spec `endings-matrix` names what it replaces, and the two older specs
  (`three-meters`, `san-and-endings`) carry a one-line "superseded in part" note at the top. Kiro
  reads the current one and does not re-implement the old rule.
- **Corrections are specs too.** When the author played a build and said what was wrong, the
  correction went into the same spec as a dated section ("correction 2026-11-01"), not into a chat
  message. The log entries are titled by spec.
- **The boundary is in the spec.** Every requirements file says what Kiro must not touch: the
  `content/` folder (story, replies, strings) is written by Claude; when a string Kiro needed did
  not exist, the spec told it to stop and report the key rather than invent text. The log shows it
  doing exactly that (for example the `endings-matrix` job reported one line that broke a voices
  rule instead of editing it).

"Vibe" was used for one class of work only: small visual fixes after a playtest, listed in the log
under "six fixes (no new spec)" and similar headings.

## Steering strategy

Five files in `.kiro/steering/`, all `inclusion: always`:

- `product.md` — what the game is, the three tracks (Resurrection / Skeleton Crew /
  Frankenstein), the theme ("the horror is not the AI, it is what this era does to people").
- `voices.md` — the four sources of text in the game and the grammar of each (narration,
  the new world, the objects, the child), plus the hard rules: never name the thing; the hand-written
  constants no code may generate or "polish"; horror by format, not by gore; Chinese is the source
  language and English is a real localisation, never machine-translated.
- `structure.md` — the folders and what lives where; `content/` vs `src/`.
- `tech.md` — the architecture rules Kiro built against: state is a function of the day plus a
  replayed event log; a fakeable clock; a single store; one object = what it may read, draw and press;
  LCDs drawn at integer pixels; the collapse filter as a pure function with snapshot tests; tasks are
  hand-written trees, the LLM only speaks in the chat beat and only through a fixed tool list.
- `threejs.md` — the one library-specific file (the room's splat / three.js layer).

The strategy: steering holds the rules that never change; specs hold the work. When a rule did
change (the day-18 pull-out, the three meters, the ending names), the spec said so and the steering
was updated in the same commit, so Kiro never had two sources of truth.

## Hooks

Three `PostFileSave` hooks in `.kiro/hooks/`, all "agent" hooks that run a script and report:

- `validate-days-on-save` — saving any `content/days/*.json` runs `npm run validate -- --days`
  (five beats present, effect keys against `variables.json`, string keys against `zh.json`) and
  reports each problem line as-is.
- `missing-english-on-save` — saving `content/strings/zh.json` lists the keys missing from
  `en.json`; the hook is told the English is a human's to write and must not fill it in.
- `state-tests-on-save` — originally ran the state tests on every save under `src/state/`; on
  2026-11-03 it was deliberately changed to *defer* (reply "deferred", continue the task, run the
  full suite once at the end) to save credits. The hook file keeps that history in its description.

## Testing

- **2,391 tests in 168 files** (vitest), all pure: the state layer is reducers over an event log,
  so a whole 18-day run can be replayed headlessly in a test.
- **Property-based testing with fast-check**: 92 `fc.property` calls across 40 test files. Examples:
  SAN never leaves 0..100 whatever the run does; an ending fires exactly once per run; the
  day-18 pull-out's island only shrinks and the dark only grows; the match-3 board never has a
  move-less state after a refill; the sokoban levels are solvable (BFS) and a known solution
  replays.
- **Snapshot tests** for rendered pages (the credits, the ending pages, the title room) with the
  rule that a snapshot may only be refreshed after a word-level diff shows a content-only change,
  and the commit message says so.
- **Headless replay driver** (`script/tools/auto-day-shoot.mjs`, written by Kiro from a spec):
  plays a whole day against a static build, following the game's own guidance hints, and saves a
  frame per click; days 1–18 are replayed before a push.

## MCP, custom agents, powers

None. The project did not need an MCP server (no external data), and the hooks were enough as
"agents". This is stated plainly rather than padded.

## Who did what (honest version)

- The **author** wrote the story and makes every decision — mechanics, pacing, the characters'
  lines, how the room and the UI look — and playtests every build.
- **Claude** wrote the content under `content/` (days, replies, tasks, Kuro's rubric, zh and en
  strings), every spec's requirements and the steering files, verifies each job (typecheck, full
  suite, playing the changed days in a browser), and makes small fixes in `src/` itself when Kiro is
  idle; each such commit says so.
- **Kiro** wrote the game code: `src/`, `tests/`, the scripts and the hooks, from the steering and
  the specs, keeping `tsc` clean and `vitest` green.

Pre-existing work disclosed: the story, the gamebook and the concept art were written before the
hackathon; the game code was started on 2026-10-30 (the first commit is `.kiro/` and an empty
skeleton).

## What we learned about Kiro

- A spec that says what *not* to touch is worth more than one that lists features: the
  content/code boundary never leaked in 600+ commits.
- Dated correction sections in the same spec beat new specs for small changes; the log stays
  readable by spec name.
- Hooks are best as gates that *report*, not fix; the one hook that ran tests on every save was the
  first thing we turned down when credits mattered.
- Kiro reads English steering far more reliably than mixed-language prose; the game is Chinese
  first, the steering is English only.
