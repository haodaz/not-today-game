// Writes the work-document pages of days 7–9 (zh + en) from the tasks' own cards plus the page's own words.
import fs from "node:fs";
const ROOT = "/Users/aisandbox/Documents/holloween/not-today-game";
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
  const items = b.slots.map((s, i) => ({ slot: s.id, label: s.label, answer: s.answer, ...(extra.items?.[i] ?? {}) }));
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
console.log("written");
