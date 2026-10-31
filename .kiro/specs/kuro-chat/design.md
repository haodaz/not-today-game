# kuro-chat — design

The chat already runs in the dialogue box (dialogue spec: the prompt, the player's box, five turns,
the bedtime line, offline answers). This spec adds the model path behind it, memory, the judgement
and the credits. The backend spec (`../backend/design.md`) holds the server.

## The two paths for one turn

`turn()` (src/world/dialogue/kuro.ts) does one of two things.

- **Online** (`net.online()`: env configured, signed in, a run id): Kuro's box shows a waiting
  line (`…`, ending `kuroWait`: no player's box, no click-through). The client calls the function
  with `{ mode: "turn", run_id, day, text, events }` (`events` = the log slice the client may
  send; the function applies the gate).
  - On a reply: append `chat { q|text, said, answer, offline: false }`. The decay filter runs on
    the reply for display. Kuro's next turn shows it.
  - On any error, timeout (20 s), refusal or `turnsLeft: 0`: the offline answer (or the bedtime
    line) and `chat { …, offline: true }`. Kuro never breaks.
- **Offline**: `offlineAnswer(day, q)` from `content/kuro-days`, and `chat { …, offline: true }`.
  Constants are never decay-filtered (voices.md: code never rewrites content); only model output
  is.

## The `chat` event, extended

`{ q?: number, text?: string, said?: string, answer?: string, offline?: boolean }`. Exactly one of
`q` / `text`, as before. `said` is the words shown (the starter's text for `q`). `answer` is
Kuro's raw reply. The reducer appends `{day, who: "player", text: said}` and
`{day, who: "kuro", text: answer}` to `chatMemory.recent`, keeping the last 2 × N entries
(N = `constants.chatMemoryTurns`, default 12). Old events without `said` / `answer` add nothing.

## Judgement (FR4) — the `judged` event

At the end of the chat beat (the bed is clicked while open, on a day with ≥ 1 chat turn), the
client asks for the day's assessment:
- **online:** the function with `mode: "judge"` (structured output);
- **offline:** the rule scorer.

Either way the result is one event:

```
judged { truth, values, bond: int −2..2, evidence: [{eventId, note}], summary?: string, source: "model" | "offline" }
```

- Event ids are `ev<index>` (the event's position in the run's log). Every cited id is checked
  against the log before the event is appended; uncited ones are dropped. The reducer checks the
  shape and that ids look like `ev<n>`.
- One per day: a second `judged` on the same day is rejected. No chat today, no judgement:
  affinity only grows by talking.
- Fold (kuro-chat FR4, deterministic, replayable):
  - `delta = (truth + values + bond) × k`, with k = `constants.affinityPerPoint` (default 5),
    × `constants.tenderDayAffinityMultiplier` on `stages.tenderDay`;
  - `affinity = clamp(0..100, affinity + delta)`;
  - `judgement.truth/values/bond += …` (clamped to the table's range);
  - each evidence item → `judgement.evidence` `{ day, eventId, note, delta, dims: {truth, values, bond} }`;
  - `summary` (≤ 600 chars) → `chatMemory.summary`.
- The lie-down at the end of the night waits for a pending judgement (online), up to the 20 s
  timeout, then the offline scorer.
- **Rule scorer** (`kuro/scorer.ts`, pure): today's events → the same shape, every point citing an
  `ev<n>`.
  - truth: `looked`, a `task` done in `look` / `self` mode, a right `recognise`, a hard starter
    asked; a `task` done in `let` mode counts −1.
  - values: replies to 小张 / 老周 / 家里, the loan answered.
  - bond: ≥ 2 chat turns, a typed line.
  - Each axis is clamped to −2..2.
  - Notes are string keys `judge.offline.<rule>` (TODO Claude), resolved when the credits render.

## Credits (FR5)

`creditLines` reads `judgement.evidence` in day order. A chat entry's direction comes from its
`dims`; older entries keep `deltaOf(eventId)`. Notes that are `judge.offline.*` keys are shown
through the strings table. Nothing is generated at credits time.

## Decay filter

`decay(text, stage)` (src/world/desktop/kuro/decay.ts) is pure and length-preserving. It is
deterministic per (text, stage): a share of letters by stage (0, 0, 0, .03, .07, .12 for stages 0–5)
becomes ░▒▓ glyphs, chosen by a hash of (text, index). Whitespace and punctuation are kept.

## Memory

The run save's `chatMemory` (replayed from `chat` / `judged`) and the server's `kuro_memory` are
the same content. The server's copy feeds its prompts. A bad-ending restart clears the run save,
and with it the local memory; the server memory belongs to the old run id and is never read again.

## Reply language (correction 2026-11-01)

- Client: `turn()` and `startJudgement()` send `locale: getLocale()` ("zh" | "en") in the body, so it
  follows the settings toggle at the moment of the call.
- Function: `localeOf(body.locale)` (missing or unknown → "zh", the source language).
  `buildSystem(…, locale)` appends a fifth system block, `LOCALE_LINES[locale]`. It is one line and
  the last line of the system prompt. It gets its own block after memory, so the cached first block
  is byte-identical in both languages.
- The rule "Speak English" became "in the reply language fixed at the very end". `JUDGE_ASK` asks
  for notes "in the reply language". The credits show those notes as written. Memory stores turns
  as said.
- The kuro-days content stays in English; the zh line tells the model to render the idiom itself.

## Tests (FR6)

- Property: the scorer and a mocked model path give the same schema; affinity is monotone in the
  sum; the sixth turn is always blocked (client and the function's `decideTurn`).
- Snapshot: day 1's opening; day 14's multiplier fold; day 18's credits from a fixture log.
- Decay filter: snapshot and properties.
