# objects-in-room — requirements (2026-11-04, author + Claude)

"我们还是得考虑道具的用法、在 3D 空间里的真实用法。" Today a board lock opens its object and the code chips appear: a button. From now on some objects only work **at a place in the room**, using what that wall has: daylight at the window, the desk lamp, the one bar of signal by the window, the bedside at night. Design source: `script/notes/物件×房间.md`. Holding / using (objects-in-hand) and the four facings (room-turn) stay as they are.

## R1. Where an object works (content, Claude)
`content/objects.json` → `objects[].works` (optional; absent = works anywhere):
`{ "at": Facing[], "light"?: "day" | "lamp" | "dayOrLamp", "signal"?: true, "line": stringKey }`
- `at`: the facings where it works (`room` means the desk side: 房间 / 桌子 / 屏幕 views count as `room`).
- `light: "day"`: only while the beat is before dusk (the day loop's beat). `"lamp"`: only while the desk lamp is on. `"dayOrLamp"`: either (day at 窗; lamp at `room`).
- `signal: true`: only at 窗 (draw a one-bar signal icon on the phone's screen there; no bars elsewhere).
- `line`: the inner line shown when the player tries it somewhere it does not work (e.g. 「太暗了，屏不亮。」「没有信号。」).
Claude's values (in content): calculator `{at: [window, room], light: "dayOrLamp", line: obj.works.dark}`; phone `{at: [window], signal: true, line: obj.works.nosignal}`; iccard `{at: [room], light: "lamp", line: obj.works.nolamp}`. Others: no `works`.
- Where it does not work, using still opens the focus view, but the screen is faint / keys do nothing / the under-layer stays hidden, and the `line` shows once per entry.
- An object Kuro has upgraded ignores `works` (it works everywhere: "它帮你").

## R2. Using an object at a place is an event
Entering 使用 on an object logs `{ kind: "useAt", objectId, facing, ok: boolean }` (`ok` = the `works` rule held). Once per object per facing per day (no flood). Pure, replayable.

## R3. Board locks name a place
`given.lock.face?: Facing` (loader: only with `object`; a valid facing).
- The lock row's 用{object}看一眼 still lifts the object, but when `face` is set and the player is not at that facing, it first **turns the head there** (the room-turn move, shortest way) and then lifts it, in one step: the player sees the room turn to the window and the calculator rise to the light. From the desktop: back to 房间 first (as 回房间 does), then the turn.
- The code chips are offered only after a `useAt` with `ok: true` for that object today (at `face` if set, anywhere it works otherwise). Before that the lock row's hint reads `board.lock.goTo` 「拿去{face}那边用。」 with the facing's name.
- 让它试 (Kuro) is unchanged: it needs no place.

## R4. Strings (Claude adds): `obj.works.dark` 太暗了，屏不亮。 / `obj.works.nosignal` 没有信号。 / `obj.works.nolamp` 台灯没开，看不见底下那层。 / `board.lock.goTo` 拿去{face}那边用。 / the facing names already exist (`hud.turn.*`, room views).

## R5. Content (Claude, after this lands): `face` on the locks: day 8 / 11 / 15 calculator → `window`; day 17 phone → `window`; day 13 also an iccard reading of the scan's bottom layer at `room` (a second clue line in the file, not a second lock). Dictionary / tape locks: no `face`.

## R6. Tests
- `works` rules: calculator at 窗 by day → ok; at 床 → not ok + line; at `room` at night with lamp → ok, lamp off → not; phone only at 窗; iccard only at `room` with lamp; upgraded → always ok.
- `useAt` logged once per object/facing/day with the right `ok`.
- Lock with `face`: from 屏幕, 用计算器看一眼 → view becomes 窗 and the calculator is held; chips hidden until a `useAt ok`; then shown; a lock without `face` behaves as today.
- Loader: `face` only with `object`, valid facing; `works` shape.

## R7. Back to the screen after the trip (author 2026-11-04: 「放下计算器以后，镜头自动转回屏幕」)
When a board lock with `face` took the player from 屏幕 to a facing (R3), putting the object down (the last Esc / click outside / 放下) **returns the camera to 屏幕** on the same monitor and task page it left from: the room-turn back to 房间 (shortest way), then into 屏幕, in one move, like sitting back down. Only for a trip that a lock started (session flag set by R3's move, cleared on return); putting an object down anywhere else stays where you are. The lock panel is open on return, so the code chips (now offered) are in front of the player.
- Tests: from 屏幕, 用计算器看一眼 → 窗, use, put down → back on 屏幕 on the same task page with the chips shown; picking the calculator up at 窗 by hand and putting it down stays at 窗.

## R8. No second trip (Claude, seen in play 2026-11-04)
After a wrong code the player reopens the lock; today that click turns the head to the facing again and lifts the object again. Once a `useAt` with `ok` exists **today** for the lock's object, 用{object}看一眼 opens the code panel in place (chips shown), with no turn and no lift. The trip happens only while no working use has been logged today.
- Tests: trip, use, return, wrong code, reopen → no view change, chips shown; next day the first click trips again.
