> **SUPERSEDED (author 2026-11-06).** The raid-and-block design below is gone: nights 1–9 have no hand; from day 10 the hand collects the day's work (work-v2 §4 and its 2026-11-03 addition). `wants`, `item_dream`, `blockedWith`, `nights.json`, `nights-takes.json` and the dream state are removed. Only night 18 (slip / take the hand, san-and-endings) survives. Kept for history.

# night-hand — requirements

The hand that comes out of the gap between the monitors at night and asks for something. The player's only moves: hold up an object, hold up something already lost, or hold up nothing (product.md). Data: the night beats in `content/days/day-NN.json` (`shutdown.choices`), `content/stages.json` (nightBeat), `content/variables.json` (`raids`, `lost`, `found`, `recognised`, `upgraded`).

## FR1. When it comes
- Raid nights are the days whose `shutdown` beat has `choices` (5, 7, 9, 10, 13, 16, 18 in content; day 14 explicitly has none). The engine reads content, never a hardcoded list.
- The raid plays after the shutdown beat's lines, inside the dialogue box, over the dimmed desk (room-scene later adds the gap light; until then a DOM gap glow).

## FR2. What it wants and what blocks it
- Each raid night names (in content, `wants`) what the hand is after: day 5 the loan line, 7 the IC card's meaning, 9 the heartbeat, 10 the tape's half sentence, 13 the dictionary's words, 16 the number, 18 the player's hand. The text lives in `content/nights.json` (`wants` by day), because the days loader is strict about keys; night-hand may fold it into the day files and extend the loader.
- Blocking: holding up a found, recognised, not-upgraded, not-lost object whose `item_dream` the choice names blocks the raid: `raids[night] = {blockedWith: object}`, san +1, the object enters dream state for that night (its screen gains resolution until morning). Holding up an already-lost thing (`item_lost` choice, e.g. the loan line) hands it over: `lost += that`, no san change, `raids[night] = {gave: it}`. Holding up nothing: san −1, `raids[night] = {gave: null}`; on days 9 and 18 the hand takes something else (content says what: the heartbeat widget value, the hand itself).
- Upgraded objects are never offered (object-upgrade FR2). Objects in `lost` are never offered.

## FR3. Aftermath
- Morning after a blocked raid: the object's screen is back to integer pixels; one dialogue line from content (`day.beats.boot` already carries it where written).
- Day 17: `objects_returned` (delivery) clears `lost` for objects; the loan line stays lost.
- The good ending counts "blocked every raid" as: every raid night has `blockedWith` set.

## FR4. Tests
- Property: offered choices never include upgraded or lost objects; blocking requires found ∧ recognised.
- Snapshot: night 5 with loan lent (three choices) and not lent (two); night 13 with the dictionary upgraded (no block possible).
