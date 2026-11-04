# Days 10–17: one new main job a day (the god's work), from the researched graphs
# script/notes/图谱-第10-12天.md and 图谱-第13-17天.md (2026-11-03 night, checked against the originals),
# with the author's later rulings: 小张 is #72 Andromalius from day 7; day 17's last human is 青禾物流's
# contact; Kuro speaks Chinese. Implementation first (author 2026-11-04): table boards, sources limited to
# files / conversations, one old-object lock per board; the camera's clues ride in screenshots for now.
# The new job is ADDED as task "work" (the old tasks of those days stay: day 10 still echoes day 1).
# Deliverables go to the hand (放在桌上，夜里手来收).  Install:  PYTHONIOENCODING=utf8 python3 build_10_17.py --install
import json, io, sys, collections
BUILD = "/Users/aisandbox/Documents/holloween/not-today-game/.kiro/specs/work-v2/boards/build.py"
g = {"__name__": "helpers"}; exec(io.open(BUILD, encoding="utf8").read(), g)
board, F, C, J = g["board"], g["F"], g["C"], g["J"]
ROOT = "/Users/aisandbox/Documents/holloween/not-today-game/content"
OD = collections.OrderedDict
W = lambda t, text, **k: {"t": t, "text": text, "kind": k.pop("kind", "work"), **k}
JOBS, FILES, MSGS = {}, [], {}

# ——— day 10 · 2028-10-25 · 黄衣之王：校对第二幕，不许整行读 ———
JOBS[10] = dict(title="剧本第二幕校一下：错字改了就行，别读太细。",
    board=board("《黄衣之王》第二幕 · 校对", ["", "第二幕里露出来的词", "改成"], [
        ("r1", "人名", "卡西达", "c1"), ("r2", "湖", "哈里湖", "c2"), ("r3", "天上", "双目沉入湖后", "c3"),
        ("r4", "印记", "黄色印记的图样", "c4")],
       [("c1", "卡西尔达", F("s-script"), "在剧本第一幕里（第一幕可以读）"),
        ("c2", "哈利湖", F("s-kiy"), "在第一幕卡西尔达的歌里"),
        ("c3", "双日", F("s-kiy"), "同一首歌里"),
        ("c4", "不属于任何人类文字的那一个", F("s-kiy-cover"), "在封面扫描件里，扣子上那个")],
       [("d1", "整行改通顺", C("partner"), "在 Vivi 的私聊里"), ("d2", "印记：中文的「黄」字", C("laozhou"), "在老周的私聊里")],
       "r4", "（已为你通读全文并润色）",
       lock={"object": "dictionary", "codes": ["Hali", "Hari", "Hail"], "answer": "Hali"}),
    deliverable={"id": "d10-act2", "label": "第二幕（校对稿）"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "s-kiy", "name": "黄衣之王.docx", "date": "2028-10-25", "from": 10,
    "body": {"text": ["第一幕", "卡西尔达（唱）：", "云浪在岸边碎开，", "双日沉入湖后，", "影子拉长", "在卡尔克萨。", "……", "哈利湖上起了雾。",
                      "第二幕", "████████ 卡西达 ████████████", "██████ 哈里湖 ████████", "████ 双目沉入湖后 ██████"]},
    "onOpen": {"k": "inner", "t": "你不记得自己下过这个文件。第二幕整段是黑的，只露出几个词。"}}),
  ("downloads", {"id": "s-kiy-cover", "name": "黄衣之王_封面.png", "date": "2028-10-25", "from": 10,
    "body": {"text": ["（扫描件）封面右下角，一枚黑玛瑙扣子，金色镶着一个符号。", "不是阿拉伯文，也不是中文。"]},
    "onOpen": {"k": "inner", "t": "你认不出这是什么字。也许它不是字。"}}),
]
MSGS[10] = {
  "boss": [W("09:00", "她到了。", kind="odd"), W("09:01", "（转文字）剧本第二幕你校一下，别读太细，错字改了就行。")],
  "group": [W("09:05", "老周：晨会。大家把虚拟背景关一下。"), W("09:07", "老周：还有一位，您该关一下背景了。"),
            W("09:07", "member：我没有背景。", kind="odd"), W("11:20", "member：你找到黄色印记了吗", kind="odd"),
            W("14:02", "member：你找到黄色印记了吗", kind="odd"), W("17:45", "member：你找到黄色印记了吗", kind="odd")],
  "partner": [W("10:15", "第二幕顺手润色一下，读着通顺点。")],
  "laozhou": [W("10:40", "印记就是个「黄」字，你写上就行。", kind="private")],
  "xiaozhang": [W("09:30", "{calledBy}，你今天别打开那个剧本。", kind="private")],
}

