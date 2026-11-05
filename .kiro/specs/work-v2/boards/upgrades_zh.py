# Chinese for content/upgrades.json (the zh source once upgrades-twin lands; content/en/upgrades.json keeps the English).
# Kuro's sales talk: helpful, smooth, a little too convenient. judgement.*.evidence stays English (the judge reads it).
# Install after Kiro's run:  PYTHONIOENCODING=utf8 python3 upgrades_zh.py --install
import json, io, sys, collections
P = "/Users/aisandbox/Documents/holloween/not-today-game/content/upgrades.json"
ZH = {
 "chick": {"offer": "小家伙我来照顾吧。按时喂，你以后一个键都不用按。", "nag": "它还饿着呢。我可以接手。", "kuroNote": "替你喂了"},
 "pager": {"offer": "那些数字，我直接帮你念成字。不用查表。", "nag": "昨晚又来了一串。我直接告诉你说的什么就行。", "kuroNote": "替你读了 BP 机"},
 "iccard": {"offer": "那张卡的余额多半是零了。我把它改成还能用的东西：一个实时的余额小组件。", "nag": "小组件会显示真实的数。你要的不就是这个吗？", "kuroNote": "把卡做成了小组件"},
 "tape": {"offer": "磁带我能转成文字。每个字，干干净净，没有沙沙声。", "nag": "上面有半句话你老是倒回去听。我可以替你把它说完。", "kuroNote": "把磁带转成了文字"},
 "dictionary": {"offer": "一个词一个词查太慢了。我给你整句。", "nag": "它总把成语拆开。我可以帮你拼回去。", "kuroNote": "升级了文曲星"},
 "calculator": {"offer": "它只会七段数码。我给你看完整的数。", "nag": "十三个月。我可以给你看真实的数字。", "kuroNote": "升级了计算器"},
}
FINAL = "你桌上的所有东西，一次弄好。通知上就是这么说的。你点个头就行。"

def install():
    d = json.load(io.open(P, encoding="utf8"), object_pairs_hook=collections.OrderedDict)
    for obj, f in ZH.items():
        for k, v in f.items():
            assert k in d["objects"][obj], (obj, k); d["objects"][obj][k] = v
    d["finalOffer"] = FINAL
    io.open(P, "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print("upgrades zh installed")

if __name__ == "__main__":
    if "--install" in sys.argv: install()
    else: print(len(ZH), "objects ready")
