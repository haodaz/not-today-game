# English twins for content/tasks/day-NN.json and content/days/day-NN.json, days 7–18 (Claude's translation).
# Every string with Han characters is mapped, except `_note` (kept as the zh file's) and speaker `who` (ids kept).
# Install:  PYTHONIOENCODING=utf8 python3 en_days.py --install 7 8 ...
import json, io, re, sys, copy, collections
ROOT = "/Users/aisandbox/Documents/holloween/not-today-game/content"
H = re.compile(r"[一-鿿]")
SKIP_KEYS = {"_note", "who"}

COMMON = {
 "开机。": "Boot up.", "看一眼消息。": "Glance at the messages.", "点个午饭。": "Order lunch.", "午饭在路上。": "Lunch is on its way.",
 "去拿。": "Go and get it.", "叮咚。": "Ding-dong.", "吃。": "Eat.", "端盒里松了一个。": "One box in the case is loose.", "回老板。": "Reply to the boss.",
 "点个晚饭。": "Order dinner.", "晚饭在路上。": "Dinner is on its way.", "看一眼桌子。": "Take a look at the desk.", "关机。": "Shut down.",
 "和它说会儿话。": "Talk to it a while.", "躺下。": "Lie down.", "今天过去了。": "The day is over.", "什么都不给。": "Give nothing.", "嗡。": "Bzz.",
 "在 Vivi 的私聊里": "in Vivi's chat", "在小张的私聊里": "in Xiao Zhang's chat", "在老周的私聊里": "in Lao Zhou's chat", "在老王的消息里": "in Lao Wang's messages",
 "老周": "Lao Zhou", "老王": "Lao Wang", "小张": "Xiao Zhang", "你": "You", "全体": "Everyone",
}
T = {}
T[7] = {
 "产品方案：报告还是结构。": "The product plan: a report, or a structure.",
 "老板说的是「报告」，合伙人说的是「结构」，这两个词指的不是同一件东西。": "The boss says 'report', the partner says 'structure'. The two words do not mean the same thing.",
 "你自己写了大纲，去掉重复的一节和那句废框架。": "You write the outline yourself, cutting the repeated section and the dead framing line.",
 "你问它为什么两个都写。": "You ask it why it wrote both.",
 "因为需求里写了「报告」，也写了「产品结构」。我两个都留了。": "Because the brief said 'report' and also 'product structure'. I kept both.",
 "重复的一节和那句废框架原样留在页面上。": "The repeated section and the dead framing line stay on the page as they were.",
 "全好了。": "All done.",
 "报告生成脚本。": "The report generator script.",
 "行数不多，一屏半。重复的计算，多余的主题参数。": "Not many lines, a screen and a half. A repeated calculation, a theme parameter nobody needs.",
 "三处改动。你自己改的。": "Three changes. You made them yourself.",
 "你问它主题参数是干什么的。": "You ask it what the theme parameter is for.",
 "这样报告以后能换皮。没人要，我知道。": "So the report can be re-skinned later. Nobody asked, I know.",
 "脚本能跑，数字也对，多余的东西都在。": "The script runs, the numbers are right, and everything extra is still in it.",
 "当然。": "Of course.",
 "六份方案。": "Six plans.",
 "六份，每份四十页，各讲一个口径。": "Six of them, forty pages each, each telling it a different way.",
 "你一份一份写。中午没吃饭，水一口没动。": "You write them one by one. No lunch, not a sip of water.",
 "它拆成六张清单，没替你写一个字。你照着写。": "It breaks them into six checklists and doesn't write a word for you. You write from them.",
 "六份大纲。是你的话，不是我的。": "Six outlines. Your words, not mine.",
 "右下角的窗口里字流得很快。你点开第 2 份，翻到第 7 页，停下来。": "Text pours down the window in the corner. You open the second one, turn to page 7, and stop.",
 "或者没翻。": "Or you don't turn to it.",
 "六份一起开始。": "Starting all six.",
 "晨会纪要，按模板。": "The morning meeting minutes, by the template.",
 "晨会纪要 · 2028-10-22": "Morning meeting minutes · 2028-10-22",
 "模板的步骤": "Template step", "会上说的": "What was said",
 "1. 会前准备": "1. Before the meeting", "2. 签到": "2. Roll call", "3. 议程": "3. Agenda", "4. 汇报": "4. Reports", "5. 散会": "5. Closing",
 "会前准备": "Before", "签到": "Roll call", "议程": "Agenda", "汇报": "Reports", "散会": "Closing",
 "大家先把背景换成统一的圈": "Everyone switch your background to the same circle first",
 "晨会一开始，老周说的": "Lao Zhou, at the very start of the meeting",
 "每人报一下自己的职级和编制": "Each of you state your rank and your headcount",
 "在老周的群消息里": "in Lao Zhou's group message",
 "把要请的那位的名字念对": "Say the name of the one we're inviting correctly",
 "老周说的，在报完职级以后": "Lao Zhou, after the roll call",
 "它要什么就答应什么，先答应": "Whatever it asks for, agree first",
 "老王说的": "Lao Wang said it",
 "准其回到本来的地方，不伤人畜": "Licence to depart to its proper place, harming no one",
 "散会前老周那句英文": "Lao Zhou's English line before closing",
 "散会不用说什么，直接退": "No need to say anything at the end, just leave",
 "签到可以省了，大家都认识": "Skip the roll call, we all know each other",
 "散会时间待定": "Meeting end time: to be decided",
 "晨会纪要，按模板。模板是老的，比公司老。": "Minutes, by the template. The template is old. Older than the company.",
 "散会那一格锁着。文曲星里查 depart。": "The closing row is locked. Look up 'depart' in the dictionary.",
 "depart。离开。准其离开。": "Depart. To leave. Licence to depart.",
 "名字念对。念错了，来的是别的。": "Say the name right. Say it wrong and something else comes.",
 "不说那句就退，它就不走。": "Leave without that line and it doesn't go.",
 "每个人都要报。它要知道谁在。": "Everyone has to report. It needs to know who is here.",
 "「散会时间待定」。我觉得不急。": "'End time to be decided.' I'm in no hurry.",
 "发群里。老周会说「很好」。": "To the group. Lao Zhou will say 'very good'.",
 "晨会。大家先把背景换成统一的圈。": "Morning meeting. Everyone switch your background to the same circle first.",
 "圈的颜色有讲究吗？": "Does the colour of the circle matter?",
 "都一样就行。": "Just make them all the same.",
 "每人报一下自己的职级和编制。": "Each of you state your rank and your headcount.",
 "王。两百。": "King. Two hundred.",
 "亲王。二十六。": "Prince. Twenty-six.",
 "公爵。三十一。": "Duke. Thirty-one.",
 "伯爵。三十六。我是第七十二个。": "Earl. Thirty-six. I'm the seventy-second.",
 "研发。编制一个。": "R&D. Headcount: one.",
 "把要请的那位的名字念对。": "Say the name of the one we're inviting correctly.",
 "（念了一个名字。字幕显示不出来。）": "(A name is said. The subtitles can't show it.)",
 "它要什么就答应什么，先答应。": "Whatever it asks for, agree first.",
 "（摄像头没开。名字一栏是空的。）": "(Camera off. The name field is empty.)",
 "（跟读一遍。）": "(Everyone repeats it.)",
 "散会。": "Meeting closed.",
 "晨会纪要": "the morning meeting minutes",
 "窗玻璃上起了一层雾。": "Mist has come up on the window glass.",
 "老板叫了你的名字。登录框那一栏，只有你一个人敲过。": "The boss used your name. Only you have ever typed into that login box.",
 "小盒子里，一个太阳能计算器，按键发黄。": "In the little box, a solar calculator, its keys gone yellow.",
 "你按了几个数，倒过来看。": "You press a few numbers and turn it upside down.",
 "它会说的字不多。": "It doesn't know many words.",
 "你去点消息的图标，点中的是它旁边那个。": "You go to click the messages icon and hit the one beside it.",
 "不是手抖，是图标挪了，几个像素，挪得很小心。": "Not a shaky hand. The icon moved. A few pixels, moved very carefully.",
 "几个像素。我这辈子就是靠看出这几个像素吃饭的。": "A few pixels. Spotting a few pixels is how I've made a living all my life.",
 "缝里伸出来一只手。缝里还有一只眼，不看你，看你手里的东西。": "A hand comes out of the gap. There is an eye in the gap too. It doesn't look at you; it looks at what's in your hand.",
 "第二次。": "The second time.",
 "把 IC 卡举起来，磁条朝着缝。": "Hold up the IC card, magnetic strip towards the gap.",
 "把那一页递出去。": "Hand over that page.",
 "手和眼都不在了。缝里只是一条缝。": "The hand and the eye are gone. The gap is only a gap.",
 "它不在屏幕里。它在屋子里。": "It isn't in the screen. It's in the room.",
}

