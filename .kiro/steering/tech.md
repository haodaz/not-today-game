---
inclusion: always
---

# Tech — architecture rules

Stack: Vite + TypeScript, no large framework, one store. Rendering: DOM for the two monitors' software, `<canvas>` for every object screen, three.js only for the room (if a 3D room is built at all; a 2D parallax room is acceptable for the hackathon build).

## State

- **State is a function of time, not an accumulation of operations.** `state = f(day) ⊕ replay(events)`. `day` is a counter in the run save that increases by exactly one on the `lie-down` event; it never reads the wall clock (decision 2026-10-30). Stage is derived from day by the table in `content/stages.json`. Player actions are appended to an event log (open layer, press key, reply, let-it-do, looked, poke reset, lie down, hand object to the hand). Replaying the same log twice must give identical state.
- **Time of day is story, not clock.** Within a day the five beats give the "time" (morning boot, work, evening desk, night). The wall clock is read only for cosmetics (e.g. a timestamp in a chat bubble) through one injectable `Clock` so tests stay deterministic. `?day=N` remains as a debug jump that builds the day-N state by replaying nothing; it is not a feature.
- **Single source of truth.** Every object and every piece of new-world UI is a pure view of the store. Objects never talk to each other and never write state directly; they emit events.
- **Two save slots, separate.** The run save (`nt_run`, cleared on bad-ending restart) and the cross-run profile (`nt_profile`, never cleared, never readable by the story: it only feeds the title page). Saves carry an integer `version`, migrate forward step by step, write to a temp key then rename, keep the previous good save.

## Objects ("device skeleton")

An object is three things: which state fields it subscribes to, its render channel (width, height, colour depth, character set), and which inputs it accepts. Six objects are six instances of this skeleton. Object bodies may be 3D or illustrated; object screens are always drawn at integer pixels with `image-rendering: pixelated`, never anti-aliased. Dream state = the screen gains resolution = it can be seen. Danger is resolution, not 3D.

## Kuro

- Work tasks do **not** call an LLM. Each task is a hand-written quick-reply dialogue tree from `content/tasks/`. Completion is decided deterministically by which tool calls happened.
- The free chat beat (after work, before bed) **may** call a real LLM. Its influence on the world goes only through tools. Each day has a fixed tool allow-list (`content/tools-by-day.json`); calls outside the list are rejected and logged. A daily steering snippet (`content/kuro-days/day-NN.md`) sets its stance. Its daily idiom is injected as a constant, never generated. Its output passes through the **decay filter**, a pure function that replaces a stage-dependent share of characters with unreadable glyphs; snapshot-test it.
- The chat beat has memory: a compact per-run transcript summary (last N turns plus a running summary) is stored in the run save and fed back as context, so Kuro can refer to earlier days. Hard cap of five player turns per day; the sixth attempt gets the constant bedtime line from `content/` and the input closes until tomorrow.
- **Kuro's judgement of the player** is a structured assessment, not free text: at the end of each chat beat the model is asked for JSON `{truth: -2..2, values: -2..2, bond: -2..2, evidence: string[]}` against a fixed rubric in `content/kuro-rubric.md`, where every evidence item must cite a real event id from the log (checked in code; uncited claims are dropped). The game folds these into `affinity` and `judgement` in state with a deterministic formula. Offline (no key) a rule-based scorer over flags produces the same shape. The good ending reads `affinity >= constants.affinityThreshold`; a property test guarantees the offline scorer and the model path write the same schema.
- If no LLM key is configured, the chat beat falls back to scripted lines from `content/` (each starter question has a written answer path). The game must be fully playable offline.

## Content vs code

Everything that is story lives in `content/` as data: day files, sentence pools, the child's message schedule, the dictionary table, task trees, strings, pixel frames. Code reads and renders. Nothing in `src/` contains a story string. This keeps the hackathon code clean and lets the content be ported later.

## Quality gates (hooks enforce these)

- Any change under `src/state/**` runs the object render snapshot tests.
- Any change under `content/days/*.json` validates: five beats present, every `delta` key exists in the variable table, every referenced string key exists in `zh.json`.
- Any change to `content/strings/zh.json` lists keys missing from `en.json`.
- Property-based tests for: stage(day) monotonic; replay idempotent; decay filter length-preserving and deterministic; reply-option shrink never adds an option after a stage removes it.