# ——— day 11 · 10-26 · 拿天平的那位（启示录 6:5–6）：成本表称平 ———
JOBS[11] = dict(title="降本增效：成本表称平，下班前给 Vivi。",
    board=board("成本表 · 称平", ["", "成本项", "单价"], [
        ("r1", "麦子", "麦子", "c1"), ("r2", "大麦", "大麦", "c2"), ("r3", "油", "油", "c3"), ("r4", "酒", "酒", "c4"), ("r5", "合计", "合计", "c5")],
       [("c1", "一钱一升", F("t-menu-1026"), "在今天的外卖价目截图里"),
        ("c2", "一钱三升", C("laozhou"), "在老周的私聊里"),
        ("c3", "不动（原价）", C("partner"), "在 Vivi 的私聊里：那两列别碰"),
        ("c4", "不动（原价）", C("partner"), "同上"),
        ("c5", "正好称平，一分不差", C("boss"), "在老王的语音里")],
       [("d1", "油、酒各降 10%", F("t-cut"), "在共享盘的降本增效模板里"), ("d2", "麦子按昨天的价", F("e-receivable"), "在第 1 天那张应收表里")],
       "r3", "油、酒各降 10%（已优化）",
       lock={"object": "calculator", "codes": ["1 : 3", "3 : 1", "1 : 1"], "answer": "1 : 3"}),
    deliverable={"id": "d11-scale", "label": "成本表（称平）"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "t-menu-1026", "name": "外卖_今日价目.png", "date": "2028-10-26", "from": 11,
    "body": {"text": ["（截图）今天所有菜都标「一钱」。", "能点的只剩一样：麦子。", "一钱一升。"]},
    "onOpen": {"k": "inner", "t": "一天的工钱，只够一个人一天的麦子。"}}),
  ("downloads", {"id": "t-cut", "name": "降本增效模板.xlsx", "date": "2028-10-26", "from": 11,
    "body": {"text": ["每项成本统一下调 10%", "油：-10%", "酒：-10%", "（来源：共享盘 · 模板）"]},
    "onOpen": {"k": "inner", "t": "模板不知道哪两列不许碰。"}}),
]
MSGS[11] = {
  "partner": [W("09:30", "降本增效，下班前给我一版。"), W("09:31", "油和酒那两列别碰，那是董事会的。")],
  "boss": [W("09:40", "（转文字）成本要称平，一分不能差。")],
  "laozhou": [W("11:50", "黄焖鸡没了，我给你留了一份大麦饭。大麦一钱三升，划算。", kind="private")],
}