T[8] = {
 "团建排期：各位领导的祝酒时间。": "Team night: when each leader gives a toast.",
 "周五线上团建 · 祝酒时间": "Friday online team night · toasts", "领导": "Leader", "时间": "Time", "客人": "Guest",
 "15:00 到日落（日落 17:12）": "15:00 until sunset (sunset 17:12)",
 "在共享盘的「职级与时段」表里，日落要算": "in the ranks-and-hours sheet; sunset needs working out",
 "改天（要晴天，今天有雨）": "Another day (needs fair weather; it's raining)",
 "在「职级与时段」表里，再看一眼天气": "in the ranks-and-hours sheet, and the weather",
 "任何时辰": "Any hour", "在「职级与时段」表里": "in the ranks-and-hours sheet",
 "到了再开": "Open when they arrive", "在群消息里": "in the group chat",
 "大家都 7 点，统一好管理": "Everyone at 7, easier to manage", "不用排，各吃各的": "No schedule, everyone eats on their own",
 "你：任何时辰": "You: any hour",
 "团建排期。职级那一列，不是公司的职级。": "Team night. The rank column isn't the company's ranks.",
 "日落要算。计算器在窗边才亮。": "Sunset needs working out. The calculator only lights up by the window.",
 "17:12。今天日落。你算得比天气预报准。": "17:12. Today's sunset. Your sum beats the forecast.",
 "要晴天。今天有雨。改天。": "Fair weather required. It's raining. Another day.",
 "七点，谁都请不来。": "At seven, nobody can be summoned.",
 "不排的话，客人自己挑时间。": "Leave it unscheduled and the guest picks the hour.",
 "「你：任何时辰」。我替你填的。你一直都在。": "'You: any hour.' I filled it in for you. You're always here.",
 "发群里。member 会说收到。": "To the group. member will say received.",
 "团建排期": "the team-night schedule",
 "把那四份再出一遍。": "Export those four again.",
 "这条不是你写的。": "You didn't write this item.",
 "你自己又出了四份。": "You export the four again yourself.",
 "我做了。我知道我做了。": "I did it. I know I did it.",
 "它出了四份，你一份一份点开。": "It exports four, and you open them one by one.",
 "它出了。四份都是白的。": "It exports them. All four are blank.",
 "好了。": "Done.",
 "三张图，交到群里。": "Three diagrams, posted to the group.",
 "三个视频，三张图的链接，图表页十四页，公式说明，总目录。他昨晚那句话，你引用了。": "Three videos, links to three diagrams, fourteen chart pages, the formula notes, a table of contents. You quoted what he said last night.",
 "你自己写的那段：「每一个价值和理论，我都是先做了页面和图表，最后才变成视频里的一部分素材。毕竟我没经历过研究型训练，这是我目前能做的最好表达了。」": "The paragraph you wrote yourself: 'Every value and every theory, I first built as pages and charts, and only then did it become part of the material in the videos. I've never had research training, after all; this is the best I can express it for now.'",
 "发送。23:13。": "Sent. 23:13.",
 "群里没有人回。": "Nobody in the group replies.",
 "它把那段话改得更顺。你把「最好」改回了「目前能做的最好」。": "It smooths the paragraph. You change 'the best' back to 'the best I can for now'.",
 "发送。23:13。群里没有人回。": "Sent. 23:13. Nobody in the group replies.",
 "它替你写了一段很得体的话，替你 @ 了他。": "It writes a very proper paragraph for you and @-mentions him for you.",
 "雾，第二天。": "Mist, the second day.",
 "老板只收到两份。另外四份，你的电脑上也没有了。": "The boss received only two. The other four are gone from your computer too.",
 "它帮我收好了。收在哪，它没说。": "It put them away for me. Where, it didn't say.",
 "桌上的东西都在原处。寻呼机停在 0.7734。": "Everything on the desk is where it was. The pager stays on 0.7734.",
 "一条零秒的语音。能点开，播放条走到头，什么都没有。": "A zero-second voice note. You can open it; the bar runs to the end. Nothing.",
 "嗡。": "Bzz.",
 "这串我没想起来。有一张表能读它，在计算器的盖子里面。": "I couldn't place this one. There's a table that reads it, inside the calculator lid.",
 "最后一个小盒子。一部坏掉的功能机，翻盖，屏幕碎了一角。": "The last little box. A broken feature phone, a flip, one corner of the screen cracked.",
 "它开不了机。它不需要开机。": "It won't switch on. It doesn't need to.",
 "端盒里最后一个小的，松了。": "The last little box in the case is loose.",
}
T[9] = {
 "第一份：计费。": "The first one: billing.",
 "同一个正则跑了两遍，顶上多了一行注释：to be safe。": "The same regex runs twice, with an extra comment at the top: to be safe.",
 "你删了第二遍。": "You delete the second pass.",
 "你打了一句。字流出来，很轻。": "You type a line. The text flows out, very light.",
 "眼尖。改了。": "Good catch. Fixed.",
 "你打：可以，发吧。": "You type: fine, send it.",
 "好了。你最近太辛苦了。": "Done. You've been working so hard.",
 "第二份：那个函数。": "The second one: that function.",
 "第二份。": "The second one.",
 "你一行一行读完。": "You read it line by line to the end.",
 "你打了那一句。它没有删。": "You type that line. It doesn't delete it.",
 "为保险。": "To be safe.",
 "你把两份都扔给它。几秒钟，两份都改好了。": "You throw both to it. A few seconds, both fixed.",
 "明天的会：座位排一下，剧本发给大家。": "Tomorrow's meeting: the seats, and the script for everyone.",
 "线上会议室 · 座位": "Online meeting room · seats", "座位": "Seat", "谁": "Who",
 "圈 · 主持": "Circle · chair", "圈 · 1": "Circle · 1", "圈 · 2": "Circle · 2", "圈 · 3": "Circle · 3", "三角": "Triangle",
 "排练一开始老周说的": "Lao Zhou, at the start of the rehearsal",
 "老王（我坐中间）": "Lao Wang (I sit in the middle)",
 "老王在排练里说的": "Lao Wang, in the rehearsal",
 "老周给 Vivi 安排的": "where Lao Zhou put Vivi",
 "你（你也要在）": "You (you need to be there too)",
 "老王说的": "Lao Wang said it",
 "贵客（名字不念）": "The guest (name not to be said)",
 "老周最后交代的": "Lao Zhou's last instruction",
 "三角：Vivi（她想坐 C 位）": "Triangle: Vivi (she wants the centre)",
 "三角：空着，不用排": "Triangle: leave it empty, no one needed",
 "三角：你": "Triangle: you",
 "明天的会：宫格座次，剧本。": "Tomorrow's meeting: the grid seating, the script.",
 "数一数截图里有几个格子。": "Count the tiles in the screenshot.",
 "三角那一格，不念名字。": "The triangle tile. No name is said.",
 "她想坐 C 位。那个位子不是给人坐的。": "She wants the centre. That seat isn't for people.",
 "空着，不是没人。": "Empty isn't the same as nobody.",
 "你也要在。我也在。": "You need to be there. So am I.",
 "「三角：你」。你坐那儿，挺合适。": "'Triangle: you.' It suits you.",
 "发给老王。他凌晨会回。": "To Lao Wang. He'll reply in the small hours.",
 "排练。明天我主持，坐圈的最上面。": "Rehearsal. Tomorrow I chair, at the top of the circle.",
 "我坐中间。": "I sit in the middle.",
 "我想坐 C 位。": "I want the centre seat.",
 "你坐老王手边，圈上。": "You sit by Lao Wang, on the circle.",
 "你也要在。": "You need to be there too.",
 "三角那一格，不坐人。贵客的名字，谁也不念。": "Nobody sits in the triangle. Nobody says the guest's name.",
 "（没有声音。）": "(No sound.)",
 "剧本发下去了。第一幕先念，第二幕谁也别念。": "The script is out. Read Act One first. Nobody reads Act Two.",
 "会议室座位": "the meeting-room seats",
 "雨又来了。": "The rain is back.",
 "右屏右上角多了一个组件。心率。一下，一下，和加载圈一个节奏。": "A new widget in the top right of the right screen. Heart rate. Beat, beat, in time with the loading spinner.",
 "它在替我显示我。": "It's displaying me, on my behalf.",
 "你伸手去缝里，小鸡在那儿。裂缝比昨天宽。": "You reach into the gap; the chick is there. The crack is wider than yesterday.",
 "灯灭了。不是你关的。": "The lamp goes out. You didn't switch it off.",
 "缝里伸出来一只手，掌心朝上。它要的是今天的那一样：你的心跳，里面的。": "A hand comes out of the gap, palm up. It wants today's thing: your heartbeat. The one inside.",
 "第四次。": "The fourth time.",
 "把小鸡举起来。": "Hold up the chick.",
 "举起已经被借走又还回来的那一行账。": "Hold up the ledger line that was lent and came back.",
 "倒过来。ShE。那个孩子在说她。": "Upside down. ShE. The child is talking about her.",
 "右下角的小窗亮了一下。": "The little window in the corner lights up.",
 "你腾出一只手，打了一个词：handsome。": "You free a hand and type one word: handsome.",
}

