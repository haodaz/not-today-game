// 朋友圈 / Moments in Hi信 (author 2026-11-28, ledger #189: 「朋友圈的设计，这些目前是不是还没有体系梳理和验证」).
// The posts of the eighteen days, zh + en, in one place. Run: node script/tools/gen-feed.mjs
// (rewrites content/feed.json and content/en/feed.json).
// A post: [time, who, zh, en, { photo: [zh, en], place: [zh, en], likes: [who…], comments: [[who, zh, en]…] }]
// who: an NPC id (boss, partner, xiaozhang, laozhou, family = Mum) or a name written as in the groups
// (it has a picture in npc.json `faces`); names are mapped to English by NAMES.
//
// The slope (the same as the chats'): the clients post an easy life on days 1–3 while they do not pay,
// repeat themselves on day 4, speak in one voice by day 6; the company follows the Group from day 7;
// the relatives stay themselves longest (full stops from 11, knowing what they should not on 13,
// only kind words from 16). Day 10 is the calm day: day 1's morning again.
import fs from "node:fs";
const ROOT = new URL("../../content", import.meta.url).pathname;
const NAMES = { 小姑: "Little Aunt", 大姨: "Big Aunt", 二舅: "Uncle Two", 堂姐: "Cousin Jie", 表弟: "Cousin Bo", 姥姥: "Grandma", 孙姐: "Ms Sun", 小吴: "Xiao Wu", 刘处: "Director Liu", 赵老师: "Ms Zhao", 小林: "Xiao Lin", 陈教授: "Prof. Chen", Lisa: "Lisa", Kevin: "Kevin", Tony: "Tony", 和光集团: "Evenlight Group" };
const NPC = ["boss", "partner", "xiaozhang", "laozhou", "family"];

const WATER = ["一杯水，窗外是朝阳", "A glass of water, the sunrise behind it"];
const TRAY = ["餐盘：三菜一汤，一个橘子", "A canteen tray: three dishes, a soup, a tangerine"];
const BRAISED = ["食堂今天有红烧肉。上班真好。", "Braised pork in the canteen today. Work is good."];
const EMPTY_OFFICE = ["一间办公室，椅子都推进去了，没有人", "An office, every chair pushed in, nobody there"];
const GLAD = ["很高兴今天也能和各位一起工作。", "So glad to be working with all of you again today."];
const NEW_START = ["新的开始。感谢和光。", "A new start. Thank you, Evenlight."];
const GRID = ["晨会的截图，九个格子，背景都是同一张", "A screenshot of the morning meeting: nine tiles, one background"];
const PRETTY = ["你今天真漂亮。", "You look lovely today."];
const DOOR = ["一扇门，从外面拍的", "A door, photographed from outside"];
const RELATIVES = ["大姨", "二舅", "小姑", "堂姐", "表弟", "姥姥"];

