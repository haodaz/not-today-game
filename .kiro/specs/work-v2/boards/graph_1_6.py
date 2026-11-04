# The day graphs for days 1–6 (script/notes/图谱-第1-3天.md + the 4–6 route) as content edits:
# messages moved / added / removed, files' days, day 3's meeting, the after-messages on sent_<id>.
# Run after the day-graph engine lands, together with build.py --install.  python3 graph_1_6.py
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

r = {n: load(f"replies/day-{n:02d}.json") for n in range(1, 7)}

# ——— day 1: 事情 A in his voice note; Vivi's first page arrives; Xiao Zhang's graph ———
for it in inc(r[1], "boss"):
    if it["text"].startswith("（转文字）") and "事情" not in it["text"] and "技术讲清楚" not in it["text"]:
        it["text"] = it["text"].replace("你让它先合一版，你看一眼就行，别自己从头弄。", "你让它先合一版，你看一眼就行，别自己从头弄。你把我们的技术给他们讲清楚：技术表达、技术价值、AI 在我们这儿用出了什么特色。")
vivi1 = take(r[4], "group", lambda x: x["text"].startswith("Vivi：") or (x["t"] in ("10:05",) and x["text"].startswith("member：")))
for x in vivi1: add(r[1], "group", [x])
add(r[1], "group", [{"t": "10:04", "text": "Vivi：@技术 照着搞一个", "kind": "work"}])
add(r[1], "xiaozhang", [{"t": "09:41", "text": "图谱那边二百多个节点，我昨天刚跟你对完。", "kind": "work"}])

# ——— day 2: he does not answer you; Vivi's second page; Xiao Zhang complains ———
take(r[2], "boss", lambda x: x["t"] == "09:12")
lunch = take(r[2], "boss", lambda x: "中午我请" in x["text"])
for x in lunch: add(r[2], "group", [{"t": x["t"], "text": "老板：" + x["text"], "kind": "private"}])
vivi2 = take(r[6], "group", lambda x: x["text"].startswith("Vivi：") or x["t"] in ("09:44", "09:45"))
for x in vivi2: add(r[2], "group", [x])
add(r[2], "group", [{"t": "09:43", "text": "Vivi：@技术 这个也搞一下", "kind": "work"}])
add(r[2], "xiaozhang", [
    {"t": "10:20", "text": "{calledBy}，Vivi 又发了一个，让我们照着做", "kind": "work"},
    {"t": "10:21", "text": "这根本不是一个东西，她连接口都没有", "kind": "work"},
    {"t": "10:22", "text": "你帮我看看哪些能做吧", "kind": "work"},
    {"t": "10:23", "text": "图谱里行业和数据是有的，组织那块我们压根没碰", "kind": "work"},
    {"t": "15:00", "text": "谢了{calledBy}。", "kind": "work", "cond_show": sent("d2-vivi-page")},
])

# ——— day 3: the meeting; Xiao Zhang on emergence ———
add(r[3], "xiaozhang", [{"t": "16:40", "text": "我是真觉得涌现那条路不对，咱们这点数据，堆不出来的", "kind": "work"}])
d3 = load("days/day-03.json")
items = d3["items"]
t3 = next((i for i in items if i["id"] == "task3"), None)
if t3 is not None:
    items.remove(t3)
    for i in items:
        if i.get("unlock") == "done:task3": i["unlock"] = "done:task2"
    d3["call"] = {"at": "15:30", "length": "1:00:00",
        "lines": [{"who": "boss", "t": "00:00"}, {"who": "boss", "t": "00:03"}, {"who": "boss", "t": "00:06"}, {"who": "boss", "t": "00:09"}, {"who": "boss", "t": "00:12"},
                  {"who": "me", "t": "00:32"}, {"who": "me", "t": "00:45"}, {"who": "me", "t": "01:00"}],
        "task": {"id": "task3", "text": "会上说的：把 AI 理论往大里讲。", "unlock": "start", "done": "flag:task_d3_3", "required": True, "when": "night"}}
save("days/day-03.json", d3)

# ——— day 4: his 02:40 line (only after day 3's theory was sent); consciousness; the videos; Lao Zhou ———
add(r[4], "boss", [{"t": "02:40", "text": "辛苦了，好好休息。", "kind": "odd", "cond_show": sent("d3-theory")}])
for it in inc(r[4], "boss"):
    if it["text"].startswith("（转文字）") and "合一份" in it["text"]:
        it["text"] = "（转文字）AI 有没有意识，我们要先说。那家公司讲本体，我们讲意识，高一层。你把意识那一节加进去。"
