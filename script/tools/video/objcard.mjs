// objcard.mjs <out.png> id1 id2 ...: the objects' front pictures in a row on the dark ground (as the 98-second promo showed them)
import { spawnSync } from "node:child_process";
const [out, ...ids] = process.argv.slice(2); const FF = "/Users/aisandbox/Documents/companydata/node_modules/ffmpeg-static/ffmpeg", W = 1920, H = 1080, cell = Math.floor(W / ids.length);
const ins = ids.flatMap((id) => ["-i", `/Users/aisandbox/Documents/holloween/not-today-game/public/objects/${id}_front.png`]);
let fc = `color=c=0x050507:s=${W}x${H}:d=1[bg0];`; ids.forEach((id, i) => { fc += `[${i}:v]scale=${cell - 90}:560:force_original_aspect_ratio=decrease:flags=lanczos[o${i}];[bg${i}][o${i}]overlay=x=${i * cell}+(${cell}-w)/2:y=(${H}-h)/2[bg${i + 1}];`; });
const r = spawnSync(FF, ["-loglevel", "error", "-y", ...ins, "-filter_complex", fc.slice(0, -1), "-map", `[bg${ids.length}]`, "-frames:v", "1", out], { stdio: "inherit" }); process.exit(r.status);
