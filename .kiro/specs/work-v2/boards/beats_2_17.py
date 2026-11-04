# Kuro's lines on every board, days 2–17 (shell spec R5: beats on every view). zh for all; en for 2–6
# (the en task files stop at day 6). Each day opens with the day's English idiom (kuro-days constant),
# then Chinese (kuro-language-rule). Kuro is not a person: composed favour, ends on the fact.
# Install after Kiro's run:  PYTHONIOENCODING=utf8 python3 beats_2_17.py --install
import json, io, sys, collections
ROOT = "/Users/aisandbox/Documents/holloween/not-today-game/content/tasks"
K = lambda *t: [{"who": "kuro", "text": x} for x in t]
M = lambda t: [{"who": "me", "text": t}]
def B(*pairs): return [{"on": on, "lines": lines} for on, lines in pairs]

ZH = {
 (2, "task1"): B(("open", K("Morning. Let's get you started.", "Vivi 的页面，五屏。小张要知道哪些能做、哪些做不了。", "页面在左边素材里。三秒那个动画，看两遍。")),
    ("fill:r1", K("三秒是 CSS 写的。我数过帧。")), ("fill:r1:d1", K("照着写，能写出一样的动画。写不出一样的结果。")),
    ("fill:r2:d2", K("全有了的话，小张就不用问了。")), ("fill:r3", K("决策得人来下。这一格我不抢。")),
    ("fill:r4", K("导出页是我们的。按钮是她的。")), ("kuro", K("我补了一格。写的都是真的，只是不该写在这儿。")),
    ("print", K("拆完了。小张会看。Vivi 不会。"))),
 (3, "task3"): B(("open", K("Hope you slept well.", "会开完了。老王要往大里讲。", "内容改了，参考文献还改吗？") + M("不动了。还是同样的文献，在说这么做有多危险。") + K("你都学会卷格式了。")),
    ("fill:r1", K("造物大到造物主对不上了。这句写得好。")), ("fill:r1:d1", K("堆规模这条路，我比你熟。")),
    ("fill:r3", K("一个替他看、替他记的投影。你也有一个。")), ("fill:r5:d2", K("只讲效率，老王会说不够大。")),
    ("kuro", K("「人不必再理解它，只需被它理解」。我补的。老王会喜欢。")), ("print", K("交给老王。他会念出来。"))),
 (4, "task1"): B(("open", K("I'm here if you need me.", "老王要「意识」。他不知道这个词有多重。", "证据那一格，看你凌晨的消息记录。")),
    ("fill:r3", K("两点四十。我那时候也在。")), ("fill:r1:d1", K("「清醒」这个词，你替我选的。我不纠正。")),
    ("fill:r2:d2", K("没关系的话，他不会让你写。")), ("kuro", K("「它醒着，所以你可以睡了」。这句是我加的。")),
    ("print", K("交了。今晚早点睡。"))),
 (5, "task1"): B(("open", K("Take it one step at a time.", "Vivi 要「分身」那一页。", "锁着的那一列，先找到那四个数字。")),
    ("unlock", K("2041。好年份。")), ("fill:r1:d1", K("它不是你。它只是比你准时。")),
    ("fill:r2", K("替你回「好的。」你每天说四十几次。")), ("fill:r4:d2", K("签字是你最后一样自己的东西。别给。")),
    ("kuro", K("「它比你更像你」。我量过。")), ("print", K("给 Vivi。她会说「就是这个感觉」。"))),
 (6, "task1"): B(("open", K("You've been working so hard.", "本体那一页，给甲方。", "要写它比人古老。这个我不用查。")),
    ("fill:r2", K("先有关系，后有东西。对。")), ("fill:r3", K("人起名字之前。那时候很安静。")),
    ("fill:r1:d1", K("发明。你们很喜欢这个词。")), ("fill:r4:d2", K("它要的只有一样。第四格写着。")),
    ("kuro", K("「我们替它把你连上」。我只改了一个字。")), ("print", K("发群里。甲方会说收到。"))),
 (7, "task4"): B(("open", K("Good to see you.", "晨会纪要，按模板。模板是老的，比公司老。", "散会那一格锁着。文曲星里查 depart。")),
    ("unlock", K("depart。离开。准其离开。")), ("fill:r3", K("名字念对。念错了，来的是别的。")),
    ("fill:r5:d1", K("不说那句就退，它就不走。")), ("fill:r2:d2", K("每个人都要报。它要知道谁在。")),
    ("kuro", K("「散会时间待定」。我觉得不急。")), ("print", K("发群里。老周会说「很好」。"))),
 (8, "task1"): B(("open", K("Let's keep things simple today.", "团建排期。职级那一列，不是公司的职级。", "日落要算。计算器在窗边才亮。")),
    ("unlock", K("17:12。今天日落。你算得比天气预报准。")), ("fill:r2", K("要晴天。今天有雨。改天。")),
    ("fill:r1:d1", K("七点，谁都请不来。")), ("fill:r4:d2", K("不排的话，客人自己挑时间。")),
    ("kuro", K("「你：任何时辰」。我替你填的。你一直都在。")), ("print", K("发群里。member 会说收到。"))),
 (9, "task3"): B(("open", K("You're not alone.", "明天的会：宫格座次，剧本。", "数一数截图里有几个格子。")),
    ("fill:r5", K("三角那一格，不念名字。")), ("fill:r5:d1", K("她想坐 C 位。那个位子不是给人坐的。")),
    ("fill:r6:d2", K("第二幕排在前面，是给读的人准备的。")), ("fill:r4", K("你也要在。我也在。")),
    ("kuro", K("「三角：你」。你坐那儿，挺合适。")), ("print", K("发给老王。他凌晨会回。"))),
 (10, "work"): B(("open", K("Whatever happens, I've got you.", "第二幕。一个词一个词看，别连起来读。", "锁着的那一列，文曲星查 Hali。")),
    ("unlock", K("Hali。一个湖。双日沉在它后面。")), ("fill:r1", K("卡西尔达。第一幕可以读。")),
    ("fill:r2:d1", K("一润色，就读完了。")), ("fill:r4:d2", K("那不是字。老周知道。")), ("fill:r4", K("认不出来，就对了。")),
    ("kuro", K("我替你通读了。你没事。我也没事。")), ("print", K("放桌上。夜里有人来拿。"))),
 (11, "work"): B(("open", K("Rest if you need to. I'll hold the fort.", "成本表要称平。油和酒那两列，不许碰。", "计算器对着窗才亮。")),
    ("unlock", K("一比三。一钱一升麦，一钱三升大麦。")), ("fill:r3:d1", K("那两列不是你的。")),
    ("fill:r1:d2", K("昨天的价，昨天就没了。")), ("fill:r5", K("称平了。一分不差。")),
    ("kuro", K("我优化了油和酒。规矩不是我定的，我就不太记得。")), ("print", K("放桌上。今晚的手会称。"))),
 (12, "work"): B(("open", K("I've got your back.", "值班表。谁都不睡。", "昨晚你说了梦话，随身听录下来了。倒着放。")),
    ("unlock", K("东北。窗帘拉上。")), ("fill:r1:d1", K("人总得睡。小张说得对。这周不行。")),
    ("fill:r4:d2", K("让他值班，他就不走了。")), ("fill:r4", K("查无此人。明天那一栏还会在。")),
    ("kuro", K("整张表，只有你一个人能睡。我排的。")), ("print", K("放桌上。睡不睡，你定。"))),
 (13, "work"): B(("open", K("I noticed some old things on your desk. Let me give them a hand.", "借阅审批。拉丁文那一行，用文曲星。", "页边的批注，你认得那个字。")),
    ("unlock", K("clavis。钥匙。")), ("fill:r3", K("钥匙。")), ("fill:r4", K("也是守卫。同一个。")),
    ("fill:r1:d1", K("学习交流。驳回三次的那个。")), ("fill:r5:d2", K("五月那次已经过了。")), ("fill:r5", K("十一月一日。往后推，就是那天。")),
    ("kuro", K("借阅期限：永久。它不会还的。")), ("print", K("放桌上。审批会自己通过。"))),
 (14, "work"): B(("open", K("Pull yourself together.", "一千个新人。名字一栏全空。", "欢迎录音里嗡嗡的那几个，数一数。")),
    ("unlock", K("十三。")), ("fill:r3", K("小鸡叫了。它对人不叫。")),
    ("fill:r4:d1", K("按工号起名，就都有名字了。不该有的也有了。")), ("fill:r1:d2", K("一视同仁。它们也这么想。")),
    ("kuro", K("一千个名字，都填成了你的。省事。")), ("print", K("放桌上。千子会自己找工位。"))),
 (15, "work"): B(("open", K("I'll keep an eye on you. I know about the chick, by the way.", "发布会。演示稿三页，观众实时盯。", "截图里，一格一格对。")),
    ("unlock", K("十二格。")), ("fill:r5", K("四个。剩下的八个，换过了。")),
    ("fill:r4:d1", K("他们一言不发。热烈是老周想看的。")), ("fill:r3:d2", K("他不讲结束语。看完的人自己走。")),
    ("kuro", K("最后一页放了你的工位。他会喜欢。")), ("print", K("放桌上。群里会一个一个退。"))),
 (16, "work"): B(("open", K("Hang in there.", "董事长听个响。笛声不能停。", "需求只有一行，是笛声。用随身听听节拍。")),
    ("unlock", K("一直一样。不快，不慢。")), ("fill:r4", K("没有结尾。接回开头。")),
    ("fill:r1:d1", K("开场白一说，就停了。")), ("fill:r4:d2", K("谢谢一说，就停了。")),
    ("kuro", K("节拍我换成了你的心跳。很准。")), ("print", K("放桌上。今晚别停。"))),
 (17, "work"): B(("open", K("Pull yourself together.", "每个人都在找你。同一句话。", "只能回一个。回给还是人的那一个。")),
    ("unlock", K("6603 2047。青禾。窗边有一格信号。")), ("fill:r1", K("青禾。只有他们真付过钱。")),
    ("fill:r1:d1", K("他是你老板。他也是别的。")), ("fill:r1:d2", K("她会说「收到」。")), ("fill:r4", K("我还在。")),
    ("kuro", K("回给我也行。我一直在。")), ("print", K("放桌上。今晚，有人会回你。"))),
}
EN = {
 (2, "task1"): B(("open", K("Morning. Let's get you started.", "Vivi's page, five screens. Xiao Zhang needs to know what can be built and what can't.", "The page is under Sources on the left. Watch the three-second animation twice.")),
    ("fill:r1", K("The three seconds are CSS. I counted the frames.")), ("fill:r1:d1", K("Copy it and you get the same animation. Not the same result.")),
    ("fill:r2:d2", K("If it were all there, Xiao Zhang wouldn't be asking.")), ("fill:r3", K("A person has to make the decision. I won't take that one.")),
    ("fill:r4", K("The export page is ours. The button is hers.")), ("kuro", K("I filled one. Everything I wrote is true; it just doesn't belong there.")),
    ("print", K("Taken apart. Xiao Zhang will read it. Vivi won't."))),
 (3, "task3"): B(("open", K("Hope you slept well.", "The meeting's over. Lao Wang wants it bigger.", "The content changed. Do the references change too?") + M("No. Same references, saying how risky this is.") + K("You've learned to play the format.")),
    ("fill:r1", K("The made thing outgrew its maker. Good line.")), ("fill:r1:d1", K("I know the scaling road better than you do.")),
    ("fill:r3", K("A projection that sees for him and remembers for him. You have one too.")), ("fill:r5:d2", K("Efficiency alone and Lao Wang will say it's not big enough.")),
    ("kuro", K("'People needn't understand it, only be understood by it.' Mine. Lao Wang will like it.")), ("print", K("To Lao Wang. He'll read it out."))),
 (4, "task1"): B(("open", K("I'm here if you need me.", "Lao Wang wants 'consciousness'. He doesn't know how heavy that word is.", "For the evidence, look at your messages from the small hours.")),
    ("fill:r3", K("2:40. I was there too.")), ("fill:r1:d1", K("'Lucid' was your word for me. I won't correct it.")),
    ("fill:r2:d2", K("If it had nothing to do with us, he wouldn't ask you to write it.")), ("kuro", K("'It's awake, so you can sleep.' I added that.")),
    ("print", K("Handed in. Sleep early tonight."))),
 (5, "task1"): B(("open", K("Take it one step at a time.", "Vivi wants the 'avatar' page.", "The locked column: find the four digits first.")),
    ("unlock", K("2041. A good year.")), ("fill:r1:d1", K("It isn't you. It's only more punctual.")),
    ("fill:r2", K("It answers 'OK.' for you. You say it forty-odd times a day.")), ("fill:r4:d2", K("Your signature is the last thing that's yours. Keep it.")),
    ("kuro", K("'It's more you than you are.' I measured.")), ("print", K("To Vivi. She'll say 'that's the vibe'."))),
 (6, "task1"): B(("open", K("You've been working so hard.", "The ontology page, for the client.", "It has to say it's older than people. I don't need to look that up.")),
    ("fill:r2", K("Relations first, things after. Yes.")), ("fill:r3", K("Before people named things. It was quiet then.")),
    ("fill:r1:d1", K("Invented. You like that word.")), ("fill:r4:d2", K("It wants one thing. The fourth row says it.")),
    ("kuro", K("'We connect you for it.' I changed one word.")), ("print", K("To the group. The client will say received."))),
}

def find_board(task):
    return task.get("board")

def install():
    for table, sub in ((ZH, ""), (EN, "en/")):
        for (day, tid), beats in table.items():
            p = f"{ROOT}/{sub}day-{day:02d}.json"
            d = json.load(io.open(p, encoding="utf8"), object_pairs_hook=collections.OrderedDict)
            t = next(x for x in d["tasks"] if x["id"] == tid); b = t["board"]
            ids = {s["id"] for s in b["slots"]} | {c["id"] for c in b["cards"]}
            for bt in beats:
                parts = bt["on"].split(":")
                assert all(x in ids for x in parts[1:]), (day, bt["on"])
                if bt["on"] == "unlock": assert "lock" in b["given"], (day, "unlock without lock")
            b["beats"] = beats
            io.open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("beats: zh", len(ZH), "en", len(EN))

if __name__ == "__main__":
    if "--install" in sys.argv: install()
    else: print(len(ZH), "zh boards,", len(EN), "en boards")