const DAYS = {
  1: [
    ["07:50", "小姑", "早安。新的一天，从一杯温水开始。", "Good morning. A new day starts with a glass of warm water.", { photo: WATER, likes: ["大姨", "二舅"] }],
    ["12:10", "孙姐", ...BRAISED, { photo: TRAY, likes: ["小吴", "刘处"] }],
    ["19:40", "Kevin", "今天也是高效对齐的一天。", "Another day of efficient alignment.", { photo: ["落地窗前的一杯冰美式", "An iced americano at a floor-to-ceiling window"], place: ["英伟大集团 · 28F", "NVIBIG Group · 28F"], likes: ["Lisa", "Tony"] }],
  ],
  2: [
    ["08:05", "二舅", "孩子争气，当爹的脸上有光。", "The boy has done well. A father can hold his head up.", { photo: ["一张录用名单，一个名字上画了红圈", "A list of the people hired, one name circled in red"], comments: [["大姨", "恭喜恭喜", "Congratulations"], ["小姑", "恭喜恭喜", "Congratulations"]] }],
    ["13:00", "陈教授", "午后，与学生论道。", "Afternoon. Discussing the Way with my students.", { photo: ["草坪上坐着一圈人，中间一袋橘子", "A ring of people sitting on a lawn, a bag of tangerines in the middle"], likes: ["赵老师", "小林"] }],
    ["20:30", "partner", "还在改。", "Still revising.", { photo: ["屏幕上一页方案，右下角的时间是 02:14", "A page of the proposal on a screen; the clock in the corner says 02:14"], likes: ["boss"] }],
  ],
  3: [
    ["11:40", "小吴", "周三，小龙虾，准时。", "Wednesday. Crayfish. On time.", { photo: ["一盆小龙虾", "A basin of crayfish"], likes: ["孙姐", "刘处"] }],
    ["15:30", "Lisa", "欢迎新同学。312 位实习生今天报到，未来可期。", "Welcome, new colleagues. 312 interns reported today. The future is bright.", { photo: ["前台站满了人，每人胸前一张临时卡", "The lobby full of people, a visitor badge on every chest"], likes: ["Kevin", "Tony"] }],
    ["21:10", "boss", "创业就是跳下悬崖，在掉下去的路上把飞机造出来。", "A startup is jumping off a cliff and building the plane on the way down.", { photo: ["机场的夜景，一架飞机", "An airport at night, one plane"], likes: ["partner", "laozhou"], comments: [["xiaozhang", "老板说得对", "The boss is right"]] }],
  ],
  4: [
    ["12:10", "孙姐", ...BRAISED, { photo: TRAY, likes: ["小吴", "刘处", "孙姐"] }],
    ["12:10", "小吴", ...BRAISED, { photo: TRAY, likes: ["孙姐", "刘处", "小吴"] }],
    ["18:20", "堂姐", "点点今天自己练了两个小时。", "Dot practised for two hours today, without being told.", { photo: ["一个小女孩的背影，坐在钢琴前", "A little girl from behind, at a piano"], likes: ["大姨", "小姑"] }],
  ],
  5: [
    ["08:00", "表弟", "公司上新闻了，与有荣焉。", "The company is in the news. Proud to be part of it.", { photo: ["一条新闻的截图", "A screenshot of a news story"], likes: ["二舅"], comments: [["大姨", "有出息", "Doing well for yourself"]] }],
    ["12:00", "Kevin", "下午茶很好喝。", "The afternoon tea was very good.", { photo: ["三杯生椰拿铁，一模一样", "Three coconut lattes, exactly alike"], likes: ["Lisa", "Tony"] }],
    ["14:00", "陈教授", "坐在一起很好。", "Sitting together is good.", { photo: ["会议室里三个人，没有人看镜头", "Three people in a meeting room; nobody looks at the camera"], likes: ["赵老师", "小林"] }],
  ],
  6: [
    ["09:00", "孙姐", ...GLAD, { photo: EMPTY_OFFICE }],
    ["09:00", "赵老师", ...GLAD, { photo: EMPTY_OFFICE }],
    ["09:00", "Lisa", ...GLAD, { photo: EMPTY_OFFICE }],
    ["19:00", "大姨", "广场舞比赛，二等奖。", "Square-dance contest. Second prize.", { photo: ["一排穿红裙子的人，都在笑", "A row of people in red dresses, all smiling"], likes: ["小姑", "二舅", "堂姐"] }],
  ],
  7: [
    ["09:10", "boss", ...NEW_START, { photo: GRID, likes: ["partner", "laozhou", "xiaozhang"] }],
    ["09:10", "partner", ...NEW_START, { photo: GRID, likes: ["boss", "laozhou", "xiaozhang"] }],
    ["18:30", "二舅", "钓了一下午，一条。", "Fished all afternoon. One.", { photo: ["一条小鱼，旁边放了一只鞋比大小", "A small fish, a shoe beside it for scale"], likes: ["大姨"] }],
  ],
  8: [
    ["12:40", "xiaozhang", "十三份外卖。我数了三遍。", "Thirteen takeaways. I counted three times.", { photo: ["一排外卖袋，有一份上面没有名字", "A row of takeaway bags, one with no name on it"] }],
    ["23:10", "表弟", "又是末班车。", "The last train again.", { photo: ["空的地铁车厢", "An empty metro carriage"], likes: ["堂姐"] }],
  ],
  9: [
    ["10:15", "表弟", "毕业了。感谢公司。", "Graduated. Thank you, company.", { photo: ["一个纸箱，里面一盆绿萝、一个工牌", "A cardboard box: a pot plant and a staff badge"], comments: [["小姑", "恭喜毕业[玫瑰]", "Congratulations on graduating [rose]"], ["大姨", "毕业了好，回来考个编", "Good that you've graduated. Come home and sit the civil service exam"]] }],
    ["18:45", "和光集团", "欢迎未来智能加入大家庭。", "Welcome to the family, Future Intelligence.", { photo: ["一张合影，每个人头顶有一圈光", "A group photo, a ring of light over every head"], likes: ["boss", "partner", "laozhou"] }],
  ],
  10: [
    ["07:50", "小姑", "早安。新的一天，从一杯温水开始。", "Good morning. A new day starts with a glass of warm water.", { photo: WATER, likes: ["大姨", "二舅"] }],
    ["09:00", "和光集团", "今天她到。", "She arrives today.", { photo: ["一条走廊，尽头有光", "A corridor, light at the far end"] }],
  ],
  11: [
    ["10:00", "大姨", "家里的君子兰开了。", "The clivia at home has flowered.", { photo: ["一盆花，开了一朵", "A pot plant with one flower open"], likes: ["小姑", "堂姐"] }],
    ["17:50", "partner", "表平了。", "The sheet balances.", { photo: ["一张表，最后一行是 0.00", "A spreadsheet; the last row reads 0.00"], likes: ["和光集团"] }],
  ],
  12: [
    ["09:30", "堂姐", "点点期中第一，数学 96。", "Dot came first in the midterms. 96 in maths.", { photo: ["一张卷子，右上角 96", "An exam paper, 96 in the top right corner"], comments: [["大姨", "96 很好。", "96 is very good."], ["二舅", "96 很好。", "96 is very good."]] }],
    ["22:00", "laozhou", "值班。", "On duty.", { photo: ["一张值班表，每一格都是同一个名字", "A duty rota, the same name in every cell"] }],
  ],
  13: [
    ["12:05", "大姨", "家里小孩小时候攥着个东西不撒手。老师收走那次，没哭。", "Our child used to hold on to a thing and never let go. The time the teacher took it away, there were no tears.", { photo: ["一张旧照片：一只小孩的手，攥着什么", "An old photograph: a child's hand, closed around something"] }],
    ["15:00", "boss", "升级。", "The upgrade.", { photo: ["一排工位，一模一样", "A row of desks, all alike"], likes: ["和光集团"] }],
  ],
  14: [
    ["09:00", "和光集团", "今天入职新人一千名。一视同仁。", "A thousand new staff join today. All treated alike.", { photo: ["一千个工位，一张脸", "A thousand desks, one face"] }],
    ["18:30", "二舅", "都挺好的。", "All fine here.", { photo: ["一张全家福，每个人笑得一样", "A family portrait, everyone smiling the same smile"] }],
  ],
  15: [
    ["07:50", "小姑", "早安。新的一天。不用回。", "Good morning. A new day. No need to reply.", { photo: ["一杯水，窗外没有太阳", "A glass of water; no sun in the window"] }],
    ["14:00", "和光集团", "发布会。集团全员到。", "The launch. The whole Group attends.", { photo: ["观众席，所有人看着同一个方向，不是台上", "The audience, every face turned the same way, and not at the stage"] }],
  ],
  16: [
    ["08:00", "family", "都好。", "All well.", { photo: ["一桌菜，三副碗筷", "A table of dishes, three sets of bowls and chopsticks"] }],
    ["08:00", "大姨", "好孩子。", "Good child.", { likes: ["二舅", "小姑", "堂姐", "表弟", "姥姥"] }],
  ],
  17: [
    ["08:00", "大姨", ...PRETTY, { photo: DOOR }],
    ["08:00", "boss", ...PRETTY, { photo: DOOR }],
    ["08:00", "partner", ...PRETTY, { photo: DOOR }],
  ],
  18: [
    ["08:00", "和光集团", "和其光，同其尘。", "Soften the light. Be one with the dust.", { photo: ["一片白", "White, all of it"], likes: [...RELATIVES, "family", "boss", "partner", "laozhou", "xiaozhang", "孙姐", "陈教授", "Kevin"] }],
  ],
};

