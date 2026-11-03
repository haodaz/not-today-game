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

## Amendment 2026-11-01 (author): eating happens on the desk
Eating is a 桌子-level act: the bag lands on the desk corner; opening it puts the item's sprite (`shops[].items[].sprite`, `content/delivery.json`) on the desk in front of the keyboard; `eat` swaps it for `<sprite>_done` when one exists, otherwise removes it; the empty box stays until the next meal. Sprites are photoreal white-background cutouts in `public/food/` (new-world things look real; old objects stay watercolour). The cup on the desk bar is unrelated.

## Addition 2026-11-02 (author): the app should feel like an app
"外卖 app 要更像 app，奔着 Uber Eats 那个感觉就行", plus small touches. The phone's delivery software gets the shape of a real delivery app, not a list:
- **Home**: a search bar (decorative), a row of category chips (decorative), then the four shops as cards with a photo (`public/food/` cutouts on a plain tile), name, rating, delivery time and fee (per shop in `content/delivery.json` as `rating`, `eta`, `fee`; plus top-level `address` and `card`; Kiro widens the strict loader, then Claude adds: huangmenji 4.8/30/3, shaxian 4.6/35/4, kiosk 4.9/25/2, coffee 4.7/40/5, malatang 4.8/30/3; address 某某路 17 号 · 3 栋 602, card **** 2047), delivery time (25–40 min) and fee. The day's drift rules (closed shops, typos, day 16 全部打烊) apply to the cards.
- **Shop page**: a header photo, the menu as rows with a small photo and a price, an add button with a count; a sticky bottom bar 「去结算 · ¥xx」.
- **Checkout**: address (the rented room's, one line, from content), payment (one card ending in digits from content), a big 「下单」 button. The order window rules stay.
- **Order status**: a progress strip 已接单 → 制作中 → 骑手取餐 → 配送中 → 已送达, with the rider's name and a cartoon helmet, times from the existing arrival schedule. Tapping the phone during a wait shows this page.
- **Rating** (the author's detail): after the meal is on the desk the app offers 「评价一下」: five stars (tap sets them) and three canned remarks, one of which is 「和图片一模一样」 (en: "Looks exactly like the photo"); the player may also type nothing. Submitting shows 「感谢您的评价」 and the shop's rating does not change. Day 17: the rating page offers only the one remark and the stars are already five. Logged as a session fact only, no event.
- Strings: `delivery.search`, `delivery.checkout`, `delivery.order`, `delivery.status.*` (5), `delivery.rate`, `delivery.rate.same`, `delivery.rate.fast`, `delivery.rate.hot`, `delivery.rate.thanks` (Claude adds zh/en).
- Tests: snapshot home, shop, checkout, status and rating pages on day 1 and day 16; property: the rating page never appears before the meal is on the desk; day 17's rating page has one remark.

## Correction 2026-11-02 (author, from the day-4 English screenshot)
The phone's app is squeezed into a narrow column inside the phone frame: the home list takes about half the screen width, shop names wrap three lines, the rating/eta/fee row shows empty circles instead of its icons, and the list is clipped at the bottom with the 「点屏幕外面放下」 caption overlapping it. The app must fill the phone's screen area edge to edge (the frame's inner rect), with the home list scrolling inside it; icons for rating/time/fee come from `public/os/` or inline SVG, never empty placeholders; shop names stay on one or two lines (ellipsis). Snapshot the home page at the phone's real size in zh and en.
