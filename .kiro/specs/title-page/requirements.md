# title-page — requirements

The launch page. Reuses the gamebook reader's decided flow (nottoday/index.html 扉页): one question per line, no defaults, dice for random names, the last button says 开始 not 继续.

## FR1. Screens
- With a save: only `继续 · 第 N 天`; small row: 声音 · 语言 · 绑定邮箱 (backend). **There is no restart anywhere** (author 2026-11-01, a mechanic, not a UI choice): the only ways back to day 1 are the endings (bad = 「第一日，改」, survive = 「回到第一日」).
- Without a save: the questions, one at a time, each answered before the next appears: 这是谁的故事？（名字）→ 家里人怎么称呼你？→ 老板怎么叫你？→ 同事怎么叫你？（默认留空，不预填；dice offers 老大 / 老板 / 哥 / 姐 / 名字）→ 她 / 他 / 不说. Each has a 🎲 that fills a neutral random value. Then 开始.
- Kuro's face never appears on this page; the first sight of it is inside the screen on day 1.
- Credit line only here and on the cover: `好大壮 · 与 Claude 一起写成`.

## FR2. Rules
- Never prefill personal names (see no-personal-defaults). Values go to `names` (variables.json) and to `profiles.names` when online.
- No restart action exists. `nt_run` is cleared only by an ending. `nt_profile` always survives.

## FR3. Tests
- Snapshot the two screens; property: every question must be answered or diced before 开始 enables.
