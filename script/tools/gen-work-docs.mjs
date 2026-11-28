// Writes the work-document pages (zh + en) from the tasks' own cards plus the page's own words:
// days 7–9 on the advisers' template, days 11–16 and 18 on the Group's forms. Run: node script/tools/gen-work-docs.mjs
import fs from "node:fs";
const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const board = (day, lang) => { const t = JSON.parse(fs.readFileSync(`${ROOT}/content/tasks/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`, "utf8")); return (t.tasks ?? t).find((k) => k.board).board; };
const page = (file, form, lang, doc) => {
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${doc.title}</title>
<link rel="stylesheet" href="/docs/player/kit/doc.css">
</head>
<body>
<div id="doc"></div>
<script>
const DOC = ${JSON.stringify(doc, null, 1)};
</script>
<script src="/docs/player/kit/doc.js"></script>
<script src="/docs/player/kit/${form}.js"></script>
</body>
</html>
`;
  fs.writeFileSync(`${ROOT}/public/docs/player/${lang === "en" ? "en/" : ""}${file}`, html);
};
const base = (day, lang, extra) => {
  const b = board(day, lang);
  const cards = Object.fromEntries([...b.cards, ...(b.kuro?.cards ?? [])].map((c) => [c.id, c.text]));
  const items = b.slots.map((s, i) => ({ slot: s.id, label: s.label, answer: s.answer, row: b.given.rows[s.id] ?? s.label, ...(extra.items?.[i] ?? {}) }));
  const { items: _i, ...rest } = extra;
  return { ...rest, cards, items };
};

// ---- day 7: 晨会纪要
page("day-07-minutes.html", "minutes", "zh", base(7, "zh", {
  title: "晨会纪要", sub: "每日晨会 · 按模板记录",
  head: { org: "顾问组", sub: "会议纪要 · 标准模板", code: ["模板 M-07", "第 72 版"] },
  meta: [["会议", "每日晨会"], ["日期", "2028-10-22"], ["开始", "09:00"], ["主持", "老周"], ["记录", "你"], ["形式", "线上 · 统一背景"]],
  roll: { title: "出席", note: "职级与编制由顾问组预填", cols: ["姓名", "职级", "编制", "摄像头"], offWord: "未开", rows: [["老王", "王", "200", "开"], ["老周", "亲王", "26", "开"], ["Vivi", "公爵", "31", "开"], ["小张", "伯爵", "36", "开"], ["你", "研发", "1", "开"], ["（名字一栏是空的）", "", "", "未开"], ["（名字一栏是空的）", "", "", "未开"]] },
  items: [
    { step: "1. 会前准备", guide: "填写说明：与会者使用统一背景。" },
    { step: "2. 签到", guide: "填写说明：逐一报出职级与编制。认识也要报。" },
    { step: "3. 议程", guide: "填写说明：本次要请的是哪一位。名字念错，从第 1 步重来。" },
    { step: "4. 汇报", guide: "填写说明：对方提的要求，怎么答复的。" },
    { step: "5. 散会", guide: "填写说明：主持人念完结束语才算散会。没念的，视为会议仍在进行。" },
  ],
  end: { label: "散会时间", by: "r5", values: { c5: "09:21", k1: "待定", d1: "未记录", d2: "未记录", "": "　" } },
  sign: [["记录人", "你"], ["审核", "顾问组"]],
  words: { steps: "会议记录", said: "会上说的", empty: "（待记录）", foot: "顾问组模板 · 填写后由顾问组归档", page: "第 1 页 / 共 1 页" },
}));
page("day-07-minutes.html", "minutes", "en", base(7, "en", {
  title: "Morning meeting minutes", sub: "Daily morning meeting · recorded on the template",
  head: { org: "THE ADVISERS", sub: "Meeting minutes · standard template", code: ["Template M-07", "72nd edition"] },
  meta: [["Meeting", "Daily morning meeting"], ["Date", "2028-10-22"], ["Start", "09:00"], ["Chair", "Lao Zhou"], ["Minutes", "You"], ["Format", "Online · one shared background"]],
  roll: { title: "PRESENT", note: "rank and headcount filled in by the advisers", cols: ["Name", "Rank", "Headcount", "Camera"], offWord: "off", rows: [["Lao Wang", "King", "200", "on"], ["Lao Zhou", "Prince", "26", "on"], ["Vivi", "Duke", "31", "on"], ["Xiao Zhang", "Earl", "36", "on"], ["You", "R&D", "1", "on"], ["(the name field is empty)", "", "", "off"], ["(the name field is empty)", "", "", "off"]] },
  items: [
    { step: "1. Before the meeting", guide: "How to fill in: everyone uses the same background." },
    { step: "2. Roll call", guide: "How to fill in: each states rank and headcount. Also those who know each other." },
    { step: "3. Agenda", guide: "How to fill in: who is being invited today. A name said wrong: start again from step 1." },
    { step: "4. Reports", guide: "How to fill in: what the other side asked for, and what was answered." },
    { step: "5. Closing", guide: "How to fill in: the meeting ends when the chair has read the closing words. If they were not read, the meeting is still going on." },
  ],
  end: { label: "Closed at", by: "r5", values: { c5: "09:21", k1: "to be decided", d1: "not recorded", d2: "not recorded", "": "　" } },
  sign: [["Minutes by", "You"], ["Reviewed by", "The advisers"]],
  words: { steps: "RECORD", said: "SAID IN THE MEETING", empty: "(to be recorded)", foot: "The advisers' template · filed by the advisers once filled in", page: "Page 1 of 1" },
}));

// ---- day 8: 团建排期表
const bars = (w) => ({ c1: { from: 15, to: 17.2, tag: w.c1 }, c2: { kind: "off", tag: w.c2 }, c3: { kind: "any", from: 6, to: 24, tag: w.c3 }, c4: { kind: "open", from: 19, to: 24, tag: w.c4 }, d1: { from: 19, to: 20.4, tag: w.d1 }, d2: { kind: "none", tag: w.d2 }, k1: { kind: "any", from: 6, to: 24, tag: w.c3 } });
page("day-08-schedule.html", "schedule", "zh", base(8, "zh", {
  title: "团建排期表", sub: "周五线上团建 · 祝酒时间",
  head: { org: "顾问组", sub: "活动排期 · 标准模板", code: ["模板 M-08", "第 72 版"] },
  meta: [["活动", "周五线上团建"], ["环节", "祝酒"], ["排期人", "你"], ["依据", "共享盘《职级与时段》"], ["形式", "线上"], ["改期", "排定后不改"]],
  axis: { from: 6, to: 24, ticks: [6, 9, 12, 15, 18, 21, 24] },
  cols: ["领导", "时段", "排的是"],
  bars: bars({ c1: "15:00 到日落", c2: "改天", c3: "任何时辰", c4: "到了再开", d1: "19:00", d2: "不排" }),
  items: [{ rank: "王" }, { rank: "公爵" }, { rank: "亲王" }, { rank: "　" }],
  rules: ["时段按职级排，不按个人方便。", "职级对应的时段，见共享盘《职级与时段》。", "客人不排钟点。"],
  sign: [["排期人", "你"], ["审核", "顾问组"]],
  words: { grid: "祝酒时段", gridNote: "06:00 – 24:00", empty: "（还没排）", foot: "顾问组模板 · 排定后发全体", page: "第 1 页 / 共 1 页" },
}));
page("day-08-schedule.html", "schedule", "en", base(8, "en", {
  title: "Team-building schedule", sub: "Friday online team night · toasts",
  head: { org: "THE ADVISERS", sub: "Event schedule · standard template", code: ["Template M-08", "72nd edition"] },
  meta: [["Event", "Friday online team night"], ["Part", "Toasts"], ["Scheduled by", "You"], ["Based on", "Shared drive: Ranks and hours"], ["Format", "Online"], ["Changes", "None once set"]],
  axis: { from: 6, to: 24, ticks: [6, 9, 12, 15, 18, 21, 24] },
  cols: ["Leader", "Hours", "Scheduled as"],
  bars: bars({ c1: "15:00 to sunset", c2: "another day", c3: "any hour", c4: "open on arrival", d1: "19:00", d2: "none" }),
  items: [{ rank: "King" }, { rank: "Duke" }, { rank: "Prince" }, { rank: "　" }],
  rules: ["Hours go by rank, not by what suits the person.", "The hours of each rank are in the shared drive: Ranks and hours.", "The guest gets no hour."],
  sign: [["Scheduled by", "You"], ["Reviewed by", "The advisers"]],
  words: { grid: "TOAST HOURS", gridNote: "06:00 – 24:00", empty: "(not scheduled yet)", foot: "The advisers' template · sent to everyone once set", page: "Page 1 of 1" },
}));

// ---- day 9: 座位表
const seats = ["chair", "s1", "s2", "s3", "tri"];
page("day-09-seating.html", "seating", "zh", base(9, "zh", {
  title: "座位表", sub: "线上会议室 · 明天的会",
  head: { org: "顾问组", sub: "会议排座 · 标准模板", code: ["模板 M-09", "第 72 版"] },
  meta: [["会议", "明天的会"], ["会议室", "线上"], ["排座", "你"], ["圈内", "4 席"], ["三角", "1 席"], ["来宾", "1 位"]],
  names: { c1: "老周", c2: "老王", c3: "Vivi", c4: "你", c5: "贵客", d1: "Vivi", d2: "空着", k1: "你" },
  cols: ["座位", "谁", "模板要求"],
  items: [{ seat: seats[0], note: "主持，念开场和结束语" }, { seat: seats[1], note: "圈内" }, { seat: seats[2], note: "圈内" }, { seat: seats[3], note: "圈内" }, { seat: seats[4], note: "圈外，单独一席" }],
  rules: ["圈内四席。会议结束前，圈内的人不离席。", "三角一席，在圈外，留给来宾。", "来宾的名字不写进表里。"],
  sign: [["排座", "你"], ["审核", "顾问组"]],
  words: { plan: "平面图", planNote: "圈 + 三角", circle: "圈", gap: "隔开", vacant: "空", list: "名单", empty: "（还没排）", foot: "顾问组模板 · 会前一天排定", page: "第 1 页 / 共 1 页" },
}));
page("day-09-seating.html", "seating", "en", base(9, "en", {
  title: "Seating plan", sub: "Online meeting room · tomorrow's meeting",
  head: { org: "THE ADVISERS", sub: "Meeting seating · standard template", code: ["Template M-09", "72nd edition"] },
  meta: [["Meeting", "Tomorrow's meeting"], ["Room", "Online"], ["Seated by", "You"], ["In the circle", "4 seats"], ["Triangle", "1 seat"], ["Guests", "1"]],
  names: { c1: "Lao Zhou", c2: "Lao Wang", c3: "Vivi", c4: "You", c5: "The guest", d1: "Vivi", d2: "Empty", k1: "You" },
  cols: ["Seat", "Who", "The template asks"],
  items: [{ seat: seats[0], note: "Chairs; reads the opening and the closing words" }, { seat: seats[1], note: "In the circle" }, { seat: seats[2], note: "In the circle" }, { seat: seats[3], note: "In the circle" }, { seat: seats[4], note: "Outside the circle, a seat of its own" }],
  rules: ["Four seats in the circle. Nobody in the circle leaves before the meeting ends.", "One seat in the triangle, outside the circle, kept for the guest.", "The guest's name is not written on the plan."],
  sign: [["Seated by", "You"], ["Reviewed by", "The advisers"]],
  words: { plan: "FLOOR PLAN", planNote: "circle + triangle", circle: "CIRCLE", gap: "apart", vacant: "empty", list: "LIST", empty: "(not seated yet)", foot: "The advisers' template · set the day before", page: "Page 1 of 1" },
}));

// ================= the Group's forms (days 11–16, 18): 和光集团 / Evenlight Group =================
const grp = (lang, n, kind, rot) => ({
  skin: "grp", rot,
  head: lang === "zh" ? { mark: "sun", org: "和光集团", sub: `${kind} · 集团表单`, code: [`表单 HG-${n}`, "和其光，同其尘"] } : { mark: "sun", org: "EVENLIGHT GROUP", sub: `${kind} · Group form`, code: [`Form EL-${n}`, "Soften the light. Be one with the dust."] },
});
const tail = (lang, dept, words) => ({
  sign: lang === "zh" ? [["经办", "你"], ["审核", dept]] : [["Handled by", "You"], ["Reviewed by", dept]],
  words: { ...words, ...(lang === "zh" ? { foot: "和光集团 · 和其光，同其尘", page: "第 1 页 / 共 1 页" } : { foot: "Evenlight Group · Soften the light. Be one with the dust.", page: "Page 1 of 1" }) },
});
const both = (file, form, day, zh, en) => { page(file, form, "zh", base(day, "zh", zh)); page(file, form, "en", base(day, "en", en)); };

// ---- day 11: 成本表
both("day-11-ledger.html", "ledger", 11, {
  ...grp("zh", 11, "成本表", 0.1), title: "成本表", sub: "称平 · 降本增效",
  meta: [["表名", "成本表"], ["口径", "称重"], ["填表", "你"], ["审核", "和光·财务部"], ["限期", "下班前"], ["备注", "油、酒两列不动"]],
  cols: ["成本项", "单价", "备注"],
  items: [{ note: "按升计" }, { note: "按升计" }, { note: "不许动" }, { note: "不许动" }, { note: "一分不能差" }],
  rules: ["预算就这么多，要求的格子一个都不能空。", "油和酒两列不许碰。", "称平了才能交。"],
  ...tail("zh", "和光·财务部", { sheet: "成本明细", sheetNote: "单位：钱", pans: ["要求的", "预算"], level: "平了", off: "不平", empty: "（待填）" }),
}, {
  ...grp("en", 11, "Cost sheet", 0.1), title: "Cost sheet", sub: "Balanced · costs down, output up",
  meta: [["Sheet", "Cost sheet"], ["Basis", "By weight"], ["Filled in by", "You"], ["Reviewed by", "Evenlight Finance"], ["Due", "End of day"], ["Note", "Oil and wine untouched"]],
  cols: ["Item", "Unit price", "Note"],
  items: [{ note: "by the measure" }, { note: "by the measure" }, { note: "not to be touched" }, { note: "not to be touched" }, { note: "not a cent out" }],
  rules: ["The budget is what it is, and no cell that was asked for may stay empty.", "The oil column and the wine column are not to be touched.", "It is handed in only when it weighs level."],
  ...tail("en", "Evenlight Finance", { sheet: "COSTS", sheetNote: "unit: a penny", pans: ["asked", "budget"], level: "level", off: "not level", empty: "(to fill in)" }),
});

// ---- day 12: 值班表
both("day-12-rota.html", "rota", 12, {
  ...grp("zh", 12, "值班表", 0.2), title: "值班表", sub: "这一周 · 全员",
  meta: [["表名", "本周值班表"], ["周期", "这一周"], ["排班", "你"], ["审核", "和光·总裁办"], ["名单来源", "通讯录"], ["睡眠", "不安排"]],
  days: ["一", "二", "三", "四", "五", "六", "日"],
  short: { c1: "全员", c2: "全员", c3: "全员", c4: "删", d1: "轮班", d2: "ΥΠΝΟΣ", k1: "你休" },
  items: [{}, {}, {}, { name: true }],
  rules: ["这周大家克服一下，谁都不睡。", "名单以通讯录为准。"],
  ...tail("zh", "和光·总裁办", { grid: "排班", gridNote: "每晚相同", slot: "时段", sleep: "睡眠", empty: "（还没排）" }),
}, {
  ...grp("en", 12, "Watch rota", 0.2), title: "Watch rota", sub: "This week · everyone",
  meta: [["Rota", "This week's watch"], ["Period", "This week"], ["Drawn up by", "You"], ["Reviewed by", "Exec Office"], ["Names from", "The directory"], ["Sleep", "Not scheduled"]],
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  short: { c1: "All", c2: "All", c3: "All", c4: "Del", d1: "Shift", d2: "ΥΠΝΟΣ", k1: "You off" },
  items: [{}, {}, {}, { name: true }],
  rules: ["Everyone bears with it this week. Nobody sleeps.", "Names go by the directory."],
  ...tail("en", "Exec Office", { grid: "ROTA", gridNote: "the same every night", slot: "Hours", sleep: "Sleep", empty: "(not set yet)" }),
});

// ---- day 13: 借阅审批单
both("day-13-approval.html", "approval", 13, {
  ...grp("zh", 13, "借阅审批单", 0.35), title: "借阅审批单", sub: "集团借阅 · 《死灵之书》拉丁文本",
  meta: [["单据", "借阅审批单"], ["借阅方", "和光集团"], ["经办", "Vivi"], ["填单", "你"], ["借期", "长期"], ["归还", "未注明"]],
  chain: [["申请人", "你"], ["部门", "Vivi"], ["行政部", "和光·行政部"], ["审批人", ""]],
  rules: ["要填的东西全在那份扫描件里。", "别问为什么借。"],
  ...tail("zh", "和光·行政部", { form: "借阅内容", formNote: "照扫描件填", chain: "审批链", waiting: "待审", passed: "已通过", nobody: "审批人：无", empty: "（待填）" }),
}, {
  ...grp("en", 13, "Loan request", 0.35), title: "Loan request", sub: "Borrowed by the Group · the Latin Necronomicon",
  meta: [["Form", "Loan request"], ["Borrower", "Evenlight Group"], ["Handled by", "Vivi"], ["Filled in by", "You"], ["Period", "Long-term"], ["Return", "Not stated"]],
  chain: [["Applicant", "You"], ["Department", "Vivi"], ["Admin", "Evenlight Admin"], ["Approver", ""]],
  rules: ["Everything to fill in is in the scan.", "Do not ask why it is borrowed."],
  ...tail("en", "Evenlight Admin", { form: "WHAT IS BORROWED", formNote: "as in the scan", chain: "APPROVALS", waiting: "pending", passed: "APPROVED", nobody: "Approver: none", empty: "(to fill in)" }),
});

// ---- day 14: 新员工入职流程
both("day-14-onboard.html", "onboard", 14, {
  ...grp("zh", 14, "入职流程", 0.45), title: "新员工入职流程", sub: "第一批 · 1000 人",
  meta: [["流程", "入职"], ["批次", "第一批"], ["人数", "1000"], ["经办", "你"], ["审核", "和光·人力部"], ["名单", "花名册"]],
  rules: ["名单在花名册里，欢迎录音也要听。", "这批新人有点多。"],
  ...tail("zh", "和光·人力部", { flow: "入职流程", flowNote: "名单里的四类", count: "第一批", total: "1000 人", empty: "（待定）" }),
}, {
  ...grp("en", 14, "Onboarding", 0.45), title: "Onboarding", sub: "First batch · 1,000 people",
  meta: [["Process", "Onboarding"], ["Batch", "First"], ["Headcount", "1,000"], ["Handled by", "You"], ["Reviewed by", "Evenlight HR"], ["List", "The staff roll"]],
  rules: ["The names are in the staff roll. Listen to the welcome recording too.", "This batch is rather large."],
  ...tail("en", "Evenlight HR", { flow: "PROCESS", flowNote: "the four kinds on the roll", count: "First batch", total: "1,000 people", empty: "(to decide)" }),
});

// ---- day 15: 发布会演示稿
both("day-15-slides.html", "slides", 15, {
  ...grp("zh", 15, "演示稿", 0.6), title: "发布会演示稿", sub: "下午发布会 · 集团全员到",
  meta: [["会议", "发布会"], ["时间", "今天下午"], ["排稿", "你"], ["主讲", "Vivi"], ["观众", "集团全员"], ["素材", "会议记录"]],
  items: [{ slide: true }, { slide: true }, { slide: true }, {}, {}],
  rules: ["素材在会议记录里，观众的截图在文件里。", "观众的反应实时盯着，照实写。"],
  ...tail("zh", "和光·总裁办", { deck: "演示稿", deckNote: "三页", room: "现场", empty: "（待排）" }),
}, {
  ...grp("en", 15, "Launch slides", 0.6), title: "Launch slides", sub: "This afternoon's launch · the whole Group attends",
  meta: [["Event", "Launch"], ["Time", "This afternoon"], ["Slides by", "You"], ["Speaker", "Vivi"], ["Audience", "The whole Group"], ["Material", "The meeting record"]],
  items: [{ slide: true }, { slide: true }, { slide: true }, {}, {}],
  rules: ["The material is in the meeting record; the audience screenshots are in the files.", "Watch the audience live. Write down what it does, as it is."],
  ...tail("en", "Exec Office", { deck: "SLIDES", deckNote: "three", room: "THE ROOM", empty: "(to place)" }),
});

// ---- day 16: 董事长汇报
both("day-16-reel.html", "reel", 16, {
  ...grp("zh", 16, "汇报剪辑单", 0.75), title: "董事长汇报", sub: "汇报录音 · 剪辑单",
  meta: [["汇报对象", "董事长"], ["形式", "录音"], ["剪辑", "你"], ["要求", "不要停"], ["素材", "语音和笛声"], ["时长", "不限"]],
  items: [{ part: "open" }, { part: "mid" }, { part: "beat" }, { part: "end" }],
  rules: ["董事长不看材料，听个响就行。", "语音在老板和群的聊天里，笛声在文件里。"],
  ...tail("zh", "和光·总裁办", { reel: "时间线", reelNote: "从左到右", empty: "（待剪）" }),
}, {
  ...grp("en", 16, "Briefing edit sheet", 0.75), title: "Report to the chairman", sub: "The briefing as a recording · edit sheet",
  meta: [["For", "The chairman"], ["Form", "Recording"], ["Edited by", "You"], ["Asked", "Do not stop"], ["Material", "Voice notes and the flute"], ["Length", "No limit"]],
  items: [{ part: "open" }, { part: "mid" }, { part: "beat" }, { part: "end" }],
  rules: ["The chairman does not read material. A sound will do.", "The voice notes are in the boss's chat and the group's; the flute is in the files."],
  ...tail("en", "Exec Office", { reel: "TIMELINE", reelNote: "left to right", empty: "(to cut)" }),
});

// ---- day 18: 待办清单
both("day-18-todo.html", "todo", 18, {
  ...grp("zh", 18, "待办清单", 1), title: "待办清单", sub: "2028-11-02 · 把手上的活清掉",
  meta: [["清单", "待办"], ["日期", "2028-11-02"], ["经办", "你"], ["要求", "今天清完"], ["张数", "5"], ["明天", "不留"]],
  rules: ["今天把手上的都清了。", "一张都别留到明天。"],
  ...tail("zh", "老王", { list: "五张单子", listNote: "一张一张结", empty: "未结" }),
}, {
  ...grp("en", 18, "To-do list", 1), title: "To-do list", sub: "2028-11-02 · clear what is on your hands",
  meta: [["List", "To do"], ["Date", "2028-11-02"], ["Handled by", "You"], ["Asked", "All cleared today"], ["Slips", "5"], ["Tomorrow", "Nothing left"]],
  rules: ["Clear everything on your hands today.", "Leave not one for tomorrow."],
  ...tail("en", "Lao Wang", { list: "FIVE SLIPS", listNote: "closed one by one", empty: "open" }),
});
console.log("written");
