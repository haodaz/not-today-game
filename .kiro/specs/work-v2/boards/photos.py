# content/photos.json: what an instant photo of the room shows that the eye did not, per (day, facing).
# Escalates with stages.json (0 d1–3 · 1 d4–6 · 3 d7–9 · 4 d10–12 · 5 d13–18). Plain, small, never explained.
# room = the desk wall (desk, two monitors, lamp, tower, chair); bed = the bed wall (bed, the narrow window by
# the door, the shelf); door = the door (chain, peephole, the delivery spot); window = the window and the table.
# Keyed by the SHOOTING day. The camera arrives on day 2 and works from day 3. A room photo comes out blank and
# develops overnight (shot day n, seen day n+1): days 3–17. Day 18 is the one exception: it develops on the spot,
# and what it shows is Kuro (author: 「18天拍克总总不能第19天拿照片」). Each day matches its god (邪神办公目录).
import json, io, sys, collections
OD = collections.OrderedDict
R = {
 3: {"room": "椅子背上搭着一件外套。你没有这件外套。", "bed": "被子上有一个人躺过的凹痕。你今天还没躺。", "door": "门缝底下，一道影子，像有人站着。", "window": "窗外楼下，有一个人仰着头，看你这扇窗。"},
 4: {"room": "两块屏幕之间那条缝里，渗出一点海水。", "bed": "被子上有几片鳞，银灰色的。", "door": "猫眼外的人，眼睛分得很开，像鱼。", "window": "窗玻璃上结了一层盐。"},
 5: {"room": "桌上多了一个金属圆筒，接着线，连到主机。", "bed": "枕头边一封信，是你的笔迹，写得不像你。", "door": "门外站着一个有翅膀的东西，像菌，又像虾。", "window": "天上有东西，从很远的星星那边飞过来。"},
 6: {"room": "屏幕上那张图，背后钉着一张照片。", "bed": "床边的墙上挂着一幅画，画的是你躺在床上。", "door": "门缝底下伸进来一只手，指甲很长，像在找吃的。", "window": "饭桌上的外卖被啃过。齿印不是人的。"},
 7: {"room": "地板上画着一个圈，椅子正好在圈里。", "bed": "床单上的褶子，排成一个三角。", "door": "门上画着一个印记，笔顺很讲究。", "window": "窗上的雨水流成一道一道，数一数，七十二道。"},
 8: {"room": "桌上十三双筷子，一双没拆。", "bed": "竖窗外面贴着一张脸，戴着王冠，背光。", "door": "门外有骆驼的影子，有人在吹号。", "window": "日落的方向不对。太阳从窗户的另一边下去。"},
 9: {"room": "椅子上坐着一个人。照片里只有轮廓，像一个三角。", "bed": "床头的墙上，有九个格子的影子。数一数是十个。", "door": "门开着一条缝。门外是会议的宫格。", "window": "窗玻璃上一个黄色的记号，不是任何字。"},
 10: {"room": "台灯是黄的。照片里所有东西都是黄的。", "bed": "被子底下躺着一个人，戴着苍白的面具。", "door": "门上贴着一张剧本的纸，第二幕。", "window": "窗外有两个太阳，正往湖里沉。外面没有湖。"},
 11: {"room": "桌上一杆秤。一边是麦子，一边什么都没有，可它平着。", "bed": "床脚坐着一匹黑马的影子。",
      "door": "门口放着一碗大麦饭，冒着热气。", "window": "饭桌上只剩一只碗，碗里是空的。"},
 12: {"room": "两块屏幕都亮着，凌晨三点的群消息：「收到」。", "bed": "床上躺着一尊白色胸像。脸是你的。",
      "door": "门外很亮，像东北边有颗星落在了楼道里。", "window": "窗帘拉着。你没拉。"},
 13: {"room": "桌上摊开一本很厚的书，第 751 页。", "bed": "竖窗变成了一扇门，开着。",
      "door": "门是两扇。一扇是钥匙，一扇是守卫。", "window": "窗外的日历停在 11 月 1 日。"},
 14: {"room": "主机的指示灯是一只眼睛。", "bed": "床底下，挤满了很小的、黑的蹄子。",
      "door": "门外排着队，看不到头。每个人手里一张工牌，名字都是空的。", "window": "窗外的树林，长到了楼下。"},
 15: {"room": "屏幕里的会议，十二格，一格不剩地看着镜头。", "bed": "床上有火花跳过的焦痕。",
      "door": "门外站着一个穿长袍的人，很高，脸看不清，像从很远的地方来。", "window": "窗外的人排成一队，往没有光的地方走。"},
 16: {"room": "桌面上的东西全都轻轻浮着，离开桌面一指。", "bed": "床在发抖，像有很重的鼓声从地下传上来。",
      "door": "门在敲。照片拍下的是声音的形状。", "window": "窗外什么都没有。不是黑，是没有。"},
 17: {"room": "椅子上的你回过头，看着镜头。", "bed": "床上整整齐齐，像没人睡过。十七天没人睡过。",
      "door": "门开了。门外站着每一个你认识的人，长着同一张脸。", "window": "窗玻璃上全是字：回一下我。"},
 18: {"room": "桌边蹲着一条很大的黑狗，湿的毛，很多只眼睛。它在看你。", "bed": "床上趴着它，占满了整张床，触须从下巴一直垂到地上。", "door": "门那面整面墙，都是它的影子。", "window": "窗外没有天。是它的一只眼睛。"},
}

def build():
    room = [OD([("day", d), ("facing", f), ("add", OD([("text", t)]))]) for d in sorted(R) for f, t in R[d].items()]
    return OD([("_note", "What an instant photo of the room shows that the eye did not, per (day, facing). Claude, 2026-11-04 (author: 每天拍某个角落会有崩坏的东西被拍出来). Escalates with the stages."),
               ("room", room), ("screen", [])])

if __name__ == "__main__":
    d = build()
    if "--install" in sys.argv:
        io.open("/Users/aisandbox/Documents/holloween/not-today-game/content/photos.json", "w", encoding="utf8").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
    print(len(d["room"]), "room photos")
