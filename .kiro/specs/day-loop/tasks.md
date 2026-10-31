# day-loop — tasks

Only shell commands: `npx tsc --noEmit 2>&1 | tail -20`, `npx vitest run 2>&1 | tail -20`. Do not
commit.

## 1. Day files
- [x] `src/state/days/table.ts`: load, strict guard, condition tokens (incl. `loan:decided`).
- [x] FR5 property: required items orderable, bed reachable, every day.

## 2. Events
- [x] `step`, `choose`, `task` kinds and reducers (L1, L2).

## 3. Checklist engine
- [x] Statuses, visible list (current / waiting / next, done count), bed lock, rewrite (L4), actionable items.

## 4. Dialogue and waiting
- [x] Dialogue queue, line kinds, choices with cond_show → `choose`; loan prompt.
- [x] `arrivalDue` (L5); sfx player (silent on missing files).

## 5. Runtime
- [x] Store-change diff → sequences, sfx, self ticks, arrival, clock (L6).

## 6. Views and wiring
- [x] Room HUD per FR6, phone panel, door view; game controller (room / door / desktop).
- [x] Desktop amendment (L10): one monitor, 左屏/右屏 toggle, ← →, other-monitor tab, back to room.
- [x] `main.ts`: the room with the checklist by default (`?day=N` too); 桌面 opens the desktop.

## 7. Snapshots and wrap-up
- [x] FR5 checklist snapshots; HUD snapshots; desktop one-monitor snapshots; strings TODO lists; log.

## 8. Correction 2026-11-01: the checklist only watches; where Kuro's body sits
- [x] Lines are not buttons; `ItemAction` / `actionOf` / `loop-item` removed; `openItemFor`, `booted`, `deskMeal`.
- [x] Tower hotspot (房间, 桌子) + black monitors before boot; openApp counts only once booted.
- [x] Meal on the desk bar (food image → eat → empty box until the next meal).
- [x] 看一眼桌子 on entering 桌子; 关机 in the top bar → shutdown beat → 房间 after 750 ms.
- [x] Bed hotspot: locked inner line `room.bed.locked`, else night → lieDown.
- [x] Loan prompt from 老周's conversation.
- [x] Rects measured into `shots.ts`; `tests/actuators.test.ts` (one test per table row, lines are not buttons).
- [x] HUD body above the chip row, flush right; box right edge left of it (tested from the CSS).
- [x] Snapshots refreshed after checking the diffs.

## 9. Rule 2026-11-01: the first time an action appears
- [x] Checklist tests read item text from the day file (loop-engine ×3, loop-hud "after lunch arrives").
- [x] One-time pointer (`room/pointer.ts`, `.pointer-once`) on the first raid's choices, Kuro's body while the first offer waits, the first desk-bar object; tests in actuators.test.ts.
- [x] `room.bed` / `room.meal` as the hotspots' labels.