# ——— day 12 · 10-27 · 修普诺斯：一张谁都不许睡的值班表 ———
JOBS[12] = dict(title="这周大家克服一下：值班表你排，谁都不睡。",
    board=board("值班表 · 这一周", ["", "时段", "谁醒着"], [
        ("r1", "22:00–02:00", "22:00–02:00", "c1"), ("r2", "02:00–04:00", "02:00–04:00", "c2"),
        ("r3", "04:00–06:00", "04:00–06:00", "c3"), ("r4", "ΥΠΝΟΣ", "ΥΠΝΟΣ", "c4")],
       [("c1", "所有人", C("boss"), "在老王的语音里"),
        ("c2", "所有人，朝东北的窗帘拉上", F("a-sleeptalk"), "昨晚的梦话录音，倒着放"),
        ("c3", "所有人（凌晨三点还在「收到」）", C("group"), "看群消息的时间"),
        ("c4", "删掉：查无此人", F("c-contacts"), "在通讯录导出里；打过去是忙音")],
       [("d1", "轮班，每人睡四小时", C("xiaozhang"), "在小张的私聊里"), ("d2", "ΥΠΝΟΣ：值 02:00–04:00", C("partner"), "在 Vivi 的私聊里")],
       "r1", "你：休息",
       lock={"object": "tape", "codes": ["东北", "西南", "正北"], "answer": "东北"}),
    deliverable={"id": "d12-watch", "label": "值班表"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "a-sleeptalk", "name": "梦话_1026.m4a", "date": "2028-10-27", "from": 12,
    "body": {"text": ["（录音，凌晨 03:12）", "……（听不清）……", "倒着放：「……东北……帘子……拉上……」"]},
    "onOpen": {"k": "inner", "t": "你不记得自己开过录音。"}}),
  ("downloads", {"id": "c-contacts", "name": "通讯录_导出.csv", "date": "2028-10-27", "from": 12,
    "body": {"text": ["老王 · 老周 · Vivi · 小张 · ……", "ΥΠΝΟΣ（头像：一尊白色胸像）", "备注：谁都说不认识。"]},
    "onOpen": {"k": "inner", "t": "用功能机打过去，是忙音。忙音里有人在用你的声音说话。"}}),
]
MSGS[12] = {
  "boss": [W("09:00", "（转文字）这周大家克服一下，先不睡。值班表你排。")],
  "group": [W("03:00", "member：收到", kind="odd"), W("03:01", "member：收到", kind="odd"), W("03:02", "member：收到", kind="odd"),
            W("10:30", "老周：通讯录里那个 ΥΠΝΟΣ 是谁？没这个人。")],
  "xiaozhang": [W("10:32", "这谁？"), W("10:40", "轮班吧，每人睡四个小时，人总得睡。")],
  "partner": [W("11:00", "ΥΠΝΟΣ 是新人吧，让他值两点到四点，多锻炼。")],
}

# ——— day 13 · 10-28 · 犹格·索托斯（《敦威治恐怖》）：借阅审批 + 第 751 页 ———
JOBS[13] = dict(title="走个借阅审批：别问为什么借。",
    board=board("借阅审批 · 《死灵之书》拉丁文本", ["", "审批单", "填"], [
        ("r1", "书", "借哪本", "c1"), ("r2", "页", "要对哪一页", "c2"), ("r3", "第一行", "这一页第一行", "c3"),
        ("r4", "第二行", "这一页第二行", "c4"), ("r5", "日子", "门开的那一天", "c5")],
       [("c1", "奥劳斯·沃米乌斯的拉丁文本", F("n-scan"), "在扫描件的页眉里"),
        ("c2", "第 751 页（迪伊英译本缺的那一页）", F("n-scan"), "在扫描件的页边批注里"),
        ("c3", "犹格·索托斯是门的钥匙", F("n-scan"), "拉丁文那一行，用文曲星查"),
        ("c4", "也是门的守卫", F("n-scan"), "同一行的后半句"),
        ("c5", "11 月 1 日", F("n-scan"), "页脚：五朔节前夜与万圣节，往后推")],
       [("d1", "借阅理由：学习交流", C("partner"), "在 Vivi 的私聊里"), ("d2", "门开的日子：5 月 1 日", C("laozhou"), "在老周的私聊里")],
       "r1", "借阅期限：永久",
       lock={"object": "dictionary", "codes": ["key", "gate", "guard"], "answer": "key"}),
    deliverable={"id": "d13-loan", "label": "借阅审批"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "n-scan", "name": "拉丁文本_p751.pdf", "date": "2028-10-28", "from": 13,
    "body": {"text": ["（扫描件）奥劳斯·沃米乌斯拉丁文本 · 第 751 页", "Yog-Sothoth … clavis … et custos portae …（看不全）",
                      "页边批注：迪伊英译本此页残缺。", "页脚：仪式于五朔节前夜，及万圣节。"]},
    "onOpen": {"k": "inner", "t": "这一页你应该没见过。可页边的批注是你的字。"}}),
]
MSGS[13] = {
  "partner": [W("09:20", "走个借阅审批，别问为什么借。"), W("09:21", "理由就写学习交流。")],
  "laozhou": [W("10:05", "门开的日子写 5 月 1 日，好记。", kind="private")],
  "group": [W("11:00", "审批助手：借阅申请 · 已驳回", kind="odd"), W("13:00", "审批助手：借阅申请 · 已驳回", kind="odd"),
            W("15:00", "审批助手：借阅申请 · 已驳回", kind="odd"),
            W("18:00", "审批助手：借阅申请 · 已通过（审批人：无）", kind="odd", cond_show={"has": "sent_d13-loan"})],
}

