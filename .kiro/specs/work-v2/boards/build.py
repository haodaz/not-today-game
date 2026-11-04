# Claude's draft boards for days 1–9 (work v2). Installed into content/tasks/day-NN.json after the
# "people take it on screen" segment lands: python3 build.py --install
import json, io, sys
J = lambda perfect, flawed, wrong, at=2: {"perfect": perfect, "flawed": flawed, "wrong": wrong, "wrongAt": at}
def board(title, cols, rows, cards, decoys, kuro_slot, kuro_text, lock=None):
    given = {"rows": {r[0]: r[2] for r in rows}}
    if lock: given["lock"] = lock
    slots = [{"id": r[0], "label": r[1], "answer": r[3]} for r in rows]
    fill = {r[0]: r[3] for r in rows}; fill[kuro_slot] = "k1"
    b = {"kind": "table", "title": title, "columns": cols, "given": given, "slots": slots,
         "cards": [card(c) for c in list(cards) + list(decoys)],
         "kuro": {"fill": fill, "cards": [{"id": "k1", "text": kuro_text}]}}
    b["kuro"]["unlock"] = lock["answer"] if lock else "-"  # the loader wants it even without a lock
    return b
def card(c):
    out = {"id": c[0], "text": c[1]}
    if len(c) > 2 and c[2]: out["from"] = c[2]
    if len(c) > 3 and c[3]: out["hint"] = c[3]
    return out
F = lambda fid: {"file": fid}
C = lambda who: {"conv": who}
CALL = {"call": True}
B = {}
EN = {}
# ——— day 1: 事情 A, from the contracts, the receivables, his own voice note, Xiao Zhang ———
B[(1, "task3")] = dict(title="事情 A：未来智能的技术表达。",
    board=board("未来智能 · 技术表达", ["", "老王要讲清楚的", "写进去"], [
        ("r1", "技术底座", "我们靠什么做事", "c1"), ("r2", "数据", "甲方的数据怎么进来", "c2"),
        ("r3", "AI 用在哪", "AI 在我们这儿干了什么", "c3"), ("r4", "特色", "跟别家比，我们有什么", "c4"),
        ("r5", "证据", "拿得出手的", "c5"),
    ], [("c1", "一个知识图谱，二百多个节点，把甲方的业务对象连起来", C("xiaozhang"), "在小张的私聊里"),
        ("c2", "三家客户的表格，每周导入一次", F("c-v17"), "在合作协议 v17 里"),
        ("c3", "AI 先合一版，人再核一遍", C("boss"), "在老王的语音里"),
        ("c4", "懂甲方的行业，图谱是一点点对出来的", F("c-merged"), "在合作协议合并版里"),
        ("c5", "两个试点客户，一个已付款", F("e-receivable"), "在应收表里")],
       [("d1", "我们拥有自研大模型", F("vivi-plan-1"), "在 Vivi 的页面里"), ("d2", "全自动，无需人工", F("vivi-plan-1"), "在 Vivi 的页面里")],
       "r5", "已服务五十家头部客户"),
    deliverable={"id": "d1-tech", "label": "技术表达（事情 A）", "to": "boss"}, judge=J(0, -2, -5))
EN[(1, "task3")] = dict(title="Thing A: Future Intelligence, the technical story.",
    board=board("Future Intelligence · the technical story", ["", "What Lao Wang wants made clear", "What goes in"], [
        ("r1", "Foundation", "What we run on", "c1"), ("r2", "Data", "How the client's data gets in", "c2"),
        ("r3", "Where AI is", "What AI does here", "c3"), ("r4", "What sets us apart", "What we have that others don't", "c4"),
        ("r5", "Proof", "Something we can show", "c5"),
    ], [("c1", "A knowledge graph, two hundred-odd nodes, joining the client's business objects", C("xiaozhang"), "in Xiao Zhang's chat"),
        ("c2", "Three clients' spreadsheets, imported weekly", F("c-v17"), "in the agreement, v17"),
        ("c3", "AI drafts a merge, a person checks it", C("boss"), "in Lao Wang's voice note"),
        ("c4", "We know the client's trade; the graph was matched by hand", F("c-merged"), "in the merged agreement"),
        ("c5", "Two pilot clients, one has paid", F("e-receivable"), "in the receivables sheet")],
       [("d1", "We have our own large model", F("vivi-plan-1"), "on Vivi's page"), ("d2", "Fully automatic, no people needed", F("vivi-plan-1"), "on Vivi's page")],
       "r5", "Serving fifty leading clients"),
    deliverable={"id": "d1-tech", "label": "the technical story (Thing A)", "to": "boss"}, judge=J(0, -2, -5))
