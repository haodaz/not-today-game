// Outside groups in 汀汀 (author 2026-11-27, ledger #171): the lines of the three client project groups
// (government, university, big enterprise) and the parent company's investment group, days 1–9, zh + en.
// Run: node script/tools/inject-outside-groups.mjs   (rewrites the outside groups in content/replies/day-01..18 and en/)
// Each line: [time, speaker (zh), zh text, en text, card?]. Speakers are mapped to English by NAMES.
import fs from "node:fs";
const ROOT = process.env.REPLIES ?? new URL("../../content/replies", import.meta.url).pathname;
const NAMES = { 孙姐: "Ms Sun", 小吴: "Xiao Wu", 刘处: "Director Liu", 老周: "Lao Zhou", 赵老师: "Ms Zhao", 小林: "Xiao Lin", 陈教授: "Prof. Chen", Lisa: "Lisa", Kevin: "Kevin", Tony: "Tony", "和光·投资部": "Investment", "和光·法务部": "Legal", "和光·顾问组": "The Advisers", "顾问 陈": "Adviser Chen", "顾问 沈": "Adviser Shen", 小张: "Xiao Zhang", "和光·总裁办": "Exec Office", "顾问组组长": "Lead Adviser", "和光·文化部专员": "Culture Staff", "和光·财务部经理": "Finance Mgr", "和光·行政部高级经理": "Admin Sr Mgr", "和光·行政部总监": "Admin Director", "和光·人力部副总裁": "HR VP", "和光·品牌部高级副总裁": "Brand SVP", "和光·总裁办主任": "Chief of Staff", "董事长秘书": "The Secretary", "和光·财务部": "Finance", "和光·人力部": "HR", "和光·行政部": "Admin", "和光·文化部": "Culture", 老板: "Boss", Vivi: "Vivi", member: "member" };
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
      ["09:30", "刘处", "小吴，今天把那张台账表校对一下。就这一张，不急", "Xiao Wu, proofread that ledger spreadsheet today. Just the one sheet. No hurry"],
      ["11:40", "小吴", "校到第 6 行了，发现一个全角括号", "I'm at row 6. Found a full-width bracket"],
      ["11:41", "孙姐", "小吴眼睛真尖[强]", "Sharp eyes, Xiao Wu [thumbs up]"],
      ["15:40", "老周", "刘处，一期尾款我们这边还没看到。哪天请您吃饭", "Director Liu, the final payment for phase one hasn't reached us yet. Let me buy you dinner one of these days"],
      ["15:58", "刘处", "付了的，流程都走完了", "It's paid. The whole process is finished"],
      ["15:59", "孙姐", "付了的[玫瑰]", "It's paid [rose]"],
      ["16:20", "小吴", "表校完了。一共 14 行，改了一个括号，两个空格", "The sheet is done. 14 rows in all. Fixed one bracket and two spaces"],
      ["16:21", "刘处", "很好。大家向小吴学习。今天就先这一件", "Very good. Everyone learn from Xiao Wu. That will do for today"],
      ["16:22", "孙姐", "[鼓掌][鼓掌][鼓掌]", "[clap][clap][clap]"],
      ["16:30", "孙姐", "工会发米和油，下班前到 302 领", "The union is handing out rice and oil. Room 302, before you leave"],
    ],
    2: [
      ["09:05", "小吴", "昨天那张表，我把表头加粗了", "Yesterday's sheet: I made the header row bold"],
      ["09:40", "刘处", "好。细。这张表可以当范本", "Good. Thorough. This sheet can be the model for the others"],
      ["09:41", "孙姐", "已转发全局学习[强]", "Forwarded to the whole bureau to learn from [thumbs up]"],
      ["11:20", "孙姐", "@所有人 体检报名接龙 1. 孙姐", "@all Health check sign-up. 1. Sun"],
      ["11:21", "小吴", "2. 小吴", "2. Wu"],
      ["11:21", "刘处", "3. 刘", "3. Liu"],
      ["14:20", "刘处", "@未来智能 系统首页那个红，领导看了说不够正。调一下，明天要", "@Future Intelligence The red on the system's home page: the leadership looked and says it is not the right red. Adjust it. Needed tomorrow"],
      ["14:21", "孙姐", "领导眼光真准[强]", "The leadership has such an eye [thumbs up]"],
      ["15:10", "老周", "刘处，尾款还是没到", "Director Liu, the payment still hasn't arrived"],
      ["15:45", "刘处", "我这边显示已付款。再等等，钱在路上", "On my side it says paid. Wait a little, the money is on its way"],
      ["16:50", "小吴", "今天的活干完了，我先去接孩子", "Today's work is done. I'm off to pick up my kid"],
    ],
    3: [
      ["09:10", "孙姐", "今天小龙虾，11:30 开餐，去晚了没有", "Crayfish today, from 11:30. Come late and there's none left"],
      ["09:11", "小吴", "收到！", "Received!"],
      ["10:00", "刘处", "小吴，把那张表发一下", "Xiao Wu, send that sheet out"],
      ["10:01", "小吴", "已发", "Sent"],
      ["10:02", "刘处", "辛苦。这周的工作就到这", "Well done. That's the week's work"],
      ["13:30", "小吴", "[图片]", "[Photo]", IMG("一盘剥好的小龙虾", "A plate of peeled crayfish")],
      ["13:31", "孙姐", "剥得真干净", "Peeled so clean"],
      ["14:30", "孙姐", "@未来智能 系统培训麻烦再来讲一次。上次那场赶上工会发米和油，没人在", "@Future Intelligence Please come and give the system training once more. Last time it clashed with the union's rice and oil, and nobody was in the room"],
      ["16:20", "老周", "刘处，尾款", "Director Liu, the payment"],
      ["16:21", "刘处", "付了", "Paid"],
    ],
    4: [
      ["09:02", "孙姐", "@所有人 本周食堂菜单发了，周三有小龙虾", "@all This week's canteen menu is out. Crayfish on Wednesday"],
      ["09:30", "刘处", "小吴，今天把那张台账表校对一下。就这一张，不急", "Xiao Wu, proofread that ledger spreadsheet today. Just the one sheet. No hurry"],
      ["11:40", "小吴", "校到第 6 行了，发现一个全角括号", "I'm at row 6. Found a full-width bracket"],
      ["11:41", "孙姐", "小吴眼睛真尖[强]", "Sharp eyes, Xiao Wu [thumbs up]"],
      ["11:41", "刘处", "小吴眼睛真尖[强]", "Sharp eyes, Xiao Wu [thumbs up]"],
      ["15:58", "刘处", "付了的，流程都走完了", "It's paid. The whole process is finished"],
      ["15:59", "孙姐", "付了的[玫瑰]", "It's paid [rose]"],
      ["15:59", "小吴", "付了的[玫瑰]", "It's paid [rose]"],
      ["16:20", "小吴", "表校完了。一共 14 行，改了一个括号，两个空格", "The sheet is done. 14 rows in all. Fixed one bracket and two spaces"],
      ["16:22", "孙姐", "[鼓掌][鼓掌][鼓掌]", "[clap][clap][clap]"],
      ["16:22", "刘处", "[鼓掌][鼓掌][鼓掌]", "[clap][clap][clap]"],
      ["16:22", "小吴", "[鼓掌][鼓掌][鼓掌]", "[clap][clap][clap]"],
    ],
    5: [
      ...hello5("孙姐", "小吴", "刘处"),
      ["10:00", "小吴", "表已经校对好了。14 行都没有问题。没有需要再改的地方。", "The sheet has been proofread. All 14 rows are correct. Nothing needs correcting any more."],
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
      ["11:00", "陈教授", "@未来智能 结题报告你们先出个初稿，三万字左右，署名我来排", "@Future Intelligence You write the first draft of the final project report. About thirty thousand words. I will arrange the names"],
      ["11:01", "赵老师", "陈老师又要结题了[强]", "Another project closed, Professor [thumbs up]"],
      ["14:00", "陈教授", "组会改明天。今天天气好，大家出去走走", "Group meeting moved to tomorrow. The weather is good, go out for a walk"],
      ["14:01", "小林", "谢谢陈老师！", "Thank you, Professor!"],
      ["16:10", "老周", "陈教授，合作经费我们这边还没收到", "Professor Chen, the project funds haven't reached us yet"],
      ["16:35", "陈教授", "拨了拨了，学校的流程你们懂的", "Released, released. You know how the university's process is"],
    ],
    2: [
      ["09:30", "小林", "陈老师，第 3 条的逗号改好了", "Professor, the comma in reference 3 is changed"],
      ["09:50", "陈教授", "很好。第 4 条明天再看，不急", "Very good. Reference 4 can wait till tomorrow, no hurry"],
      ["10:00", "赵老师", "教工食堂二楼开了新窗口，凭工作证免费喝汤", "A new counter on the second floor of the staff canteen: free soup with your staff card"],
      ["10:30", "小林", "@未来智能 陈老师让我开题用你们的系统，麻烦开个账号，今晚再给我讲一下原理", "@Future Intelligence Professor Chen wants me to use your system for my thesis proposal. Please open me an account, and explain how it works tonight"],
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
      ["11:00", "陈教授", "小林的开题过了，评了优秀", "Xiao Lin's thesis proposal passed. Graded excellent"],
      ["11:01", "赵老师", "名师出高徒[强]", "A fine teacher, a fine student [thumbs up]"],
      ["11:02", "小林", "谢谢陈老师！致谢里第一个写的您", "Thank you, Professor! You are the first name in the acknowledgements"],
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
      ["11:30", "Kevin", "@未来智能 首页的按钮从左边挪到右边，Tony 总说这样更对齐。这个不算需求变更", "@Future Intelligence Move the button on the home page from the left to the right. Tony says it is better aligned that way. This does not count as a change request"],
      ["15:00", "Lisa", "下午茶到了，前台自取", "Afternoon tea is here. Pick it up at the front desk"],
      ["16:00", "老周", "Kevin，年度服务费的发票开过去一个月了", "Kevin, the invoice for the annual service fee went out a month ago"],
      ["16:20", "Kevin", "收到。付款已经提交了，在走审批，这周一定闭环", "Noted. The payment is submitted and in approval. We'll close the loop this week for sure"],
    ],
    2: [
      ["09:35", "Kevin", "昨天的字号，Tony 总说 30 太大，我调回 28 了", "Yesterday's font: Tony said 30 was too big. I put it back to 28"],
      ["09:50", "Tony", "嗯，舒服了", "Mm. That feels right"],
      ["10:20", "Lisa", "@所有人 系统测试的事定了：招一批实习生来测，无薪，结束开实习证明", "@all System testing is settled: we take on a batch of interns to test it. Unpaid. An internship certificate at the end"],
      ["10:21", "Tony", "好，降本增效", "Good. Costs down, efficiency up"],
      ["14:00", "Kevin", "拉个会，对齐一下今天的下午茶", "Let's have a call to align on today's afternoon tea"],
      ["14:30", "Kevin", "对齐完了，今天喝果茶", "Aligned. Fruit tea today"],
      ["16:10", "老周", "Kevin，审批走到哪了", "Kevin, where is the approval now"],
      ["16:40", "Kevin", "已经付了呀，系统显示 paid。你们再刷新一下", "But it's been paid. The system says paid. Try refreshing"],
    ],
    3: [
      ["09:40", "Lisa", "实习生报了 312 个，一大半是硕士，前台站不下了", "312 interns signed up, more than half with a master's. They don't fit in the lobby"],
      ["09:41", "Kevin", "来这么多[强] 那今天的下午茶接龙只算正式员工", "That many [thumbs up] Then today's afternoon tea orders are for regular staff only"],
      ["09:50", "Lisa", "@未来智能 麻烦开 312 个测试账号，今天下班前", "@Future Intelligence Please open 312 test accounts, before the end of today"],
      ["10:30", "Tony", "这周的 OKR 大家填一下，一行就行", "Everyone fill in this week's OKR. One line will do"],
      ["10:31", "Kevin", "填了：「保持对齐」", "Done: \"stay aligned\""],
      ["10:32", "Tony", "好，闭环", "Good. Loop closed"],
      ["15:20", "Lisa", "实习生一上午提了 1400 条问题，都转给 @未来智能 了，辛苦这周闭环", "The interns raised 1,400 issues this morning. All forwarded to @Future Intelligence. Please close the loop this week"],
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
      ["10:00", "Lisa", "实习生今天没有提问题。312 个人都说没有问题。", "The interns raised no issues today. All 312 of them say there are no issues."],
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

// 融合工作群 (days 7–9): the advisers move in. 管理群 (day 9 on): the three founders belong to the Group.
G.g_merge = {
  7: [
    ["08:50", "和光·顾问组", "各位早。融合期间的日常对接都在这个群。群公告：和其光，同其尘。", "Good morning. Day-to-day matters of the integration go in this group. Group notice: soften the light, be one with the dust."],
    ["09:30", "和光·顾问组", "@所有人 请把群昵称改成「职级-姓名」。职级就是刚才晨会上报的那个。", "@all Please change your group name to \"rank-name\". The rank is the one you stated in the meeting just now."],
    ["09:31", "老周", "亲王-老周", "Prince-Lao Zhou"],
    ["09:31", "Vivi", "公爵-Vivi", "Duke-Vivi"],
    ["09:32", "小张", "伯爵-小张", "Earl-Xiao Zhang"],
    ["09:32", "老板", "王-老王", "King-Lao Wang"],
    ["09:35", "和光·顾问组", "还有一位没改。研发没有对应的职级，先空着就行。", "One person has not changed theirs. R&D has no matching rank. Leave it empty for now."],
    ["09:40", "顾问 陈", "@所有人 今天的晨会纪要按模板，五步一步别少。研发那位整理，发到这个群。", "@all Today's minutes go on the template, all five steps. The one from R&D writes them up and sends them to this group."],
    ["10:30", "顾问 陈", "六份交接单，今天内交齐，一人一份。", "Six handover forms, all in by the end of today, one each."],
    ["16:00", "顾问 沈", "收到两份。另外四份的人呢。", "Two received. Where are the people of the other four."],
    ["16:01", "顾问 陈", "不急。人会来的。", "No hurry. The people will come."],
  ],
  8: [
    ["09:10", "顾问 沈", "@所有人 周五线上团建。祝酒时间按职级排，依据在共享盘《职级与时段》。", "@all Online team night on Friday. Toast hours go by rank; the basis is in the shared drive: Ranks and hours."],
    ["09:11", "顾问 沈", "祝酒时间研发那位排，排好发到这个群。", "The one from R&D schedules the toasts and sends the schedule to this group."],
    ["10:02", "顾问 陈", "十三份外卖已订，一份不要筷子。", "Thirteen takeaways ordered, one without chopsticks."],
    ["10:03", "小张", "十三份是哪十三个人？我数了，我们没有这么多。", "Thirteen for which thirteen people? I counted. There aren't that many of us."],
    ["10:04", "顾问 沈", "到时候就够了。", "There will be by then."],
    ["17:30", "和光·顾问组", "各位今天辛苦。和其光，同其尘。", "Thank you all for today. Soften the light. Be one with the dust."],
  ],
  9: [
    ["09:02", "和光·顾问组", "今天系统接入。各位的账号会自动迁过来，不需要操作。", "The systems are joined today. Your accounts will move over by themselves. Nothing for you to do."],
    ["09:03", "和光·顾问组", "迁移期间如果看到自己的头像变了，属于正常现象。", "If you see your own picture change during the move, that is normal."],
    ["14:00", "顾问组组长", "明天的会，座位研发那位排，排好发到这个群。圈内四席，圈外一席。", "Tomorrow's meeting: the one from R&D does the seating and sends it to this group. Four seats in the circle, one outside."],
    ["14:01", "顾问 沈", "来宾的名字，请各位不要打在群里。", "Please do not type the guest's name in the group."],
    ["14:02", "小张", "为什么", "Why"],
    ["14:02", "顾问 沈", "打出来，它就听见了。", "Once it is typed, it has heard."],
    ["18:40", "和光·顾问组", "融合工作今天结束，本群明天解散。三位创始人另有安排，其余同事原地等通知。", "The integration ends today. This group is dissolved tomorrow. The three founders have other arrangements. Everyone else, stay where you are and wait to be told."],
    ["18:41", "member", "收到。", "Received."], ["18:41", "member", "收到。", "Received."], ["18:41", "member", "收到。", "Received."],
  ],
};
G.g_mgmt = {
  9: [
    ["18:45", "和光·总裁办", "欢迎三位加入集团管理群。", "Welcome to the Group's management group, all three."],
    ["18:45", "和光·总裁办", "从明天起，三位是集团的人了。", "From tomorrow, the three of you belong to the Group."],
    ["18:46", "老板", "感谢集团信任！", "Thank you for the Group's trust!"],
    ["18:46", "Vivi", "[玫瑰][玫瑰]", "[rose][rose]"],
    ["18:47", "和光·总裁办", "这个群不能退。", "This group cannot be left."],
  ],
  10: [
    ["09:00", "和光·总裁办", "早上好。今天她到。请各位把虚拟背景关掉。", "Good morning. She arrives today. Please turn your virtual backgrounds off."],
    ["09:01", "和光·总裁办", "贵司原来的三个项目群已经并入集团。那三笔款不用再催了，都是一家人。", "Your three old project groups have been merged into the Group. No need to chase those three payments any more. We are one family."],
    ["09:30", "和光·文化部专员", "剧本第二幕今天校对，研发那位来。校对的人不要整行读。", "Act two of the script is proofread today, by the one from R&D. Whoever proofreads must not read a whole line."],
    ["17:30", "和光·总裁办", ...NIGHT],
  ],
  11: [
    ["09:00", "和光·财务部经理", "今天称成本，研发那位填表。一分不能差。油和酒两列不要动。", "Costs are weighed today; the one from R&D fills in the sheet. Not a cent off. Do not touch the oil column or the wine column."],
    ["12:00", "和光·财务部经理", "@Vivi 表几点能平。", "@Vivi When will the sheet balance."],
    ["12:01", "Vivi", "下班前。", "Before the end of the day."],
    ["17:30", "和光·总裁办", ...NIGHT],
  ],
  12: [
    ["03:00", "和光·行政部高级经理", "本周是关键。各位先不睡。值班表研发那位排。", "This week is the one that counts. Nobody sleeps for now. The one from R&D draws up the rota."],
    ["03:00", "老板", "收到。", "Received."],
    ["03:00", "Vivi", "收到。", "Received."],
    ["11:31", "和光·财务部经理", "钱的事，各位不用再问了。", "About money: you need not ask again."],
  ],
  13: [
    ["09:30", "和光·总裁办", "公司下周升级，全员。", "The company is upgraded next week. All staff."],
    ["09:31", "和光·行政部总监", "集团要向三位借几样旧东西，走借阅审批，单子研发那位填。借期：长期。", "The Group would like to borrow a few old things from the three of you, through a loan approval; the one from R&D fills in the form. Period of loan: long-term."],
    ["18:00", "和光·行政部总监", "借阅申请已通过。审批人一栏是空的，属于正常现象。", "The loan request is approved. The approver field is empty. That is normal."],
  ],
  14: [
    ["09:00", "和光·人力部副总裁", "今天入职新人一千名。请研发那位排工位，一视同仁。", "A thousand new staff join today. The one from R&D, please give them desks, all treated alike."],
    ["09:01", "和光·人力部副总裁", "研发那位这段时间辛苦了。集团都知道。", "The one from R&D has worked hard lately. The Group knows all of it."],
    ["17:30", "和光·总裁办", ...NIGHT],
  ],
  15: [
    ["09:05", "和光·品牌部高级副总裁", "下午发布会，集团全员到。演示稿研发那位排，观众的反应请实时盯着。", "The launch is this afternoon. The whole Group attends. The one from R&D lays out the deck; please watch the audience's reaction live."],
    ["15:00", "和光·品牌部高级副总裁", "[图片]", "[Photo]", IMG("观众席。每一张脸都一样。", "The audience. Every face the same.")],
    ["17:30", "和光·总裁办", ...NIGHT],
  ],
  16: [
    ["09:01", "和光·总裁办主任", "董事长到了。董事长不看材料。汇报研发那位做，不要停。", "The chairman is here. The chairman does not read material. The one from R&D makes the report. It must not stop."],
    ["09:02", "和光·总裁办主任", "董事长的名字请各位不要打出来。也打不出来。", "Please do not type the chairman's name. It cannot be typed anyway."],
  ],
  17: [
    ["08:58", "董事长秘书", "董事长要研发那位回一个电话。", "The chairman wants the one from R&D to return a call."],
    ["09:00", "和光·总裁办", "回一下我，我是谁你应该知道。", "Answer me. You should know who I am."],
    ["09:00", "老板", "回一下我，我是谁你应该知道。", "Answer me. You should know who I am."],
    ["09:00", "Vivi", "回一下我，我是谁你应该知道。", "Answer me. You should know who I am."],
  ],
  18: [
    ["09:00", "和光·总裁办", "今天把手上的都清了。明天起，各位不需要再工作了。", "Clear everything on your hands today. From tomorrow, none of you will need to work any more."],
    ["17:00", "和光·总裁办", ...NIGHT],
  ],
};

// 「收到。」 said by the player: [status, inner zh, inner en, reply lines]
const PEOPLE = { g_gov: ["孙姐", "小吴", "刘处"], g_uni: ["赵老师", "小林", "陈教授"], g_corp: ["Lisa", "Kevin", "Tony"] };
const three = (g, zh, en, t) => PEOPLE[g].map((who) => [t, who, zh, en]);
const NOREPLY = ["不用回复。您读了，我们就知道。", "No need to reply. When you have read it, we know."];
const R = {
  g_gov: {
    1: ["read", "已读。没有人回。他们今天校对了一张 14 行的表。尾款逾期第 31 天。", "Read. Nobody answers. Today they proofread one sheet of 14 rows. The payment is 31 days overdue."],
    2: ["read", "已读。那个红要我明天调好。逾期第 32 天。", "Read. The red is mine to fix by tomorrow. 32 days overdue."],
    3: ["read", "已读。培训要再讲一次。逾期第 33 天。", "Read. The training is to be given again. 33 days overdue."],
  },
  g_uni: {
    1: ["read", "已读。没有人回。三万字的初稿是我写。", "Read. Nobody answers. The thirty thousand words are mine to write."],
    2: ["read", "已读。回执上写的是已付款。账上没有。", "Read. The slip says paid. The account says nothing."],
    3: ["read", "已读。陈教授在约下周的羽毛球。", "Read. Professor Chen is arranging next week's badminton."],
  },
  g_corp: {
    1: ["read", "已读。没有人回。按钮要我挪，不算变更。", "Read. Nobody answers. The button is mine to move, and it is not a change."],
    2: ["read", "已读。我刷新了。没有。", "Read. I refreshed. Nothing."],
    3: ["read", "已读。312 个账号，1400 条问题，都是给我的。没有人提钱。", "Read. 312 accounts and 1,400 issues, all for me. Nobody mentions money."],
  },
  g_invest: {
    4: ["reply", "我刚发出去，它就回了。", "I had only just sent it. It had already answered.", [["09:27", "和光·投资部", ...NOREPLY]]],
    5: ["reply", "那份协议我没有签过。", "I never signed that agreement.", [["10:31", "和光·投资部", ...NOREPLY]]],
    6: ["reply", "", "", [["09:07", "和光·投资部", ...NOREPLY]]],
  },
  g_mgmt: {
    9: ["reply", "", "", [["18:48", "和光·总裁办", ...NOREPLY]]],
  },
};
for (const g of ["g_gov", "g_uni", "g_corp"]) {
  R[g][4] = ["reply", "三个人都回了。这个群以前没人回我。", "All three answered. Nobody in this group ever answered me before.", three(g, "收到[玫瑰]", "Received [rose]", "11:00")];
  R[g][5] = ["reply", "三条，同一秒。", "Three lines, the same second.", three(g, "收到。感谢贵司的耐心。", "Received. Thank you for your patience.", "11:00")];
  R[g][6] = ["reply", "另外两个群回的也是这一句。", "The other two groups answer with this same sentence.", three(g, "收到。很高兴今天也能和您一起工作。", "Received. So glad to be working with you again today.", "11:00")];
}

const said = (lang, who, zh, en) => `${lang === "zh" ? who : NAMES[who]}：${lang === "zh" ? zh : en}`;
for (const lang of ["zh", "en"]) for (let day = 1; day <= 18; day++) {
  const f = `${ROOT}/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`;
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const g of ["g_invest", "g_merge", "g_mgmt", "g_gov", "g_uni", "g_corp"]) {
    delete j.recipients[g];
    if (!G[g]?.[day]) continue;
    const rec = { incoming: G[g][day].map(([t, who, zh, en, card]) => ({ t, text: said(lang, who, zh, en), kind: "work", ...(card ? { card: card[lang] } : {}) })) };
    const r = R[g]?.[day];
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
