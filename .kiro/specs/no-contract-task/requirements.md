# No contract-compare task (the author, 2026-11-12)

There is no "合作协议过一遍" (contract clause compare) task in the story. Day 1's work is the ledger look and
v17 (`task3`); day 3 is Vivi's second tune and the boss's v18. The two-column clause compare was a
mechanics specimen that leaked into the game. Remove it from the game; keep it only as a test specimen.

## R1 · Content
- `content/days/day-01.json` / `en`: the item `task1` is already gone (2026-11-12). Keep it gone.
- `content/days/day-10.json` / `en`: the echo item `task1` (合作协议过一遍) is gone; the boss's day-10 voice
  note (`content/days/day-10.json` beats, and `content/replies/day-10.json` boss incoming + `fine`
  reply "下午三点前我要看到合并版") still speak of the contract — rewrite them as the echo of day 1's real
  work: 应收表看一眼 and v17 过一遍 ("第 1 天的活。一模一样。" stays). English twins alongside.
- `content/tasks/day-01.json` / `en`: delete the `task1` tree. `content/tasks/day-10.json` / `en`: delete
  its `task1` tree. Move both trees into `tests/fixtures/` (zh + en) first.
- `content/tasks/past.json`: remove the "v16 合同过一遍" entry (or the whole file if nothing else reads it;
  `src/state/days/past.ts` and `tests/workspace.test.ts` / `tests/guidance.test.ts` may need the same
  trim).
- `content/tasks/day-04.json` and `day-05.json` (+ en): cards whose `from.file` is `c-v17` with hints
  「在合作协议里」 / 「在合作协议的签字条款里」 — give them another source: the deck file for v17 if one is
  listed in `content/files.json` (add a download entry `d-tech-v17` "技术表达 v17.html" with `from: 1`
  and `afterFlag: task_merge_done`, body html `/docs/player/day-01-space.html`), hint 「在技术表达 v17 里」.
- `content/replies/day-01.json` (+ en) Xiao Zhang: "v17 我按旧的写还是等你" / "那我按 v16 写了哈" → say
  "字段按旧的写还是等你" / "那我按旧字段写了哈" (the flag `xz_writes_v16` may stay as an id).
- `content/files.json`: the contract files keep their dated names; `c-v18`'s haunted line stays.

## R2 · Tests
- `tests/specimen.ts` already re-inserts the contract item into days 1 and 10 for the test files that
  need the document mechanics; extend it to also inject the trees into `taskFiles` (a Map; set a copy of
  the day's task list with the fixture tree parsed through `parseTaskFile`, zh localised by en).
- Every test must stay green: `npx vitest run`. Snapshots that change only by content are refreshed
  after a word-level diff check.
- `npm run -s validate` and `npx tsc --noEmit -p .` green.

## R3 · Clean-up list (new-mechanism-cleans-old)
- grep for 合作协议 / 合并版 / c-v17 / task_v17_done across content, src, tests, .kiro/steering and
  script/notes; each hit either removed or justified in the commit message.