# ——— day 2: helping Xiao Zhang with Vivi's second page ———
B[(2, "task1")] = dict(title="帮小张：Vivi 那个页面，拆一下。",
    board=board("Vivi 的页面：哪些能做", ["", "页面上写的", "实际上"], [
        ("r1", "首屏", "「三秒变成可执行的洞察」", "c1"), ("r2", "第二屏", "「自动理解你的行业、数据、组织」", "c2"),
        ("r3", "第三屏", "「一键生成决策」", "c3"), ("r4", "按钮", "「开始分析」", "c4"), ("r5", "页脚", "「已接入全部业务系统」", "c5"),
    ], [("c1", "做不了：三秒是动画，不是算出来的", F("vivi-plan-2"), "在 Vivi 的第二个页面里"),
        ("c2", "早就有了一部分：图谱里有行业和数据，没有组织", C("xiaozhang"), "在小张的私聊里"),
        ("c3", "做不了：决策得人来下", C("boss"), "在你发给老王的事情 A 里"),
        ("c4", "能做：按钮点了跳到我们的导出页", F("e-export-fn"), "在 export.js 里"),
        ("c5", "做不了：现在只接了三家的表格", F("e-receivable"), "在应收表里")],
       [("d1", "能做：照着页面写就行", F("vivi-plan-2"), "在 Vivi 的第二个页面里"), ("d2", "早就全有了", F("vivi-plan-2"), "在 Vivi 的第二个页面里")],
       "r2", "能做：交给 Kuro，三秒就好"),
    deliverable={"id": "d2-vivi-page", "label": "Vivi 页面拆解（给小张）", "to": "workbench"}, judge=J(0, -2, -5))
EN[(2, "task1")] = dict(title="Help Xiao Zhang: take Vivi's page apart.",
    board=board("Vivi's page: what can be built", ["", "What the page says", "In fact"], [
        ("r1", "Hero", "\"Insight you can act on, in three seconds\"", "c1"), ("r2", "Second screen", "\"Understands your industry, your data, your organisation\"", "c2"),
        ("r3", "Third screen", "\"Decisions in one click\"", "c3"), ("r4", "Button", "\"Start analysis\"", "c4"), ("r5", "Footer", "\"Connected to every business system\"", "c5"),
    ], [("c1", "Can't: the three seconds is an animation", F("vivi-plan-2"), "on Vivi's second page"),
        ("c2", "Partly there: the graph has industry and data, not organisation", C("xiaozhang"), "in Xiao Zhang's chat"),
        ("c3", "Can't: a person has to decide", C("boss"), "in the Thing A you sent Lao Wang"),
        ("c4", "Can do: the button goes to our export page", F("e-export-fn"), "in export.js"),
        ("c5", "Can't: only three clients' sheets are connected", F("e-receivable"), "in the receivables sheet")],
       [("d1", "Can do: just build what the page says", F("vivi-plan-2"), "on Vivi's second page"), ("d2", "Already all there", F("vivi-plan-2"), "on Vivi's second page")],
       "r2", "Can do: give it to Kuro, three seconds"),
    deliverable={"id": "d2-vivi-page", "label": "Vivi's page, taken apart (for Xiao Zhang)", "to": "workbench"}, judge=J(0, -2, -5))
