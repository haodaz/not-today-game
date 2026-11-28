// Outside groups in 汀汀 (author 2026-11-27, ledger #171): the lines of the three client project groups
// (government, university, big enterprise) and the parent company's investment group, days 1–9, zh + en.
// Run: node script/tools/inject-outside-groups.mjs   (rewrites the four groups in content/replies/day-01..09 and en/)
// Each line: [time, speaker (zh), zh text, en text, card?]. Speakers are mapped to English by NAMES.
import fs from "node:fs";
const ROOT = "/Users/aisandbox/Documents/holloween/not-today-game/content/replies";
const NAMES = { 孙姐: "Ms Sun", 小吴: "Xiao Wu", 刘处: "Director Liu", 老周: "Lao Zhou", 赵老师: "Ms Zhao", 小林: "Xiao Lin", 陈教授: "Prof. Chen", Lisa: "Lisa", Kevin: "Kevin", Tony: "Tony", "和光·投资部": "Investment", "和光·法务部": "Legal", "和光·顾问组": "The Advisers", 老板: "Boss", Vivi: "Vivi", member: "member" };
const MORNING = ["早上好。很高兴今天也能和各位一起工作。", "Good morning. So glad to be working with all of you again today."];
// day 6: the same words in all three groups, said by that group's own three people (a = office, b = junior, c = the senior one)
const same6 = (a, b, c) => [
  ["09:00", a, ...MORNING], ["09:00", b, ...MORNING], ["09:00", c, ...MORNING], ["09:00", "member", ...MORNING],
  ["10:00", c, "今天没有需要做的工作。请大家保持愉快。", "There is no work that needs doing today. Please stay happy, everyone."],
  ["10:00", b, "好的。我很愉快。", "Yes. I am happy."], ["10:00", a, "好的。我很愉快。", "Yes. I am happy."],
  ["15:00", c, "@未来智能 贵司的款项已付。贵司不用再担心钱的事了。", "@Future Intelligence Your payment has been made. You need not worry about money any more."],
  ["15:00", "member", "不用再担心了。", "No need to worry any more."],
  ["17:30", a, "下班了。明天见。", "Work is over. See you tomorrow."], ["17:30", b, "明天见。", "See you tomorrow."], ["17:30", c, "明天见。", "See you tomorrow."],
];
const after = (a, b, c) => [["09:00", a, ...MORNING], ["09:00", b, ...MORNING], ["09:00", c, ...MORNING]];
const hello5 = (a, b, c) => [["09:00", a, "早上好。", "Good morning."], ["09:00", b, "早上好。", "Good morning."], ["09:00", c, "早上好。", "Good morning."]];
const THANKS = ["感谢贵司的耐心。", "Thank you for your patience."];
const IMG = (zh, en) => ({ zh: { type: "image", alt: zh }, en: { type: "image", alt: en } });
const NIGHT = ["和其光，同其尘。晚安。", "Soften the light. Be one with the dust. Good night."];

