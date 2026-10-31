# replies — design

## 1. Scope

`replies` plays the finished data in `content/replies/` (`day-01..18.json`, `family.json`). It is
an engine layer with no rendering. It answers three questions, and every answer is plain data
that desktop-ui renders:

1. **What can the player say?** `menu(day, recipient, state)`
2. **What does a word mean right now?** `resolve(day, recipient, word, state)`
3. **What happens over time?** `planReply(...)` / `planIncoming(...)` return ordered steps
   (deliver a line, show 已读, show 正在输入, recall, disable input) for the UI to run.

State changes go only through the world-state event log. Sending a word appends one `reply` event.
Its reducer applies the entry's `effects` and consumes a lent object word. `src/` contains no story
string and no UI copy. Steps carry raw content text (placeholders unfilled) or string *keys*, and
desktop-ui owns 已读 / 正在输入 / `[撤回了一条消息]` copy.

## 2. Decisions taken (please review)

These come from reading the data. Each is implemented as described and is easy to change.

- **D1. The loan reducer ignores replies that carry a recipient.** In the data, `no` appears as a
  normal word to five people on day 5. With the world-state reducer as written, saying `no` in the
  group on day 5 would refuse the loan. The loan choice (`lend` / `no`) is not in any reply table,
  so it must come from another prompt. Fix: `reply` events gain an optional `recipient`, and the
  loan reducer only reacts to recipient-less replies. All world-state tests still hold.
- **D2. Shrink means shrink.** "A word absent from `replyOptions` is `gone`" is applied only to the
  words in the *default* `replyOptions`. Nothing derives `replyOptions` yet, so applying it to
  every word would grey out `what-llm`, which the data makes live from day 11. Additions come from
  the day table and removals from either the table's `gone` or `state.replyOptions`.
- **D3. Object words: one use, globally, per FR1.** A lent word is on the menu only while its
  object is in `found` and `objectWords[x].used === false`. Sending it sets `used = true`, and after
  that it is `gone` everywhere. **This makes most of the content unreachable.** For example, `no`
  has 70 cells across 13 days, and only the first one sent would ever play. If `used` should reset
  per day or per recipient, it's a one-line change in `objectWordState`.
- **D4. `cond_show: {has: X}`.** True if `flags` contains `X`, or if `X === "lent"` and `loan` is
  `lent` or `repaid`. The second branch is needed because the day-12 "钱我还你了" lines are gated
  on `has: lent`, and `loan` turns `repaid` on day 12. When an entry's condition fails it resolves
  to `read` with no lines and no inner, the README's neutral "已读不回". Incoming items whose
  condition fails are not delivered.
- **D5. Deregistered recipients.** The data has no field for it. A recipient is deregistered once a
  marker flag is in `flags`: `xiaozhang ← xz_left` (day 13) and `laozhou ← lz_gone` (day 16). The
  table lives in one place (`DEREGISTERED_BY_FLAG`). A structured field in content would be better,
  as a TODO for Claude.
- **D6. The family day-15 input-box message** is marked only by a note and the flag
  `family_in_input`. An incoming item whose `effects.flags` contains that flag is planned with
  `placement: "ownInput"`, and every other item gets `"received"`.
- **D7. Durations.** `s`/`min`/`h` are real-time milliseconds and `1d` is `nextBoot`. A `read` with
  no `readAfter` (63 entries) shows 已读 immediately. Typing (4–8 s) and recall (2–5 s) delays are
  pseudo-random but seeded by `day:recipient:word`, so a plan is deterministic and
  snapshot-testable.
- **Incoming effects are day-driven.** Incoming items arrive whether or not the player replies, so
  their `effects.flags` are added by `derive` for every day ≤ `state.day`. This follows the same
  pattern as the loan repayment, it's idempotent because flags are a set, and it holds under
  `?day=N`. Incoming effects may only contain `flags`; the loader rejects anything else, because
  `san` deltas would not be idempotent.

## 3. Modules

```
src/state/replies/
  table.ts      loads day-*.json (import.meta.glob) + family.json → ReplyTable; schema guard
  duration.ts   parseDuration("3s" | "40s" | "2min" | "1h" | "1d")  (here, not world/: the guard needs it)
  resolve.ts    condHolds, objectWordState, isDeregistered, menu, resolve
  effects.ts    applyReplyEvent (reducer for reply-with-recipient), applyIncomingFlags (for derive)
src/world/replies/
  seed.ts       seeded jitter in a range (pure)
  placeholders.ts  fillPlaceholders(text, names): {calledBy} {bossCalls} {nick} {login}
  labels.ts     labelKey(recipient, word) → strings key; GONE_HINT_KEY
  plan.ts       planReply, planGoneClick, planIncoming, evidencePool
```

Alias `@world` → `src/world/` was added to `vite.config.ts` and `tsconfig.json`.

`src/state` changes: `events.ts` (`reply` gains `recipient?`, `text?`), the loan guard (D1), and the
reply case calls `applyReplyEvent`. `fday.ts` `derive` adds `incomingFlags`.

## 4. Data model

