# The room as a readout

One idea borrowed from the author's Gemiverse engine (2026-11-25): **every fact of the run shows
up in the room as one thing**, and a thing in the room that is on no row of this table is
furniture. The table is how we see what the run already shows, what it only prints as a number,
and what it hides on purpose. `tests/room-readout.test.ts` fails when a field of `State` is on no
row, so a new mechanism cannot arrive without deciding how (or whether) the room shows it.

Status words: **shown** (in the room or on a device, today), **panel** (only as a number in 人物 /
status or another screen), **hidden** (kept out of sight on purpose), **none** (nothing yet: a gap).

Proposals are Claude's suggestions for the author to accept or drop. Her taste rules apply: real
traces, not drawn things; the uncanny stated as plain fact; nothing that
explains itself.

## What the day drives

| Fact (`State`) | Shows as | Where | Status |
|---|---|---|---|
| `day` | the photographed room re-edited per stage (wall → otherworld → glitch → white); the code-built room's collapse amount, broken pixels and "unreal" lines (days 10–18, `dayLook` in `room3d/room.js`); the window and the lights across the yard; the weather (`rain`) | every view | shown |
| `day` | the carton: one small box loose each day; the shipping slip on day 18 | 床 wall, 桌子 | shown |
| `stage` | derived from `day` (`content/stages.json`); read by the photos and the shader | every view | shown |
| `found` | each old object on the desk from the day after it is found; in the 道具 card | 桌子 (photo and 3D) | shown |
| `recognised` | the object's memory has been seen: its 认得 line is spent; the credits' object stills | the object, the credits | shown |
| `upgraded` | the same device drawn in its upgraded state (hi-res screen, new shell) | the device in hand, 桌子 | shown |
| `chickFrame` | the chick's LCD (grave → blink → crack → peck → light → phoenix → out) | the chick, also on the 3D desk | shown |
| `pagerUnread` | the pager's message waiting on its screen | the pager | shown |
| `raids` | the gap between the monitors glows on hand nights; what was kept from the hand lies on the desk as prints (`desk-prints`) | 桌子 | shown |
| `ending` | the ending pages; the run's book on the shelf; what finished runs leave on the title desk | ending pages, title room | shown |

## What the player drives

| Fact (`State`) | Shows as today | Status | Proposal |
|---|---|---|---|
| `san` | the heart-rate chip from day 9 (HUD); the number in 人物 | panel | One real trace per SAN band, in the room itself: the desk lamp's bulb flickers at the lowest band; the mug is already cold when you sit down. Never a drawn overlay. |
| `assimilation` | the number in 人物 | panel | Kuro's own body in the room: one more tentacle on the HUD body per band; at the top band its shadow on the wall is a size too big. |
| `affinity` | Kuro's lines and register; the number in 人物 | panel | Where Kuro's eyes rest when idle: on the player at high affinity, on the screen at low. |
| `fullness` | the number in 人物; **a lunch collected and never eaten stays on the little table by the window, unopened** — beside the dinner that evening, still there the next morning until that day's lunch is collected; a click: one plain line (`leftoverLunch`, built 2026-11-25). Lunch is the one meal the days let you skip. | shown | Done. |
| `loan`, `balance`, `overdueDays` | the workbench ledger, the checklist, 老周's thread | shown (on the screen, as real work) | none: the workspace shows the work (the workspace is the work, not a game surface). |
| `letItDoUnchecked` | the workbench's "let it do" marks | shown (on the screen) | none |
| `repliedNumbers`, `translated`, `readCount`, `replyOptions`, `objectWords` | the pager / dictionary screens; the reply bar | shown (on the devices and screens) | none |
| `newWorld` | the work world after the switch | shown (on the screen) | none |
| `pokedReset` | the object's reset state | shown (the device) | none |
| `flags` | many: each task's result, the work pages, the diary | shown (where each flag is read) | none; every new flag still needs its own row decided in its spec |
| `chatTurnsToday`, `chatMemory` | Kuro's chat column | shown (in the chat) | none |
| `judgement` | the credits are its log | hidden | Hidden on purpose: Kuro's opinion is the ending; it must not be readable in the room. |
| `names` | the shipping label, the tags, how people call you | shown | none |

## Things in the room that are only furniture

Everything else in `room3d/room.js` and the photos (the bin, the jacket, the books, the chair) is
furniture: it may be touched and may have a line (`content/room-looks.json`), but it reads no fact.
When a piece of furniture starts to read a fact, it moves into the tables above.
