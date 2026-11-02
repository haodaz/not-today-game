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

## Correction 2026-11-01 (author, after the first live call): Kuro answers in the player's language
The first live call answered a Chinese line in English, because kuro-days stances are written in English. The client sends `locale` ("zh" | "en") with every turn and judge call; the function's system prompt ends with one line that fixes the reply language to that locale (Chinese replies in natural written Chinese, not translated English; the idiom of the day and the constant lines come from content in that language where content has them, otherwise Kuro renders them itself). Judgement notes are also written in that locale, since the credits show them. Memory stores the text as said. Test with a mocked model that the locale line is the last line of the system prompt.

## Addition 2026-11-02 (author): layered answers by affinity
- The function passes Kuro's current opinion of the player into the system prompt as a **bucket**, never a number: `low` (affinity < 30), `mid` (30–59), `high` (≥ 60), computed from the stored judgements exactly as the ending does. A line in the "Today" block: `Your opinion of this player: <bucket>`.
- Content: `content/kuro-days/day-NN.md` may carry a section `## Layered answers`, entries `- unlock: qN → low: "…" | mid: "…" | high: "…"`. These are locked lines like the red-blue ones: when the player asks the unlocking question, the model must reproduce the line for the current bucket verbatim (any reply language), then may continue in its own words. Claude writes the entries.
- The bucket is also what the model sees for the free chat: lower = shorter and more guarded, higher = plainer and closer (profile already says flattery lowers it).
- Tests: the bucket line is present and correct for stored affinities 0, 29, 30, 59, 60, 100; a layered answer's locked text appears in the reply for the matching bucket (mocked model); day files without the section still load.

## Addition 2026-11-02 (author): taboo — generosity is not kindness
When Kuro thinks well of the player it gives more, and some of what it gives is forbidden knowledge. Getting close to the truth hurts. Four consequences, all client-side, all deterministic from content:
- **Nosebleed** (`taboo: "blood"`): the reply shows, then the box's narration line 「鼻子里有东西流下来。」; the player's hand portrait (the night-hand / held-object hand) gets a blood variant (`public/npc/hand_blood.png`, Claude supplies) for the rest of the day; SAN −1.
- **Blur** (`taboo: "blur"`): the screen's text blurs for 20 s (CSS filter on the stage, not on the box), then clears; the next player turn is still allowed.
- **Flicker** (`taboo: "flicker"`): the screen flashes white for one frame; the reply is **not shown** and is **not written to the chat history or Kuro's memory**; the turn is still spent (turnsLeft −1). The player sees only the flash and their own question gone. The server stores the turn as `forgotten: true` so the judgement may cite that the player asked.
- **Errors** (`taboo: "errors"`): the reply shows, then 8–20 error dialogs cascade over the desktop (random titles from `content/strings` `error.*`, seeded by day); each needs a click; the chat is closed for the rest of the day.

Where it comes from: a locked layered answer (the `high` tier) may carry a `taboo` field; the unreadable-word valve (when adopted) always carries `blood`. Free replies never trigger a taboo (the model has no such channel). At most one taboo per day. Rule for the player: the generous answers are the dangerous ones; a low-affinity Kuro is safe and useless.
Tests: each consequence from a mocked reply with the field; flicker leaves no history and no memory turn but spends the turn; one taboo per day; no taboo without the field.

## Addition 2026-11-02 (author): the variable layer
Kuro is never trained. Every turn, the function assembles one context object and hands it to the model; the game changes only content and this object. It has three parts:
1. **Locked** — red-blue lines, layered answers (above), the bedtime line. Enforced in code, not only in the prompt: when the player's line matches an unlock (the day file's `unlock: qN` starters, or a content-listed phrase), the server prepends the locked text to the reply verbatim and asks the model only to continue; a reply that omits or alters it is replaced by the locked text alone.
2. **Dice** — a per-run, per-day seed (`runId`, `day`) already used elsewhere; from it the server derives and writes into the "Today" block: a mood notch (0–3, shifts how many words it spends), one "free line" allowance (whether it may add a sentence of its own today), and the glyph set for the unreadable word when the valve fires. Same run replays identically; a new run differs. The model never sees the seed, only the derived values.
3. **Scores** — the affinity bucket (above) and, from day 13, the count of mistakes the player has caught (`catch` nodes), so it can say "that's the third time".
Tests: the object is pure from (content, events, memory, seed, day, locale); locked text survives any model output; dice values are stable per seed.
