# Desk prints: every day's work leaves paper on the desk, and the pile turns strange (author 2026-11-06)

Why. 机制设计稿-干活: 「做完的活会变成桌上的一样实物 … 成品慢慢变怪」. Today only a `hand` deliverable (days 10+) lands on the desk; days 1–9 send on screen and the desk never changes. The author wants the collapse to spread from the screen and the desk before the room moves (day 11+). So a sent deliverable also leaves its paper copy; prints pile up; from day 4 the paper itself carries the marks (content images by Claude).

## R1 · A sent deliverable leaves a print
- When a board with `deliverable.to` ≠ `hand` is sent (`board.send.<to>`, the `give` event), the deliverable is **also on the desk** as a print until the day ends (the next `sleep`). `deliverableOnDesk` returns it with a flag `sent: true`; the hand's give / refuse choices (work-v2 addition) stay only for `hand` deliverables, unchanged.
- A `hand` deliverable is unchanged: on the desk until given; given → gone.

## R2 · The pile (pure, `src/state/days/prints.ts`)
- `printsOnDesk(day, events): readonly Print[]` — every printed board of earlier days whose paper is still there (sent on screen, or printed and never given; a deliverable given to the hand is gone), oldest first, plus today's (R1). `Print = { day, id, label, img? }`.
- Rendering (`hud.ts`, the 桌子 view): the deliverable slot shows a **pile**: earlier prints as a stack of paper edges under the top one (one 3 px edge per print, at most 6 edges, offset 2 px up and 1 px right each), today's print (or the newest) on top with its `img` or the paper fallback. The slot keeps its spot (left-front by the lamp foot). Hover name: today's label, or `prints.pile` (「一摞打印件」 / "A pile of prints") with the count.
- The 道具 strip is unchanged (today's deliverable only).

## R3 · Look closer
- Clicking the pile opens a close view over the room: the top print's `img` at 70 % of the stage height, centred, the room dimmed 35 %, the label under it. ← / → (and the on-screen arrows `prints.prev` / `prints.next`) page through the pile, newest first. Esc, ×, or a click outside closes it. No events; session only.
- With no `img` (the paper fallback) the close view shows the fallback paper at the same size with the label on it.

## R4 · Content (Claude, after this lands)
- `deliverable.img` per day in `content/tasks/day-NN.json`: `public/room/prints/dNN.png` (a print, 4:5, 800×1000). Days 1–3 clean; from day 4 the margins carry marks that grow by day (symbols, a ring, numbers in a figure); days 13–17 the print is the offering itself. The loader already accepts `img`.
- Strings: `prints.pile`, `prints.prev`, `prints.next`, `prints.close` (zh + en).

## R5 · Tests (`tests/desk-prints.test.ts`)
- A `to: "boss"` board sent on day 1: on the desk today, gone after sleep; the hand offers nothing that night.
- A `hand` board on day 11: on the desk until given; given → not in the pile.
- The pile on day 5 after days 1–4 sent: four edges and the top print, oldest first in `printsOnDesk`.
- The close view opens on click, pages with → and ←, closes with Esc; no event logged.
- Snapshot: the 桌子 view on day 5 with the pile.
