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