const who = (lang, w) => (NPC.includes(w) || lang === "zh" ? w : (NAMES[w] ?? (() => { throw new Error(`no English name for ${w}`); })()));
for (const lang of ["zh", "en"]) {
  const i = lang === "zh" ? 0 : 1;
  const days = {};
  for (const [day, posts] of Object.entries(DAYS)) {
    days[day] = posts.map(([t, w, zh, en, x = {}]) => ({
      t, who: who(lang, w), text: lang === "zh" ? zh : en,
      ...(x.photo ? { photo: x.photo[i] } : {}), ...(x.place ? { place: x.place[i] } : {}),
      ...(x.likes ? { likes: x.likes.map((l) => who(lang, l)) } : {}),
      ...(x.comments ? { comments: x.comments.map(([c, z, e]) => ({ who: who(lang, c), text: lang === "zh" ? z : e })) } : {}),
    }));
  }
  const note = "朋友圈 / Moments: written in script/tools/gen-feed.mjs (both languages there); do not edit here. who = an NPC id or a name with a picture in npc.json faces.";
  fs.writeFileSync(`${ROOT}/${lang === "en" ? "en/" : ""}feed.json`, JSON.stringify({ _note: note, days }, null, 2) + "\n");
}
console.log("feed written:", Object.values(DAYS).flat().length, "posts");
