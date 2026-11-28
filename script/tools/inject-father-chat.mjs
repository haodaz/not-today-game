// Dad's own chat in Hi信 (author 2026-11-28, ledger #190 / #196: 「玩家没有他爹的微信吗，只有他妈妈么」 →
// 「爸爸单开聊天」). The lines of the eighteen days, zh + en, in one place.
// Run: node script/tools/inject-father-chat.mjs   (rewrites recipient `father` in content/replies/day-01..18 and en/)
//
// Who he is (from his lines in 爸妈, content/replies/family.json): few words, no punctuation, a bad back,
// 「够不够说个数」, 「不行就回来 家里有你一口饭」. Here he says what he does not say in front of Mum.
// The slope is the family's: full stops from day 11, knowing what he should not on 13, silent on 14–15
// (he is gone from 爸妈 from day 14), only kind words on 16–17, nothing on 18. Day 10 is day 1 again.
// The player's three replies: fine 好。 / received 知道了。 / thanks 谢谢爸。 (a day may word `thanks` to fit).
// A cell: [status, reply lines [[time, zh, en]…], inner [zh, en]?]
import fs from "node:fs";
const ROOT = process.env.REPLIES ?? new URL("../../content/replies", import.meta.url).pathname;
const MM = [["嗯", "mm"]];
const TRANSFER = [["21:05", "[转账] 2000 元", "[Transfer] ¥2,000"], ["21:05", "别跟你妈说", "don't tell your mum"]];
const transferCells = (inner) => ({
  fine: ["read", [], inner],
  received: ["reply", [["21:07", ...MM[0]]]],
  thanks: ["reply", [["21:08", "谢什么", "what for"]]],
});
const silent = (zh, en) => ({ fine: ["read", [], [zh, en]], received: ["read", []], thanks: ["read", []] });
const echo = (t, zh, en) => ({ fine: ["reply", [[t, zh, en]]], received: ["reply", [[t, zh, en]]], thanks: ["reply", [[t, zh, en]]] });

