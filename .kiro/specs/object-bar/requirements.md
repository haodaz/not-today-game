# 老物件栏 · the old objects on the screen (Claude, 2026-11-03; author's words: 「老物件获取之后，变成屏幕干活的道具 icon 时，点击后正好可以使用 UI 的那个交互界面」「被克总优化过的有一个更 fancy 的图标，占据了就有一个小触手环绕图标」)

Why: work is the main line (work-v2). Today the objects are used only in the room: walk to the desk, lift, 使用. While working on 屏幕 the player should reach them from the screen, the way you reach a tool. Same devices, same programs. Only the entry point is new.

## R1 · the bar
- On 屏幕 (desktop view, both monitors' shell), a row of icons titled 「老物件」 (string `objbar.title`; en "Old things"). It sits in the 工作台 window, under its left nav. The exact spot is up to you, but it must be visible on every 工作台 page.
- One icon per object the player has found (`openLayer` → found, as in world-state), in found order. The 端盒 itself and the phone already on the desk are not in the bar.
- Before day 1's chick is found, the bar is not shown at all. No empty frame.
- Icon by state, from `public/objects/icons/` (copied in by Claude):
  - own: `<id>.png`
  - upgraded and still on loan (the upgrade day and the two after, see `takenByKuro` / `upgradedOn` in src/world/objects/taken.ts): `<id>-up.png`
  - taken by Kuro: `<id>-taken.png`
- Objects without icons yet (iccard, textbook, phone, later camera): a placeholder, `public/objects/<id>_front.png` scaled into the same box. Placeholders are fine (author: 「先占位」).
- Icons are pixel art: `image-rendering: pixelated`, an integer scale, no tile or frame behind them (author: 「不需要带底框，和老物件一样就很好」).

## R2 · click = 使用, over the screen
- Clicking an icon opens that object's drawn device (src/world/room/devices.ts, the same markup and the same `obj-key` actions and program reducers) in a window over the desktop: centred, with a dim backdrop. Close it with × or Esc and you are back on the same 工作台 page.
- No walk to the room and no camera move. It is the same `session.holding` + `session.hand.using` state the room uses, so a key pressed here is the same event as in the room.
- If the object is currently held in the room, the bar opens that same object.
- Objects that are not devices yet (photo faces, see `isDevice`): open their existing 使用 face the same way. If that cannot render over the desktop, show the icon larger with its name and the string `objbar.notYet` 「还不能在这儿用。」 (en "Not usable here yet.").
- Taken objects open too. They show what the room shows for a taken object (only Kuro's face, ability gone; object-upgrade "taken"). This is the point: the player sees it is not theirs any more.

## R3 · the board lock points at the bar
- A board whose given column is locked behind an object (`given.lock.object`, e.g. day 5's pager), with that object found and not taken: the lock button's label becomes `board.lock.useObject` 「用{object}看一眼」 (en "Check it on the {object}"), and clicking it opens that object from the bar (R2).
- The code chips stay where they are now. Nothing about how the code is entered changes.
- If the object is not found, or is taken: unchanged. Kuro offers to open it (`board-kuro-lock`).

## R4 · tests
- Snapshot: the bar on day 1 after the chick, and on day 8 with one object upgraded and one taken (use the dev params `?found=` / `&upgraded=`, or events).
- Unit: the icon state per object (own / up / taken) from the log. No bar before the first find. Clicking an icon sets holding + using. Esc closes it and the 工作台 page is unchanged.
- Unit: the day 5 lock label with the pager found.
- Strings `objbar.title`, `objbar.notYet` and `board.lock.useObject` in zh and en (Claude adds them; Kiro only reads them).
