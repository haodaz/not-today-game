# game-menu — requirements (author feedback 2026-11-25, #77–#87; built by Claude)

Mock: `design/game-panels-2026-11-25/index.html` (frames `g-*.png`). Code: `src/world/room/runes.ts`,
`src/world/room/menu.ts`, `status.ts`, `hud.ts` (task card, 道具, 设置), `src/ui/title/view.ts`;
styles at the end of `room.css` and `title.css`. Supersedes the tile strip of `status-panel` R1 and
the bottom-left buttons of `day-loop`.

## Her words
- 「更像水墨，而不是一个克系感的游戏」 → not ink-wash paper; a refined eldritch game UI.
- Icons 「更像一个精致游戏、而且是克系游戏符文」; 「icon不需要配文字，点一次就知道了」.
- 「别这么黑」「整个做玻璃感蒙版」; title 「太黑了…文字发光亮一些，只需要局部蒙版」.
- The task card shows only the current line; the day sits on top of it; the delivery countdown is
  plain white digits; while waiting: 「随便做点什么（只要不是上班），等外卖来」 with no 前往.
- Login: 「身份卡在左边菜单，点击登陆」 — not a card always on the right.

## R1 The task card (room, top left)
One glass card: the day rune, 第 N 天, the beat and the time (and the heart-rate chip from day 9);
a ruler with one red tick too many; the current checklist line only (with 前往); while a meal is on
its way and nothing else is current, `checklist.waitIdle` (no 前往) and 外卖在路上 + mm:ss in white.

## R2 The medallions
人物 · 道具 · 设置 as rune medallions (no words; the name is `title` and `aria-label`), top right in
the room, bottom left on 屏幕 (where 设置 stays the dock's tile). 道具 only once something is found.
Hover turns the ring and lights the rune red. Our own geometry only — no Goetia seal, no Yellow Sign.

## R3 One menu
人物, 道具 and 设置 are tabs of one full-screen menu (`menu-tab`; Tab / Shift+Tab walk them; Esc,
the × medallion and the frosted outside close). The room shows through frosted glass (never a black
screen); the tabs and the page sit on glass cards; light text with a soft glow; bone hairlines and
one dark red. While it is up the HUD and the dialogue box under it are hidden. The tabs pass the
guide and the box's mask like 人物 always did.

## R4 The day slope (visual-slope-tech-to-rune)
Days 1–6: the frame's eye closed. 7–9: half open, a red ritual circle turning behind. 10–18: open,
veins from the four corners, the glass breathing red, the 理智 trace red.

## R5 The pages
- 人物: the portrait in a rune lens; 理智 as a trace (jittery when low), 饱食度 ten cells (red + 饿
  below what work needs), 克总 hearts, 同化 a line with its marker and the good-ending tick, the old
  things as numbered cases, the chats.
- 道具: its own tabs (老物件 · 照片 · 收到的); numbered cases; the thing large on a rune plinth; a
  catalogue card (No., name, the day it came, chips, blurb, Kuro's word, 拿起来).
- 设置: rows with segmented choices and a diamond switch; restart (and on the title clear-all) still
  ask first; no 取消 row (the × closes).

## R6 The title
The room at its own light, a soft shadow only behind the words; the logo glows. The column: 继续 or
新游戏, 制作, and the identity card last — a user's or a guest's badge, or 未登录 · 点击登录
(`auth-open`) for nobody signed in. The login card opens over the menu (from the card, or 新游戏 /
继续 with nobody signed in — login-first still holds) on glass. 老物件 / 影集 / 设置 are medallions at
the bottom right. 设置 on the title is the same menu with no tabs.

## Open
- A bundled CJK serif: the menus use Songti SC / STSong / Noto Serif SC from the system.
- The title's 老物件 and 影集 pages keep their light look for now.