# ——— day 14 · 10-29 · 莎布·尼古拉斯（「黑山羊，携千子」）：一千个新人入职 ———
JOBS[14] = dict(title="这批新人有点多，入职流程跑一下。",
    board=board("新员工入职 · 第一批（1000 人）", ["", "名单里的", "怎么办"], [
        ("r1", "会说话的", "会说话的那些", "c1"), ("r2", "嗡嗡的", "录音里嗡嗡的那几个", "c2"),
        ("r3", "小鸡叫的", "小鸡一看就叫的那几行", "c3"), ("r4", "名字", "名字一栏", "c4")],
       [("c1", "排工位，名字各起各的", F("h-roster"), "在新员工名单里"),
        ("c2", "不排工位，单独列出来", F("a-welcome"), "在入职欢迎录音里，用随身听听"),
        ("c3", "不是人，不排", F("h-roster"), "拿小鸡看一眼名单"),
        ("c4", "一个一个起，不许重", C("laozhou"), "在老周的私聊里")],
       [("d1", "全部按工号自动命名", C("partner"), "在 Vivi 的私聊里"), ("d2", "全部排工位，一视同仁", C("boss"), "在老王的消息里")],
       "r4", "一千个人，名字都填成了你的",
       lock={"object": "tape", "codes": ["7", "13", "31"], "answer": "13"}),
    deliverable={"id": "d14-onboard", "label": "入职名单"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "h-roster", "name": "新员工名单_1000.xlsx", "date": "2028-10-29", "from": 14,
    "body": {"text": ["0001（空）", "0002（空）", "……", "共 1000 行，名字一栏全空。", "有几行的照片，是一团黑。"]},
    "onOpen": {"k": "inner", "t": "小鸡在屏幕上停了一下，叫了一声。"}}),
  ("downloads", {"id": "a-welcome", "name": "入职欢迎录音.m4a", "date": "2028-10-29", "from": 14,
    "body": {"text": ["（录音）「欢迎……」", "人声和一种嗡嗡声轮着来。", "嗡嗡声里有一句，听着像：黑山羊，携千子。"]},
    "onOpen": {"k": "inner", "t": "数一数，嗡嗡的有十三个。"}}),
]
MSGS[14] = {
  "boss": [W("09:10", "这批新人有点多，入职流程跑一下。"), W("09:11", "全部排工位，一视同仁。")],
  "partner": [W("09:40", "全按工号自动命名吧，省事。")],
  "laozhou": [W("10:20", "名字别重，重了叫不应。", kind="private")],
  "group": [W("09:30", "member：欢迎新同事"), W("09:30", "member：欢迎新同事"), W("09:30", "member：欢迎新同事", kind="odd")],
}