const G = {
  g_gov: {
    1: [
      ["09:02", "孙姐", "@所有人 本周食堂菜单发了，周三有小龙虾", "@all This week's canteen menu is out. Crayfish on Wednesday"],
      ["09:03", "小吴", "收到[玫瑰]", "Received [rose]"],
      ["10:30", "小吴", "刘处，通知里的「下午」我改成「14:30」了", "Director Liu, I changed \"afternoon\" in the notice to \"14:30\""],
      ["10:52", "刘处", "可以。今天就先这一件", "Fine. That will do for today"],
      ["10:53", "小吴", "好的刘处", "Yes, Director"],
      ["15:40", "老周", "刘处，一期尾款我们这边还没看到。哪天请您吃饭", "Director Liu, the final payment for phase one hasn't reached us yet. Let me buy you dinner one of these days"],
      ["15:58", "刘处", "付了的，流程都走完了", "It's paid. The whole process is finished"],
      ["15:59", "孙姐", "付了的[玫瑰]", "It's paid [rose]"],
      ["16:30", "孙姐", "工会发米和油，下班前到 302 领", "The union is handing out rice and oil. Room 302, before you leave"],
    ],
    2: [
      ["09:05", "小吴", "昨天那份通知，「14:30」后面我加了个「整」", "Yesterday's notice: I added \"sharp\" after \"14:30\""],
      ["09:40", "刘处", "好。细", "Good. Thorough"],
      ["11:20", "孙姐", "@所有人 体检报名接龙 1. 孙姐", "@all Health check sign-up. 1. Sun"],
      ["11:21", "小吴", "2. 小吴", "2. Wu"],
      ["11:21", "刘处", "3. 刘", "3. Liu"],
      ["15:10", "老周", "刘处，尾款还是没到", "Director Liu, the payment still hasn't arrived"],
      ["15:45", "刘处", "我这边显示已付款。再等等，钱在路上", "On my side it says paid. Wait a little, the money is on its way"],
      ["16:50", "小吴", "今天的活干完了，我先去接孩子", "Today's work is done. I'm off to pick up my kid"],
    ],
    3: [
      ["09:10", "孙姐", "今天小龙虾，11:30 开餐，去晚了没有", "Crayfish today, from 11:30. Come late and there's none left"],
      ["09:11", "小吴", "收到！", "Received!"],
      ["10:00", "刘处", "小吴，把通知发一下", "Xiao Wu, send the notice out"],
      ["10:01", "小吴", "已发", "Sent"],
      ["10:02", "刘处", "辛苦。这周的工作就到这", "Well done. That's the week's work"],
      ["13:30", "小吴", "[图片]", "[Photo]", IMG("一盘剥好的小龙虾", "A plate of peeled crayfish")],
      ["13:31", "孙姐", "剥得真干净", "Peeled so clean"],
      ["16:20", "老周", "刘处，尾款", "Director Liu, the payment"],
      ["16:21", "刘处", "付了", "Paid"],
    ],
    4: [
      ["09:02", "孙姐", "@所有人 本周食堂菜单发了，周三有小龙虾", "@all This week's canteen menu is out. Crayfish on Wednesday"],
      ["09:03", "小吴", "收到[玫瑰]", "Received [rose]"],
      ["09:03", "刘处", "收到[玫瑰]", "Received [rose]"],
      ["10:30", "小吴", "刘处，通知里的「下午」我改成「14:30」了", "Director Liu, I changed \"afternoon\" in the notice to \"14:30\""],
      ["10:52", "刘处", "可以。今天就先这一件", "Fine. That will do for today"],
      ["10:53", "小吴", "好的刘处", "Yes, Director"],
      ["15:58", "刘处", "付了的，流程都走完了", "It's paid. The whole process is finished"],
      ["15:59", "孙姐", "付了的[玫瑰]", "It's paid [rose]"],
      ["15:59", "小吴", "付了的[玫瑰]", "It's paid [rose]"],
    ],
    5: [
      ...hello5("孙姐", "小吴", "刘处"),
      ["10:00", "小吴", "通知已经改好了。没有需要再改的地方。", "The notice has been corrected. Nothing needs correcting any more."],
      ["10:00", "刘处", "很好。大家辛苦了。", "Very good. Thank you all for your hard work."],
      ["12:00", "孙姐", "午饭很好吃。", "Lunch was very good."],
      ["12:00", "小吴", "午饭很好吃。", "Lunch was very good."],
      ["15:00", "刘处", "@未来智能 款项已付。感谢贵司的耐心。", "@Future Intelligence The payment has been made. Thank you for your patience."],
      ["15:00", "孙姐", ...THANKS], ["15:00", "小吴", ...THANKS],
    ],
    6: same6("孙姐", "小吴", "刘处"), 7: after("孙姐", "小吴", "刘处"), 8: after("孙姐", "小吴", "刘处"), 9: after("孙姐", "小吴", "刘处"),
  },
  g_uni: {
    1: [
      ["09:20", "赵老师", "@所有人 本月报销周五截止，发票贴在 A4 纸左上角", "@all Expense claims close on Friday. Glue the receipts to the top left of an A4 sheet"],
      ["09:21", "小林", "收到，谢谢赵老师", "Received. Thank you, Ms Zhao"],
      ["10:15", "陈教授", "小林，参考文献第 3 条，逗号改成英文逗号", "Xiao Lin, reference 3: change the comma to an English comma"],
      ["10:16", "小林", "好的陈老师，今天改完", "Yes, Professor. I'll finish it today"],
      ["14:00", "陈教授", "组会改明天。今天天气好，大家出去走走", "Group meeting moved to tomorrow. The weather is good, go out for a walk"],
      ["14:01", "小林", "谢谢陈老师！", "Thank you, Professor!"],
      ["16:10", "老周", "陈教授，合作经费我们这边还没收到", "Professor Chen, the project funds haven't reached us yet"],
      ["16:35", "陈教授", "拨了拨了，学校的流程你们懂的", "Released, released. You know how the university's process is"],
    ],
    2: [
      ["09:30", "小林", "陈老师，第 3 条的逗号改好了", "Professor, the comma in reference 3 is changed"],
      ["09:50", "陈教授", "很好。第 4 条明天再看，不急", "Very good. Reference 4 can wait till tomorrow, no hurry"],
      ["10:00", "赵老师", "教工食堂二楼开了新窗口，凭工作证免费喝汤", "A new counter on the second floor of the staff canteen: free soup with your staff card"],
      ["14:00", "陈教授", "组会。今天的议题：橘子谁带", "Group meeting. Today's topic: who brings the tangerines"],
      ["14:01", "小林", "我带了", "I brought them"],
      ["14:40", "赵老师", "@未来智能 你们那笔经费，财务处显示已付款，回执拍给你们", "@Future Intelligence Your funds: the finance office shows them as paid. Here is a photo of the slip"],
      ["14:40", "赵老师", "[图片]", "[Photo]", IMG("付款回执：已付款", "Payment slip: PAID")],
    ],
    3: [
      ["09:15", "赵老师", "下午工会羽毛球，还缺一个人", "Union badminton this afternoon, one player short"],
      ["09:16", "陈教授", "我来", "I'll come"],
      ["10:30", "小林", "陈老师，第 4 条我看了，没有问题", "Professor, I looked at reference 4. Nothing wrong with it"],
      ["10:31", "陈教授", "那这周就到这，辛苦", "Then that's it for this week. Well done"],
      ["15:50", "老周", "赵老师，回执看到了，钱还是没到", "Ms Zhao, we saw the slip. The money still hasn't come"],
      ["16:20", "赵老师", "系统里是已付款呀[微笑]", "But the system says paid [smile]"],
      ["16:21", "陈教授", "年轻人不要老想着钱，先把事情做好", "Young people shouldn't think about money all the time. Do the work well first"],
    ],
    4: [
      ["09:20", "赵老师", "@所有人 本月报销周五截止，发票贴在 A4 纸左上角", "@all Expense claims close on Friday. Glue the receipts to the top left of an A4 sheet"],
      ["09:21", "小林", "收到，谢谢赵老师", "Received. Thank you, Ms Zhao"],
      ["09:21", "陈教授", "收到，谢谢赵老师", "Received. Thank you, Ms Zhao"],
      ["10:15", "陈教授", "小林，参考文献第 3 条，逗号改成英文逗号", "Xiao Lin, reference 3: change the comma to an English comma"],
      ["10:16", "小林", "好的陈老师，今天改完", "Yes, Professor. I'll finish it today"],
      ["14:00", "陈教授", "组会。今天的议题：橘子谁带", "Group meeting. Today's topic: who brings the tangerines"],
      ["14:00", "小林", "我带了", "I brought them"],
      ["14:00", "赵老师", "我带了", "I brought them"],
      ["14:00", "陈教授", "我带了", "I brought them"],
    ],
    5: [
      ...hello5("赵老师", "小林", "陈教授"),
      ["10:00", "小林", "第 3 条的逗号没有问题。所有的逗号都没有问题。", "The comma in reference 3 is correct. All the commas are correct."],
      ["10:00", "陈教授", "很好。不用再改了。", "Very good. No more changes are needed."],
      ["14:00", "陈教授", "组会。今天没有议题。大家坐在一起就好。", "Group meeting. No topic today. It is enough that we sit together."],
      ["14:00", "小林", "好的。坐在一起很好。", "Yes. Sitting together is good."],
      ["14:00", "赵老师", "坐在一起很好。", "Sitting together is good."],
      ["15:00", "赵老师", "@未来智能 经费已付。感谢贵司的耐心。", "@Future Intelligence The funds have been paid. Thank you for your patience."],
      ["15:00", "小林", ...THANKS], ["15:00", "陈教授", ...THANKS],
    ],
    6: same6("赵老师", "小林", "陈教授"), 7: after("赵老师", "小林", "陈教授"), 8: after("赵老师", "小林", "陈教授"), 9: after("赵老师", "小林", "陈教授"),
  },
  g_corp: {
    1: [
      ["09:30", "Lisa", "@所有人 下午茶接龙 1. Lisa 生椰拿铁", "@all Afternoon tea orders. 1. Lisa, coconut latte"],
      ["09:31", "Kevin", "2. Kevin 冰美式", "2. Kevin, iced americano"],
      ["09:31", "Tony", "3. Tony 同上", "3. Tony, same"],
      ["10:40", "Kevin", "周报第二页的标题，字号我从 28 调到 30 了，请 Tony 总 review", "Weekly report, page two, the title: I took the font from 28 to 30. Tony, please review"],
      ["11:15", "Tony", "可以，颗粒度很细。今天先对齐到这", "Fine. Very granular. Let's leave the alignment there for today"],
      ["15:00", "Lisa", "下午茶到了，前台自取", "Afternoon tea is here. Pick it up at the front desk"],
      ["16:00", "老周", "Kevin，年度服务费的发票开过去一个月了", "Kevin, the invoice for the annual service fee went out a month ago"],
      ["16:20", "Kevin", "收到。付款已经提交了，在走审批，这周一定闭环", "Noted. The payment is submitted and in approval. We'll close the loop this week for sure"],
    ],
    2: [
      ["09:35", "Kevin", "昨天的字号，Tony 总说 30 太大，我调回 28 了", "Yesterday's font: Tony said 30 was too big. I put it back to 28"],
      ["09:50", "Tony", "嗯，舒服了", "Mm. That feels right"],
      ["10:00", "Lisa", "本月健身补贴已发，大家查收", "This month's gym allowance has been paid. Please check"],
      ["14:00", "Kevin", "拉个会，对齐一下今天的下午茶", "Let's have a call to align on today's afternoon tea"],
      ["14:30", "Kevin", "对齐完了，今天喝果茶", "Aligned. Fruit tea today"],
      ["16:10", "老周", "Kevin，审批走到哪了", "Kevin, where is the approval now"],
      ["16:40", "Kevin", "已经付了呀，系统显示 paid。你们再刷新一下", "But it's been paid. The system says paid. Try refreshing"],
    ],
    3: [
      ["09:40", "Lisa", "@所有人 周五 Family Day，每人可以带两位家属，有烤全羊", "@all Family Day on Friday. Two family members each. There's a whole roast lamb"],
      ["09:41", "Kevin", "报名，3 位", "Signing up, three of us"],
      ["10:30", "Tony", "这周的 OKR 大家填一下，一行就行", "Everyone fill in this week's OKR. One line will do"],
      ["10:31", "Kevin", "填了：「保持对齐」", "Done: \"stay aligned\""],
      ["10:32", "Tony", "好，闭环", "Good. Loop closed"],
      ["16:00", "老周", "Kevin，还是没到账", "Kevin, it still hasn't arrived"],
      ["16:01", "Kevin", "paid", "paid"],
      ["16:02", "Lisa", "paid 的[玫瑰]", "It's paid [rose]"],
    ],
    4: [
      ["09:30", "Lisa", "@所有人 下午茶接龙 1. Lisa 生椰拿铁", "@all Afternoon tea orders. 1. Lisa, coconut latte"],
      ["09:31", "Kevin", "2. Kevin 生椰拿铁", "2. Kevin, coconut latte"],
      ["09:31", "Tony", "3. Tony 生椰拿铁", "3. Tony, coconut latte"],
      ["10:40", "Kevin", "周报第二页的标题，字号我从 28 调到 30 了，请 Tony 总 review", "Weekly report, page two, the title: I took the font from 28 to 30. Tony, please review"],
      ["11:15", "Tony", "可以，颗粒度很细。今天先对齐到这", "Fine. Very granular. Let's leave the alignment there for today"],
      ["15:00", "Lisa", "下午茶到了。每人一杯，都一样", "Afternoon tea is here. One cup each, all the same"],
      ["16:20", "Kevin", "@未来智能 付款已闭环", "@Future Intelligence The payment loop is closed"],
      ["16:20", "Lisa", "已闭环[玫瑰]", "Loop closed [rose]"],
      ["16:20", "Tony", "已闭环[玫瑰]", "Loop closed [rose]"],
    ],
    5: [
      ...hello5("Lisa", "Kevin", "Tony"),
      ["10:00", "Kevin", "字号没有问题。所有的字号都没有问题。", "The font size is correct. All the font sizes are correct."],
      ["10:00", "Tony", "很好。已对齐。", "Very good. Aligned."],
      ["15:00", "Lisa", "下午茶很好喝。", "The afternoon tea was very good."],
      ["15:00", "Kevin", "下午茶很好喝。", "The afternoon tea was very good."],
      ["15:00", "Tony", "@未来智能 款项已付。感谢贵司的耐心。", "@Future Intelligence The payment has been made. Thank you for your patience."],
      ["15:00", "Lisa", ...THANKS], ["15:00", "Kevin", ...THANKS],
    ],
    6: same6("Lisa", "Kevin", "Tony"), 7: after("Lisa", "Kevin", "Tony"), 8: after("Lisa", "Kevin", "Tony"), 9: after("Lisa", "Kevin", "Tony"),
  },
  g_invest: {
    4: [
      ["09:20", "老板", "各位领导好，我们三个都在群里了", "Hello everyone. All three of us are in the group now"],
      ["09:21", "和光·投资部", "欢迎三位。我们看项目很慢，看人很快。", "Welcome, all three. We are slow at reading projects and quick at reading people."],
      ["09:22", "和光·投资部", "材料不急，一天一页就好。我们有的是时间。", "No hurry with the material. A page a day will do. We have all the time there is."],
      ["09:25", "和光·法务部", "@所有人 保密协议已发，请三位今天内签回", "@all The confidentiality agreement has been sent. Please sign and return it today, all three"],
      ["09:26", "Vivi", "收到[玫瑰]", "Received [rose]"],
      ["17:30", "和光·投资部", "今天辛苦三位。和其光，同其尘。晚安。", "Thank you for today, all three. Soften the light. Be one with the dust. Good night."],
    ],
    5: [
      ["09:00", "和光·投资部", "早上好。昨天那一页我们读了三遍。", "Good morning. We read yesterday's page three times."],
      ["09:01", "和光·投资部", "三位的履历我们也读了。每一位我们都很喜欢。", "We read the three of you as well. We like every one of you very much."],
      ["09:02", "老板", "感谢认可！", "Thank you for the recognition!"],
      ["10:30", "和光·法务部", "保密协议三份都收到了。有一份没签名，我们替您补上了，请放心。", "All three confidentiality agreements are in. One had no signature. We added it for you. Please don't worry."],
      ["17:30", "和光·投资部", "第二页不急。和其光，同其尘。晚安。", "No hurry with page two. Soften the light. Be one with the dust. Good night."],
    ],
    6: [
      ["09:00", "和光·投资部", "早上好。", "Good morning."],
      ["09:00", "和光·法务部", "早上好。", "Good morning."],
      ["09:00", "和光·顾问组", "早上好。我们是顾问组，明天进场，帮贵司把材料按模板重排。", "Good morning. We are the advisers. We come in tomorrow, to help you set your material out again on the template."],
      ["09:05", "老板", "欢迎欢迎！", "Welcome, welcome!"],
      ["09:06", "Vivi", "欢迎[玫瑰]", "Welcome [rose]"],
      ["14:00", "和光·顾问组", "@所有人 明天 09:00 晨会。请使用统一背景，背景文件稍后发。", "@all Morning meeting tomorrow at 09:00. Please use the shared background. The file will follow."],
      ["17:30", "和光·投资部", "三页齐了就好。钱的事不用再担心。和其光，同其尘。晚安。", "Three pages and it is done. No need to worry about money any more. Soften the light. Be one with the dust. Good night."],
    ],
    7: [["17:30", "和光·投资部", ...NIGHT]], 8: [["17:30", "和光·投资部", ...NIGHT]], 9: [["17:30", "和光·投资部", ...NIGHT]],
  },
};