add(r[4], "group", [
    {"t": "09:30", "text": "老板：[视频] 三千八百亿美元的底层系统", "kind": "work", "card": {"type": "video", "account": "科技商业观察", "title": "美国这家公司的本体：三千八百亿美元的底层系统，这条视频一次给你讲透", "duration": "08:12"}},
    {"t": "09:31", "text": "老板：那家讲本体，我们讲意识，高一层", "kind": "work"},
])
add(r[4], "laozhou", [{"t": "12:30", "text": "你昨天两点四十还亮着灯", "kind": "private"}])

# ——— day 5: the PRD comes in the morning; Vivi gives you the 分身 page and a code; Lao Zhou ———
for it in inc(r[5], "group"):
    if it["t"] in ("21:47", "21:48", "21:52"): it["t"] = {"21:47": "09:50", "21:48": "09:51", "21:52": "09:52"}[it["t"]]
inc(r[5], "group").sort(key=lambda x: x["t"])
add(r[5], "partner", [
    {"t": "10:00", "text": "分身那一页你来写", "kind": "work"},
    {"t": "10:00", "text": "附图在共享盘，提取码 2041", "kind": "work"},
    {"t": "16:00", "text": "第 3 行字号不一样，统一一下", "kind": "work", "cond_show": sent("d5-avatar")},
])
add(r[5], "group", [{"t": "11:00", "text": "老周：上周你说的那个，我都忘了，它倒记得", "kind": "private"}])

# ——— day 6: someone else's BP; the client asks what it wants; your page goes on as his ———
add(r[6], "boss", [
    {"t": "09:30", "text": "[文件] 别人家的 BP", "kind": "work", "card": {"type": "file", "name": "某某科技_商业计划书.pdf", "size": "6.9 MB", "ext": "pdf"}},
    {"t": "09:30", "text": "你看下这个，先有关系后有东西，他们讲得挺好", "kind": "work"},
    {"t": "09:32", "text": "[语音] 12″", "kind": "work"},
    {"t": "09:32", "text": "（转文字）甲方要一页本体，写它比人古老。人给东西起名字之前，关系就在那儿了。", "kind": "work"},
])
add(r[6], "group", [
    {"t": "10:10", "text": "甲方：它的需求是什么？总得被连上吧", "kind": "work"},
    {"t": "17:00", "text": "老板：[转发] 本体是什么（给甲方）", "kind": "work", "forwarded": True, "cond_show": sent("d6-ontology")},
])
for n in range(1, 7): save(f"replies/day-{n:02d}.json", r[n])

# ——— files: Vivi's pages and export.js are there on the days they now arrive ———
f = load("files.json")
for fo in f["folders"]:
    for x in fo["files"]:
        if x["id"] == "d-vivi-plan1": x["from"] = 1
        if x["id"] == "d-vivi-plan2": x["from"] = 2
        if x["id"] == "e-export-fn": x["from"] = 2; x.pop("afterFlag", None)
save("files.json", f)

# ——— the meeting's words (day 3) ———
ZH = {"call.l.3.0": "你这个太保守了。", "call.l.3.1": "方向对了，就往大里讲，越大越好。", "call.l.3.2": "讲人的投射。",
      "call.l.3.3": "讲在数字空间里穿梭。", "call.l.3.4": "要让投资人觉得只有我们能做。",
      "call.l.3.5": "他讲了二十分钟他在会上怎么说的。", "call.l.3.6": "他没提事情 A。", "call.l.3.7": "他没提钱。"}
EN = {"call.l.3.0": "This is too timid.", "call.l.3.1": "If the direction is right, make it big. The bigger the better.", "call.l.3.2": "Talk about people projecting themselves.",
      "call.l.3.3": "Talk about moving through digital space.", "call.l.3.4": "Investors should feel only we can do this.",
      "call.l.3.5": "He spends twenty minutes on what he said in the meeting.", "call.l.3.6": "He doesn't mention Thing A.", "call.l.3.7": "He doesn't mention money."}
for lang, T in (("zh", ZH), ("en", EN)):
    s = load(f"strings/{lang}.json")
    for k, v in T.items(): s.setdefault(k, v)
    save(f"strings/{lang}.json", s)
print("graph 1–6 applied")
