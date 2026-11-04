# pager-foreign — requirements (2026-11-04, author-approved day 8 graph)

Day 8's graph (script/notes/图谱-第7-9天.md): the pager receives, all day, numeric pages that are not the child's: `009 200`, `003 026`, `002 031` (rank, and how many legions it commands). The pager is the child's channel (content/kid.json, hand-written constants, one message a day); these come in on the same line, which is the point.

## R1. Content
A new file `content/pager-foreign.json`: `{ "_note": string, "pages": { "day": number, "t": "HH:MM", "text": string }[] }`. Strict loader: days 1–18, `t` HH:MM, `text` digits and spaces only, at most 6 a day, sorted by day then t. kid.json is not touched.

## R2. The pager
- A foreign page arrives at its `t` (game clock) on its day; it lights the envelope like the child's message.
- 读 shows the day's messages newest first: the child's (if any) and the foreign pages that have arrived; ↑ / ↓ step between them (the existing `index`). A foreign page shows only its digits: no name, no decoding.
- The child's message keeps its own rules (after-reply etc.). The calculator reply rule is unchanged (foreign pages cannot be answered).

## R3. Tests
- Loader rules; a page before its `t` is not shown; after its `t` it is, newest first, with the child's; ↑/↓ steps; kid.json schedule unchanged.