// 「收到。」 said by the player: [status, inner zh, inner en, reply lines]
const PEOPLE = { g_gov: ["孙姐", "小吴", "刘处"], g_uni: ["赵老师", "小林", "陈教授"], g_corp: ["Lisa", "Kevin", "Tony"] };
const three = (g, zh, en, t) => PEOPLE[g].map((who) => [t, who, zh, en]);
const NOREPLY = ["不用回复。您读了，我们就知道。", "No need to reply. When you have read it, we know."];
const R = {
  g_gov: {
    1: ["read", "已读。没有人回。尾款逾期第 31 天。", "Read. Nobody answers. The payment is 31 days overdue."],
    2: ["read", "已读。逾期第 32 天。", "Read. 32 days overdue."],
    3: ["read", "已读。逾期第 33 天。", "Read. 33 days overdue."],
  },
  g_uni: {
    1: ["read", "已读。没有人回。", "Read. Nobody answers."],
    2: ["read", "已读。回执上写的是已付款。账上没有。", "Read. The slip says paid. The account says nothing."],
    3: ["read", "已读。陈教授在约下周的羽毛球。", "Read. Professor Chen is arranging next week's badminton."],
  },
  g_corp: {
    1: ["read", "已读。没有人回。", "Read. Nobody answers."],
    2: ["read", "已读。我刷新了。没有。", "Read. I refreshed. Nothing."],
    3: ["read", "已读。他们在数 Family Day 的人头。", "Read. They are counting heads for Family Day."],
  },
  g_invest: {
    4: ["reply", "我刚发出去，它就回了。", "I had only just sent it. It had already answered.", [["09:27", "和光·投资部", ...NOREPLY]]],
    5: ["reply", "那份协议我没有签过。", "I never signed that agreement.", [["10:31", "和光·投资部", ...NOREPLY]]],
    6: ["reply", "", "", [["09:07", "和光·投资部", ...NOREPLY]]],
  },
};
for (const g of ["g_gov", "g_uni", "g_corp"]) {
  R[g][4] = ["reply", "三个人都回了。这个群以前没人回我。", "All three answered. Nobody in this group ever answered me before.", three(g, "收到[玫瑰]", "Received [rose]", "11:00")];
  R[g][5] = ["reply", "三条，同一秒。", "Three lines, the same second.", three(g, "收到。感谢贵司的耐心。", "Received. Thank you for your patience.", "11:00")];
  R[g][6] = ["reply", "另外两个群回的也是这一句。", "The other two groups answer with this same sentence.", three(g, "收到。很高兴今天也能和您一起工作。", "Received. So glad to be working with you again today.", "11:00")];
}

const said = (lang, who, zh, en) => `${lang === "zh" ? who : NAMES[who]}：${lang === "zh" ? zh : en}`;
for (const lang of ["zh", "en"]) for (let day = 1; day <= 9; day++) {
  const f = `${ROOT}/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const g of ["g_invest", "g_gov", "g_uni", "g_corp"]) {
    delete j.recipients[g];
    if (!G[g][day]) continue;
    const rec = { incoming: G[g][day].map(([t, who, zh, en, card]) => ({ t, text: said(lang, who, zh, en), kind: "work", ...(card ? { card: card[lang] } : {}) })) };
    const r = R[g][day];
    if (r) {
      const [status, zh, en, lines] = r;
      const inner = lang === "zh" ? zh : en;
      rec.received = { status, lines: (lines ?? []).map(([t, who, z, e]) => ({ who: "member", t, text: said(lang, who, z, e) })), ...(inner ? { inner } : {}) };
    }
    j.recipients[g] = rec;
  }
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
}
console.log("injected");