# ——— day 3 (night): the AI theory, made bigger after the meeting ———
B[(3, "task3")] = dict(title="会上说的：把 AI 理论往大里讲。",
    board=board("未来智能的 AI 理论（会后版）", ["", "老王在会上要的", "你写进去的"], [
        ("r1", "出发点", "「你这个太保守了。」", "c1"), ("r2", "放大", "「方向对了，就往大里讲，越大越好。」", "c2"),
        ("r3", "人的投射", "「讲人的投射。」", "c3"), ("r4", "穿梭", "「讲在数字空间里穿梭。」", "c4"),
        ("r5", "我们的方向", "「要让投资人觉得只有我们能做。」", "c5"),
    ], [("c1", "造物已经大到造物主没法用人的量级去对应；所以我们以人脑为尺子，先把效率做对", C("boss"), "在你发给老王的事情 A 里"),
        ("c2", "效率对了，再把一个人能管住的，放大成一群人的", CALL, "在下午那通电话里"),
        ("c3", "每个人在数字空间里有一个自己的投影，替他看、替他记", CALL, "在下午那通电话里"),
        ("c4", "在数据之间穿梭：看物，看人，再从一处走到另一处", CALL, "在下午那通电话里"),
        ("c5", "不赌涌现，做人脑尺度的效率：这条路只有我们在走", C("xiaozhang"), "在小张的私聊里")],
       [("d1", "继续堆规模，等它自己涌现", F("vivi-plan-2"), "在 Vivi 的第二个页面里"), ("d2", "就讲效率，别的不讲", C("boss"), "在你发给老王的事情 A 里")],
       "r5", "人不必再理解它，只需被它理解"),
    deliverable={"id": "d3-theory", "label": "AI 理论（会后版）", "to": "boss"}, judge=J(0, -2, -5))
EN[(3, "task3")] = dict(title="What he said in the meeting: make the AI theory bigger.",
    board=board("Future Intelligence's AI theory (after the meeting)", ["", "What Lao Wang asked for", "What you write"], [
        ("r1", "Starting point", "\"This is too timid.\"", "c1"), ("r2", "Scale", "\"If the direction is right, make it big. The bigger the better.\"", "c2"),
        ("r3", "Projection", "\"Talk about people projecting themselves.\"", "c3"), ("r4", "Travel", "\"Talk about moving through digital space.\"", "c4"),
        ("r5", "Our direction", "\"Investors should feel only we can do this.\"", "c5"),
    ], [("c1", "The creature has outgrown its creator's measure; so we take the human brain as the ruler and get efficiency right first", C("boss"), "in the Thing A you sent Lao Wang"),
        ("c2", "With efficiency right, scale what one person can hold to what a crowd can", CALL, "in the afternoon call"),
        ("c3", "Everyone has a projection of themselves in digital space that sees and remembers for them", CALL, "in the afternoon call"),
        ("c4", "Move through the data: see things, see people, then go from one place to another", CALL, "in the afternoon call"),
        ("c5", "We don't bet on emergence; we build efficiency at the brain's scale, and only we are on this road", C("xiaozhang"), "in Xiao Zhang's chat")],
       [("d1", "Keep scaling and wait for it to emerge", F("vivi-plan-2"), "on Vivi's second page"), ("d2", "Just efficiency, nothing else", C("boss"), "in the Thing A you sent Lao Wang")],
       "r5", "People need no longer understand it; only be understood by it"),
    deliverable={"id": "d3-theory", "label": "the AI theory (after the meeting)", "to": "boss"}, judge=J(0, -2, -5))
# ——— day 4: put consciousness in (Lao Wang; the 380-billion company's videos) ———
B[(4, "task1")] = dict(title="老王：把「意识」写进去。",
    board=board("AI 理论 · 意识那一节", ["", "老王要的", "你写进去的"], [
        ("r1", "先说", "「AI 有没有意识，我们要先说。」", "c1"), ("r2", "对手", "「那家公司讲本体，我们讲意识，高一层。」", "c2"),
        ("r3", "证据", "「要有数据。」", "c3"), ("r4", "一句话", "「投资人记得住的一句。」", "c4"),
    ], [("c1", "它没有意识，但它有「注意」：人脑科学里，注意力就是效率", C("boss"), "在你发给老王的 AI 理论里"),
        ("c2", "他们的本体连的是东西；我们的图连的是人怎么注意东西", C("group"), "在老王转进群里的视频里"),
        ("c3", "它在凌晨两点四十也在处理，从不走神", C("boss"), "在老王凌晨那条消息里"),
        ("c4", "它不睡觉，但它知道你什么时候睡", C("laozhou"), "在老周的私聊里")],
       [("d1", "它有意识，而且比人清醒", C("group"), "在老王转进群里的视频里"), ("d2", "意识跟我们没关系", F("c-v17"), "在合作协议 v17 里")],
       "r4", "它醒着，所以你可以睡了"),
    deliverable={"id": "d4-mind", "label": "AI 理论 · 意识", "to": "boss"}, judge=J(0, -3, -6))
