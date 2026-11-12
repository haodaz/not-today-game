# Launch pages (2026-11-12)

Author's brief, in her words: 「launch 是要有游戏感的」「老王的立绘（透明底）+ 嘴里很多商业黑话，整体组成一个游戏的意向」「不一定在嘴里，比如背景孔雀开屏一样有很多对话条，或者背景像弹幕一样飘过很多黑话」「Vivi 脑海里有一个完美 AI」「要有各种各样的游戏感。我这不是针对某一个的……是一种 feel」. Her references: the 大厂黑话降维打击 comic poster, a 科普长图 with numbered callouts around a figure, the parody book cover 职场黑话大全, the Spider-Man pointing meme, Meme 2048.

## What is built

- The page covers the stage edge to edge (`.launch-layer`), in the comic-poster register: burst rays from the bust's chest (`repeating-conic-gradient`), halftone dots over everything, a chunky white title with a black stroke and hard shadow, note lines as tilted white stickers, the call line as a red sticker, 开始工作 as a yellow block button with a hard shadow, Kuro peeking over the bottom-right corner.
- The bust is the NPC portrait as it is (transparent, watercolour edge), drawn at 76 % of the stage's height so there is room above the head.
- `launch.motif` in content makes it a picture:
  - `fan` — the items as speech bubbles spread behind the bust like a peacock's tail (three rings, stable spread from the index).
  - `danmaku` — the items float across the whole page right to left in six lanes (dark page, yellow title).
  - `bubble` — a thought cloud over the head with the perfect four bars (all 100) and the items as chips (blue page).
- Every launch task of days 1–17 has a motif, zh + en (`content/tasks/*.json` → `launch.motif`). Items are that task's jargon / promises, 3–24 strings.

## Where to go next

Each day should get its *own* format when it is redone, not the same template with new words — e.g. day 17 (每个人都在找你) as people pointing at each other, day 14 (一千个新人) as a crowd, day 7 (按模板) as a parody book cover. New kinds go into `LaunchMotif.kind` (tasks.ts) + `launchMotif()` (compare.ts) + CSS.

## Looking at one quickly (dev only)

```
http://localhost:5175/?lang=zh&day=1&view=desktop&seed=flags:task_receivable_done&launch=task3
```

`&launch=<task>` boots the tower, marks the morning messages read, opens the task's page and shows its launch page; the earlier days' flags come from `seed=flags:a+b`. Clicking 开始工作 opens the work layer (compare / tune / generic).
