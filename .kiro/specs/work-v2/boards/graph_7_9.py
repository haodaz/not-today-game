# The day graphs for days 7–9 (script/notes/图谱-第7-9天.md, author-approved 2026-11-04) as message edits.
# Run with build_7_9.py --install, after Kiro's run.  PYTHONIOENCODING=utf8 python3 graph_7_9.py
# Not touched: content/kid.json (the pager is the child's channel); the 009 200 / 003 026 / 002 031 pages wait for a Kiro slot for foreign pages.
# 009 200 / 003 026 / 002 031 pages are left out; the calculator lock carries day 8 for now.
import json, io, collections
R = "/Users/aisandbox/Documents/holloween/not-today-game/content"
def load(p): return json.load(io.open(f"{R}/{p}", encoding="utf8"), object_pairs_hook=collections.OrderedDict)
def save(p, d): io.open(f"{R}/{p}", "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
def inc(d, who): return d["recipients"][who].setdefault("incoming", [])
def add(d, who, items):
    lst = inc(d, who)
    for it in items:
        if not any(x["t"] == it["t"] and x["text"] == it["text"] for x in lst): lst.append(it)
    lst.sort(key=lambda x: x["t"])
def take(d, who, pred):
    lst = inc(d, who); out = [x for x in lst if pred(x)]; d["recipients"][who]["incoming"] = [x for x in lst if not pred(x)]; return out
def sent(i): return {"has": f"sent_{i}"}
W = lambda t, text, **k: {"t": t, "text": text, "kind": k.pop("kind", "work"), **k}

r = {n: load(f"replies/day-{n:02d}.json") for n in (7, 8, 9, 10)}

# ——— day 7: 老周的晨会（拜蒙 / 瓦沙克 / 阿加雷斯；小张今天被换了：第 72 位 安托玛琉斯）———
for it in inc(r[7], "boss"):
    if it["t"] == "09:05" and it["text"].startswith("（转文字）"):
        it["text"] = "（转文字）{bossCalls}，周会以后改晨会，每天九点，老周主持。纪要你整理，按模板。"
take(r[7], "boss", lambda x: "提取码 0414" in x["text"])
take(r[7], "group", lambda x: x["t"] >= "21:41")                       # 三千八百亿那一串：已在第 4 天
take(r[7], "group", lambda x: x["text"] == "老周：方案我以前写过一版，在共享盘")   # 私聊里有同一句
add(r[7], "group", [W("09:00", "老周：晨会，九点，线上。大家先把背景换成统一的圈。"), W("09:02", "老周：每人报一下自己的职级和编制。"),
                    W("09:21", "老周：散会。"), W("09:40", "老周：纪要按模板来，别自由发挥。"),
                    W("16:10", "老周：很好，明天照这个开。", cond_show=sent("d7-minutes"))])
add(r[7], "partner", [W("10:05", "纪要里我那句放前面。"), W("10:06", "散会那段可以不要，直接退就行。")])
add(r[7], "xiaozhang", [W("09:50", "签到可以省了吧，大家都认识。"), W("15:00", "晨会你听清了吗？大家说的是一句话。", kind="private"), W("15:01", "我也说了。", kind="odd")])

# ——— day 8: 东西自己没了；线上团建 ———
add(r[8], "group", [W("10:00", "member：周五线上团建，各位领导的祝酒按职级排时间，表在共享盘。"),
                    W("10:01", "member：十三份外卖，一份不要筷子，客人到了再开。"),
                    W("16:30", "member：收到", cond_show=sent("d8-toasts"))])
add(r[8], "laozhou", [W("11:51", "丢了的东西我能找，你等我晚上。", kind="private")])
add(r[8], "partner", [W("11:00", "大家都 7 点吧，统一好管理。")])
add(r[8], "xiaozhang", [W("11:10", "不用排吧，各吃各的。")])

# ——— day 9: 老王往返；明天有贵客 ———
add(r[9], "boss", [W("09:35", "明天有贵客，线上会议室你布置一下：宫格的座次不能乱，背景统一，散会要有仪式感。")])
take(r[9], "boss", lambda x: x["t"] in ("18:35", "18:36"))           # 别人的 BP：已在第 6 天
add(r[9], "boss", [W("18:35", "宫格座次你排一下，剧本发给大家排练。"), W("18:36", "你也要在。我坐中间。")])
add(r[10], "boss", [W("02:10", "很好。明天她到。", kind="odd", cond_show=sent("d9-seats"))])   # 凌晨，算第 10 天
add(r[9], "laozhou", [W("10:10", "明天我主持。", kind="private"), W("21:00", "你那四份我找着了，在你桌上。", kind="private")])
add(r[9], "partner", [W("14:00", "明天我想坐 C 位。")])

for n, d in r.items(): save(f"replies/day-{n:02d}.json", d)
print("graph 7–9 applied")
