# replies — requirements

Data is finished: `content/replies/day-01..18.json`, `content/replies/family.json`, schema in `content/replies/README.md`. This spec is about playing that data.

## FR1. Resolve
- `resolve(day, recipient, word, state)` returns the entry for that cell, honouring `cond_show` (e.g. `{has: "lent"}`), the shrinking menu (a word absent from `replyOptions` for the stage is `gone`), and object words (available only while `objectWords[x].used === false` for an object already found).
- Placeholders `{calledBy}`, `{bossCalls}`, `{nick}`, `{login}` are filled from `names` at render time, never stored filled.

## FR2. Play
- `reply`: append lines with their `t`; if `t` is earlier than the current beat time, deliver immediately with that timestamp.
- `read`: show 已读 after `readAfter` (parse `3s`, `40s`, `2min`, `1h`, `1d`; `1d` means next boot).
- `typing`: show 正在输入 for 4–8 s, then nothing.
- `recalled`: deliver the lines, then replace with `[撤回了一条消息]` after 2–5 s.
- `silence`: no read receipt; if the recipient is deregistered, the input is disabled and the `inner` line shows.
- `gone`: the chip is struck through; clicking shows `inner`.
- `interrupt`: after the entry plays, deliver the interrupt in `where` with its `t` and badge that conversation.
- `inner`: the italic line, shown under the reply bar for one beat, never sent.
- `effects`: apply `san`, `flags`; log an event `reply:{day,recipient,word}` so Kuro's rubric can cite it.

## FR3. Incoming
- At boot of day N (or at `t` if the beat clock passes it), deliver every `incoming` of every recipient whose `cond_show` holds. `kind: odd` items get no read receipt from the player side and are included in Kuro's evidence pool.

## FR4. Family
- Family uses its own four keys (`eaten`, `busy`, `fine`, `unpaid`) with labels from strings; same engine. `{nick}` appears only here.

## FR5. Tests
- Property: for every day and recipient, every word in that day's menu resolves to an entry or `gone` (no undefined).
- Snapshot: day 1 boss `salary` (read + interrupt), day 5 group `no`, day 13 xiaozhang any word (silence, disabled), day 15 family incoming (the input-box one is rendered inside the player's own input, not as a received bubble).

## Addition 2026-11-01 (author): English reply tables
English lives beside the Chinese: `content/replies/en/<same file name>.json` with exactly the same shape, days, words, statuses, times and effects; only `text` and `inner` differ. Today: `en/family.json`, `en/clan.json` (the day files follow). The loader parses an `en/` file with the same strict parser, then checks it is structurally identical to its zh twin (same days, same words, same statuses, same line count per cell, same times), and fails loudly otherwise. At render time the active locale picks the text; a missing `en/` file falls back to Chinese for that conversation. Speaker prefixes in English may contain spaces and run to 14 characters (`Big Aunt：`, `Little Aunt：`); widen `splitSpeaker` accordingly (still no newline, still the full-width colon).