const DAYS = {
  1: { in: TRANSFER, ...transferCells(["我没有点收款。二十四小时以后它自己会退回去。", "I do not tap Accept. In twenty-four hours it goes back by itself."]) },
  2: {
    in: [["21:06", "钱退回来了", "the money came back"], ["21:06", "不要就算了", "suit yourself"]],
    fine: ["read", [], ["他没有再转。", "He does not send it again."]],
    received: ["reply", [["21:09", ...MM[0]]]],
    thanks: ["reply", [["21:09", "早点睡", "sleep early"]]],
  },
  3: {
    in: [["18:36", "腰没事 你妈大惊小怪", "my back is fine your mum fusses"]],
    fine: ["reply", [["18:38", ...MM[0]]]],
    received: ["read", []],
    thanks: ["reply", [["18:40", "不去 贵", "not going costs money"]]], // the chip reads 「去医院看看。」
  },
  4: {
    in: [["07:10", "[链接] 久坐的人每天做这三个动作", "[Link] Three moves a day for people who sit all day"]],
    fine: ["read", [], ["三个动作我一个都没做。", "I do none of the three."]],
    received: ["reply", [["07:30", "做了没", "did you do them"]]],
    thanks: ["reply", [["07:31", ...MM[0]]]],
  },
  5: {
    in: [["12:30", "吃的什么", "what are you eating"], ["12:30", "拍给我看看", "send me a picture"]],
    fine: ["read", [], ["我没有拍。", "I do not take one."]],
    received: ["reply", [["12:40", "有肉没有", "any meat in it"]]],
    thanks: ["reply", [["12:41", "吃吧", "eat"]]],
  },
  6: {
    in: [["19:05", "语音你听了没", "did you listen to the voice message"], ["19:05", "我不是跟你要钱", "I'm not asking you for money"]],
    fine: ["reply", [["19:08", "那你让它看看", "then have it take a look"]]],
    received: ["read", []],
    thanks: ["reply", [["19:09", "那它会什么", "then what can it do"]]], // the chip reads 「它不会看病。」
  },
  7: {
    in: [["18:33", "小鸡是我让你妈问的", "I had your mum ask about the chick"], ["18:33", "还在的话别扔", "if you still have it don't throw it out"]],
    fine: ["reply", [["18:35", ...MM[0]]]],
    received: ["read", [], ["它就在桌上。", "It is right here on the desk."]],
    thanks: ["reply", [["18:36", "谢什么", "what for"]]],
  },
  8: {
    in: [["22:30", "还没睡吧", "still up I suppose"], ["22:30", "我也没睡", "so am I"]],
    fine: ["reply", [["22:32", "睡吧", "go to sleep"]]],
    received: ["reply", [["22:32", "睡吧", "go to sleep"]]],
    thanks: ["read", []],
  },
  9: {
    in: [["10:22", "刚才群里我话重了", "I was too hard in the group just now"], ["10:22", "不是说你", "I didn't mean you"]],
    fine: ["reply", [["10:25", ...MM[0]]]],
    received: ["read", []],
    thanks: ["reply", [["10:26", "不行就回来", "if it doesn't work out come home"]]],
  },
  10: { in: TRANSFER, ...transferCells(["上次那笔我没有点，退回去了。这一笔和上次一模一样。", "I did not accept the last one and it went back. This one is the same in every way."]) },
  11: {
    in: [["21:00", "今天腰不疼了。", "My back does not hurt today."], ["21:00", "一点都不疼了。", "Not at all."]],
    fine: ["reply", [["21:02", "好。", "Good."]]],
    received: ["read", []],
    thanks: ["reply", [["21:03", "好。", "Good."]]], // the chip reads 「那就好。」
  },
  12: {
    in: [["15:31", "那个帖子是你写的吧。", "You wrote that post, didn't you."], ["15:31", "那年你才多大。", "How old were you that year."]],
    fine: ["read", []],
    received: ["reply", [["15:35", "好。", "Good."]]],
    thanks: ["read", []],
  },
  13: {
    in: [["12:10", "老师收走那次，你没哭。", "The time the teacher took it away, you did not cry."], ["12:10", "我知道。", "I know."]],
    fine: ["read", [], ["这件事我没有跟家里说过。", "I never told them about that at home."]],
    received: ["reply", [["12:12", "好。", "Good."]]],
    thanks: ["read", []],
  },
  14: { in: [], ...silent("他今天一句话都没有发。", "He has not sent a word today.") },
  15: { in: [], ...silent("还是没有。", "Still nothing.") },
  16: { in: [["08:00", "都好。", "All well."]], ...echo("08:00", "好。", "Good.") },
  17: { in: [["08:00", "好孩子。", "Good child."]], ...echo("08:00", "好孩子。", "Good child.") },
  18: { in: [], fine: ["read", []], received: ["read", []], thanks: ["read", []] },
};

for (const lang of ["zh", "en"]) {
  const i = lang === "zh" ? 1 : 2;
  for (let day = 1; day <= 18; day++) {
    const f = `${ROOT}/${lang === "en" ? "en/" : ""}day-${String(day).padStart(2, "0")}.json`;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const d = DAYS[day];
    const rec = { incoming: d.in.map((l) => ({ t: l[0], text: l[i], kind: "private" })) };
    for (const word of ["fine", "received", "thanks"]) {
      const [status, lines, inner] = d[word];
      rec[word] = { status, lines: lines.map((l) => ({ who: "father", t: l[0], text: l[i] })), ...(inner ? { inner: inner[i - 1] } : {}) };
    }
    // after the company's own threads, before the outside groups: the order in the file is the order in the table
    const out = {};
    let put = false;
    for (const [k, v] of Object.entries(j.recipients)) {
      if (k === "father") continue;
      if (!put && k.startsWith("g_")) { out.father = rec; put = true; }
      out[k] = v;
    }
    if (!put) out.father = rec;
    j.recipients = out;
    fs.writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
  }
}
console.log("father's chat injected");