```ts
type Recipient = "boss" | "partner" | "group" | "xiaozhang" | "laozhou" | "family";  // checked against the table
type Status = "reply" | "read" | "typing" | "recalled" | "silence" | "gone";
interface Line { who: string; t: string; text: string }
interface Entry { status; lines: Line[]; readAfter?; interrupt?: Line & { where }; effects?: { san?, flags? };
                  inner?; cond_show?: { has: string } }
interface Incoming { t; text; kind: "work" | "money" | "private" | "odd"; cond_show?; effects?: { flags? }; note? }
ReplyTable: day → recipient → { incoming: Incoming[]; cells: Map<word, Entry> }   // family.json normalised in as "family"
```

The loader keeps the content objects as they are and never rewrites a string. The schema guard
checks the known statuses, line keys, `effects` keys, `HH:MM` times, parsable `readAfter`, and
known placeholders. It fails loudly at import time.

## 5. Resolve

- **`menu(day, recipient, state)`** lists the words of that day's cells, in table order, each
  marked `kind` (`base` | `object` | `free`) and `gone`. Object words appear only while their
  object is in `found` and unused (D3). Days without a table give an empty menu.
- **`resolve(...)`** returns `null` for a word that is not on the menu. Otherwise it returns:
  - `{ status: "gone", inner, reason: "content" | "shrunk" | "used" }`. `inner` is the cell's inner
    line or `null`, and an empty string counts as `null`.
  - Otherwise, `{ status, entry, deregistered }`. A failed `cond_show` gives the neutral entry (D4).
- **FR5 property:** every menu word, for every day and recipient, under random states, resolves to
  an entry or `gone`.

## 6. Reducer (reply with recipient)

`applyReplyEvent(state, event)` resolves at `event.day` against the state so far, then:
- If the result is `null`, `gone`, or deregistered, it does nothing. Nothing was sent.
- Otherwise it marks a lent object word as `used`, adds `effects.flags` to `flags`, and adds
  `effects.san` to `san`, clamped to the table's range.

The event itself is the citeable `reply:{day,recipient,word}` for Kuro's rubric. Free text is
stored in the event's `text`; it is the player's own input, not story.

## 7. Plans

A plan is an ordered list of `Step { at: Timing; action: Action }`, and the UI runs the steps in
order. Each timing is measured from the previous step:

```
Timing = { now } | { afterMs: n } | { atBeat: "HH:MM" } | { nextBoot }
Action = own(conversation, word, text?) | deliver(conversation, line, badge?, placement?, noReadReceipt?)
       | readReceipt(conversation) | typing(conversation, on) | recall(conversation, count)
       | disableInput(conversation)
```

- **Line timing:** a line whose `t` is earlier than or equal to the current beat time (`now`) is
  delivered immediately with its own timestamp. A later line waits for `atBeat t`.
- **`planReply`** returns `{ steps, inner }`. `inner` is shown under the reply bar for one beat from
  the moment of sending, and is never part of the conversation.
  - **reply:** `own`, then the lines.
  - **read:** `own`, then `readReceipt` after `readAfter`.
  - **typing:** `own`, `typing on`, then `typing off` after 4–8 s.
  - **recalled:** `own`, the lines, then `recall(n)` after 2–5 s.
  - **silence:** `own` and no receipt. If deregistered, `disableInput` only, with no `own`.
  - **interrupt:** appended after the above, as `deliver(where, …)`. It is badged only when
    `where` is a different conversation from the one the player is in (day 1 boss `salary`
    interrupts in the boss chat itself, so no badge).
- **`planGoneClick`** returns `{ steps: [], inner }`, with no event and nothing sent.
- **`planIncoming(day, state, now)`**: every recipient's items whose condition holds, sorted by `t`
  (stable). Each one is `deliver` with `noReadReceipt` for `kind: odd` and a `placement` (D6).
- **`evidencePool(state)`** lists the `odd` incoming items for days `1..state.day`, each with an id
  `incoming:{day}:{recipient}:{index}`. They go into Kuro's evidence pool.
- **`fillPlaceholders`** runs at render time only. Plans and state always hold the raw text.

## 8. Strings

`labelKey`:
- Object words map to `word.{word}`.
- The family's own words map to `family.{word}`. These are the words on its first-day menu:
  `eaten`, `busy`, `fine`, `unpaid`.
- Everything else maps to `reply.{word}`. That includes the family's later `what-llm`.
- `free` has no label; it is the input box.

All of these keys exist in `zh.json`, and a test checks every chip in every table. A struck-through
chip with no inner line returns `hintKey: "reply.hint.gone"`. The status copy (`reply.status.*`)
is desktop-ui's to render; plans carry only actions.

## 9. Tests

- **Loader:** all 19 files load, the schema guard passes, and `{nick}` appears only in family.
- **Resolve:** the FR5 property, shrink, object words, `cond_show`, and deregistration.
- **Reducer:** effects and `used`. Replay stays idempotent, with reply-with-recipient drafts added
  to the world-state arbitrary.
- **Plans:** unit tests per status, plus snapshots for day 1 boss `salary`, day 5 group `no`,
  day 13 xiaozhang (every word), and day 15 family incoming.
