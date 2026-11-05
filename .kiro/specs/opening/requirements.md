# opening — requirements (author 2026-11-04)

「问完信息之后，名字变成邮单贴在箱子上，然后淡出。然后才进入梦境剧情（回忆过去讲背景……环境背景 + npc 立绘 + 对话框剧情文字，把主人公第一天醒来之前的前情串起来）。」「主要是公司蓬勃的时候的一些回忆。」
Between the title page's 开始 (title-page FR3) and day 1's first view. Day 1 already says the box at the door has no sender and the recipient is your name; day 18 fills in a slip. This is where that label comes from.

## R1. The name becomes the label (≈ 4 s, no input)
- After 开始, the question column fades out (300 ms). In the middle of the dark title screen, the name the player typed (the 「这是谁的故事？」 answer) is **printed** into a shipping label: a white label 320 × 180 px, thin grey rules, two fields: 收件人 (`opening.to`) with the name in a monospace print font, slightly askew (−1.5°), as if printed; 寄件人 (`opening.from`) **empty**. The name types itself in, one character every 90 ms, with a faint dot-matrix printer sound (`label-print`, silent if missing).
- A cardboard box rises behind it (CSS: kraft brown `#B98B5E`, darker flaps, packing-tape strip; or `public/room/box/case.png` if present) and the label **sticks** onto the box's side: a 400 ms move + 2° settle, a soft tap.
- Hold 1.2 s, then everything fades to black (1.2 s).

## R2. The dream (content/prologue.json, Claude has written it)
- `content/prologue.json` `{ _note, say: Line[] }` with the day beats' line shape (`narration` / `speaker` / `inner`, optional `backdrop`, `prop`); `content/en/prologue.json` its twin (same shape, same speakers, same backdrops; strict loader, checked like the day files).
- It plays in the normal dialogue box over the dream backdrops (the scene layer as nights use it), speakers with their portraits from npc.json, silhouettes for names not in it (「同事」). Clicking / Enter advances, as everywhere.
- At its end: fade to black (800 ms), then day 1 starts exactly as today (the room, morning, rain).
- A small 跳过 (`opening.skip`) top-right, **only once a run has been finished before** (`finishedRuns ≥ 1`); it jumps straight to the fade into day 1.
- Nothing here is an event or changes state; the names are already in `names` from the questions.

## R3. Strings (Claude adds): `opening.to` 收件人 · To; `opening.from` 寄件人 · From; `opening.skip` 跳过 · Skip.

## R4. Tests
- After 开始: the label shows the typed name in 收件人 and an empty 寄件人; the box; then the dream's first line.
- The prologue loader: valid file loads; the twin must match shape/speakers/backdrops; unknown keys fail.
- Advancing through all lines ends in day 1's first view; 跳过 appears only with finishedRuns ≥ 1 and goes straight to day 1.
