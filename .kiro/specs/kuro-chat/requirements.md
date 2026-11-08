# kuro-chat — requirements

The chat beat is the heart of the game (steering/product.md). Data: `content/kuro-profile.md` (who it is), `content/kuro-days/day-NN.md` (daily stance + 3–4 starter questions + scripted answer paths), `content/kuro-rubric.md` (how it judges), constants in `content/variables.json` (`chatTurnsPerDay`, `affinityThreshold`, `tenderDayAffinityMultiplier`).

## FR1. Where and when
- The chat lives in Kuro's small window (desktop-ui FR5). It is open in every beat, but turns only count in the evening beat (after work, before bed). During work beats the window answers with one of the day's constant lines and does not consume turns.
- Six player turns per day (`chatTurnsPerDay`; five until 2026-11-09, six since: 六六大顺 for the player, the beast for the judges). The seventh attempt shows the constant bedtime line from `content/kuro-days/` and disables input until the next day.

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

## Addition 2026-11-02 (author): the d100 and the moving thresholds
Before a locked high-tier answer is given, the server rolls a d100 from the seed (the dice above). The system never changes; the thresholds move with the affinity bucket:
| bucket | 大成功 (the unreadable word, blood) | 大失败 (flicker: reply forgotten, turn spent) | otherwise |
|---|---|---|---|
| low | 1 | 85–100 | the locked line |
| mid | 1–3 | 96–100 | the locked line |
| high | 1–8 | 100 | the locked line |
Fate stays uncertain at every level; what affinity buys is fewer bad numbers, not a different game. The roll is never shown; the player only sees that the same question sometimes returns a line they cannot read and sometimes a blank. Tests: thresholds per bucket; the roll is stable per (seed, day, question); a 大成功 and a 大失败 can both still happen at high.

## Addition 2026-11-02 (author): affinity opens questions, not only thresholds
The variable layer must not be the whole of it. Content decides what can be asked: each starter question in `content/kuro-days/day-NN.md` may carry `minBucket: low|mid|high`. The chat shows only the starters the current bucket allows; the deeper questions (the ones whose locked answers can hurt) exist only for a Kuro that thinks well of the player. Free typing is always allowed, but a typed question only unlocks a locked answer if its starter is open today. Tests: starters filtered per bucket; a typed match on a closed starter gets a free reply, not the locked line.

## Correction 2026-11-02 (author): the unreadable word is made by the server, not the model
The earlier idea of a "valve" that lets the model write one unreadable word is withdrawn. On a 大成功 the server builds the word from the seed's glyph set (3–5 glyphs from one non-Latin, non-CJK script such as Vai, Ogham or Glagolitic, never mixed), inserts it as its own line after the locked text, and appends the locked follow-up 「刚才那一行，我自己读不出来。」 / "I can't read that line myself." The model is never told the word or the mechanism; it only continues after. Randomness stays in the server's dice, never in the model. One taboo per day: after it fires, later rolls that day return the plain locked line.

## Decision 2026-11-09 (author, after building a life simulator): the deterministic core
"是不是 AI 来执行是 side." The chat's core is content and judgement; the model is a switchable extra.
- **Starters are answered on the client**, never by the function: `src/world/dialogue/core.ts` reads the day file's locked parts (the same shared parser and dice as the function: `@kuro/variable.ts`), picks the tier for the bucket (`state.affinity`, as the ending reads it), rolls the d100 from (runId, day, q) with the bucket's thresholds, and plays the taboo (blood with the unreadable word and `kuro.unreadable`; flicker; the high tier's own). One taboo a day. A red-blue line is said as written. A starter without a locked line gets its written answer (until every starter has three tiers). Online or offline, the same answer; the chat event is logged `offline: true` (anything but the model).
- **The model answers typed text only** (「说点别的…」) when online; offline, the day's free line. The function completes its memory from the log's chat events on every call (`withLogChats`), so the count of turns and the model's recall cover the starters the client answered.
- **Follow-ups (追问)**: a starter's sixth table cell `after: qN` (asked today) or `after: dD.qN` (asked on day D) keeps it out of the pool until that question was asked. A follow-up raised by the day's last turn waits for tomorrow's pool.
- **The sixth time**: the same question asked six times in a run — picked or typed, counted by its text across days — gets the worn-down answer from `content/kuro-repeat.md` (one run-wide file: the sixth ask can fall on any day). Kuro gives in; it never apologises.
- **Same question, different day**: a question's answer belongs to the day's record, so the name question on day 1 and on day 17 answer differently by content alone.
- Arc of the pools (author): days 1–3 technology and work only; 4–6 technology-sounding but occult; 7–9 the nature of the change; from day 10 questions about Kuro, the world or the essence reach the truth but cannot be looked at straight.
- Tests: `tests/kuro-core.test.ts` (no function call for a starter; the tier per bucket; 大成功 / 大失败 from a found seed; one taboo a day; red-blue never rolls; every real layered answer reachable; follow-up parsing and gating; the sixth time by text across days). The taboo consequences are still tested through typed text with a mocked function.

## Additions 2026-11-09 (author, the same evening): the pool, the turns, the repeats
- **Six turns a day** (`chatTurnsPerDay` 6): 六六大顺 for the player, 666 for the judges; the seventh attempt is the bedtime line. The sixth ask of one question is the worn-down answer, so a day spent on one question ends differently.
- **The pool pages by five**: the player's box shows five questions and 「说点别的…」; that row turns the page and wraps round; a pool of five or fewer has no such row. Typing has no row (the model's channel is a side; the actions stay for tests and tools). The workbench's question chips show the same pool.
- **Asked questions stay in the pool**: a question can be asked again and again the same day; the core answers word for word the same (the roll is per run, day, question; one taboo a day) until the sixth time.
- **Follow-ups come first, tagged** `kuro.followUp` (（追问） / (follow-up)).
- **Every day's pool is 9–10 questions from the player's side**, built from that day's events (content/days, replies, boxes, dreams of the night before), on the author's slope: 1–3 technology and work; 4–6 technology-sounding but occult; 7–9 the nature of the change; 10–18 Kuro, the world, the essence. Every question has three tiers (zh + en); red-blue lines stay single and English; the high tiers from day 10 carry taboos (errors / blur / blood / flicker, at most one fires a day). The cold-water cup is gone except where the story has it (day 3's moved cup).
- **Offline scorer**: `judge.offline.followed` (truth +1: asked a follow-up) and `judge.offline.sixth` (bond +1: the sixth ask of a question).
- **The replay driver** (scratchpad `auto-day-shoot.mjs`) plays the chat every night: 聊聊, up to `CHAT_TURNS` (6) questions with a page turn every other time, reads the answers on, clicks an errors cascade away.
- **The guarantee** (borrowed from the author's 1job1life engine, 「到窗口最后一年必出」): from day 10 (`PITY_FROM`), a run that has had no taboo gets one on its first layered ask — the tier's own at high, else a blur — so a single playthrough still meets the price of a generous answer. `script/tools/kuro-lint.mjs` reports clauses repeated across days (borrowed from her card-repetition lint).
