---
inclusion: always
---

# Tech — architecture rules

Stack: Vite + TypeScript, no large framework, one store. Rendering: DOM for the two monitors' software, `<canvas>` for every object screen, three.js only for the room (if a 3D room is built at all; a 2D parallax room is acceptable for the hackathon build).

## State

- **State is a function of time, not an accumulation of operations.** `state = f(day) ⊕ replay(events)`. `day = realCalendarDay - startDay + 1`. Stage is derived from day by the table in `content/stages.json`. Player actions are appended to an event log (open layer, press key, reply, let-it-do, looked, poke reset, lie down, hand object to the hand). Replaying the same log twice must give identical state.
- **The clock must be fakeable.** `CLOCK_OVERRIDE` env var or `?day=N&t=HH:MM` URL param. Demo mode compresses a day to about 90 seconds. Tests always run on a fake clock.
- **Single source of truth.** Every object and every piece of new-world UI is a pure view of the store. Objects never talk to each other and never write state directly; they emit events.
- **Two save slots, separate.** The run save (`nt_run`, cleared on bad-ending restart) and the cross-run profile (`nt_profile`, never cleared, never readable by the story: it only feeds the title page). Saves carry an integer `version`, migrate forward step by step, write to a temp key then rename, keep the previous good save.

## Objects ("device skeleton")

An object is three things: which state fields it subscribes to, its render channel (width, height, colour depth, character set), and which inputs it accepts. Six objects are six instances of this skeleton. Object bodies may be 3D or illustrated; object screens are always drawn at integer pixels with `image-rendering: pixelated`, never anti-aliased. Dream state = the screen gains resolution = it can be seen. Danger is resolution, not 3D.

## Kuro

- Work tasks do **not** call an LLM. Each task is a hand-written quick-reply dialogue tree from `content/tasks/`. Completion is decided deterministically by which tool calls happened.
- The free chat beat (after work, before bed) **may** call a real LLM. Its influence on the world goes only through tools. Each day has a fixed tool allow-list (`content/tools-by-day.json`); calls outside the list are rejected and logged. A daily steering snippet (`content/kuro-days/day-NN.md`) sets its stance. Its daily idiom is injected as a constant, never generated. Its output passes through the **decay filter**, a pure function that replaces a stage-dependent share of characters with unreadable glyphs; snapshot-test it.
- If no LLM key is configured, the chat beat falls back to scripted lines from `content/`. The game must be fully playable offline.

## Content vs code

Everything that is story lives in `content/` as data: day files, sentence pools, the child's message schedule, the dictionary table, task trees, strings, pixel frames. Code reads and renders. Nothing in `src/` contains a story string. This keeps the hackathon code clean and lets the content be ported later.

## Quality gates (hooks enforce these)

- Any change under `src/state/**` runs the object render snapshot tests.
- Any change under `content/days/*.json` validates: five beats present, every `delta` key exists in the variable table, every referenced string key exists in `zh.json`.
- Any change to `content/strings/zh.json` lists keys missing from `en.json`.
- Property-based tests for: stage(day) monotonic; replay idempotent; decay filter length-preserving and deterministic; reply-option shrink never adds an option after a stage removes it.