# ——— day 15 · 10-30 · 奈亚拉托提普，第一张脸（《奈亚拉托提普》）：发布会 ———
JOBS[15] = dict(title="下午发布会：演示稿你排一下，观众反应实时盯着。",
    board=board("发布会 · 演示稿", ["", "顺序", "放什么"], [
        ("r1", "第 1 页", "第 1 页", "c1"), ("r2", "第 2 页", "第 2 页", "c2"), ("r3", "第 3 页", "第 3 页", "c3"),
        ("r4", "观众", "观众反应", "c4"), ("r5", "还剩", "还剩几个原来的", "c5")],
       [("c1", "仪器：玻璃和金属的", F("p-deck"), "在演示稿里"),
        ("c2", "讲电，讲心理学", F("p-deck"), "在演示稿里"),
        ("c3", "放映：火花，头发竖起来", F("p-deck"), "在演示稿里"),
        ("c4", "一言不发", F("m-shot-1030"), "在发布会截图里"),
        ("c5", "四个", F("m-shot-1030"), "在发布会截图里，一格一格对")],
       [("d1", "观众反应：热烈", C("laozhou"), "在老周的私聊里"), ("d2", "第 3 页：结束语", C("partner"), "在 Vivi 的私聊里")],
       "r3", "最后一页：你的工位照片",
       lock={"object": "calculator", "codes": ["12", "8", "4"], "answer": "12"}),
    deliverable={"id": "d15-launch", "label": "发布会演示稿"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "p-deck", "name": "发布会演示稿.pptx", "date": "2028-10-30", "from": 15,
    "body": {"text": ["主讲：一位从埃及来的先生", "· 玻璃和金属的仪器", "· 电，心理学", "· 放映：火花让观众的头发竖起来", "（没有结束语）"]},
    "onOpen": {"k": "inner", "t": "十月底，外面二十八度。"}}),
  ("downloads", {"id": "m-shot-1030", "name": "发布会截图.png", "date": "2028-10-30", "from": 15,
    "body": {"text": ["（截图）宫格里十二张脸，都看着同一个方向。", "一言不发。", "你一格一格对：原来的，只剩四个。"]},
    "onOpen": {"k": "inner", "t": "十二格。你认得的，四个。"}}),
]
MSGS[15] = {
  "laozhou": [W("09:30", "下午有个发布会，演示稿你排一下，观众的反应你实时盯一下。", kind="private"), W("09:31", "反应就写热烈。", kind="private")],
  "partner": [W("10:00", "第 3 页放结束语，收得漂亮点。")],
  "group": [W("12:00", "member：十月底二十八度，正常吗"),
            W("17:01", "member 已退出群聊", kind="odd", cond_show={"has": "sent_d15-launch"}),
            W("17:02", "member 已退出群聊", kind="odd", cond_show={"has": "sent_d15-launch"}),
            W("17:03", "member 已退出群聊", kind="odd", cond_show={"has": "sent_d15-launch"})],
}

# ——— day 16 · 10-31 · 阿撒托斯：一条不能断的汇报 ———
JOBS[16] = dict(title="董事长不看材料，听个响就行。别停。",
    board=board("汇报录音 · 剪辑", ["", "段落", "放哪条"], [
        ("r1", "开头", "开头", "c1"), ("r2", "中间", "中间", "c2"), ("r3", "节拍", "节拍", "c3"), ("r4", "结尾", "结尾", "c4")],
       [("c1", "老王 09:00 那条语音", C("boss"), "在老王的消息里"),
        ("c2", "群里的语音，一条接一条", C("group"), "在群里"),
        ("c3", "跟着笛声，一拍一条", F("a-flute"), "在需求录音里，用随身听听"),
        ("c4", "没有结尾，接回开头", F("a-flute"), "在需求录音里：笛声不停")],
       [("d1", "加个开场白", C("partner"), "在 Vivi 的私聊里"), ("d2", "最后说一句谢谢大家", C("laozhou"), "在老周的私聊里")],
       "r3", "节拍：换成你的心跳",
       lock={"object": "tape", "codes": ["一直一样", "越来越快", "忽快忽慢"], "answer": "一直一样"}),
    deliverable={"id": "d16-drone", "label": "汇报录音"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "a-flute", "name": "需求.m4a", "date": "2028-10-31", "from": 16,
    "body": {"text": ["（长笛声）", "需求文档只有这一行。", "笛声一直一样：不快，不慢，不停。"]},
    "onOpen": {"k": "inner", "t": "听久了，鼓也在里面。"}}),
]
MSGS[16] = {
  "boss": [W("09:00", "（转文字）董事长不看材料，听个响就行。别停。")],
  "partner": [W("10:10", "加个开场白吧，显得正式。")],
  "laozhou": [W("10:30", "结尾说一句谢谢大家。", kind="private")],
}

