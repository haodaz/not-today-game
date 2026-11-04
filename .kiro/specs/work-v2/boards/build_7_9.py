# Days 7–9 boards (script/notes/图谱-第7-9天.md, author-approved 2026-11-04), same helpers as build.py.
# First pass, implementation first: table view (the meeting view comes later), sources limited to what
# exists or is added here (two docs and one sheet). Install after Kiro's run:  python3 build_7_9.py --install
import json, io, sys, os
BUILD = "/Users/aisandbox/Documents/holloween/not-today-game/.kiro/specs/work-v2/boards/build.py"
g = {"__name__": "helpers"}; exec(io.open(BUILD, encoding="utf8").read(), g)
board, F, C, J = g["board"], g["F"], g["C"], g["J"]
B, EN = {}, {}

# ——— day 7: 老周的晨会 → 纪要按模板（召唤的顺序，每一格都是会议用语）——— replaces task4 (对比表)
B[(7, "task4")] = dict(title="晨会纪要，按模板。",
    board=board("晨会纪要 · 2028-10-22", ["", "模板的步骤", "会上说的"], [
        ("r1", "会前准备", "1. 会前准备", "c1"), ("r2", "签到", "2. 签到", "c2"), ("r3", "议程", "3. 议程", "c3"),
        ("r4", "汇报", "4. 汇报", "c4"), ("r5", "散会", "5. 散会", "c5"),
    ], [("c1", "大家先把背景换成统一的圈", F("m-subs-1022"), "在晨会字幕里"),
        ("c2", "每人报一下自己的职级和编制", C("group"), "在老周的群消息里"),
        ("c3", "把要请的那位的名字念对", F("m-subs-1022"), "在晨会字幕里"),
        ("c4", "它要什么就答应什么，先答应", F("m-subs-1022"), "在晨会字幕里"),
        ("c5", "准其回到本来的地方，不伤人畜", F("m-subs-1022"), "老周最后那句英文，在晨会字幕里")],
       [("d1", "散会不用说什么，直接退", C("partner"), "在 Vivi 的私聊里"), ("d2", "签到可以省了，大家都认识", C("xiaozhang"), "在小张的私聊里")],
       "r5", "散会时间待定",
       lock={"object": "dictionary", "codes": ["depart", "remain", "return"], "answer": "depart"}),
    deliverable={"id": "d7-minutes", "label": "晨会纪要", "to": "group"}, judge=J(0, -3, -6))
EN[(7, "task4")] = dict(title="The morning meeting minutes, by the template.",
    board=board("Morning meeting minutes · 2028-10-22", ["", "Template step", "What was said"], [
        ("r1", "Before", "1. Before the meeting", "c1"), ("r2", "Roll call", "2. Roll call", "c2"), ("r3", "Agenda", "3. Agenda", "c3"),
        ("r4", "Reports", "4. Reports", "c4"), ("r5", "Closing", "5. Closing", "c5"),
    ], [("c1", "Everyone switch your background to the same circle first", F("m-subs-1022"), "in the meeting subtitles"),
        ("c2", "Each of you state your rank and your headcount", C("group"), "in Lao Zhou's group message"),
        ("c3", "Say the name of the one we're inviting correctly", F("m-subs-1022"), "in the meeting subtitles"),
        ("c4", "Whatever it asks for, agree first", F("m-subs-1022"), "in the meeting subtitles"),
        ("c5", "Licence to depart to its proper place, harming no one", F("m-subs-1022"), "Lao Zhou's last English line, in the subtitles")],
       [("d1", "No need to say anything at the end, just leave", C("partner"), "in Vivi's chat"), ("d2", "Skip the roll call, we all know each other", C("xiaozhang"), "in Xiao Zhang's chat")],
       "r5", "Meeting end time: to be decided",
       lock={"object": "dictionary", "codes": ["depart", "remain", "return"], "answer": "depart"}),
    deliverable={"id": "d7-minutes", "label": "the morning meeting minutes", "to": "group"}, judge=J(0, -3, -6))

