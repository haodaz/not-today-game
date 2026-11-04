# Day 1 task3's ide.files (shell spec R4): the code of each page with a slot, zh and en.
# Install after Kiro's shell run:  PYTHONIOENCODING=utf8 python3 day01_files.py --install
import json, io, sys, collections
R = "/Users/aisandbox/Documents/holloween/not-today-game/content/tasks"

def page(kick, title, key, row, extra):
    return [
        'import { SNAP } from "./snapshot.js";',
        'import { draw } from "./space.js";',
        "",
        "export const page = {",
        f'  kick: "{kick}",',
        f'  title: "{title}",',
        f"  {key}: {{{{slot}}}},  // {row}",
        *extra,
        "};",
    ]

ZH = {
  "r1": {"name": "03-共同智能空间.js", "code": page("03 · 共同智能空间", "群体脑要一起干活，先得有一个共同智能空间", "base", "我们靠什么做事", [
      "  stats: () => ({ nodes: SNAP.nodes.length, links: SNAP.links.length, clients: SNAP.clients.length }),",
      "  draw: (t) => draw.project(SNAP, t),  // x = φ(现实) ∈ 𝒮"])},
  "r2": {"name": "05-三套说法.js", "code": page("05 · 投射 · 三套说法", "可现实不会自己排好队：三家客户，三套说法", "data", "甲方的数据怎么进来", [
      "  fields: SNAP.clients.map((c) => c.fields),  // 客户名称 / 甲方单位 / 签约主体",
      "  draw: (t) => draw.columns(SNAP.clients, t)"])},
  "r3": {"name": "11-AI先合人再核.js", "code": page("11 · 以脑为本 ③ AI 先合，人再核", "第三招：AI 先合一版，人再核一遍，每一次都回流", "ai", "AI 在我们这儿干了什么", [
      "  loop: (x, y, yHat, K) => x + K * (y - yHat),  // 回流修正，Σ 一轮一轮缩小",
      "  draw: (t) => draw.review(SNAP.reviews, t)"])},
  "r4": {"name": "12-护城河.js", "code": page("12 · 护城河", "所以模型年年换，空间一直是我们的", "edge", "跟别家比，我们有什么", [
      "  // 换模型只是换一种读法：x′ = U x，UᵀU = I，点和点的距离不变",
      "  draw: (t) => draw.rotate(SNAP, t)"])},
  "r5": {"name": "13-客户.js", "code": page("13 · 客户", "这条路已经接上了客户：在链路上的，和已经到账的", "proof", "拿得出手的", [
      "  clients: SNAP.receivable,  // 以应收表为准，截在快照那一刻",
      "  draw: (t) => draw.clients(SNAP.receivable, t)"])},
}
EN = {
  "r1": {"name": "03-shared-space.js", "code": page("03 · A shared intelligence space", "A group of brains needs one shared space to work in", "base", "what we run on", [
      "  stats: () => ({ nodes: SNAP.nodes.length, links: SNAP.links.length, clients: SNAP.clients.length }),",
      "  draw: (t) => draw.project(SNAP, t),  // x = φ(reality) ∈ 𝒮"])},
  "r2": {"name": "05-three-vocabularies.js", "code": page("05 · Projection · three vocabularies", "Reality doesn't line up by itself: three clients, three vocabularies", "data", "how the client's data comes in", [
      "  fields: SNAP.clients.map((c) => c.fields),  // client name / contracting party / signatory",
      "  draw: (t) => draw.columns(SNAP.clients, t)"])},
  "r3": {"name": "11-ai-first-human-check.js", "code": page("11 · Brain-first ③ AI first, a human checks", "Third: AI merges a draft, a human checks it, and every check flows back", "ai", "what AI does here", [
      "  loop: (x, y, yHat, K) => x + K * (y - yHat),  // flow back; Σ shrinks round by round",
      "  draw: (t) => draw.review(SNAP.reviews, t)"])},
  "r4": {"name": "12-moat.js", "code": page("12 · Moat", "Models change every year; the space stays ours", "edge", "what we have that others don't", [
      "  // a new model is a new way of reading: x′ = U x, UᵀU = I, distances unchanged",
      "  draw: (t) => draw.rotate(SNAP, t)"])},
  "r5": {"name": "13-clients.js", "code": page("13 · Clients", "This road already reaches clients: in the pipeline, and paid", "proof", "what we can show", [
      "  clients: SNAP.receivable,  // per the receivables sheet, cut at the snapshot",
      "  draw: (t) => draw.clients(SNAP.receivable, t)"])},
}

def find_ide(o):
    if isinstance(o, dict):
        if o.get("view") == "ide": return o
        for v in o.values():
            r = find_ide(v)
            if r is not None: return r
    elif isinstance(o, list):
        for v in o:
            r = find_ide(v)
            if r is not None: return r
    return None

def install():
    for path, files in ((f"{R}/day-01.json", ZH), (f"{R}/en/day-01.json", EN)):
        d = json.load(io.open(path, encoding="utf8"), object_pairs_hook=collections.OrderedDict)
        b = find_ide(d); assert b is not None, path
        for v in files.values(): assert sum("{{slot}}" in l for l in v["code"]) == 1
        b["ide"]["files"] = files
        io.open(path, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("ide.files installed: zh + en")

if __name__ == "__main__":
    if "--install" in sys.argv: install()
    else: print("\n".join(ZH["r1"]["code"]))
