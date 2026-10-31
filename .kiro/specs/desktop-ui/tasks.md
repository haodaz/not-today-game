# desktop-ui — tasks

After each task: `npx tsc --noEmit 2>&1 | tail -20` and `npx vitest run 2>&1 | tail -20`. Do not
commit. No copy in `src/`; missing strings or content are TODOs for Claude.

## 1. Shell, dock, header
- [ ] `html.ts`, `i18n.ts`, `beat.ts`, `rings.ts`, ported `desktop.css`.
- [ ] `shell.ts`: two monitors, top bar (brand, app, 第 N 天 · 时段 HH:MM, weather, Kuro dot), dock with badges, night plates, ring vars.
- [ ] `controller.ts` + `main.ts`: store from save or `?day=N`, beat params, render loop, focus mode.
- [ ] Event amendments U2 (`reply.t`, `open`).

## 2. 消息
- [ ] Bubble parsing; transcript rebuild (U3); unread and previews.
- [ ] List, conversation, reply bar (chips, lent, gone + inner, free input, deregistered).
- [ ] Live runtime: send → event → plan progress (read delay, typing, recall, atBeat clock advance).

## 3. Kuro small window and body
- [ ] kuro-days parser + guard (18 files).
- [ ] Small window view (idiom, starters, turns, bedtime, night blink).
- [ ] Body: state precedence, frames, crossfade controller, bob.

## 4. 工作台 home
- [ ] Workbench data loader (proposed schema) with empty states.
- [ ] Sidebar, hello, ask + modes, cards (state numbers), common, continue.

## 5. Inner pages
- [ ] 文档 (two columns, marks), 账本 (tables, state overdue, model row), 代码 (code + changelog, collapse day U5).

## 6. 浏览器
- [ ] Browser data loader + guard (18 files); newspaper view; opening logs `open browser`.

## 7. Snapshots and wrap-up
- [ ] Snapshots per requirements §3 (day 1, 10, 13, night) for each app; one fixture workbench snapshot.
- [ ] Missing-key test with the documented TODO list; log decisions and TODOs.
