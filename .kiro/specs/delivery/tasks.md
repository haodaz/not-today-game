# delivery — tasks

Each task is under 30 minutes. After each task run `npx tsc --noEmit 2>&1 | tail -20` and
`npx vitest run 2>&1 | tail -20`. Do not commit. Never rewrite a content string.

## 0. Replies: lent words while held (prerequisite)
- [x] `src/state/objects.ts`: held / lost (raids `blockedWith`).
- [x] Resolver: lent word available every day to everyone while held; `gone` (reason `lost`) when lost; `used` only records first use.
- [x] Property test updated.

## 1. Delivery table and FR4 data properties
- [x] `src/state/delivery/table.ts`: load, guard (keys, times, null rules, shop/item ids in defaults), freeze.
- [x] Properties: two meals every day; `arrives` null ⇒ `bag` null.

## 2. Events and effects
- [x] `order`, `pickup`, `useItem` event kinds; reducers (E4, E8); undelivered-meal flags in `derive`.
- [x] Return rule in `objects.ts` (E3).
- [x] Update world-state tests for the new kinds and derived flags; replay idempotence with the new events.

## 3. Shops and drift
- [x] `availableShops(day, meal)` (state): drift + hours.
- [x] Shop view (world): typo, courier face, closed key.
- [x] Tests per ring.

## 4. Meals
- [x] `ordersOn`, arrival rule (E5), receipt composition (E6), `mealView` phases.
- [x] Tests.

## 5. Door machine
- [x] States and inputs per design §5; `place` emits `pickup`.
- [x] Tests.

## 6. Commands and phone
- [x] `placeOrder` (window open, one per window), `doorBeat` bound to a store, `installItem`.
- [x] `phoneModel`.
- [x] Tests through a real store.

## 7. Placeholder door view and FR4 snapshots
- [x] HTML renderer (escaped, placeholders filled, no strings of its own).
- [x] Snapshots: day 1, day 9 dinner, day 13 dinner, day 16.
- [x] Log decisions and TODOs in `docs/kiro-log.md`.