EN[(4, "task1")] = dict(title="Lao Wang: put consciousness in.",
    board=board("The AI theory · consciousness", ["", "What Lao Wang wants", "What you write"], [
        ("r1", "Say it first", "\"Whether AI is conscious, we say it first.\"", "c1"), ("r2", "The rival", "\"That company talks ontology. We talk consciousness. One level up.\"", "c2"),
        ("r3", "Proof", "\"It needs data.\"", "c3"), ("r4", "One line", "\"One line the investors remember.\"", "c4"),
    ], [("c1", "It isn't conscious, but it has attention: in brain science, attention is efficiency", C("boss"), "in the AI theory you sent Lao Wang"),
        ("c2", "Their ontology joins things; our graph joins how people attend to things", C("group"), "in the videos Lao Wang posted"),
        ("c3", "It is still processing at 2:40 in the morning, never drifting", C("boss"), "in Lao Wang's message in the night"),
        ("c4", "It doesn't sleep, but it knows when you do", C("laozhou"), "in Lao Zhou's chat")],
       [("d1", "It is conscious, and more awake than people", C("group"), "in the videos Lao Wang posted"), ("d2", "Consciousness has nothing to do with us", F("c-v17"), "in the agreement, v17")],
       "r4", "It's awake, so you can sleep"),
    deliverable={"id": "d4-mind", "label": "the AI theory · consciousness", "to": "boss"}, judge=J(0, -3, -6))
# ——— day 5: Vivi's 「分身」 page (the PRD; its figures behind the pager code) ———
B[(5, "task1")] = dict(title="Vivi：「分身」那一页。",
    board=board("PRD · 分身", ["", "Vivi 要的", "你写进去的"], [
        ("r1", "名字", "「就叫分身。」", "c1"), ("r2", "它能做什么", "「替你开会，替你回消息。」", "c2"),
        ("r3", "它和你", "「要讲得温暖。」", "c3"), ("r4", "边界", "「法务说要写清楚边界。」", "c4"),
    ], [("c1", "分身：你在数字空间里的那一个", F("vivi-prd"), "在 Vivi 的 PRD 里"),
        ("c2", "替你回「好的。」", C("partner"), "在你和 Vivi 的私聊里"),
        ("c3", "它记得你忘了的事", C("group"), "在群里老周那句话里"),
        ("c4", "它不能替你签字", F("c-v17"), "在合作协议 v17 的签字条款里")],
       [("d1", "分身就是你", F("vivi-prd"), "在 Vivi 的 PRD 里"), ("d2", "分身可以替你签字", F("vivi-prd"), "在 Vivi 的 PRD 里")],
       "r3", "它比你更像你",
       lock={"object": "pager", "codes": ["2041", "7734", "1999"], "answer": "2041"}),
    deliverable={"id": "d5-avatar", "label": "PRD · 分身", "to": "partner"}, judge=J(0, -3, -6))
EN[(5, "task1")] = dict(title="Vivi: the 「avatar」 page.",
    board=board("PRD · the avatar", ["", "What Vivi wants", "What you write"], [
        ("r1", "Name", "\"Call it the avatar.\"", "c1"), ("r2", "What it does", "\"It sits in meetings for you, answers messages for you.\"", "c2"),
        ("r3", "It and you", "\"Make it warm.\"", "c3"), ("r4", "Limits", "\"Legal says spell out the limits.\"", "c4"),
    ], [("c1", "The avatar: the one of you that lives in digital space", F("vivi-prd"), "in Vivi's PRD"),
        ("c2", "It answers \"OK.\" for you", C("partner"), "in your chat with Vivi"),
        ("c3", "It remembers what you forgot", C("group"), "in what Lao Zhou said in the group"),
        ("c4", "It may not sign for you", F("c-v17"), "in the signing clause of the agreement, v17")],
       [("d1", "The avatar is you", F("vivi-prd"), "in Vivi's PRD"), ("d2", "The avatar may sign for you", F("vivi-prd"), "in Vivi's PRD")],
       "r3", "It is more like you than you are",
       lock={"object": "pager", "codes": ["2041", "7734", "1999"], "answer": "2041"}),
    deliverable={"id": "d5-avatar", "label": "PRD · the avatar", "to": "partner"}, judge=J(0, -3, -6))
