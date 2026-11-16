# Leaving the screen, and the checklist (author's playtest, 2026-11-16)

The author played day 1 on the live site. Three things made her lose the thread, and they are the
same everywhere in the game, so this is a whole-game change, not a day-1 patch. Her words:

- 「回房间不要放在 dock 里面，放左边旁边，明显一点。或者叫离开屏幕。」
- 「离开屏幕应该会到桌面，而不是房间最远的视角。说是点外卖，退到很远，然后又要指导用户坐回去，这很傻。」
- 「如果不是很多事情必须并行，只放当前要做的事情，不用说已做多少件。或者 ongoing 的想办法 highlight 一下。」

Strings are Claude's and are in: `desktop.leave` (离开屏幕 / Leave the screen, new), `desktop.back`
(stays for anything else that still says 回房间). Do not add strings; a missing one is a question.

## 1. 离开屏幕 (`src/world/desktop/shell.ts`, `desktop.css`)

- The dock loses its room tile (`room-tile`, `data-action="view" data-view="room"`) and the separator
  that went with it. 设置 stays where it is.
- A new control sits **outside the monitor, at the left edge of the stage, vertically centred**: a
  vertical pill, paper-toned like the HUD, with a left-pointing chevron glyph (CSS, no icon font) and
  the word `desktop.leave` written top-to-bottom (`writing-mode: vertical-rl` for zh and en alike).
  About 36 px wide, 140 px tall. It is `data-action="view" data-view="desk"`, so the guidance ring
  already finds it (`ringAnchors` for `phone` lists `view desk`), and Esc on the screen does the same.
- It is always present on the screen view, over every window and the dim of a story line (the
  guidance wrapper allows `view`); hidden only while the coach marks are up (day 1's first visit) and
  during the ending pages.

## 2. Where leaving lands (`src/world/room/game.ts`, the `view` action and Esc)

- From the screen, leaving goes to the **desk view** (`session.view = "desk"`), the camera move the
  monitors-to-desk already uses in reverse. Never to the room's wide view.
- From the desk, Esc or the existing back affordance goes to the room as it does now.
- Every place that currently sends the player from the screen to `room` (the dock tile's handler,
  `nav-back` / `nav-esc` on the desktop, `toRoom` paths in the code) goes to `desk` instead. Grep for
  `data-view="room"` and `view: "room"` on the desktop side; the room's own hotspots are untouched.

## 3. The checklist (`src/world/loop/checklist.ts`, `src/world/room/hud.ts`, `room.css`)

- No `hud.done` line (已做 N 件). Remove `doneCount` from the view.
- Done items are not listed. The list is: the **current** item first (the one the guide targets, or
  the first undone required item when there is no guide), then the other open items, then the
  waiting ones (a meal on its way) as now.
- The current item is marked: a leading `▸`, full ink; the others are dimmed (`.it.later`, 60 %
  opacity, no marker). One item open → one line under the heading, nothing else.
- The heading (今日 / 今夜) stays.

## 4. The replay driver

`script/tools/auto-day-shoot.mjs` `toRoom` clicks `[data-action=view][data-view=room]` on the desktop:
change it to the leave control (`[data-action=view][data-view=desk]`) followed by Esc to reach the
room. It also reads the checklist text for the next step; the current item's text is unchanged, only
the marker and the dimming are new, so its matching keeps working.

## Tests

- The dock has no room tile; the leave control is present on the screen with `view desk`, absent
  under the coach marks.
- Leaving from the screen → `session.view === "desk"`; Esc on the screen → desk; Esc on the desk → room.
- Checklist: done items absent, no done line, the current item carries the marker, the others `later`;
  with one open item the list has one line.
- Snapshots carrying the dock or the checklist refresh (markup-only); say so in the log.

## Not in this spec

The guide rules themselves (`guide.ts`, Claude's); the room's hotspots; the phone.
