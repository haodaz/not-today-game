# desktop-ui — tasks

After each task: `npx tsc --noEmit 2>&1 | tail -20` and `npx vitest run 2>&1 | tail -20`. Do not
commit. No copy in `src/`; missing strings or content are TODOs for Claude.

## 1. Shell, dock, header
- [x] `html.ts`, `i18n.ts`, `beat.ts`, `rings.ts`, ported `desktop.css`.
- [x] `shell.ts`: two monitors, top bar (brand, app, 第 N 天 · 时段 HH:MM, weather, Kuro dot), dock with badges, night plates, ring vars.
- [x] `controller.ts` + `main.ts`: store from save or `?day=N`, beat params, render loop, focus mode (`?focus=`, key F).
- [x] Event amendments U2 (`reply.t`, `open`).

## 2. 消息
- [x] Bubble parsing; transcript rebuild (U3); unread and previews.
- [x] List, conversation, reply bar (chips, lent, gone + inner, free input, deregistered, day-15 own input).
- [x] Live runtime: send → event → plan progress (read delay, typing, recall, atBeat clock advance).

## 3. Kuro small window and body
- [x] kuro-days parser + guard (18 files).
- [x] Small window view (idiom, starters, turns, bedtime, night blink).
- [x] Body: state precedence, frames, crossfade controller, bob.

## 4. 工作台 home
- [x] Workbench data loader (proposed schema) with empty states.
- [x] Sidebar, hello, ask + modes, cards (state numbers), common, continue.

## 5. Inner pages
- [x] 文档 (two columns, marks), 账本 (tables, state overdue, model row), 代码 (code + changelog, collapse day U5).

## 6. 浏览器
- [x] Browser data loader + guard (18 files); newspaper view; opening logs `open browser`.

## 7. Snapshots and wrap-up
- [x] Snapshots per requirements §3 (day 1, 10, 13, night) for each app; workbench inner pages; fixture-filled workbench assertions.
- [x] Missing-key test with the documented TODO list; log decisions and TODOs.
