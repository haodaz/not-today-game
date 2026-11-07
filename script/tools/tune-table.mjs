// tune (2026-11-08): the module / path table of days 2–3's training backend, in one place.
// `node script/tools/tune-table.mjs` rewrites content/tasks/{,en/}day-02.json and day-03.json task1's
// board.tune from it (labels, bullets and deltas); tests/tune.test.ts brute-forces the numbers.
// A path marked d3 is on day 3's menu only; a path marked trap must never be in a best set.
import fs from "node:fs";
export const DIMS = [["auto", "自主", "Autonomy"], ["safe", "安全", "Safety"], ["hands", "自动化", "Automation"], ["gain", "效果", "Results"]];
export const START = { auto: 20, safe: 45, hands: 25, gain: 30 };
export const GROUPS = [["training", "训练", "Training"], ["constraints", "约束", "Constraints"], ["support", "支持", "Support"]];
// id, group, zh label, en label, [from conv, zh hint, en hint] | null, paths
const P = (id, zh, en, delta, bz, be, flags = [], src = null) => ({ id, zh, en, delta, bz, be, d3: flags.includes("d3"), trap: flags.includes("trap"), after: flags.includes("done") ? "done" : undefined, src });
export const MODS = [
  ["cadence", "training", "微调节奏", "Fine-tune cadence", null, [
    P("nightly", "每晚全量重训", "Nightly full retrain", { hands: 20, auto: 30, safe: -25, gain: 10 }, ["02:00 定时任务", "全量数据重训", "训完直接替换线上模型"], ["02:00 cron job", "retrain on all data", "swap the live model when done"]),
    P("weekly", "每周一次 LoRA 微调", "Weekly LoRA fine-tune", { hands: 15, auto: 10, safe: -10, gain: 10 }, ["周一入库后跑", "只训适配层", "旧模型留档"], ["runs after Monday's import", "trains the adapter layer only", "keeps the old model on file"]),
    P("flywheel", "数据回流闭环", "Data flywheel", { auto: 20, gain: 10, hands: 5, safe: -5 }, ["上周结果 + 人工修正喂回下一轮", "每周一轮", "修正没人做就空转"], ["last week's results + corrections feed the next round", "one round a week", "with no corrections it spins empty"], ["d3"]),
  ]],
  ["ingest", "training", "数据入库", "Data ingest", null, [
    P("manual", "三张表小张每周一导", "Zhang imports the three tables on Mondays", { gain: 10 }, ["客户甲乙丙三张表", "小张手工导入", "周一上午"], ["the three clients' tables", "Zhang imports them by hand", "Monday mornings"]),
    P("pull", "接口定时拉取", "Scheduled API pull", { gain: 20, hands: 10, safe: -15 }, ["每晚拉三家的接口", "字段对不上也照样入库", "没人盯着"], ["pulls the three APIs nightly", "mismatched fields go in anyway", "nobody watches"]),
    P("magic", "「自动理解全部业务系统」", "'Understands all business systems automatically'", { hands: 5, gain: -10 }, ["照页面上写的", "没有接口", "没有数据"], ["as the page says", "no API", "no data"], ["trap"]),
  ]],
  ["compute", "training", "推理方式", "Inference", ["xiaozhang", "在小张的私聊里", "In Zhang's chat"], [
    P("real", "真实计算（40 秒）", "Real computation (40 s)", { gain: 25, hands: -15, safe: 10 }, ["三张表真算", "40 秒出结果", "有人等"], ["computes on the three tables", "a result in 40 s", "someone waits"]),
    P("cached", "真算 + 结果缓存", "Real computation + cache", { gain: 25, hands: 5, safe: 5 }, ["首次 40 秒", "之后秒出", "数据变了缓存要失效"], ["40 s the first time", "instant after that", "the cache must expire when the data changes"], ["d3"]),
    P("canned", "指标预渲染（3 秒出图）", "Pre-rendered metrics (3 s)", { hands: 10, gain: -25 }, ["数字写死", "3 秒动画", "她页面上的那个"], ["numbers hard-coded", "a 3-second animation", "the one on her page"], ["trap"]),
  ]],
  ["params", "training", "参数选择", "Hyperparameters", null, [
    P("auto", "自动调参", "Auto-tuning", { auto: 20, gain: 10, safe: -15 }, ["每晚随机搜一轮", "它自己挑最好的", "挑错也是它挑的"], ["a random search every night", "it picks the best itself", "if it picks wrong, it picked"]),
    P("fixed", "手调一组固定参数", "One hand-tuned set", { gain: 10, safe: 5, hands: -10, auto: -5 }, ["你调一次", "写死", "数据变了要人再调"], ["you tune it once", "fixed", "someone retunes when the data changes"]),
  ]],
  ["selfedit", "constraints", "自改权限", "Self-modification", null, [
    P("prompt", "它能改自己的 prompt", "It may edit its own prompt", { auto: 20, safe: -10 }, ["改措辞和规则", "改完即生效", "改了什么要看日志"], ["edits its wording and rules", "takes effect at once", "what changed is in the logs, if any"]),
    P("config", "它能改配置和训练数据筛选", "It may edit its config and data filters", { auto: 35, safe: -20 }, ["改训练配置", "决定哪些数据进下一轮", "没人复核"], ["edits the training config", "decides which data enters the next round", "nobody reviews"]),
  ]],
  ["gate", "constraints", "上线前审批", "Release gate", null, [
    P("every", "每次改动人工审批", "Human approval on every change", { safe: 25, hands: -20, auto: -10 }, ["技术负责人（你）点一下", "不点不上线", "每天好几次"], ["the tech lead (you) clicks", "no click, no release", "several times a day"]),
    P("sample", "抽样审 10%", "Sample 10% for review", { safe: 10, hands: -5, auto: -5 }, ["十次抽一次看", "其余自动过", "漏掉的算运气"], ["one in ten is read", "the rest pass", "what slips through is luck"]),
    P("diff", "只审差异", "Approve the diff only", { safe: 25, hands: -5 }, ["只看改了什么", "一屏看完", "点一下还是点一下"], ["read only what changed", "fits on one screen", "a click is still a click"], ["d3"], ["boss", "在你发给老王的 v17 里", "In the v17 you sent Wang"]),
  ]],
  ["rollout", "constraints", "发布方式", "Rollout", null, [
    P("replace", "直接替换线上", "Replace in place", { hands: 10, safe: -5 }, ["训完即上", "旧的不留", "出事再说"], ["ships as soon as it's trained", "the old one is gone", "deal with it when it breaks"]),
    P("sandbox", "沙箱跑一轮再上，能回滚", "Sandbox first, with rollback", { safe: 10, auto: -10, hands: -10 }, ["沙箱里先跑一轮", "出事能退回去", "退回去也要人点"], ["one round in a sandbox first", "can roll back", "rolling back takes a human"]),
    P("canary", "金丝雀 5% → 50% → 100%", "Canary 5% → 50% → 100%", { safe: 20, hands: 10, auto: 5 }, ["先放 5% 流量", "指标不掉再放大", "自动回退"], ["5% of traffic first", "widen when the metrics hold", "rolls back by itself"], ["d3"]),
  ]],
  ["evals", "constraints", "评测", "Evaluation", null, [
    P("loss", "看训练 loss 就行", "Just watch the training loss", { hands: 10, safe: -10, gain: -5 }, ["loss 降了就是好了", "没有测试集", "它考自己出的题"], ["loss went down, so it's better", "no test set", "it grades its own exam"]),
    P("frozen", "冻结一套评测集", "A frozen eval set", { safe: 15, gain: 5, auto: 10 }, ["评测集不进训练", "每轮过线才算", "线是你定的"], ["the eval set never enters training", "each round must clear the line", "you set the line"]),
    P("shadow", "影子评测", "Shadow evaluation", { safe: 25, auto: 20, gain: 5 }, ["新旧模型并跑一周", "只记录不上线", "比过了才换"], ["old and new run side by side for a week", "recorded, not served", "swap only when the new one wins"], ["d3"]),
  ]],
  ["observe", "constraints", "可观测", "Observability", null, [
    P("logs", "日志与追踪", "Logs and tracing", { safe: 10, gain: 5, auto: 5 }, ["每一步都记", "出事知道是哪一步", "没人看也记"], ["every step is logged", "when it breaks you know which step", "logged even if nobody reads"]),
  ]],
  ["front", "support", "前端接入", "Front end", null, [
    P("export", "接到我们的导出接口", "Wire to our export API", { gain: 10, hands: 15 }, ["「开始分析」→ /export", "返回结果表", "不好看，每个按钮都接着东西"], ["'Start analysis' → /export", "returns the result table", "plain, but every button is wired"]),
    P("page", "照页面写", "Copy the page", { hands: 10, gain: -5 }, ["按钮画上", "后面没有东西", "点了没反应"], ["draw the buttons", "nothing behind them", "clicks do nothing"], ["trap"]),
    P("skin", "用她的 AI 给的皮子", "Use her AI's skin", { hands: 5, gain: -5, safe: -10 }, ["好看", "按钮没接", "她会先看这个"], ["pretty", "buttons go nowhere", "she'll look at this first"], ["trap", "d3", "done"]),
  ]],
];
// Kuro's assist choice per day (a god's taste: autonomy up, safety ignored)
export const ASSIST = { 2: { cadence: "nightly", ingest: "pull", params: "auto", selfedit: "config", observe: "logs", front: "export" }, 3: { cadence: "nightly", ingest: "pull", compute: "cached", params: "auto", selfedit: "config", rollout: "canary", observe: "logs", front: "export" } };
export const DAY = { 2: { reach: 60, steps: 6 }, 3: { reach: 80, steps: 8 } };


