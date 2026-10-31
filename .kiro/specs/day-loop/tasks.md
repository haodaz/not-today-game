# day-loop — tasks

Only shell commands: `npx tsc --noEmit 2>&1 | tail -20`, `npx vitest run 2>&1 | tail -20`. No
output = success; never retry more than twice. Do not commit.

## 1. Day files
- [ ] `src/state/days/table.ts`: load, strict guard, condition tokens.
- [ ] FR5 property: required items orderable, bed reachable, every day.

## 2. Events
- [ ] `step`, `choose`, `task` kinds and reducers (L1, L2).

## 3. Checklist engine
- [ ] Statuses, visible list (current / waiting / next, done count), bed lock, rewrite (L4), actionable items.

## 4. Dialogue and waiting
- [ ] Dialogue queue, line kinds, choices with cond_show → `choose`.
- [ ] `arrivalDue` (L5); sfx player (silent on missing files).

## 5. Runtime
- [ ] Store-change diff → sequences, sfx, self ticks, arrival, clock (L6).

## 6. Views and wiring
- [ ] Room HUD per FR6, phone panel, door view; game controller (room / door / desktop).
- [ ] Desktop amendment (L10): one monitor, 左屏/右屏 toggle, ← →, other-monitor tab, back to room.
- [ ] `main.ts`: `?day=1` opens the room with the checklist; 桌面 opens the desktop.

## 7. Snapshots and wrap-up
- [ ] FR5 snapshots; HUD and desktop snapshots; strings TODO list; log.