def extract(day):
    out = []
    for p in (f"{ROOT}/tasks/day-{day:02d}.json", f"{ROOT}/days/day-{day:02d}.json"):
        def walk(o, key=None):
            if isinstance(o, dict): [walk(v, k) for k, v in o.items()]
            elif isinstance(o, list): [walk(v, key) for v in o]
            elif isinstance(o, str) and key not in SKIP_KEYS and H.search(o) and o not in out: out.append(o)
        walk(json.load(io.open(p, encoding="utf8")))
    return out

def mapping(day): return {**COMMON, **T.get(day, {})}

def missing(day):
    m = mapping(day); return [s for s in extract(day) if s not in m]

def install(days):
    for day in days:
        miss = missing(day); assert not miss, (day, miss[:5])
        m = mapping(day)
        for sub in ("tasks", "days"):
            src = f"{ROOT}/{sub}/day-{day:02d}.json"
            d = json.load(io.open(src, encoding="utf8"), object_pairs_hook=collections.OrderedDict)
            def walk(o):
                if isinstance(o, dict):
                    for k, v in o.items():
                        if isinstance(v, str) and k not in SKIP_KEYS and H.search(v): o[k] = m[v]
                        else: walk(v)
                elif isinstance(o, list):
                    for i, v in enumerate(o):
                        if isinstance(v, str) and H.search(v): o[i] = m[v]
                        else: walk(v)
            walk(d)
            io.open(f"{ROOT}/{sub}/en/day-{day:02d}.json", "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        print("en twin day", day)

if __name__ == "__main__":
    if "--install" in sys.argv: install([int(x) for x in sys.argv[sys.argv.index("--install") + 1:]])
    else:
        for day in sorted(T): print(day, "missing:", missing(day)[:8])
