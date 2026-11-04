# Days 7, 9 and 15 move to the meeting view (meeting spec, Kiro 2026-11-04). zh only (en twins stop at day 6).
# Day 7: 老周's morning meeting (the rank/legion roll call matches day 8's pager pages).
# Day 9: tomorrow's seating, settled line by line in tonight's rehearsal; the script row goes (seats only).
# Day 15: the launch; one presenter with no name, twelve silent tiles.
# Run:  PYTHONIOENCODING=utf8 python3 build_meetings.py
import json, io, collections
ROOT = "/Users/aisandbox/Documents/holloween/not-today-game/content"
OD = collections.OrderedDict
def load(p): return json.load(io.open(p, encoding="utf8"), object_pairs_hook=OD)
def save(p, d): io.open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
P = lambda i, n, tile=None: OD([("id", i), ("name", n)] + ([("tile", tile)] if tile else []))
L = lambda t, who, text, card=None: OD([("t", t), ("who", who), ("text", text)] + ([("card", card)] if card else []))
M = {"meeting": True}

def board_of(day, tid):
    p = f"{ROOT}/tasks/day-{day:02d}.json"; d = load(p)
    t = next(x for x in d["tasks"] if x["id"] == tid); return p, d, t["board"]

# ——— day 7 ———
p, d, b = board_of(7, "task4")
for c in b["cards"]:
    if c["id"] in ("c1", "c3", "c4", "c5"): c["from"] = M
hints = {"c1": "晨会一开始，老周说的", "c3": "老周说的，在报完职级以后", "c4": "老王说的", "c5": "散会前老周那句英文"}
for c in b["cards"]:
    if c["id"] in hints: c["hint"] = hints[c["id"]]
b["view"] = "meeting"
b["meeting"] = OD([
  ("people", [P("laozhou", "老周", "/npc/laozhou.png"), P("boss", "老王", "/npc/boss.png"), P("partner", "Vivi", "/npc/partner.png"),
              P("xiaozhang", "小张", "/npc/xiaozhang.png"), P("me", "你"), P("m1", "member", "/npc/sil_1.png"), P("m2", "member", "/npc/sil_2.png"),
              P("all", "全体")]),
  ("lines", [
    L("09:00", "laozhou", "晨会。大家先把背景换成统一的圈。", "c1"),
    L("09:01", "partner", "圈的颜色有讲究吗？"),
    L("09:01", "laozhou", "都一样就行。"),
    L("09:02", "laozhou", "每人报一下自己的职级和编制。"),
    L("09:03", "boss", "王。两百。"),
    L("09:03", "laozhou", "亲王。二十六。"),
    L("09:04", "partner", "公爵。三十一。"),
    L("09:04", "xiaozhang", "伯爵。三十六。我是第七十二个。"),
    L("09:05", "me", "研发。编制一个。"),
    L("09:05", "laozhou", "把要请的那位的名字念对。", "c3"),
    L("09:07", "all", "（念了一个名字。字幕显示不出来。）"),
    L("09:09", "boss", "它要什么就答应什么，先答应。", "c4"),
    L("09:12", "m1", "（摄像头没开。名字一栏是空的。）"),
    L("09:18", "laozhou", "I do here licence thee to depart unto thy proper place, without doing any injury or danger to any man or beast.", "c5"),
    L("09:19", "all", "（跟读一遍。）"),
    L("09:21", "laozhou", "散会。")]),
  ("layout", "grid")])
save(p, d)

# ——— day 9 ———
p, d, b = board_of(9, "task3")
b["slots"] = [s for s in b["slots"] if s["id"] != "r6"]
b["given"]["rows"].pop("r6", None)
b["cards"] = [c for c in b["cards"] if c["id"] not in ("c6", "d2")]
b["cards"].append(OD([("id", "d2"), ("text", "三角：空着，不用排"), ("from", {"conv": "xiaozhang"}), ("hint", "在小张的私聊里")]))
b["kuro"]["fill"].pop("r6", None)
for c in b["cards"]:
    if c["id"] in ("c1", "c2", "c3", "c4", "c5"): c["from"] = M
hints = {"c1": "排练一开始老周说的", "c2": "老王在排练里说的", "c3": "老周给 Vivi 安排的", "c4": "老王说的", "c5": "老周最后交代的"}
for c in b["cards"]:
    if c["id"] in hints: c["hint"] = hints[c["id"]]
if "beats" in b:
    for bt in b["beats"]:
        if bt["on"] == "fill:r6:d2": bt["on"] = "fill:r5:d2"; bt["lines"] = [{"who": "kuro", "text": "空着，不是没人。"}]
b["view"] = "meeting"
b["meeting"] = OD([
  ("people", [P("laozhou", "老周", "/npc/laozhou.png"), P("boss", "老王", "/npc/boss.png"), P("partner", "Vivi", "/npc/partner.png"),
              P("me", "你"), P("guest", "　")]),
  ("lines", [
    L("20:00", "laozhou", "排练。明天我主持，坐圈的最上面。", "c1"),
    L("20:01", "boss", "我坐中间。", "c2"),
    L("20:02", "partner", "我想坐 C 位。"),
    L("20:02", "laozhou", "你坐老王手边，圈上。", "c3"),
    L("20:03", "boss", "你也要在。", "c4"),
    L("20:04", "laozhou", "三角那一格，不坐人。贵客的名字，谁也不念。", "c5"),
    L("20:05", "guest", "（没有声音。）"),
    L("20:06", "laozhou", "剧本发下去了。第一幕先念，第二幕谁也别念。")]),
  ("layout", "seats"),
  ("seats", OD([("r1", "circle"), ("r2", "circle"), ("r3", "circle"), ("r4", "circle"), ("r5", "triangle")]))])
save(p, d)
r = load(f"{ROOT}/replies/day-09.json")
lst = r["recipients"]["xiaozhang"].setdefault("incoming", [])
it = OD([("t", "19:40"), ("text", "三角那格空着就行，不用排人吧。"), ("kind", "work")])
if not any(x["t"] == it["t"] and x["text"] == it["text"] for x in lst): lst.append(it); lst.sort(key=lambda x: x["t"])
save(f"{ROOT}/replies/day-09.json", r)

# ——— day 15 ———
p, d, b = board_of(15, "work")
for c in b["cards"]:
    if c["id"] in ("c1", "c2", "c3", "c4"): c["from"] = M
hints = {"c1": "主讲人一上来说的", "c2": "主讲人说的", "c3": "放映那一段", "c4": "观众那几格"}
for c in b["cards"]:
    if c["id"] in hints: c["hint"] = hints[c["id"]]
b["view"] = "meeting"
aud = [P(f"a{i}", "观众", f"/npc/sil_{(i - 1) % 6 + 1}.png") for i in range(1, 9)]
b["meeting"] = OD([
  ("people", [P("laozhou", "老周", "/npc/laozhou.png"), P("host", "主讲")] + aud),
  ("lines", [
    L("15:00", "laozhou", "发布会开始。有请主讲。"),
    L("15:01", "host", "我从很远的地方来。带了几件仪器，玻璃的，金属的。", "c1"),
    L("15:04", "host", "今天讲电。也讲心理学。", "c2"),
    L("15:09", "host", "请看。", ),
    L("15:09", "a1", "（火花。前排的头发竖了起来。）", "c3"),
    L("15:20", "a3", "（一言不发。）", "c4"),
    L("15:21", "a6", "（一言不发。）"),
    L("15:30", "laozhou", "感谢主讲。散会。"),
    L("15:31", "a2", "（没有人离开。）")]),
  ("layout", "grid")])
save(p, d)
print("meetings: days 7, 9, 15")