# ——— day 8: 线上团建，按头衔排祝酒的时辰 ——— replaces task1 (计费模块)
B[(8, "task1")] = dict(title="团建排期：各位领导的祝酒时间。",
    board=board("周五线上团建 · 祝酒时间", ["", "领导", "时间"], [
        ("r1", "老王", "老王", "c1"), ("r2", "Vivi", "Vivi", "c2"), ("r3", "老周", "老周", "c3"), ("r4", "客人", "客人", "c4"),
    ], [("c1", "15:00 到日落（日落 17:12）", F("t-ranks"), "在共享盘的「职级与时段」表里，日落要算"),
        ("c2", "改天（要晴天，今天有雨）", F("t-ranks"), "在「职级与时段」表里，再看一眼天气"),
        ("c3", "任何时辰", F("t-ranks"), "在「职级与时段」表里"),
        ("c4", "到了再开", C("group"), "在群消息里")],
       [("d1", "大家都 7 点，统一好管理", C("partner"), "在 Vivi 的私聊里"), ("d2", "不用排，各吃各的", C("xiaozhang"), "在小张的私聊里")],
       "r4", "你：任何时辰",
       lock={"object": "calculator", "codes": ["17:12", "18:05", "16:40"], "answer": "17:12"}),
    deliverable={"id": "d8-toasts", "label": "团建排期", "to": "group"}, judge=J(0, -3, -6))
EN[(8, "task1")] = dict(title="Team night: when each leader gives a toast.",
    board=board("Friday online team night · toasts", ["", "Leader", "Time"], [
        ("r1", "Lao Wang", "Lao Wang", "c1"), ("r2", "Vivi", "Vivi", "c2"), ("r3", "Lao Zhou", "Lao Zhou", "c3"), ("r4", "Guest", "Guest", "c4"),
    ], [("c1", "15:00 until sunset (sunset 17:12)", F("t-ranks"), "in the ranks-and-hours sheet; sunset needs working out"),
        ("c2", "Another day (needs fair weather; it's raining)", F("t-ranks"), "in the ranks-and-hours sheet, and the weather"),
        ("c3", "Any hour", F("t-ranks"), "in the ranks-and-hours sheet"),
        ("c4", "Open when they arrive", C("group"), "in the group chat")],
       [("d1", "Everyone at 7, easier to manage", C("partner"), "in Vivi's chat"), ("d2", "No schedule, everyone eats on their own", C("xiaozhang"), "in Xiao Zhang's chat")],
       "r4", "You: any hour",
       lock={"object": "calculator", "codes": ["17:12", "18:05", "16:40"], "answer": "17:12"}),
    deliverable={"id": "d8-toasts", "label": "the team-night schedule", "to": "group"}, judge=J(0, -3, -6))

# ——— day 9: 明天的会，排座位，发剧本 ——— replaces task3 (BP 细节)
B[(9, "task3")] = dict(title="明天的会：座位排一下，剧本发给大家。",
    board=board("线上会议室 · 座位", ["", "座位", "谁"], [
        ("r1", "圈 · 主持", "圈 · 主持", "c1"), ("r2", "圈 · 1", "圈 · 1", "c2"), ("r3", "圈 · 2", "圈 · 2", "c3"),
        ("r4", "圈 · 3", "圈 · 3", "c4"), ("r5", "三角", "三角", "c5"), ("r6", "剧本", "剧本", "c6"),
    ], [("c1", "老周", C("laozhou"), "在老周的私聊里"), ("c2", "老王（我坐中间）", C("boss"), "在老王的消息里"),
        ("c3", "Vivi", C("partner"), "在 Vivi 的私聊里"), ("c4", "你（你也要在）", C("boss"), "在老王的消息里"),
        ("c5", "贵客（名字不念）", F("m-shot-1022"), "在晨会截图里，多出来的那一格"),
        ("c6", "《黄衣之王》第一幕", F("s-script"), "在剧本里：第一幕排在后面")],
       [("d1", "三角：Vivi（她想坐 C 位）", C("partner"), "在 Vivi 的私聊里"), ("d2", "剧本：第二幕", F("s-script"), "在剧本里：排在前面的那一幕")],
       "r5", "三角：你"),
    deliverable={"id": "d9-seats", "label": "会议室座位和剧本", "to": "boss"}, judge=J(0, -3, -6))
