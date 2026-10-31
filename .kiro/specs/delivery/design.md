# delivery — design

## 1. Scope

The phone on the desk runs one app, 外卖. Each day has two meal windows. The bag arrives and the
door beat brings it in. Day 1's box comes with lunch, and day 17's bag returns the objects.

The source is `content/delivery.json` (Claude's file): read, checked, frozen, never rewritten.

Everything here sits on world-state. Orders and pickups are events, and their effects are flags in
`State`. The phone and door are pure view models plus one small state machine. The door view is a
placeholder HTML renderer that desktop-ui or the room scene can replace.

## 2. Decisions taken (please review)

- **E1. Three new event kinds (world-state amendment).**
  - `order {meal, shopId, itemId, t}`: one order in a window. `t` is the beat time it was placed.
  - `pickup {meal}`: the bag is taken in at the door.
  - `useItem {itemId, objectId}`: e.g. installing the battery in the chick. It is logged and
    changes nothing (FR1).
  - The vocabulary was closed at twelve kinds, and delivery needs these to be citeable and
    replayable.
- **E2. Orders live in the event log, not in `State`.** The variable table is closed, and no
  variable holds orders, arrivals, or door progress. The phone reads today's `order` / `pickup`
  events from the log (a pure query), and `State` only receives the flags. If an order should be a
  state variable, Claude can add one (TODO in `docs/kiro-log.md`).
- **E3. Lost to the hand.** `raids[night].blockedWith` is the object held up to the hand that
  night, and it counts as handed over. Day 17's `objects_returned` brings back everything handed
  over on earlier nights, in night order. Anything handed over from night 17 on is lost again. The
  return day and flag are read from the delivery table (the meal whose effects set
  `objects_returned`).
  - Nothing writes `raids` yet; that's the night-hand spec. Until then nothing is ever lost, and
    the day-17 bag is empty in real play. Tests set `raids` directly.
- **E4. When effects apply.**
  - Item effects (the battery's `bought_battery`) apply on `order`.
  - A meal's effects (`box_arrived`, `receipt_1997`, `upgrade_notice_delivered`,
    `objects_returned`) apply on `pickup`.
  - A meal that never comes (`arrives: null`: day 16 `no_delivery`, day 18 dinner `slip_ready`)
    has nobody to pick it up. Its flags are day-driven in `derive` for every day ≤ `state.day`,
    like incoming messages. So `slip_ready` is set from the morning of day 18, not at dinner.
- **E5. Arrival time.**
  - If the player ordered, the meal arrives at `arrives`, or at the order time if that is later.
  - If they did not order, the default arrives at the end of the window (FR2).
  - If no shop was open for that window, so ordering was impossible (ring `door`: days 16–18),
    the meal arrives at `arrives`.
- **E6. Receipt with a chosen item.** If the receipt starts with an item name from the shop table
  (longest match), that prefix is replaced by the chosen item's name for display. The rest of the
  line (备注, 收件人, typos) stays. A receipt that starts with no item name (`—`, day 17) is shown
  as written. The stored content is never changed; this is display composition only.
- **E7. Shop drift is a transformation, never new text.**
  - `shopDrift.byRing` names the ring where each drift *starts*. The note's wording ("screen 起…,
    desk 起…") is read as cumulative, so every drift up to the day's ring is in force.
  - `only-<shop>` replaces the list (the extra shop goes with the rest), and `all-closed` closes
    whatever is left.
  - On a `calmDaytime` day (day 10) the list is shown undrifted. What can be ordered still
    follows the ring.
  - The drifts:
  - `normal`: shops as listed.
  - `typo-in-one-shop-name`: one shop, chosen by a seed of the day, shows its name with two
    adjacent characters swapped. No new character is invented.
    TODO(Claude): authored typo names would replace this.
  - `same-courier-face`: `courierFace: "same"` for the view.
  - `extra-shop-<name>`: one more shop named `<name>` (here `1997`, read from the drift code)
    with an empty menu.
  - `only-<shopId>`: only that shop, with only its default item (`hmj-no-cilantro`, the default
    lunch).
  - `all-closed`: every shop is closed, and the view gets `closed: true` plus the strings key
    `delivery.shop.closed` (TODO(Claude): not in `zh.json` yet).
  - A shop's `hours` close it outside them, so 麻辣烫 is dinner only.
- **E8. Validation.**
  - The `order` reducer rejects a shop or item that is not available that day for that meal.
    A corrupt log fails loudly.
  - "One order per window" and "the window is open now" need the log and the beat time, so the
    command layer checks them.
  - `pickup` is rejected for a meal that never arrives.

## 3. Modules

```
src/state/delivery/
  table.ts     load + guard + freeze delivery.json; meals(day), windows, shops, defaults, drift code
  shops.ts     availableShops(day, meal): drift + hours applied (pure; the order reducer uses it)
  effects.ts   applyOrder, applyPickup (reducers); applyUndeliveredMealFlags (derive); RETURN rule
src/state/objects.ts   held / lost / returned (shared with replies), return rule from delivery table
src/world/delivery/
  meals.ts     ordersOn(events, day); mealView(day, meal, state, events, now): phase, arrival, texts
  phone.ts     phoneModel(day, state, events, now): current window, shops with drift view, canOrder
  door.ts      door machine: delivered → atDoor → chainOpen → holding → closing → onDesk
  commands.ts  placeOrder, doorBeat (machine bound to a store; close appends pickup), installItem
  view.ts      placeholder door view: HTML string, escaped, placeholders filled
```

## 4. Meal view

`mealView` returns:
- `phase`: `none` (`arrives` null), `before` (window not open), `open`, `ordered`, `delivered`
  (已送达; the door beat is available), or `pickedUp`.
- `arrivesAt` and `window`.
- `order`: chosen or default, with `by` from `defaults`.
- The raw texts, with placeholders unfilled: `outside`, `bag`, the `receipt` composed per E6, and
  `anomaly` (the inner line).
- `effects` and `extras`:
  - `box: boolean` if the meal sets `box_arrived`. It arrives regardless of choice.
  - `returned: string[]` from `objects.ts`, in day order, if the meal sets `objects_returned`.

## 5. Door beat

States follow `door.steps` (six content lines, index = state):

| state | step | shows |
|---|---|---|
| `delivered` | 0 已送达 | phone notice |
| `atDoor` | 1 | camera at the door wall |
| `chainOpen` | 2 | the corridor strip of light + `outside` |
| `holding` | 3 | `bag` |
| `closing` | 4 | door shut, chain on |
| `onDesk` | 5 | `bag`, `receipt`, `anomaly`, extras (box / returned objects) |

- **Inputs:** `walk`, `openChain`, `reach`, `close`, `place`. Each moves exactly one step;
  anything else is rejected.
- `place` (closing → onDesk) emits the `pickup` event, the only state change.
- A meal with `phase: none` has no machine. The view shows `anomaly` where the bag would be, plus
  `outside`. The door does not open.

## 6. Tests (FR4)

- **Properties over the data:** every day 1..lastDay has exactly two meals, and `arrives` null ⇒
  `bag` null (and `receipt` null).
- **Snapshots of the door view:** day 1 lunch (box), day 9 dinner (bag moving), day 13 dinner
  (notice under the door), day 16 (closed, both meals).
- **Unit tests:** drift per ring, hours, arrival rules, receipt composition, the machine, the
  commands, held/lost/returned, and effects through the event log, with replay idempotence
  including the new events.
