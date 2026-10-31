# 出租屋 3D（高斯 splat）流水线 · 2026-10-30

目的：房间和桌上的两台办公显示器 + Mac 只生成一次，所有镜头都是同一个场景换机位，背景永远一致（作者 10-31 的要求）。

1. 视频：`node script/tools/veo.mjs out.mp4 "<提示词>"`。Veo 3.1 preview 已下线，脚本改走 Gemini Omni 1.1 Flash 的 Interactions API（`response_modalities: ["video"]`，8 秒 1280×720）。
   - 纯文字提示里写「40° 弧线」它几乎不动（room_day.mp4）。
   - 有效的写法：图生视频（首帧 = 上一条的第一帧 `first.png`），并把**画面里会发生的变化**写出来：「窗户变大移到画面中央，桌子退到右边缘，床出画」（room_track.mp4 向左、room_track_r.mp4 向右）。
2. 抽帧：三段按「最左 → 起点 → 最右」排成一条路径，`imgs/0001..0160.png`。
3. 机位：companydata 的 `scripts/beta3d/sfm.py - sfm --images imgs --overlap 12`（pycolmap，160/160 帧注册，38 秒）。
4. 训练：`brush_app sfm --total-steps 15000 --export-every 15000 --export-path splat --max-resolution 1280`。
5. 转格式：`ply2splat.py` → `splat/room.splat`；初始机位 `view.py sfm`。
6. 看：`viewer.html?pos=&look=&up=`（静态服务器 8788）。

崩坏不画进 splat：全屏后期着色器（阶段 1–2）、按 3D 坐标摆的面片细节（阶段 3–4）、屏幕和缝是 DOM/canvas、第 17 天整屋换皮 = 用 Muse 改首帧再走一遍这条流水线得到第二个 splat 淡入。

## 结果（2026-10-30 15:50）

- `splat/room.splat` 49,263 个高斯，1.6 MB。Brush 15000 步约 8 分钟。
- 机位（世界坐标，up ≈ (0,-1,0)）：
  - 最左 f001 pos (4.975,-0.134,3.606) look (-5.070,-0.091,11.139)
  - 中段 f080 pos (-3.127,-0.071,-0.872) look (0.615,-0.118,22.497)   ← 默认
  - 最右 f159 pos (-6.312,0.068,4.090) look (9.106,0.167,12.600)
  - 凑近桌面 pos (-1.0,0,6.0) look (0.6,-0.1,22.5)（很干净，适合做白天工作镜头）
- 坑：查看器第一帧可能全黑，是排序线程还没醒；加载后把相机轻推一下就好（viewer.html 已加）。
- 样张：`shots/sheet_room_splat.png`。

## 门墙（2026-10-31）

- 两段补拍：`room_door.mp4`（从桌子转到门，纯转头）、`room_door_track.mp4`（正对门向左横移）。纯转头那段的尾巴注册不进主模型，门墙单独成模型（sfm3/sparse/1 → sfm_door），Brush 12000 步 → `splat_door/door.splat`，10,229 个高斯，0.3 MB。
- 它和 `room.splat` 不在同一坐标系：游戏里当第二个场景，手动摆到窗对面（两边都有床脚可对）。白墙没纹理，边缘有拉丝，夜里压暗后看不出来；门扇仍用单独的面片做开合。
- 机位：f43 pos (0.023,0.053,0.324) look (-2.706,-0.439,24.833)；f20 pos (3.691,0.024,1.338) look (4.542,-0.449,25.692)；f60 pos (-2.819,-0.016,-1.136) look (-8.181,-0.383,22.143)；up ≈ (0,-1,0)。
- 样张 `shots/door_splat.jpg`。

## v2（2026-11-01）

- 补拍两段：`room_up.mp4`（抬头到天花板）、`room_left.mp4`（转向窗墙）。主模型 264/288 帧（天花板最上面那段纯转头又碎开，没进）。Brush 18000 步 → `splat2/room.splat`，67,971 个高斯，2.2 MB。已替换 public/room/room.splat。
- 新增机位：窗墙 pos (5.602,-0.133,3.728) look (-5.378,-0.671,12.979)。桌面机位不变，更清晰，空调和天花板进来了。
- 样张 `shots/v2_desk.jpg`、`shots/v2_window.jpg`。