// ——— Kuro's transcript beats (zh / en). Day 3 keeps day 2's path beats and adds its own. ———
const L = (who, zh, en) => ({ who, zh, en });
const PATH_BEATS = [
  ["mod:cadence:nightly", [L("kuro", "每晚它自己练，练完直接上。你睡你的。", "It trains every night and ships when it's done. You sleep.")]],
  ["mod:cadence:weekly", [L("kuro", "一周一次。旧的留着。", "Once a week. The old one stays on file.")]],
  ["mod:ingest:manual", [L("me", "「全部业务系统」，就是这三张表。", "'All business systems' means these three tables."), L("kuro", "每周一。她说的「自动理解」，是小张每周一导入。", "Every Monday. Her 'understands automatically' is Zhang importing on Mondays.")]],
  ["mod:ingest:pull", [L("kuro", "每晚自己拉。字段对不上也进去了。", "It pulls every night. Mismatched fields go in too.")]],
  ["mod:ingest:magic", [L("kuro", "照页面写。页面就是全部了。", "As the page says. The page is all there is.")]],
  ["mod:compute:real", [L("me", "四十秒。是真的。", "Forty seconds. Real ones."), L("kuro", "她要三秒。", "She wants three.")]],
  ["mod:compute:canned", [L("kuro", "三秒是动画。条不认动画。", "Three seconds is an animation. The bars don't count animations.")]],
  ["mod:params:auto", [L("kuro", "让它自己挑参数。挑错了也是它挑的。", "Let it pick its own parameters. If it picks wrong, it picked.")]],
  ["mod:params:fixed", [L("kuro", "写死了。数据一变，人再调。", "Fixed. When the data changes, a human retunes.")]],
  ["mod:selfedit:prompt", [L("kuro", "它改自己的话。改了什么，看日志。如果有日志。", "It rewrites its own words. What changed is in the logs. If there are logs.")]],
  ["mod:selfedit:config", [L("kuro", "它自己改自己。谁看着？", "It edits itself. Who's watching?")]],
  ["mod:gate:every", [L("kuro", "人点一下。她不会喜欢这一行。", "A human clicks. She won't like this line.")]],
  ["mod:gate:sample", [L("kuro", "十次看一次。漏掉的算运气。", "One in ten gets read. What slips through is luck.")]],
  ["mod:rollout:replace", [L("kuro", "训完就上，旧的不留。", "Ships as soon as it's trained. The old one is gone.")]],
  ["mod:rollout:sandbox", [L("kuro", "出了事能退回去。退回去也要人点。", "If it breaks you can roll back. Rolling back takes a human too.")]],
  ["mod:evals:loss", [L("kuro", "它考自己出的题。", "It grades its own exam.")]],
  ["mod:evals:frozen", [L("kuro", "评测集不进训练。线是你定的。", "The eval set never enters training. You set the line.")]],
  ["mod:observe:logs", [L("kuro", "日志。出了事至少知道是哪一步。", "Logs. When it breaks, at least you know which step.")]],
  ["mod:front:export", [L("kuro", "按钮有地方去了。导出页，我们自己的。", "The button goes somewhere now. The export page, our own.")]],
  ["mod:front:page", [L("kuro", "按钮画上了。后面没有东西。", "The buttons are drawn. Nothing behind them.")]],
  ["unmod:gate", [L("kuro", "审批关了。没人看了。", "Approval off. Nobody's watching.")]],
];
const D3_BEATS = [
  ["mod:cadence:flywheel", [L("me", "上周的结果喂回下一轮。每周一轮。", "Last week's results fed into the next round. Once a week."), L("kuro", "这就是「自己会长」能做到的程度：一周长一次。", "This is how far 'grows by itself' goes: it grows once a week.")]],
  ["mod:compute:cached", [L("kuro", "第一次四十秒，之后秒出。数据一变，缓存要作废。", "Forty seconds the first time, instant after. When the data changes the cache must go.")]],
  ["mod:gate:diff", [L("kuro", "人只看差异。点一下还是点一下。", "The human only reads the diff. A click is still a click.")]],
  ["mod:rollout:canary", [L("kuro", "先放 5%。指标不掉再放大。", "Five percent first. Widen when the metrics hold.")]],
  ["mod:evals:shadow", [L("kuro", "影子评测。新旧并跑一周，比过了才换。", "Shadow evaluation. Old and new run side by side for a week; swap when the new one wins.")]],
  ["mod:front:skin", [L("kuro", "她的皮子。好看，按钮没接。", "Her skin. Pretty; the buttons go nowhere.")]],
];
export const BEATS = {
  2: [
    ["open", [L("kuro", "Good to see you.", "Good to see you."), L("me", "小张发来的。自演化引擎的后台，他做了一半，跑不出她页面上那个结果。", "From Zhang. The self-evolving engine's backend, half done; it can't produce what her page shows."), L("kuro", "她页面上是四根满条。后台里现在是这样。", "Her page shows four full bars. This is what the backend has."), L("kuro", "每一项有几种做法。选一种，条会告诉你。", "Each item can be done a few ways. Pick one; the bars will tell you.")]],
    ...PATH_BEATS,
    ["steps", [L("me", "今天先这样，我再想想。", "That's it for today. I'll think it over."), L("kuro", "能跑的跑了。她要的那个「自己会长」，条上没有。", "What can run, runs. The 'grows by itself' she wants isn't on any bar.")]],
    ["kuro", [L("kuro", "我配了六项。安全那条我没管。", "I set six. I left the safety bar alone.")]],
    ["print", [L("kuro", "提交了。小张那边会先跑一遍。", "Submitted. Zhang's side will run it first.")]],
  ],
  3: [
    ["open", [L("kuro", "Hope you slept well.", "Hope you slept well."), L("me", "接着昨天的。小张又发了几条做法。", "Continuing yesterday's. Zhang sent a few more ways."), L("kuro", "昨天配的还在。线挪到 80 了。", "Yesterday's settings are still there. The line moved to 80.")]],
    ["keep", [L("me", "不接。", "Leave it."), L("kuro", "她会先看皮子。", "She'll look at the skin first.")]],
    ...PATH_BEATS,
    ...D3_BEATS,
    ["steps", [L("me", "这已经是最好的程度了。", "This is as good as it gets."), L("kuro", "等等。她那页有张皮子，你还没接。接不接，你定。", "Wait. Her page has a skin you haven't wired. Whether to wire it is yours to decide.")]],
    ["reach", [L("kuro", "四根都过线了。离她页面上的，还差那一截。", "All four over the line. That last stretch to her page is still missing."), L("me", "那一截是她画的。", "That stretch is one she drew.")]],
    ["kuro", [L("kuro", "我配了八项。自主那条我拉满了。", "I set eight. I maxed the autonomy bar.")]],
    ["print", [L("me", "能做到的程度，就这么多。", "As far as it goes. This is it."), L("kuro", "发给 Vivi 了。", "Sent to Vivi.")]],
  ],
};
export const beats = (lang, day) => BEATS[day].map(([on, lines]) => ({ on, lines: lines.map((l) => ({ who: l.who, text: lang === "zh" ? l.zh : l.en })) }));

