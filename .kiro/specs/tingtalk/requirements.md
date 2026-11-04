# tingtalk — requirements (2026-11-04, author)

"如果你觉得工作台里还有对话什么的比较乱，正好单独做个办公对话软件，不要留在工作台。这样切屏幕就能看对话/干活。" / "办公的一个像钉钉，家庭的一个像微信……家庭的叫 Hichat（Hi信），办公的叫 听听（TingTalk）。"

## R1. Two chat apps, one workbench
- **听听 / TingTalk** (new dock app, DingTalk look as 工作台·消息 has today): the work threads (`WORK_THREADS`: boss, partner, group, xiaozhang, laozhou), moved out of 工作台 unchanged (bubbles, voice, files, deliverable bubbles, unread).
- **Hichat / Hi信**: today's 消息 app renamed (家里, 朋友圈); nothing else changes.
- **工作台** loses its 消息 rail item; it keeps home and the task pages (shell spec).
- Default placement: **工作台 on the left monitor, 听听 on the right** (author: "我作为一个真正的打工人，对话挪到右屏，干活左屏"). Switching monitors (左屏 / 右屏) is how the player goes between working and talking.

## R1b. Move a window to the other screen (the macOS way, nothing invented)
- Hovering a window's green traffic-light button shows a small menu: 「移到左屏」/「移到右屏」 (the current one disabled), like macOS's "Move to <display>". Clicking moves the app to that monitor; the view follows it.
- Dragging a window's title bar past the monitor's inner edge moves it the same way.
- **Mission Control (调度中心)**, the macOS view the author showed: a top-bar button (and F3) opens it over both monitors: a strip at the top with the two screens' thumbnails (左屏 / 右屏), below it every open app window spread out as a scaled live thumbnail with its name. Drag a window onto a screen thumbnail → it moves there; click a window → close Mission Control and focus it (switching monitor if needed); Esc or the button again closes it. Nothing else (no new desktops, no + button).
- Placement is remembered for the run (survives reload and the next day); a fresh run starts with the default. If both apps end up on one monitor, the one moved last is in front.

## R2. Everything that pointed at 工作台·消息 now opens 听听
- `openApp:msgs` (看一眼消息) is done by opening 听听 (event unchanged).
- Vivi's lock lands on her conversation in 听听.
- A 素材 card from a conversation (`from.conv`): its ↗ opens that thread in 听听 on the other monitor; the shell's 文件 pane keeps the read-only lines.
- Message task links / checklist links that open a conversation open it in 听听.

## R3. Strings (Claude adds before the run): `dock.tingtalk` / `tingtalk.title` 听听 · TingTalk; `win.moveLeft` 移到左屏, `win.moveRight` 移到右屏; `mc.title` 调度中心 · Mission Control, `mc.open` 打开调度中心. `dock.msgs` / `msgs.title` now read Hi信 / Hichat.

## R4. Tests
- Dock: 听听 and Hi信 tiles with their own unread; 工作台 has no 消息 rail item.
- Threads: work threads only in 听听, family only in Hi信 (work-home-split rewritten for the three apps).
- openApp:msgs, the Vivi lock, conv sources and links all land in 听听.
- auto-day selectors: `[data-action=dock][data-app=tingtalk]`, `[data-action=conv][data-conv=…]` unchanged.
