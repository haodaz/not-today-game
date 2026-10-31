# kuro-chat — requirements

The chat beat is the heart of the game (steering/product.md). Data: `content/kuro-profile.md` (who it is), `content/kuro-days/day-NN.md` (daily stance + 3–4 starter questions + scripted answer paths), `content/kuro-rubric.md` (how it judges), constants in `content/variables.json` (`chatTurnsPerDay`, `affinityThreshold`, `tenderDayAffinityMultiplier`).

## FR1. Where and when
- The chat lives in Kuro's small window (desktop-ui FR5). It is open in every beat, but turns only count in the evening beat (after work, before bed). During work beats the window answers with one of the day's constant lines and does not consume turns.
- Five player turns per day (`chatTurnsPerDay`). The sixth attempt shows the constant bedtime line from `content/kuro-days/` and disables input until the next day.

## FR2. Memory
- The run save stores `chatMemory`: the last N turns verbatim (N from constants, default 12) plus a running summary (≤ 600 chars) that the model rewrites at the end of each beat. Day 1 has no memory. Memory is fed into every prompt, so Kuro can refer to yesterday.
- Memory is never readable by the story outside the chat; it is deleted on bad-ending restart.

## FR3. Model path and offline path
- Online: provider from env (`VITE_LLM_PROVIDER`: anthropic | openai | none), key from env, never committed. Prompt = profile + today's stance + memory + the day's allowed tool list (`content/tools-by-day.json`, create with an empty list per day if missing) + the player's line. Output passes through the decay filter (pure function of stage, snapshot-tested) before display.
- Offline (no key or `none`): each starter question has a written answer path in `content/kuro-days/`; free text gets the day's constant "I'm listening" line and still counts as a turn. The game is fully playable offline.
- Tool calls outside the day's list are rejected and logged; Kuro never changes the world except through tools.

## FR4. Judgement
- At the end of the beat, ask the model for JSON `{truth:-2..2, values:-2..2, bond:-2..2, evidence:[{eventId, note}]}` against the rubric. Each `eventId` must exist in the event log (drop uncited claims). Offline: a rule scorer over flags (e.g. `xz_looked_d9`, `boss_what_model`, `bought_battery`, replies events) that yields the same shape.
- Fold into state: `affinity += (truth+values+bond) * k` (k from constants, default 5), ×`tenderDayAffinityMultiplier` on `tenderDay`; append to `judgement.log` one line per evidence item `{day, eventId, note, delta}`.
- Never show a number to the player. Players feel it only in Kuro's tone (stance snippets reference affinity bands: cold / neutral / warm, three variants per day in content).

## FR5. Credits
- Every ending rolls `judgement.log` as the credits: one line per entry in day order, rendered in the plain red/blue style. Built from stored evidence only; nothing generated at credits time.

## FR6. Tests
- Property: offline scorer and model path produce the same schema; affinity monotone in the sum of scores; sixth turn always blocked.
- Snapshot: day 1 opening, day 14 (multiplier), day 18 credits from a fixture log.
