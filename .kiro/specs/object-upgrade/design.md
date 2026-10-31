# object-upgrade — design

## 1. Approach

`upgraded` is state, filled only by events. Everything an upgrade changes is a pure function of
`upgraded` plus the day, so replaying the log rebuilds it. `content/upgrades.json` is read by
`src/state/upgrades.ts` (strict guard: every key in the table is a known object, every string key
exists in `zh.json`, the judgement deltas name existing fields).

## 2. Decisions taken (please review)

- **U1. Two event kinds (world-state amendment).**
  - `upgrade {object}` sets `upgraded[object] = true`. It is rejected if the object isn't in the
    table, isn't found, or is upgraded before `offerFrom`. Upgrading twice is a no-op.
  - `declineUpgrade {object, decline: "offer"|"nag"|"final"}` records a no. A declined final
    offer uses `object: "all"`.
- **U2. Offer schedule (`currentOffer(state, day)`).** At most one offer shows at a time, in
  table order.
  - An object is offered when it's found, not upgraded, and `day >= offerFrom`.
  - The offer stays until declined. After that, the `nag` shows once, from
    `declineDay + nagAfterDays`.
  - On `finalOfferDay` (13) one final offer covers every open object. Accepting upgrades all of
    them.
  - Once the final is declined, objects with `offerFrom <= finalOfferDay` are never offered
    again. Later objects still get their own offer and nag.
  - Offers live in the small window and never use chat turns.
- **U3. Judgement.** Accept / decline apply the `judgement` deltas from `upgrades.json`, clamped
  to the range in `variables.json` `judgement.fields` (`int -10..10`). Evidence entries are
  `{day, eventId: "upgrade:<obj>" | "declineUpgrade:<obj>", note}`, so the credits log can cite
  them.
- **U4. What upgraded changes.**
  - Reply menu: the object's lent word resolves to `hidden`.
  - Night: `choiceOffered` hides choices whose `item_dream` / `item_lost` is an upgraded object;
    the `choose` reducer rejects them too. The dialogue box says nothing about why.
  - Desk bar: `class="slot upgraded" data-res="hi"`, using `/objects/<id>_front.png` and a smooth
    (non-pixelated) `.screen-hi`. This is the only visible tell.
- **U5. Not done yet (waiting on other specs).**
  - The high-resolution device screens and the `gain` outputs belong to the device specs
    (device-skeleton onward).
  - The child's "corrected" text has no field in `content/` yet. TODO(Claude).
  - Counting upgraded objects as unable to block, for the good ending, belongs to
    san-and-endings.

## 3. Modules

```
src/state/upgrades.ts          table guard, currentOffer, applyUpgrade, applyDeclineUpgrade
src/state/events.ts            + upgrade, declineUpgrade
src/state/replies/resolve.ts   upgraded → hidden
src/state/days/effects.ts      choiceOffered, choose rejects upgraded objects
src/world/desktop/kuro/mini.ts offerBlock (upgrade-yes / upgrade-no buttons)
src/world/room/game.ts         actions upgrade-yes, upgrade-no
src/world/room/hud.ts          desk bar upgraded slot
```

## 4. Tests (FR3)

- Property: after any sequence of events, an upgraded object never appears in a night choice
  list and its word is never in the menu.
- Snapshots: pager offer on day 5, nag on day 8, final offer on day 13; desk bar with one
  upgraded object.
- Unit: rejection rules, judgement clamp, evidence ids, replay idempotence.
