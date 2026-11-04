# Day 3 task3 becomes an IDE board on public/docs/player/day-03-evolve.html (same code as day 1, new
# snapshot snap-2028-10-18-02; Lao Wang's headlines, facts and references unchanged). zh + en ide.files.
# Install after Kiro's run (and after beats_2_17.py):  PYTHONIOENCODING=utf8 python3 day03_ide.py --install
import json, io, sys, collections
R = "/Users/aisandbox/Documents/holloween/not-today-game/content/tasks"
def page(kick, title, key, row, extra):
    return ['import { SNAP } from "./snapshot.js";  // snap-2028-10-18-02', 'import { draw } from "./space.js";', "",
            "export const page = {", f'  kick: "{kick}",', f'  title: "{title}",  // 老王改的', f"  {key}: {{{{slot}}}},  // {row}", *extra, "};"]
ZH = {
 "r1": {"name": "01-瓶颈.js", "code": page("01 · 瓶颈", "卡在了人：一个还不如 AI 的大脑，在指挥 AI", "start", "出发点", [
     "  facts: SNAP.brainVsAI,  // 860 亿神经元 · 20 瓦 · 分区 · 只亮一小片（事实没改）", "  draw: (t) => draw.contrast(SNAP, t)"])},
 "r2": {"name": "02-方向.js", "code": page("02 · 方向", "不再让人指挥：驱动 AI 自进化", "scale", "放大", [
     "  route: (q) => SNAP.brains.filter((b) => b.fits(q)),  // 分给对的那几个", "  draw: (t) => draw.org(SNAP, t)"])},
 "r3": {"name": "03-共同智能空间.js", "code": page("03 · 共同智能空间", "自进化要有地方长：一个共同智能空间", "self", "人的投射", [
     "  stats: () => ({ nodes: SNAP.nodes.length, links: SNAP.links.length }),", "  draw: (t) => draw.project(SNAP, t)"])},
 "r4": {"name": "04-理解.js", "code": page("04 · 理解", "AI 自己找路，从一个点走到另一个点", "walk", "穿梭", [
     "  nearest: (q) => SNAP.nodes.sort((a, b) => d(q, a) - d(q, b)).slice(0, 5),", "  draw: (t) => draw.walk(SNAP, t)"])},
 "r5": {"name": "12-护城河.js", "code": page("12 · 护城河", "它一年比一年更像它自己", "way", "我们的方向", [
     "  // x′ = U x，UᵀU = I：点不动，距离也不动（公式没改）", "  draw: (t) => draw.rotate(SNAP, t)"])},
}
EN = {
 "r1": {"name": "01-bottleneck.js", "code": page("01 · Bottleneck", "Stuck on people: a brain weaker than AI is steering AI", "start", "starting point", [
     "  facts: SNAP.brainVsAI,  // 86 bn neurons · 20 W · regions · a small patch lit (facts unchanged)", "  draw: (t) => draw.contrast(SNAP, t)"])},
 "r2": {"name": "02-direction.js", "code": page("02 · Direction", "No more human steering: drive AI to evolve itself", "scale", "scale up", [
     "  route: (q) => SNAP.brains.filter((b) => b.fits(q)),  // to the right few", "  draw: (t) => draw.org(SNAP, t)"])},
 "r3": {"name": "03-shared-space.js", "code": page("03 · A shared space", "Self-evolution needs room to grow: a shared intelligence space", "self", "the human projection", [
     "  stats: () => ({ nodes: SNAP.nodes.length, links: SNAP.links.length }),", "  draw: (t) => draw.project(SNAP, t)"])},
 "r4": {"name": "04-understanding.js", "code": page("04 · Understanding", "AI finds its own way from point to point", "walk", "moving through", [
     "  nearest: (q) => SNAP.nodes.sort((a, b) => d(q, a) - d(q, b)).slice(0, 5),", "  draw: (t) => draw.walk(SNAP, t)"])},
 "r5": {"name": "12-moat.js", "code": page("12 · Moat", "Every year it looks more like itself", "way", "our direction", [
     "  // x′ = U x, UᵀU = I: points and distances unchanged (formula unchanged)", "  draw: (t) => draw.rotate(SNAP, t)"])},
}
def install():
    for path, files in ((f"{R}/day-03.json", ZH), (f"{R}/en/day-03.json", EN)):
        d = json.load(io.open(path, encoding="utf8"), object_pairs_hook=collections.OrderedDict)
        t = next(x for x in d["tasks"] if x["id"] == "task3"); b = t["board"]
        b["view"] = "ide"
        b["ide"] = {"src": "/docs/player/day-03-evolve.html", "pages": {"r1": 0, "r2": 1, "r3": 2, "r4": 3, "r5": 11}, "files": files}
        io.open(path, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("day 3 task3: ide on day-03-evolve.html, zh + en")
if __name__ == "__main__":
    if "--install" in sys.argv: install()
