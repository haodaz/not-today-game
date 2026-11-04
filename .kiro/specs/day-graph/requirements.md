# Each day is a graph: cards come from somewhere, a deliverable leaves a mark (author 2026-11-03)

Author: 「每一天都是一个完整的 graph，任务、人设、事前事后都在说什么，是一个图（图谱）」「如果你安排任务的时候，最后这些文件都没用上，那不是 1–3 很失败么」「你能不能把吃图谱本身这个事情给 kiro 做成命令，别卡住」. Claude writes each day's graph as content; this segment is the engine that reads it. Design: the skeleton's first step is 找材料 — a board's material comes from the day's messages, files, pages and calls, not from nowhere.

## 1. A card has a source
`board.cards[].from` (optional, strict), one of:
- `{ "file": "<id>" }` — a file in `content/files.json` (文件 app) or a deliverable page (Vivi's `vivi-plan-1`, …); satisfied by an `open` event with target `file:<id>` **today**.
- `{ "conv": "<recipient>" }` — a conversation (`boss`, `partner`, `group`, `xiaozhang`, `laozhou`, …); satisfied by `open` `conv:<recipient>` today.
- `{ "call": true }` — today's boss call; satisfied by today's `callEnded`.
- absent — available from the start (as today).
Optional `hint` on the card (text, twinned like the other board text): shown while the card is not yet found.

**The tray** shows a found card as today. A card not yet found is a greyed placeholder in its place: no text, only its `hint` (or the generic `board.notFound` 「还没找到」 when there is none); it cannot be picked. 「让它补全」 still places Kuro's fills whatever is found (Kuro does not need to look; that is the point), and those fills count as assists as today.

## 2. A deliverable leaves a mark
When a deliverable is given (`give`, sent on screen or handed to the hand), the state gains the flag `sent_<deliverableId>`. So the day's content can make people answer — or not — with the existing `cond_show: { "has": "sent_<id>" }` on incoming messages (this day's and later days'). Nothing else changes.

## 3. The graph is checked
A test walks every board in `content/tasks/day-*.json` (and `en/`): every `from.file` names a file whose `from` day ≤ that day (or a deliverable page posted on or before that day), every `from.conv` names a known recipient, every `{ call: true }` is on a day with a `call`. A broken source fails the test with the day, task and card.

## Strings (Claude adds `board.notFound`)

## Files
`src/state/days/tasks.ts` (`from`, `hint`), `src/state/days/board.ts` (found cards from the log), `src/world/desktop/workbench/board.ts` (the tray placeholders), `src/state/events.ts` (the `sent_<id>` flag on `give`), a new `tests/day-graph.test.ts` (sources found / not found, the flag, the content check).

## Tests
- A card `from: { file: "c-v17" }` is a placeholder until `open file:c-v17` today, then pickable; an open yesterday does not count.
- `from: { conv: "boss" }` after `open conv:boss`; `from: { call: true }` after today's `callEnded`.
- 让它补全 fills slots with cards not yet found.
- `give` adds `sent_<id>`; an incoming with `cond_show: { has: "sent_<id>" }` shows only after it.
- The content check passes on today's content and fails on a fixture with a card from a file that does not exist yet that day.