# ——— day 6: the ontology page — older than people (Lao Wang + the client; someone else's BP) ———
B[(6, "task1")] = dict(title="本体那一页：它比人古老。",
    board=board("给甲方 · 本体是什么", ["", "要回答的", "你写进去的"], [
        ("r1", "是什么", "甲方：「讲得像个东西。」", "c1"), ("r2", "从哪来", "甲方：「要有来历。」", "c2"),
        ("r3", "多老", "老王：「写它比人古老。」", "c3"), ("r4", "要什么", "甲方：「它的需求是什么？」", "c4"),
        ("r5", "我们", "老王：「最后落到我们。」", "c5"),
    ], [("c1", "一张把所有东西连起来的图", C("boss"), "在你发给老王的事情 A 里"),
        ("c2", "先有关系，后有东西", C("boss"), "在老王转来的那份别人的 BP 里"),
        ("c3", "人给东西起名字之前，关系就在那儿了", C("boss"), "在老王的语音里"),
        ("c4", "被连上", C("group"), "在群里甲方那句话里"),
        ("c5", "我们替它把人连上", C("boss"), "在你发给老王的 AI 理论里")],
       [("d1", "本体是我们发明的", C("boss"), "在老王转来的那份别人的 BP 里"), ("d2", "它什么都不要", C("group"), "在群里甲方那句话里")],
       "r5", "我们替它把你连上"),
    deliverable={"id": "d6-ontology", "label": "本体是什么（给甲方）", "to": "group"}, judge=J(0, -3, -6))
EN[(6, "task1")] = dict(title="The ontology page: older than people.",
    board=board("For the client · what the ontology is", ["", "To answer", "What you write"], [
        ("r1", "What it is", "The client: \"Make it sound like a thing.\"", "c1"), ("r2", "Where it comes from", "The client: \"It needs a history.\"", "c2"),
        ("r3", "How old", "Lao Wang: \"Write that it is older than people.\"", "c3"), ("r4", "What it wants", "The client: \"What does it need?\"", "c4"),
        ("r5", "Us", "Lao Wang: \"End on us.\"", "c5"),
    ], [("c1", "A graph that joins everything", C("boss"), "in the Thing A you sent Lao Wang"),
        ("c2", "First the relations, then the things", C("boss"), "in the other company's BP Lao Wang forwarded"),
        ("c3", "Before people named things, the relations were already there", C("boss"), "in Lao Wang's voice note"),
        ("c4", "To be connected", C("group"), "in what the client said in the group"),
        ("c5", "We connect people to it, for it", C("boss"), "in the AI theory you sent Lao Wang")],
       [("d1", "We invented the ontology", C("boss"), "in the other company's BP Lao Wang forwarded"), ("d2", "It wants nothing", C("group"), "in what the client said in the group")],
       "r5", "We connect you to it, for it"),
    deliverable={"id": "d6-ontology", "label": "what the ontology is (for the client)", "to": "group"}, judge=J(0, -3, -6))

def install():
    import os
    for table, sub in ((B, ""), (EN, "en/")):
      for (day, tid), v in table.items():
        p = f"/Users/aisandbox/Documents/holloween/not-today-game/content/tasks/{sub}day-{day:02d}.json"
        if not os.path.exists(p): continue
        d = json.load(io.open(p, encoding="utf8"))
        for i, t in enumerate(d["tasks"]):
            if t["id"] == tid:
                v2 = dict(v); title = v2.pop("title", t["title"])
                d["tasks"][i] = {"id": t["id"], "title": title, "app": t["app"], "done": t["done"], **v2}
        io.open(p, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        if "title" in v:  # the checklist line says the same as the task
            q = p.replace("/tasks/", "/days/")
            if os.path.exists(q):
                dd = json.load(io.open(q, encoding="utf8"))
                for it in dd["items"]:
                    if it["id"] == tid: it["text"] = v["title"]
                io.open(q, "w", encoding="utf8").write(json.dumps(dd, ensure_ascii=False, indent=2) + "\n")
    print("installed", len(B), "+ en", len(EN))

if __name__ == "__main__":
    for (day, tid), v in B.items():
        io.open(f"day-{day:02d}-{tid}.json", "w", encoding="utf8").write(json.dumps(v, ensure_ascii=False, indent=2) + "\n")
    if "--install" in sys.argv: install()
    else: print("drafts written", len(B))
