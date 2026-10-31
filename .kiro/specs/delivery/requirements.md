# delivery — requirements

Data: `content/delivery.json` (phone, windows, door steps, shops, defaults, 18 days × lunch/dinner, shopDrift by ring, chosen rule).

## FR1. Phone
- A phone object on the desk (new world, high resolution; not the dead feature phone). Picking it up shows the 外卖 app: shop list → menu → order. One order per window. Shop list and names drift per `shopDrift.byRing`; closed shops show 商家已打烟 exactly as the data says.
- Buying `battery` sets `bought_battery`; installing it in the chick is an object interaction that changes nothing on the chick's screen by day (the night beat is unaffected). Log the event.

## FR2. Arrival
- At `arrives` (or at the window end if the player ordered nothing → `defaults`), the phone shows 已送达 and the door beat becomes available: camera turns to the door wall, chain, reach, take, close. The corridor is only a strip of light; the player never steps out. If `arrives` is null, nothing comes and the day's `anomaly` text is shown where the bag would be.
- The bag appears on the desk corner with `bag` and `receipt` text (placeholders filled). `anomaly` is the inner line for that pickup. `effects` apply (flags like `box_arrived`, `objects_returned`, `slip_ready`).
- If the player chose a shop, the item name on the receipt is the chosen item; the day's receipt note/anomaly still applies.

## FR3. Day 1 and day 17 specials
- Day 1 lunch delivers the cardboard box together with the bag (`box_arrived` unlocks the open-box beat).
- Day 17 lunch delivers the returned objects (`objects_returned`): every object the player handed to the hand and did not get back is placed back on the desk, in day order.
- Day 16–18: no delivery per data; door events only.

## FR4. Tests
- Snapshot the door beat at day 1, day 9 (bag moving), day 13 dinner (notice under the door), day 16 (closed).
- Property: every day has exactly two meals; `arrives` null ⇒ `bag` null.
