# tasks/ — 工作台里每天的活（手写对话树，不走 LLM）

`day-NN.json`：`tasks[]`，每件活 `id`（和 content/days 的清单条目同名）、`title`、`app`（docs / ledger / code）、`done`（打勾的旗标，和 days 一致）、`start`（活出现时的旁白 + 三个选项）、三条路 `self` / `look` / `let`：各自的 `say`（旁白 / 内心）、`kuro`（克总在小窗里说的英文常量）、`effects`（flags、san；look 带 looked:true，let 带 letItDoUnchecked:1）。
生成器：script/tools/make-tasks.mjs（在 nottoday 仓库）。改哪一句改生成器重出。
