# dialogue — design

One box for everything spoken in the room, door and desk views (and over the desktop): content
lines, choices, and the conversation with Kuro. The queue (`src/world/loop/dialogue.ts`) stays the
single source of what is said; this spec adds paging, voices, the player's box, a per-day history
and the `chat` event. Turns, memory, the model path and judgement stay with kuro-chat.

Also in this change: Kuro's HUD body is 192 px (late-days FR1, only that line).

## State: the `chat` event

- `{ kind: "chat", day, q?: number, text?: string }`: one of the two, never both. `q` is a starter
  question's number (content/kuro-days), `text` what the player typed (trimmed, 1–500 chars).
- Reducer: `chatTurnsToday + 1`; rejected (throws) once `chatTurnsToday >= constants.chatTurnsPerDay`.
  `lieDown` resets `chatTurnsToday` to 0 (the variable table calls it "derived: count of chat
  events on the current day"; replay gives the same count).
- A chat turn also logs the existing step `chat:any` once a day, so the day's chat item ticks.
- Work-beat talk, the ask prompt, 先不聊 and upgrade answers append no `chat` event.

## Content: offline answers

`parseKuroDay` also reads `## Offline answers`: lines `- qN → "…"` and `- free text → "…"`
(strict: anything else in that section that looks like an answer line fails loudly). Result:
`answers: { q: ReadonlyMap<number, string>; free: string | null }`. The answer to a question is
`q.get(n) ?? free ?? idiom`; to typed text, `free ?? idiom`. Constants, never generated.

## The queue

- `DialogueState` gains `page?: number` (default 0): which screen of the current line.
- `Queued` gains `voice?: "kuro"`: its lines are Kuro's (its portrait in the box), and it belongs to a
  conversation (Esc removes every `voice: "kuro"` item).
- New endings:
  - `kuroOffer { object, decline }`: the upgrade offer, choices `upgrade.yes` / `upgrade.no`.
  - `kuroAsk`: choices `kuro.yes` / `kuro.notNow`.
  - `kuroTurn { mode: "chat" | "work" }`: waits for the player's box.
- `endsInChoice` covers all three. `advance(d, screens)` moves to the next screen first, then
  the next line (page back to 0). `lineKey` is `key:line` on page 0 and `key:line:pN` after, so
  each page reveals on its own and old tests keep their keys.

## Layout (pure, `src/world/dialogue/layout.ts`)

- Width table (the "monospace fallback"): CJK, kana, full-width forms and CJK punctuation are
  1 em; everything else 0.6 em. Body 18 px (zh) / 17 px (en).
- `wrap(text, widthPx, px)`: greedy; CJK breaks anywhere, Latin at spaces (a word longer than the
  line is cut). Lines keep their trailing space, so a page is a plain substring.
- Boxes: the line box is 992 px wide, 30 px padding each side (932 px text), three rows; the
  player box is 560 px (500 px text).
- `screens(text, choices, box)`:
  - text pages of at most 3 rows;
  - then choice pages of at most 4 choices and 4 rows (a choice is 1 or 2 rows; its text is
    clamped to two lines);
  - the first choice page shares the last text page when their rows add up to ≤ 3 (the ask
    prompt: one row + two choices, as in the mock).
- Markers: ▼ on a text screen with more text after it; ▶ on the last text screen when no choices
  share it; ▼ on a choice screen when there are more choice pages (the last one cycles to the
  first). A choice is never skipped by a click: only its own button picks it.

## The box (`src/world/dialogue/box.ts`, replaces `dialogueBox` in room/hud.ts)

```
<div class="dlg [inner|sfx] [kuro]" data-screen="i/n">
  <span class="who tag">…</span>  (Kuro's tag: its name only)
  <button class="hist" data-action="dlg-history">↺</button>
  <button class="txt" data-action="loop-advance">page text</button>
  <div class="choices"><button data-action="loop-choice" …>…</button>…</div>
  <span class="more">▼|▶</span>
</div>
```

- The box is a `div` (a choice button cannot sit in a button). It is fixed: 992 × 132 px at
  `bottom: 120px`, overflow hidden. When the player's box is up, it moves to `bottom: 300px`.
- A box with a tag is `tagged`: its text starts below the tag (27 px top padding). The player's
  box (`PLAYER_BOX`: five one-row choices) uses tighter rows.
- Tags:
  - a speaker line: its `who` (content);
  - narration: `dialogue.tag.door` / `.gap` / `.desk` when those strings exist (door view, raid,
    desk view). They do not exist yet, so narration has no tag (TODO Claude).
  - `inner`: italic, no tag. `sfx`: centred, no tag.
  - Kuro: `kuro.name` only; its portrait stands at the box's right end (see the correction
    below). The player: `names.login`.