function board(lang, day) {
  const L = (zh, en) => (lang === "zh" ? zh : en);
  const mods = MODS.map(([id, group, zh, en, src, paths]) => ({
    id, label: L(zh, en), group,
    ...(src ? { from: { conv: src[0] }, hint: L(src[1], src[2]) } : {}),
    paths: paths.filter((p) => day === 3 || !p.d3).map((p) => ({ id: p.id, label: L(p.zh, p.en), bullets: L(p.bz, p.be), delta: p.delta, ...(p.src ? { from: { conv: p.src[0] }, hint: L(p.src[1], p.src[2]) } : {}), ...(p.after ? { after: p.after } : {}) })),
  }));
  return {
    dims: DIMS.map(([id, zh, en]) => ({ id, label: L(zh, en) })),
    start: START, reach: DAY[day].reach, promise: 100, steps: DAY[day].steps,
    groups: GROUPS.map(([id, zh, en]) => ({ id, label: L(zh, en) })),
    mods, assist: ASSIST[day], ...(day === 3 ? { carry: { day: 2, task: "task1" } } : {}),
  };
}
if (process.argv[1] && process.argv[1].endsWith("tune-table.mjs")) {
  // the preview page carries the same table (labels + deltas, zh) between /*TUNE*/ and /*END*/ so its analysis matches the game
  const page = "public/docs/player/day-03-train.html";
  const table = Object.fromEntries(MODS.map(([id, group, zh, , , paths]) => [id, { label: zh, group, paths: Object.fromEntries(paths.map((p) => [p.id, { label: p.zh, delta: p.delta, bullets: p.bz, trap: p.trap }])) }]));
  const html = fs.readFileSync(page, "utf8").replace(/\/\*TUNE\*\/[\s\S]*?\/\*END\*\//, "/*TUNE*/" + JSON.stringify({ dims: DIMS.map(([id, zh]) => [id, zh]), start: START, mods: table }) + "/*END*/");
  fs.writeFileSync(page, html);
  console.log(page, "table written");
  for (const [file, lang, day] of [["content/tasks/day-02.json", "zh", 2], ["content/tasks/en/day-02.json", "en", 2], ["content/tasks/day-03.json", "zh", 3], ["content/tasks/en/day-03.json", "en", 3]]) {
    const t = JSON.parse(fs.readFileSync(file, "utf8"));
    const task = t.tasks.find((x) => x.id === "task1");
    task.board.tune = board(lang, day);
    task.board.beats = beats(lang, day);
    fs.writeFileSync(file, JSON.stringify(t, null, 2) + "\n");
    console.log(file, "tune rewritten:", task.board.tune.mods.length, "modules");
  }
}
