# Replay driver, day 2 — requirements

`script/tools/auto-day-shoot.mjs` replays one day headlessly against the preview on port 5180
(puppeteer; see the file's header and `script/notes/work-screens-2026-11-12.md`). Days 1 and 13 run
clean end to end; day 2 does not. This is tooling: no game code, no content, no tests under
`tests/`. Do not run git. You may run the driver yourself to check (`CHOOSE=look PORT=5180 UNTIL=2
FOUND=chick SEED=flags:task_receivable_done+task_merge_done node script/tools/auto-day-shoot.mjs 2 zh
/tmp/nt-shots-d2`, after `mkdir -p /tmp/nt-shots-d2`; the preview must already be up — if
`curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/` is not 200, stop and say so instead
of starting anything). Delete `/tmp/nt-shots-d2` when done. Never more than two runs.

## 1. The shot folder

`shotStep` writes into the folder given as the third argument and throws ENOENT when it is missing.
Create it (`mkdirSync(dir, { recursive: true })`) at start.

## 2. Day 2's order

The log of the failing run (`replay-settle.log` of 2026-11-12, day 2 section) shows the driver
taking the checklist's items in listed order — 午饭 ordered, then 去拿 (which waits 160 s for an
arrival that only comes once the story clock passes 13:30, i.e. after the day's work), then 回小张,
then the task — so by the time it reaches 自演化引擎 it is standing in the room, the task's ask never
comes, and `tune: no card after 0 picks` is logged. The story clock (`src/world/loop/runtime.ts`:
lunch eaten → 13:30, each task +90 min) means the right order on a work day is: boot → msgs → the
replies and the order → **the tasks** → pickup → eat → the rest. Make the driver take `flag:` task
items before an `event:pickup:*` item of the same day whenever both are pending (a stable reorder of
the pending list before each pick, not a special case for day 2), and have the pickup step wait for
the arrival by watching the door's state instead of a fixed 160 s (it already knows the door; give up
after 60 s with the same note as now).

## 3. 回小张 behind Vivi's lock

`reply: refused by Vivi's lock; her page opened, sending again` is handled; after it, the driver
logs `events:` empty and the item as cleared out of order. Make sure the reply step ends with the
`reply:xiaozhang` event in the log (check `__events()` as the other steps do) and otherwise says
which chip it clicked and what the box showed.

## 4. Report

Say for each item what you changed and, if you ran the driver, paste the `== day 2:` summary line
and the `failed:` line. Log in `docs/kiro-log.md`.