# ——— day 17 · 11-01 · 奈亚拉托提普，第二张脸：只回给还是真人的那一个 ———
JOBS[17] = dict(title="每个人都在找你：回一下。只能回一个。",
    board=board("回信 · 只能回一个", ["", "回信", "填"], [
        ("r1", "回给", "回给谁", "c1"), ("r2", "为什么是他", "怎么认出来的", "c2"), ("r3", "电话", "打过来的号码", "c3"), ("r4", "回什么", "回什么", "c4")],
       [("c1", "青禾物流的对接人", F("e-receivable"), "在应收表里：唯一真到账的那家"),
        ("c2", "钱是真的付了", F("e-receivable"), "在应收表里"),
        ("c3", "第一次打来，没接", F("call-log"), "在来电记录里"),
        ("c4", "我还在。", F("call-log"), "在来电记录的留言里")],
       [("d1", "回给老王（他是你老板）", C("boss"), "在老王的消息里"), ("d2", "回给 Vivi", C("partner"), "在 Vivi 的私聊里")],
       "r1", "回给克总",
       lock={"object": "phone", "codes": ["6603 2047", "6603 2048", "6630 2047"], "answer": "6603 2047"}),
    deliverable={"id": "d17-reply", "label": "回信"}, judge=J(0, -3, -6))
FILES += [
  ("downloads", {"id": "call-log", "name": "来电记录.txt", "date": "2028-11-01", "from": 17,
    "body": {"text": ["11-01 08:57  6603 2047  青禾物流  未接", "留言：「您好，是青禾的。之前那笔款，您那边收到了吗？您还在吗？」"]},
    "onOpen": {"k": "inner", "t": "以前只在应收表里见过这个名字。第一次打来。"}}),
]
MSGS[17] = {w: [W("09:0" + str(i), "回一下我，我是谁你应该知道。", kind="odd")] for i, w in enumerate(["boss", "partner", "group", "laozhou"])}

def load(p): return json.load(io.open(p, encoding="utf8"), object_pairs_hook=OD)
def save(p, d): io.open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")

def install():
    for day, job in JOBS.items():
        tid, flag = "work", f"task_d{day}_work"
        tp = f"{ROOT}/tasks/day-{day:02d}.json"; t = load(tp)
        t["tasks"] = [x for x in t["tasks"] if x["id"] != tid]
        t["tasks"].insert(0, OD([("id", tid), ("title", job["title"]), ("app", "code"), ("done", flag),
                                 ("board", job["board"]), ("deliverable", job["deliverable"]), ("judge", job["judge"])]))
        save(tp, t)
        dp = f"{ROOT}/days/day-{day:02d}.json"; d = load(dp)
        d["items"] = [x for x in d["items"] if x["id"] != tid]
        at = next(i for i, x in enumerate(d["items"]) if x["id"] == "msgs") + 1
        d["items"].insert(at, OD([("id", tid), ("text", job["title"]), ("unlock", "done:msgs"), ("done", f"flag:{flag}"), ("required", True)]))
        save(dp, d)
    fp = f"{ROOT}/files.json"; fj = load(fp)
    for folder, f in FILES:
        fo = next(x for x in fj["folders"] if x["id"] == folder)
        fo["files"] = [x for x in fo["files"] if x["id"] != f["id"]] + [f]
    save(fp, fj)
    for day, by in MSGS.items():
        rp = f"{ROOT}/replies/day-{day:02d}.json"; r = load(rp)
        for who, items in by.items():
            lst = r["recipients"][who].setdefault("incoming", [])
            for it in items:
                if not any(x["t"] == it["t"] and x["text"] == it["text"] for x in lst): lst.append(it)
            lst.sort(key=lambda x: x["t"])
        save(rp, r)
    print("days 10–17: jobs", len(JOBS), "files", len(FILES))

if __name__ == "__main__":
    if "--install" in sys.argv: install()
    else: print({d: [s["id"] for s in j["board"]["slots"]] for d, j in JOBS.items()})