EN[(9, "task3")] = dict(title="Tomorrow's meeting: the seats, and the script for everyone.",
    board=board("Online meeting room · seats", ["", "Seat", "Who"], [
        ("r1", "Circle · chair", "Circle · chair", "c1"), ("r2", "Circle · 1", "Circle · 1", "c2"), ("r3", "Circle · 2", "Circle · 2", "c3"),
        ("r4", "Circle · 3", "Circle · 3", "c4"), ("r5", "Triangle", "Triangle", "c5"), ("r6", "Script", "Script", "c6"),
    ], [("c1", "Lao Zhou", C("laozhou"), "in Lao Zhou's chat"), ("c2", "Lao Wang (I sit in the middle)", C("boss"), "in Lao Wang's messages"),
        ("c3", "Vivi", C("partner"), "in Vivi's chat"), ("c4", "You (you need to be there too)", C("boss"), "in Lao Wang's messages"),
        ("c5", "The guest (name not to be said)", F("m-shot-1022"), "in the meeting screenshot: the extra tile"),
        ("c6", "The King in Yellow, Act One", F("s-script"), "in the script: Act One comes second")],
       [("d1", "Triangle: Vivi (she wants the centre)", C("partner"), "in Vivi's chat"), ("d2", "Script: Act Two", F("s-script"), "in the script: the act that comes first")],
       "r5", "Triangle: you"),
    deliverable={"id": "d9-seats", "label": "the seats and the script", "to": "boss"}, judge=J(0, -3, -6))

# ——— the files the cards point at ———
FILES = [
  ("downloads", {"id": "m-subs-1022", "name": "晨会字幕_20281022.txt", "date": "2028-10-22", "from": 7,
    "body": {"text": ["09:00 老周：大家先把背景换成统一的圈。", "09:02 老周：每人报一下自己的职级和编制。", "09:05 老周：把要请的那位的名字念对。",
                      "09:09 老王：它要什么就答应什么，先答应。", "09:18 老周：I do here licence thee to depart unto thy proper place without doing any injury or danger to any man or beast.",
                      "09:19 （全体跟读一遍）"]}, "onOpen": {"k": "inner", "t": "最后那句是英文。大家跟着念了一遍。"}}),
  ("downloads", {"id": "t-ranks", "name": "职级与时段.xlsx", "date": "2028-10-23", "from": 8,
    "body": {"text": ["王：09–12 点；15 点到日落", "公爵：日出到正午（须晴天）", "亲王：任何时辰", "侯爵：15–21 点；21 点到日出", "备注：日落 = 日出 06:28 + 白昼时长 10:44"]},
    "onOpen": {"k": "inner", "t": "按职级排时间。职级那一列不是公司的职级。"}}),
  ("downloads", {"id": "m-shot-1022", "name": "晨会截图_20281022.png", "date": "2028-10-23", "from": 8,
    "body": {"text": ["（截图）宫格里九个人。数一数是十个格子。", "多出来的那一格里没有人，只有一个三角。"]}, "onOpen": {"k": "inner", "t": "十个格子。会上明明是九个人。"}}),
  ("downloads", {"id": "s-script", "name": "剧本_明日会议.docx", "date": "2028-10-24", "from": 9,
    "body": {"text": ["第二幕", "（此处略）", "第一幕", "卡西尔达：……", "卡米拉：先生，您该摘下面具了。", "陌生人：我没有戴面具。"]}, "onOpen": {"k": "inner", "t": "第二幕排在第一幕前面。"}}),
]

def install():
    g["B"].clear(); g["EN"].clear(); g["B"].update(B); g["EN"].update(EN); g["install"]()
    p = "/Users/aisandbox/Documents/holloween/not-today-game/content/files.json"
    d = json.load(io.open(p, encoding="utf8"))
    for folder, f in FILES:
        fo = next(x for x in d["folders"] if x["id"] == folder)
        fo["files"] = [x for x in fo["files"] if x["id"] != f["id"]] + [f]
    io.open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("files added", len(FILES))

if __name__ == "__main__":
    if "--install" in sys.argv: install()
    else: print(json.dumps({k[0]: v["board"]["slots"] for k, v in B.items()}, ensure_ascii=False)[:400])