- History: `session.dlgLog` entries `{ day, who, kind, text }`, written when a line is left
  (advance, choice, Esc) and when the player picks or types. The panel shows today's entries
  plus the line on screen; `dlg-history` opens it, `dlg-history-close`, a click outside or Esc
  closes it. A new day clears the log (syncLoop).

## Kuro (`src/world/dialogue/kuro.ts`)

- The HUD body (`kuro-call`) or the desktop pill pushes the conversation. If a current upgrade
  offer exists (not at night), it goes first; then `kuroAsk` with the line `kuro.ask`. While any
  `voice: "kuro"` item is queued the body is away (the slot is empty, the dot gone). A body click
  while the box is busy queues the conversation after what is there.
- 聊聊:
  - work beats: Kuro says the day's idiom; the player's box offers only `dialogue.ok`; no turn.
  - the chat beat (`clock.beat === "night"`), turns left: Kuro says the idiom; the player's box
    offers today's unasked starters (locale text) and `dialogue.more`, on one page, one row each
    (author 2026-11-01: no 先不聊 here, Esc is the way out; 先不聊 stays in the prompt only).
  - no turns left: Kuro's box shows `kuro.bedtime`, no player box; `session.kuroBedDay = day`.
- A starter or typed text appends `chat` and queues Kuro's offline answer as the next `kuroTurn`.
  A sixth attempt appends nothing and queues the bedtime line; the player's box never renders
  again that day (`kuroBedDay`).
- `dialogue.more` turns the player's box into one text input (`session.kuroInput`, draft in
  `session.kuroDraft`); Enter sends (the controller clicks the input's `data-enter` action).
- 先不聊 (the prompt) / 好。 (work beats) / Esc close the conversation (every Kuro item leaves the queue); the body returns
  along the same path in 320 ms (`m-kuro-back`).
- The player's box (`.dlg-player`) shows when the head item is a `kuroTurn` on its last line and
  last text screen, and `kuroBedDay !== day`. It has its own paging (`session.playerPage`).
- The evening auto-open (`openChatIfDue`) pushes the ask prompt instead of opening the overlay.
- The desktop's small window is only a pill now (last line, online / night dot, `kuro.turns`),
  `data-action="kuro-call"`. The expanded window, its 6 s peek, `kuro-expand` / `kuro-fold`,
  `kuroOpen`, `kuroPeekUntil` and `kuroCall` are gone. `renderKuroMini` is removed; the upgrade
  offer is now a Kuro line in the box.

## Motion

- The reveal wraps only `.txt` (not the tag, history chip, marker or choices).
- Choices inside the box (and the player's box) still wait for the line and enter bottom to top.
- `.dlg-player` is keyed `player`. It rises from the right edge (`m-rise-right`) the first time
  it shows for a Kuro turn.
- The snapshot's `call` is "a conversation is queued". When it ends, the body plays `m-kuro-back`
  (320 ms) from the box's corner. The `.kuro-call` ghost is removed.

## Tests (FR3)

- Snapshots: narration, a two-page line (first and last page), choices, the Kuro prompt, a Kuro
  line with its portrait, the player's box with questions, with the input, the history open.
- Properties:
  - the box's markup carries the same fixed size class for every screen (no inline height) and
    every screen's measured rows are ≤ 3 (text) / ≤ 4 (choices);
  - happy-dom: the rendered `.txt` of every screen, re-wrapped with the width table at the box's
    width, is ≤ 3 lines;
  - after a sixth attempt no render that day contains `.dlg-player`;
  - `chat` replay: the turn count equals the chat events today and resets on lie-down.

## Correction implemented (2026-11-01): Kuro stands at the box's right end

- The tag carries only `kuro.name`; the 56 px face is gone from it (and the 44 px padding with
  it).
- The portrait is a slot, `<span class="kpet kuro-portrait" data-kuro-slot data-state=…>`, at
  the end of Kuro's box. While Kuro is the head item (`kuroInBox`) the HUD corner is empty, so
  the page's only slot is this one. The controller moves the one persistent body
  (`KuroBodyElement`) into it: the same frames, the same crossfade on a state change, and the
  idle pair alternating (its blink).
- Its state (`portraitState`): `busy` while its line is appearing (the reveal on screen is this
  line's and still running at `nowMs`); otherwise the body's own state (`kuroBodyState`), so
  idle by day, `think` in the evening beat, `rest` at night. The motion layer renders again
  when one of Kuro's reveals starts and when it ends, so the state follows.
- Numbers (the mock's, updated): the box is 992 × 132 at `bottom:120`. The portrait is
  200 × 200 (the frames are square), 12 px in from the right edge, feet on the bottom edge
  (`bottom:0`), head 68 px above the top. Kuro's text column ends 24 px left of it: `padding-right`
  is 236 px. The layout uses the same numbers (`KURO_PORTRAIT`, `KURO_LINE_BOX`), so Kuro's
  pages are measured in that column (708 px of text at 18 px, against 932 px for other lines).
  The ↺ chip moves left of the portrait (`right:236px`).
- **The player's box keeps clear of the portrait (decision):** the portrait goes up with its
  box. While the player's box is up, Kuro's box is `raised` (`bottom:300px`; on the desktop
  layer 240 px), so the portrait stands at 300–500 px. The player's box is 120–252 px (60–192 on
  the desktop), so they never meet and nothing has to step aside. Tested from the CSS numbers.
- Narration tags do not change.

## Correction implemented (2026-11-01): ↺ sits beside the name tag

- The box's top edge carries a tag strip (`.tagbar`, left 18 px, top −16 px): the name tag, then ↺
  right after it at the same height (a small square plate, 4 px gap). With no tag, ↺ sits alone at
  the tag's place. Same action (`dlg-history`) and label (`dialogue.history`). The loose circle at
  the top-right, and Kuro's offset for it, are gone.

## Addition 2026-11-01: the player's own portrait for inner lines

- `lineBoxModel` gains `playerPortrait: string | null`. It is set only for an `inner` line whose
  queue item isn't Kuro's voice. Kuro's portrait wins in its own turn, so there are never two.
- `playerPortraitSrc(pronoun, dream)` → `/player/{she|he|none}{_kid}.png`. The pronoun is the
  title card's answer (`state.names.pronoun`; null = 不说 → none).
- `isDreamNight(day, beat)`: the night beat of a day in stages.json `dreamNights`. Then the child
  version (`_kid`) is shown.
- Markup: `<img class="player-portrait" alt="" aria-hidden="true">` in Kuro's slot (right 12 px,
  bottom 0, 200 × 200, `object-fit: contain`, bottom-aligned). It is still: no animation and no
  motion key. The box gets `me` (padding-right 236 px).
- Inner lines are laid out with `KURO_LINE_BOX`, left of the portrait (`geomFor(q, lineKind)`).
- The inner tag stays empty. Narration and speaker lines are unchanged.
- No dialogue snapshot changed: none of the snapshotted screens is an inner line. The new tests
  cover the inner box.
